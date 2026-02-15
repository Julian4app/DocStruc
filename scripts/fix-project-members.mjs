console.log('🔧 Project Members Fix - SQL Commands\n');
console.log('=' .repeat(80));
console.log('Please run these commands in your Supabase SQL Editor:');
console.log('=' + '='.repeat(80) + '\n');

const sql = `
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

-- 3. Add UPDATE policy for project owners
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
`;

console.log(sql);
console.log('=' + '='.repeat(80));
console.log('\n✅ After running these commands, you can add members to projects!');

