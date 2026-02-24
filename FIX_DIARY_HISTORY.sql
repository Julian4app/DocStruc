-- ============================================================
-- FIX: Diary Entry History — run this in Supabase SQL Editor
-- Ensures the table exists AND RLS policies work correctly
-- ============================================================

-- 1. Create table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS diary_entry_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_entry_id  UUID NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  changed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  field_name      TEXT NOT NULL,
  old_value       TEXT,
  new_value       TEXT,
  change_type     TEXT NOT NULL DEFAULT 'edit'
);

-- 2. Add index
CREATE INDEX IF NOT EXISTS idx_diary_entry_history_entry_id
  ON diary_entry_history(diary_entry_id, changed_at DESC);

-- 3. Add updated_at + updated_by to diary_entries if missing
ALTER TABLE diary_entries
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Enable RLS
ALTER TABLE diary_entry_history ENABLE ROW LEVEL SECURITY;

-- 5. Drop old policies
DROP POLICY IF EXISTS diary_history_select ON diary_entry_history;
DROP POLICY IF EXISTS diary_history_insert ON diary_entry_history;
DROP POLICY IF EXISTS diary_history_select_policy ON diary_entry_history;
DROP POLICY IF EXISTS diary_history_insert_policy ON diary_entry_history;

-- 6. Simple, recursion-safe SELECT policy
--    Members of the project can see history
CREATE POLICY diary_history_select ON diary_entry_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = diary_entry_history.project_id
        AND pm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = diary_entry_history.project_id
        AND p.owner_id = auth.uid()
    )
  );

-- 7. Simple, recursion-safe INSERT policy
--    Only the person making the change can insert their own history records
CREATE POLICY diary_history_insert ON diary_entry_history
  FOR INSERT TO authenticated
  WITH CHECK (
    changed_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = diary_entry_history.project_id
          AND pm.user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = diary_entry_history.project_id
          AND p.owner_id = auth.uid()
      )
    )
  );

-- 8. Grant permissions
GRANT SELECT, INSERT ON TABLE public.diary_entry_history TO authenticated;

-- Verify
SELECT 'diary_entry_history RLS fixed ✓' as status;
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'diary_entries' AND column_name IN ('updated_at', 'updated_by');
