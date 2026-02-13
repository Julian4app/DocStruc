# Storage Policy Fix - Application Guide

## Issue
File uploads are failing with "new row violates row-level security policy" error. This is because the storage bucket policies use `storage.foldername()` which doesn't work correctly with our path structure.

## Solution
The migration file `20260214_fix_storage_policies.sql` fixes the storage policies by using `split_part()` instead of `storage.foldername()` to parse the project ID from the file path.

## How to Apply

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/20260214_fix_storage_policies.sql`
5. Paste into the SQL Editor
6. Click **Run** or press `Cmd/Ctrl + Enter`
7. You should see success messages for each policy

### Option 2: Supabase CLI

If you have Supabase CLI installed:

```bash
supabase db push
```

Or apply the specific migration:

```bash
supabase migration up --db-url "your-database-url"
```

## Verification

After applying the migration, test file upload:

1. Go to `/files` page in your app
2. Click "Datei hochladen" (Upload File)
3. Select any file
4. Upload should succeed without RLS errors

## What Changed

- **Before**: Used `storage.foldername(name)[1]` to extract project ID
- **After**: Uses `split_part(name, '/', 1)` to extract project ID
- **Added**: UPDATE policy for file modifications
- **Fixed**: All INSERT, SELECT, UPDATE, DELETE policies for storage.objects

## Rollback

If you need to rollback, the original policies are in:
`supabase/migrations/20260213_project_files_system.sql` (lines 312-369)
