-- =====================================================
-- DEFINITIVE FIX: All notification system issues
-- Run this ONCE in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- STEP 1: Fix notifications table - add all missing columns
-- =====================================================
ALTER TABLE public.notifications 
  ADD COLUMN IF NOT EXISTS notification_type TEXT,
  ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Set defaults for any existing rows
UPDATE public.notifications 
SET notification_type = 'system' WHERE notification_type IS NULL;

UPDATE public.notifications 
SET data = '{}'::jsonb WHERE data IS NULL;

UPDATE public.notifications 
SET is_read = false WHERE is_read IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- =====================================================
-- STEP 2: Ensure RLS is enabled and policies exist
-- =====================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;

CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- STEP 3: Recreate create_notification with correct column
-- =====================================================
DROP FUNCTION IF EXISTS public.create_notification CASCADE;

CREATE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, notification_type, title, message, data, is_read)
  VALUES (p_user_id, p_type, p_title, p_message, p_data, false)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;

-- =====================================================
-- STEP 4: Recreate mark_notification_read
-- =====================================================
DROP FUNCTION IF EXISTS public.mark_notification_read CASCADE;

CREATE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE id = p_notification_id AND user_id = auth.uid();
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.mark_notification_read TO authenticated;

-- =====================================================
-- STEP 5: Recreate mark_all_notifications_read
-- =====================================================
DROP FUNCTION IF EXISTS public.mark_all_notifications_read CASCADE;

CREATE FUNCTION public.mark_all_notifications_read()
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = auth.uid() AND is_read = false;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read TO authenticated;

-- =====================================================
-- STEP 6: Recreate send_project_invitation
-- =====================================================
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
BEGIN
  IF p_user_id IS NULL AND p_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Either user_id or email must be provided');
  END IF;

  SELECT name INTO v_project_name FROM projects WHERE id = p_project_id;
  IF v_project_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Project not found');
  END IF;

  SELECT COALESCE(first_name || ' ' || last_name, email, 'Ein Teammitglied')
  INTO v_inviter_name FROM profiles WHERE id = auth.uid();

  IF p_user_id IS NOT NULL THEN
    SELECT pm.id, pm.invitation_token, pm.accessor_id, pm.user_id
    INTO v_member_id, v_invitation_token, v_accessor_id, v_actual_user_id
    FROM project_members pm
    WHERE pm.project_id = p_project_id AND pm.user_id = p_user_id;
    v_actual_user_id := p_user_id;
  ELSE
    SELECT pm.id, pm.invitation_token, pm.accessor_id, COALESCE(pm.user_id, ua.registered_user_id)
    INTO v_member_id, v_invitation_token, v_accessor_id, v_actual_user_id
    FROM project_members pm
    JOIN user_accessors ua ON ua.id = pm.accessor_id
    WHERE pm.project_id = p_project_id AND ua.accessor_email = p_email;
  END IF;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member not found');
  END IF;

  IF v_actual_user_id IS NULL AND v_accessor_id IS NOT NULL THEN
    SELECT registered_user_id INTO v_actual_user_id
    FROM user_accessors WHERE id = v_accessor_id;
  END IF;

  UPDATE project_members
  SET status = 'invited', invited_at = now(), user_id = COALESCE(v_actual_user_id, user_id)
  WHERE id = v_member_id
  RETURNING invitation_token INTO v_invitation_token;

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

GRANT EXECUTE ON FUNCTION public.send_project_invitation TO authenticated;

-- =====================================================
-- STEP 7: Recreate accept_project_invitation
-- =====================================================
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

  PERFORM create_notification(
    auth.uid(), 'system', 'Projekteinladung akzeptiert',
    'Sie sind jetzt Mitglied von "' || v_member.project_name || '"',
    jsonb_build_object('project_id', v_member.project_id)
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

-- =====================================================
-- STEP 8: Verify everything works
-- =====================================================
SELECT 'SETUP COMPLETE' as status;

SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notifications'
ORDER BY ordinal_position;
