-- ─────────────────────────────────────────────────────────────────────────────
-- Report Automations
-- Each row = one scheduled report rule owned by a single user for a project.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_automations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id     uuid NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,

  -- Which report templates to include (array of template ids)
  report_ids     text[]  NOT NULL DEFAULT '{}',

  -- Schedule: 'monthly_first' | 'quarterly_first' | 'weekly_monday' | 'custom_day'
  schedule_type  text    NOT NULL DEFAULT 'monthly_first',

  -- For schedule_type = 'custom_day': day of month (1-28)
  custom_day     smallint,

  -- Timeframe of data to include: 'last_period' (always) 
  -- (last_period means: last full month for monthly, last full quarter for quarterly, etc.)

  -- Format: 'pdf' | 'csv'
  export_format  text    NOT NULL DEFAULT 'pdf',

  -- Whether the automation is active
  is_active      boolean NOT NULL DEFAULT true,

  -- Email to send to (defaults to user's email, but can be overridden)
  recipient_email text,

  -- Timestamps
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- Track last and next scheduled run
  last_sent_at   timestamptz,
  next_run_at    timestamptz,

  -- Optional note / label for this automation
  label          text
);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION update_report_automations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_automations_updated_at ON report_automations;
CREATE TRIGGER trg_report_automations_updated_at
  BEFORE UPDATE ON report_automations
  FOR EACH ROW EXECUTE FUNCTION update_report_automations_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE report_automations ENABLE ROW LEVEL SECURITY;

-- Each user can only see / manage their own automations
CREATE POLICY "users_own_automations_select"
  ON report_automations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_own_automations_insert"
  ON report_automations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_automations_update"
  ON report_automations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_automations_delete"
  ON report_automations FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_report_automations_user    ON report_automations(user_id);
CREATE INDEX IF NOT EXISTS idx_report_automations_project ON report_automations(project_id);
CREATE INDEX IF NOT EXISTS idx_report_automations_next    ON report_automations(next_run_at) WHERE is_active = true;
