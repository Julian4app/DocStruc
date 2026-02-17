-- ============================================================================
-- CRITICAL SECURITY FIX: Enable RLS on 15 unprotected tables (CORRECTED)
-- Date: 2025-02-19 (FIXED)
-- Description: These tables were being accessed without Row Level Security.
--              This version accounts for ACTUAL schema structure.
-- 
-- SCHEMA FACTS (verified from migrations):
--   - profiles has: company_name TEXT (not company_id UUID)
--   - companies table IS the company (id, name, address, contact_person_id)
--   - crm_contacts has NO company_id - system-wide entities
--   - contact_persons has: company TEXT (name, not UUID)
--   - subcontractors has NO company_id - independent entities
--   - These are CRM/admin tables for managing master data
-- ============================================================================

-- ============================================================================
-- 1. PROJECTS — Core table, must be protected
-- ============================================================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Project owners and members can see their projects
CREATE POLICY "projects_select_policy" ON public.projects
  FOR SELECT USING (
    auth.uid() = owner_id
    OR auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = id
    )
  );

-- Only project creator can insert
CREATE POLICY "projects_insert_policy" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Owner can update
CREATE POLICY "projects_update_policy" ON public.projects
  FOR UPDATE USING (auth.uid() = owner_id);

-- Only owner can delete
CREATE POLICY "projects_delete_policy" ON public.projects
  FOR DELETE USING (auth.uid() = owner_id);

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
    OR auth.uid() = creator_id
  );

-- Project members can create tasks
CREATE POLICY "tasks_insert_policy" ON public.tasks
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = tasks.project_id
    )
    OR auth.uid() = creator_id
  );

-- Creator, assignee, or project owner can update
CREATE POLICY "tasks_update_policy" ON public.tasks
  FOR UPDATE USING (
    auth.uid() = creator_id
    OR auth.uid() = assigned_to
    OR auth.uid() IN (
      SELECT owner_id FROM projects WHERE id = tasks.project_id
    )
  );

-- Creator or project owner can delete
CREATE POLICY "tasks_delete_policy" ON public.tasks
  FOR DELETE USING (
    auth.uid() = creator_id
    OR auth.uid() IN (
      SELECT owner_id FROM projects WHERE id = tasks.project_id
    )
  );

-- ============================================================================
-- 3. PROJECT_MEMBERS — Control who can access projects
-- ============================================================================
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Project members can see other members
CREATE POLICY "project_members_select_policy" ON public.project_members
  FOR SELECT USING (
    auth.uid() IN (
      SELECT owner_id FROM projects WHERE id = project_members.project_id
    )
    OR auth.uid() IN (
      SELECT user_id FROM project_members pm 
      WHERE pm.project_id = project_members.project_id
    )
  );

-- Only project owner can add members
CREATE POLICY "project_members_insert_policy" ON public.project_members
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT owner_id FROM projects WHERE id = project_id
    )
  );

-- Only project owner can update members
CREATE POLICY "project_members_update_policy" ON public.project_members
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT owner_id FROM projects WHERE id = project_id
    )
  );

-- Only project owner can remove members
CREATE POLICY "project_members_delete_policy" ON public.project_members
  FOR DELETE USING (
    auth.uid() IN (
      SELECT owner_id FROM projects WHERE id = project_id
    )
  );

-- ============================================================================
-- 4. COMPANIES — CRM data (Admin system)
-- ============================================================================
-- NOTE: These are CRM companies managed by admins, NOT user companies
-- Access model: Allow all authenticated users to view (for dropdowns/selections)
-- Only admins/superusers can modify
-- ============================================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view companies (needed for project creation)
CREATE POLICY "companies_select_policy" ON public.companies
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only superusers can create companies
CREATE POLICY "companies_insert_policy" ON public.companies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- Only superusers can update companies
CREATE POLICY "companies_update_policy" ON public.companies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- Only superusers can delete companies
CREATE POLICY "companies_delete_policy" ON public.companies
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- ============================================================================
-- 5. INVOICES — Project-scoped
-- ============================================================================
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Project owner can see invoices
CREATE POLICY "invoices_select_policy" ON public.invoices
  FOR SELECT USING (
    auth.uid() IN (
      SELECT owner_id FROM projects WHERE id = invoices.project_id
    )
  );

-- Project owner can create invoices
CREATE POLICY "invoices_insert_policy" ON public.invoices
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT owner_id FROM projects WHERE id = invoices.project_id
    )
  );

-- Project owner can update invoices
CREATE POLICY "invoices_update_policy" ON public.invoices
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT owner_id FROM projects WHERE id = invoices.project_id
    )
  );

-- Project owner can delete invoices
CREATE POLICY "invoices_delete_policy" ON public.invoices
  FOR DELETE USING (
    auth.uid() IN (
      SELECT owner_id FROM projects WHERE id = invoices.project_id
    )
  );

-- ============================================================================
-- 6. CRM_CONTACTS — System-wide contact pool (employees/owners)
-- ============================================================================
-- NOTE: These are shared contacts used across projects
-- Any authenticated user can view (for assigning to projects)
-- Only superusers can modify
-- ============================================================================
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view CRM contacts
CREATE POLICY "crm_contacts_select_policy" ON public.crm_contacts
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only superusers can create contacts
CREATE POLICY "crm_contacts_insert_policy" ON public.crm_contacts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- Only superusers can update contacts
CREATE POLICY "crm_contacts_update_policy" ON public.crm_contacts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- Only superusers can delete contacts
CREATE POLICY "crm_contacts_delete_policy" ON public.crm_contacts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- ============================================================================
-- 7. CRM_NOTES — Notes attached to CRM companies
-- ============================================================================
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view notes
CREATE POLICY "crm_notes_select_policy" ON public.crm_notes
  FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can create notes
