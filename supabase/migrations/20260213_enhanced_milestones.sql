-- Enhanced Milestones System with Task/Defect Linking
-- Date: 2026-02-13

-- Create milestone_tasks junction table
CREATE TABLE IF NOT EXISTS milestone_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(milestone_id, task_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_milestone_tasks_milestone_id ON milestone_tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_milestone_tasks_task_id ON milestone_tasks(task_id);

-- Add end_date and description to timeline_events
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6';

-- RLS for milestone_tasks
ALTER TABLE milestone_tasks ENABLE ROW LEVEL SECURITY;

-- View milestone tasks: project members
CREATE POLICY "Project members can view milestone tasks"
  ON milestone_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM timeline_events te
      JOIN projects p ON te.project_id = p.id
      WHERE te.id = milestone_tasks.milestone_id
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM project_members WHERE project_id = p.id AND user_id = auth.uid())
      )
    )
  );

-- Create milestone tasks: project members
CREATE POLICY "Project members can create milestone tasks"
  ON milestone_tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timeline_events te
      JOIN projects p ON te.project_id = p.id
      WHERE te.id = milestone_tasks.milestone_id
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM project_members WHERE project_id = p.id AND user_id = auth.uid())
      )
    )
  );

-- Delete milestone tasks: project members
CREATE POLICY "Project members can delete milestone tasks"
  ON milestone_tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM timeline_events te
      JOIN projects p ON te.project_id = p.id
      WHERE te.id = milestone_tasks.milestone_id
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM project_members WHERE project_id = p.id AND user_id = auth.uid())
      )
    )
  );
