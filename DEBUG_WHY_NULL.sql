-- =====================================================
-- CRITICAL DEBUG: Why is user_id NULL?
-- =====================================================

-- 1. Show ALL project members with their accessor data
SELECT 
  pm.id as member_id,
  pm.project_id,
  pm.user_id as pm_user_id,
  pm.status,
  pm.accessor_id,
  ua.accessor_email,
  ua.registered_user_id,
  ua.accessor_first_name,
  ua.accessor_last_name
FROM project_members pm
LEFT JOIN user_accessors ua ON ua.id = pm.accessor_id
ORDER BY pm.created_at DESC
LIMIT 20;

-- 2. Show all profiles (registered users)
SELECT id, email, first_name, last_name
FROM profiles
ORDER BY created_at DESC
LIMIT 20;

-- 3. Show all user_accessors and check if their email matches a profile
SELECT 
  ua.id as accessor_id,
  ua.accessor_email,
  ua.registered_user_id,
  ua.accessor_first_name,
  ua.accessor_last_name,
  p.id as matching_profile_id,
  p.email as matching_profile_email
FROM user_accessors ua
LEFT JOIN profiles p ON LOWER(p.email) = LOWER(ua.accessor_email)
ORDER BY ua.created_at DESC
LIMIT 20;

-- 4. Find accessors where email matches a profile but registered_user_id is NULL
SELECT 
  ua.id as accessor_id,
  ua.accessor_email,
  ua.registered_user_id as current_registered_user_id,
  p.id as should_be_registered_user_id,
  p.email as profile_email
FROM user_accessors ua
JOIN profiles p ON LOWER(p.email) = LOWER(ua.accessor_email)
WHERE ua.registered_user_id IS NULL
ORDER BY ua.created_at DESC;
