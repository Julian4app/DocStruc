import { supabase } from '../supabase';
import type { Team, TeamMember, TeamInvitation, AvailableTeamMember } from '../types/team';

export class TeamService {
  /**
   * Get all teams (superuser only)
   */
  static async getAllTeams(): Promise<Team[]> {
    const { data, error } = await supabase
      .from('teams')
      .select('id, name, description, company_info, contact_email, contact_phone, address, logo_url, created_by, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get team by ID
   */
  static async getTeam(teamId: string): Promise<Team | null> {
    const { data, error } = await supabase
      .from('teams')
      .select('id, name, description, company_info, contact_email, contact_phone, address, logo_url, created_by, is_active, created_at, updated_at')
      .eq('id', teamId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get current user's team
   */
  static async getMyTeam(): Promise<Team | null> {
    const { data: profile } = await supabase
      .from('profiles')
      .select('team_id, teams(id, name, description, company_info, contact_email, contact_phone, address, logo_url, created_by, is_active, created_at, updated_at)')
      .eq('id', (await supabase.auth.getUser()).data.user?.id!)
      .single();

    if (!profile?.team_id) return null;
    return profile.teams as unknown as Team;
  }

  /**
   * Create a new team (superuser only)
   */
  static async createTeam(team: Partial<Team>): Promise<Team> {
    const { data: user } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('teams')
      .insert({
        ...team,
        created_by: user.user?.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update team
   */
  static async updateTeam(teamId: string, updates: Partial<Team>): Promise<Team> {
    const { data, error } = await supabase
      .from('teams')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', teamId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete team (superuser only)
   */
  static async deleteTeam(teamId: string): Promise<void> {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) throw error;
  }

  /**
   * Get team members
   */
  static async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const { data, error } = await supabase.rpc('get_team_members', {
      check_team_id: teamId,
    });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get available team members for a project
   */
  static async getAvailableTeamMembers(
    teamId: string,
    projectId: string
  ): Promise<AvailableTeamMember[]> {
    const { data, error } = await supabase.rpc('get_available_team_members_for_project', {
      check_team_id: teamId,
      check_project_id: projectId,
    });

    if (error) throw error;
    return data || [];
  }

  /**
   * Add member to team (via profile update)
   */
  static async addMemberToTeam(
    userId: string,
    teamId: string,
    teamRole: 'member' | 'team_admin' = 'member'
  ): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({
        team_id: teamId,
        team_role: teamRole,
        joined_team_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) throw error;
  }

  /**
   * Remove member from team
   */
  static async removeMemberFromTeam(userId: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({
        team_id: null,
        team_role: 'member',
        joined_team_at: null,
      })
      .eq('id', userId);

    if (error) throw error;
  }

  /**
   * Update member role in team
   */
  static async updateMemberRole(
    userId: string,
    teamRole: 'member' | 'team_admin'
  ): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ team_role: teamRole })
      .eq('id', userId);

    if (error) throw error;
  }

  /**
   * Invite user to team
   */
  static async inviteToTeam(
    teamId: string,
    email: string,
    teamRole: 'member' | 'team_admin' = 'member'
  ): Promise<TeamInvitation> {
    const { data: user } = await supabase.auth.getUser();
    
    const token = crypto.randomUUID();
    
    const { data, error } = await supabase
      .from('team_invitations')
      .insert({
        team_id: teamId,
        email: email.toLowerCase(),
        team_role: teamRole,
        invited_by: user.user?.id,
        token,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get team invitations
   */
  static async getTeamInvitations(teamId: string): Promise<TeamInvitation[]> {
    const { data, error } = await supabase
      .from('team_invitations')
      .select('id, team_id, email, team_role, invited_by, token, status, invited_at, accepted_at')
      .eq('team_id', teamId)
      .order('invited_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Accept team invitation
   */
  static async acceptTeamInvitation(invitationId: string): Promise<void> {
    const { data: user } = await supabase.auth.getUser();
    
    // Get invitation
    const { data: invitation, error: invError } = await supabase
      .from('team_invitations')
      .select('id, team_id, email, team_role, status')
      .eq('id', invitationId)
      .single();

    if (invError) throw invError;
    
    // Update profile
    await this.addMemberToTeam(user.user?.id!, invitation.team_id, invitation.team_role);
    
    // Mark invitation as accepted
    const { error } = await supabase
      .from('team_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitationId);

    if (error) throw error;
  }

  /**
   * Cancel/decline team invitation
   */
  static async cancelTeamInvitation(invitationId: string): Promise<void> {
    const { error } = await supabase
      .from('team_invitations')
      .update({ status: 'declined' })
      .eq('id', invitationId);

    if (error) throw error;
  }

  /**
   * Add team to project
   */
  static async addTeamToProject(teamId: string, projectId: string): Promise<void> {
    const { data: user } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('team_project_access')
      .insert({
        team_id: teamId,
        project_id: projectId,
        added_by: user.user?.id,
      });

    if (error && !error.message.includes('duplicate')) throw error;
  }

  /**
   * Remove team from project
   */
  static async removeTeamFromProject(teamId: string, projectId: string): Promise<void> {
    const { error } = await supabase
      .from('team_project_access')
      .delete()
      .eq('team_id', teamId)
      .eq('project_id', projectId);

    if (error) throw error;
  }

  /**
   * Get teams for a project
   */
  static async getProjectTeams(projectId: string): Promise<Team[]> {
    const { data, error } = await supabase
      .from('team_project_access')
      .select('team_id, teams(id, name, description, company_info, contact_email, contact_phone, address, logo_url, created_by, is_active, created_at, updated_at)')
      .eq('project_id', projectId);

    if (error) throw error;
    return data?.map((d: any) => d.teams).filter(Boolean) || [];
  }

  /**
   * Add team member to project using RPC
   */
  static async addTeamMemberToProject(
    userId: string,
    projectId: string,
    roleId?: string,
    customPerms?: any
  ): Promise<string> {
    const { data, error } = await supabase.rpc('add_team_member_to_project', {
      target_user_id: userId,
      target_project_id: projectId,
      member_role_id: roleId || null,
      custom_perms: customPerms || null,
    });

    if (error) throw error;
    return data;
  }

  /**
   * Check if user is team admin
   */
  static async isTeamAdmin(userId: string, teamId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('is_team_admin', {
      user_id: userId,
      check_team_id: teamId,
    });

    if (error) throw error;
    return data || false;
  }

  /**
   * Check if user can manage another user
   */
  static async canManageTeamMember(managerId: string, targetUserId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('can_manage_team_member', {
      manager_id: managerId,
      target_user_id: targetUserId,
    });

    if (error) throw error;
    return data || false;
  }
}
