-- ============================================================
-- SOC 2 Type II / ISO 27001 – Audit Log Triggers
-- CC7.2: System monitoring – record who changed what and when
-- ============================================================

-- Ensure audit_logs table has the necessary columns
-- (table already exists; this is idempotent)
DO $$
BEGIN
  -- Add missing columns if they were not created in a prior migration
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'audit_logs'
      AND column_name  = 'ip_address'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN ip_address inet;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'audit_logs'
      AND column_name  = 'user_agent'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN user_agent text;
  END IF;
END;
$$;

-- -------------------------------------------------------
-- Generic trigger function used by all audited tables
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_actor_id   uuid := auth.uid();
  v_action     text;
  v_old_values jsonb;
  v_new_values jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action     := 'INSERT';
    v_old_values := NULL;
    v_new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action     := 'UPDATE';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    -- Only log if something actually changed
    IF v_old_values = v_new_values THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action     := 'DELETE';
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
  END IF;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values,
    created_at
  ) VALUES (
    v_actor_id,
    v_action,
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN (v_old_values->>'id')::uuid
      ELSE (v_new_values->>'id')::uuid
    END,
    v_old_values,
    v_new_values,
    now()
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- -------------------------------------------------------
-- Helper macro to attach audit trigger to a table
-- -------------------------------------------------------
-- Usage: SELECT attach_audit_trigger('projects');

CREATE OR REPLACE FUNCTION public.attach_audit_trigger(p_table text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('
    DROP TRIGGER IF EXISTS audit_%I ON public.%I;
    CREATE TRIGGER audit_%I
      AFTER INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
  ', p_table, p_table, p_table, p_table);
END;
$$;

-- -------------------------------------------------------
-- Attach triggers to high-value / sensitive tables
-- -------------------------------------------------------

-- Core project data
SELECT public.attach_audit_trigger('projects');
SELECT public.attach_audit_trigger('project_members');

-- User identity & privilege changes (critical for SOC 2 CC6.3)
SELECT public.attach_audit_trigger('profiles');

-- CRM / financial data
SELECT public.attach_audit_trigger('companies');
SELECT public.attach_audit_trigger('invoices');
SELECT public.attach_audit_trigger('company_subscriptions');

-- Invitation system
SELECT public.attach_audit_trigger('project_invitations');

-- -------------------------------------------------------
-- RLS on audit_logs: only superusers may read
-- -------------------------------------------------------
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_superuser_read" ON public.audit_logs;
CREATE POLICY "audit_logs_superuser_read"
  ON public.audit_logs
  FOR SELECT
  USING (public.is_current_user_superuser());

-- Nobody (not even superusers via authenticated role) may INSERT/UPDATE/DELETE
-- audit rows directly – only the trigger function (SECURITY DEFINER) may write.
DROP POLICY IF EXISTS "audit_logs_no_direct_write" ON public.audit_logs;
CREATE POLICY "audit_logs_no_direct_write"
  ON public.audit_logs
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Re-grant SELECT to the trigger function's owner (postgres) via SECURITY DEFINER;
-- the above SELECT policy allows superusers to query via the application.

-- -------------------------------------------------------
-- Retention: auto-delete audit records older than 2 years
-- (SOC 2 recommends at least 1 year; 2 years covers ISO 27001)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < now() - INTERVAL '2 years';
END;
$$;

COMMENT ON FUNCTION public.audit_trigger_fn() IS
  'SOC 2 CC7.2 / ISO 27001 A.12.4 – Generic audit trigger. Records actor, action, before/after values for INSERT/UPDATE/DELETE operations on sensitive tables.';

COMMENT ON FUNCTION public.purge_old_audit_logs() IS
  'Deletes audit log entries older than 2 years. Schedule via pg_cron or Supabase scheduled functions.';
