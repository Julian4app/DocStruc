import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { colors } from '@docstruc/theme';
import { supabase } from '../lib/supabase';
import { Project } from '@docstruc/logic';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLayout } from '../layouts/LayoutContext';
import { LayoutDashboard, Info, Calendar, Users as UsersIcon, CheckSquare, AlertCircle, Building2, FileText, FolderOpen, BookOpen, MessageSquare, BarChart3, Activity, Settings } from 'lucide-react';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setTitle, setSubtitle, setActions, setSidebarMenu } = useLayout();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadProject(id);
    }
  }, [id]);

  const loadProject = async (projectId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error: any) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (project) {
        setTitle(project.name);
        setSubtitle(project.address || '');
        setSidebarMenu([
          {label:'Dashboard',path:`/project/${id}`,icon:LayoutDashboard},
          {label:'Allgemeine Info',path:`/project/${id}/general-info`,icon:Info},
          {label:'Aufgaben',path:`/project/${id}/tasks`,icon:CheckSquare},
          {label:'Mängel',path:`/project/${id}/defects`,icon:AlertCircle},
          {label:'Termine & Ablauf',path:`/project/${id}/schedule`,icon:Calendar},
          {label:'Objektplan',path:`/project/${id}/objektplan`,icon:Building2},
          {label:'Dokumentation',path:`/project/${id}/documentation`,icon:FileText},
          {label:'Dokumente',path:`/project/${id}/files`,icon:FolderOpen},
          {label:'Bautagebuch',path:`/project/${id}/diary`,icon:BookOpen},
          {label:'Kommunikation',path:`/project/${id}/communication`,icon:MessageSquare},
          {label:'Beteiligte',path:`/project/${id}/participants`,icon:UsersIcon},
          {label:'Berichte & Exporte',path:`/project/${id}/reports`,icon:BarChart3},
          {label:'Aktivitäten',path:`/project/${id}/activity`,icon:Activity},
          {label:'Einstellungen',path:`/project/${id}/settings`,icon:Settings}
        ]);
    } else {
        setTitle('Lade Projekt...');
        setSubtitle('');
    }
  }, [project, setTitle, setSubtitle, setSidebarMenu, id]);

  useEffect(() => {
    return () => {setActions(null);setSubtitle('');};
  }, [setActions, setSubtitle]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!project) return null;

  return <Outlet />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%' as any,
  },
});
