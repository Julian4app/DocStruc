import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ProjectCard, Button } from '@docstruc/ui';
import { supabase } from '../lib/supabase';
import { Project } from '@docstruc/logic';
import { useAuth } from '../contexts/AuthContext';

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigate } from 'react-router-dom';
import { ProjectCreateModal } from '../components/ProjectCreateModal';
import { useLayout } from '../layouts/LayoutContext';
import { useToast } from '../components/ToastProvider';
import { Folder, TrendingUp, Clock, CheckCircle, AlertCircle, Flag, Calendar as CalendarIcon } from 'lucide-react';
import { colors } from '@docstruc/theme';

interface TimelineEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  event_type: 'milestone' | 'deadline' | 'phase';
  status: 'pending' | 'completed';
  color: string;
  project_id: string;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { setTitle, setSubtitle, setActions } = useLayout();
  const { showToast } = useToast();
  const { userId, isSuperuser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [upcomingMilestones, setUpcomingMilestones] = useState<TimelineEvent[]>([]);

  // ── Deduplication: only one fetchProjects in flight at a time ─────────
  // Without this, the visibility handler + useEffect can fire simultaneously,
  // causing two fetches that race, and the loser may set projects=[] while
  // the winner already set the real data.
  const fetchInFlightRef = useRef(false);
  // Track whether we already loaded projects at least once (prevents showing
  // "Lade Projekte..." after the first successful load when a refetch errors)
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    setTitle('Meine Projekte');
    setSubtitle('Übersicht aller Projekte und Aktivitäten');
  }, [setTitle]);

  const fetchProjects = useCallback(async () => {
    if (!userId) return;
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;

    // Only show the loading indicator if we don't have data yet.
    // On refetches (visibility, token refresh) we keep showing old data
    // and update silently — this prevents the spinner flash.
    if (!hasLoadedOnceRef.current) {
      setProjectsLoading(true);
    }

    try {
      const { data: projectIds, error: idsError } = await supabase
        .rpc('get_my_project_ids');
      if (idsError) {
        console.error('fetchProjects rpc error', idsError);
        // Only clear projects if we never loaded successfully before
        if (!hasLoadedOnceRef.current) setProjects([]);
        return;
      }
      if (!projectIds || projectIds.length === 0) {
        setProjects([]);
        hasLoadedOnceRef.current = true;
        return;
      }
      const { data, error } = await supabase
        .from('projects').select('*').in('id', projectIds).order('created_at', { ascending: false });
      if (error) {
        console.error('fetchProjects query error', error);
        if (!hasLoadedOnceRef.current) setProjects([]);
      } else {
        setProjects(data || []);
        hasLoadedOnceRef.current = true;
      }
    } catch (e: any) {
      console.error('fetchProjects unexpected error', e);
      // On refetch errors, keep showing old data — don't blank the screen
    } finally {
      setProjectsLoading(false);
      fetchInFlightRef.current = false;
    }
  }, [userId]);

  // Fetch projects whenever userId becomes available
  useEffect(() => {
    if (userId) {
      fetchProjects();
      fetchMilestones();
    }
  }, [userId, fetchProjects]);

  // Refetch data when the user returns to this tab after a long absence.
  // The 'app:tabvisible' event is only fired by WebLayout when the tab was
  // hidden for > 30 seconds — avoids spurious refetches on brief Alt-Tab.
  useEffect(() => {
    const handleTabVisible = () => {
      fetchProjects();
      fetchMilestones();
    };
    window.addEventListener('app:tabvisible', handleTabVisible);
    return () => window.removeEventListener('app:tabvisible', handleTabVisible);
  }, [fetchProjects]);

  // ── Safety timeout: if projectsLoading is stuck for >12 seconds, force it off ──
  useEffect(() => {
    if (!projectsLoading) return;
    const safetyTimer = setTimeout(() => {
      if (projectsLoading) {
        console.warn('Dashboard: safety timeout — forcing projectsLoading=false');
        setProjectsLoading(false);
        fetchInFlightRef.current = false;
      }
    }, 12_000);
    return () => clearTimeout(safetyTimer);
  }, [projectsLoading]);

  const handleCreateClick = useCallback(() => {
      if (!userId) {
          showToast('Keine Benutzersitzung gefunden.', 'error');
          return;
      }
      setIsCreateModalOpen(true);
  }, [userId, showToast]);

  useEffect(() => {
    if (isSuperuser) {
        setActions(
          <Button onClick={handleCreateClick} size="large">
              + Neues Projekt anlegen
          </Button>
        );
    } else {
        setActions(null);
    }
    return () => setActions(null);
  }, [isSuperuser, setActions, handleCreateClick]);

  const fetchMilestones = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data, error } = await supabase
      .from('timeline_events')
      .select('*')
      .gte('start_date', today.toISOString())
      .eq('status', 'pending')
      .order('start_date', { ascending: true })
      .limit(5);
    
    if (!error && data) {
      setUpcomingMilestones(data);
    }
  };

  const stats = useMemo(() => {
    const total = projects.length;
    // Active projects: In Planung, Genehmigt, In Ausf\u00fchrung
    const activeStatuses = ['In Planung', 'Genehmigt', 'In Ausf\u00fchrung'];
    const active = projects.filter(p => activeStatuses.includes(p.status)).length;
    const pending = projects.filter(p => p.status === 'Angefragt').length;
    const completed = projects.filter(p => p.status === 'Abgeschlossen').length;
    return { total, active, pending, completed };
  }, [projects]);
  
  // Filter projects based on selected status
  const filteredProjects = useMemo(() => {
    if (!statusFilter) return projects;
    
    if (statusFilter === 'total') return projects;
    if (statusFilter === 'active') {
      const activeStatuses = ['In Planung', 'Genehmigt', 'In Ausf\u00fchrung'];
      return projects.filter(p => activeStatuses.includes(p.status));
    }
    if (statusFilter === 'pending') {
      return projects.filter(p => p.status === 'Angefragt');
    }
    if (statusFilter === 'completed') {
      return projects.filter(p => p.status === 'Abgeschlossen');
    }
    return projects;
  }, [projects, statusFilter]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  };

  const getDaysUntil = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateString);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'milestone': return '#3B82F6';
      case 'deadline': return '#F59E0B';
      case 'phase': return '#8B5CF6';
      default: return '#94a3b8';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'milestone': return 'Meilenstein';
      case 'deadline': return 'Deadline';
      case 'phase': return 'Bauphase';
      default: return type;
    }
  };

  const statCards = [
    { label: 'Gesamt Projekte', value: stats.total, icon: Folder, color: colors.primary, bgColor: '#EFF6FF', filter: 'total' },
    { label: 'Aktive Projekte', value: stats.active, icon: TrendingUp, color: '#10b981', bgColor: '#ECFDF5', filter: 'active' },
    { label: 'In Planung', value: stats.pending, icon: Clock, color: '#f59e0b', bgColor: '#FFFBEB', filter: 'pending' },
    { label: 'Abgeschlossen', value: stats.completed, icon: CheckCircle, color: '#6366f1', bgColor: '#EEF2FF', filter: 'completed' },
  ];

  return (
    <>
        <ProjectCreateModal 
            isOpen={isCreateModalOpen} 
            onClose={() => setIsCreateModalOpen(false)} 
            onProjectCreated={fetchProjects}
            userId={userId || ''}
        />

        {/* Stat Cards Row */}
        <View style={styles.statsRow}>
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            const isActive = statusFilter === stat.filter;
            return (
              <TouchableOpacity 
                key={i} 
                style={[styles.statCard, isActive && styles.statCardActive]}
                onPress={() => setStatusFilter(statusFilter === stat.filter ? null : stat.filter)}
                activeOpacity={0.7}
              >
                <View style={styles.statTop}>
                  <View style={[styles.statIconCircle, { backgroundColor: stat.bgColor }]}>
                    <Icon size={20} color={stat.color} />
                  </View>
                  {isActive && (
                    <View style={styles.activeIndicator}>
                      <Text style={styles.activeIndicatorText}>\u2713</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Upcoming Milestones Section */}
        <View style={styles.milestonesSection}>
          <View style={styles.milestonesSectionHeader}>
            <Flag size={20} color={colors.primary} />
            <Text style={styles.milestonesSectionTitle}>Anstehende Meilensteine</Text>
          </View>
          {upcomingMilestones.length > 0 ? (
            <View style={styles.milestonesTimeline}>
              {upcomingMilestones.map((milestone, index) => {
                const daysUntil = getDaysUntil(milestone.start_date);
                const isToday = daysUntil === 0;
                return (
                  <View key={milestone.id} style={styles.milestoneTimelineItem}>
                    {/* Date Circle */}
                    <View style={styles.milestoneCircleWrapper}>
                      <View style={[
                        styles.milestoneCircle,
                        { backgroundColor: milestone.color || getEventTypeColor(milestone.event_type) }
                      ]}>
                        <CalendarIcon size={16} color="#ffffff" />
                      </View>
                      {index < upcomingMilestones.length - 1 && (
                        <View style={styles.milestoneConnector} />
                      )}
                    </View>
                    
                    {/* Content */}
                    <View style={styles.milestoneContent}>
                      <View style={styles.milestoneHeader}>
                        <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                        <View style={[
                          styles.milestoneTypeBadge,
                          { backgroundColor: milestone.color || getEventTypeColor(milestone.event_type) }
                        ]}>
                          <Text style={styles.milestoneTypeBadgeText}>
                            {getEventTypeLabel(milestone.event_type)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.milestoneFooter}>
                        <Text style={styles.milestoneDate}>
                          {formatDate(milestone.start_date)}
                        </Text>
                        <Text style={[
                          styles.milestoneDaysUntil,
                          isToday && styles.milestoneDaysUntilToday
                        ]}>
                          {isToday ? '⚡ Heute!' : `📅 in ${daysUntil} Tag${daysUntil !== 1 ? 'en' : ''}`}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyMilestones}>
              <Flag size={32} color="#cbd5e1" />
              <Text style={styles.emptyMilestonesText}>Keine anstehenden Meilensteine</Text>
            </View>
          )}
        </View>

        {/* Project Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ihre Projekte</Text>
          <Text style={styles.sectionBadge}>{filteredProjects.length}</Text>
          {statusFilter && (
            <TouchableOpacity 
              style={styles.clearFilterBtn}
              onPress={() => setStatusFilter(null)}
            >
              <Text style={styles.clearFilterText}>Filter aufheben \u00d7</Text>
            </TouchableOpacity>
          )}
        </View>

        {filteredProjects.length === 0 ? (
            <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                    <AlertCircle size={32} color={colors.primary} />
                </View>
                <Text style={styles.emptyText}>{projectsLoading ? 'Lade Projekte...' : 'Keine Projekte gefunden'}</Text>
                {!projectsLoading && isSuperuser ? (
                    <>
                        <Text style={styles.emptySubText}>Starten Sie Ihr erstes Projekt, indem Sie oben rechts klicken.</Text>
                        <Button onClick={handleCreateClick} style={{ marginTop: 24 }}>
                            Erstes Projekt erstellen
                        </Button>
                    </>
                ) : !projectsLoading ? (
                    <Text style={styles.emptySubText}>Sie wurden noch keinem Projekt hinzugefügt.</Text>
                ) : null}
            </View>
        ) : (
            <View style={styles.grid}>
                {filteredProjects.map((project) => (
                <ProjectCard 
                    key={project.id} 
                    project={project} 
                    onPress={() => navigate(`/project/${project.id}`)}
                />
                ))}
            </View>
        )}
    </>
  );
}

const styles = StyleSheet.create({
  /* Stat Cards */
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    // @ts-ignore
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  statCardActive: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: '#FAFBFF',
    shadowOpacity: 0.08,
  },
  activeIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicatorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  statTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -1,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
  },

  /* Section */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  sectionBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    overflow: 'hidden' as any,
  },
  clearFilterBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  clearFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },

  /* Grid */
  grid: {
    display: 'grid' as any,
    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' as any,
    gap: 24,
    marginBottom: 40,
  },

  /* Empty */
  emptyState: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptySubText: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 22,
  },
  milestonesSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  milestonesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  milestonesSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  milestonesTimeline: {
    gap: 0,
  },
  milestoneTimelineItem: {
    flexDirection: 'row',
    gap: 16,
  },
  milestoneCircleWrapper: {
    alignItems: 'center',
    width: 40,
  },
  milestoneCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  milestoneConnector: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  milestoneContent: {
    flex: 1,
    paddingVertical: 8,
    paddingBottom: 24,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  milestoneTypeBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  milestoneTypeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  milestoneFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  milestoneDate: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  milestoneDaysUntil: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  milestoneDaysUntilToday: {
    color: '#F59E0B',
  },
  emptyMilestones: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyMilestonesText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