CREATE POLICY "crm_notes_insert_policy" ON public.crm_notes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Users can update their own notes or superusers can update any
CREATE POLICY "crm_notes_update_policy" ON public.crm_notes
  FOR UPDATE USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- Users can delete their own notes or superusers can delete any
CREATE POLICY "crm_notes_delete_policy" ON public.crm_notes
  FOR DELETE USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- ============================================================================
-- 8. CONTACT_PERSONS — Contact persons for companies
-- ============================================================================
-- NOTE: contact_persons.company is TEXT (company name), not UUID
-- All authenticated users can view, only superusers can modify
-- ============================================================================
ALTER TABLE public.contact_persons ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view contact persons
CREATE POLICY "contact_persons_select_policy" ON public.contact_persons
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only superusers can create contact persons
CREATE POLICY "contact_persons_insert_policy" ON public.contact_persons
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- Only superusers can update contact persons
CREATE POLICY "contact_persons_update_policy" ON public.contact_persons
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- Only superusers can delete contact persons
CREATE POLICY "contact_persons_delete_policy" ON public.contact_persons
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- ============================================================================
-- 9. COMPANY_FILES — Files attached to CRM companies
-- ============================================================================
ALTER TABLE public.company_files ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view files
CREATE POLICY "company_files_select_policy" ON public.company_files
  FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can upload files
CREATE POLICY "company_files_insert_policy" ON public.company_files
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Only superusers can update file metadata
CREATE POLICY "company_files_update_policy" ON public.company_files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- Only superusers can delete files
CREATE POLICY "company_files_delete_policy" ON public.company_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- ============================================================================
-- 10. COMPANY_SUBSCRIPTIONS — CRM company subscriptions
-- ============================================================================
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view subscriptions
CREATE POLICY "company_subscriptions_select_policy" ON public.company_subscriptions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only superusers can create subscriptions
CREATE POLICY "company_subscriptions_insert_policy" ON public.company_subscriptions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- Only superusers can update subscriptions
CREATE POLICY "company_subscriptions_update_policy" ON public.company_subscriptions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- ============================================================================
-- 11. SUBCONTRACTORS — System-wide subcontractor companies
-- ============================================================================
-- NOTE: Subcontractors are NOT scoped by company_id
-- They are independent entities shared across the system
-- ============================================================================
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view subcontractors (for project assignment)
CREATE POLICY "subcontractors_select_policy" ON public.subcontractors
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only superusers can create subcontractors
CREATE POLICY "subcontractors_insert_policy" ON public.subcontractors
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- Only superusers can update subcontractors
CREATE POLICY "subcontractors_update_policy" ON public.subcontractors
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- Only superusers can delete subcontractors
CREATE POLICY "subcontractors_delete_policy" ON public.subcontractors
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- ============================================================================
-- 12. SUBCONTRACTOR_CONTACTS — Contacts for subcontractors
-- ============================================================================
ALTER TABLE public.subcontractor_contacts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view subcontractor contacts
CREATE POLICY "subcontractor_contacts_select_policy" ON public.subcontractor_contacts
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only superusers can create subcontractor contacts
CREATE POLICY "subcontractor_contacts_insert_policy" ON public.subcontractor_contacts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- Only superusers can update subcontractor contacts
CREATE POLICY "subcontractor_contacts_update_policy" ON public.subcontractor_contacts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- Only superusers can delete subcontractor contacts
CREATE POLICY "subcontractor_contacts_delete_policy" ON public.subcontractor_contacts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- ============================================================================
-- 13. FEEDBACK — User feedback
-- ============================================================================
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users can only insert their own feedback
CREATE POLICY "feedback_insert_policy" ON public.feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only view their own feedback
CREATE POLICY "feedback_select_policy" ON public.feedback
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- ============================================================================
-- 14. SUBSCRIPTION_TYPES — Read-only reference data
-- ============================================================================
ALTER TABLE public.subscription_types ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read subscription types
CREATE POLICY "subscription_types_select_policy" ON public.subscription_types
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only superusers can modify subscription types
CREATE POLICY "subscription_types_insert_policy" ON public.subscription_types
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

CREATE POLICY "subscription_types_update_policy" ON public.subscription_types
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

CREATE POLICY "subscription_types_delete_policy" ON public.subscription_types
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- ============================================================================
-- 15. TAGS — System-wide tags
-- ============================================================================
-- NOTE: Tags are NOT scoped by company
-- They are shared across the system
-- ============================================================================
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view tags
CREATE POLICY "tags_select_policy" ON public.tags
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only superusers can create tags
CREATE POLICY "tags_insert_policy" ON public.tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- Only superusers can update tags
CREATE POLICY "tags_update_policy" ON public.tags
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- Only superusers can delete tags
CREATE POLICY "tags_delete_policy" ON public.tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superuser = true
    )
  );

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================
-- Add indexes to speed up RLS policy checks
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON tasks(creator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_crm_notes_created_by ON crm_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_crm_notes_company_id ON crm_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_company_files_company_id ON company_files(company_id);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_company_id ON company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_contacts_subcontractor ON subcontractor_contacts(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_superuser ON profiles(is_superuser) WHERE is_superuser = true;
