
-- Admin System DB Schema
-- This script sets up the full schema for the CRM / Admin system.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. CLEANUP (To avoid conflicts with old schemas)
DROP TABLE IF EXISTS company_history CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS company_subscriptions CASCADE;
DROP TABLE IF EXISTS company_files CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS crm_notes CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS subscription_types CASCADE;
DROP TABLE IF EXISTS contact_persons CASCADE;

-- 1. Contact Persons (Needed for Companies)
CREATE TABLE contact_persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  surname TEXT NOT NULL,
  company TEXT,
  department TEXT,
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Subscription Types
CREATE TABLE subscription_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  discount DECIMAL(5, 2) DEFAULT 0,
  features JSONB DEFAULT '[]', -- List of included features
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Companies (Customers)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT, -- Detailed Address
  contact_person_id UUID REFERENCES contact_persons(id),
  status TEXT DEFAULT 'Lead' CHECK (status IN ('Active', 'Inactive', 'Lead')),
  employees_count INT DEFAULT 0,
  bought_accounts INT DEFAULT 0,
  superuser_id UUID REFERENCES contact_persons(id), -- Could be typical auth user or contact person
  logo_url TEXT,
  email TEXT,
  tax_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CRM Notes
CREATE TABLE crm_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID, -- Ref to admin user auth.uid()
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tags
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Files (General company files)
CREATE TABLE company_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  tags UUID[] -- Array of tag IDs
);

-- 7. Subscriptions (Active per company)
CREATE TABLE company_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  subscription_type_id UUID REFERENCES subscription_types(id),
  payment_cycle TEXT CHECK (payment_cycle IN ('monthly', 'quarterly', 'yearly')),
  payment_deadline_days INT DEFAULT 0, -- Days after 1st of month
  recipes_url TEXT, -- Uploaded recipe/contract
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  invoice_amount DECIMAL(10, 2),
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES company_subscriptions(id),
  company_id UUID REFERENCES companies(id),
  amount DECIMAL(10, 2) NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'Paid', 'Delayed', 'Cancelled')),
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. History Log (Audit Trail)
CREATE TABLE company_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- e.g. 'status_change', 'payment_paid'
  old_state JSONB,
  new_state JSONB,
  changed_by UUID, -- Admin User ID
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- RLS Policies (Simplified for Admin access)
-- Note: You should enable RLS on all tables and add policies.
-- For this setup, we assume the connected user is a service_role or admin authenticated.

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_history ENABLE ROW LEVEL SECURITY;

-- Broad Access Policy for Authenticated Admins (Adjust based on your Auth setup)
-- CREATE POLICY "Admins can do everything" ON companies FOR ALL USING (auth.role() = 'authenticated');
-- (Repeating for all tables...)

-- Seed Data (For testing dashboard)
INSERT INTO subscription_types (title, price, features) VALUES
('Free', 0, '["Basic"]'),
('Starter', 99, '["Standard"]'),
('Pro', 199, '["Advanced"]'),
('Enterprise', 499, '["All Features", "Priority Support"]');

-- Insert one contact person
INSERT INTO contact_persons (first_name, surname, company, email) VALUES
('John', 'Doe', 'TechCorp', 'john@techcorp.com');

-- Insert one company
WITH cp AS (SELECT id FROM contact_persons LIMIT 1)
INSERT INTO companies (name, status, contact_person_id) 
SELECT 'TechCorp Inc.', 'Active', id FROM cp;

