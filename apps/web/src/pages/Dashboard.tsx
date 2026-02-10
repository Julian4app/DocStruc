import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ProjectCard, Button } from '@docstruc/ui';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Project } from '@docstruc/logic';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigate } from 'react-router-dom';
import { ProjectCreateModal } from '../components/ProjectCreateModal';
import { useLayout } from '../layouts/LayoutContext';
import { useToast } from '../components/ToastProvider';
import { Folder, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { colors } from '@docstruc/theme';

export function Dashboard() {
  const navigate = useNavigate();
  const { setTitle, setSubtitle, setActions } = useLayout();
  const { showToast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  
  useEffect(() => {
    setTitle('Meine Projekte');
    setSubtitle('Übersicht aller Projekte und Aktivitäten');
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
          fetchProjects();
          checkSuperuser(session.user.id);
      }
    });
  }, [setTitle]);

  const handleCreateClick = useCallback(() => {
      if (!session?.user) {
          showToast('Keine Benutzersitzung gefunden.', 'error');
          return;
      }
      setIsCreateModalOpen(true);
  }, [session, showToast]);

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

  const checkSuperuser = async (userId: string) => {
      const { data } = await supabase.from('profiles').select('is_superuser').eq('id', userId).single();
      setIsSuperuser(!!data?.is_superuser);
  };

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching projects:', error);
      if (error.code === '42P17' || error.message.includes('infinite recursion')) {
          showToast('Datenbankfehler: Bitte FIX_DATABASE.sql im Supabase SQL Editor ausführen.', 'error');
      }
    } else {
      setProjects(data || []);
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

  if (!session) return null;

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
            userId={session.user.id}
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
                <Text style={styles.emptyText}>Keine Projekte gefunden</Text>
                {isSuperuser ? (
                    <>
                        <Text style={styles.emptySubText}>Starten Sie Ihr erstes Projekt, indem Sie oben rechts klicken.</Text>
                        <Button onClick={handleCreateClick} style={{ marginTop: 24 }}>
                            Erstes Projekt erstellen
                        </Button>
                    </>
                ) : (
                    <Text style={styles.emptySubText}>Sie wurden noch keinem Projekt hinzugefügt.</Text>
                )}
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
});
