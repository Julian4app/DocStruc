-- ADMIN SYSTEM SCHEMA
-- Run this in Supabase SQL Editor

-- 1. Create Tables

CREATE TABLE public.companies (
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

CREATE TABLE public.contact_persons (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    department text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add relations to company after contact_persons exists
ALTER TABLE public.companies ADD COLUMN main_contact_id uuid REFERENCES public.contact_persons(id);
ALTER TABLE public.companies ADD COLUMN superuser_id uuid REFERENCES public.contact_persons(id);


CREATE TABLE public.subscription_types (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    title text NOT NULL,
    price numeric NOT NULL DEFAULT 0,
    discount numeric DEFAULT 0,
    features jsonb, -- array of strings
    description text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.company_subscriptions (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    type_id uuid REFERENCES public.subscription_types(id),
    frequency text CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
    payment_deadline_days int DEFAULT 7,
    invoice_amount numeric NOT NULL,
    start_date date DEFAULT CURRENT_DATE,
    end_date date,
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.invoices (
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

CREATE TABLE public.crm_notes (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.tags (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    title text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.crm_files (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    file_url text NOT NULL,
    name text NOT NULL,
    uploaded_at timestamptz DEFAULT now()
);

CREATE TABLE public.file_tags (
    file_id uuid REFERENCES public.crm_files(id) ON DELETE CASCADE,
    tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (file_id, tag_id)
);

CREATE TABLE public.audit_logs (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    entity_type text NOT NULL, -- 'company', 'subscription', etc.
    entity_id uuid NOT NULL,
    action text NOT NULL, -- 'create', 'update', 'status_change', 'payment'
    details jsonb,
    performed_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
-- For simplicity in this demo, we will allow authenticated users (Admins) full access
-- A real production system would check for specific admin roles/claims

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

CREATE POLICY "Admins full access companies" ON public.companies FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access contact_persons" ON public.contact_persons FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access subscription_types" ON public.subscription_types FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access company_subscriptions" ON public.company_subscriptions FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access invoices" ON public.invoices FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access crm_notes" ON public.crm_notes FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access tags" ON public.tags FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access crm_files" ON public.crm_files FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access file_tags" ON public.file_tags FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access audit_logs" ON public.audit_logs FOR ALL TO authenticated USING (true);

-- 3. Mock Data (Optional, helps visualising)
INSERT INTO public.subscription_types (title, price, features) VALUES 
('Basic', 29.99, '["5 Users", "Basic Support"]'),
('Pro', 99.99, '["Unlimited Users", "Priority Support", "Analytics"]'),
('Enterprise', 499.99, '["Custom Solutions", "24/7 Support"]');

INSERT INTO public.tags (title, description) VALUES 
('Important', 'High priority items'),
('Contract', 'Legal documents'),
('Invoice', 'Billing documents');

-- 4. Create Admin User (This is handled by Supabase Auth, but we can ensure profile exists)
-- Assuming the user uses sign up or we manually invite them.
