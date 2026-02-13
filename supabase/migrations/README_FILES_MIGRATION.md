# Project Files System Migration

## Apply Migration

The migration file has been created at: `supabase/migrations/20260213_project_files_system.sql`

### Option 1: Supabase Dashboard (Recommended)

1. Open your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/20260213_project_files_system.sql`
5. Paste into the SQL Editor
6. Click **Run**

### Option 2: Command Line (if Supabase CLI is configured)

```bash
npx supabase db push
```

## What This Migration Creates

### Database Tables

1. **project_folders** - Hierarchical folder structure
   - Supports nested folders (parent_folder_id)
   - Folder metadata (name, description, color)
   - Timestamps and creator tracking

2. **project_files** - File metadata and information
   - Links to folders (folder_id)
   - Storage path, size, MIME type
   - Version tracking (version, is_latest_version)
   - Upload tracking (uploaded_by, uploaded_at)

3. **project_file_versions** - Complete version history
   - Stores all previous versions
   - Version number, file size
   - Change notes for each version
   - Uploader and timestamp

4. **project_file_shares** - Sharing and permissions
   - Share files or entire folders
   - Granular permissions (download, edit, delete, share)
   - Optional expiration dates
   - Track who shared with whom

### Storage Bucket

- **project-files** - Supabase Storage bucket for file uploads
- Organized by project: `{project_id}/{folder_id}/{filename}`
- Row Level Security (RLS) policies for access control

### Features Enabled

✅ Create/Edit/Delete folders with hierarchy  
✅ Upload files to specific folders  
✅ Download files  
✅ Rename files  
✅ Delete files (with storage cleanup)  
✅ File versioning - upload new versions, view history  
✅ Share files with team members  
✅ Granular permission control  
✅ File metadata tracking  
✅ Secure RLS policies  

## After Migration

The `/files` page will now work with live data:

- All folders and files are stored in the database
- Files are uploaded to Supabase Storage
- Full CRUD operations on folders and files
- Version history tracking
- Team collaboration with sharing

## Verification

After applying the migration, verify it worked:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'project_f%';

-- Should return:
-- project_folders
-- project_files
-- project_file_versions
-- project_file_shares

-- Check storage bucket
SELECT * FROM storage.buckets WHERE id = 'project-files';
```

## Rollback (if needed)

If you need to rollback this migration:

```sql
-- Drop tables in reverse order (respecting foreign keys)
DROP TABLE IF EXISTS project_file_shares CASCADE;
DROP TABLE IF EXISTS project_file_versions CASCADE;
DROP TABLE IF EXISTS project_files CASCADE;
DROP TABLE IF EXISTS project_folders CASCADE;

-- Remove storage bucket
DELETE FROM storage.buckets WHERE id = 'project-files';
```
