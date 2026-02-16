-- =====================================================
-- FIX: Allow invitations for users without accounts
-- Date: 2026-02-16
-- =====================================================

-- Drop ALL versions of the function regardless of signature
DROP FUNCTION IF EXISTS public.send_project_invitation CASCADE;

-- Create the new version with email support
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

  -- Check if member already exists (by user_id or by project+email combination)
  IF p_user_id IS NOT NULL THEN
    SELECT id, invitation_token INTO v_member_id, v_invitation_token
    FROM project_members pm
    WHERE pm.project_id = p_project_id AND pm.user_id = p_user_id;
  ELSE
    -- Look up by email through accessor
    SELECT pm.id, pm.invitation_token INTO v_member_id, v_invitation_token
    FROM project_members pm
    JOIN user_accessors ua ON ua.id = pm.accessor_id
    WHERE pm.project_id = p_project_id 
      AND ua.accessor_email = p_email;
  END IF;

  IF v_member_id IS NOT NULL THEN
    -- Update existing member (don't update role - it's managed separately via role_id)
    UPDATE project_members
    SET
      status = 'invited',
      invited_at = now(),
      user_id = COALESCE(p_user_id, user_id)
    WHERE id = v_member_id
    RETURNING invitation_token INTO v_invitation_token;
  ELSE
    -- For email-only invitations, we can't create a member without accessor_id
    -- This should be handled by the frontend creating the accessor first
    RETURN jsonb_build_object('success', false, 'error', 'Member not found. Please add member first through project settings.');
  END IF;

  -- Create notification ONLY if user has an account
  IF p_user_id IS NOT NULL THEN
    PERFORM create_notification(
      p_user_id,
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
    'has_account', p_user_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.send_project_invitation TO authenticated;
