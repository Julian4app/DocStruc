-- ============================================================
-- FIX: audit_logs missing columns + trigger function repair
-- 
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor).
-- It is fully idempotent — safe to run multiple times.
-- ============================================================

-- Step 1: Add missing columns to audit_logs
-- (The trigger function writes these, but the table was created without them)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'actor_id'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'table_name'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN table_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'record_id'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN record_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'old_values'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN old_values jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'new_values'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN new_values jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END;
$$;

-- Step 2: Replace the trigger function so it writes ALL columns correctly
-- (both new columns AND the existing NOT NULL columns entity_type / entity_id)
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
    TG_TABLE_NAME,                        -- entity_type (NOT NULL)
    v_record_id,                          -- entity_id   (NOT NULL)
    COALESCE(v_new_values, v_old_values), -- details
    now()                                 -- performed_at
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Step 3: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id   ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id  ON public.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
