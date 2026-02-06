
-- 1. Updates for Detailed Address in Companies
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS country TEXT;

-- 2. Updates for Invoices (Payments)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[]; -- Array of strings for simple tagging

-- 3. Ensure Storage Buckets exist (This usually requires dashboard access, but we can try inserting if permissions allow, 
-- or we use specific folders in a public bucket. For now, we assume 'files' bucket exists or we try to create it via SQL if the extension is enabled, 
-- but often storage is separate. We will rely on the code handling standard buckets 'logos', 'documents'.)

-- 4. Recipe/Contract handling: We will use the company_files table, adding a 'category' or using tags.
-- existing company_files has "tags UUID[]". Let's change it to text[] for simplicity or ensure we have handling.
-- Changing to text[] is easier for this specific request "added tags".
ALTER TABLE company_files
ALTER COLUMN tags TYPE TEXT[] USING tags::TEXT[]; 

-- 5. Add some dummy invoices if none exist for testing
INSERT INTO invoices (company_id, amount, due_date, status, notes, tags) 
SELECT id, 499.00, NOW() + INTERVAL '7 days', 'Open', 'Initial Setup', ARRAY['Setup'] 
FROM companies 
WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE invoices.company_id = companies.id)
LIMIT 1;
