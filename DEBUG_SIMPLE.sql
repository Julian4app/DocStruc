-- =====================================================
-- SIMPLIFIED DEBUG QUERIES
-- Run each query separately
-- =====================================================

-- Query 1: All recent notifications
SELECT 
  n.id,
  n.user_id,
  n.notification_type,
  n.title,
  n.created_at,
  p.email as user_email
FROM notifications n
LEFT JOIN profiles p ON p.id = n.user_id
ORDER BY n.created_at DESC
LIMIT 20;

-- Query 2: Project members with user_id sync status
SELECT 
  pm.id as member_id,
  pm.user_id as member_user_id,
  ua.registered_user_id as accessor_user_id,
  ua.accessor_email,
  pm.status,
  p1.email as member_email,
  p2.email as accessor_email
FROM project_members pm
JOIN user_accessors ua ON ua.id = pm.accessor_id
LEFT JOIN profiles p1 ON p1.id = pm.user_id
LEFT JOIN profiles p2 ON p2.id = ua.registered_user_id
WHERE pm.status IN ('invited', 'active', 'open')
ORDER BY pm.invited_at DESC NULLS LAST
LIMIT 20;

-- Query 3: Invited members and their notification count
SELECT 
  pm.id as member_id,
  pm.user_id,
  ua.registered_user_id,
  ua.accessor_email,
  pm.status,
  COUNT(n.id) as notification_count
FROM project_members pm
JOIN user_accessors ua ON ua.id = pm.accessor_id
LEFT JOIN notifications n ON n.user_id = COALESCE(pm.user_id, ua.registered_user_id)
WHERE pm.status = 'invited'
GROUP BY pm.id, pm.user_id, ua.registered_user_id, ua.accessor_email, pm.status
ORDER BY pm.invited_at DESC NULLS LAST
LIMIT 10;

-- Query 4: Check RLS policies
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'notifications';
