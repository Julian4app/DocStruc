ALTER TABLE public.company_history ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'System';
