-- ============================================================
-- Fix audit_logs table: add missing columns expected by the
-- audit_trigger_fn() SECURITY DEFINER trigger function.
--
-- The table was created by 20260312_admin_crm_tables.sql with
-- columns: id, entity_type, entity_id, action, details, performed_at
-- But the trigger (20260303_audit_triggers.sql) writes to:
--   actor_id, action, table_name, record_id, old_values, new_values, created_at
-- This migration reconciles both schemas idempotently.
-- ============================================================

DO $$
BEGIN
  -- actor_id: the authenticated user who performed the action
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'actor_id'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- table_name: which table was affected
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'table_name'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN table_name text;
  END IF;

  -- record_id: the primary key of the affected row
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'record_id'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN record_id uuid;
  END IF;

  -- old_values: row state before UPDATE/DELETE
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'old_values'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN old_values jsonb;
  END IF;

  -- new_values: row state after INSERT/UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'new_values'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN new_values jsonb;
  END IF;

  -- created_at: when the audit event was recorded
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END;
$$;

-- Re-create the trigger function to be robust regardless of column order,
-- and also populate the legacy columns (entity_type, entity_id, details)
-- so both old and new consumers work.
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
  v_record_id  uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action     := 'INSERT';
    v_old_values := NULL;
    v_new_values := to_jsonb(NEW);
    v_record_id  := (v_new_values->>'id')::uuid;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action     := 'UPDATE';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    v_record_id  := (v_new_values->>'id')::uuid;
    -- Skip if nothing changed
    IF v_old_values = v_new_values THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action     := 'DELETE';
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
    v_record_id  := (v_old_values->>'id')::uuid;
  END IF;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values,
    created_at,
    -- legacy columns kept for backwards compatibility
    entity_type,
    entity_id,
    details,
    performed_at
  ) VALUES (
    v_actor_id,
    v_action,
    TG_TABLE_NAME,
    v_record_id,
    v_old_values,
    v_new_values,
    now(),
    -- legacy: entity_type = table name, entity_id = record id
    TG_TABLE_NAME,
    v_record_id,
    COALESCE(v_new_values, v_old_values),
    now()
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id    ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name  ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id   ON public.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON public.audit_logs(created_at DESC);
