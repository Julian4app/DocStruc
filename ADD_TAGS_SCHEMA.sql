-- ADD TAGS CAPABILITY TO ALL ENTITIES

-- 1. Add 'color' to 'tags' table
ALTER TABLE tags ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6B7280';

-- 2. Add 'tags' column to entities that miss it (as text[] for consistency with current code)
-- Companies (Customers)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Contact Persons
ALTER TABLE contact_persons ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- CRM Notes
ALTER TABLE crm_notes ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 3. Ensure 'company_files' and 'invoices' have tags (already checked in previous scripts but good to be safe)
ALTER TABLE company_files ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
