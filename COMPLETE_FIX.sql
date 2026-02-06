-- FIX SCRIPT FOR DOCSTRUC ADMIN
-- This script ensures all schema and permission requirements for the new features are met.
-- Run this in your Supabase SQL Editor.

-- 1. Ensure 'invoices' table has necessary columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'notes') THEN
        ALTER TABLE invoices ADD COLUMN notes text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'tags') THEN
        ALTER TABLE invoices ADD COLUMN tags text[];
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'status') THEN
        ALTER TABLE invoices ADD COLUMN status text DEFAULT 'Open';
    END IF;
END $$;

-- 2. Ensure 'companies' table has address split columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'city') THEN
        ALTER TABLE companies ADD COLUMN city text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'zip_code') THEN
        ALTER TABLE companies ADD COLUMN zip_code text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'country') THEN
        ALTER TABLE companies ADD COLUMN country text;
    END IF;
    
    -- Ensure bought_accounts exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'bought_accounts') THEN
        ALTER TABLE companies ADD COLUMN bought_accounts int DEFAULT 0;
    END IF;
END $$;

-- 3. Ensure 'company_files' table has tags
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_files' AND column_name = 'tags') THEN
        ALTER TABLE company_files ADD COLUMN tags text[];
    END IF;
END $$;


-- 4. STORAGE RLS POLICIES (Fixes Upload Issues)

-- Create buckets if they don't exist
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('company-files', 'company-files', true) ON CONFLICT (id) DO NOTHING;

-- Policy for Logos
DROP POLICY IF EXISTS "Admin Access Logos" ON storage.objects;
CREATE POLICY "Admin Access Logos" ON storage.objects FOR ALL USING (bucket_id = 'logos') WITH CHECK (bucket_id = 'logos');

-- Policy for Company Files (including Recipes)
DROP POLICY IF EXISTS "Admin Access Files" ON storage.objects;
CREATE POLICY "Admin Access Files" ON storage.objects FOR ALL USING (bucket_id = 'company-files') WITH CHECK (bucket_id = 'company-files');


-- 5. RECIPE SECURITY (Optional: Row Level Security for company_files table)
-- We enable RLS on company_files to ensure only Admins can see "Recipes" if required.
-- Assuming "authenticated" users are Admins here. If you have non-admin users, we need stricter checks.
-- For now, we allow all authenticated users (Admins) to see everything.
ALTER TABLE company_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can do everything on files" ON company_files;
CREATE POLICY "Admins can do everything on files" ON company_files FOR ALL USING (auth.role() = 'authenticated');

-- 6. DUMMY DATA FOR SUBSCRIPTION TYPES (if empty)
-- 'features' is JSONB, so we must cast the array or string to JSONB
INSERT INTO subscription_types (title, price, features)
SELECT 'Basic', 9.99, '["Core Features"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM subscription_types);

INSERT INTO subscription_types (title, price, features)
SELECT 'Pro', 19.99, '["Core + Advanced"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM subscription_types WHERE title = 'Pro');
