# Storage Policy Fix - Application Guide

## Issue
File uploads are failing with "new row violates row-level security policy" error. This is because:
1. The storage bucket policies may have conflicts from multiple migrations
2. The policies use incorrect path parsing functions

## Solution
The migration file `20260214_fix_storage_policies.sql` completely removes all old policies and creates new ones with correct path parsing.

## How to Apply

### Step 1: Apply the Migration in Supabase Dashboard

1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/20260214_fix_storage_policies.sql`
5. Paste into the SQL Editor
6. Click **Run** or press `Cmd/Ctrl + Enter`

### Step 2: Verify the Bucket Exists

After running the migration, verify in the Supabase Dashboard:

1. Go to **Storage**
2. Check if `project-files` bucket exists
3. If not, create it manually:
   - Click **New Bucket**
   - Name: `project-files`
   - Public: **No** (uncheck)
   - Click **Create bucket**

### Step 3: Test Upload

1. Refresh your app
2. Go to `/files` page
3. Click "Datei hochladen" (Upload File)
4. Select any file
5. Upload should succeed!

## What the Migration Does

1. **Ensures bucket exists** with `INSERT ... ON CONFLICT DO NOTHING`
2. **Removes ALL old policies** that might conflict (uses dynamic SQL to find and drop them)
3. **Creates 4 new policies** with clear names:
   - `project_files_insert_policy` - Allows uploads for project members
   - `project_files_select_policy` - Allows viewing files
   - `project_files_update_policy` - Allows file updates
   - `project_files_delete_policy` - Allows deletion (owners only)
4. **Uses `split_part(name, '/', 1)`** to correctly extract project ID from path

## Path Structure

Files are stored as: `{projectId}/{folderId or 'root'}/{filename}`

Example: `550e8400-e29b-41d4-a716-446655440000/root/1708012345_abc123.pdf`

The policy extracts `550e8400-e29b-41d4-a716-446655440000` and checks if you're a member of that project.

## Troubleshooting

If uploads still fail after applying the migration:

### Check Auth
```sql
SELECT auth.uid(); -- Should return your user ID
```

### Check Project Membership
```sql
SELECT * FROM project_members WHERE user_id = auth.uid();
```

### Check Storage Policies
```sql
SELECT * FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects' 
AND policyname LIKE '%project_files%';
```

You should see exactly 4 policies with names ending in `_policy`.

### Manual Policy Creation

If the migration fails, you can create policies manually in SQL Editor:

```sql
-- First ensure bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

-- Then copy the CREATE POLICY statements from the migration file
```

## Still Having Issues?

The error message in browser console will tell you which operation failed:
- "INSERT" → Upload policy issue
- "SELECT" → Download/view policy issue  
- "DELETE" → Deletion policy issue

Check that specific policy in Supabase Dashboard → Storage → Policies.
