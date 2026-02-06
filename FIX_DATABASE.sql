-- FIX: Comprehensive Permissions and Recursion Fix
-- Run this in your Supabase SQL Editor.

-- 0. GRANT basic table permissions to authenticated users
-- (Sometimes these get lost or were never set correctly)
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.projects TO authenticated;
GRANT ALL ON TABLE public.project_members TO authenticated;
GRANT ALL ON TABLE public.buildings TO authenticated;
GRANT ALL ON TABLE public.floors TO authenticated;
GRANT ALL ON TABLE public.rooms TO authenticated;
GRANT ALL ON TABLE public.tasks TO authenticated;

-- 1. Ensure all users have a profile (Self-healing for existing users)
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 2. Create a secure function to get projects a user belongs to.
-- This function runs with "SECURITY DEFINER" privileges, meaning it bypasses Row Level Security
-- to securely check the table without triggering an infinite loop.
CREATE OR REPLACE FUNCTION get_my_project_ids()
RETURNS setof uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT project_id FROM project_members WHERE user_id = auth.uid()
  UNION
  SELECT id FROM projects WHERE owner_id = auth.uid();
$$;

-- 3. Drop ALL potentially conflicting policies
-- We are aggressive here to ensure no stale policies remain
DROP POLICY IF EXISTS "Project members can view other members" ON public.project_members;
DROP POLICY IF EXISTS "Project members can view projects" ON public.projects;
DROP POLICY IF EXISTS "Project members can view project" ON public.projects;
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
DROP POLICY IF EXISTS "Owners can update project" ON public.projects;
DROP POLICY IF EXISTS "Owners can delete project" ON public.projects;
DROP POLICY IF EXISTS "Enable read for authenticated users only" ON public.projects; -- hypothetical
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.projects; -- hypothetical

-- 4. Recreate the policies using the secure function and explicit permissions

-- --- PROJECTS ---

-- Allow VIEW: Owner OR Member
CREATE POLICY "Project members can view project" ON public.projects
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT get_my_project_ids())
  );

-- Allow INSERT: Must be the owner of the new project
CREATE POLICY "Users can create projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
  );

-- Allow UPDATE: Owner only
CREATE POLICY "Owners can update project" ON public.projects
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = owner_id
  );

-- Allow DELETE: Owner only
CREATE POLICY "Owners can delete project" ON public.projects
  FOR DELETE TO authenticated
  USING (
    auth.uid() = owner_id
  );

-- --- PROJECT MEMBERS ---

CREATE POLICY "Project members can view other members" ON public.project_members
  FOR SELECT TO authenticated
  USING (
    project_id IN (SELECT get_my_project_ids())
  );

-- Allow owners to add members (including themselves via trigger if exists, or manual)
CREATE POLICY "Owners can add members" ON public.project_members
  FOR INSERT TO authenticated
  WITH CHECK (
    -- You can add members if you own the project
    exists (
        select 1 from public.projects 
        where id = project_id 
        and owner_id = auth.uid()
    )
    -- OR if you are adding yourself (sometimes needed for initial setup)
    OR user_id = auth.uid()
  );

-- Allow owners to remove members
CREATE POLICY "Owners can remove members" ON public.project_members
  FOR DELETE TO authenticated
  USING (
    exists (
        select 1 from public.projects 
        where id = project_id 
        and owner_id = auth.uid()
    )
  );

-- --- PROFILES ---
-- Ensure users can view profiles (needed for UI and references)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles; -- Maybe too permissive, but let's stick to own or project related

-- Simple: Everyone can thread-safe view profiles to resolve names? 
-- Or restrict to own? Restricting to own is safer but might break "Assignee" lists.
-- Let's allow authenticated users to view basic profile info to ensure FK checks and UI works.
CREATE POLICY "Users can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Users can update only their own
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);


-- --- TASKS ---

DROP POLICY IF EXISTS "Project members can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project members can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project members can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project members can delete tasks" ON public.tasks;

CREATE POLICY "Project members can view tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    project_id IN (SELECT get_my_project_ids())
  );

CREATE POLICY "Project members can create tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (SELECT get_my_project_ids())
  );

CREATE POLICY "Project members can update tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    project_id IN (SELECT get_my_project_ids())
  );

CREATE POLICY "Project members can delete tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (
    project_id IN (SELECT get_my_project_ids())
  );


