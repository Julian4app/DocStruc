import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { colors, spacing } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { ModernModal } from '../../components/ModernModal';
import { useToast } from '../../components/ToastProvider';
import { Users, Mail, Phone, Building } from 'lucide-react';

interface ProjectMember {
  id: string;
  role: string;
  user: {
    email: string;
  };
  profile?: {
    first_name?: string;
    last_name?: string;
  };
}

interface AssignedPerson {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  department?: string;
  company_name?: string;
  trade?: string;
  name?: string;
}

export function ProjectParticipants() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [employees, setEmployees] = useState<AssignedPerson[]>([]);
  const [owners, setOwners] = useState<AssignedPerson[]>([]);
  const [subcontractors, setSubcontractors] = useState<AssignedPerson[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  useEffect(() => {
    if (id) {
      loadParticipants();
    }
  }, [id]);

  const loadParticipants = async () => {
    if (!id) return;
    setLoading(true);

    try {
      // Load project members (accounts)
      const { data: membersData, error: membersError } = await supabase
        .from('project_members')
        .select(`
          id,
          role,
          user:profiles!project_members_user_id_fkey(email, first_name, last_name)
        `)
        .eq('project_id', id);

      if (membersError) throw membersError;
      
      // Transform the data to match our interface
      const transformedMembers = (membersData || []).map(m => ({
        ...m,
        user: Array.isArray(m.user) ? m.user[0] : m.user,
        profile: Array.isArray(m.user) ? m.user[0] : m.user
      })) as any;
      
      setMembers(transformedMembers);

      // Load assigned employees
      const { data: empLinks } = await supabase
        .from('project_crm_links')
        .select('crm_contact_id, link_type')
        .eq('project_id', id);

      if (empLinks) {
        const employeeIds = empLinks.filter(l => l.link_type === 'employee').map(l => l.crm_contact_id);
        const ownerIds = empLinks.filter(l => l.link_type === 'owner').map(l => l.crm_contact_id);

        if (employeeIds.length > 0) {
          const { data: empData } = await supabase
            .from('crm_contacts')
            .select('*')
            .in('id', employeeIds);
          setEmployees(empData || []);
        }

        if (ownerIds.length > 0) {
          const { data: ownerData } = await supabase
            .from('crm_contacts')
            .select('*')
            .in('id', ownerIds);
          setOwners(ownerData || []);
        }
      }

      // Load assigned subcontractors
      const { data: subLinks } = await supabase
        .from('project_subcontractors')
        .select('subcontractor_id')
        .eq('project_id', id);

      if (subLinks && subLinks.length > 0) {
        const subIds = subLinks.map(l => l.subcontractor_id);
        const { data: subData } = await supabase
          .from('subcontractors')
          .select('*')
          .in('id', subIds);
        setSubcontractors(subData || []);
      }
    } catch (error: any) {
      console.error('Error loading participants:', error);
      showToast('Fehler beim Laden der Beteiligten', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      showToast('Bitte E-Mail-Adresse eingeben', 'error');
      return;
    }

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteEmail)
        .single();

      if (!profile) {
        showToast('Benutzer nicht gefunden. Registrierung erforderlich.', 'error');
        return;
      }

      const { error } = await supabase.from('project_members').insert({
        project_id: id,
        user_id: profile.id,
        role: 'viewer'
      });

      if (error) throw error;

      showToast('Benutzer erfolgreich eingeladen', 'success');
      setIsInviteModalOpen(false);
      setInviteEmail('');
      loadParticipants();
    } catch (error: any) {
      console.error('Error inviting member:', error);
      showToast('Fehler beim Einladen des Benutzers', 'error');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return '#8B5CF6';
      case 'editor': return '#3B82F6';
      case 'viewer': return '#10B981';
      default: return '#94a3b8';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'Eigentümer';
      case 'editor': return 'Bearbeiter';
      case 'viewer': return 'Betrachter';
      default: return role;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Beteiligte</Text>
            <Text style={styles.pageSubtitle}>
              Verwaltung aller Projektbeteiligten
            </Text>
          </View>
          <Button onClick={() => setIsInviteModalOpen(true)}>
            <Users size={18} /> Benutzer einladen
          </Button>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Project Members (Accounts) */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Users size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Projektmitglieder ({members.length})</Text>
            </View>
            <Text style={styles.sectionDesc}>
              Benutzer mit Zugriff auf dieses Projekt
            </Text>
            {members.length === 0 ? (
              <Text style={styles.emptyText}>Noch keine Mitglieder</Text>
            ) : (
              <View style={styles.membersList}>
                {members.map((member) => (
                  <View key={member.id} style={styles.memberCard}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {member.user?.email?.[0]?.toUpperCase() || 'U'}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {member.profile?.first_name && member.profile?.last_name
                          ? `${member.profile.first_name} ${member.profile.last_name}`
                          : 'Unbenannt'}
                      </Text>
                      <View style={styles.memberMeta}>
                        <Mail size={12} color="#94a3b8" />
                        <Text style={styles.memberEmail}>{member.user?.email}</Text>
                      </View>
                    </View>
                    <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(member.role) }]}>
                      <Text style={styles.roleBadgeText}>{getRoleLabel(member.role)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>

          {/* Employees */}
          {employees.length > 0 && (
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Users size={20} color="#3B82F6" />
                <Text style={styles.sectionTitle}>Mitarbeiter ({employees.length})</Text>
              </View>
              <View style={styles.personsList}>
                {employees.map((emp) => (
                  <View key={emp.id} style={styles.personCard}>
                    <View style={styles.personInfo}>
                      <Text style={styles.personName}>
                        {emp.first_name} {emp.last_name}
                      </Text>
                      {emp.department && (
                        <Text style={styles.personMeta}>{emp.department}</Text>
                      )}
                      {emp.email && (
                        <View style={styles.contactRow}>
                          <Mail size={12} color="#94a3b8" />
                          <Text style={styles.contactText}>{emp.email}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* Owners */}
          {owners.length > 0 && (
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Building size={20} color="#8B5CF6" />
                <Text style={styles.sectionTitle}>Bauherren ({owners.length})</Text>
              </View>
              <View style={styles.personsList}>
                {owners.map((owner) => (
                  <View key={owner.id} style={styles.personCard}>
                    <View style={styles.personInfo}>
                      <Text style={styles.personName}>
                        {owner.first_name} {owner.last_name}
                      </Text>
                      {owner.company_name && (
                        <Text style={styles.personMeta}>{owner.company_name}</Text>
                      )}
                      {owner.email && (
                        <View style={styles.contactRow}>
                          <Mail size={12} color="#94a3b8" />
                          <Text style={styles.contactText}>{owner.email}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* Subcontractors */}
          {subcontractors.length > 0 && (
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Building size={20} color="#F59E0B" />
                <Text style={styles.sectionTitle}>Gewerke ({subcontractors.length})</Text>
              </View>
              <View style={styles.personsList}>
                {subcontractors.map((sub) => (
                  <View key={sub.id} style={styles.personCard}>
                    <View style={styles.personInfo}>
                      <Text style={styles.personName}>
                        {sub.name || sub.company_name}
                      </Text>
                      {sub.trade && (
                        <Text style={styles.personMeta}>{sub.trade}</Text>
                      )}
                      {sub.email && (
                        <View style={styles.contactRow}>
                          <Mail size={12} color="#94a3b8" />
                          <Text style={styles.contactText}>{sub.email}</Text>
                        </View>
                      )}
                      {sub.phone && (
                        <View style={styles.contactRow}>
                          <Phone size={12} color="#94a3b8" />
                          <Text style={styles.contactText}>{sub.phone}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {employees.length === 0 && owners.length === 0 && subcontractors.length === 0 && (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Keine Personen oder Gewerke zugeordnet
              </Text>
            </Card>
          )}
        </ScrollView>
      </View>

      {/* Invite Modal */}
      <ModernModal
        visible={isInviteModalOpen}
        onClose={() => {
          setIsInviteModalOpen(false);
          setInviteEmail('');
        }}
        title="Benutzer einladen"
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalDesc}>
            Laden Sie einen registrierten Benutzer zu diesem Projekt ein.
          </Text>
          <Input
            label="E-Mail-Adresse"
            value={inviteEmail}
            onChangeText={setInviteEmail}
            placeholder="email@example.com"
          />
          <View style={styles.modalActions}>
            <Button
              variant="outline"
              onClick={() => setIsInviteModalOpen(false)}
              style={{ flex: 1 }}
            >
              Abbrechen
            </Button>
            <Button onClick={handleInviteMember} style={{ flex: 1 }}>
              Einladen
            </Button>
          </View>
        </View>
      </ModernModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#64748b',
  },
  content: {
    flex: 1,
  },
  sectionCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionDesc: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  emptyCard: {
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  membersList: {
    gap: 12,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberEmail: {
    fontSize: 13,
    color: '#64748b',
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  personsList: {
    gap: 12,
  },
  personCard: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  personInfo: {
    gap: 6,
  },
  personName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  personMeta: {
    fontSize: 13,
    color: '#64748b',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    fontSize: 13,
    color: '#64748b',
  },
  modalContent: {
    gap: 16,
  },
  modalDesc: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
});
