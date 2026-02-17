import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card } from '@docstruc/ui';
import { colors, spacing } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { CheckCircle, Clock, AlertTriangle, TrendingUp, AlertCircle, Calendar, Flag, ArrowRight } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';

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

interface Milestone {
  id: string;
  title: string;
  event_date: string;
  end_date?: string | null;
  description?: string | null;
  color?: string | null;
  eventType: string;
  completed: boolean;
  linkedItemsCount?: number;
}

export function ProjectDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const permissions = usePermissions(id);
  const { userId, profile } = useAuth();
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
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projectStatus, setProjectStatus] = useState<string>('active');
  const [statusDate, setStatusDate] = useState<string | null>(null);
  const [teamStats, setTeamStats] = useState({ totalTasks: 0, completedTasks: 0 });

  useEffect(() => {
    loadDashboardData();
  }, [id, userId, profile?.team_id]);

  const loadDashboardData = async () => {
    if (!id) return;
    setLoading(true);
    
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Parallelize ALL independent queries in a single batch
      const [projectResult, tasksResult, milestonesResult, eventsResult] = await Promise.all([
        // Load project info
        supabase
          .from('projects')
          .select('status, status_date')
          .eq('id', id)
          .single(),
        // Load all tasks (needed for stats + recent tasks)
        supabase
          .from('tasks')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: false }),
        // Load upcoming milestones
        supabase
          .from('timeline_events')
          .select('*')
          .eq('project_id', id)
          .gte('event_date', todayStr)
          .order('event_date', { ascending: true })
          .limit(5),
        // Load upcoming events (next 7 days)
        supabase
          .from('timeline_events')
          .select('*')
          .eq('project_id', id)
          .gte('start_date', now.toISOString())
          .lte('start_date', weekFromNow)
          .neq('status', 'cancelled')
          .order('start_date', { ascending: true })
          .limit(5),
      ]);

      // Process project data
      if (!projectResult.error && projectResult.data) {
        setProjectStatus(projectResult.data.status || 'active');
        setStatusDate(projectResult.data.status_date);
      }

      // Process tasks
      const allTasks = tasksResult.data || [];
      const taskItems = allTasks.filter(t => t.task_type === 'task' || !t.task_type);
      const defectItems = allTasks.filter(t => t.task_type === 'defect');

      setStats({
        totalTasks: taskItems.length,
        completedTasks: taskItems.filter(t => t.status === 'done').length,
        activeTasks: taskItems.filter(t => t.status === 'in_progress').length,
        blockedTasks: taskItems.filter(t => t.status === 'blocked').length,
        openDefects: defectItems.filter(t => t.status !== 'done').length,
        criticalDefects: defectItems.filter(t => t.priority === 'critical' && t.status !== 'done').length,
        upcomingEvents: (eventsResult.data || []).length
      });

      setRecentTasks(allTasks.slice(0, 5));

      // Calculate team-specific stats using profile from AuthContext
      const currentUserTeamId = profile?.team_id;
      if (currentUserTeamId) {
        const creatorIds = [...new Set(allTasks.map(t => t.created_by).filter(Boolean))];
        if (creatorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, team_id')
            .in('id', creatorIds);

          const teamTasks = allTasks.filter(t => {
            const creatorProfile = profiles?.find(p => p.id === t.created_by);
            return creatorProfile?.team_id === currentUserTeamId && (t.task_type === 'task' || !t.task_type);
          });

          setTeamStats({
            totalTasks: teamTasks.length,
            completedTasks: teamTasks.filter(t => t.status === 'done').length
          });
        }
      }

      // Process milestones — batch linked item counts instead of N+1
      if (!milestonesResult.error && milestonesResult.data && milestonesResult.data.length > 0) {
        const milestoneIds = milestonesResult.data.map(m => m.id);
        const { data: allLinked } = await supabase
          .from('milestone_tasks')
          .select('milestone_id')
          .in('milestone_id', milestoneIds);

        // Count per milestone
        const countMap = new Map<string, number>();
        (allLinked || []).forEach(l => {
          countMap.set(l.milestone_id, (countMap.get(l.milestone_id) || 0) + 1);
        });

        setMilestones(milestonesResult.data.map(milestone => ({
          ...milestone,
          linkedItemsCount: countMap.get(milestone.id) || 0
        })));
      }

      // Process events
      if (!eventsResult.error) {
        setUpcomingEvents(eventsResult.data || []);
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

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: { bg: string; text: string; label: string } } = {
      'active': { bg: '#DCFCE7', text: '#166534', label: 'Aktiv' },
      'planning': { bg: '#FEF3C7', text: '#92400E', label: 'Planung' },
      'on_hold': { bg: '#E0E7FF', text: '#3730A3', label: 'Pausiert' },
      'paused': { bg: '#E0E7FF', text: '#3730A3', label: 'Unterbrochen' },
      'completed': { bg: '#DBEAFE', text: '#1E40AF', label: 'Abgeschlossen' },
      'archived': { bg: '#F1F5F9', text: '#475569', label: 'Archiviert' },
    };
    return colors[status] || colors['active'];
  };

  const formatStatusDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}.${month}.${year}`;
    }
    return '';
  };

  // Gradient color function for progress bars
  const getProgressColor = (percentage: number) => {
    if (percentage <= 50) {
      // Red #EF4444 to Yellow #EFEB44
      const r = 239;
      const g = Math.round(68 + (191 * percentage / 50));
      const b = 68;
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Yellow to Green #22C55E
      const r = Math.round(239 - (205 * (percentage - 50) / 50));
      const g = Math.round(235 - (40 * (percentage - 50) / 50));
      const b = Math.round(68 + (21 * (percentage - 50) / 50));
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  // Calculate comprehensive progress including tasks and milestones
  const taskProgress = stats.totalTasks > 0 
    ? (stats.completedTasks / stats.totalTasks) * 100 
    : 0;
  
  const milestoneProgress = milestones.length > 0
    ? (milestones.filter(m => m.completed).length / milestones.length) * 100
    : 0;
  
  // Weighted average: 70% tasks, 30% milestones
  const progress = Math.round((taskProgress * 0.7) + (milestoneProgress * 0.3));

  const statusInfo = getStatusColor(projectStatus);
  const showStatusDate = ['on_hold', 'paused', 'planning'].includes(projectStatus) && statusDate;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Status Badge */}
      {projectStatus && (
        <View style={styles.statusBadgeContainer}>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusInfo.text }]}>
              {statusInfo.label}
              {showStatusDate && ` bis ${formatStatusDate(statusDate)}`}
            </Text>
          </View>
        </View>
      )}

      <Text style={styles.pageTitle}>Projekt Dashboard</Text>
      <Text style={styles.pageSubtitle}>Zentrale Projektsteuerung und Statusübersicht</Text>

      {/* Progress Overview */}
      <Card style={styles.progressCard}>
        <Text style={styles.cardTitle}>Gesamtfortschritt - Alle Teams</Text>
        <View style={styles.progressDetails}>
          <View style={styles.progressDetailItem}>
            <Text style={styles.progressDetailLabel}>Aufgaben</Text>
            <Text style={styles.progressDetailValue}>{Math.round(taskProgress)}%</Text>
          </View>
          <View style={styles.progressDetailItem}>
            <Text style={styles.progressDetailLabel}>Meilensteine</Text>
            <Text style={styles.progressDetailValue}>{Math.round(milestoneProgress)}%</Text>
          </View>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[
            styles.progressBar, 
            { 
              width: `${progress}%`,
              backgroundColor: getProgressColor(progress)
            }
          ]} />
        </View>
        <Text style={styles.progressText}>{progress}% abgeschlossen</Text>
      </Card>

      {/* Team-Specific Progress */}
      {profile?.team_id && teamStats.totalTasks > 0 && (() => {
        const teamProgress = Math.round((teamStats.completedTasks / teamStats.totalTasks) * 100);
        
        return (
          <Card style={[styles.progressCard, { marginTop: 16 }]}>
            <Text style={styles.cardTitle}>Fortschritt - Nur Eigenes Team</Text>
            <View style={styles.progressDetails}>
              <View style={styles.progressDetailItem}>
                <Text style={styles.progressDetailLabel}>Team-Aufgaben</Text>
                <Text style={styles.progressDetailValue}>{teamStats.completedTasks} / {teamStats.totalTasks}</Text>
              </View>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[
                styles.progressBar, 
                { 
                  width: `${teamProgress}%`,
                  backgroundColor: getProgressColor(teamProgress)
                }
              ]} />
            </View>
            <Text style={styles.progressText}>{teamProgress}% abgeschlossen</Text>
          </Card>
        );
      })()}

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

      {/* Milestones Overview */}
      <Card style={styles.sectionCard}>
        <View style={styles.cardHeader}>
          <Flag size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Meilensteine & Termine</Text>
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => navigate(`/project/${id}/schedule`)}
          >
            <Text style={styles.viewAllButtonText}>Alle anzeigen</Text>
            <ArrowRight size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {milestones.length === 0 ? (
          <View style={styles.emptyMilestones}>
            <Flag size={32} color="#CBD5E1" />
            <Text style={styles.emptyMilestonesText}>Keine anstehenden Meilensteine</Text>
            <TouchableOpacity
              style={styles.emptyActionButton}
              onPress={() => navigate(`/project/${id}/schedule`)}
            >
              <Text style={styles.emptyActionButtonText}>Meilenstein erstellen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.milestonesList}>
            {milestones.map((milestone) => {
              const daysUntil = Math.ceil(
                (new Date(milestone.event_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              );
              const isToday = daysUntil === 0;
              const isPast = daysUntil < 0;
              const isUpcoming = daysUntil > 0 && daysUntil <= 7;

              return (
                <TouchableOpacity
                  key={milestone.id}
                  style={styles.milestoneCard}
                  onPress={() => navigate(`/project/${id}/schedule`)}
                >
                  {/* Milestone Color Bar */}
                  <View
                    style={[
                      styles.milestoneColorBar,
                      {
                        backgroundColor: milestone.color || 
                          (milestone.eventType === 'deadline' ? '#EF4444' :
                           milestone.eventType === 'phase' ? '#8B5CF6' : colors.primary)
                      }
                    ]}
                  />

                  <View style={styles.milestoneContent}>
                    {/* Header */}
                    <View style={styles.milestoneHeader}>
                      <View style={styles.milestoneHeaderLeft}>
                        <Text style={styles.milestoneTitle} numberOfLines={1}>
                          {milestone.title}
                        </Text>
                        <View style={[
                          styles.milestoneTypeBadge,
                          {
                            backgroundColor: milestone.color || 
                              (milestone.eventType === 'deadline' ? '#EF4444' :
                               milestone.eventType === 'phase' ? '#8B5CF6' : colors.primary)
                          }
                        ]}>
                          <Text style={styles.milestoneTypeBadgeText}>
                            {milestone.eventType === 'deadline' ? 'Deadline' :
                             milestone.eventType === 'phase' ? 'Bauphase' : 'Meilenstein'}
                          </Text>
                        </View>
                      </View>
                      {milestone.completed && (
                        <View style={styles.completedBadge}>
                          <CheckCircle size={14} color="#22c55e" />
                        </View>
                      )}
                    </View>

                    {/* Date & Description */}
                    <View style={styles.milestoneDetails}>
                      <View style={styles.milestoneDateRow}>
                        <Calendar size={14} color="#64748b" />
                        <Text style={styles.milestoneDateText}>
                          {new Date(milestone.event_date).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                          {milestone.end_date && (
                            <Text style={styles.milestoneDateRange}>
                              {' '}bis {new Date(milestone.end_date).toLocaleDateString('de-DE', {
                                day: '2-digit',
                                month: 'short'
                              })}
                            </Text>
                          )}
                        </Text>
                      </View>
                      
                      {milestone.description && (
                        <Text style={styles.milestoneDescription} numberOfLines={2}>
                          {milestone.description}
                        </Text>
                      )}
                    </View>

                    {/* Footer */}
                    <View style={styles.milestoneFooter}>
                      {milestone.linkedItemsCount !== undefined && milestone.linkedItemsCount > 0 && (
                        <View style={styles.linkedItemsBadge}>
                          <Text style={styles.linkedItemsText}>
                            {milestone.linkedItemsCount} verknüpft{milestone.linkedItemsCount !== 1 ? 'e' : 'e'} Aufgabe{milestone.linkedItemsCount !== 1 ? 'n' : ''}
                          </Text>
                        </View>
                      )}
                      
                      {!milestone.completed && (
                        <Text style={[
                          styles.milestoneDaysUntil,
                          isToday && styles.milestoneDaysUntilToday,
                          isPast && styles.milestoneDaysUntilOverdue,
                          isUpcoming && styles.milestoneDaysUntilUpcoming
                        ]}>
                          {isToday ? '⚡ Heute' :
                           isPast ? `⚠️ ${Math.abs(daysUntil)} Tag(e) überfällig` :
                           `📅 in ${daysUntil} Tag(en)`}
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </Card>
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
  statusBadgeContainer: {
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
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
  progressDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  progressDetailItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  progressDetailLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  progressDetailValue: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
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
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  viewAllButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyMilestones: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyMilestonesText: {
    fontSize: 14,
    color: '#64748b',
  },
  emptyActionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    marginTop: 4,
  },
  emptyActionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  milestonesList: {
    gap: 12,
  },
  milestoneCard: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  milestoneColorBar: {
    width: 4,
  },
  milestoneContent: {
    flex: 1,
    padding: 16,
    gap: 10,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  milestoneHeaderLeft: {
    flex: 1,
    gap: 6,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  milestoneTypeBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  milestoneTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  completedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneDetails: {
    gap: 8,
  },
  milestoneDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  milestoneDateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  milestoneDateRange: {
    fontWeight: '400',
  },
  milestoneDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  milestoneFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  linkedItemsBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  linkedItemsText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  milestoneDaysUntil: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  milestoneDaysUntilToday: {
    color: '#F59E0B',
  },
  milestoneDaysUntilOverdue: {
    color: '#EF4444',
  },
  milestoneDaysUntilUpcoming: {
    color: '#10B981',
  },
});
