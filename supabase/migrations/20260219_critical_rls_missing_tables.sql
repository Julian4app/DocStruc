-- ============================================================================
-- CRITICAL SECURITY FIX: Enable RLS on 15 unprotected tables
-- Date: 2025-02-19
-- Description: These tables were being accessed by the app without any 
--              Row Level Security, meaning any authenticated user could 
--              read/write all data across all companies/projects.
-- ============================================================================

-- ============================================================================
-- 1. PROJECTS — Core table, must be protected
-- ============================================================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Project owners and members can see their projects
CREATE POLICY "projects_select_policy" ON public.projects
  FOR SELECT USING (
    auth.uid() = created_by
    OR auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = id
    )
  );

-- Only project creator can insert
CREATE POLICY "projects_insert_policy" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Owner and admins can update
CREATE POLICY "projects_update_policy" ON public.projects
  FOR UPDATE USING (
    auth.uid() = created_by
    OR auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = id AND role IN ('admin', 'owner')
    )
  );

-- Only owner can delete
CREATE POLICY "projects_delete_policy" ON public.projects
  FOR DELETE USING (auth.uid() = created_by);

-- ============================================================================
-- 2. TASKS — Per-project tasks
-- ============================================================================
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Project members can see tasks
CREATE POLICY "tasks_select_policy" ON public.tasks
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = tasks.project_id
    )
  );

-- Project members can create tasks
CREATE POLICY "tasks_insert_policy" ON public.tasks
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = tasks.project_id
    )
  );

-- Creator or assigned user or admin can update
CREATE POLICY "tasks_update_policy" ON public.tasks
  FOR UPDATE USING (
    auth.uid() = created_by
    OR auth.uid() = assigned_to
    OR auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = tasks.project_id AND role IN ('admin', 'owner')
    )
  );

-- Creator or admin can delete
CREATE POLICY "tasks_delete_policy" ON public.tasks
  FOR DELETE USING (
    auth.uid() = created_by
    OR auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = tasks.project_id AND role IN ('admin', 'owner')
    )
  );

-- ============================================================================
-- 3. PROJECT_MEMBERS — Membership table
-- ============================================================================
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Members can see other members of their projects
CREATE POLICY "project_members_select_policy" ON public.project_members
  FOR SELECT USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT user_id FROM project_members pm2 WHERE pm2.project_id = project_members.project_id
    )
  );

-- Project owner/admin can manage members
CREATE POLICY "project_members_insert_policy" ON public.project_members
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM project_members pm2 WHERE pm2.project_id = project_members.project_id AND pm2.role IN ('admin', 'owner')
    )
    OR auth.uid() IN (
      SELECT created_by FROM projects WHERE id = project_members.project_id
    )
  );

CREATE POLICY "project_members_update_policy" ON public.project_members
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM project_members pm2 WHERE pm2.project_id = project_members.project_id AND pm2.role IN ('admin', 'owner')
    )
    OR auth.uid() IN (
      SELECT created_by FROM projects WHERE id = project_members.project_id
    )
  );

CREATE POLICY "project_members_delete_policy" ON public.project_members
  FOR DELETE USING (
    auth.uid() = user_id  -- Can remove yourself
    OR auth.uid() IN (
      SELECT user_id FROM project_members pm2 WHERE pm2.project_id = project_members.project_id AND pm2.role IN ('admin', 'owner')
    )
    OR auth.uid() IN (
      SELECT created_by FROM projects WHERE id = project_members.project_id
    )
  );

-- ============================================================================
-- 4. COMPANIES — Company data isolation
-- ============================================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Users can see their own company
CREATE POLICY "companies_select_policy" ON public.companies
  FOR SELECT USING (
    auth.uid() = created_by
    OR auth.uid() IN (
      SELECT id FROM profiles WHERE company_id = companies.id
    )
  );

CREATE POLICY "companies_insert_policy" ON public.companies
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "companies_update_policy" ON public.companies
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "companies_delete_policy" ON public.companies
  FOR DELETE USING (auth.uid() = created_by);

-- ============================================================================
-- 5. INVOICES — Financial data
-- ============================================================================
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select_policy" ON public.invoices
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = invoices.project_id
    )
  );

CREATE POLICY "invoices_insert_policy" ON public.invoices
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = invoices.project_id AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "invoices_update_policy" ON public.invoices
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = invoices.project_id AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "invoices_delete_policy" ON public.invoices
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = invoices.project_id AND role IN ('admin', 'owner')
    )
  );

-- ============================================================================
-- 6. CRM_CONTACTS — Customer PII
-- ============================================================================
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_contacts_select_policy" ON public.crm_contacts
  FOR SELECT USING (
    auth.uid() = created_by
    OR auth.uid() IN (
      SELECT id FROM profiles WHERE company_id = crm_contacts.company_id
    )
  );

CREATE POLICY "crm_contacts_insert_policy" ON public.crm_contacts
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "crm_contacts_update_policy" ON public.crm_contacts
  FOR UPDATE USING (
    auth.uid() = created_by
    OR auth.uid() IN (
      SELECT id FROM profiles WHERE company_id = crm_contacts.company_id
    )
  );

CREATE POLICY "crm_contacts_delete_policy" ON public.crm_contacts
  FOR DELETE USING (auth.uid() = created_by);

-- ============================================================================
-- 7. CRM_NOTES
-- ============================================================================
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_notes_select_policy" ON public.crm_notes
  FOR SELECT USING (
    auth.uid() = created_by
    OR auth.uid() IN (
      SELECT id FROM profiles WHERE company_id = (
        SELECT company_id FROM crm_contacts WHERE id = crm_notes.contact_id
      )
    )
  );

