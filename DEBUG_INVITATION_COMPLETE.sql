-- =====================================================
-- COMPLETE DEBUGGING FOR INVITATION NOTIFICATIONS
-- Run these queries to understand what's happening
-- =====================================================

-- 1. Check all recent notifications (last 24 hours)
SELECT 
  n.id,
  n.user_id,
  n.notification_type,
  n.title,
  n.message,
  n.is_read,
  n.created_at,
  p.email as user_email,
  p.first_name,
  p.last_name,
  n.data->>'project_id' as project_id,
  n.data->>'project_name' as project_name
FROM notifications n
LEFT JOIN profiles p ON p.id = n.user_id
WHERE n.created_at > (NOW() - INTERVAL '24 hours')
ORDER BY n.created_at DESC;

-- 2. Check project members status and user_id sync
SELECT 
  pm.id as member_id,
  pm.project_id,
  pm.user_id as member_user_id,
  pm.status,
  pm.invited_at,
  ua.accessor_email,
  ua.registered_user_id as accessor_registered_user_id,
  p1.email as member_email,
  p2.email as accessor_email_account,
  CASE 
    WHEN pm.user_id IS NULL AND ua.registered_user_id IS NOT NULL THEN '❌ NOT SYNCED - user_id is NULL but accessor has registered_user_id'
    WHEN pm.user_id IS NOT NULL AND ua.registered_user_id IS NULL THEN '✓ Member has user_id'
    WHEN pm.user_id = ua.registered_user_id THEN '✓✓ SYNCED CORRECTLY'
    WHEN pm.user_id IS NOT NULL AND ua.registered_user_id IS NOT NULL AND pm.user_id != ua.registered_user_id THEN '⚠️ MISMATCH - different IDs'
    ELSE '? Unknown state'
  END as sync_status
FROM project_members pm
JOIN user_accessors ua ON ua.id = pm.accessor_id
LEFT JOIN profiles p1 ON p1.id = pm.user_id
LEFT JOIN profiles p2 ON p2.id = ua.registered_user_id
WHERE pm.status IN ('invited', 'active', 'open')
ORDER BY pm.invited_at DESC NULLS LAST
LIMIT 20;

-- 3. Find members who should have notifications but don't
SELECT 
  pm.id as member_id,
  pm.user_id,
  ua.registered_user_id,
  ua.accessor_email,
  pm.status,
  pm.invited_at,
  COUNT(n.id) as notification_count,
  COALESCE(pm.user_id, ua.registered_user_id) as should_notify_user_id
FROM project_members pm
JOIN user_accessors ua ON ua.id = pm.accessor_id
LEFT JOIN notifications n ON n.user_id = COALESCE(pm.user_id, ua.registered_user_id) 
  AND n.notification_type = 'project_invitation'
  AND n.data->>'project_id' = pm.project_id::text
WHERE pm.status = 'invited'
  AND pm.invited_at > (NOW() - INTERVAL '7 days')
GROUP BY pm.id, pm.user_id, ua.registered_user_id, ua.accessor_email, pm.status, pm.invited_at
ORDER BY pm.invited_at DESC;

-- 4. Test if notification would be visible to a specific user
-- Replace 'YOUR_USER_ID_HERE' with the actual user ID of the invited person
/*
SELECT 
  n.id,
  n.notification_type,
  n.title,
  n.message,
  n.created_at,
  n.is_read,
  n.user_id = 'YOUR_USER_ID_HERE'::uuid as "matches_user",
  n.user_id as notification_user_id
FROM notifications n
WHERE n.user_id = 'YOUR_USER_ID_HERE'::uuid
ORDER BY n.created_at DESC
LIMIT 10;
*/

-- 5. Check RLS policies on notifications
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;
