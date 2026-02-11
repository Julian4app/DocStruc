import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { ModernModal } from '../../components/ModernModal';
import { useToast } from '../../components/ToastProvider';
import { Users, Plus, Trash2, Edit2, Shield, Eye, Check, Mail, Building, Phone, UserPlus } from 'lucide-react';

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
  const [availableAccessors, setAvailableAccessors] = useState<UserAccessor[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [availableModules, setAvailableModules] = useState<PermissionModule[]>([]);
  
  // Modal states
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isEditPermissionsModalOpen, setIsEditPermissionsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<ProjectMember | null>(null);
  
  // Add member form
  const [selectedAccessorId, setSelectedAccessorId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [useCustomPermissions, setUseCustomPermissions] = useState(false);
  const [customPermissions, setCustomPermissions] = useState<Record<string, PermissionModule>>({});

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
        .select('created_by')
        .eq('id', projectId)
        .single();

      setIsProjectOwner(project?.created_by === user.id);

      // Load project members
      await loadMembers();
      
      // Load available accessors (users I can add)
      const { data: accessorsData, error: accessorsError } = await supabase
        .from('user_accessors')
        .select('*')
        .eq('owner_id', user.id)
        .eq('is_active', true);

      if (accessorsError) throw accessorsError;
      setAvailableAccessors(accessorsData || []);

      // Load available roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('id, role_name, role_description')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (rolesError) throw rolesError;
      setAvailableRoles(rolesData || []);

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
            .select(`
              module_key,
              can_view,
              can_create,
              can_edit,
              can_delete
            `)
            .eq('project_member_id', member.id);

          return {
            ...member,
            custom_permissions: permsData || []
          };
        })
      );

      setMembers(membersWithPermissions);
    } catch (error: any) {
      showToast('Fehler beim Laden der Mitglieder: ' + error.message, 'error');
    }
  };

  const openAddMemberModal = () => {
    setSelectedAccessorId('');
    setSelectedRoleId('');
    setUseCustomPermissions(false);
    
    // Initialize custom permissions with all modules set to false
    const permsObj: Record<string, PermissionModule> = {};
    availableModules.forEach(module => {
      permsObj[module.module_key] = {
        module_key: module.module_key,
        module_name: module.module_name,
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false
      };
    });
    setCustomPermissions(permsObj);
    
    setIsAddMemberModalOpen(true);
  };

  const openEditPermissionsModal = async (member: ProjectMember) => {
    setEditingMember(member);
    setSelectedRoleId(member.role_id || '');
    setUseCustomPermissions(member.custom_permissions.length > 0);

    // If member has role, load role permissions
    const permsObj: Record<string, PermissionModule> = {};
    
    if (member.custom_permissions.length > 0) {
      // Load custom permissions
      member.custom_permissions.forEach(perm => {
        permsObj[perm.module_key] = perm;
      });
    } else if (member.role_id) {
      // Load role permissions
      const { data: rolePerms } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role_id', member.role_id);

      (rolePerms || []).forEach(perm => {
        const module = availableModules.find(m => m.module_key === perm.module_key);
        if (module) {
          permsObj[perm.module_key] = {
            module_key: perm.module_key,
            module_name: module.module_name,
            can_view: perm.can_view,
            can_create: perm.can_create,
            can_edit: perm.can_edit,
            can_delete: perm.can_delete
          };
        }
      });
    }

    // Fill missing modules with false
    availableModules.forEach(module => {
      if (!permsObj[module.module_key]) {
        permsObj[module.module_key] = {
          module_key: module.module_key,
          module_name: module.module_name,
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false
        };
      }
    });

    setCustomPermissions(permsObj);
    setIsEditPermissionsModalOpen(true);
  };

  const addMember = async () => {
    if (!selectedAccessorId) {
      showToast('Bitte wählen Sie einen Zugreifer aus', 'error');
      return;
    }

    if (!useCustomPermissions && !selectedRoleId) {
      showToast('Bitte wählen Sie eine Rolle oder aktivieren Sie individuelle Berechtigungen', 'error');
      return;
    }

    try {
      const accessor = availableAccessors.find(a => a.id === selectedAccessorId);
      if (!accessor) return;

      // Create project member
      const { data: newMember, error: memberError } = await supabase
        .from('project_members')
        .insert({
          project_id: projectId,
          user_id: accessor.registered_user_id || null,
          accessor_id: selectedAccessorId,
          member_type: accessor.accessor_type,
          role_id: useCustomPermissions ? null : selectedRoleId,
          role: 'member'
        })
        .select()
        .single();

      if (memberError) throw memberError;

      // If custom permissions, create them
      if (useCustomPermissions) {
        const permissionsToInsert = Object.values(customPermissions).filter(
          perm => perm.can_view || perm.can_create || perm.can_edit || perm.can_delete
        ).map(perm => ({
          project_member_id: newMember.id,
          module_key: perm.module_key,
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_edit: perm.can_edit,
          can_delete: perm.can_delete
        }));

        if (permissionsToInsert.length > 0) {
          const { error: permsError } = await supabase
            .from('project_member_permissions')
            .insert(permissionsToInsert);

          if (permsError) throw permsError;
        }
      }

      showToast('Mitglied erfolgreich hinzugefügt', 'success');
      setIsAddMemberModalOpen(false);
      loadMembers();
    } catch (error: any) {
      showToast('Fehler beim Hinzufügen: ' + error.message, 'error');
    }
  };

  const updateMemberPermissions = async () => {
    if (!editingMember) return;

    try {
      // Update member's role_id
      const { error: updateError } = await supabase
        .from('project_members')
        .update({
          role_id: useCustomPermissions ? null : selectedRoleId
        })
        .eq('id', editingMember.id);

      if (updateError) throw updateError;

      // Delete existing custom permissions
      await supabase
        .from('project_member_permissions')
        .delete()
        .eq('project_member_id', editingMember.id);

      // If custom permissions, create them
      if (useCustomPermissions) {
        const permissionsToInsert = Object.values(customPermissions).filter(
          perm => perm.can_view || perm.can_create || perm.can_edit || perm.can_delete
        ).map(perm => ({
          project_member_id: editingMember.id,
          module_key: perm.module_key,
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_edit: perm.can_edit,
          can_delete: perm.can_delete
        }));

        if (permissionsToInsert.length > 0) {
          const { error: permsError } = await supabase
            .from('project_member_permissions')
            .insert(permissionsToInsert);

          if (permsError) throw permsError;
        }
      }

      showToast('Berechtigungen erfolgreich aktualisiert', 'success');
      setIsEditPermissionsModalOpen(false);
      loadMembers();
    } catch (error: any) {
      showToast('Fehler beim Aktualisieren: ' + error.message, 'error');
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm('Möchten Sie dieses Mitglied wirklich entfernen?')) return;

    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      showToast('Mitglied erfolgreich entfernt', 'success');
      loadMembers();
    } catch (error: any) {
      showToast('Fehler beim Entfernen: ' + error.message, 'error');
    }
  };

  const togglePermission = (moduleKey: string, permType: 'can_view' | 'can_create' | 'can_edit' | 'can_delete') => {
    setCustomPermissions(prev => {
      const current = prev[moduleKey];
      const updated = { ...current, [permType]: !current[permType] };

      // Auto-enable view if any other permission is enabled
      if ((updated.can_create || updated.can_edit || updated.can_delete) && !updated.can_view) {
        updated.can_view = true;
      }

      return { ...prev, [moduleKey]: updated };
    });
  };

  const getMemberTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      employee: 'Mitarbeiter',
      owner: 'Bauherr',
      subcontractor: 'Gewerk',
      other: 'Sonstiges'
    };
    return labels[type] || type;
  };

  const getMemberTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      employee: '#3B82F6',
      owner: '#10B981',
      subcontractor: '#F59E0B',
      other: '#6B7280'
    };
    return colors[type] || '#6B7280';
  };

  const getPermissionsSummary = (member: ProjectMember) => {
    if (member.role) {
      return `Rolle: ${member.role.role_name}`;
    }
    if (member.custom_permissions.length > 0) {
      const viewCount = member.custom_permissions.filter(p => p.can_view).length;
      const editCount = member.custom_permissions.filter(p => p.can_edit || p.can_delete).length;
      return `${viewCount} Module (${editCount} bearbeitbar)`;
    }
    return 'Keine Berechtigungen';
  };

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
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Beteiligte</Text>
            <Text style={styles.pageSubtitle}>
              Projektmitglieder und Berechtigungen verwalten
            </Text>
          </View>
          <Button
            onClick={openAddMemberModal}
            variant="primary"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <UserPlus size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Mitglied hinzufügen</Text>
            </View>
          </Button>
        </View>

        {members.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Users size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Keine Mitglieder</Text>
            <Text style={styles.emptyText}>
              Fügen Sie Mitglieder hinzu und vergeben Sie Berechtigungen.
            </Text>
            <Button
              onClick={openAddMemberModal}
              variant="primary"
            >
              Erstes Mitglied hinzufügen
            </Button>
          </Card>
        ) : (
          <View style={styles.membersList}>
            {members.map(member => (
              <Card key={member.id} style={styles.memberCard}>
                <View style={styles.memberHeader}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {(member.accessor?.accessor_first_name?.[0] || 
                        member.accessor?.accessor_email[0] || 'U').toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>
                      {member.accessor?.accessor_first_name && member.accessor?.accessor_last_name
                        ? `${member.accessor.accessor_first_name} ${member.accessor.accessor_last_name}`
                        : member.accessor?.accessor_email}
                    </Text>
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

                  <View style={styles.memberActions}>
                    <View
                      style={[
                        styles.typeBadge,
                        { backgroundColor: getMemberTypeBadgeColor(member.member_type) }
                      ]}
                    >
                      <Text style={styles.typeBadgeText}>
                        {getMemberTypeLabel(member.member_type)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => openEditPermissionsModal(member)}
                    >
                      <Edit2 size={16} color="#64748b" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => removeMember(member.id)}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.memberPermissions}>
                  <Shield size={14} color="#64748b" />
                  <Text style={styles.permissionsSummary}>
                    {getPermissionsSummary(member)}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Member Modal */}
      <ModernModal
        visible={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        title="Mitglied hinzufügen"
      >
        <View style={styles.modalContent}>
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Zugreifer auswählen *</Text>
            <View style={styles.selectWrapper}>
              <select
                value={selectedAccessorId}
                onChange={(e) => setSelectedAccessorId(e.target.value)}
                style={styles.select as any}
              >
                <option value="">Bitte wählen...</option>
                {availableAccessors.map(accessor => (
                  <option key={accessor.id} value={accessor.id}>
                    {accessor.accessor_first_name && accessor.accessor_last_name
                      ? `${accessor.accessor_first_name} ${accessor.accessor_last_name}`
                      : accessor.accessor_email}
                    {' '}({getMemberTypeLabel(accessor.accessor_type)})
                  </option>
                ))}
              </select>
            </View>
            {availableAccessors.length === 0 && (
              <Text style={styles.helperText}>
                Keine Zugreifer verfügbar. Fügen Sie zuerst Zugreifer unter "/accessors" hinzu.
              </Text>
            )}
          </View>

          <View style={styles.permissionModeSelector}>
            <TouchableOpacity
              style={[styles.modeOption, !useCustomPermissions && styles.modeOptionActive]}
              onPress={() => setUseCustomPermissions(false)}
            >
              <Shield size={20} color={!useCustomPermissions ? colors.primary : '#64748b'} />
              <View style={styles.modeOptionText}>
                <Text style={[styles.modeOptionTitle, !useCustomPermissions && styles.modeOptionTitleActive]}>
                  Vordefinierte Rolle
                </Text>
                <Text style={styles.modeOptionDesc}>
                  Rolle mit vordefinierten Berechtigungen zuweisen
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeOption, useCustomPermissions && styles.modeOptionActive]}
              onPress={() => setUseCustomPermissions(true)}
            >
              <Edit2 size={20} color={useCustomPermissions ? colors.primary : '#64748b'} />
              <View style={styles.modeOptionText}>
                <Text style={[styles.modeOptionTitle, useCustomPermissions && styles.modeOptionTitleActive]}>
                  Individuelle Berechtigungen
                </Text>
                <Text style={styles.modeOptionDesc}>
                  Berechtigungen manuell festlegen
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {!useCustomPermissions ? (
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Rolle auswählen *</Text>
              <View style={styles.selectWrapper}>
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  style={styles.select as any}
                >
                  <option value="">Bitte wählen...</option>
                  {availableRoles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.role_name}
                      {role.role_description && ` - ${role.role_description}`}
                    </option>
                  ))}
                </select>
              </View>
              {availableRoles.length === 0 && (
                <Text style={styles.helperText}>
                  Keine Rollen verfügbar. Erstellen Sie zuerst Rollen unter "/accessors".
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.permissionsSection}>
              <Text style={styles.permissionsSectionTitle}>Berechtigungen definieren</Text>
              <ScrollView style={styles.permissionsList} showsVerticalScrollIndicator={false}>
                {availableModules.map(module => {
                  const perm = customPermissions[module.module_key];
                  return (
                    <View key={module.module_key} style={styles.permissionItem}>
                      <Text style={styles.permissionName}>{module.module_name}</Text>
                      <View style={styles.permissionToggles}>
                        <TouchableOpacity
                          style={[styles.permissionToggle, perm.can_view && styles.permissionToggleActive]}
                          onPress={() => togglePermission(module.module_key, 'can_view')}
                        >
                          <Eye size={12} color={perm.can_view ? '#fff' : '#64748b'} />
                          <Text style={[styles.permissionToggleText, perm.can_view && styles.permissionToggleTextActive]}>
                            Sehen
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.permissionToggle, perm.can_edit && styles.permissionToggleActive]}
                          onPress={() => togglePermission(module.module_key, 'can_edit')}
                        >
                          <Edit2 size={12} color={perm.can_edit ? '#fff' : '#64748b'} />
                          <Text style={[styles.permissionToggleText, perm.can_edit && styles.permissionToggleTextActive]}>
                            Bearbeiten
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={styles.modalActions}>
            <Button onClick={() => setIsAddMemberModalOpen(false)} variant="secondary">Abbrechen</Button>
            <Button onClick={addMember} variant="primary">Hinzufügen</Button>
          </View>
        </View>
      </ModernModal>

      {/* Edit Permissions Modal */}
      <ModernModal
        visible={isEditPermissionsModalOpen}
        onClose={() => setIsEditPermissionsModalOpen(false)}
        title="Berechtigungen bearbeiten"
      >
        <View style={styles.modalContent}>
          {editingMember && (
            <View style={styles.editingMemberInfo}>
              <Text style={styles.editingMemberName}>
                {editingMember.accessor?.accessor_first_name && editingMember.accessor?.accessor_last_name
                  ? `${editingMember.accessor.accessor_first_name} ${editingMember.accessor.accessor_last_name}`
                  : editingMember.accessor?.accessor_email}
              </Text>
              <Text style={styles.editingMemberEmail}>{editingMember.accessor?.accessor_email}</Text>
            </View>
          )}

          <View style={styles.permissionModeSelector}>
            <TouchableOpacity
              style={[styles.modeOption, !useCustomPermissions && styles.modeOptionActive]}
              onPress={() => setUseCustomPermissions(false)}
            >
              <Shield size={20} color={!useCustomPermissions ? colors.primary : '#64748b'} />
              <View style={styles.modeOptionText}>
                <Text style={[styles.modeOptionTitle, !useCustomPermissions && styles.modeOptionTitleActive]}>
                  Vordefinierte Rolle
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeOption, useCustomPermissions && styles.modeOptionActive]}
              onPress={() => setUseCustomPermissions(true)}
            >
              <Edit2 size={20} color={useCustomPermissions ? colors.primary : '#64748b'} />
              <View style={styles.modeOptionText}>
                <Text style={[styles.modeOptionTitle, useCustomPermissions && styles.modeOptionTitleActive]}>
                  Individuelle Berechtigungen
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {!useCustomPermissions ? (
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Rolle auswählen *</Text>
              <View style={styles.selectWrapper}>
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  style={styles.select as any}
                >
                  <option value="">Bitte wählen...</option>
                  {availableRoles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.role_name}
                      {role.role_description && ` - ${role.role_description}`}
                    </option>
                  ))}
                </select>
              </View>
            </View>
          ) : (
            <View style={styles.permissionsSection}>
              <Text style={styles.permissionsSectionTitle}>Berechtigungen definieren</Text>
              <ScrollView style={styles.permissionsList} showsVerticalScrollIndicator={false}>
                {availableModules.map(module => {
                  const perm = customPermissions[module.module_key];
                  return (
                    <View key={module.module_key} style={styles.permissionItem}>
                      <Text style={styles.permissionName}>{module.module_name}</Text>
                      <View style={styles.permissionToggles}>
                        <TouchableOpacity
                          style={[styles.permissionToggle, perm.can_view && styles.permissionToggleActive]}
                          onPress={() => togglePermission(module.module_key, 'can_view')}
                        >
                          <Eye size={12} color={perm.can_view ? '#fff' : '#64748b'} />
                          <Text style={[styles.permissionToggleText, perm.can_view && styles.permissionToggleTextActive]}>
                            Sehen
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.permissionToggle, perm.can_edit && styles.permissionToggleActive]}
                          onPress={() => togglePermission(module.module_key, 'can_edit')}
                        >
                          <Edit2 size={12} color={perm.can_edit ? '#fff' : '#64748b'} />
                          <Text style={[styles.permissionToggleText, perm.can_edit && styles.permissionToggleTextActive]}>
                            Bearbeiten
                          </Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 4, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 15, color: '#64748b' },
  noAccessCard: { padding: 48, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', margin: 24 },
  noAccessTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginTop: 16, marginBottom: 8 },
  noAccessText: { fontSize: 15, color: '#64748b', textAlign: 'center' },
  emptyCard: { padding: 48, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  membersList: { gap: 12 },
  memberCard: { padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  memberHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 12 },
  memberAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  memberMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  memberEmail: { fontSize: 13, color: '#64748b' },
  memberCompany: { fontSize: 13, color: '#94a3b8' },
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'uppercase' },
  iconButton: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  memberPermissions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  permissionsSummary: { fontSize: 13, color: '#64748b' },
  modalContent: { gap: 20 },
  formGroup: { gap: 8 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#475569' },
  selectWrapper: { position: 'relative' },
  select: { width: '100%', padding: 12, fontSize: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff', color: '#0f172a' },
  helperText: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  permissionModeSelector: { gap: 12 },
  modeOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  modeOptionActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  modeOptionText: { flex: 1 },
  modeOptionTitle: { fontSize: 14, fontWeight: '700', color: '#475569', marginBottom: 2 },
  modeOptionTitleActive: { color: colors.primary },
  modeOptionDesc: { fontSize: 12, color: '#64748b' },
  permissionsSection: { marginTop: 8 },
  permissionsSectionTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  permissionsList: { maxHeight: 300 },
  permissionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#F8FAFC', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  permissionName: { fontSize: 13, fontWeight: '600', color: '#0f172a', flex: 1 },
  permissionToggles: { flexDirection: 'row', gap: 6 },
  permissionToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  permissionToggleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  permissionToggleText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  permissionToggleTextActive: { color: '#fff' },
  editingMemberInfo: { padding: 16, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  editingMemberName: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  editingMemberEmail: { fontSize: 13, color: '#64748b' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 }
});
