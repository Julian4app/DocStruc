-- ============================================================================
-- HOTFIX: Remove duplicate RLS policies that broke project visibility
-- Date: 2026-02-17
-- 
-- ROOT CAUSE: Migration 20260219_critical_rls_missing_tables.sql created
-- DUPLICATE policies on projects, tasks, and project_members that already
-- had correct policies from:
--   - 20260215_complete_rls_overhaul.sql (has_project_access + team support)
--   - 20260217_fix_project_access_for_teams.sql (superuser + team admin)
--   - 20260217_002_implement_content_visibility_rls.sql (visibility settings)
--
-- The duplicate policies with "_policy" suffix introduced:
--   - Weaker SELECT on projects (no superuser/team checks)
--   - Self-referencing project_members query → infinite recursion
--   - Conflicting INSERT/UPDATE/DELETE (no superuser/team admin checks)
--
-- FIX: Drop all duplicate policies. Keep originals intact.
-- ============================================================================

-- ============================================================================
-- 1. Drop duplicate PROJECT policies (originals: projects_select, projects_insert, etc.)
-- ============================================================================
DROP POLICY IF EXISTS "projects_select_policy" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_policy" ON public.projects;
DROP POLICY IF EXISTS "projects_update_policy" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_policy" ON public.projects;

-- ============================================================================
-- 2. Drop duplicate TASK policies (originals: tasks_select, tasks_insert, etc.)
-- ============================================================================
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON public.tasks;

-- ============================================================================
-- 3. Drop duplicate PROJECT_MEMBERS policies 
--    (originals: project_members_select, project_members_insert, etc.)
-- ============================================================================
DROP POLICY IF EXISTS "project_members_select_policy" ON public.project_members;
DROP POLICY IF EXISTS "project_members_insert_policy" ON public.project_members;
DROP POLICY IF EXISTS "project_members_update_policy" ON public.project_members;
DROP POLICY IF EXISTS "project_members_delete_policy" ON public.project_members;

-- ============================================================================
-- 4. Drop duplicate INVOICES policies
--    Invoices are CRM invoices. The overhaul didn't cover these,
--    but let's ensure no conflicts. Recreate cleanly.
-- ============================================================================
DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_policy" ON public.invoices;

-- Recreate invoices policies (these are CRM invoices, superuser-managed)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select_policy" ON public.invoices
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "invoices_insert_policy" ON public.invoices
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true)
  );

CREATE POLICY "invoices_update_policy" ON public.invoices
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true)
  );

CREATE POLICY "invoices_delete_policy" ON public.invoices
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true)
  );

-- ============================================================================
-- VERIFICATION: List remaining policies on affected tables
-- ============================================================================
-- Run this after applying to verify:
-- SELECT tablename, policyname, cmd FROM pg_policies 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('projects','tasks','project_members','invoices')
-- ORDER BY tablename, policyname;
