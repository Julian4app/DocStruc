import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { CheckCircle, Clock, AlertTriangle, TrendingUp, AlertCircle, Calendar, Flag, ArrowRight } from 'lucide-react';
import { useProjectPermissionContext } from '../../components/PermissionGuard';
import { useAuth } from '../../contexts/AuthContext';
import { LottieLoader } from '../../components/LottieLoader';

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

const PRIMARY = '#3B82F6';

const getProgressColor = (percentage: number) => {
  if (percentage <= 50) {
    const r = 239;
    const g = Math.round(68 + (191 * percentage / 50));
    const b = 68;
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const r = Math.round(239 - (205 * (percentage - 50) / 50));
    const g = Math.round(235 - (40 * (percentage - 50) / 50));
    const b = Math.round(68 + (21 * (percentage - 50) / 50));
    return `rgb(${r}, ${g}, ${b})`;
  }
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    open: 'Offen',
    in_progress: 'In Bearbeitung',
    done: 'Erledigt',
    blocked: 'Blockiert',
  };
  return labels[status] || status;
};

export function ProjectDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const permissions = useProjectPermissionContext();
  const { userId, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalTasks: 0,
    completedTasks: 0,
    activeTasks: 0,
    blockedTasks: 0,
    openDefects: 0,
    criticalDefects: 0,
    upcomingEvents: 0,
  });
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projectStatus, setProjectStatus] = useState<string>('active');
  const [statusDate, setStatusDate] = useState<string | null>(null);
  const [teamStats, setTeamStats] = useState({ totalTasks: 0, completedTasks: 0 });

  useEffect(() => {
    if (id) {
      loadDashboardData();
    } else {
      setLoading(false);
    }
  }, [id, userId, profile?.team_id]);

  // ── Safety timeout: if loading is stuck for >12 seconds, force it off ──
  useEffect(() => {
    if (!loading) return;
    const safetyTimer = setTimeout(() => {
      if (loading) {
        console.warn('ProjectDashboard: safety timeout — forcing loading=false');
        setLoading(false);
      }
    }, 12_000);
    return () => clearTimeout(safetyTimer);
  }, [loading]);

  const loadDashboardData = async () => {
    if (!id) return;
    // Only show spinner on initial load — not on refetches
    // (loading starts true from useState, so first call shows spinner)

    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Use project from outlet context (already loaded by ProjectDetail)
      const ctxProject = (permissions as any).project;
      if (ctxProject) {
        setProjectStatus(ctxProject.status || 'active');
        setStatusDate(ctxProject.status_date || null);
      }

      const [tasksResult, milestonesResult, eventsResult] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, status, task_type, priority, created_at, created_by, assigned_to')
          .eq('project_id', id)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('timeline_events')
          .select('*')
          .eq('project_id', id)
          .gte('event_date', todayStr)
          .order('event_date', { ascending: true })
          .limit(5),
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

      const allTasks = tasksResult.data || [];
      const taskItems = allTasks.filter((t: any) => t.task_type === 'task' || !t.task_type);
      const defectItems = allTasks.filter((t: any) => t.task_type === 'defect');

      setStats({
        totalTasks: taskItems.length,
        completedTasks: taskItems.filter((t: any) => t.status === 'done').length,
        activeTasks: taskItems.filter((t: any) => t.status === 'in_progress').length,
        blockedTasks: taskItems.filter((t: any) => t.status === 'blocked').length,
        openDefects: defectItems.filter((t: any) => t.status !== 'done').length,
        criticalDefects: defectItems.filter((t: any) => t.priority === 'critical' && t.status !== 'done').length,
        upcomingEvents: (eventsResult.data || []).length,
      });

      setRecentTasks(allTasks.slice(0, 5));

      const currentUserTeamId = profile?.team_id;
      if (currentUserTeamId) {
        const creatorIds = [...new Set(allTasks.map((t: any) => t.created_by).filter(Boolean))];
        if (creatorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, team_id')
            .in('id', creatorIds);

          const teamTasks = allTasks.filter((t: any) => {
            const creatorProfile = profiles?.find((p: any) => p.id === t.created_by);
            return creatorProfile?.team_id === currentUserTeamId && (t.task_type === 'task' || !t.task_type);
          });

          setTeamStats({
            totalTasks: teamTasks.length,
            completedTasks: teamTasks.filter((t: any) => t.status === 'done').length,
          });
        }
      }

      if (!milestonesResult.error && milestonesResult.data && milestonesResult.data.length > 0) {
        const milestoneIds = milestonesResult.data.map((m: any) => m.id);
        const { data: allLinked } = await supabase
          .from('milestone_tasks')
          .select('milestone_id')
          .in('milestone_id', milestoneIds);

        const countMap = new Map<string, number>();
        (allLinked || []).forEach((l: any) => {
          countMap.set(l.milestone_id, (countMap.get(l.milestone_id) || 0) + 1);
        });

        setMilestones(
          milestonesResult.data.map((milestone: any) => ({
            ...milestone,
            linkedItemsCount: countMap.get(milestone.id) || 0,
          }))
        );
      }

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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 300 }}>
        <LottieLoader size={150} />
      </div>
    );
  }

  const getStatusColors = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      active:    { bg: '#DCFCE7', text: '#166534', label: 'Aktiv' },
      planning:  { bg: '#FEF3C7', text: '#92400E', label: 'Planung' },
      on_hold:   { bg: '#E0E7FF', text: '#3730A3', label: 'Pausiert' },
      paused:    { bg: '#E0E7FF', text: '#3730A3', label: 'Unterbrochen' },
      completed: { bg: '#DBEAFE', text: '#1E40AF', label: 'Abgeschlossen' },
      archived:  { bg: '#F1F5F9', text: '#475569', label: 'Archiviert' },
    };
    return map[status] || map['active'];
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

  const taskProgress = stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0;
  const milestoneProgress = milestones.length > 0
    ? (milestones.filter(m => m.completed).length / milestones.length) * 100
    : 0;
  const progress = Math.round((taskProgress * 0.7) + (milestoneProgress * 0.3));

  const statusInfo = getStatusColors(projectStatus);
  const showStatusDate = ['on_hold', 'paused', 'planning'].includes(projectStatus) && statusDate;

  const canViewTasks    = permissions.canView('tasks');
  const canViewDefects  = permissions.canView('defects');
  const canViewSchedule = permissions.canView('schedule');

  // Wait for permission resolution before rendering gated content
  const permissionsLoading = (permissions as any).permissionsLoading as boolean | undefined;
  if (permissionsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 64 }}>
        <LottieLoader size={150} label="Lade Dashboard…" />
      </div>
    );
  }

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #F1F5F9',
    padding: 24,
    marginBottom: 24,
  };

  return (
    <div style={{ paddingBottom: 24 }}>

      {/* Status Badge */}
      {projectStatus && (
        <div style={{ marginBottom: 12 }}>
          <span style={{
            display: 'inline-block',
            padding: '6px 16px',
            borderRadius: 20,
            background: statusInfo.bg,
            color: statusInfo.text,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.3,
          }}>
            {statusInfo.label}
            {showStatusDate && ` bis ${formatStatusDate(statusDate)}`}
          </span>
        </div>
      )}

      {/* Progress Overview — shown if user can see tasks or milestones */}
      {(canViewTasks || canViewSchedule) && (
        <div style={cardStyle}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 16, letterSpacing: -0.3 }}>
            Gesamtfortschritt - Alle Teams
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            {canViewTasks && (
              <div style={{
                flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', background: '#F8FAFC', borderRadius: 8,
              }}>
                <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Aufgaben</span>
                <span style={{ fontSize: 14, color: PRIMARY, fontWeight: 700 }}>{Math.round(taskProgress)}%</span>
              </div>
            )}
            {canViewSchedule && (
              <div style={{
                flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', background: '#F8FAFC', borderRadius: 8,
              }}>
                <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Meilensteine</span>
                <span style={{ fontSize: 14, color: PRIMARY, fontWeight: 700 }}>{Math.round(milestoneProgress)}%</span>
              </div>
            )}
          </div>
          <div style={{ height: 12, background: '#F1F5F9', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: getProgressColor(progress), borderRadius: 6,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: PRIMARY, textAlign: 'center' }}>
            {progress}% abgeschlossen
          </div>
        </div>
      )}

      {/* Team-Specific Progress — only if user can see tasks */}
      {canViewTasks && profile?.team_id && teamStats.totalTasks > 0 && (() => {
        const teamProgress = Math.round((teamStats.completedTasks / teamStats.totalTasks) * 100);
        return (
          <div style={cardStyle}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 16, letterSpacing: -0.3 }}>
              Fortschritt - Nur Eigenes Team
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <div style={{
                flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', background: '#F8FAFC', borderRadius: 8,
              }}>
                <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Team-Aufgaben</span>
                <span style={{ fontSize: 14, color: PRIMARY, fontWeight: 700 }}>{teamStats.completedTasks} / {teamStats.totalTasks}</span>
              </div>
            </div>
            <div style={{ height: 12, background: '#F1F5F9', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{
                height: '100%', width: `${teamProgress}%`,
                background: getProgressColor(teamProgress), borderRadius: 6,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: PRIMARY, textAlign: 'center' }}>
              {teamProgress}% abgeschlossen
            </div>
          </div>
        );
      })()}

      {/* Stats Grid — only if user can see tasks */}
      {canViewTasks && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { icon: <CheckCircle size={24} color={PRIMARY} />,       iconBg: '#EFF6FF', value: stats.completedTasks, label: 'Abgeschlossen' },
            { icon: <Clock size={24} color="#F59E0B" />,              iconBg: '#FEF3C7', value: stats.activeTasks,    label: 'Aktive Aufgaben' },
            { icon: <AlertTriangle size={24} color="#EF4444" />,      iconBg: '#FEE2E2', value: stats.blockedTasks,   label: 'Blockiert' },
            { icon: <TrendingUp size={24} color="#A855F7" />,         iconBg: '#F3E8FF', value: stats.totalTasks,     label: 'Gesamt' },
          ].map((card, i) => (
            <div
              key={i}
              onClick={() => navigate(`/project/${id}/tasks`)}
              style={{
                flex: '1 1 150px', minWidth: 150,
                padding: 20, borderRadius: 16, border: '1px solid #F1F5F9',
                background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center',
                cursor: 'pointer', transition: 'box-shadow 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 24,
                background: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12,
              }}>
                {card.icon}
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{card.value}</div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, textAlign: 'center' }}>{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Activity & Upcoming Events row */}
      {(canViewTasks || canViewDefects || canViewSchedule) && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>

          {/* Recent Activity — only if user can see tasks or defects */}
          {(canViewTasks || canViewDefects) && (
            <div style={{ ...cardStyle, flex: '1 1 300px', minWidth: 300, marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: -0.3 }}>Letzte Aktivitäten</span>
              </div>
              {recentTasks.length === 0 ? (
                <div style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center' }}>Keine aktuellen Aktivitäten</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {recentTasks
                    .filter((task: RecentTask) => task.task_type === 'defect' ? canViewDefects : canViewTasks)
                    .map((task: RecentTask) => (
                      <div
                        key={task.id}
                        onClick={() => {
                          const path = task.task_type === 'defect' ? 'defects' : 'tasks';
                          if (permissions.canView(path)) navigate(`/project/${id}/${path}`);
                        }}
                        style={{
                          padding: 12, background: '#F8FAFC', borderRadius: 8,
                          cursor: 'pointer', transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#F8FAFC')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{
                            fontSize: 14, fontWeight: 600, color: '#0f172a',
                            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {task.title}
                          </span>
                          {task.task_type === 'defect' && task.priority === 'critical' && (
                            <span style={{
                              width: 20, height: 20, borderRadius: 10, background: '#EF4444',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', fontSize: 12, fontWeight: 800, marginLeft: 8, flexShrink: 0,
                            }}>!</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {task.task_type === 'defect' ? 'Mangel' : 'Aufgabe'} • {getStatusLabel(task.status)}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Upcoming Events — only if user can see schedule */}
          {canViewSchedule && (
            <div style={{ ...cardStyle, flex: '1 1 300px', minWidth: 300, marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: -0.3 }}>Anstehende Termine</span>
              </div>
              {upcomingEvents.length === 0 ? (
                <div style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center' }}>
                  Keine anstehenden Termine in den nächsten 7 Tagen
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {upcomingEvents.map((event: UpcomingEvent) => (
                    <div
                      key={event.id}
                      onClick={() => navigate(`/project/${id}/schedule`)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: 12, background: '#F8FAFC', borderRadius: 8,
                        cursor: 'pointer', transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#F8FAFC')}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, background: '#EFF6FF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Calendar size={16} color={PRIMARY} />
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{
                          fontSize: 14, fontWeight: 600, color: '#0f172a',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          marginBottom: 2,
                        }}>
                          {event.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {new Date(event.start_date).toLocaleDateString('de-DE', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Defects Overview — only if user can see defects */}
      {canViewDefects && (stats.openDefects > 0 || stats.criticalDefects > 0) && (
        <div style={{
          ...cardStyle,
          ...(stats.criticalDefects > 0 ? { borderColor: '#FEE2E2', background: '#FEF2F2' } : {}),
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <AlertCircle size={20} color={stats.criticalDefects > 0 ? '#EF4444' : PRIMARY} />
            <span style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: -0.3 }}>Mängel</span>
          </div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{stats.openDefects}</div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Offen</div>
            </div>
            {stats.criticalDefects > 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#EF4444', marginBottom: 4 }}>{stats.criticalDefects}</div>
                <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Kritisch</div>
              </div>
            )}
          </div>
          {stats.criticalDefects > 0 && (
            <button
              onClick={() => navigate(`/project/${id}/defects`)}
              style={{
                padding: '8px 16px', background: '#EFF6FF', border: 'none',
                borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: PRIMARY,
              }}
            >
              Mängel ansehen →
            </button>
          )}
        </div>
      )}

      {/* Milestones Overview — only if user can see schedule */}
      {canViewSchedule && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Flag size={20} color={PRIMARY} />
            <span style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: -0.3 }}>Meilensteine & Termine</span>
            <button
              onClick={() => navigate(`/project/${id}/schedule`)}
              style={{
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: PRIMARY,
              }}
            >
              Alle anzeigen <ArrowRight size={14} color={PRIMARY} />
            </button>
          </div>

          {milestones.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: 12 }}>
              <Flag size={32} color="#CBD5E1" />
              <div style={{ fontSize: 14, color: '#64748b' }}>Keine anstehenden Meilensteine</div>
              <button
                onClick={() => navigate(`/project/${id}/schedule`)}
                style={{
                  padding: '8px 16px', background: '#EFF6FF', border: 'none',
                  borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: PRIMARY, marginTop: 4,
                }}
              >
                Meilenstein erstellen
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {milestones.map((milestone: Milestone) => {
                const daysUntil = Math.ceil(
                  (new Date(milestone.event_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                );
                const isToday    = daysUntil === 0;
                const isPast     = daysUntil < 0;
                const isUpcoming = daysUntil > 0 && daysUntil <= 7;
                const barColor   = milestone.color ||
                  (milestone.eventType === 'deadline' ? '#EF4444' :
                   milestone.eventType === 'phase'    ? '#8B5CF6' : PRIMARY);

                return (
                  <div
                    key={milestone.id}
                    onClick={() => navigate(`/project/${id}/schedule`)}
                    style={{
                      display: 'flex', background: '#F8FAFC', borderRadius: 12,
                      border: '1px solid #E2E8F0', overflow: 'hidden', cursor: 'pointer',
                      transition: 'box-shadow 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                  >
                    <div style={{ width: 4, background: barColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                            {milestone.title}
                          </div>
                          <span style={{
                            display: 'inline-block', padding: '3px 8px', borderRadius: 6,
                            background: barColor, color: '#fff', fontSize: 10, fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: 0.5,
                          }}>
                            {milestone.eventType === 'deadline' ? 'Deadline' :
                             milestone.eventType === 'phase' ? 'Bauphase' : 'Meilenstein'}
                          </span>
                        </div>
                        {milestone.completed && (
                          <div style={{
                            width: 24, height: 24, borderRadius: 12, background: '#F0FDF4',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <CheckCircle size={14} color="#22c55e" />
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: milestone.description ? 8 : 0 }}>
                        <Calendar size={14} color="#64748b" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>
                          {new Date(milestone.event_date).toLocaleDateString('de-DE', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                          {milestone.end_date && (
                            <span style={{ fontWeight: 400 }}>
                              {' '}bis {new Date(milestone.end_date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                            </span>
                          )}
                        </span>
                      </div>

                      {milestone.description && (
                        <div style={{
                          fontSize: 13, color: '#64748b', lineHeight: '18px',
                          overflow: 'hidden', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          marginBottom: 8,
                        }}>
                          {milestone.description}
                        </div>
                      )}

                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        paddingTop: 8, borderTop: '1px solid #E2E8F0',
                      }}>
                        {milestone.linkedItemsCount !== undefined && milestone.linkedItemsCount > 0 ? (
                          <span style={{
                            padding: '4px 8px', background: '#EFF6FF', borderRadius: 6,
                            fontSize: 11, fontWeight: 600, color: PRIMARY,
                          }}>
                            {milestone.linkedItemsCount} verknüpfte Aufgabe{milestone.linkedItemsCount !== 1 ? 'n' : ''}
                          </span>
                        ) : <span />}

                        {!milestone.completed && (
                          <span style={{
                            fontSize: 12, fontWeight: 600,
                            color: isToday ? '#F59E0B' : isPast ? '#EF4444' : isUpcoming ? '#10B981' : '#3B82F6',
                          }}>
                            {isToday ? '⚡ Heute' :
                             isPast  ? `⚠️ ${Math.abs(daysUntil)} Tag(e) überfällig` :
                                       `📅 in ${daysUntil} Tag(en)`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
