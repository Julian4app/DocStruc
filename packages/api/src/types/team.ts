// Team Management Types
// Generated: 2026-02-16

export interface Team {
  id: string;
  name: string;
  description?: string;
  company_info?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  is_active: boolean;
}

export interface TeamMember {
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  team_role: 'member' | 'team_admin';
  joined_team_at?: string;
  is_superuser: boolean;
}

export interface TeamInvitation {
  id: string;
  team_id: string;
  email: string;
  team_role: 'member' | 'team_admin';
  invited_by: string;
  invited_at: string;
  accepted_at?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  token?: string;
  expires_at: string;
}

export interface TeamProjectAccess {
  id: string;
  project_id: string;
  team_id: string;
  added_by: string;
  added_at: string;
}

export interface ExtendedProfile {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  is_superuser: boolean;
  team_id?: string;
  team_role?: 'member' | 'team_admin';
  joined_team_at?: string;
  team?: Team;
}

export interface AvailableTeamMember {
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  team_role: 'member' | 'team_admin';
  already_in_project: boolean;
}
