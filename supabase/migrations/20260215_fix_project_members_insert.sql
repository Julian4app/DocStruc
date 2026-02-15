-- =====================================================
-- FIX PROJECT MEMBERS INSERT
-- Created: 2026-02-15
-- Purpose: Allow project owners to add members and allow NULL user_id for unregistered accessors
-- =====================================================

-- 1. Make user_id nullable (for unregistered accessors)
ALTER TABLE public.project_members
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add INSERT policy for project owners
CREATE POLICY "Project owners can add members" ON public.project_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_members.project_id
      AND owner_id = auth.uid()
    )
  );

-- 3. Add UPDATE policy for project owners (to manage member status, roles, etc.)
CREATE POLICY "Project owners can update members" ON public.project_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_members.project_id
      AND owner_id = auth.uid()
    )
  );

-- 4. Add DELETE policy for project owners
CREATE POLICY "Project owners can delete members" ON public.project_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_members.project_id
      AND owner_id = auth.uid()
    )
  );
