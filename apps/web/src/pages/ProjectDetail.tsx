import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, StructureList, RoomDetailView, Input } from '@docstruc/ui';
import { colors, spacing } from '@docstruc/theme';
import { supabase } from '../lib/supabase';
import { Project, generateReportHtml } from '@docstruc/logic';
import { getProjectStructure, BuildingWithFloors, createBuilding, createFloor, createRoom, getProjectTasks, getProjectMembers, MemberWithUser, getProjectTimeline, createTimelineEvent, toggleTimelineEvent, TimelineEvent } from '@docstruc/api';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useProjectPermissions } from '@docstruc/hooks';
import { useLayout } from '../layouts/LayoutContext';
import { ModernModal } from '../components/ModernModal';
import { useToast } from '../components/ToastProvider';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setTitle, setSubtitle, setActions } = useLayout();
  const { showToast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [structure, setStructure] = useState<BuildingWithFloors[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  
  // Members State
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  
  // Timeline State
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineTitle, setTimelineTitle] = useState('');
  const [timelineDate, setTimelineDate] = useState('');
  
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  useEffect(() => {
    if (project) {
        setTitle(project.name);
        setSubtitle(project.address || '');
    } else {
        setTitle('Lade Projekt...');
        setSubtitle('');
    }
  }, [project, setTitle, setSubtitle]);

  useEffect(() => {
    setActions(
         <Button variant="outline" onClick={() => navigate('/')}>← Zurück</Button>
    );
    return () => { setActions(null); setSubtitle(''); };
  }, [setActions, setSubtitle, navigate]);

  const { data: permissions } = useProjectPermissions(supabase, id || '', userId || undefined);
  const canEdit = permissions?.canEditStructure ?? false;

  useEffect(() => {
    if (id) {
      loadData(id);
      loadMembers(id);
      loadTimeline(id);
    }
  }, [id]);

  const loadTimeline = async (projectId: string) => {
    try {
      const data = await getProjectTimeline(supabase, projectId);
      setTimeline(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddTimelineEvent = async () => {
    if (!id || !timelineTitle || !timelineDate) return;
    try {
      await createTimelineEvent(supabase, {
        project_id: id,
        title: timelineTitle,
        date: timelineDate,
        eventType: 'milestone'
      });
      setTimelineTitle('');
      setTimelineDate('');
      loadTimeline(id);
      showToast('Meilenstein hinzugefügt', 'success');
    } catch (e) {
      showToast('Fehler beim Hinzufügen des Meilensteins', 'error');
    }
  };

  const handleToggleTimeline = async (eventId: string, current: boolean) => {
      await toggleTimelineEvent(supabase, eventId, !current);
      if (id) loadTimeline(id);
  };

  const loadMembers = async (projectId: string) => {
      try {
          const m = await getProjectMembers(supabase, projectId);
          setMembers(m);
      } catch (e) {
          console.error(e); 
      }
  };

  const handleAddMember = async () => {
      if (!id || !inviteEmail) return;
      try {
          const { data: users } = await supabase.from('profiles').select('id').eq('email', inviteEmail).single();
          if (users) {
              await supabase.from('project_members').insert({
                  project_id: id,
                  user_id: users.id,
                  role: 'viewer'
              });
              showToast('Benutzer hinzugefügt!', 'success');
              setInviteEmail('');
              loadMembers(id);
          } else {
              showToast('Benutzer nicht gefunden. Registrierung erforderlich.', 'error');
          }
      } catch (e) {
          showToast('Fehler beim Hinzufügen des Mitglieds', 'error');
      }
  };

  const handleGenerateReport = async () => {
    if (!project) return;
    try {
      const tasks = await getProjectTasks(supabase, project.id);
      const html = generateReportHtml(project, structure, tasks);
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
      }
    } catch (e) {
      console.error(e);
      showToast('Fehler beim Erstellen des Berichts', 'error');
    }
  };

  const loadData = async (projectId: string) => {
    try {
      const [projectRes, structureRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        getProjectStructure(supabase, projectId)
      ]);

      if (projectRes.error) throw projectRes.error;
      
      setProject(projectRes.data);
      setStructure(structureRes);
    } catch (e) {
      console.error('Error loading project data:', e);
      showToast('Fehler beim Laden des Projekts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBuilding = async (name: string) => {
    if (!canEdit) {
      showToast('Fehlende Berechtigung: Nur Projektleiter können Gebäude erstellen.', 'error');
      return;
    }
    if (!project) return;
    const { error } = await createBuilding(supabase, project.id, name);
    if (error) showToast(error.message, 'error');
    else loadData(project.id);
  };

  const handleAddFloor = async (buildingId: string, name: string) => {
    if (!canEdit) {
      showToast('Fehlende Berechtigung', 'error');
      return;
    }
    if (!project) return;
    const { error } = await createFloor(supabase, buildingId, name, 0);
    if (error) showToast(error.message, 'error');
    else loadData(project.id);
  };

  const handleAddRoom = async (floorId: string, name: string) => {
    if (!canEdit) {
      showToast('Fehlende Berechtigung', 'error');
      return;
    }
    if (!project) return;
    const { error } = await createRoom(supabase, floorId, name);
    if (error) showToast(error.message, 'error');
    else loadData(project.id);
  };

  const handleRoomPress = (room: any) => {
    setSelectedRoom(room);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!project) return null;

  return (
    <>
      {/* Main Content Grid */}
      <View style={styles.topRow}> 
        {/* Left Column — Overview */}
        <View style={styles.leftCol}>
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Projektübersicht</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Adresse</Text>
              <Text style={styles.infoValue}>{project.address || 'Keine Adresse hinterlegt'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{project.status.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.reportBtnWrap}>
               <Button variant="secondary" onClick={handleGenerateReport}>📄 Bericht erstellen</Button>
            </View>
          </Card>
        </View>

        {/* Right Column — Members + Timeline */}
        <View style={styles.rightCol}>
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Mitglieder</Text>
            {members.length === 0 && <Text style={styles.emptyText}>Noch keine Mitglieder.</Text>}
            {members.map(m => (
                <View key={m.id} style={styles.memberRow}>
                    <Text style={styles.memberEmail}>{m.user?.email || 'Unbekannt'}</Text>
                    <View style={styles.roleBadge}>
                        <Text style={styles.roleText}>{m.role}</Text>
                    </View>
                </View>
            ))}
            
            <View style={styles.inviteSection}>
                <Text style={styles.inviteLabel}>Benutzer einladen</Text>
                <View style={styles.inviteRow}>
                   <View style={{ flex: 1 }}>
                     <Input placeholder="email@example.com" value={inviteEmail} onChangeText={setInviteEmail} />
                   </View>
                   <Button onClick={handleAddMember}>Einladen</Button>
                </View>
            </View>
          </Card>

          <Card style={[styles.sectionCard, { flex: 1 }]}>
            <Text style={styles.sectionTitle}>Timeline</Text>
            <View style={styles.timelineList}>
                {timeline.map(event => (
                    <View key={event.id} style={[styles.timelineItem, event.completed && styles.timelineCompleted]}>
                         <TouchableOpacity 
                            onPress={() => handleToggleTimeline(event.id, event.completed)} 
                            style={[styles.timelineCheckbox, event.completed && styles.timelineCheckboxDone]}
                         />
                         <View style={{ flex: 1 }}>
                            <Text style={[styles.timelineTitle, event.completed && styles.timelineTitleDone]}>{event.title}</Text>
                            <Text style={styles.timelineDate}>{new Date(event.date).toLocaleDateString('de-DE')} • {event.eventType}</Text>
                         </View>
                    </View>
                ))}
                {timeline.length === 0 && <Text style={styles.emptyText}>Keine Meilensteine gesetzt.</Text>}
            </View>
            
            {canEdit && (
                <View style={styles.addTimelineForm}>
                    <Input placeholder="Neuer Meilenstein" value={timelineTitle} onChangeText={setTimelineTitle} />
                    <Input placeholder="YYYY-MM-DD" value={timelineDate} onChangeText={setTimelineDate} />
                    <Button onClick={handleAddTimelineEvent}>Hinzufügen</Button> 
                </View>
            )}
          </Card>
        </View>
      </View>

      {/* Structure Section */}
      <Card style={[styles.sectionCard, { marginTop: 20 }]}>
        <StructureList 
          structure={structure} 
          onAddBuilding={handleAddBuilding}
          onAddFloor={handleAddFloor}
          onAddRoom={handleAddRoom}
          onRoomPress={handleRoomPress}
          canEdit={canEdit}
        />
      </Card>

      {/* Room Detail Modal */}
      <ModernModal
        visible={!!selectedRoom}
        onClose={() => setSelectedRoom(null)}
        title={selectedRoom?.name || 'Raum Details'}
        maxWidth={800}
      >
        {selectedRoom && project && (
          <View style={styles.roomDetailContainer}>
            <RoomDetailView 
              room={selectedRoom} 
              projectId={project.id}
              onClose={() => setSelectedRoom(null)}
              canCreateTask={permissions?.canCreateTask ?? false}
              client={supabase}
            />
          </View>
        )}
      </ModernModal>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%' as any,
  },
  topRow: {
    flexDirection: 'row',
    gap: 24,
  },
  leftCol: {
    flex: 2,
  },
  rightCol: {
    flex: 1,
    gap: 20,
  },
  sectionCard: {
    padding: spacing.l,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  infoRow: {
    marginBottom: spacing.m,
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase' as any,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  reportBtnWrap: {
    marginTop: spacing.m,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  memberEmail: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  roleText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  inviteSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  inviteLabel: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 8,
    color: colors.text,
  },
  inviteRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timelineList: {
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  timelineCompleted: {
    opacity: 0.5,
  },
  timelineCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  timelineCheckboxDone: {
    backgroundColor: colors.primary,
  },
  timelineTitle: {
    fontWeight: '600',
    fontSize: 14,
    color: colors.text,
  },
  timelineTitleDone: {
    textDecorationLine: 'line-through',
  },
  timelineDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addTimelineForm: {
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  roomDetailContainer: {
    minHeight: 400,
    width: '100%',
  },
});
