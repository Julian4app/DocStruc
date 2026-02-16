-- =====================================================
-- FIX NOTIFICATIONS TABLE - Add missing columns
-- =====================================================

-- Add missing columns to notifications table
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS notification_type TEXT,
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Add constraint for notification_type
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notifications_notification_type_check'
  ) THEN
    ALTER TABLE public.notifications 
    ADD CONSTRAINT notifications_notification_type_check 
    CHECK (notification_type IN ('project_invitation', 'task_assigned', 'mention', 'system'));
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_notification_type ON notifications(notification_type);

-- Update any existing notifications to have a default type
UPDATE public.notifications 
SET notification_type = 'system'
WHERE notification_type IS NULL;

-- Make notification_type NOT NULL after setting defaults
ALTER TABLE public.notifications 
ALTER COLUMN notification_type SET NOT NULL;

-- Recreate the create_notification function with correct column name
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
  INSERT INTO public.notifications (user_id, notification_type, title, message, data)
  VALUES (p_user_id, p_type, p_title, p_message, p_data)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;
