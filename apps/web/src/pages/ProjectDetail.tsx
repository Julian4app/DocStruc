import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { colors } from '@docstruc/theme';
import { supabase } from '../lib/supabase';
import { Project } from '@docstruc/logic';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLayout } from '../layouts/LayoutContext';
import { usePermissions } from '../hooks/usePermissions';
import { LayoutDashboard, Info, Calendar, Users as UsersIcon, CheckSquare, AlertCircle, Building2, FileText, FolderOpen, BookOpen, MessageSquare, BarChart3, Activity, Lock } from 'lucide-react';

// Map route paths to permission module_keys
const ROUTE_MODULE_MAP: Record<string, string> = {
  'general-info': 'general_info',
  'tasks': 'tasks',
  'defects': 'defects',
  'schedule': 'schedule',
  'objektplan': 'documentation',  // Objektplan falls under documentation
  'documentation': 'documentation',
  'files': 'files',
  'diary': 'diary',
  'communication': 'communication',
  'participants': 'participants',
  'reports': 'reports',
  'activity': 'activity',
};

// All sidebar items with their module_key for permission check
const ALL_SIDEBAR_ITEMS = [
  { label: 'Dashboard', route: '', icon: LayoutDashboard, moduleKey: null }, // always visible
  { label: 'Allgemeine Info', route: 'general-info', icon: Info, moduleKey: 'general_info' },
  { label: 'Aufgaben', route: 'tasks', icon: CheckSquare, moduleKey: 'tasks' },
  { label: 'Mängel', route: 'defects', icon: AlertCircle, moduleKey: 'defects' },
  { label: 'Termine & Ablauf', route: 'schedule', icon: Calendar, moduleKey: 'schedule' },
  { label: 'Objektplan', route: 'objektplan', icon: Building2, moduleKey: 'documentation' },
  { label: 'Dokumentation', route: 'documentation', icon: FileText, moduleKey: 'documentation' },
  { label: 'Dokumente', route: 'files', icon: FolderOpen, moduleKey: 'files' },
  { label: 'Bautagebuch', route: 'diary', icon: BookOpen, moduleKey: 'diary' },
  { label: 'Kommunikation', route: 'communication', icon: MessageSquare, moduleKey: 'communication' },
  { label: 'Beteiligte', route: 'participants', icon: UsersIcon, moduleKey: 'participants' },
  { label: 'Berichte & Exporte', route: 'reports', icon: BarChart3, moduleKey: 'reports' },
  { label: 'Aktivitäten', route: 'activity', icon: Activity, moduleKey: 'activity' },
];

export { ROUTE_MODULE_MAP };

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setTitle, setSubtitle, setActions, setSidebarMenu } = useLayout();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const { permissions, isLoading: permissionsLoading, isProjectOwner, canView, canCreate, canEdit, canDelete } = usePermissions(id);

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
    if (project && !permissionsLoading) {
        setTitle(project.name);
        setSubtitle(project.address || '');

        // Filter sidebar items based on permissions
        const filteredItems = ALL_SIDEBAR_ITEMS
          .filter(item => {
            // Dashboard is always visible
            if (item.moduleKey === null) return true;
            // Project owner sees everything
            if (isProjectOwner) return true;
            // Check if user has view permission for this module
            return canView(item.moduleKey);
          })
          .map(item => ({
            label: item.label,
            path: item.route === '' ? `/project/${id}` : `/project/${id}/${item.route}`,
            icon: item.icon,
          }));

        setSidebarMenu(filteredItems);
    } else if (!project && !loading) {
        setTitle('Projekt nicht gefunden');
        setSubtitle('');
    } else {
        setTitle('Lade Projekt...');
        setSubtitle('');
    }
  }, [project, permissionsLoading, permissions, isProjectOwner, setTitle, setSubtitle, setSidebarMenu, id]);

  useEffect(() => {
    return () => {setActions(null);setSubtitle('');};
  }, [setActions, setSubtitle]);

  if (loading || permissionsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!project) return null;

  return <Outlet context={{ permissions, isProjectOwner, canView, canCreate, canEdit, canDelete, permissionsLoading }} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%' as any,
  },
});
