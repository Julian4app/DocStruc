-- ============================================================
-- Bautagebuch (Diary) Edit History
-- Creates diary_entry_history table to track all changes
-- ============================================================

CREATE TABLE IF NOT EXISTS diary_entry_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_entry_id UUID NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  changed_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Snapshot of what changed
  field_name    TEXT NOT NULL,          -- e.g. 'work_performed', 'weather'
  old_value     TEXT,
  new_value     TEXT,
  change_type   TEXT NOT NULL DEFAULT 'edit'  -- 'edit' | 'create'
);

-- Index for fast lookup by diary entry
CREATE INDEX IF NOT EXISTS idx_diary_entry_history_entry_id
  ON diary_entry_history(diary_entry_id, changed_at DESC);

-- RLS
ALTER TABLE diary_entry_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diary_history_select ON diary_entry_history;
CREATE POLICY diary_history_select ON diary_entry_history
  FOR SELECT TO authenticated
  USING (public.has_project_access(project_id));

DROP POLICY IF EXISTS diary_history_insert ON diary_entry_history;
CREATE POLICY diary_history_insert ON diary_entry_history
  FOR INSERT TO authenticated
  WITH CHECK (
    changed_by = auth.uid()
    AND public.has_project_access(project_id)
  );

-- Grant
GRANT SELECT, INSERT ON TABLE public.diary_entry_history TO authenticated;

-- Add updated_at + updated_by columns to diary_entries if missing
ALTER TABLE diary_entries
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL;
