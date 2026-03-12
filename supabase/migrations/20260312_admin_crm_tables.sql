-- ============================================================
-- Admin CRM Tables Migration
-- Creates companies, contact_persons, subscription_types,
-- company_subscriptions, invoices, crm_notes, tags, crm_files,
-- file_tags, audit_logs with proper IF NOT EXISTS guards.
-- ============================================================

-- ── companies ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.companies (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    address text,
    status text CHECK (status IN ('active', 'inactive', 'lead')) DEFAULT 'lead',
    employees_count int DEFAULT 0,
    accounts_count int DEFAULT 0,
    logo_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ── contact_persons ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contact_persons (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    department text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add back-references only if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'main_contact_id'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN main_contact_id uuid REFERENCES public.contact_persons(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'superuser_id'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN superuser_id uuid REFERENCES public.contact_persons(id);
  END IF;
END $$;

-- ── subscription_types ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_types (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    title text NOT NULL,
    price numeric NOT NULL DEFAULT 0,
    discount numeric DEFAULT 0,
    features jsonb,
    description text,
    created_at timestamptz DEFAULT now()
);

-- ── company_subscriptions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_subscriptions (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    type_id uuid REFERENCES public.subscription_types(id),
    frequency text CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
    payment_deadline_days int DEFAULT 7,
    invoice_amount numeric NOT NULL DEFAULT 0,
    start_date date DEFAULT CURRENT_DATE,
    end_date date,
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT now()
);

-- ── invoices ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    subscription_id uuid REFERENCES public.company_subscriptions(id),
    amount numeric NOT NULL,
    due_date date NOT NULL,
    paid_at timestamptz,
    status text CHECK (status IN ('open', 'paid', 'delayed', 'cancelled')) DEFAULT 'open',
    period_start date,
    period_end date,
    created_at timestamptz DEFAULT now()
);

-- ── crm_notes ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_notes (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ── tags ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tags (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    title text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

-- ── crm_files ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_files (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    file_url text NOT NULL,
    name text NOT NULL,
    uploaded_at timestamptz DEFAULT now()
);

-- ── file_tags ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.file_tags (
    file_id uuid REFERENCES public.crm_files(id) ON DELETE CASCADE,
    tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (file_id, tag_id)
);

-- ── audit_logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    action text NOT NULL,
    details jsonb,
    performed_at timestamptz DEFAULT now()
);

-- ── feedback ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES auth.users,
    rating integer CHECK (rating >= 1 AND rating <= 5),
    category text NOT NULL DEFAULT 'general',
    message text NOT NULL,
    email text,
    created_at timestamptz DEFAULT now()
);

-- ── Enable RLS ───────────────────────────────────────────────
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies (admin full access, users can insert feedback) ──
DO $$
BEGIN
  -- companies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='companies' AND policyname='companies_admin_all') THEN
    CREATE POLICY "companies_admin_all" ON public.companies FOR ALL TO authenticated
      USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true)
      WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);
  END IF;
  -- contact_persons
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contact_persons' AND policyname='contact_persons_admin_all') THEN
    CREATE POLICY "contact_persons_admin_all" ON public.contact_persons FOR ALL TO authenticated
      USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true)
      WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);
  END IF;
  -- subscription_types
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subscription_types' AND policyname='subscription_types_admin_all') THEN
    CREATE POLICY "subscription_types_admin_all" ON public.subscription_types FOR ALL TO authenticated
      USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true)
      WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);
  END IF;
  -- company_subscriptions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='company_subscriptions' AND policyname='company_subscriptions_admin_all') THEN
    CREATE POLICY "company_subscriptions_admin_all" ON public.company_subscriptions FOR ALL TO authenticated
      USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true)
      WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);
  END IF;
  -- invoices
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='invoices_admin_all') THEN
    CREATE POLICY "invoices_admin_all" ON public.invoices FOR ALL TO authenticated
      USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true)
      WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);
  END IF;
  -- crm_notes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_notes' AND policyname='crm_notes_admin_all') THEN
    CREATE POLICY "crm_notes_admin_all" ON public.crm_notes FOR ALL TO authenticated
      USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true)
      WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);
  END IF;
  -- tags
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tags' AND policyname='tags_admin_all') THEN
    CREATE POLICY "tags_admin_all" ON public.tags FOR ALL TO authenticated
      USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true)
      WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);
  END IF;
  -- crm_files
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_files' AND policyname='crm_files_admin_all') THEN
    CREATE POLICY "crm_files_admin_all" ON public.crm_files FOR ALL TO authenticated
      USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true)
      WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);
  END IF;
  -- audit_logs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_logs' AND policyname='audit_logs_admin_all') THEN
    CREATE POLICY "audit_logs_admin_all" ON public.audit_logs FOR ALL TO authenticated
      USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true)
      WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);
  END IF;
  -- feedback: users can insert their own, admins can read all
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feedback' AND policyname='feedback_users_insert') THEN
    CREATE POLICY "feedback_users_insert" ON public.feedback FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feedback' AND policyname='feedback_users_select_own') THEN
    CREATE POLICY "feedback_users_select_own" ON public.feedback FOR SELECT TO authenticated
      USING (auth.uid() = user_id OR (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);
  END IF;
END $$;
