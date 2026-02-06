import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, StructureList, RoomDetailView, CustomModal } from '@docstruc/ui';
import { colors, spacing } from '@docstruc/theme';
import { supabase } from '../lib/supabase';
import { Project, generateReportHtml } from '@docstruc/logic';
import { getProjectStructure, BuildingWithFloors, createBuilding, createFloor, createRoom, getProjectTasks } from '@docstruc/api';
import { View, Text, ActivityIndicator } from 'react-native';
import { useProjectPermissions } from '@docstruc/hooks';
import { MainLayout } from '../components/MainLayout';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [structure, setStructure] = useState<BuildingWithFloors[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  
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
    }
  }, [id]);

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
