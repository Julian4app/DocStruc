-- =====================================================
-- FIX: Sync user_id from accessor when inviting
-- Date: 2026-02-16
-- =====================================================

-- Drop the function
DROP FUNCTION IF EXISTS public.send_project_invitation CASCADE;

-- Create the new version with proper user_id syncing
CREATE FUNCTION public.send_project_invitation(
  p_project_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_email TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_invitation_token UUID;
  v_member_id UUID;
  v_project_name TEXT;
  v_inviter_name TEXT;
  v_actual_user_id UUID;
  v_accessor_id UUID;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL AND p_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Either user_id or email must be provided');
  END IF;

  -- Get project name
  SELECT name INTO v_project_name
  FROM projects
  WHERE id = p_project_id;

  IF v_project_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Project not found');
  END IF;

  -- Get inviter name
  SELECT COALESCE(first_name || ' ' || last_name, email, 'Ein Teammitglied')
  INTO v_inviter_name
  FROM profiles
  WHERE id = auth.uid();

  -- Find the member and their actual user_id
  IF p_user_id IS NOT NULL THEN
    -- Look up by user_id first
    SELECT pm.id, pm.invitation_token, pm.accessor_id, pm.user_id
    INTO v_member_id, v_invitation_token, v_accessor_id, v_actual_user_id
    FROM project_members pm
    WHERE pm.project_id = p_project_id AND pm.user_id = p_user_id;
    
    v_actual_user_id := p_user_id;
  ELSE
    -- Look up by email through accessor
    SELECT pm.id, pm.invitation_token, pm.accessor_id, COALESCE(pm.user_id, ua.registered_user_id)
    INTO v_member_id, v_invitation_token, v_accessor_id, v_actual_user_id
    FROM project_members pm
    JOIN user_accessors ua ON ua.id = pm.accessor_id
    WHERE pm.project_id = p_project_id 
      AND ua.accessor_email = p_email;
  END IF;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member not found. Please add member first through project settings.');
  END IF;

  -- If we found a registered_user_id from accessor but member.user_id is NULL, sync it
  IF v_actual_user_id IS NULL AND v_accessor_id IS NOT NULL THEN
    SELECT registered_user_id INTO v_actual_user_id
    FROM user_accessors
    WHERE id = v_accessor_id;
  END IF;

  -- Update member with invitation status and sync user_id if needed
  UPDATE project_members
  SET
    status = 'invited',
    invited_at = now(),
    user_id = COALESCE(v_actual_user_id, user_id)
  WHERE id = v_member_id
  RETURNING invitation_token INTO v_invitation_token;

  -- Create notification ONLY if user has an account
  IF v_actual_user_id IS NOT NULL THEN
    PERFORM create_notification(
      v_actual_user_id,
      'project_invitation',
      'Projekteinladung',
      v_inviter_name || ' hat Sie zum Projekt "' || v_project_name || '" eingeladen',
      jsonb_build_object(
        'project_id', p_project_id,
        'project_name', v_project_name,
        'invitation_token', v_invitation_token,
        'inviter_id', auth.uid(),
        'inviter_name', v_inviter_name
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'member_id', v_member_id,
    'invitation_token', v_invitation_token,
    'project_name', v_project_name,
    'has_account', v_actual_user_id IS NOT NULL,
    'user_id', v_actual_user_id,
    'notification_created', v_actual_user_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.send_project_invitation TO authenticated;
