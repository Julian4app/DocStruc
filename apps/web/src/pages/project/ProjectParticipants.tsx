import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { SearchableSelect } from '../../components/SearchableSelect';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { ModernModal } from '../../components/ModernModal';
import { useToast } from '../../components/ToastProvider';
import { 
  Users, Plus, Trash2, Edit2, Shield, Eye, Check, Mail, Building, 
  Phone, UserPlus, Send, UserX, UserCheck, RefreshCw, MoreVertical 
} from 'lucide-react';

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
  
  // Data states
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [availableModules, setAvailableModules] = useState<PermissionModule[]>([]);
  
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

    } catch (error: any) {
      showToast('Fehler beim Laden: ' + error.message, 'error');
    } finally {
      setLoading(false);
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

  // ==========================================
  // MODAL HELPERS
  // ==========================================

  const openEditPermissionsModal = async (member: ProjectMember) => {
    setEditingMember(member);
    setSelectedRoleId(member.role_id || '');
    setUseCustomPermissions(member.custom_permissions.length > 0);

    const permsObj: Record<string, PermissionModule> = {};
    
    if (member.custom_permissions.length > 0) {
      member.custom_permissions.forEach(perm => { permsObj[perm.module_key] = perm; });
    } else if (member.role_id) {
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
    setIsEditPermissionsModalOpen(true);
    setActionMenuMemberId(null);
  };

  // ==========================================
  // CRUD OPERATIONS
  // ==========================================

  const updateMemberPermissions = async () => {
    if (!editingMember) return;
    if (!useCustomPermissions && !selectedRoleId) {
      showToast('Bitte wählen Sie eine Rolle aus', 'error');
      return;
    }
    try {
      const newRoleId = useCustomPermissions ? null : (selectedRoleId || null);
      await supabase.from('project_members')
        .update({ role_id: newRoleId })
        .eq('id', editingMember.id);

      await supabase.from('project_member_permissions')
        .delete().eq('project_member_id', editingMember.id);

      if (useCustomPermissions) {
        const permsToInsert = Object.values(customPermissions)
          .filter(p => p.can_view || p.can_create || p.can_edit || p.can_delete)
          .map(p => ({
            project_member_id: editingMember.id,
            module_key: p.module_key,
            can_view: p.can_view, can_create: p.can_create,
            can_edit: p.can_edit, can_delete: p.can_delete
          }));
        if (permsToInsert.length > 0) {
          await supabase.from('project_member_permissions').insert(permsToInsert);
        }
      }

      showToast('Berechtigungen aktualisiert', 'success');
      setIsEditPermissionsModalOpen(false);
      loadMembers();
    } catch (error: any) {
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

  if (!isProjectOwner) {
    return (
      <View style={styles.container}>
        <Card style={styles.noAccessCard}>
          <Shield size={48} color="#CBD5E1" />
          <Text style={styles.noAccessTitle}>Kein Zugriff</Text>
          <Text style={styles.noAccessText}>
            Sie haben keine Berechtigung, Projektmitglieder zu verwalten.
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
            {statusCounts.open > 0 && (
              <Button onClick={inviteAllOpen} variant="secondary">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Send size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>
                    Alle einladen ({statusCounts.open})
                  </Text>
                </View>
              </Button>
            )}
            <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F1F5F9', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 12, color: '#64748B' }}>
                💡 Mitglieder hinzufügen unter: Projekt → Einstellungen → Beteiligte Personen
              </Text>
            </View>
          </View>
        </View>

        {/* Status Filter Tabs */}
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
                      <View style={{ position: 'relative', zIndex: showMenu ? 100 : 1 }}>
                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={() => setActionMenuMemberId(showMenu ? null : member.id)}
                        >
                          <MoreVertical size={16} color="#64748b" />
                        </TouchableOpacity>

                        {showMenu && (
                          <View style={styles.actionMenu}>
                            <TouchableOpacity style={styles.actionMenuItem} onPress={() => openEditPermissionsModal(member)}>
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
      </ScrollView>

      {/* Backdrop to close action menu */}
      {actionMenuMemberId && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setActionMenuMemberId(null)}
        />
      )}

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
  memberCard: { padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
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
    minWidth: 240, zIndex: 100, overflow: 'hidden'
  },
  actionMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  actionMenuText: { fontSize: 13, fontWeight: '500', color: '#334155' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },

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
