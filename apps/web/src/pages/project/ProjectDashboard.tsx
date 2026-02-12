import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card } from '@docstruc/ui';
import { colors, spacing } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { CheckCircle, Clock, AlertTriangle, TrendingUp, AlertCircle, Calendar } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  blockedTasks: number;
  openDefects: number;
  criticalDefects: number;
  upcomingEvents: number;
}

interface RecentTask {
  id: string;
  title: string;
  status: string;
  task_type: string;
  priority: string;
  created_at: string;
}

interface UpcomingEvent {
  id: string;
  title: string;
  start_date: string;
  event_type: string;
}

export function ProjectDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const permissions = usePermissions(id);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalTasks: 0,
    completedTasks: 0,
    activeTasks: 0,
    blockedTasks: 0,
    openDefects: 0,
    criticalDefects: 0,
    upcomingEvents: 0
  });
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [id]);

  const loadDashboardData = async () => {
    if (!id) return;
    setLoading(true);
    
    try {
      // Load all tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      const allTasks = tasks || [];
      const taskItems = allTasks.filter(t => t.task_type === 'task' || !t.task_type);
      const defectItems = allTasks.filter(t => t.task_type === 'defect');

      setStats({
        totalTasks: taskItems.length,
        completedTasks: taskItems.filter(t => t.status === 'done').length,
        activeTasks: taskItems.filter(t => t.status === 'in_progress').length,
        blockedTasks: taskItems.filter(t => t.status === 'blocked').length,
        openDefects: defectItems.filter(t => t.status !== 'done').length,
        criticalDefects: defectItems.filter(t => t.priority === 'critical' && t.status !== 'done').length,
        upcomingEvents: 0
      });

      setRecentTasks(allTasks.slice(0, 5));

      // Load upcoming events
      const { data: events, error: eventsError } = await supabase
        .from('timeline_events')
        .select('*')
        .eq('project_id', id)
        .gte('start_date', new Date().toISOString())
        .lte('start_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
        .neq('status', 'cancelled')
        .order('start_date', { ascending: true })
        .limit(5);

      if (!eventsError) {
        setUpcomingEvents(events || []);
        setStats(prev => ({ ...prev, upcomingEvents: (events || []).length }));
      }

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const progress = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>Projekt Dashboard</Text>
      <Text style={styles.pageSubtitle}>Zentrale Projektsteuerung und Statusübersicht</Text>

      {/* Progress Overview */}
      <Card style={styles.progressCard}>
        <Text style={styles.cardTitle}>Gesamtfortschritt</Text>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>{progress}% abgeschlossen</Text>
      </Card>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <TouchableOpacity 
          style={styles.statCard} 
          onPress={() => permissions.canView('tasks') && navigate(`/project/${id}/tasks`)}
        >
          <View style={[styles.statIcon, { backgroundColor: '#EFF6FF' }]}>
            <CheckCircle size={24} color={colors.primary} />
          </View>
          <Text style={styles.statValue}>{stats.completedTasks}</Text>
          <Text style={styles.statLabel}>Abgeschlossen</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.statCard}
          onPress={() => permissions.canView('tasks') && navigate(`/project/${id}/tasks`)}
        >
          <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
            <Clock size={24} color="#F59E0B" />
          </View>
          <Text style={styles.statValue}>{stats.activeTasks}</Text>
          <Text style={styles.statLabel}>Aktive Aufgaben</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.statCard}
          onPress={() => permissions.canView('tasks') && navigate(`/project/${id}/tasks`)}
        >
          <View style={[styles.statIcon, { backgroundColor: '#FEE2E2' }]}>
            <AlertTriangle size={24} color="#EF4444" />
          </View>
          <Text style={styles.statValue}>{stats.blockedTasks}</Text>
          <Text style={styles.statLabel}>Blockiert</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.statCard}
          onPress={() => permissions.canView('tasks') && navigate(`/project/${id}/tasks`)}
        >
          <View style={[styles.statIcon, { backgroundColor: '#F3E8FF' }]}>
            <TrendingUp size={24} color="#A855F7" />
          </View>
          <Text style={styles.statValue}>{stats.totalTasks}</Text>
          <Text style={styles.statLabel}>Gesamt</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Activity & Upcoming Events */}
      <View style={styles.twoColumnGrid}>
        <Card style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Letzte Aktivitäten</Text>
          </View>
          {recentTasks.length === 0 ? (
            <Text style={styles.emptyText}>Keine aktuellen Aktivitäten</Text>
          ) : (
            <View style={styles.tasksList}>
              {recentTasks.map((task) => (
                <TouchableOpacity
                  key={task.id}
                  style={styles.taskItem}
                  onPress={() => {
                    const path = task.task_type === 'defect' ? 'defects' : 'tasks';
                    if (permissions.canView(path)) {
                      navigate(`/project/${id}/${path}`);
                    }
                  }}
                >
                  <View style={styles.taskItemHeader}>
                    <Text style={styles.taskItemTitle} numberOfLines={1}>{task.title}</Text>
                    {task.task_type === 'defect' && task.priority === 'critical' && (
                      <View style={styles.criticalBadge}>
                        <Text style={styles.criticalBadgeText}>!</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.taskItemMeta}>
                    {task.task_type === 'defect' ? 'Mangel' : 'Aufgabe'} • {getStatusLabel(task.status)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>

        <Card style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Anstehende Termine</Text>
          </View>
          {upcomingEvents.length === 0 ? (
            <Text style={styles.emptyText}>
              Keine anstehenden Termine in den nächsten 7 Tagen
            </Text>
          ) : (
            <View style={styles.eventsList}>
              {upcomingEvents.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventItem}
                  onPress={() => permissions.canView('schedule') && navigate(`/project/${id}/schedule`)}
                >
                  <View style={styles.eventIcon}>
                    <Calendar size={16} color={colors.primary} />
                  </View>
                  <View style={styles.eventContent}>
                    <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                    <Text style={styles.eventDate}>
                      {new Date(event.start_date).toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>
      </View>

      {/* Defects Overview */}
      {(stats.openDefects > 0 || stats.criticalDefects > 0) && (
        <Card style={[styles.sectionCard, stats.criticalDefects > 0 && styles.warningCard]}>
          <View style={styles.cardHeader}>
            <AlertCircle size={20} color={stats.criticalDefects > 0 ? '#EF4444' : colors.primary} />
            <Text style={styles.cardTitle}>Mängel</Text>
          </View>
          <View style={styles.defectsGrid}>
            <View style={styles.defectsStat}>
              <Text style={styles.defectsValue}>{stats.openDefects}</Text>
              <Text style={styles.defectsLabel}>Offen</Text>
            </View>
            {stats.criticalDefects > 0 && (
              <View style={styles.defectsStat}>
                <Text style={[styles.defectsValue, { color: '#EF4444' }]}>{stats.criticalDefects}</Text>
                <Text style={styles.defectsLabel}>Kritisch</Text>
              </View>
            )}
          </View>
          {stats.criticalDefects > 0 && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => permissions.canView('defects') && navigate(`/project/${id}/defects`)}
            >
              <Text style={styles.actionButtonText}>Mängel ansehen →</Text>
            </TouchableOpacity>
          )}
        </Card>
      )}
    </ScrollView>
  );
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    open: 'Offen',
    in_progress: 'In Bearbeitung',
    done: 'Erledigt',
    blocked: 'Blockiert'
  };
  return labels[status] || status;
};

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
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 24,
  },
  progressCard: {
    padding: 24,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
  },
  twoColumnGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  sectionCard: {
    flex: 1,
    minWidth: 300,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#ffffff',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  tasksList: {
    gap: 12,
  },
  taskItem: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    cursor: 'pointer' as any,
  },
  taskItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  taskItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  taskItemMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  criticalBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  criticalBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  eventsList: {
    gap: 12,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    cursor: 'pointer' as any,
  },
  eventIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  eventDate: {
    fontSize: 12,
    color: '#64748b',
  },
  warningCard: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  defectsGrid: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  defectsStat: {
    alignItems: 'center',
  },
  defectsValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  defectsLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
