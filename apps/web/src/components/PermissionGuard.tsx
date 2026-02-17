import React from 'react';
import { useOutletContext, useParams, useLocation } from 'react-router-dom';
import { View, Text, StyleSheet } from 'react-native';
import { Lock } from 'lucide-react';
import { colors } from '@docstruc/theme';
import { ROUTE_MODULE_MAP } from '../pages/ProjectDetail';

interface ProjectOutletContext {
  permissions: any;
  isProjectOwner: boolean;
  isSuperuser: boolean;
  isTeamAdmin: boolean;
  canView: (moduleKey: string) => boolean;
  canCreate: (moduleKey: string) => boolean;
  canEdit: (moduleKey: string) => boolean;
  canDelete: (moduleKey: string) => boolean;
  permissionsLoading: boolean;
}

interface PermissionGuardProps {
  moduleKey?: string; // Override auto-detection if needed
  children: React.ReactNode;
}

/**
 * Wraps a project page and blocks access if user lacks view permission.
 * Auto-detects the module_key from the current route path.
 */
export function PermissionGuard({ moduleKey, children }: PermissionGuardProps) {
  const context = useOutletContext<ProjectOutletContext>();
  const location = useLocation();

  // Auto-detect module_key from route if not provided
  const detectedModuleKey = moduleKey || (() => {
    // Extract the last segment of the path: /project/:id/tasks -> "tasks"
    const parts = location.pathname.split('/');
    const lastSegment = parts[parts.length - 1];
    return ROUTE_MODULE_MAP[lastSegment] || null;
  })();

  // If no context (still loading), show nothing
  if (!context || context.permissionsLoading) {
    return null;
  }

  // Project owner or superuser always has access
  if (context.isProjectOwner || context.isSuperuser) {
    return <>{children}</>;
  }

  // Dashboard (no moduleKey) is always accessible
  if (!detectedModuleKey) {
    return <>{children}</>;
  }

  // Check permission
  if (!context.canView(detectedModuleKey)) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Lock size={32} color="#DC2626" />
          </View>
          <Text style={styles.title}>Kein Zugriff</Text>
          <Text style={styles.message}>
            Sie haben keine Berechtigung, diese Seite zu sehen.
          </Text>
          <Text style={styles.hint}>
            Bitte kontaktieren Sie den Projektleiter, um Zugriff zu erhalten.
          </Text>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

/**
 * Hook to get permission context from the ProjectDetail outlet
 */
export function useProjectPermissionContext() {
  return useOutletContext<ProjectOutletContext>();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
