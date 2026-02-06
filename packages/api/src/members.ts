import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectMember, User } from '@docstruc/logic';

export interface MemberWithUser extends ProjectMember {
  user: User;
}

export const getProjectMembers = async (client: SupabaseClient, projectId: string): Promise<MemberWithUser[]> => {
  // Perform a join to get user details
  const { data, error } = await client
    .from('project_members')
    .select('*, user:users(*)')
    .eq('project_id', projectId);

  if (error) throw error;
  return data as unknown as MemberWithUser[];
};