CREATE POLICY "crm_notes_insert_policy" ON public.crm_notes
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "crm_notes_update_policy" ON public.crm_notes
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "crm_notes_delete_policy" ON public.crm_notes
  FOR DELETE USING (auth.uid() = created_by);

-- ============================================================================
-- 8. CONTACT_PERSONS
-- ============================================================================
ALTER TABLE public.contact_persons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_persons_select_policy" ON public.contact_persons
  FOR SELECT USING (
    auth.uid() = created_by
    OR auth.uid() IN (
      SELECT id FROM profiles WHERE company_id = contact_persons.company_id
    )
  );

CREATE POLICY "contact_persons_insert_policy" ON public.contact_persons
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "contact_persons_update_policy" ON public.contact_persons
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "contact_persons_delete_policy" ON public.contact_persons
  FOR DELETE USING (auth.uid() = created_by);

-- ============================================================================
-- 9. COMPANY_FILES
-- ============================================================================
ALTER TABLE public.company_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_files_select_policy" ON public.company_files
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE company_id = company_files.company_id
    )
  );

CREATE POLICY "company_files_insert_policy" ON public.company_files
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE company_id = company_files.company_id
    )
  );

CREATE POLICY "company_files_update_policy" ON public.company_files
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE company_id = company_files.company_id
    )
  );

CREATE POLICY "company_files_delete_policy" ON public.company_files
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE company_id = company_files.company_id
    )
  );

-- ============================================================================
-- 10. COMPANY_SUBSCRIPTIONS
-- ============================================================================
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_subscriptions_select_policy" ON public.company_subscriptions
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE company_id = company_subscriptions.company_id
    )
  );

CREATE POLICY "company_subscriptions_insert_policy" ON public.company_subscriptions
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT created_by FROM companies WHERE id = company_subscriptions.company_id
    )
  );

CREATE POLICY "company_subscriptions_update_policy" ON public.company_subscriptions
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT created_by FROM companies WHERE id = company_subscriptions.company_id
    )
  );

-- ============================================================================
-- 11. SUBCONTRACTORS
-- ============================================================================
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subcontractors_select_policy" ON public.subcontractors
  FOR SELECT USING (
    auth.uid() = created_by
    OR auth.uid() IN (
      SELECT id FROM profiles WHERE company_id = subcontractors.company_id
    )
  );

CREATE POLICY "subcontractors_insert_policy" ON public.subcontractors
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "subcontractors_update_policy" ON public.subcontractors
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "subcontractors_delete_policy" ON public.subcontractors
  FOR DELETE USING (auth.uid() = created_by);

-- ============================================================================
-- 12. SUBCONTRACTOR_CONTACTS
-- ============================================================================
ALTER TABLE public.subcontractor_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subcontractor_contacts_select_policy" ON public.subcontractor_contacts
  FOR SELECT USING (
    auth.uid() IN (
      SELECT created_by FROM subcontractors WHERE id = subcontractor_contacts.subcontractor_id
    )
    OR auth.uid() IN (
      SELECT id FROM profiles WHERE company_id = (
        SELECT company_id FROM subcontractors WHERE id = subcontractor_contacts.subcontractor_id
      )
    )
  );

CREATE POLICY "subcontractor_contacts_insert_policy" ON public.subcontractor_contacts
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT created_by FROM subcontractors WHERE id = subcontractor_contacts.subcontractor_id
    )
  );

CREATE POLICY "subcontractor_contacts_update_policy" ON public.subcontractor_contacts
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT created_by FROM subcontractors WHERE id = subcontractor_contacts.subcontractor_id
    )
  );

CREATE POLICY "subcontractor_contacts_delete_policy" ON public.subcontractor_contacts
  FOR DELETE USING (
    auth.uid() IN (
      SELECT created_by FROM subcontractors WHERE id = subcontractor_contacts.subcontractor_id
    )
  );

-- ============================================================================
-- 13. FEEDBACK
-- ============================================================================
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_insert_policy" ON public.feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "feedback_select_policy" ON public.feedback
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- 14. SUBSCRIPTION_TYPES — Read-only for all authenticated users
-- ============================================================================
ALTER TABLE public.subscription_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_types_select_policy" ON public.subscription_types
  FOR SELECT USING (true);  -- All authenticated users can read subscription types

-- ============================================================================
-- 15. TAGS — Scoped to company
-- ============================================================================
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select_policy" ON public.tags
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE company_id = tags.company_id
    )
  );

CREATE POLICY "tags_insert_policy" ON public.tags
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE company_id = tags.company_id
    )
  );

CREATE POLICY "tags_update_policy" ON public.tags
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE company_id = tags.company_id
    )
  );

CREATE POLICY "tags_delete_policy" ON public.tags
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE company_id = tags.company_id
    )
  );

-- ============================================================================
-- Add missing indexes for RLS performance (subqueries need fast lookups)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_project_members_user_project ON project_members(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_role ON project_members(project_id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company_id ON crm_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_created_by ON crm_contacts(created_by);
CREATE INDEX IF NOT EXISTS idx_crm_notes_contact_id ON crm_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_notes_created_by ON crm_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_contact_persons_company_id ON contact_persons(company_id);
CREATE INDEX IF NOT EXISTS idx_company_files_company_id ON company_files(company_id);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_company_id ON company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subcontractors_company_id ON subcontractors(company_id);
CREATE INDEX IF NOT EXISTS idx_subcontractors_created_by ON subcontractors(created_by);
CREATE INDEX IF NOT EXISTS idx_subcontractor_contacts_subcontractor ON subcontractor_contacts(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_tags_company_id ON tags(company_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
