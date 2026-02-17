import React, { useEffect, useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { SearchableSelect } from '../../components/SearchableSelect';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { ModernModal } from '../../components/ModernModal';
import { useToast } from '../../components/ToastProvider';
import { 
  Users, Plus, Trash2, Edit2, Shield, Eye, Check, Mail, Building, 
  Phone, UserPlus, Send, UserX, UserCheck, RefreshCw, MoreVertical, UsersRound,
  Share2, Globe, Lock, Building2, Info
} from 'lucide-react';

type VisibilityLevel = 'all_participants' | 'team_only' | 'owner_only';

interface ContentDefault {
  module_key: string;
  module_name: string;
  default_visibility: VisibilityLevel;
  has_custom_default: boolean;
}

interface PermissionModule {
  module_key: string;
  module_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface Role {
  id: string;
  role_name: string;
  role_description: string;
}

interface UserAccessor {
  id: string;
  accessor_email: string;
  accessor_first_name: string;
  accessor_last_name: string;
  accessor_company: string;
  accessor_type: 'employee' | 'owner' | 'subcontractor' | 'other';
  registered_user_id?: string | null;
}

interface ProjectMember {
  id: string;
  user_id: string;
  accessor_id: string;
  member_type: 'employee' | 'owner' | 'subcontractor' | 'other';
  role_id: string | null;
  status: 'open' | 'invited' | 'active' | 'inactive';
  invited_at: string | null;
  accepted_at: string | null;
  accessor: UserAccessor;
  role: Role | null;
  custom_permissions: PermissionModule[];
}

export function ProjectParticipants() {
  const { id: projectId } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isProjectOwner, setIsProjectOwner] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [isTeamAdmin, setIsTeamAdmin] = useState(false);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [hasTeamAccess, setHasTeamAccess] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'members' | 'freigaben'>('members');
  
  // Data states
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [availableModules, setAvailableModules] = useState<PermissionModule[]>([]);
  
  // Freigaben states
  const [contentDefaults, setContentDefaults] = useState<ContentDefault[]>([]);
  const [savingFreigaben, setSavingFreigaben] = useState(false);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  
  // Modal states
  const [isEditPermissionsModalOpen, setIsEditPermissionsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<ProjectMember | null>(null);
  const [actionMenuMemberId, setActionMenuMemberId] = useState<string | null>(null);
  const [invitingMemberIds, setInvitingMemberIds] = useState<Set<string>>(new Set());
  
  // Edit permissions form
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [useCustomPermissions, setUseCustomPermissions] = useState(false);
  const [customPermissions, setCustomPermissions] = useState<Record<string, PermissionModule>>({});

  // Status filter
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Team functionality
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isAddTeamMemberModalOpen, setIsAddTeamMemberModalOpen] = useState(false);
  const [selectedTeamMemberIds, setSelectedTeamMemberIds] = useState<string[]>([]);

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is project owner
      const { data: project } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .single();

      setIsProjectOwner(project?.owner_id === user.id);
      
      // Check if user is team admin and check access to this project
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('team_id, team_role, is_superuser')
        .eq('id', user.id)
        .single();
      
      const userIsSuperuser = userProfile?.is_superuser === true;
      setIsSuperuser(userIsSuperuser);
      
      if (userProfile?.team_role === 'team_admin' && userProfile?.team_id) {
        console.log('🔍 ProjectParticipants: User is team admin', { team_id: userProfile.team_id });
        setIsTeamAdmin(true);
        setUserTeamId(userProfile.team_id);
        
        // Check if team admin has access:
        // 1. Via team_project_access (team has access to project)
        const { data: teamAccess } = await supabase
          .from('team_project_access')
          .select('id')
          .eq('project_id', projectId)
          .eq('team_id', userProfile.team_id)
          .maybeSingle();
        
        console.log('📊 ProjectParticipants: Team access check', { teamAccess });
        
        // 2. OR is a member of the project themselves
        const { data: isMember } = await supabase
          .from('project_members')
          .select('id, role_id')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle();
        
        console.log('📊 ProjectParticipants: Member check', { isMember });
        
        if (teamAccess || isMember) {
          console.log('✅ ProjectParticipants: Team admin has access!');
          setHasTeamAccess(true);
          // Load team members for adding
          await loadTeamMembers(userProfile.team_id);
        } else {
          console.log('❌ ProjectParticipants: Team admin has NO access to this project');
        }
      }

      // Load project members
      await loadMembers();

      // Load roles that are assigned to THIS PROJECT (via project_available_roles table)
      const { data: projectRolesData, error: projectRolesError } = await supabase
        .from('project_available_roles')
        .select(`
          role_id,
          role:roles(id, role_name, role_description)
        `)
        .eq('project_id', projectId);

      if (projectRolesError) throw projectRolesError;
      
      // Extract the role objects from the junction table
      const rolesForProject = (projectRolesData || [])
        .map(pr => pr.role)
        .filter(Boolean);
      
      setAvailableRoles(rolesForProject as any[]);

      // Load permission modules
      const { data: modulesData, error: modulesError } = await supabase
        .from('permission_modules')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (modulesError) throw modulesError;
      setAvailableModules(modulesData || []);

      // Load Freigaben (content defaults) for superuser/owner
      if (userIsSuperuser || project?.owner_id === user.id) {
        await loadContentDefaults();
        await loadProjectTeams();
      }

    } catch (error: any) {
      showToast('Fehler beim Laden: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadContentDefaults = async () => {
    try {
      const { data, error } = await supabase.rpc('get_project_content_defaults', {
        p_project_id: projectId
      });
      if (error) throw error;
      setContentDefaults((data || []).map((d: any) => ({
        module_key: d.module_key,
        module_name: d.module_name,
        default_visibility: d.default_visibility as VisibilityLevel,
        has_custom_default: d.has_custom_default,
      })));
    } catch (error: any) {
      console.error('Error loading content defaults:', error);
    }
  };

  const loadProjectTeams = async () => {
    try {
      // Load teams that have access to this project
      const { data: teamAccessData, error } = await supabase
        .from('team_project_access')
        .select('team_id, team:teams(id, name)')
        .eq('project_id', projectId);
      if (error) throw error;
      const projectTeams = (teamAccessData || [])
        .map(ta => ta.team)
        .filter(Boolean)
        .map((t: any) => ({ id: t.id, name: t.name }));
      setTeams(projectTeams);
    } catch (error: any) {
      console.error('Error loading teams:', error);
    }
  };

  const loadMembers = async () => {
    try {
      const { data: membersData, error: membersError } = await supabase
        .from('project_members')
        .select(`
          *,
          accessor:user_accessors(*),
          role:roles(id, role_name, role_description)
        `)
        .eq('project_id', projectId);

      if (membersError) throw membersError;

      // Load custom permissions for each member
      const membersWithPermissions = await Promise.all(
        (membersData || []).map(async (member) => {
          const { data: permsData } = await supabase
            .from('project_member_permissions')
            .select('module_key, can_view, can_create, can_edit, can_delete')
            .eq('project_member_id', member.id);

          return {
            ...member,
            status: member.status || 'open',
            custom_permissions: permsData || []
          };
        })
      );

      setMembers(membersWithPermissions);
    } catch (error: any) {
      showToast('Fehler beim Laden der Mitglieder: ' + error.message, 'error');
    }
  };
  
  const loadTeamMembers = async (teamId: string) => {
    try {
      const { data: teamMembersData, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, team_role')
        .eq('team_id', teamId);
      
      if (error) throw error;
      setTeamMembers(teamMembersData || []);
    } catch (error: any) {
      console.error('Error loading team members:', error);
    }
  };

  // ==========================================
  // MODAL HELPERS
  // ==========================================

  const openEditPermissionsModal = async (member: ProjectMember) => {
    console.log('🔍 openEditPermissionsModal called for:', member.accessor.accessor_email);
    
    setEditingMember(member);
    setSelectedRoleId(member.role_id || '');
    setUseCustomPermissions(member.custom_permissions.length > 0);

    const permsObj: Record<string, PermissionModule> = {};
    
    if (member.custom_permissions.length > 0) {
      console.log('📊 Member has custom permissions:', member.custom_permissions.length);
      member.custom_permissions.forEach(perm => { permsObj[perm.module_key] = perm; });
    } else if (member.role_id) {
      console.log('📊 Member has role:', member.role_id);
      const { data: rolePerms } = await supabase
        .from('role_permissions').select('*').eq('role_id', member.role_id);
      (rolePerms || []).forEach(perm => {
        const mod = availableModules.find(m => m.module_key === perm.module_key);
        if (mod) {
          permsObj[perm.module_key] = {
            module_key: perm.module_key, module_name: mod.module_name,
            can_view: perm.can_view, can_create: perm.can_create,
            can_edit: perm.can_edit, can_delete: perm.can_delete
          };
        }
      });
    }

    availableModules.forEach(mod => {
      if (!permsObj[mod.module_key]) {
        permsObj[mod.module_key] = {
          module_key: mod.module_key, module_name: mod.module_name,
          can_view: false, can_create: false, can_edit: false, can_delete: false
        };
      }
    });

    setCustomPermissions(permsObj);
    console.log('✅ Opening edit permissions modal');
    setIsEditPermissionsModalOpen(true);
    setActionMenuMemberId(null);
  };

  // ==========================================
  // CRUD OPERATIONS
  // ==========================================

  const updateMemberPermissions = async () => {
    if (!editingMember) {
      console.log('❌ updateMemberPermissions: No editing member');
      return;
    }
    if (!useCustomPermissions && !selectedRoleId) {
      showToast('Bitte wählen Sie eine Rolle aus', 'error');
      return;
    }
    
    console.log('🔍 updateMemberPermissions: Starting update', {
      member_id: editingMember.id,
      useCustomPermissions,
      selectedRoleId,
      customPermissions: Object.keys(customPermissions).length
    });
    
    try {
      const newRoleId = useCustomPermissions ? null : (selectedRoleId || null);
      
      console.log('📝 Updating project_members table...');
      const { data: updateData, error: updateError } = await supabase.from('project_members')
        .update({ role_id: newRoleId })
        .eq('id', editingMember.id)
        .select();

      console.log('📊 Update result:', { updateData, updateError, rowsAffected: updateData?.length });

      if (updateError) {
        console.error('❌ Error updating project_members:', updateError);
        throw updateError;
      }
      
      if (!updateData || updateData.length === 0) {
        console.error('❌ UPDATE succeeded but affected 0 rows - RLS blocking!');
        throw new Error('Keine Berechtigung, Mitglied zu aktualisieren. Möglicherweise fehlen Berechtigungen.');
      }

      console.log('📝 Deleting old permissions...');
      const { error: deleteError } = await supabase.from('project_member_permissions')
        .delete().eq('project_member_id', editingMember.id);

      if (deleteError) {
        console.error('❌ Error deleting permissions:', deleteError);
        throw deleteError;
      }

      if (useCustomPermissions) {
        const permsToInsert = Object.values(customPermissions)
          .filter(p => p.can_view || p.can_create || p.can_edit || p.can_delete)
          .map(p => ({
            project_member_id: editingMember.id,
            module_key: p.module_key,
            can_view: p.can_view, can_create: p.can_create,
            can_edit: p.can_edit, can_delete: p.can_delete
          }));
        
        console.log('📝 Inserting custom permissions:', permsToInsert.length);
        
        if (permsToInsert.length > 0) {
          const { error: insertError } = await supabase.from('project_member_permissions').insert(permsToInsert);
          if (insertError) {
            console.error('❌ Error inserting permissions:', insertError);
            throw insertError;
          }
        }
      }

      console.log('✅ Permissions updated successfully');
      showToast('Berechtigungen aktualisiert', 'success');
      setIsEditPermissionsModalOpen(false);
      await loadMembers();
    } catch (error: any) {
      console.error('❌ Error in updateMemberPermissions:', error);
      showToast('Fehler: ' + error.message, 'error');
    }
  };

  // ==========================================
  // INVITATION & STATUS MANAGEMENT
  // ==========================================

  const inviteMember = async (member: ProjectMember) => {
    if (!member.accessor?.accessor_email) {
      showToast('Keine E-Mail-Adresse vorhanden', 'error');
      return;
    }
    if (!member.role_id && member.custom_permissions.length === 0) {
      showToast('Bitte zuerst eine Rolle oder Berechtigungen zuweisen', 'error');
      return;
    }

    setInvitingMemberIds(prev => new Set(prev).add(member.id));
    try {
      // Determine if user has a registered account
      const registeredUserId = member.user_id || member.accessor?.registered_user_id;
      const hasAccount = !!registeredUserId;

      console.log('Inviting member:', {
        member_id: member.id,
        user_id: member.user_id,
        accessor_registered_user_id: member.accessor?.registered_user_id,
        registeredUserId,
        hasAccount,
        email: member.accessor.accessor_email,
        projectId
      });

      // Check auth status
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Auth session exists:', !!session);

      // Call send_project_invitation RPC which handles:
      // 1. Updating member status to 'invited'
      // 2. Creating in-app notification (if user has account)
      const { data: inviteResult, error: inviteError } = await supabase
        .rpc('send_project_invitation', {
          p_project_id: projectId,
          p_user_id: registeredUserId || null,
          p_email: member.accessor.accessor_email
        });

      console.log('Invitation result:', { inviteResult, inviteError });

      if (inviteError) throw inviteError;

      if (!inviteResult?.success) {
        throw new Error(inviteResult?.error || 'Fehler beim Senden der Einladung');
      }

      // Show success toast based on RPC result
      if (inviteResult.notification_created) {
        showToast(`Einladung & Benachrichtigung an ${member.accessor.accessor_email} gesendet`, 'success');
      } else {
        showToast(`Einladung für ${member.accessor.accessor_email} vorbereitet (Benutzer hat noch keinen Account)`, 'success');
      }

      loadMembers();
    } catch (error: any) {
      showToast('Fehler: ' + error.message, 'error');
    } finally {
      setInvitingMemberIds(prev => { const n = new Set(prev); n.delete(member.id); return n; });
    }
  };

  const inviteAllOpen = async () => {
    const openWithRole = members.filter(m => m.status === 'open' && (m.role_id || m.custom_permissions.length > 0));
    if (openWithRole.length === 0) {
      showToast('Keine Mitglieder mit zugewiesener Rolle zum Einladen', 'error');
      return;
    }
    for (const member of openWithRole) {
      await inviteMember(member);
    }
  };

  const reInviteMember = async (member: ProjectMember) => {
    setInvitingMemberIds(prev => new Set(prev).add(member.id));
    setActionMenuMemberId(null);
    try {
      // Determine if user has a registered account
      const registeredUserId = member.user_id || member.accessor?.registered_user_id;
      const hasAccount = !!registeredUserId;

      // Call send_project_invitation RPC to create new notification
      const { data: inviteResult, error: inviteError } = await supabase.rpc('send_project_invitation', {
        p_project_id: projectId,
        p_user_id: registeredUserId || null,
        p_email: member.accessor.accessor_email
      });

      if (inviteError) throw inviteError;
      if (!inviteResult?.success) {
        throw new Error(inviteResult?.error || 'Fehler beim Senden der Einladung');
      }

      // Show success toast based on RPC result
      if (inviteResult.notification_created) {
        showToast(`Einladung & Benachrichtigung erneut gesendet`, 'success');
      } else {
        showToast(`Einladung erneut vorbereitet (Benutzer hat noch keinen Account)`, 'success');
      }
      loadMembers();
    } catch (error: any) {
      showToast('Fehler: ' + error.message, 'error');
    } finally {
      setInvitingMemberIds(prev => { const n = new Set(prev); n.delete(member.id); return n; });
    }
  };

  const setMemberInactive = async (member: ProjectMember) => {
    const name = `${member.accessor?.accessor_first_name || ''} ${member.accessor?.accessor_last_name || ''}`.trim();
    if (!confirm(`${name} als inaktiv setzen? Die Person kann das Projekt nicht mehr sehen.`)) return;
    setActionMenuMemberId(null);
    try {
      await supabase.from('project_members').update({ status: 'inactive' }).eq('id', member.id);
      showToast('Mitglied inaktiv gesetzt', 'success');
      loadMembers();
    } catch (error: any) { showToast('Fehler: ' + error.message, 'error'); }
  };

  const reactivateMember = async (member: ProjectMember) => {
    setActionMenuMemberId(null);
    try {
      await supabase.from('project_members').update({ status: 'active' }).eq('id', member.id);
      showToast('Mitglied reaktiviert', 'success');
      loadMembers();
    } catch (error: any) { showToast('Fehler: ' + error.message, 'error'); }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm('Mitglied endgültig entfernen?')) return;
    setActionMenuMemberId(null);
    try {
      await supabase.from('project_member_permissions').delete().eq('project_member_id', memberId);
      await supabase.from('project_members').delete().eq('id', memberId);
      showToast('Mitglied entfernt', 'success');
      loadMembers();
    } catch (error: any) { showToast('Fehler: ' + error.message, 'error'); }
  };

  const addTeamMembersToProject = async () => {
    if (selectedTeamMemberIds.length === 0) {
      showToast('Bitte wählen Sie mindestens ein Teammitglied aus', 'error');
      return;
    }
    
    console.log('🔍 Adding team members to project:', { selectedTeamMemberIds, userTeamId, projectId });
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !userTeamId) {
        console.log('❌ No user or team ID:', { user: !!user, userTeamId });
        return;
      }
      
      // For each selected team member, create user_accessor if not exists, then add to project
      for (const memberId of selectedTeamMemberIds) {
        const teamMember = teamMembers.find(tm => tm.id === memberId);
        if (!teamMember) {
          console.log('❌ Team member not found:', memberId);
          continue;
        }
        
        console.log('➕ Processing team member:', teamMember.email);
        
        // Check if user is already in project
        const { data: existingMember } = await supabase
          .from('project_members')
          .select('id')
          .eq('project_id', projectId)
          .eq('user_id', teamMember.id)
          .maybeSingle();
        
        if (existingMember) {
          console.log('⏭️ Member already in project:', teamMember.email);
          continue; // Skip if already in project
        }
        
        // Check if accessor exists
        let { data: accessor } = await supabase
          .from('user_accessors')
          .select('id')
          .eq('accessor_email', teamMember.email)
          .maybeSingle();
        
        let accessorId;
        
        // Create accessor if doesn't exist
        if (!accessor) {
          console.log('📝 Creating accessor for:', teamMember.email);
          const { data: newAccessor, error: accessorError } = await supabase
            .from('user_accessors')
            .insert({
              owner_id: user.id,
              accessor_email: teamMember.email,
              accessor_first_name: teamMember.first_name,
              accessor_last_name: teamMember.last_name,
              accessor_type: 'employee',
              registered_user_id: teamMember.id,
              is_active: true,
            })
            .select('id')
            .single();
          
          if (accessorError) {
            console.error('❌ Error creating accessor:', accessorError);
            throw accessorError;
          }
          accessorId = newAccessor.id;
          console.log('✅ Accessor created:', accessorId);
        } else {
          accessorId = accessor.id;
          console.log('✅ Accessor exists:', accessorId);
        }
        
        // Add to project_members
        console.log('📝 Adding to project_members...');
        const { error: insertError } = await supabase
          .from('project_members')
          .insert({
            project_id: projectId,
            user_id: teamMember.id,
            accessor_id: accessorId,
            member_type: 'employee',
            member_team_id: userTeamId,
            added_by: user.id,
            status: 'active',
          });
        
        if (insertError) {
          console.error('❌ Error adding to project_members:', insertError);
          throw insertError;
        }
        console.log('✅ Added to project_members');
      }
      
      console.log('✅ All team members added successfully');
      showToast(`${selectedTeamMemberIds.length} Teammitglied(er) zum Projekt hinzugefügt`, 'success');
      setIsAddTeamMemberModalOpen(false);
      setSelectedTeamMemberIds([]);
      await loadMembers();
    } catch (error: any) {
      console.error('❌ Error in addTeamMembersToProject:', error);
      showToast('Fehler beim Hinzufügen: ' + error.message, 'error');
    }
  };

  const togglePermission = (moduleKey: string, permType: 'can_view' | 'can_create' | 'can_edit' | 'can_delete') => {
    setCustomPermissions(prev => {
      const current = prev[moduleKey];
      const updated = { ...current, [permType]: !current[permType] };
      if ((updated.can_create || updated.can_edit || updated.can_delete) && !updated.can_view) {
        updated.can_view = true;
      }
      return { ...prev, [moduleKey]: updated };
    });
  };

  // ==========================================
  // FREIGABEN FUNCTIONS
  // ==========================================

  const updateContentDefault = (moduleKey: string, visibility: VisibilityLevel) => {
    setContentDefaults(prev => prev.map(cd =>
      cd.module_key === moduleKey
        ? { ...cd, default_visibility: visibility }
        : cd
    ));
  };

  const saveContentDefaults = async () => {
    if (!projectId) return;
    setSavingFreigaben(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Upsert all content defaults
      for (const cd of contentDefaults) {
        const { error } = await supabase
          .from('project_content_defaults')
          .upsert({
            project_id: projectId,
            module_key: cd.module_key,
            default_visibility: cd.default_visibility,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'project_id,module_key'
          });

        if (error) throw error;
      }

      showToast('Freigabe-Einstellungen gespeichert', 'success');
      await loadContentDefaults();
    } catch (error: any) {
      console.error('Error saving content defaults:', error);
      showToast('Fehler beim Speichern: ' + error.message, 'error');
    } finally {
      setSavingFreigaben(false);
    }
  };

  const getVisibilityLabel = (visibility: VisibilityLevel): string => {
    switch (visibility) {
      case 'all_participants': return 'Alle Beteiligten';
      case 'team_only': return 'Nur eigenes Team';
      case 'owner_only': return 'Nur Projektersteller';
    }
  };

  const getVisibilityIcon = (visibility: VisibilityLevel) => {
    switch (visibility) {
      case 'all_participants': return <Globe size={16} color="#10B981" />;
      case 'team_only': return <Building2 size={16} color="#F59E0B" />;
      case 'owner_only': return <Lock size={16} color="#EF4444" />;
    }
  };

  const getVisibilityColor = (visibility: VisibilityLevel): string => {
    switch (visibility) {
      case 'all_participants': return '#10B981';
      case 'team_only': return '#F59E0B';
      case 'owner_only': return '#EF4444';
    }
  };

  const getVisibilityDescription = (visibility: VisibilityLevel): string => {
    switch (visibility) {
      case 'all_participants': return 'Alle Projektbeteiligten können die Inhalte dieses Moduls sehen';
      case 'team_only': return 'Nur Mitglieder des eigenen Teams können die Inhalte sehen (andere Teams sehen nur ihre eigenen)';
      case 'owner_only': return 'Nur der Projektersteller und Superuser können die Inhalte sehen';
    }
  };

  // ==========================================
  // HELPERS
  // ==========================================

  const getMemberTypeLabel = (type: string) => {
    const labels: Record<string, string> = { employee: 'Mitarbeiter', owner: 'Bauherr', subcontractor: 'Gewerk', other: 'Sonstiges' };
    return labels[type] || type;
  };
  const getMemberTypeBadgeColor = (type: string) => {
    const c: Record<string, string> = { employee: '#3B82F6', owner: '#10B981', subcontractor: '#F59E0B', other: '#6B7280' };
    return c[type] || '#6B7280';
  };
  const getStatusLabel = (status: string) => {
    const l: Record<string, string> = { open: 'Offen', invited: 'Eingeladen', active: 'Aktiv', inactive: 'Inaktiv' };
    return l[status] || status;
  };
  const getStatusColor = (status: string) => {
    const c: Record<string, string> = { open: '#94A3B8', invited: '#F59E0B', active: '#10B981', inactive: '#EF4444' };
    return c[status] || '#6B7280';
  };
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <UserPlus size={14} color="#94A3B8" />;
      case 'invited': return <Mail size={14} color="#F59E0B" />;
      case 'active': return <UserCheck size={14} color="#10B981" />;
      case 'inactive': return <UserX size={14} color="#EF4444" />;
      default: return null;
    }
  };
  const getPermissionsSummary = (member: ProjectMember) => {
    if (member.role) return `Rolle: ${member.role.role_name}`;
    if (member.custom_permissions.length > 0) {
      const v = member.custom_permissions.filter(p => p.can_view).length;
      const e = member.custom_permissions.filter(p => p.can_edit || p.can_delete).length;
      return `${v} Module (${e} bearbeitbar)`;
    }
    return 'Keine Rolle zugewiesen';
  };

  const filteredMembers = statusFilter === 'all' ? members : members.filter(m => m.status === statusFilter);
  const statusCounts = {
    all: members.length,
    open: members.filter(m => m.status === 'open').length,
    invited: members.filter(m => m.status === 'invited').length,
    active: members.filter(m => m.status === 'active').length,
    inactive: members.filter(m => m.status === 'inactive').length,
  };

  // ==========================================
  // RENDER
  // ==========================================

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isProjectOwner && !hasTeamAccess) {
    return (
      <View style={styles.container}>
        <Card style={styles.noAccessCard}>
          <Shield size={48} color="#CBD5E1" />
          <Text style={styles.noAccessTitle}>Kein Zugriff</Text>
          <Text style={styles.noAccessText}>
            {isTeamAdmin 
              ? 'Ihr Team hat keinen Zugriff auf dieses Projekt. Kontaktieren Sie den Projektbesitzer.'
              : 'Sie haben keine Berechtigung, Projektmitglieder zu verwalten.'}
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Beteiligte</Text>
            <Text style={styles.pageSubtitle}>Projektmitglieder, Rollen und Einladungen verwalten</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {activeTab === 'members' && isTeamAdmin && hasTeamAccess && (
              <Button onClick={() => setIsAddTeamMemberModalOpen(true)} variant="primary">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <UsersRound size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                    Team-Mitglieder hinzufügen
                  </Text>
                </View>
              </Button>
            )}
            {activeTab === 'members' && isProjectOwner && statusCounts.open > 0 && (
              <Button onClick={inviteAllOpen} variant="secondary">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Send size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>
                    Alle einladen ({statusCounts.open})
                  </Text>
                </View>
              </Button>
            )}
            {activeTab === 'members' && isProjectOwner && (
              <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F1F5F9', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ fontSize: 12, color: '#64748B' }}>
                  💡 Mitglieder hinzufügen unter: Projekt → Einstellungen → Beteiligte Personen
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ===== TOP-LEVEL TABS ===== */}
        <View style={styles.topTabs}>
          <TouchableOpacity
            style={[styles.topTab, activeTab === 'members' && styles.topTabActive]}
            onPress={() => setActiveTab('members')}
          >
            <Users size={18} color={activeTab === 'members' ? colors.primary : '#64748B'} />
            <Text style={[styles.topTabText, activeTab === 'members' && styles.topTabTextActive]}>
              Mitglieder
            </Text>
          </TouchableOpacity>
          {(isProjectOwner || isSuperuser) && (
            <TouchableOpacity
              style={[styles.topTab, activeTab === 'freigaben' && styles.topTabActive]}
              onPress={() => setActiveTab('freigaben')}
            >
              <Share2 size={18} color={activeTab === 'freigaben' ? colors.primary : '#64748B'} />
              <Text style={[styles.topTabText, activeTab === 'freigaben' && styles.topTabTextActive]}>
                Freigaben
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ===== MEMBERS TAB ===== */}
        {activeTab === 'members' && (
          <View>
        <View style={styles.filterTabs}>
          {([
            { key: 'all', label: 'Alle' },
            { key: 'open', label: 'Offen' },
            { key: 'invited', label: 'Eingeladen' },
            { key: 'active', label: 'Aktiv' },
            { key: 'inactive', label: 'Inaktiv' },
          ] as const).map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterTab, statusFilter === tab.key && styles.filterTabActive]}
              onPress={() => setStatusFilter(tab.key)}
            >
              <Text style={[styles.filterTabText, statusFilter === tab.key && styles.filterTabTextActive]}>
                {tab.label}
              </Text>
              {statusCounts[tab.key] > 0 && (
                <View style={[styles.filterBadge, statusFilter === tab.key && styles.filterBadgeActive]}>
                  <Text style={[styles.filterBadgeText, statusFilter === tab.key && styles.filterBadgeTextActive]}>
                    {statusCounts[tab.key]}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Member List */}
        {filteredMembers.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Users size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>
              {statusFilter === 'all' ? 'Keine Mitglieder' : `Keine "${getStatusLabel(statusFilter)}" Mitglieder`}
            </Text>
            <Text style={styles.emptyText}>
              {statusFilter === 'all'
                ? 'Keine Mitglieder im Projekt. Fügen Sie Mitglieder unter Projekt → Einstellungen → Beteiligte Personen hinzu.'
                : 'Wechseln Sie den Filter um andere Mitglieder zu sehen.'}
            </Text>
          </Card>
        ) : (
          <View style={styles.membersList}>
            {filteredMembers.map(member => {
              const sColor = getStatusColor(member.status);
              const isInviting = invitingMemberIds.has(member.id);
              const showMenu = actionMenuMemberId === member.id;
              const hasPerms = !!member.role_id || member.custom_permissions.length > 0;

              return (
                <Card key={member.id} style={[styles.memberCard, member.status === 'inactive' && { opacity: 0.6 }, showMenu && { zIndex: 101 }]}>
                  <View style={styles.memberHeader}>
                    {/* Avatar */}
                    <View style={[styles.memberAvatar, { borderColor: sColor, borderWidth: 2 }]}>
                      <Text style={styles.memberAvatarText}>
                        {(member.accessor?.accessor_first_name?.[0] || member.accessor?.accessor_email?.[0] || 'U').toUpperCase()}
                      </Text>
                    </View>

                    {/* Info */}
                    <View style={styles.memberInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={styles.memberName}>
                          {member.accessor?.accessor_first_name && member.accessor?.accessor_last_name
                            ? `${member.accessor.accessor_first_name} ${member.accessor.accessor_last_name}`
                            : member.accessor?.accessor_email}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: `${sColor}15`, borderColor: `${sColor}30` }]}>
                          {getStatusIcon(member.status)}
                          <Text style={[styles.statusBadgeText, { color: sColor }]}>
                            {getStatusLabel(member.status)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.memberMeta}>
                        <Mail size={12} color="#94a3b8" />
                        <Text style={styles.memberEmail}>{member.accessor?.accessor_email}</Text>
                      </View>
                      {member.accessor?.accessor_company && (
                        <View style={styles.memberMeta}>
                          <Building size={12} color="#94a3b8" />
                          <Text style={styles.memberCompany}>{member.accessor.accessor_company}</Text>
                        </View>
                      )}
                    </View>

                    {/* Actions */}
                    <View style={styles.memberActions}>
                      <View style={[styles.typeBadge, { backgroundColor: getMemberTypeBadgeColor(member.member_type) }]}>
                        <Text style={styles.typeBadgeText}>{getMemberTypeLabel(member.member_type)}</Text>
                      </View>

                      {/* Invite button for open members with permissions */}
                      {member.status === 'open' && hasPerms && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.inviteButton]}
                          onPress={() => inviteMember(member)}
                          disabled={isInviting}
                        >
                          {isInviting
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <><Send size={14} color="#fff" /><Text style={styles.inviteButtonText}>Einladen</Text></>
                          }
                        </TouchableOpacity>
                      )}

                      {/* Re-invite for invited members */}
                      {member.status === 'invited' && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.reInviteButton]}
                          onPress={() => reInviteMember(member)}
                          disabled={isInviting}
                        >
                          {isInviting
                            ? <ActivityIndicator size="small" color={colors.primary} />
                            : <><RefreshCw size={14} color={colors.primary} /><Text style={styles.reInviteButtonText}>Erneut</Text></>
                          }
                        </TouchableOpacity>
                      )}

                      {/* More Actions */}
                      <View style={{ position: 'relative' }}>
                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={() => {
                            console.log('Menu clicked, current:', actionMenuMemberId, 'member:', member.id);
                            setActionMenuMemberId(showMenu ? null : member.id);
                          }}
                        >
                          <MoreVertical size={16} color="#64748b" />
                        </TouchableOpacity>

                        {showMenu && (
                          <>
                            <View 
                              style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 998,
                              }}
                              onTouchEnd={() => setActionMenuMemberId(null)}
                              onClick={() => setActionMenuMemberId(null)}
                            />
                            <View style={[styles.actionMenu, { zIndex: 999 }]}>
                              <TouchableOpacity style={styles.actionMenuItem} onPress={() => {
                                console.log('Edit permissions menu item clicked');
                                openEditPermissionsModal(member);
                              }}>
                                <Shield size={14} color="#64748b" />
                                <Text style={styles.actionMenuText}>Berechtigungen bearbeiten</Text>
                              </TouchableOpacity>

                              {member.status === 'active' && (
                                <TouchableOpacity style={styles.actionMenuItem} onPress={() => setMemberInactive(member)}>
                                  <UserX size={14} color="#F59E0B" />
                                  <Text style={[styles.actionMenuText, { color: '#F59E0B' }]}>Inaktiv setzen</Text>
                                </TouchableOpacity>
                              )}

                              {member.status === 'inactive' && (
                                <TouchableOpacity style={styles.actionMenuItem} onPress={() => reactivateMember(member)}>
                                  <UserCheck size={14} color="#10B981" />
                                  <Text style={[styles.actionMenuText, { color: '#10B981' }]}>Reaktivieren</Text>
                                </TouchableOpacity>
                              )}

                              {(member.status === 'invited' || member.status === 'active') && (
                                <TouchableOpacity style={styles.actionMenuItem} onPress={() => reInviteMember(member)}>
                                  <RefreshCw size={14} color="#64748b" />
                                  <Text style={styles.actionMenuText}>Einladung erneut senden</Text>
                                </TouchableOpacity>
                              )}

                              <TouchableOpacity
                                style={[styles.actionMenuItem, { borderTopWidth: 1, borderTopColor: '#F1F5F9' }]}
                                onPress={() => removeMember(member.id)}
                              >
                                <Trash2 size={14} color="#EF4444" />
                                <Text style={[styles.actionMenuText, { color: '#EF4444' }]}>Entfernen</Text>
                              </TouchableOpacity>
                            </View>
                          </>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Permissions & Dates */}
                  <View style={styles.memberPermissions}>
                    <Shield size={14} color={hasPerms ? '#64748b' : '#EF4444'} />
                    <Text style={[styles.permissionsSummary, !hasPerms && { color: '#EF4444', fontWeight: '600' }]}>
                      {getPermissionsSummary(member)}
                    </Text>
                    {member.invited_at && (
                      <Text style={styles.dateText}>
                        Eingeladen: {new Date(member.invited_at).toLocaleDateString('de-DE')}
                      </Text>
                    )}
                    {member.accepted_at && (
                      <Text style={styles.dateText}>
                        Akzeptiert: {new Date(member.accepted_at).toLocaleDateString('de-DE')}
                      </Text>
                    )}
                  </View>

                  {/* Warning if open but no role */}
                  {member.status === 'open' && !hasPerms && (
                    <View style={styles.warningBar}>
                      <Text style={styles.warningText}>⚠️ Bitte Rolle zuweisen bevor Sie einladen</Text>
                      <TouchableOpacity onPress={() => openEditPermissionsModal(member)}>
                        <Text style={styles.warningLink}>Rolle zuweisen →</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        )}
          </View>
        )}

        {/* ===== FREIGABEN TAB ===== */}
        {activeTab === 'freigaben' && (isProjectOwner || isSuperuser) && (
          <View>
            {/* Info banner */}
            <Card style={{ padding: 16, marginBottom: 20, borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <Info size={20} color="#2563EB" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E40AF', marginBottom: 4 }}>
                    Sichtbarkeits-Einstellungen
                  </Text>
                  <Text style={{ fontSize: 13, color: '#1E40AF', lineHeight: 20 }}>
                    Definieren Sie hier die Standard-Sichtbarkeit für jedes Modul im Projekt. Diese Einstellung bestimmt, 
                    ob Inhalte für alle Projektbeteiligten oder nur für das eigene Team sichtbar sind.{'\n\n'}
                    Einzelne Inhalte (z.B. Aufgaben, Mängel) können von ihren Erstellern zusätzlich individuell freigegeben werden.
                  </Text>
                </View>
              </View>
            </Card>

            {/* Teams overview */}
            {teams.length > 0 && (
              <Card style={{ padding: 16, marginBottom: 20, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 12 }}>
                  Teams in diesem Projekt
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {teams.map(team => (
                    <View key={team.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F1F5F9', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
                      <Building2 size={14} color="#64748B" />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>{team.name}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            )}

            {/* Module visibility settings */}
            <View style={{ gap: 12 }}>
              {contentDefaults.map(cd => {
                const vColor = getVisibilityColor(cd.default_visibility);
                return (
                  <Card key={cd.module_key} style={{ padding: 0, borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' }}>
                    <View style={{ padding: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${vColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                            {getVisibilityIcon(cd.default_visibility)}
                          </View>
                          <View>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a' }}>{cd.module_name}</Text>
                            <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{cd.module_key}</Text>
                          </View>
                        </View>
                        {cd.has_custom_default && (
                          <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#F0FDF4', borderRadius: 6, borderWidth: 1, borderColor: '#BBF7D0' }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#16A34A' }}>ANGEPASST</Text>
                          </View>
                        )}
                      </View>

                      {/* Visibility options */}
                      <View style={{ gap: 8 }}>
                        {([
                          { value: 'all_participants' as VisibilityLevel, label: 'Alle Beteiligten', desc: 'Alle Projektmitglieder können die Inhalte sehen', icon: <Globe size={16} color="#10B981" />, color: '#10B981' },
                          { value: 'team_only' as VisibilityLevel, label: 'Nur eigenes Team', desc: 'Jedes Team sieht nur seine eigenen Inhalte', icon: <Building2 size={16} color="#F59E0B" />, color: '#F59E0B' },
                          { value: 'owner_only' as VisibilityLevel, label: 'Nur Projektersteller', desc: 'Nur Projektersteller & Superuser können sehen', icon: <Lock size={16} color="#EF4444" />, color: '#EF4444' },
                        ]).map(opt => {
                          const isSelected = cd.default_visibility === opt.value;
                          return (
                            <TouchableOpacity
                              key={opt.value}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 12,
                                padding: 12,
                                borderRadius: 10,
                                borderWidth: 2,
                                borderColor: isSelected ? opt.color : '#E2E8F0',
                                backgroundColor: isSelected ? `${opt.color}08` : '#FAFAFA',
                              }}
                              onPress={() => updateContentDefault(cd.module_key, opt.value)}
                            >
                              <View style={{
                                width: 22, height: 22, borderRadius: 11,
                                borderWidth: 2, borderColor: isSelected ? opt.color : '#CBD5E1',
                                backgroundColor: isSelected ? opt.color : '#fff',
                                alignItems: 'center', justifyContent: 'center',
                              }}>
                                {isSelected && <Check size={12} color="#fff" />}
                              </View>
                              {opt.icon}
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: isSelected ? opt.color : '#334155' }}>
                                  {opt.label}
                                </Text>
                                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                                  {opt.desc}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>

            {/* Save button */}
            <View style={{ marginTop: 24, marginBottom: 40, flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Button onClick={saveContentDefaults} variant="primary" disabled={savingFreigaben}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {savingFreigaben ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Check size={16} color="#fff" />
                  )}
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                    {savingFreigaben ? 'Wird gespeichert...' : 'Freigaben speichern'}
                  </Text>
                </View>
              </Button>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ======================== EDIT PERMISSIONS MODAL ======================== */}
      <ModernModal
        visible={isEditPermissionsModalOpen}
        onClose={() => setIsEditPermissionsModalOpen(false)}
        title="Berechtigungen bearbeiten"
      >
        <View style={styles.modalContent}>
          {editingMember && (
            <View style={styles.editingInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.editingName}>
                  {editingMember.accessor?.accessor_first_name && editingMember.accessor?.accessor_last_name
                    ? `${editingMember.accessor.accessor_first_name} ${editingMember.accessor.accessor_last_name}`
                    : editingMember.accessor?.accessor_email}
                </Text>
                <View style={[styles.statusBadge, {
                  backgroundColor: `${getStatusColor(editingMember.status)}15`,
                  borderColor: `${getStatusColor(editingMember.status)}30`
                }]}>
                  <Text style={[styles.statusBadgeText, { color: getStatusColor(editingMember.status) }]}>
                    {getStatusLabel(editingMember.status)}
                  </Text>
                </View>
              </View>
              <Text style={styles.editingEmail}>{editingMember.accessor?.accessor_email}</Text>
            </View>
          )}

          <View style={styles.permissionModeSelector}>
            <TouchableOpacity
              style={[styles.modeOption, !useCustomPermissions && styles.modeOptionActive]}
              onPress={() => setUseCustomPermissions(false)}
            >
              <Shield size={20} color={!useCustomPermissions ? colors.primary : '#64748b'} />
              <View style={styles.modeOptionText}>
                <Text style={[styles.modeOptionTitle, !useCustomPermissions && styles.modeOptionTitleActive]}>Vordefinierte Rolle</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeOption, useCustomPermissions && styles.modeOptionActive]}
              onPress={() => setUseCustomPermissions(true)}
            >
              <Edit2 size={20} color={useCustomPermissions ? colors.primary : '#64748b'} />
              <View style={styles.modeOptionText}>
                <Text style={[styles.modeOptionTitle, useCustomPermissions && styles.modeOptionTitleActive]}>Individuelle Berechtigungen</Text>
              </View>
            </TouchableOpacity>
          </View>

          {!useCustomPermissions ? (
            <View style={styles.formGroup}>
              <SearchableSelect
                label="Rolle auswählen *"
                placeholder="Rolle wählen..."
                options={availableRoles.map(r => ({
                  label: r.role_name,
                  value: r.id,
                  subtitle: r.role_description || undefined
                }))}
                values={selectedRoleId ? [selectedRoleId] : []}
                onChange={(values) => setSelectedRoleId(values[0] || '')}
                multi={false}
              />
              {availableRoles.length === 0 && (
                <View style={{ padding: 12, backgroundColor: '#FEF3C7', borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A', marginTop: 8 }}>
                  <Text style={{ fontSize: 13, color: '#92400E', marginBottom: 6, fontWeight: '600' }}>
                    ⚠️ Keine Rollen für dieses Projekt verfügbar
                  </Text>
                  <Text style={{ fontSize: 12, color: '#92400E' }}>
                    Der Projektersteller muss zuerst auf der Projektverwaltungsseite unter "Projektrollen" Rollen für dieses Projekt definieren.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.permissionsSection}>
              <Text style={styles.permsSectionTitle}>Berechtigungen definieren</Text>
              <ScrollView style={styles.permsList} showsVerticalScrollIndicator={false}>
                {availableModules.map(mod => {
                  const p = customPermissions[mod.module_key];
                  return (
                    <View key={mod.module_key} style={styles.permItem}>
                      <Text style={styles.permName}>{mod.module_name}</Text>
                      <View style={styles.permToggles}>
                        <TouchableOpacity
                          style={[styles.permToggle, p?.can_view && styles.permToggleActive]}
                          onPress={() => togglePermission(mod.module_key, 'can_view')}
                        >
                          <Eye size={12} color={p?.can_view ? '#fff' : '#64748b'} />
                          <Text style={[styles.permToggleText, p?.can_view && styles.permToggleTextActive]}>Sehen</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.permToggle, p?.can_create && styles.permToggleActive]}
                          onPress={() => togglePermission(mod.module_key, 'can_create')}
                        >
                          <Plus size={12} color={p?.can_create ? '#fff' : '#64748b'} />
                          <Text style={[styles.permToggleText, p?.can_create && styles.permToggleTextActive]}>Erstellen</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.permToggle, p?.can_edit && styles.permToggleActive]}
                          onPress={() => togglePermission(mod.module_key, 'can_edit')}
                        >
                          <Edit2 size={12} color={p?.can_edit ? '#fff' : '#64748b'} />
                          <Text style={[styles.permToggleText, p?.can_edit && styles.permToggleTextActive]}>Bearbeiten</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.permToggle, p?.can_delete && styles.permToggleActive]}
                          onPress={() => togglePermission(mod.module_key, 'can_delete')}
                        >
                          <Trash2 size={12} color={p?.can_delete ? '#fff' : '#64748b'} />
                          <Text style={[styles.permToggleText, p?.can_delete && styles.permToggleTextActive]}>Löschen</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={styles.modalActions}>
            <Button onClick={() => setIsEditPermissionsModalOpen(false)} variant="secondary">Abbrechen</Button>
            <Button onClick={updateMemberPermissions} variant="primary">Speichern</Button>
          </View>
        </View>
      </ModernModal>

      {/* Add Team Members Modal */}
      <ModernModal
        visible={isAddTeamMemberModalOpen}
        onClose={() => setIsAddTeamMemberModalOpen(false)}
        title="Team-Mitglieder zum Projekt hinzufügen"
      >
        <View style={{ gap: 20 }}>
          <View style={{ padding: 16, backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE' }}>
            <Text style={{ fontSize: 13, color: '#1E40AF', lineHeight: 20 }}>
              ℹ️ Sie können Ihre Team-Mitglieder zu diesem Projekt hinzufügen. Sie erscheinen dann in der Mitgliederliste und können am Projekt arbeiten.
            </Text>
          </View>
          
          <View style={{ gap: 12 }}>
            {teamMembers.length === 0 ? (
              <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', paddingVertical: 20 }}>
                Keine Team-Mitglieder verfügbar. Fügen Sie zuerst Mitglieder über "Mein Team" hinzu.
              </Text>
            ) : (
              teamMembers.map(member => {
                const isSelected = selectedTeamMemberIds.includes(member.id);
                // Check if already in project
                const alreadyInProject = members.some(m => m.user_id === member.id);
                
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      backgroundColor: isSelected ? '#EFF6FF' : '#F8FAFC',
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: isSelected ? colors.primary : '#E2E8F0',
                      opacity: alreadyInProject ? 0.5 : 1,
                    }}
                    onPress={() => {
                      if (alreadyInProject) return;
                      setSelectedTeamMemberIds(prev =>
                        isSelected
                          ? prev.filter(id => id !== member.id)
                          : [...prev, member.id]
                      );
                    }}
                    disabled={alreadyInProject}
                  >
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
                        {(member.first_name?.[0] || member.email[0]).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#0f172a' }}>
                        {member.first_name && member.last_name
                          ? `${member.first_name} ${member.last_name}`
                          : member.email}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#64748b' }}>{member.email}</Text>
                      {alreadyInProject && (
                        <Text style={{ fontSize: 11, color: '#10B981', marginTop: 2 }}>
                          ✓ Bereits im Projekt
                        </Text>
                      )}
                    </View>
                    {member.team_role === 'team_admin' && (
                      <View style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        backgroundColor: '#FEF3C7',
                        borderRadius: 6,
                        marginRight: 8,
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#D97706' }}>
                          Admin
                        </Text>
                      </View>
                    )}
                    {!alreadyInProject && (
                      <View style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: isSelected ? colors.primary : '#CBD5E1',
                        backgroundColor: isSelected ? colors.primary : '#fff',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {isSelected && <Check size={14} color="#fff" />}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
          
          {selectedTeamMemberIds.length > 0 && (
            <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
              {selectedTeamMemberIds.length} Mitglied{selectedTeamMemberIds.length !== 1 ? 'er' : ''} ausgewählt
            </Text>
          )}
          
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button onClick={() => setIsAddTeamMemberModalOpen(false)} variant="secondary" style={{ flex: 1 }}>
              Abbrechen
            </Button>
            <Button 
              onClick={addTeamMembersToProject} 
              variant="primary" 
              style={{ flex: 1 }}
              disabled={selectedTeamMemberIds.length === 0}
            >
              {selectedTeamMemberIds.length > 0 
                ? `${selectedTeamMemberIds.length} hinzufügen`
                : 'Hinzufügen'
              }
            </Button>
          </View>
        </View>
      </ModernModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 4, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 15, color: '#64748b' },
  
  // Top tabs (Mitglieder / Freigaben)
  topTabs: {
    flexDirection: 'row', gap: 4, marginBottom: 20,
    borderBottomWidth: 2, borderBottomColor: '#E2E8F0',
    paddingBottom: 0,
  },
  topTab: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 20,
    borderBottomWidth: 3, borderBottomColor: 'transparent',
    marginBottom: -2,
  },
  topTabActive: {
    borderBottomColor: colors.primary,
  },
  topTabText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  topTabTextActive: { color: colors.primary },

  // Filter tabs
  filterTabs: { flexDirection: 'row', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
  filterTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 10, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E2E8F0'
  },
  filterTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterTabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  filterTabTextActive: { color: '#fff' },
  filterBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6
  },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  filterBadgeText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  filterBadgeTextActive: { color: '#fff' },

  // Empty / no access
  noAccessCard: { padding: 48, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', margin: 24 },
  noAccessTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginTop: 16, marginBottom: 8 },
  noAccessText: { fontSize: 15, color: '#64748b', textAlign: 'center' },
  emptyCard: { padding: 48, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 22 },

  // Member list
  membersList: { gap: 12 },
  memberCard: { padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', position: 'relative' },
  memberHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 12 },
  memberAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 18, fontWeight: '700', color: colors.primary },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  memberMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  memberEmail: { fontSize: 13, color: '#64748b' },
  memberCompany: { fontSize: 13, color: '#94a3b8' },
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },

  // Status badge
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  // Type badge
  typeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'uppercase' },

  // Action buttons
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  inviteButton: { backgroundColor: colors.primary },
  inviteButtonText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  reInviteButton: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: colors.primary },
  reInviteButtonText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  iconButton: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },

  // Action menu
  actionMenu: {
    position: 'absolute', top: 36, right: 0,
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12,
    minWidth: 240, zIndex: 1000, overflow: 'hidden',
    elevation: 10
  },
  actionMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  actionMenuText: { fontSize: 13, fontWeight: '500', color: '#334155' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 900, backgroundColor: 'transparent' },

  // Permissions row
  memberPermissions: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', flexWrap: 'wrap'
  },
  permissionsSummary: { fontSize: 13, color: '#64748b' },
  dateText: { fontSize: 11, color: '#94A3B8', marginLeft: 'auto' },

  // Warning bar
  warningBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFBEB', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 8,
    borderWidth: 1, borderColor: '#FDE68A'
  },
  warningText: { fontSize: 12, color: '#92400E' },
  warningLink: { fontSize: 12, fontWeight: '700', color: colors.primary },

  // Modal
  modalContent: { gap: 20 },
  formGroup: { gap: 8 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#475569' },
  selectWrapper: { position: 'relative' },
  nativeSelect: { width: '100%', padding: 12, fontSize: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff', color: '#0f172a' },
  helperText: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  permissionModeSelector: { gap: 12 },
  modeOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  modeOptionActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  modeOptionText: { flex: 1 },
  modeOptionTitle: { fontSize: 14, fontWeight: '700', color: '#475569', marginBottom: 2 },
  modeOptionTitleActive: { color: colors.primary },
  modeOptionDesc: { fontSize: 12, color: '#64748b' },
  permissionsSection: { marginTop: 8 },
  permsSectionTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  permsList: { maxHeight: 300 },
  permItem: { flexDirection: 'column', gap: 8, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  permName: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  permToggles: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  permToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  permToggleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  permToggleText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  permToggleTextActive: { color: '#fff' },
  editingInfo: { padding: 16, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  editingName: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  editingEmail: { fontSize: 13, color: '#64748b', marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 }
});
