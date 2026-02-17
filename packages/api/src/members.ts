import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectMember, User } from '@docstruc/logic';

export interface MemberWithUser extends ProjectMember {
  user: User;
}

export const getProjectMembers = async (client: SupabaseClient, projectId: string): Promise<MemberWithUser[]> => {
  // Perform a join to get user details from profiles table
  const { data, error } = await client
    .from('project_members')
    .select('id, project_id, user_id, role, invited_at, joined_at, status, role_id, user:profiles(id, email, first_name, last_name, avatar_url, company_name, phone)')
    .eq('project_id', projectId);

  if (error) throw error;
  return data as unknown as MemberWithUser[];
};

export const getProjectAssignedPeople = async (client: SupabaseClient, projectId: string) => {
  // Get employees and owners assigned via project_crm_links
  const { data: crmLinks, error: crmError } = await client
    .from('project_crm_links')
    .select('id, project_id, crm_contact_id, role, contact:crm_contacts(id, type, first_name, last_name, email, phone, avatar_url, personal_number, detailed_address, notes, linked_user_id, created_at, updated_at)')
    .eq('project_id', projectId);

  if (crmError) throw crmError;

  // Get subcontractors assigned via project_subcontractors
  const { data: subLinks, error: subError } = await client
    .from('project_subcontractors')
    .select('id, project_id, subcontractor_id, subcontractor:subcontractors(id, company_name, name, first_name, last_name, phone, trade, logo_url, created_at, contacts:subcontractor_contacts(id, first_name, last_name, email, phone, department))')
    .eq('project_id', projectId);

  if (subError) throw subError;

  return {
    employees: (crmLinks || []).filter(l => l.role === 'employee').map(l => l.contact),
    owners: (crmLinks || []).filter(l => l.role === 'owner').map(l => l.contact),
    subcontractors: (subLinks || []).map(l => l.subcontractor),
  };
};
