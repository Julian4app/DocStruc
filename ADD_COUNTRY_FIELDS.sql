-- ===== CRM_CONTACTS TABLE =====
-- This migration adds missing columns to existing tables
-- Run this even if tables already exist - it will only add missing columns

-- Add new address fields to crm_contacts (for owners)
ALTER TABLE crm_contacts
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS zip TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'DE';

-- Ensure base columns exist (in case table was created with different schema)
ALTER TABLE crm_contacts
ADD COLUMN IF NOT EXISTS personal_number TEXT,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS detailed_address TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS phone_country TEXT DEFAULT 'DE';

-- ===== SUBCONTRACTORS TABLE =====
-- Add address fields to subcontractors table
ALTER TABLE subcontractors
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS zip TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'DE',
ADD COLUMN IF NOT EXISTS website TEXT;

-- Ensure base columns exist
ALTER TABLE subcontractors
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS trade TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS detailed_address TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- ===== SUBCONTRACTOR_CONTACTS TABLE =====
-- Ensure subcontractor_contacts columns exist
ALTER TABLE subcontractor_contacts
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS phone_country TEXT DEFAULT 'DE',
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS role TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- ===== PROJECTS TABLE =====
-- Add missing columns to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS subtitle TEXT,
ADD COLUMN IF NOT EXISTS images TEXT[],
ADD COLUMN IF NOT EXISTS picture_url TEXT,
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS zip TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'DE';

-- Remove old strict status constraint and allow any text
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

-- ===== PROJECT LINKING TABLES =====
-- Ensure project_crm_links table exists
CREATE TABLE IF NOT EXISTS project_crm_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
    role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, contact_id)
);

-- Ensure project_subcontractors table exists
CREATE TABLE IF NOT EXISTS project_subcontractors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, subcontractor_id)
);

-- ===== ENABLE ROW LEVEL SECURITY =====
-- These commands are safe to run multiple times
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_crm_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_subcontractors ENABLE ROW LEVEL SECURITY;

-- ===== RLS POLICIES =====
-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Auth full access crm_contacts" ON crm_contacts;
CREATE POLICY "Auth full access crm_contacts" ON crm_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth full access subcontractors" ON subcontractors;
CREATE POLICY "Auth full access subcontractors" ON subcontractors FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth full access sub_contacts" ON subcontractor_contacts;
CREATE POLICY "Auth full access sub_contacts" ON subcontractor_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth all access projects" ON projects;
CREATE POLICY "Auth all access projects" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth all access crm links" ON project_crm_links;
CREATE POLICY "Auth all access crm links" ON project_crm_links FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth all access project subs" ON project_subcontractors;
CREATE POLICY "Auth all access project subs" ON project_subcontractors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_crm_contacts_country ON crm_contacts(country);
CREATE INDEX IF NOT EXISTS idx_subcontractors_country ON subcontractors(country);
CREATE INDEX IF NOT EXISTS idx_subcontractors_website ON subcontractors(website);

-- Optional: Migrate existing detailed_address data to new fields
-- This is a best-effort migration - you may need to manually review
UPDATE crm_contacts
SET 
    street = SPLIT_PART(detailed_address, ',', 1),
    city = TRIM(SPLIT_PART(detailed_address, ',', 2))
WHERE detailed_address IS NOT NULL 
  AND detailed_address != ''
  AND street IS NULL;
