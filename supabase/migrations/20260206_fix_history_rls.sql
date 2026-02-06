-- Ensure company_history table exists
CREATE TABLE IF NOT EXISTS public.company_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.company_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Users can view history" ON public.company_history;
DROP POLICY IF EXISTS "Users can insert history" ON public.company_history;

-- Create permissive policies for authenticated users (Admins)
CREATE POLICY "Users can view history" ON public.company_history
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can insert history" ON public.company_history
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Grant privileges
GRANT ALL ON public.company_history TO authenticated;
GRANT ALL ON public.company_history TO service_role;
