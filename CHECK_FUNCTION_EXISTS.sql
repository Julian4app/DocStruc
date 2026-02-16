-- =====================================================
-- VERIFY FUNCTION EXISTS
-- Run this to check if the function is properly created
-- =====================================================

-- Check if function exists
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'send_project_invitation'
ORDER BY n.nspname, p.proname;

-- List all RPC functions available
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%invitation%'
ORDER BY p.proname;
