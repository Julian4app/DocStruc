import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, StructureList, RoomDetailView, CustomModal, Input } from '@docstruc/ui';
import { colors, spacing } from '@docstruc/theme';
import { supabase } from '../lib/supabase';
import { Project, generateReportHtml } from '@docstruc/logic';
import { getProjectStructure, BuildingWithFloors, createBuilding, createFloor, createRoom, getProjectTasks, getProjectMembers, MemberWithUser, getProjectTimeline, createTimelineEvent, toggleTimelineEvent, TimelineEvent } from '@docstruc/api';
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useProjectPermissions } from '@docstruc/hooks';
import { MainLayout } from '../components/MainLayout';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  const { data: permissions } = useProjectPermissions(supabase, id || '', userId || undefined);
  // Default to false while loading
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
        eventType: 'milestone' // Default
      });
      setTimelineTitle('');
      setTimelineDate('');
      loadTimeline(id);
    } catch (e) {
      alert('Error adding event');
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
          // 1. Find user by email
          const { data: users } = await supabase.from('profiles').select('id').eq('email', inviteEmail).single();
          if (users) {
              await supabase.from('project_members').insert({
                  project_id: id,
                  user_id: users.id,
                  role: 'viewer'
              });
              alert('User added!');
              setInviteEmail('');
              loadMembers(id);
          } else {
              alert('User not found. They must sign up first.');
          }
      } catch (e) {
          alert('Error adding member');
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
      alert('Error generating report');
    }
  };

  const loadData = async (projectId: string) => {
    try {
      // Parallel fetch
      const [projectRes, structureRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        getProjectStructure(supabase, projectId)
      ]);

      if (projectRes.error) throw projectRes.error;
      
      setProject(projectRes.data);
      setStructure(structureRes);
    } catch (e) {
      console.error('Error loading project data:', e);
      alert('Error loading project');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBuilding = async (name: string) => {
    if (!canEdit) {
      alert('Fehlende Berechtigung: Nur Projektleiter können Gebäude erstellen.');
      return;
    }
    if (!project) return;
    const { error } = await createBuilding(supabase, project.id, name);
    if (error) alert(error.message);
    else loadData(project.id);
  };

  const handleAddFloor = async (buildingId: string, name: string) => {
    if (!canEdit) {
      alert('Fehlende Berechtigung');
      return;
    }
    if (!project) return;
    const { error } = await createFloor(supabase, buildingId, name, 0); // TODO: manageable index
    if (error) alert(error.message);
    else loadData(project.id);
  };

  const handleAddRoom = async (floorId: string, name: string) => {
    if (!canEdit) {
      alert('Fehlende Berechtigung');
      return;
    }
    if (!project) return;
    const { error } = await createRoom(supabase, floorId, name);
    if (error) alert(error.message);
    else loadData(project.id);
  };

  const handleRoomPress = (room: any) => {
    setSelectedRoom(room);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!project) return null;

  return (
    <MainLayout
      title={project.name}
      actions={
         <Button variant="outline" onClick={() => navigate('/')}>← Zurück</Button>
      }
    >
      <View style={{ flexDirection: 'row', gap: 24 }}> 
      <View style={{ flex: 2 }}>
      <Card style={{ padding: spacing.l }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: spacing.m, color: colors.text }}>Projektübersicht</Text>
        
        <View style={{ marginBottom: spacing.m }}>
          <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>Adresse</Text>
          <Text style={{ fontSize: 16, color: colors.text }}>{project.address || 'Keine Adresse hinterlegt'}</Text>
        </View>

        <View style={{ marginBottom: spacing.m }}>
          <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>Status</Text>
          <Text style={{ fontSize: 16, color: colors.text, fontWeight: '500' }}>{project.status.toUpperCase()}</Text>
        </View>

        <View style={{ marginTop: spacing.m }}>
           <Button variant="secondary" onClick={handleGenerateReport}>📄 Bericht erstellen</Button>
        </View>
      </Card>
      </View>

      <View style={{ flex: 1 }}>
        <Card style={{ padding: spacing.l, marginBottom: spacing.m }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Members</Text>
            {members.length === 0 && <Text style={{color: colors.textSecondary}}>No members yet.</Text>}
            {members.map(m => (
                <View key={m.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text>{m.user?.email || 'Unknown'}</Text>
                    <Text style={{ color: colors.textSecondary }}>{m.role}</Text>
                </View>
            ))}
            
            <View style={{ marginTop: 16 }}>
                <Text style={{ fontWeight: '600', marginBottom: 4 }}>Invite User</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                   <View style={{ flex: 1 }}>
                     <Input placeholder="email@example.com" value={inviteEmail} onChangeText={setInviteEmail} />
                   </View>
                   <Button onClick={handleAddMember}>Invite</Button>
                </View>
            </View>
        </Card>

        <Card style={{ padding: spacing.l, height: '100%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Timeline</Text>
            <View style={{ marginBottom: 16 }}>
                {timeline.map(event => (
                    <View key={event.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, opacity: event.completed ? 0.5 : 1 }}>
                         <TouchableOpacity onPress={() => handleToggleTimeline(event.id, event.completed)} style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.primary, marginRight: 8, backgroundColor: event.completed ? colors.primary : 'transparent' }} />
                         <View>
                            <Text style={{ fontWeight: '600', textDecorationLine: event.completed ? 'line-through' : 'none' }}>{event.title}</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{new Date(event.date).toLocaleDateString()} • {event.eventType}</Text>
                         </View>
                    </View>
                ))}
                {timeline.length === 0 && <Text style={{color: colors.textSecondary}}>No milestones set.</Text>}
            </View>
            
            {canEdit && (
                <View style={{ gap: 8 }}>
                    <Input placeholder="New Milestone Title" value={timelineTitle} onChangeText={setTimelineTitle} />
                    <Input placeholder="YYYY-MM-DD" value={timelineDate} onChangeText={setTimelineDate} />
                    <Button onClick={handleAddTimelineEvent}>Add Milestone</Button> 
                </View>
            )}
        </Card>
      </View>
      </View>

      <Card style={{ padding: spacing.l, marginTop: 20 }}>
        <StructureList 
          structure={structure} 
          onAddBuilding={handleAddBuilding}
          onAddFloor={handleAddFloor}
          onAddRoom={handleAddRoom}
          onRoomPress={handleRoomPress}
          canEdit={canEdit}
        />
      </Card>

      <CustomModal
        visible={!!selectedRoom}
        onClose={() => setSelectedRoom(null)}
        title=""
      >
        {selectedRoom && project && (
          <View style={{ minHeight: 400, width: '100%' }}>
            <RoomDetailView 
              room={selectedRoom} 
              projectId={project.id}
              onClose={() => setSelectedRoom(null)}
              canCreateTask={permissions?.canCreateTask ?? false}
              client={supabase}
            />
          </View>
        )}
      </CustomModal>

    </MainLayout>
  );
}
