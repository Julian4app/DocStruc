import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { ModernModal } from '../../components/ModernModal';
import { useToast } from '../../components/ToastProvider';
import { DatePicker } from '../../components/DatePicker';
import { Calendar, Clock, CheckCircle, Plus, Flag, Link2, X, ChevronDown, AlertCircle, CheckSquare } from 'lucide-react';

interface TimelineEvent {
  id: string;
  title: string;
  event_date: string;
  end_date?: string | null;
  description?: string | null;
  color?: string | null;
  eventType: string;
  completed: boolean;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  description?: string | null;
  priority?: string;
}

interface Defect {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'rejected';
  due_date: string | null;
}

interface LinkedItem {
  id: string;
  type: 'task' | 'defect';
  title: string;
  status: string;
  priority?: string;
  description?: string;
}

export function ProjectSchedule() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [milestones, setMilestones] = useState<TimelineEvent[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [eventType, setEventType] = useState<'milestone' | 'deadline' | 'phase'>('milestone');
  
  // Task/Defect linking states
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [allDefects, setAllDefects] = useState<Defect[]>([]);
  const [selectedItems, setSelectedItems] = useState<LinkedItem[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewItem, setPreviewItem] = useState<LinkedItem | null>(null);

  useEffect(() => {
    if (id) {
      loadScheduleData();
      loadTasksAndDefects();
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

  const loadTasksAndDefects = async () => {
    if (!id) return;

    try {
      // Load all tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, status, description, priority, due_date')
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;
      setAllTasks(tasksData || []);

      // Load all defects
      const { data: defectsData, error: defectsError } = await supabase
        .from('tasks')
        .select('id, title, description, priority, status, due_date')
        .eq('project_id', id)
        .eq('task_type', 'defect')
        .order('created_at', { ascending: false });

      if (defectsError) throw defectsError;
      setAllDefects(defectsData || []);
    } catch (error: any) {
      console.error('Error loading tasks and defects:', error);
    }
  };

  const handleCreateMilestone = async () => {
    if (!title.trim() || !eventDate) {
      showToast('Bitte Titel und Startdatum ausfüllen', 'error');
      return;
    }

    // Validate end date is after start date if provided
    if (endDate && new Date(endDate) < new Date(eventDate)) {
      showToast('Enddatum muss nach dem Startdatum liegen', 'error');
      return;
    }

    try {
      // Create milestone
      const { data: milestoneData, error: milestoneError } = await supabase
        .from('timeline_events')
        .insert({
          project_id: id,
          title: title.trim(),
          description: description.trim() || null,
          event_date: eventDate,
          end_date: endDate || null,
          color: color,
          eventType: eventType,
          completed: false
        })
        .select()
        .single();

      if (milestoneError) throw milestoneError;

      // Link selected tasks and defects
      if (selectedItems.length > 0) {
        const milestoneTasksInserts = selectedItems.map(item => ({
          milestone_id: milestoneData.id,
          task_id: item.id
        }));

        const { error: linkError } = await supabase
          .from('milestone_tasks')
          .insert(milestoneTasksInserts);

        if (linkError) throw linkError;
      }

      showToast('Meilenstein erfolgreich erstellt', 'success');
      setIsCreateModalOpen(false);
      resetForm();
      loadScheduleData();
    } catch (error: any) {
      console.error('Error creating milestone:', error);
      showToast('Fehler beim Erstellen des Meilensteins', 'error');
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setEventDate('');
    setEndDate('');
    setColor('#3B82F6');
    setEventType('milestone');
    setSelectedItems([]);
    setSearchQuery('');
    setPreviewItem(null);
  };

  const handleToggleItemSelection = (item: Task | Defect, type: 'task' | 'defect') => {
    const linkedItem: LinkedItem = {
      id: item.id,
      type,
      title: item.title,
      status: item.status,
      priority: item.priority,
      description: item.description || undefined
    };

    const isSelected = selectedItems.some(i => i.id === item.id);
    if (isSelected) {
      setSelectedItems(selectedItems.filter(i => i.id !== item.id));
      // Clear preview if unselecting the previewed item
      if (previewItem?.id === item.id) {
        setPreviewItem(null);
      }
    } else {
      setSelectedItems([...selectedItems, linkedItem]);
    }
  };

  const handleRemoveSelectedItem = (itemId: string) => {
    setSelectedItems(selectedItems.filter(i => i.id !== itemId));
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

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical': return '#EF4444';
      case 'high': return '#F59E0B';
      case 'medium': return '#3B82F6';
      case 'low': return '#10B981';
      default: return '#94a3b8';
    }
  };

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'critical': return 'Kritisch';
      case 'high': return 'Hoch';
      case 'medium': return 'Mittel';
      case 'low': return 'Niedrig';
      default: return priority;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Offen';
      case 'in_progress': return 'In Bearbeitung';
      case 'done': return 'Erledigt';
      case 'resolved': return 'Behoben';
      case 'blocked': return 'Blockiert';
      case 'rejected': return 'Abgelehnt';
      default: return status;
    }
  };

  // Filter items based on search
  const filteredTasks = allTasks.filter(task =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDefects = allDefects.filter(defect =>
    defect.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          resetForm();
        }}
        title="Neuer Meilenstein"
        maxWidth={700}
      >
        <View style={styles.modalContent}>
          {/* Title */}
          <Input
            label="Titel *"
            value={title}
            onChangeText={setTitle}
            placeholder="z.B. Rohbau abgeschlossen"
          />

          {/* Description */}
          <View>
            <Text style={styles.inputLabel}>Beschreibung</Text>
            <RNTextInput
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
              placeholder="Optionale Beschreibung..."
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Start Date */}
          <DatePicker
            label="Startdatum *"
            value={eventDate}
            onChange={setEventDate}
            placeholder="TT.MM.JJJJ"
          />

          {/* End Date */}
          <DatePicker
            label="Enddatum (optional)"
            value={endDate}
            onChange={setEndDate}
            placeholder="TT.MM.JJJJ"
          />

          {/* Type Selection */}
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

          {/* Color Picker */}
          <View>
            <Text style={styles.inputLabel}>Farbe</Text>
            <View style={styles.colorGrid}>
              {['#3B82F6', '#EF4444', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#14B8A6', '#6366F1'].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorOption,
                    { backgroundColor: c },
                    color === c && styles.colorOptionSelected
                  ]}
                  onPress={() => setColor(c)}
                />
              ))}
            </View>
          </View>

          {/* Task/Defect Linking */}
          <View>
            <Text style={styles.inputLabel}>Aufgaben & Mängel verknüpfen</Text>
            
            {/* Selected Items Display */}
            {selectedItems.length > 0 && (
              <View style={styles.selectedItemsContainer}>
                {selectedItems.map(item => (
                  <View key={item.id} style={styles.selectedItemChip}>
                    {item.type === 'task' ? (
                      <CheckSquare size={14} color={colors.primary} />
                    ) : (
                      <AlertCircle size={14} color="#EF4444" />
                    )}
                    <Text style={styles.selectedItemText}>{item.title}</Text>
                    <TouchableOpacity onPress={() => handleRemoveSelectedItem(item.id)}>
                      <X size={14} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Dropdown Trigger */}
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <Link2 size={16} color="#64748b" />
              <Text style={styles.dropdownTriggerText}>
                {selectedItems.length > 0 
                  ? `${selectedItems.length} ausgewählt` 
                  : 'Aufgaben/Mängel auswählen'}
              </Text>
              <ChevronDown size={16} color="#64748b" />
            </TouchableOpacity>

            {/* Dropdown Content */}
            {isDropdownOpen && (
              <View style={styles.dropdownContent}>
                {/* Search */}
                <View style={styles.searchContainer}>
                  <RNTextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Suchen..."
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
                  {/* Tasks Section */}
                  {filteredTasks.length > 0 && (
                    <View style={styles.dropdownSection}>
                      <Text style={styles.dropdownSectionTitle}>Aufgaben</Text>
                      {filteredTasks.map(task => {
                        const isSelected = selectedItems.some(i => i.id === task.id);
                        return (
                          <TouchableOpacity
                            key={task.id}
                            style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                            onPress={() => handleToggleItemSelection(task, 'task')}
                            onLongPress={() => setPreviewItem({
                              id: task.id,
                              type: 'task',
                              title: task.title,
                              status: task.status,
                              priority: task.priority,
                              description: task.description || undefined
                            })}
                          >
                            <View style={styles.dropdownItemLeft}>
                              <CheckSquare size={16} color={isSelected ? colors.primary : '#94a3b8'} />
                              <Text style={[styles.dropdownItemTitle, isSelected && styles.dropdownItemTitleSelected]}>
                                {task.title}
                              </Text>
                            </View>
                            <Text style={[styles.dropdownItemStatus, { color: getPriorityColor(task.priority) }]}>
                              {getStatusLabel(task.status)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {/* Defects Section */}
                  {filteredDefects.length > 0 && (
                    <View style={styles.dropdownSection}>
                      <Text style={styles.dropdownSectionTitle}>Mängel</Text>
                      {filteredDefects.map(defect => {
                        const isSelected = selectedItems.some(i => i.id === defect.id);
                        return (
                          <TouchableOpacity
                            key={defect.id}
                            style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                            onPress={() => handleToggleItemSelection(defect, 'defect')}
                            onLongPress={() => setPreviewItem({
                              id: defect.id,
                              type: 'defect',
                              title: defect.title,
                              status: defect.status,
                              priority: defect.priority,
                              description: defect.description || undefined
                            })}
                          >
                            <View style={styles.dropdownItemLeft}>
                              <AlertCircle size={16} color={isSelected ? '#EF4444' : '#94a3b8'} />
                              <Text style={[styles.dropdownItemTitle, isSelected && styles.dropdownItemTitleSelected]}>
                                {defect.title}
                              </Text>
                            </View>
                            <View style={styles.dropdownItemRight}>
                              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(defect.priority) }]}>
                                <Text style={styles.priorityBadgeText}>{getPriorityLabel(defect.priority)}</Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {filteredTasks.length === 0 && filteredDefects.length === 0 && (
                    <Text style={styles.emptyDropdownText}>Keine Ergebnisse gefunden</Text>
                  )}
                </ScrollView>

                {/* Preview Panel */}
                {previewItem && (
                  <View style={styles.previewPanel}>
                    <View style={styles.previewHeader}>
                      <View style={styles.previewTypeIndicator}>
                        {previewItem.type === 'task' ? (
                          <CheckSquare size={16} color={colors.primary} />
                        ) : (
                          <AlertCircle size={16} color="#EF4444" />
                        )}
                        <Text style={styles.previewType}>
                          {previewItem.type === 'task' ? 'Aufgabe' : 'Mangel'}
                        </Text>
                      </View>
                      {previewItem.priority && (
                        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(previewItem.priority) }]}>
                          <Text style={styles.priorityBadgeText}>{getPriorityLabel(previewItem.priority)}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.previewTitle}>{previewItem.title}</Text>
                    {previewItem.description && (
                      <Text style={styles.previewDescription} numberOfLines={3}>
                        {previewItem.description}
                      </Text>
                    )}
                    <Text style={styles.previewStatus}>
                      Status: {getStatusLabel(previewItem.status)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.modalActions}>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateModalOpen(false);
                resetForm();
              }}
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
  textArea: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    minHeight: 80,
    textAlignVertical: 'top',
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
  colorGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  selectedItemsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  selectedItemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectedItemText: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '500',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dropdownTriggerText: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
  },
  dropdownContent: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  searchContainer: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchInput: {
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    fontSize: 14,
    color: '#0f172a',
  },
  dropdownScroll: {
    maxHeight: 250,
  },
  dropdownSection: {
    padding: 12,
  },
  dropdownSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  dropdownItemSelected: {
    backgroundColor: '#F1F5F9',
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dropdownItemTitle: {
    fontSize: 14,
    color: '#475569',
    flex: 1,
  },
  dropdownItemTitleSelected: {
    color: '#0f172a',
    fontWeight: '600',
  },
  dropdownItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownItemStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  emptyDropdownText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    padding: 20,
  },
  previewPanel: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewTypeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewType: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 6,
  },
  previewDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 6,
  },
  previewStatus: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
});
