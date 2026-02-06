
-- Enable RLS on all tables (already done in previous script but good to ensure)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_history ENABLE ROW LEVEL SECURITY;

-- DROP existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable all access for everyone" ON companies;
DROP POLICY IF EXISTS "Enable all access for everyone" ON contact_persons;
DROP POLICY IF EXISTS "Enable all access for everyone" ON subscription_types;
DROP POLICY IF EXISTS "Enable all access for everyone" ON crm_notes;
DROP POLICY IF EXISTS "Enable all access for everyone" ON tags;
DROP POLICY IF EXISTS "Enable all access for everyone" ON company_files;
DROP POLICY IF EXISTS "Enable all access for everyone" ON company_subscriptions;
DROP POLICY IF EXISTS "Enable all access for everyone" ON invoices;
DROP POLICY IF EXISTS "Enable all access for everyone" ON company_history;

-- Create permissive policies for development/admin use
-- In production, replace `USING (true)` with `USING (auth.role() = 'authenticated')` or specific role checks

CREATE POLICY "Enable all access for everyone" ON companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for everyone" ON contact_persons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for everyone" ON subscription_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for everyone" ON crm_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for everyone" ON tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for everyone" ON company_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for everyone" ON company_subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for everyone" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for everyone" ON company_history FOR ALL USING (true) WITH CHECK (true);
