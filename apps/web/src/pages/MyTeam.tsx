import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../lib/supabase';
import { ModernModal } from '../components/ModernModal';
import { useToast } from '../components/ToastProvider';
import { Users, Plus, Trash2, Edit2, Shield, Eye, Mail, Phone, Building2, UserPlus, Crown, UserMinus } from 'lucide-react';

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

interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  team_role: 'member' | 'team_admin';
  joined_team_at: string;
  avatar_url?: string;
}

interface TeamInfo {
  id: string;
  name: string;
  description: string;
  company_info: string;
  contact_email: string;
  contact_phone: string;
  address: string;
}

export function MyTeam() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members'>('members');
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isEditMemberModalOpen, setIsEditMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  // New member form
  const [newEmail, setNewEmail] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [savingMember, setSavingMember] = useState(false);

  // Roles state
  const [roles, setRoles] = useState<Role[]>([]);
  const [modules, setModules] = useState<PermissionModule[]>([]);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [rolePermissions, setRolePermissions] = useState<Record<string, RolePermission>>({});

  useEffect(() => {
    loadTeamData();
  }, []);

  const loadModules = async () => {
    const { data: modulesData } = await supabase
      .from('permission_modules')
      .select('id, module_key, module_name, description, display_order, is_active')
      .eq('is_active', true)
      .order('display_order');
    setModules(modulesData || []);
  };

  const loadTeamData = async () => {
    setLoading(true);
    try {
      console.log('🔍 MyTeam: Loading team data...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ MyTeam: No user found');
        return;
      }

      // Get current user's profile to find team_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('team_id, team_role')
        .eq('id', user.id)
        .single();

      console.log('📊 MyTeam: Profile:', { profile, profileError });

      if (!profile?.team_id) {
        console.log('❌ MyTeam: No team_id found');
        setLoading(false);
        return;
      }

      // Load team info
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('id, name, description, company_info, contact_email, contact_phone, address, logo_url, created_by, is_active, created_at, updated_at')
        .eq('id', profile.team_id)
        .single();

      console.log('📊 MyTeam: Team data:', { teamData, teamError });

      if (teamData) setTeam(teamData);

      // Load team members
      console.log('🔍 MyTeam: Querying members with team_id:', profile.team_id);
      
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, team_role, joined_team_at, avatar_url')
        .eq('team_id', profile.team_id)
        .order('team_role', { ascending: true })
        .order('first_name', { ascending: true });

      console.log('📊 MyTeam: Members query returned:', { 
        count: membersData?.length, 
        membersError,
        members: membersData?.map(m => ({ email: m.email, role: m.team_role }))
      });

      setMembers(membersData || []);
    } catch (error: any) {
      console.error('❌ MyTeam: Error loading:', error);
      showToast('Fehler beim Laden: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const addMember = async () => {
    console.log('🔍 MyTeam: addMember called', { newEmail, team });
    
    if (!newEmail.trim()) {
      showToast('Bitte E-Mail-Adresse eingeben', 'error');
      return;
    }
    if (!team) {
      console.log('❌ MyTeam: No team found');
      return;
    }

    setSavingMember(true);
    try {
      console.log('📝 MyTeam: Checking if user exists:', newEmail.toLowerCase());
      
      // Check if user with this email exists
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, team_id, first_name, last_name')
        .eq('email', newEmail.toLowerCase())
        .single();

      console.log('📊 MyTeam: Existing profile:', { existingProfile, profileError });

      if (!existingProfile) {
        showToast('Benutzer mit dieser E-Mail nicht gefunden. Der Benutzer muss sich zuerst registrieren.', 'error');
        setSavingMember(false);
        return;
      }

      if (existingProfile.team_id && existingProfile.team_id !== team.id) {
        console.log('❌ MyTeam: User already in another team');
        showToast('Dieser Benutzer gehört bereits einem anderen Team an.', 'error');
        setSavingMember(false);
        return;
      }

      if (existingProfile.team_id === team.id) {
        console.log('⚠️ MyTeam: User already in this team');
        showToast('Dieser Benutzer ist bereits in Ihrem Team.', 'info');
        setSavingMember(false);
        return;
      }

      console.log('📝 MyTeam: Updating profile to add to team...');
      
      // Update the user's profile to add them to the team
      const { data: updateResult, error } = await supabase
        .from('profiles')
        .update({
          team_id: team.id,
          team_role: 'member',
          joined_team_at: new Date().toISOString(),
          // Also update name if provided and user doesn't have one
          ...(newFirstName && !existingProfile.first_name ? { first_name: newFirstName } : {}),
          ...(newLastName && !existingProfile.last_name ? { last_name: newLastName } : {}),
        })
        .eq('id', existingProfile.id)
        .select();

      console.log('📊 MyTeam: Update result:', { updateResult, error, updatedRows: updateResult?.length });

      if (error) {
        console.error('❌ MyTeam: Error updating profile:', error);
        throw error;
      }
      
      if (!updateResult || updateResult.length === 0) {
        console.error('❌ MyTeam: UPDATE succeeded but affected 0 rows!');
        throw new Error('Profile konnte nicht aktualisiert werden - möglicherweise fehlen Berechtigungen');
      }
      
      console.log('✅ MyTeam: Profile updated successfully:', updateResult[0]);

      // Also create a user_accessor entry for the superuser to see this member
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('📝 MyTeam: Creating user_accessor entry...');
        
        // Find the superuser (team creator)
        const { data: teamDetail } = await supabase
          .from('teams')
          .select('created_by')
          .eq('id', team.id)
          .single();

        if (teamDetail?.created_by) {
          console.log('📝 MyTeam: Team created_by:', teamDetail.created_by);
          
          // Insert into user_accessors so superuser can see this member
          const { error: accessorError } = await supabase
            .from('user_accessors')
            .upsert({
              owner_id: teamDetail.created_by,
              accessor_email: newEmail.toLowerCase(),
              accessor_first_name: newFirstName || existingProfile.first_name || '',
              accessor_last_name: newLastName || existingProfile.last_name || '',
              accessor_type: 'subcontractor',
              accessor_company: team.name,
              notes: `Team-Mitglied: ${team.name}`,
              is_active: true,
            }, {
              onConflict: 'owner_id,accessor_email',
              ignoreDuplicates: true,
            });
          
          if (accessorError) {
            console.error('⚠️ MyTeam: Error creating accessor (non-critical):', accessorError);
          } else {
            console.log('✅ MyTeam: Accessor created');
          }
        }
      }

      console.log('✅ MyTeam: Member added successfully, refreshing data...');
      showToast('Mitarbeiter erfolgreich zum Team hinzugefügt', 'success');
      setIsAddMemberModalOpen(false);
      setNewEmail('');
      setNewFirstName('');
      setNewLastName('');
      setNewPhone('');
      await loadTeamData();
    } catch (error: any) {
      console.error('❌ MyTeam: Error in addMember:', error);
      showToast('Fehler: ' + error.message, 'error');
    } finally {
      setSavingMember(false);
    }
  };

  const removeMember = async (member: TeamMember) => {
    if (!confirm(`Möchten Sie ${member.first_name || member.email} wirklich aus dem Team entfernen?`)) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          team_id: null,
          team_role: 'member',
          joined_team_at: null,
        })
        .eq('id', member.id);

      if (error) throw error;

      showToast('Mitarbeiter aus dem Team entfernt', 'success');
      loadTeamData();
    } catch (error: any) {
      showToast('Fehler: ' + error.message, 'error');
    }
  };

  // ==========================================
  // ROLES MANAGEMENT
  // ==========================================

  const loadRoles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select(`
          id, user_id, role_name, role_description, is_system_role, is_active, created_at, updated_at,
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

  const openRoleModal = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setRoleName(role.role_name);
      setRoleDescription(role.role_description || '');
      const permsObj: Record<string, RolePermission> = {};
      role.permissions.forEach(perm => { permsObj[perm.module_key] = perm; });
      setRolePermissions(permsObj);
    } else {
      setEditingRole(null);
      setRoleName('');
      setRoleDescription('');
      const permsObj: Record<string, RolePermission> = {};
      modules.forEach(mod => {
        permsObj[mod.module_key] = {
          module_key: mod.module_key,
          can_view: false, can_create: false, can_edit: false, can_delete: false
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
        const { error: updateError } = await supabase
          .from('roles')
          .update({ role_name: roleName, role_description: roleDescription, updated_at: new Date().toISOString() })
          .eq('id', editingRole.id);
        if (updateError) throw updateError;
      } else {
        const { data: newRole, error: insertError } = await supabase
          .from('roles')
          .insert({ user_id: user.id, role_name: roleName, role_description: roleDescription, is_system_role: false, is_active: true })
          .select()
          .single();
        if (insertError) throw insertError;
        roleId = newRole.id;
      }

      // Delete existing permissions
      await supabase.from('role_permissions').delete().eq('role_id', roleId);

      // Insert new permissions
      const permissionsToInsert = Object.values(rolePermissions)
        .filter(perm => perm.can_view || perm.can_create || perm.can_edit || perm.can_delete)
        .map(perm => ({
          role_id: roleId,
          module_key: perm.module_key,
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_edit: perm.can_edit,
          can_delete: perm.can_delete
        }));

      if (permissionsToInsert.length > 0) {
        const { error: permsError } = await supabase.from('role_permissions').insert(permissionsToInsert);
        if (permsError) throw permsError;
      }

      showToast(editingRole ? 'Rolle erfolgreich aktualisiert' : 'Rolle erfolgreich erstellt', 'success');
      setIsRoleModalOpen(false);
      loadRoles();
    } catch (error: any) {
      showToast('Fehler beim Speichern: ' + error.message, 'error');
    }
  };

  const deleteRole = async (roleId: string) => {
    if (!confirm('Möchten Sie diese Rolle wirklich löschen?')) return;
    try {
      const { error } = await supabase.from('roles').update({ is_active: false }).eq('id', roleId);
      if (error) throw error;
      showToast('Rolle erfolgreich gelöscht', 'success');
      loadRoles();
    } catch (error: any) {
      showToast('Fehler beim Löschen: ' + error.message, 'error');
    }
  };

  const togglePermission = (moduleKey: string, permType: 'can_view' | 'can_create' | 'can_edit' | 'can_delete') => {
    setRolePermissions(prev => {
      const current = prev[moduleKey] || { module_key: moduleKey, can_view: false, can_create: false, can_edit: false, can_delete: false };
      const updated = { ...current, [permType]: !current[permType] };
      // Auto-enable view if any write permission is enabled
      if ((updated.can_create || updated.can_edit || updated.can_delete) && !updated.can_view) {
        updated.can_view = true;
      }
      return { ...prev, [moduleKey]: updated };
    });
  };

  const getInitials = (member: TeamMember) => {
    if (member.first_name && member.last_name) {
      return `${member.first_name[0]}${member.last_name[0]}`.toUpperCase();
    }
    return member.email[0].toUpperCase();
  };

  const getMemberName = (member: TeamMember) => {
    if (member.first_name && member.last_name) {
      return `${member.first_name} ${member.last_name}`;
    }
    return member.email;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!team) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyStateContainer}>
          <Users size={64} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Kein Team zugeordnet</Text>
          <Text style={styles.emptyText}>
            Sie sind noch keinem Team zugeordnet. Bitte kontaktieren Sie den Projektverantwortlichen.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Team Info Header */}
        <Card style={styles.teamHeader}>
          <View style={styles.teamHeaderRow}>
            <View style={styles.teamIconContainer}>
              <Building2 size={28} color={colors.primary} />
            </View>
            <View style={styles.teamHeaderInfo}>
              <Text style={styles.teamName}>{team.name}</Text>
              {team.description ? (
                <Text style={styles.teamDescription}>{team.description}</Text>
              ) : null}
              <View style={styles.teamMetaRow}>
                {team.contact_email ? (
                  <View style={styles.teamMetaItem}>
                    <Mail size={14} color="#64748b" />
                    <Text style={styles.teamMetaText}>{team.contact_email}</Text>
                  </View>
                ) : null}
                {team.contact_phone ? (
                  <View style={styles.teamMetaItem}>
                    <Phone size={14} color="#64748b" />
                    <Text style={styles.teamMetaText}>{team.contact_phone}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.teamStatsBadge}>
              <Text style={styles.teamStatsNumber}>{members.length}</Text>
              <Text style={styles.teamStatsLabel}>Mitglieder</Text>
            </View>
          </View>
        </Card>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'members' && styles.tabActive]}
            onPress={() => setActiveTab('members')}
          >
            <Users size={18} color={activeTab === 'members' ? colors.primary : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
              Mitglieder ({members.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Members Tab */}
        {activeTab === 'members' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Team-Mitglieder</Text>
              <Button onClick={() => setIsAddMemberModalOpen(true)} variant="primary">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <UserPlus size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Mitarbeiter hinzufügen</Text>
                </View>
              </Button>
            </View>

            {members.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Users size={48} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>Noch keine Mitarbeiter</Text>
                <Text style={styles.emptyText}>
                  Fügen Sie Mitarbeiter zu Ihrem Team hinzu, um sie zu Projekten zuweisen zu können.
                </Text>
                <Button onClick={() => setIsAddMemberModalOpen(true)} variant="primary">
                  Ersten Mitarbeiter hinzufügen
                </Button>
              </Card>
            ) : (
              <View style={styles.membersList}>
                {members.map(member => (
                  <Card key={member.id} style={styles.memberCard}>
                    <View style={styles.memberRow}>
                      <View style={[styles.memberAvatar, member.team_role === 'team_admin' && styles.memberAvatarAdmin]}>
                        <Text style={styles.memberAvatarText}>{getInitials(member)}</Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <View style={styles.memberNameRow}>
                          <Text style={styles.memberName}>{getMemberName(member)}</Text>
                          {member.team_role === 'team_admin' && (
                            <View style={styles.adminBadge}>
                              <Crown size={12} color="#F59E0B" />
                              <Text style={styles.adminBadgeText}>Team Admin</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.memberEmail}>{member.email}</Text>
                        {member.joined_team_at && (
                          <Text style={styles.memberJoined}>
                            Beigetreten: {new Date(member.joined_team_at).toLocaleDateString('de-DE')}
                          </Text>
                        )}
                      </View>
                      {member.team_role !== 'team_admin' && (
                        <View style={styles.memberActions}>
                          <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => removeMember(member)}
                          >
                            <UserMinus size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Add Member Modal */}
      <ModernModal
        visible={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        title="Mitarbeiter zum Team hinzufügen"
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalHint}>
            Der Mitarbeiter muss bereits ein registriertes Konto haben. Geben Sie die E-Mail-Adresse ein, mit der sich der Mitarbeiter registriert hat.
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>E-Mail-Adresse *</Text>
            <Input
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="mitarbeiter@firma.de"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Vorname</Text>
              <Input
                value={newFirstName}
                onChangeText={setNewFirstName}
                placeholder="Max"
              />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Nachname</Text>
              <Input
                value={newLastName}
                onChangeText={setNewLastName}
                placeholder="Mustermann"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Telefon</Text>
            <Input
              value={newPhone}
              onChangeText={setNewPhone}
              placeholder="+49 123 456789"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.modalActions}>
            <Button onClick={() => setIsAddMemberModalOpen(false)} variant="secondary">Abbrechen</Button>
            <Button onClick={addMember} variant="primary" disabled={savingMember}>
              {savingMember ? 'Wird hinzugefügt...' : 'Hinzufügen'}
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
  emptyStateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48 },

  // Tabs
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 24, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 0 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: colors.primary },

  // Team Header
  teamHeader: { padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 24 },
  teamHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  teamIconContainer: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  teamHeaderInfo: { flex: 1 },
  teamName: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  teamDescription: { fontSize: 14, color: '#64748b', marginBottom: 8, lineHeight: 20 },
  teamMetaRow: { flexDirection: 'row', gap: 20 },
  teamMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamMetaText: { fontSize: 13, color: '#64748b' },
  teamStatsBadge: { alignItems: 'center', backgroundColor: '#F0F7FF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  teamStatsNumber: { fontSize: 28, fontWeight: '800', color: colors.primary },
  teamStatsLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' as any },

  // Section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },

  // Info Box
  infoBox: { padding: 16, backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 20 },
  infoBoxText: { fontSize: 13, color: '#1E40AF', lineHeight: 20 },

  // Empty
  emptyCard: { padding: 48, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 22, maxWidth: 400 },

  // Members
  membersList: { gap: 12 },
  memberCard: { padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  memberAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  memberAvatarAdmin: { backgroundColor: '#F59E0B' },
  memberAvatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  memberName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  adminBadgeText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  memberEmail: { fontSize: 13, color: '#64748b', marginBottom: 2 },
  memberJoined: { fontSize: 12, color: '#94a3b8' },
  memberActions: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FECACA' },
  iconButtonNeutral: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },

  // Roles
  rolesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  roleCard: { width: '48%' as any, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  roleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  roleIconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  roleActions: { flexDirection: 'row', gap: 8 },
  roleName: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  roleDescription: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 16 },
  roleStats: { flexDirection: 'row', gap: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.primary, marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' as any },

  // Modal
  modalContent: { gap: 20 },
  modalHint: { fontSize: 13, color: '#64748b', lineHeight: 20, backgroundColor: '#F0F7FF', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#DBEAFE' },
  formGroup: { gap: 8 },
  formRow: { flexDirection: 'row', gap: 12 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#475569' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },

  // Permissions
  permissionsSection: { marginTop: 8 },
  permissionsSectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  permissionsSectionSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 16 },
  permissionsList: { maxHeight: 400 },
  permissionItem: { padding: 16, backgroundColor: '#F8FAFC', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  permissionHeader: { marginBottom: 12 },
  permissionName: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  permissionDesc: { fontSize: 12, color: '#64748b' },
  permissionToggles: { flexDirection: 'row', gap: 8 },
  permToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 8, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  permToggleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  permToggleText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  permToggleTextActive: { color: '#fff' },
});
