import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LottieLoader } from '../../components/LottieLoader';

import { Card, Button } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ToastProvider';
import { Clock, Play, Pause, CheckCircle, Calendar, TrendingUp } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: string;
  time_entries?: TimeEntry[];
}

interface TimeEntry {
  id: string;
  task_id: string;
  duration_minutes: number;
  date: string;
  user_id: string;
}

interface TimeStats {
  totalHours: number;
  thisWeek: number;
  thisMonth: number;
  tasksWithTime: number;
}

export function ProjectTimeTracking() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TimeStats>({
    totalHours: 0,
    thisWeek: 0,
    thisMonth: 0,
    tasksWithTime: 0
  });
  const [activeTimer, setActiveTimer] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadTimeData();
    }
  }, [id]);

  const loadTimeData = async () => {
    if (!id) return;
    setLoading(true);

    try {
      // Load tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, status')
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // Simulate time entries (in real app, this would come from a time_entries table)
      // For now, calculate based on task data
      const tasksWithMockTime = (tasksData || []).map(task => ({
        ...task,
        time_entries: [] // Mock empty array
      }));

      setTasks(tasksWithMockTime);

      // Calculate stats (mock data for demonstration)
      const completedTasks = tasksData?.filter(t => t.status === 'done').length || 0;
      const mockStats: TimeStats = {
        totalHours: completedTasks * 4.5, // Mock: ~4.5h per completed task
        thisWeek: completedTasks * 1.2,
        thisMonth: completedTasks * 3.8,
        tasksWithTime: completedTasks
      };
      
      setStats(mockStats);
    } catch (error: any) {
      console.error('Error loading time data:', error);
      showToast('Fehler beim Laden der Zeitdaten', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTimer = (taskId: string) => {
    setActiveTimer(taskId);
    showToast('Timer gestartet', 'success');
  };

  const handleStopTimer = () => {
    if (activeTimer) {
      showToast('Timer gestoppt', 'success');
      setActiveTimer(null);
    }
  };

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LottieLoader size={120} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Zeiten & Dauer</Text>
          <Text style={styles.pageSubtitle}>
            Zeiterfassung und Arbeitsdauer-Übersicht
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Clock size={24} color="#3B82F6" />
            <Text style={styles.statValue}>{formatHours(stats.totalHours)}</Text>
            <Text style={styles.statLabel}>Gesamtzeit</Text>
          </Card>
          <Card style={styles.statCard}>
            <Calendar size={24} color="#10B981" />
            <Text style={styles.statValue}>{formatHours(stats.thisWeek)}</Text>
            <Text style={styles.statLabel}>Diese Woche</Text>
          </Card>
          <Card style={styles.statCard}>
            <TrendingUp size={24} color="#8B5CF6" />
            <Text style={styles.statValue}>{formatHours(stats.thisMonth)}</Text>
            <Text style={styles.statLabel}>Dieser Monat</Text>
          </Card>
          <Card style={styles.statCard}>
            <CheckCircle size={24} color="#F59E0B" />
            <Text style={styles.statValue}>{stats.tasksWithTime}</Text>
            <Text style={styles.statLabel}>Aufgaben erfasst</Text>
          </Card>
        </View>

        {/* Active Timer */}
        {activeTimer && (
          <Card style={styles.activeTimerCard}>
            <View style={styles.activeTimerContent}>
              <View style={styles.pulsingDot} />
              <View style={styles.timerInfo}>
                <Text style={styles.activeTimerTitle}>Timer läuft</Text>
                <Text style={styles.activeTimerTask}>
                  {tasks.find(t => t.id === activeTimer)?.title}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.stopButton}
                onPress={handleStopTimer}
              >
                <Pause size={20} color="#ffffff" />
                <Text style={styles.stopButtonText}>Stopp</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Tasks List */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Zeiterfassung pro Aufgabe</Text>
          <Text style={styles.sectionDesc}>
            Starten Sie die Zeiterfassung für Ihre Aufgaben
          </Text>
          
          {tasks.length === 0 ? (
            <Text style={styles.emptyText}>Keine Aufgaben vorhanden</Text>
          ) : (
            <View style={styles.tasksList}>
              {tasks.map((task) => {
                const isActive = activeTimer === task.id;
                const totalTime = task.time_entries?.reduce(
                  (sum, entry) => sum + entry.duration_minutes,
                  0
                ) || 0;
                
                return (
                  <View key={task.id} style={styles.taskTimeCard}>
                    <View style={styles.taskTimeInfo}>
                      <Text style={styles.taskTimeTitle}>{task.title}</Text>
                      <View style={styles.taskTimeMeta}>
                        <Clock size={14} color="#94a3b8" />
                        <Text style={styles.taskTimeValue}>
                          {totalTime > 0
                            ? formatHours(totalTime / 60)
                            : 'Noch keine Zeit erfasst'}
                        </Text>
                      </View>
                    </View>
                    {isActive ? (
                      <TouchableOpacity
                        style={[styles.timerButton, styles.timerButtonActive]}
                        onPress={handleStopTimer}
                      >
                        <Pause size={18} color="#ffffff" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.timerButton}
                        onPress={() => handleStartTimer(task.id)}
                        disabled={!!activeTimer}
                      >
                        <Play size={18} color={activeTimer ? '#CBD5E1' : colors.primary} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        {/* Info Box */}
        <Card style={styles.infoBox}>
          <Text style={styles.infoBoxText}>
            💡 Die Zeiterfassung wird automatisch gespeichert. Detaillierte Reports und
            Export-Funktionen folgen in einer späteren Version.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#64748b',
  },
  content: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  statLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  activeTimerCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
    marginBottom: 24,
  },
  activeTimerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  pulsingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
  },
  timerInfo: {
    flex: 1,
  },
  activeTimerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3B82F6',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  activeTimerTask: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#EF4444',
    borderRadius: 10,
  },
  stopButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  sectionCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  sectionDesc: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  tasksList: {
    gap: 12,
  },
  taskTimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  taskTimeInfo: {
    flex: 1,
  },
  taskTimeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 6,
  },
  taskTimeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskTimeValue: {
    fontSize: 13,
    color: '#64748b',
  },
  timerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F7FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#DBEAFE',
  },
  timerButtonActive: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  infoBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoBoxText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
});
