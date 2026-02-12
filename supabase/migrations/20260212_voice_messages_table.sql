-- Create voice messages table for multiple voice recordings per project
CREATE TABLE IF NOT EXISTS project_voice_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_info_id UUID NOT NULL REFERENCES project_info(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  transcription TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_voice_messages_project_info ON project_voice_messages(project_info_id);

-- Enable RLS
ALTER TABLE project_voice_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view voice messages for projects they have access to" ON project_voice_messages;
DROP POLICY IF EXISTS "Users can insert voice messages for projects they have access to" ON project_voice_messages;
DROP POLICY IF EXISTS "Users can update voice messages for projects they have access to" ON project_voice_messages;
DROP POLICY IF EXISTS "Users can delete voice messages for projects they have access to" ON project_voice_messages;

-- RLS Policies
CREATE POLICY "Users can view voice messages for projects they have access to"
  ON project_voice_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_info pi
      JOIN projects p ON p.id = pi.project_id
      LEFT JOIN project_members pm ON pm.project_id = p.id
      WHERE pi.id = project_info_id
      AND (
        p.owner_id = auth.uid()
        OR pm.user_id = auth.uid()
        OR (SELECT is_superuser FROM profiles WHERE id = auth.uid()) = true
      )
    )
  );

CREATE POLICY "Users can insert voice messages for projects they have access to"
  ON project_voice_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_info pi
      JOIN projects p ON p.id = pi.project_id
      LEFT JOIN project_members pm ON pm.project_id = p.id
      WHERE pi.id = project_info_id
      AND (
        p.owner_id = auth.uid()
        OR pm.user_id = auth.uid()
        OR (SELECT is_superuser FROM profiles WHERE id = auth.uid()) = true
      )
    )
  );

CREATE POLICY "Users can update voice messages for projects they have access to"
  ON project_voice_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_info pi
      JOIN projects p ON p.id = pi.project_id
      LEFT JOIN project_members pm ON pm.project_id = p.id
      WHERE pi.id = project_info_id
      AND (
        p.owner_id = auth.uid()
        OR pm.user_id = auth.uid()
        OR (SELECT is_superuser FROM profiles WHERE id = auth.uid()) = true
      )
    )
  );

CREATE POLICY "Users can delete voice messages for projects they have access to"
  ON project_voice_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_info pi
      JOIN projects p ON p.id = pi.project_id
      LEFT JOIN project_members pm ON pm.project_id = p.id
      WHERE pi.id = project_info_id
      AND (
        p.owner_id = auth.uid()
        OR pm.user_id = auth.uid()
        OR (SELECT is_superuser FROM profiles WHERE id = auth.uid()) = true
      )
    )
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_voice_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_voice_messages_updated_at ON project_voice_messages;
CREATE TRIGGER update_voice_messages_updated_at
  BEFORE UPDATE ON project_voice_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_messages_updated_at();
