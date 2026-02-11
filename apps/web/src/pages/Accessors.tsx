import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../lib/supabase';
import { ModernModal } from '../components/ModernModal';
import { useToast } from '../components/ToastProvider';
import { UserCog, Plus, Trash2, Edit2, Shield, Eye, EyeOff, Check, X } from 'lucide-react';

interface PermissionModule {
  module_key: string;
  module_name: string;
  module_description: string;
  route_path: string;
  icon_name: string;
  display_order: number;
}

interface RolePermission {
  module_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface Role {
  id: string;
  role_name: string;
  role_description: string;
  is_active: boolean;
  created_at: string;
  permissions: RolePermission[];
}

interface UserAccessor {
  id: string;
  accessor_email: string;
  accessor_first_name: string;
  accessor_last_name: string;
  accessor_phone: string;
  accessor_company: string;
  accessor_type: 'employee' | 'owner' | 'subcontractor' | 'other';
  notes: string;
  is_active: boolean;
  created_at: string;
}

export function Accessors() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'roles' | 'users'>('roles');
  
  // Roles state
  const [roles, setRoles] = useState<Role[]>([]);
  const [modules, setModules] = useState<PermissionModule[]>([]);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [rolePermissions, setRolePermissions] = useState<Record<string, RolePermission>>({});
  
  // Users state
  const [accessors, setAccessors] = useState<UserAccessor[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccessor | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userFirstName, setUserFirstName] = useState('');
  const [userLastName, setUserLastName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userCompany, setUserCompany] = useState('');
  const [userType, setUserType] = useState<'employee' | 'owner' | 'subcontractor' | 'other'>('employee');
  const [userNotes, setUserNotes] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load permission modules
      const { data: modulesData, error: modulesError } = await supabase
        .from('permission_modules')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (modulesError) throw modulesError;
      setModules(modulesData || []);

