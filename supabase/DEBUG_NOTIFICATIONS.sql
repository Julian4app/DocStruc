-- =====================================================
-- DEBUG: Check notifications and member data
-- =====================================================

-- Show recent notifications
SELECT 
  n.id,
  n.user_id,
  n.type,
  n.title,
  n.message,
  n.is_read,
  n.created_at,
  p.email as user_email,
  n.data
FROM notifications n
LEFT JOIN profiles p ON p.id = n.user_id
ORDER BY n.created_at DESC
LIMIT 10;

-- Show project members with their accessor and user info
SELECT 
  pm.id as member_id,
  pm.project_id,
  pm.user_id,
  pm.status,
  pm.invited_at,
  pm.invitation_token,
  ua.accessor_email,
  ua.registered_user_id,
  p1.email as member_email,
  p2.email as accessor_registered_email
FROM project_members pm
LEFT JOIN user_accessors ua ON ua.id = pm.accessor_id
LEFT JOIN profiles p1 ON p1.id = pm.user_id
LEFT JOIN profiles p2 ON p2.id = ua.registered_user_id
WHERE pm.status IN ('invited', 'active')
ORDER BY pm.invited_at DESC NULLS LAST
LIMIT 10;

-- Check if user_id in members matches registered_user_id in accessors
SELECT 
  pm.id,
  pm.user_id as member_user_id,
  ua.registered_user_id as accessor_registered_user_id,
  CASE 
    WHEN pm.user_id = ua.registered_user_id THEN '✓ MATCH'
    WHEN pm.user_id IS NULL AND ua.registered_user_id IS NOT NULL THEN '⚠ MEMBER MISSING USER_ID'
    WHEN pm.user_id IS NOT NULL AND ua.registered_user_id IS NULL THEN '⚠ ACCESSOR NOT REGISTERED'
    ELSE '✗ MISMATCH'
  END as status
FROM project_members pm
JOIN user_accessors ua ON ua.id = pm.accessor_id
WHERE pm.status = 'invited'
ORDER BY pm.invited_at DESC NULLS LAST
LIMIT 10;
