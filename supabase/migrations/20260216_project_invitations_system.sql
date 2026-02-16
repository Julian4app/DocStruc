-- =====================================================
-- PROJECT INVITATIONS & NOTIFICATIONS SYSTEM
-- Created: 2026-02-16
-- Purpose: Complete invitation workflow with notifications
-- =====================================================

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('project_invitation', 'task_assigned', 'mention', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create index for fast user notifications lookup
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- 3. Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Notifications policies - users only see their own
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

-- 5. Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (p_user_id, p_type, p_title, p_message, p_data)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function to mark notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.notifications
  SET read = true
  WHERE id = p_notification_id AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to mark all notifications as read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.notifications
  SET read = true
  WHERE user_id = auth.uid() AND read = false;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Update accept_project_invitation to handle user_id properly
CREATE OR REPLACE FUNCTION public.accept_project_invitation(
  p_invitation_token UUID
) RETURNS JSONB AS $$
DECLARE
  v_member RECORD;
  v_project RECORD;
BEGIN
  -- Get current user
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find the member by invitation token
  SELECT pm.*, p.name as project_name
  INTO v_member
  FROM project_members pm
  JOIN projects p ON p.id = pm.project_id
  WHERE pm.invitation_token = p_invitation_token
    AND pm.status = 'invited';

  IF v_member IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;

  -- Check if the authenticated user matches the invited user_id
  IF v_member.user_id IS NOT NULL AND v_member.user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation is for a different user');
  END IF;

  -- Update member status to active
  UPDATE project_members
  SET
    status = 'active',
    user_id = auth.uid(),
    accepted_at = now()
  WHERE id = v_member.id;

  -- Delete the invitation notification (if exists)
  DELETE FROM notifications
  WHERE user_id = auth.uid()
    AND type = 'project_invitation'
    AND (data->>'invitation_token')::uuid = p_invitation_token;

  -- Create a success notification
  PERFORM create_notification(
    auth.uid(),
    'system',
    'Projekteinladung akzeptiert',
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

-- 9. Function to send project invitation (called when adding member)
CREATE OR REPLACE FUNCTION public.send_project_invitation(
  p_project_id UUID,
  p_user_id UUID,
  p_role TEXT DEFAULT 'member'
) RETURNS JSONB AS $$
DECLARE
  v_invitation_token UUID;
  v_member_id UUID;
  v_project_name TEXT;
  v_inviter_name TEXT;
BEGIN
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

  -- Check if member already exists
  SELECT id, invitation_token INTO v_member_id, v_invitation_token
  FROM project_members
  WHERE project_id = p_project_id AND user_id = p_user_id;

  IF v_member_id IS NOT NULL THEN
    -- Update existing member
    UPDATE project_members
    SET
      status = 'invited',
      invited_at = now(),
      role = p_role
    WHERE id = v_member_id
    RETURNING invitation_token INTO v_invitation_token;
  ELSE
    -- Create new member
    INSERT INTO project_members (project_id, user_id, role, status, invited_at)
    VALUES (p_project_id, p_user_id, p_role, 'invited', now())
    RETURNING id, invitation_token INTO v_member_id, v_invitation_token;
  END IF;

  -- Create notification for the invited user
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

  RETURN jsonb_build_object(
    'success', true,
    'member_id', v_member_id,
    'invitation_token', v_invitation_token,
    'project_name', v_project_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Add RLS policies for notifications in complete_rls_overhaul
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.notifications;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications'
    );
    EXECUTE 'CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE USING (user_id = auth.uid())';
  END IF;
END $$;

-- 11. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_project_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_project_invitation TO authenticated;