      if (activeTab === 'roles') {
        await loadRoles();
      } else {
        await loadAccessors();
      }
    } catch (error: any) {
      showToast('Fehler beim Laden der Daten: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select(`
          *,
          role_permissions (
            module_key,
            can_view,
            can_create,
            can_edit,
            can_delete
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (rolesError) throw rolesError;

      const formattedRoles = (rolesData || []).map(role => ({
        ...role,
        permissions: role.role_permissions || []
      }));

      setRoles(formattedRoles);
    } catch (error: any) {
      showToast('Fehler beim Laden der Rollen: ' + error.message, 'error');
    }
  };

  const loadAccessors = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: accessorsData, error: accessorsError } = await supabase
        .from('user_accessors')
        .select('*')
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (accessorsError) throw accessorsError;
      setAccessors(accessorsData || []);
    } catch (error: any) {
      showToast('Fehler beim Laden der Zugreifer: ' + error.message, 'error');
    }
  };

  const openRoleModal = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setRoleName(role.role_name);
      setRoleDescription(role.role_description || '');
      
      // Convert permissions array to object
      const permsObj: Record<string, RolePermission> = {};
      role.permissions.forEach(perm => {
        permsObj[perm.module_key] = perm;
      });
      setRolePermissions(permsObj);
    } else {
      setEditingRole(null);
      setRoleName('');
      setRoleDescription('');
      
      // Initialize with all modules set to false
      const permsObj: Record<string, RolePermission> = {};
      modules.forEach(module => {
        permsObj[module.module_key] = {
          module_key: module.module_key,
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false
        };
      });
      setRolePermissions(permsObj);
    }
    setIsRoleModalOpen(true);
  };

  const saveRole = async () => {
    if (!roleName.trim()) {
      showToast('Bitte geben Sie einen Rollennamen ein', 'error');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');

      let roleId = editingRole?.id;

      if (editingRole) {
        // Update existing role
        const { error: updateError } = await supabase
          .from('roles')
          .update({
            role_name: roleName,
            role_description: roleDescription,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingRole.id);

        if (updateError) throw updateError;
      } else {
        // Create new role
        const { data: newRole, error: insertError } = await supabase
          .from('roles')
          .insert({
            user_id: user.id,
            role_name: roleName,
            role_description: roleDescription,
            is_system_role: false,
            is_active: true
          })
          .select()
          .single();

        if (insertError) throw insertError;
        roleId = newRole.id;
      }

      // Delete existing permissions
      await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId);

      // Insert new permissions
      const permissionsToInsert = Object.values(rolePermissions).filter(
        perm => perm.can_view || perm.can_create || perm.can_edit || perm.can_delete
      ).map(perm => ({
        role_id: roleId,
        module_key: perm.module_key,
        can_view: perm.can_view,
        can_create: perm.can_create,
        can_edit: perm.can_edit,
        can_delete: perm.can_delete
      }));

      if (permissionsToInsert.length > 0) {
        const { error: permsError } = await supabase
          .from('role_permissions')
          .insert(permissionsToInsert);

        if (permsError) throw permsError;
      }

      showToast(
        editingRole ? 'Rolle erfolgreich aktualisiert' : 'Rolle erfolgreich erstellt',
        'success'
      );
      setIsRoleModalOpen(false);
      loadRoles();
    } catch (error: any) {
      showToast('Fehler beim Speichern: ' + error.message, 'error');
    }
  };

  const deleteRole = async (roleId: string) => {
    if (!confirm('Möchten Sie diese Rolle wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('roles')
        .update({ is_active: false })
        .eq('id', roleId);

      if (error) throw error;

      showToast('Rolle erfolgreich gelöscht', 'success');
      loadRoles();
    } catch (error: any) {
      showToast('Fehler beim Löschen: ' + error.message, 'error');
    }
  };

  const togglePermission = (moduleKey: string, permType: 'can_view' | 'can_create' | 'can_edit' | 'can_delete') => {
    setRolePermissions(prev => {
      const current = prev[moduleKey] || {
        module_key: moduleKey,
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false
      };

      const updated = { ...current, [permType]: !current[permType] };

      // Auto-enable view if any other permission is enabled
      if ((updated.can_create || updated.can_edit || updated.can_delete) && !updated.can_view) {
        updated.can_view = true;
      }

      return { ...prev, [moduleKey]: updated };
    });
  };

  const openUserModal = (user?: UserAccessor) => {
    if (user) {
      setEditingUser(user);
      setUserEmail(user.accessor_email);
      setUserFirstName(user.accessor_first_name || '');
      setUserLastName(user.accessor_last_name || '');
      setUserPhone(user.accessor_phone || '');
      setUserCompany(user.accessor_company || '');
      setUserType(user.accessor_type);
      setUserNotes(user.notes || '');
    } else {
      setEditingUser(null);
      setUserEmail('');
      setUserFirstName('');
      setUserLastName('');
      setUserPhone('');
      setUserCompany('');
      setUserType('employee');
      setUserNotes('');
    }
    setIsUserModalOpen(true);
  };

  const saveUser = async () => {
    if (!userEmail.trim()) {
      showToast('Bitte geben Sie eine E-Mail-Adresse ein', 'error');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');

      if (editingUser) {
        // Update existing user
        const { error } = await supabase
          .from('user_accessors')
          .update({
            accessor_email: userEmail,
            accessor_first_name: userFirstName,
            accessor_last_name: userLastName,
            accessor_phone: userPhone,
            accessor_company: userCompany,
            accessor_type: userType,
            notes: userNotes,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingUser.id);

        if (error) throw error;
      } else {
        // Create new user
        const { error } = await supabase
          .from('user_accessors')
          .insert({
            owner_id: user.id,
            accessor_email: userEmail,
            accessor_first_name: userFirstName,
            accessor_last_name: userLastName,
            accessor_phone: userPhone,
            accessor_company: userCompany,
            accessor_type: userType,
            notes: userNotes,
            is_active: true
          });

        if (error) throw error;
      }

      showToast(
        editingUser ? 'Zugreifer erfolgreich aktualisiert' : 'Zugreifer erfolgreich hinzugefügt',
        'success'
      );
      setIsUserModalOpen(false);
      loadAccessors();
    } catch (error: any) {
      showToast('Fehler beim Speichern: ' + error.message, 'error');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Möchten Sie diesen Zugreifer wirklich entfernen?')) return;

    try {
      const { error } = await supabase
        .from('user_accessors')
        .update({ is_active: false })
        .eq('id', userId);

      if (error) throw error;

      showToast('Zugreifer erfolgreich entfernt', 'success');
      loadAccessors();
    } catch (error: any) {
      showToast('Fehler beim Entfernen: ' + error.message, 'error');
    }
  };

  const getUserTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      employee: 'Mitarbeiter',
      owner: 'Bauherr',
      subcontractor: 'Gewerk',
      other: 'Sonstiges'
    };
    return labels[type] || type;
  };

  const getUserTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      employee: '#3B82F6',
      owner: '#10B981',
      subcontractor: '#F59E0B',
      other: '#6B7280'
    };
    return colors[type] || '#6B7280';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Zugriffsverwaltung</Text>
            <Text style={styles.pageSubtitle}>Rollen und Benutzer verwalten</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'roles' && styles.tabActive]}
            onPress={() => setActiveTab('roles')}
          >
            <Shield size={18} color={activeTab === 'roles' ? colors.primary : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'roles' && styles.tabTextActive]}>
              Rollen ({roles.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'users' && styles.tabActive]}
            onPress={() => setActiveTab('users')}
          >
            <UserCog size={18} color={activeTab === 'users' ? colors.primary : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
              Zugreifer ({accessors.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Roles Tab */}
        {activeTab === 'roles' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Vordefinierte Rollen</Text>
              <Button
                onClick={() => openRoleModal()}
                variant="primary"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Plus size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Neue Rolle</Text>
                </View>
              </Button>
            </View>

            {roles.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Shield size={48} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>Keine Rollen vorhanden</Text>
                <Text style={styles.emptyText}>
                  Erstellen Sie Rollen mit vordefinierten Berechtigungen, die Sie später Benutzern zuweisen können.
                </Text>
                <Button
                  onClick={() => openRoleModal()}
                  variant="primary"
                >
                  Erste Rolle erstellen
                </Button>
              </Card>
            ) : (
              <View style={styles.rolesGrid}>
                {roles.map(role => (
                  <Card key={role.id} style={styles.roleCard}>
                    <View style={styles.roleHeader}>
                      <View style={styles.roleIconContainer}>
                        <Shield size={24} color={colors.primary} />
                      </View>
                      <View style={styles.roleActions}>
                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={() => openRoleModal(role)}
                        >
                          <Edit2 size={16} color="#64748b" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={() => deleteRole(role.id)}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.roleName}>{role.role_name}</Text>
                    {role.role_description && (
                      <Text style={styles.roleDescription}>{role.role_description}</Text>
                    )}

                    <View style={styles.roleStats}>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{role.permissions.length}</Text>
                        <Text style={styles.statLabel}>Berechtigungen</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                          {role.permissions.filter(p => p.can_edit || p.can_delete).length}
                        </Text>
                        <Text style={styles.statLabel}>Schreiben</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                          {role.permissions.filter(p => p.can_view && !p.can_edit && !p.can_delete).length}
                        </Text>
                        <Text style={styles.statLabel}>Nur Lesen</Text>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Zugreifer</Text>
              <Button
                onClick={() => openUserModal()}
                variant="primary"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Plus size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Zugreifer hinzufügen</Text>
                </View>
              </Button>
            </View>

            {accessors.length === 0 ? (
              <Card style={styles.emptyCard}>
                <UserCog size={48} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>Keine Zugreifer vorhanden</Text>
                <Text style={styles.emptyText}>
                  Fügen Sie Benutzer hinzu, die Sie zu Projekten einladen können.
                </Text>
                <Button
                  onClick={() => openUserModal()}
                  variant="primary"
                >
                  Ersten Zugreifer hinzufügen
                </Button>
              </Card>
            ) : (
              <View style={styles.usersList}>
                {accessors.map(accessor => (
                  <Card key={accessor.id} style={styles.userCard}>
                    <View style={styles.userHeader}>
                      <View style={styles.userAvatar}>
                        <Text style={styles.userAvatarText}>
                          {(accessor.accessor_first_name?.[0] || accessor.accessor_email[0]).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>
                          {accessor.accessor_first_name && accessor.accessor_last_name
                            ? `${accessor.accessor_first_name} ${accessor.accessor_last_name}`
                            : accessor.accessor_email}
                        </Text>
                        <Text style={styles.userEmail}>{accessor.accessor_email}</Text>
                        {accessor.accessor_company && (
                          <Text style={styles.userCompany}>{accessor.accessor_company}</Text>
                        )}
                      </View>
                      <View style={styles.userActions}>
                        <View
                          style={[
                            styles.typeBadge,
                            { backgroundColor: getUserTypeBadgeColor(accessor.accessor_type) }
                          ]}
                        >
                          <Text style={styles.typeBadgeText}>
                            {getUserTypeLabel(accessor.accessor_type)}
                          </Text>
                        </View>
                        <View style={styles.userActionButtons}>
                          <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => openUserModal(accessor)}
                          >
                            <Edit2 size={16} color="#64748b" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => deleteUser(accessor.id)}
                          >
                            <Trash2 size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Role Modal */}
      <ModernModal
        visible={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title={editingRole ? 'Rolle bearbeiten' : 'Neue Rolle erstellen'}
      >
        <View style={styles.modalContent}>
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Rollenname *</Text>
            <Input
              value={roleName}
              onChangeText={setRoleName}
              placeholder="z.B. Bauleiter, Architekt, Subunternehmer"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Beschreibung</Text>
            <Input
              value={roleDescription}
              onChangeText={setRoleDescription}
              placeholder="Optionale Beschreibung der Rolle"
              multiline
              numberOfLines={2}
            />
          </View>

          <View style={styles.permissionsSection}>
            <Text style={styles.permissionsSectionTitle}>Berechtigungen</Text>
            <Text style={styles.permissionsSectionSubtitle}>
              Definieren Sie, welche Module diese Rolle sehen und bearbeiten darf
            </Text>

            <ScrollView style={styles.permissionsList} showsVerticalScrollIndicator={false}>
              {modules.map(module => {
                const perm = rolePermissions[module.module_key] || {
                  can_view: false,
                  can_create: false,
                  can_edit: false,
                  can_delete: false
                };

                return (
                  <View key={module.module_key} style={styles.permissionItem}>
                    <View style={styles.permissionHeader}>
                      <Text style={styles.permissionName}>{module.module_name}</Text>
                      <Text style={styles.permissionDescription}>{module.module_description}</Text>
                    </View>

                    <View style={styles.permissionToggles}>
                      <TouchableOpacity
                        style={[styles.permissionToggle, perm.can_view && styles.permissionToggleActive]}
                        onPress={() => togglePermission(module.module_key, 'can_view')}
                      >
                        <Eye size={14} color={perm.can_view ? '#fff' : '#64748b'} />
                        <Text style={[styles.permissionToggleText, perm.can_view && styles.permissionToggleTextActive]}>
                          Sehen
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.permissionToggle, perm.can_create && styles.permissionToggleActive]}
                        onPress={() => togglePermission(module.module_key, 'can_create')}
                      >
                        <Plus size={14} color={perm.can_create ? '#fff' : '#64748b'} />
                        <Text style={[styles.permissionToggleText, perm.can_create && styles.permissionToggleTextActive]}>
                          Erstellen
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.permissionToggle, perm.can_edit && styles.permissionToggleActive]}
                        onPress={() => togglePermission(module.module_key, 'can_edit')}
                      >
                        <Edit2 size={14} color={perm.can_edit ? '#fff' : '#64748b'} />
                        <Text style={[styles.permissionToggleText, perm.can_edit && styles.permissionToggleTextActive]}>
                          Bearbeiten
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.permissionToggle, perm.can_delete && styles.permissionToggleActive]}
                        onPress={() => togglePermission(module.module_key, 'can_delete')}
                      >
                        <Trash2 size={14} color={perm.can_delete ? '#fff' : '#64748b'} />
                        <Text style={[styles.permissionToggleText, perm.can_delete && styles.permissionToggleTextActive]}>
                          Löschen
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.modalActions}>
            <Button onClick={() => setIsRoleModalOpen(false)} variant="secondary">Abbrechen</Button>
            <Button onClick={saveRole} variant="primary">Speichern</Button>
          </View>
        </View>
      </ModernModal>

      {/* User Modal */}
      <ModernModal
        visible={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        title={editingUser ? 'Zugreifer bearbeiten' : 'Zugreifer hinzufügen'}
      >
        <View style={styles.modalContent}>
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>E-Mail-Adresse *</Text>
            <Input
              value={userEmail}
              onChangeText={setUserEmail}
              placeholder="user@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Vorname</Text>
              <Input
                value={userFirstName}
                onChangeText={setUserFirstName}
                placeholder="Max"
              />
            </View>

            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Nachname</Text>
              <Input
                value={userLastName}
                onChangeText={setUserLastName}
                placeholder="Mustermann"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Telefon</Text>
            <Input
              value={userPhone}
              onChangeText={setUserPhone}
              placeholder="+49 123 456789"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Firma</Text>
            <Input
              value={userCompany}
              onChangeText={setUserCompany}
              placeholder="Firma GmbH"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Typ *</Text>
            <View style={styles.typeSelector}>
              {(['employee', 'owner', 'subcontractor', 'other'] as const).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeOption,
                    userType === type && styles.typeOptionActive,
                    { backgroundColor: userType === type ? getUserTypeBadgeColor(type) : '#F8FAFC' }
                  ]}
                  onPress={() => setUserType(type)}
                >
                  <Text style={[styles.typeOptionText, userType === type && styles.typeOptionTextActive]}>
                    {getUserTypeLabel(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Notizen</Text>
            <Input
              value={userNotes}
              onChangeText={setUserNotes}
              placeholder="Optionale Notizen"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.modalActions}>
            <Button onClick={() => setIsUserModalOpen(false)} variant="secondary">Abbrechen</Button>
            <Button onClick={saveUser} variant="primary">Speichern</Button>
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
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 24, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 0 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: colors.primary },
  tabContent: { flex: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  emptyCard: { padding: 48, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  rolesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  roleCard: { width: '48%', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  roleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  roleIconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  roleActions: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  roleName: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  roleDescription: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 16 },
  roleStats: { flexDirection: 'row', gap: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.primary, marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
  usersList: { gap: 12 },
  userCard: { padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  userHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  userAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  userEmail: { fontSize: 13, color: '#64748b', marginBottom: 2 },
  userCompany: { fontSize: 13, color: '#94a3b8' },
  userActions: { alignItems: 'flex-end', gap: 8 },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'uppercase' },
  userActionButtons: { flexDirection: 'row', gap: 8 },
  modalContent: { gap: 20 },
  formGroup: { gap: 8 },
  formRow: { flexDirection: 'row', gap: 12 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#475569' },
  typeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeOption: { flex: 1, minWidth: '45%', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 2, borderColor: '#E2E8F0', alignItems: 'center' },
  typeOptionActive: { borderColor: 'transparent' },
  typeOptionText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  typeOptionTextActive: { color: '#fff' },
  permissionsSection: { marginTop: 8 },
  permissionsSectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  permissionsSectionSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 16 },
  permissionsList: { maxHeight: 400 },
  permissionItem: { padding: 16, backgroundColor: '#F8FAFC', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  permissionHeader: { marginBottom: 12 },
  permissionName: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  permissionDescription: { fontSize: 12, color: '#64748b' },
  permissionToggles: { flexDirection: 'row', gap: 8 },
  permissionToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 8, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  permissionToggleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  permissionToggleText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  permissionToggleTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 }
});
