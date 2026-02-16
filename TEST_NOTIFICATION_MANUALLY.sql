-- =====================================================
-- MANUAL TEST: Create notification directly
-- This helps verify if the issue is in the RPC or elsewhere
-- =====================================================

-- STEP 1: Get info about a pending invitation
-- Find a member with status 'invited' to test with
SELECT 
  pm.id as member_id,
  pm.project_id,
  pm.user_id as member_user_id,
  ua.registered_user_id as accessor_user_id,
  ua.accessor_email,
  p.name as project_name,
  COALESCE(pm.user_id, ua.registered_user_id) as target_user_id
FROM project_members pm
JOIN user_accessors ua ON ua.id = pm.accessor_id
JOIN projects p ON p.id = pm.project_id
WHERE pm.status = 'invited'
LIMIT 5;

-- STEP 2: Manually call the RPC function
-- Replace the UUIDs below with actual values from STEP 1
/*
SELECT send_project_invitation(
  p_project_id := 'PROJECT_ID_HERE'::uuid,
  p_user_id := 'USER_ID_HERE'::uuid,
  p_email := NULL
);
*/

-- STEP 3: Check if notification was created
-- Replace USER_ID_HERE with the target_user_id from STEP 1
/*
SELECT 
  n.id,
  n.notification_type,
  n.title,
  n.message,
  n.created_at,
  n.is_read,
  n.data
FROM notifications n
WHERE n.user_id = 'USER_ID_HERE'::uuid
  AND n.notification_type = 'project_invitation'
ORDER BY n.created_at DESC
LIMIT 5;
*/

-- STEP 4: Manually create a notification for testing
-- This bypasses the RPC to test if the notification table and RLS work
-- Replace USER_ID_HERE with actual user ID
/*
SELECT create_notification(
  p_user_id := 'USER_ID_HERE'::uuid,
  p_type := 'project_invitation',
  p_title := 'TEST Projekteinladung',
  p_message := 'Dies ist eine Test-Benachrichtigung',
  p_data := jsonb_build_object(
    'project_id', 'PROJECT_ID_HERE'::uuid,
    'project_name', 'Test Projekt',
    'invitation_token', gen_random_uuid()
  )
);
*/

-- STEP 5: Check what auth.uid() returns for the logged-in user
-- Run this when logged in as the invited user
SELECT auth.uid() as current_user_id;

-- STEP 6: Compare auth.uid() with notifications
-- Run this when logged in as the invited user to see if there's a mismatch
SELECT 
  auth.uid() as my_user_id,
  n.user_id as notification_user_id,
  n.user_id = auth.uid() as "ids_match",
  n.notification_type,
  n.title,
  n.created_at
FROM notifications n
WHERE n.notification_type = 'project_invitation'
ORDER BY n.created_at DESC
LIMIT 10;
