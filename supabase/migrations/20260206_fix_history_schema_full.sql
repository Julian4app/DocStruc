-- Fix missing columns in company_history
ALTER TABLE public.company_history ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'System';
ALTER TABLE public.company_history ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE public.company_history ADD COLUMN IF NOT EXISTS action TEXT;

-- Verify columns exist (optional, for debugging)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'company_history';
