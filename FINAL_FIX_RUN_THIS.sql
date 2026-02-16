-- =====================================================
-- FINAL DEFINITIVE FIX: Look up user by email directly
-- This fixes the root cause - user_id was never linked
-- =====================================================

-- Drop and recreate send_project_invitation
DROP FUNCTION IF EXISTS public.send_project_invitation CASCADE;

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
  v_accessor_email TEXT;
  v_looked_up_user_id UUID;
BEGIN
  IF p_user_id IS NULL AND p_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Either user_id or email must be provided');
  END IF;

  -- Get project name
  SELECT name INTO v_project_name FROM projects WHERE id = p_project_id;
  IF v_project_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Project not found');
  END IF;

  -- Get inviter name
  SELECT COALESCE(first_name || ' ' || last_name, email, 'Ein Teammitglied')
  INTO v_inviter_name FROM profiles WHERE id = auth.uid();

  -- ===== FIND THE MEMBER =====
  IF p_user_id IS NOT NULL THEN
    SELECT pm.id, pm.invitation_token, pm.accessor_id, pm.user_id
    INTO v_member_id, v_invitation_token, v_accessor_id, v_actual_user_id
    FROM project_members pm
    WHERE pm.project_id = p_project_id AND pm.user_id = p_user_id;
    v_actual_user_id := p_user_id;
  ELSE
    SELECT pm.id, pm.invitation_token, pm.accessor_id, pm.user_id, ua.accessor_email
    INTO v_member_id, v_invitation_token, v_accessor_id, v_actual_user_id, v_accessor_email
    FROM project_members pm
    JOIN user_accessors ua ON ua.id = pm.accessor_id
    WHERE pm.project_id = p_project_id AND ua.accessor_email = p_email;
  END IF;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member not found');
  END IF;

  -- ===== KEY FIX: If we don't have a user_id yet, try to find it =====
  
  -- Step 1: Check registered_user_id on accessor
  IF v_actual_user_id IS NULL AND v_accessor_id IS NOT NULL THEN
    SELECT registered_user_id INTO v_actual_user_id
    FROM user_accessors WHERE id = v_accessor_id;
  END IF;

  -- Step 2: Get accessor email if we don't have it
  IF v_accessor_email IS NULL AND v_accessor_id IS NOT NULL THEN
    SELECT ua.accessor_email INTO v_accessor_email
    FROM user_accessors ua WHERE ua.id = v_accessor_id;
  END IF;

  -- Step 3: Look up user directly by email in profiles table
  IF v_actual_user_id IS NULL AND v_accessor_email IS NOT NULL THEN
    SELECT p.id INTO v_looked_up_user_id
    FROM profiles p
    WHERE LOWER(p.email) = LOWER(v_accessor_email)
    LIMIT 1;
    
    IF v_looked_up_user_id IS NOT NULL THEN
      v_actual_user_id := v_looked_up_user_id;
      
      -- Also fix the accessor for future use
      UPDATE user_accessors 
      SET registered_user_id = v_looked_up_user_id
      WHERE id = v_accessor_id AND registered_user_id IS NULL;
    END IF;
  END IF;

  -- Step 4: Also try auth.users table as last resort
  IF v_actual_user_id IS NULL AND v_accessor_email IS NOT NULL THEN
    SELECT au.id INTO v_looked_up_user_id
    FROM auth.users au
    WHERE LOWER(au.email) = LOWER(v_accessor_email)
    LIMIT 1;
    
    IF v_looked_up_user_id IS NOT NULL THEN
      v_actual_user_id := v_looked_up_user_id;

      -- Fix accessor and ensure profile exists
      UPDATE user_accessors 
      SET registered_user_id = v_looked_up_user_id
      WHERE id = v_accessor_id AND registered_user_id IS NULL;
    END IF;
  END IF;

  -- ===== UPDATE MEMBER =====
  UPDATE project_members
  SET status = 'invited', invited_at = now(), user_id = COALESCE(v_actual_user_id, user_id)
  WHERE id = v_member_id
  RETURNING invitation_token INTO v_invitation_token;

  -- ===== CREATE NOTIFICATION =====
  IF v_actual_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, notification_type, title, message, data, is_read)
    VALUES (
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
      ),
      false
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'member_id', v_member_id,
    'invitation_token', v_invitation_token,
    'project_name', v_project_name,
    'has_account', v_actual_user_id IS NOT NULL,
    'user_id', v_actual_user_id,
    'notification_created', v_actual_user_id IS NOT NULL,
    'accessor_email', v_accessor_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.send_project_invitation TO authenticated;

-- ===== Also recreate accept to use correct column =====
DROP FUNCTION IF EXISTS public.accept_project_invitation CASCADE;

CREATE FUNCTION public.accept_project_invitation(
  p_invitation_token UUID
) RETURNS JSONB AS $$
DECLARE
  v_member RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT pm.*, p.name as project_name
  INTO v_member
  FROM project_members pm
  JOIN projects p ON p.id = pm.project_id
  WHERE pm.invitation_token = p_invitation_token AND pm.status = 'invited';

  IF v_member IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;

  IF v_member.user_id IS NOT NULL AND v_member.user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation is for a different user');
  END IF;

  UPDATE project_members
  SET status = 'active', user_id = auth.uid(), accepted_at = now()
  WHERE id = v_member.id;

  DELETE FROM notifications
  WHERE user_id = auth.uid()
    AND notification_type = 'project_invitation'
    AND (data->>'invitation_token')::uuid = p_invitation_token;

  INSERT INTO public.notifications (user_id, notification_type, title, message, data, is_read)
  VALUES (
    auth.uid(),
    'system',
    'Projekteinladung akzeptiert',
    'Sie sind jetzt Mitglied von "' || v_member.project_name || '"',
    jsonb_build_object('project_id', v_member.project_id),
    false
  );

  RETURN jsonb_build_object(
    'success', true,
    'project_id', v_member.project_id,
    'project_name', v_member.project_name,
    'member_id', v_member.id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.accept_project_invitation TO authenticated;

-- ===== Verify =====
SELECT 'ALL FUNCTIONS RECREATED' as status;

-- ===== Also fix existing data: link accessors to profiles by email =====
UPDATE user_accessors ua
SET registered_user_id = p.id
FROM profiles p
WHERE LOWER(ua.accessor_email) = LOWER(p.email)
  AND ua.registered_user_id IS NULL;

-- ===== Fix existing project_members: sync user_id from accessor =====
UPDATE project_members pm
SET user_id = ua.registered_user_id
FROM user_accessors ua
WHERE ua.id = pm.accessor_id
  AND pm.user_id IS NULL
  AND ua.registered_user_id IS NOT NULL;

SELECT 'DATA SYNC COMPLETE' as status;
