-- Fix History Table Permissions (Consolidated)
BEGIN;

-- 1. Ensure Table Exists (If not already created)
CREATE TABLE IF NOT EXISTS public.company_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Force Enable RLS
ALTER TABLE public.company_history ENABLE ROW LEVEL SECURITY;

-- 3. Clean up generic policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.company_history;
DROP POLICY IF EXISTS "Users can view history" ON public.company_history;
DROP POLICY IF EXISTS "Users can insert history" ON public.company_history;

-- 4. Create Explicit Policies
CREATE POLICY "Users can view history" ON public.company_history
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can insert history" ON public.company_history
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 5. Grant Privileges
GRANT ALL ON public.company_history TO authenticated;
GRANT ALL ON public.company_history TO service_role;

COMMIT;
