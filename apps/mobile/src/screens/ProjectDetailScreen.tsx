import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Card, Button, StructureList } from '@docstruc/ui';
import { colors, spacing } from '@docstruc/theme';
import { supabase } from '../lib/supabase';
import { Project, generateReportHtml, Task } from '@docstruc/logic';
import { getProjectStructure, BuildingWithFloors, createBuilding, createFloor, createRoom, getProjectTasks } from '@docstruc/api';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system'; // Ensure this is installed or use Print's uri
import { useProjectStructureData, useProjectPermissions } from '@docstruc/hooks';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectDetail'>;

export function ProjectDetailScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const [project, setProject] = useState<Project | null>(null);
  const { data: structure, isLoading: loadingStructure, refetch, isRefetching } = useProjectStructureData(supabase, projectId);
  
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  const { data: permissions } = useProjectPermissions(supabase, projectId, userId || undefined);
  const canEdit = permissions?.canEditStructure ?? false;

  // We still load project details manually for now since we didn't hook-ify it yet
  const [loadingProject, setLoadingProject] = useState(true);

  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
  }, [projectId]);

  const loadProject = async (id: string) => {
    try {
      const { data, error } = await supabase.from('projects').select('id, owner_id, name, description, address, status, created_at, updated_at, subtitle, picture_url, detailed_address, start_date, target_end_date').eq('id', id).single();
      if (error) throw error;
      setProject(data);
    } catch (e) {
      console.error(e);
      // Don't alert if we might have cached structure, just show what we have
      if (!structure) alert('Error fetching project'); 
    } finally {
      setLoadingProject(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!project) return;
    try {
      const tasks = await getProjectTasks(supabase, project.id);
      const html = generateReportHtml(project, structure || [], tasks);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (e) {
      Alert.alert('Fehler', 'Konnte Bericht nicht erstellen: ' + (e as any).message);
    }
  };

  const handleAddBuilding = async (name: string) => {
    if (!canEdit) {
       Alert.alert('Fehlende Berechtigung', 'Nur Projektleiter können Gebäude erstellen.');
       return;
    }
    if (!project) return;
    const { error } = await createBuilding(supabase, project.id, name);
    if (error) alert(error.message);
    else refetch();
  };

  const handleAddFloor = async (buildingId: string, name: string) => {
    if (!canEdit) {
      Alert.alert('Fehlende Berechtigung', 'Nur Projektleiter können Etagen erstellen.');
      return;
    }
    if (!project) return;
    const { error } = await createFloor(supabase, buildingId, name, 0); 
    if (error) alert(error.message);
    else refetch();
  };

  const handleAddRoom = async (floorId: string, name: string) => {
    if (!canEdit) {
      Alert.alert('Fehlende Berechtigung', 'Nur Projektleiter können Räume erstellen.');
      return;
    }
    if (!project) return;
    const { error } = await createRoom(supabase, floorId, name);
    if (error) alert(error.message);
    else refetch();
  };

  const handleRoomPress = (room: any) => {
    if (!project) return;
    navigation.navigate('RoomDetail', { room, projectId: project.id, canCreateTask: permissions?.canCreateTask ?? false });
  };
  if (loadingProject && !project) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!project) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        {/* ...existing code... */}
        <View style={styles.section}>
          <Text style={styles.label}>Adresse</Text>
          <Text style={styles.value}>{project.address || '-'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Status</Text>
          <Text style={[styles.value, { color: colors.primary, fontWeight: 'bold' }]}>
            {project.status.toUpperCase()}
          </Text>
        </View>

        <View style={styles.section}>
           <Text style={styles.label}>Created</Text>
           <Text style={styles.value}>{new Date(project.created_at).toLocaleDateString()}</Text>
        </View>

        <View style={{ marginTop: spacing.m }}>
           <Button variant="secondary" onClick={handleGenerateReport}>📄 Bericht erstellen (PDF)</Button>
        </View>
      </Card>

      <Text style={styles.heading}>Struktur</Text>
      <View style={{ marginBottom: 40 }}>
        {loadingStructure && !structure ? (
          <ActivityIndicator />
        ) : (
          <StructureList 
            structure={structure || []} 
            onAddBuilding={handleAddBuilding}
            onAddFloor={handleAddFloor}
            onAddRoom={handleAddRoom}
            onRoomPress={handleRoomPress}
            canEdit={canEdit}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ...existing styles...
});
