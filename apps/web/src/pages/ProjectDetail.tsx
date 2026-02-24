import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { colors } from '@docstruc/theme';
import { supabase } from '../lib/supabase';
import { Project } from '@docstruc/logic';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LottieLoader } from '../components/LottieLoader';

import { useLayout } from '../layouts/LayoutContext';
import { usePermissions } from '../hooks/usePermissions';
import { prefetchProjectChunks } from '../App';

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const { permissions, isLoading: permissionsLoading, isProjectOwner, isSuperuser, isTeamAdmin, canView, canCreate, canEdit, canDelete } = usePermissions(id);

  // Ref to prevent concurrent loadProject calls from racing
  const loadInFlightRef = React.useRef(false);
  // Track whether we loaded at least once — after that, refetches are silent
  const hasLoadedProjectRef = React.useRef(false);
  // Ref mirrors project state so loadProject can read it without depending on it
  const projectRef = React.useRef<Project | null>(null);

  const loadProject = React.useCallback(async (projectId: string) => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;

    // Only show spinner if we don't have project data yet (silent refetch otherwise)
    if (!hasLoadedProjectRef.current) {
      setLoading(true);
    }
    setLoadError(null);

    // Helper: run the query with a per-attempt timeout so a hung connection
    // fails fast and can be retried instead of waiting 30+ seconds.
    const fetchProject = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const result = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .abortSignal(controller.signal)
          .single();
        return result;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    try {
      let result = await fetchProject();

      // On transient error (network/abort), retry once after a brief delay
      if (result.error && (result.error.message?.includes('aborted') || result.error.message?.includes('fetch') || result.error.code === 'NETWORK_ERROR')) {
        await new Promise(r => setTimeout(r, 1500));
        result = await fetchProject();
      }

      const { data, error } = result;

      if (error) {
        if (error.code === '42P17' || error.message?.includes('infinite recursion')) {
          console.error('ProjectDetail: RLS recursion', error);
          if (!hasLoadedProjectRef.current) setLoadError('Datenbankfehler. Bitte wenden Sie sich an den Administrator.');
        } else if (error.code === 'PGRST116') {
          if (!hasLoadedProjectRef.current) setLoadError('Projekt nicht gefunden oder kein Zugriff.');
        } else {
          console.error('ProjectDetail: error loading project:', error);
          if (!hasLoadedProjectRef.current) {
            setLoadError('Projekt konnte nicht geladen werden.');
          }
        }
        return;
      }
      projectRef.current = data;
      setProject(data);
      hasLoadedProjectRef.current = true;
    } catch (error: any) {
      // AbortError = our timeout fired — show a retryable error, not a hard crash
      if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
        if (!hasLoadedProjectRef.current) {
          setLoadError('Verbindung unterbrochen. Bitte erneut versuchen.');
        }
      } else {
        console.error('ProjectDetail: unexpected error:', error);
        if (!hasLoadedProjectRef.current) {
          setLoadError('Ein unerwarteter Fehler ist aufgetreten.');
        }
      }
    } finally {
      setLoading(false);
      loadInFlightRef.current = false;
    }
  // IMPORTANT: no state variables in dependency array — only stable values.
  }, []);

  useEffect(() => {
    if (id) {
      // Reset refs when navigating to a different project
      hasLoadedProjectRef.current = false;
      projectRef.current = null;
      loadInFlightRef.current = false;
      loadProject(id);
      prefetchProjectChunks();
    }
  }, [id, loadProject]);

  // Refetch project data when the user returns to this tab after a long absence.
  useEffect(() => {
    if (!id) return;
    const handleTabVisible = () => { loadProject(id); };
    window.addEventListener('app:tabvisible', handleTabVisible);
    return () => window.removeEventListener('app:tabvisible', handleTabVisible);
  }, [id, loadProject]);

  // ── Safety timeout: if loading is stuck for >8 seconds, force it off ──
  useEffect(() => {
    if (!loading) return;
    const safetyTimer = setTimeout(() => {
      if (loading) {
        console.warn('ProjectDetail: safety timeout — forcing loading=false');
        setLoading(false);
        loadInFlightRef.current = false; // ensure future calls aren't blocked
      }
    }, 8_000);
    return () => clearTimeout(safetyTimer);
  }, [loading]);

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

  // Show spinner while loading or while project hasn't arrived yet (avoids
  // briefly flashing an error screen between navigation and first data fetch)
  if (loading || (!project && !loadError)) {
    return (
      <View style={styles.loadingContainer}>
        <LottieLoader size={120} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.loadingContainer}>
        <AlertCircle size={48} color="#ef4444" />
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => id && loadProject(id)}>
          <Text style={styles.retryButtonText}>Erneut versuchen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={() => navigate('/')}>
          <Text style={styles.backButtonText}>← Zurück zum Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <Outlet context={{ permissions, isProjectOwner, isSuperuser, isTeamAdmin, canView, canCreate, canEdit, canDelete, permissionsLoading, project }} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%' as any,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 360,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  backButton: {
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 14,
  },
});
