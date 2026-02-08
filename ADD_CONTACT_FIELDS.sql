-- Add new columns to subcontractor_contacts table
-- Run this in your Supabase SQL Editor

-- Add phone_country column for country code (stores country code like 'AT', 'DE', etc.)
ALTER TABLE subcontractor_contacts 
ADD COLUMN IF NOT EXISTS phone_country TEXT DEFAULT 'DE';

-- Add role column for contact person's role/position
ALTER TABLE subcontractor_contacts 
ADD COLUMN IF NOT EXISTS role TEXT;

-- Add phone_country to crm_contacts for employees and owners
ALTER TABLE crm_contacts
ADD COLUMN IF NOT EXISTS phone_country TEXT DEFAULT 'DE';

-- The following columns should already exist from previous migration:
-- first_name, last_name, email, phone, department, notes

-- Optional: Add comments for documentation
COMMENT ON COLUMN subcontractor_contacts.phone_country IS 'Country code for phone number (e.g., DE, AT, CH)';
COMMENT ON COLUMN subcontractor_contacts.role IS 'Role or position of the contact person';
COMMENT ON COLUMN crm_contacts.phone_country IS 'Country code for phone number (e.g., DE, AT, CH)';

-- Optional: Create indexes for faster lookups by role
CREATE INDEX IF NOT EXISTS idx_subcontractor_contacts_role ON subcontractor_contacts(role);
