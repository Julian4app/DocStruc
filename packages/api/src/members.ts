import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectMember, User } from '@docstruc/logic';

export interface MemberWithUser extends ProjectMember {
  user: User;
}

export const getProjectMembers = async (client: SupabaseClient, projectId: string): Promise<MemberWithUser[]> => {
  // Perform a join to get user details from profiles table
  const { data, error } = await client
    .from('project_members')
    .select('*, user:profiles(*)')
    .eq('project_id', projectId);

  if (error) throw error;
  return data as unknown as MemberWithUser[];
};

export const getProjectAssignedPeople = async (client: SupabaseClient, projectId: string) => {
  // Get employees and owners assigned via project_crm_links
  const { data: crmLinks, error: crmError } = await client
    .from('project_crm_links')
    .select('*, contact:crm_contacts(*)')
    .eq('project_id', projectId);

  if (crmError) throw crmError;

  // Get subcontractors assigned via project_subcontractors
  const { data: subLinks, error: subError } = await client
    .from('project_subcontractors')
    .select('*, subcontractor:subcontractors(*, contacts:subcontractor_contacts(*))')
    .eq('project_id', projectId);

  if (subError) throw subError;

  return {
    employees: (crmLinks || []).filter(l => l.role === 'employee').map(l => l.contact),
    owners: (crmLinks || []).filter(l => l.role === 'owner').map(l => l.contact),
    subcontractors: (subLinks || []).map(l => l.subcontractor),
  };
};
