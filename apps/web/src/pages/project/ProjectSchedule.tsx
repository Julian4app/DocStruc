import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { ModernModal } from '../../components/ModernModal';
import { useToast } from '../../components/ToastProvider';
import { Calendar, Clock, CheckCircle, Plus, Flag } from 'lucide-react';

interface TimelineEvent {
  id: string;
  title: string;
  event_date: string;
  eventType: string;
  completed: boolean;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
}

export function ProjectSchedule() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [milestones, setMilestones] = useState<TimelineEvent[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState<'milestone' | 'deadline' | 'phase'>('milestone');

  useEffect(() => {
    if (id) {
      loadScheduleData();
    }
  }, [id]);

  const loadScheduleData = async () => {
    if (!id) return;
    setLoading(true);

    try {
      // Load milestones/timeline events
      const { data: timelineData, error: timelineError } = await supabase
        .from('timeline_events')
        .select('*')
        .eq('project_id', id)
        .order('event_date', { ascending: true });

      if (timelineError) throw timelineError;
      setMilestones(timelineData || []);

      // Load upcoming tasks with due dates
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, due_date, status')
        .eq('project_id', id)
        .not('due_date', 'is', null)
        .neq('status', 'done')
        .order('due_date', { ascending: true })
        .limit(10);

      if (tasksError) throw tasksError;
      setUpcomingTasks(tasksData || []);
    } catch (error: any) {
      console.error('Error loading schedule:', error);
      showToast('Fehler beim Laden der Termine', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMilestone = async () => {
    if (!title.trim() || !eventDate) {
      showToast('Bitte alle Felder ausfüllen', 'error');
      return;
    }

    try {
      const { error } = await supabase.from('timeline_events').insert({
        project_id: id,
        title: title.trim(),
        event_date: eventDate,
        eventType: eventType,
        completed: false
      });

      if (error) throw error;

      showToast('Meilenstein erfolgreich erstellt', 'success');
      setIsCreateModalOpen(false);
      setTitle('');
      setEventDate('');
      setEventType('milestone');
      loadScheduleData();
    } catch (error: any) {
      console.error('Error creating milestone:', error);
      showToast('Fehler beim Erstellen des Meilensteins', 'error');
    }
  };

  const handleToggleMilestone = async (milestoneId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('timeline_events')
        .update({ completed: !currentStatus })
        .eq('id', milestoneId);

      if (error) throw error;
      loadScheduleData();
    } catch (error: any) {
      console.error('Error toggling milestone:', error);
      showToast('Fehler beim Aktualisieren', 'error');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getDaysUntil = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'milestone': return 'Meilenstein';
      case 'deadline': return 'Deadline';
      case 'phase': return 'Bauphase';
      default: return type;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'milestone': return '#3B82F6';
      case 'deadline': return '#EF4444';
      case 'phase': return '#8B5CF6';
      default: return '#94a3b8';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Termine & Ablauf</Text>
            <Text style={styles.pageSubtitle}>
              Terminplanung, Bauphasen und Meilensteine
            </Text>
          </View>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={18} /> Meilenstein
          </Button>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Stats Row */}
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>{milestones.length}</Text>
              <Text style={styles.statLabel}>Meilensteine</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>
                {milestones.filter(m => m.completed).length}
              </Text>
              <Text style={styles.statLabel}>Abgeschlossen</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>{upcomingTasks.length}</Text>
              <Text style={styles.statLabel}>Offene Termine</Text>
            </Card>
          </View>

          {/* Milestones Timeline */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Flag size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Meilensteine & Bauphasen</Text>
            </View>
            {milestones.length === 0 ? (
              <Text style={styles.emptyText}>Noch keine Meilensteine definiert</Text>
            ) : (
              <View style={styles.milestonesList}>
                {milestones.map((milestone) => {
                  const daysUntil = getDaysUntil(milestone.event_date);
                  const isPast = daysUntil < 0;
                  const isToday = daysUntil === 0;
                  
                  return (
                    <View key={milestone.id} style={styles.milestoneCard}>
                      <TouchableOpacity
                        style={styles.milestoneCheckbox}
                        onPress={() => handleToggleMilestone(milestone.id, milestone.completed)}
                      >
                        {milestone.completed ? (
                          <CheckCircle size={24} color="#22c55e" />
                        ) : (
                          <View style={styles.checkbox} />
                        )}
                      </TouchableOpacity>
                      <View style={styles.milestoneContent}>
                        <Text style={[
                          styles.milestoneTitle,
                          milestone.completed && styles.milestoneTitleCompleted
                        ]}>
                          {milestone.title}
                        </Text>
                        <View style={styles.milestoneFooter}>
                          <View style={[
                            styles.eventTypeBadge,
                            { backgroundColor: getEventTypeColor(milestone.eventType) }
                          ]}>
                            <Text style={styles.eventTypeBadgeText}>
                              {getEventTypeLabel(milestone.eventType)}
                            </Text>
                          </View>
                          <Text style={styles.milestoneDate}>
                            {formatDate(milestone.event_date)}
                          </Text>
                        </View>
                        {!milestone.completed && (
                          <Text style={[
                            styles.daysUntil,
                            isPast && styles.daysUntilOverdue,
                            isToday && styles.daysUntilToday
                          ]}>
                            {isToday ? '⚡ Heute!' :
                             isPast ? `⚠️ ${Math.abs(daysUntil)} Tag(e) überfällig` :
                             `📅 in ${daysUntil} Tag(en)`}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>

          {/* Upcoming Tasks */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Clock size={20} color="#F59E0B" />
              <Text style={styles.sectionTitle}>Anstehende Aufgaben</Text>
            </View>
            {upcomingTasks.length === 0 ? (
              <Text style={styles.emptyText}>Keine anstehenden Aufgaben mit Frist</Text>
            ) : (
              <View style={styles.tasksList}>
                {upcomingTasks.map((task) => {
                  const daysUntil = task.due_date ? getDaysUntil(task.due_date) : null;
                  const isOverdue = daysUntil !== null && daysUntil < 0;
                  
                  return (
                    <View key={task.id} style={styles.taskCard}>
                      <View style={styles.taskInfo}>
                        <Text style={styles.taskTitle}>{task.title}</Text>
                        {task.due_date && (
                          <Text style={[
                            styles.taskDueDate,
                            isOverdue && styles.taskOverdue
                          ]}>
                            📅 {formatDate(task.due_date)}
                            {daysUntil !== null && (
                              <Text style={styles.taskDaysUntil}>
                                {' '}({daysUntil < 0 ? 
                                  `${Math.abs(daysUntil)} Tag(e) überfällig` : 
                                  `in ${daysUntil} Tag(en)`})
                              </Text>
                            )}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        </ScrollView>
      </View>

      {/* Create Milestone Modal */}
      <ModernModal
        visible={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setTitle('');
          setEventDate('');
          setEventType('milestone');
        }}
        title="Neuer Meilenstein"
      >
        <View style={styles.modalContent}>
          <Input
            label="Titel *"
            value={title}
            onChangeText={setTitle}
            placeholder="z.B. Rohbau abgeschlossen"
          />
          <Input
            label="Datum *"
            value={eventDate}
            onChangeText={setEventDate}
            placeholder="YYYY-MM-DD"
          />
          <View>
            <Text style={styles.inputLabel}>Typ</Text>
            <View style={styles.typeGrid}>
              {(['milestone', 'deadline', 'phase'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeOption,
                    eventType === type && {
                      backgroundColor: getEventTypeColor(type),
                      borderColor: getEventTypeColor(type)
                    }
                  ]}
                  onPress={() => setEventType(type)}
                >
                  <Text style={[
                    styles.typeOptionText,
                    eventType === type && { color: '#ffffff' }
                  ]}>
                    {getEventTypeLabel(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.modalActions}>
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
              style={{ flex: 1 }}
            >
              Abbrechen
            </Button>
            <Button onClick={handleCreateMilestone} style={{ flex: 1 }}>
              Erstellen
            </Button>
          </View>
        </View>
      </ModernModal>
    </>
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
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
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
  },
  sectionCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  milestonesList: {
    gap: 16,
  },
  milestoneCard: {
    flexDirection: 'row',
    gap: 16,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  milestoneCheckbox: {
    width: 24,
    height: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  milestoneContent: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  milestoneTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  milestoneFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  eventTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  eventTypeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  milestoneDate: {
    fontSize: 14,
    color: '#64748b',
  },
  daysUntil: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  daysUntilOverdue: {
    color: '#EF4444',
  },
  daysUntilToday: {
    color: '#F59E0B',
  },
  tasksList: {
    gap: 12,
  },
  taskCard: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  taskInfo: {
    gap: 6,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  taskDueDate: {
    fontSize: 13,
    color: '#64748b',
  },
  taskOverdue: {
    color: '#EF4444',
    fontWeight: '600',
  },
  taskDaysUntil: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalContent: {
    gap: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  typeGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
});
