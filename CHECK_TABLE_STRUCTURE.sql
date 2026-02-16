-- =====================================================
-- CHECK TABLE STRUCTURE
-- =====================================================

-- Show all columns in notifications table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'notifications'
ORDER BY ordinal_position;
