import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { ModernModal } from '../../components/ModernModal';
import { useToast } from '../../components/ToastProvider';
import { DatePicker } from '../../components/DatePicker';
import { Calendar, Clock, CheckCircle, Plus, Flag, Link2, X, ChevronDown, AlertCircle, CheckSquare, Info, Edit2, Trash2 } from 'lucide-react';
import { TaskDetailModal } from './TaskModals';

interface TimelineEvent {
  id: string;
  title: string;
  start_date: string;
  end_date?: string | null;
  description?: string | null;
  color?: string | null;
  event_type: string;
  status: string;
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
  const [activeTab, setActiveTab] = useState<'list' | 'timeline' | 'calendar'>('list');
  const [milestones, setMilestones] = useState<TimelineEvent[]>([]);
  const [milestonesWithLinkedItems, setMilestonesWithLinkedItems] = useState<any[]>([]);
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
  
  // Calendar states
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMilestone, setSelectedMilestone] = useState<TimelineEvent | null>(null);
  const [selectedMilestoneLinkedItems, setSelectedMilestoneLinkedItems] = useState<any[]>([]);
  const [isEditMilestoneMode, setIsEditMilestoneMode] = useState(false);
  
  // Task detail modal states
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<any>(null);
  const [taskImages, setTaskImages] = useState<any[]>([]);
  const [taskDocumentation, setTaskDocumentation] = useState<any[]>([]);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [docFormData, setDocFormData] = useState<any>({});
  const [isRecording, setIsRecording] = useState(false);

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
        .order('start_date', { ascending: true });

      if (timelineError) throw timelineError;
      setMilestones(timelineData || []);

      // Load milestones with linked tasks/defects for timeline view
      await loadMilestonesWithLinkedItems(timelineData || []);

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

  const loadMilestonesWithLinkedItems = async (milestonesData: TimelineEvent[]) => {
    try {
      const milestonesWithItems = await Promise.all(
        milestonesData.map(async (milestone) => {
          // Get linked task/defect IDs
          const { data: linkedData, error: linkedError } = await supabase
            .from('milestone_tasks')
            .select('task_id')
            .eq('milestone_id', milestone.id);

          if (linkedError) throw linkedError;

          const taskIds = linkedData?.map(l => l.task_id) || [];
          
          // Get task/defect details
          if (taskIds.length > 0) {
            const { data: tasksData, error: tasksError } = await supabase
              .from('tasks')
              .select('id, title, status, priority, task_type')
              .in('id', taskIds);

            if (tasksError) throw tasksError;

            return {
              ...milestone,
              linkedItems: tasksData || []
            };
          }

          return {
            ...milestone,
            linkedItems: []
          };
        })
      );

      setMilestonesWithLinkedItems(milestonesWithItems);
    } catch (error: any) {
      console.error('Error loading milestone linked items:', error);
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
          start_date: eventDate,
          end_date: endDate || null,
          color: color,
          event_type: eventType,
          status: 'scheduled'
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

  const handleToggleMilestone = async (milestoneId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'completed' ? 'scheduled' : 'completed';
      const { error } = await supabase
        .from('timeline_events')
        .update({ status: newStatus })
        .eq('id', milestoneId);

      if (error) throw error;
      loadScheduleData();
    } catch (error: any) {
      console.error('Error toggling milestone:', error);
      showToast('Fehler beim Aktualisieren', 'error');
    }
  };

  const handleMilestoneClick = async (milestone: TimelineEvent) => {
    console.log('handleMilestoneClick called with milestone:', milestone.id, milestone.title);
    setSelectedMilestone(milestone);
    setIsEditMilestoneMode(false);
    
    // Load linked items for this milestone
    try {
      const { data: linkedData, error: linkedError } = await supabase
        .from('milestone_tasks')
        .select('task_id')
        .eq('milestone_id', milestone.id);

      if (linkedError) throw linkedError;

      const taskIds = linkedData?.map(l => l.task_id) || [];
      
      if (taskIds.length > 0) {
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('id, title, status, priority, task_type, description, due_date')
          .in('id', taskIds);

        if (tasksError) throw tasksError;
        setSelectedMilestoneLinkedItems(tasksData || []);
      } else {
        setSelectedMilestoneLinkedItems([]);
      }
    } catch (error: any) {
      console.error('Error loading milestone linked items:', error);
      setSelectedMilestoneLinkedItems([]);
    }
  };

  const handleEditMilestone = () => {
    if (!selectedMilestone) return;
    setTitle(selectedMilestone.title);
    setDescription(selectedMilestone.description || '');
    setEventDate(selectedMilestone.start_date);
    setEndDate(selectedMilestone.end_date || '');
    setColor(selectedMilestone.color || '#3B82F6');
    setEventType(selectedMilestone.event_type as any);
    setIsEditMilestoneMode(true);
  };

  const handleUpdateMilestone = async () => {
    if (!selectedMilestone || !title.trim() || !eventDate) {
      showToast('Bitte Titel und Startdatum ausfüllen', 'error');
      return;
    }

    if (endDate && new Date(endDate) < new Date(eventDate)) {
      showToast('Enddatum muss nach dem Startdatum liegen', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('timeline_events')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          start_date: eventDate,
          end_date: endDate || null,
          color: color,
          event_type: eventType
        })
        .eq('id', selectedMilestone.id);

      if (error) throw error;

      showToast('Meilenstein erfolgreich aktualisiert', 'success');
      setSelectedMilestone(null);
      setIsEditMilestoneMode(false);
      resetForm();
      loadScheduleData();
    } catch (error: any) {
      console.error('Error updating milestone:', error);
      showToast('Fehler beim Aktualisieren des Meilensteins', 'error');
    }
  };

  const handleDeleteMilestone = async () => {
    if (!selectedMilestone) return;

    if (!window.confirm(`Möchten Sie den Meilenstein "${selectedMilestone.title}" wirklich löschen?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('timeline_events')
        .delete()
        .eq('id', selectedMilestone.id);

      if (error) throw error;

      showToast('Meilenstein erfolgreich gelöscht', 'success');
      setSelectedMilestone(null);
      loadScheduleData();
    } catch (error: any) {
      console.error('Error deleting milestone:', error);
      showToast('Fehler beim Löschen des Meilensteins', 'error');
    }
  };

  const handleTaskClick = async (task: any) => {
    try {
      // Load full task details
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', task.id)
        .single();

      if (taskError) throw taskError;

      setSelectedTaskForDetail(taskData);

      // Load task images
      const { data: imagesData } = await supabase
        .from('task_images')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false });

      setTaskImages(imagesData || []);

      // Load task documentation
      const { data: docsData } = await supabase
        .from('task_documentation')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false });

      setTaskDocumentation(docsData || []);

      // Load project members
      const { data: membersData } = await supabase
        .from('project_members')
        .select(`
          user_id,
          role,
          profiles:user_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('project_id', id);

      setProjectMembers(membersData || []);
    } catch (error: any) {
      console.error('Error loading task details:', error);
      showToast('Fehler beim Laden der Aufgabe', 'error');
    }
  };

  const getUserName = (userId: string) => {
    const member = projectMembers.find(m => m.user_id === userId);
    if (member?.profiles) {
      const profile = member.profiles as any;
      return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email;
    }
    return 'Unbekannt';
  };

  const getLinkedItemCount = (milestoneId: string) => {
    const milestoneWithItems = milestonesWithLinkedItems.find(m => m.id === milestoneId);
    return milestoneWithItems?.linkedItems?.length || 0;
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

  // Render List View
  const renderListView = () => (
    <>
      {/* Stats Row */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{milestones.length}</Text>
          <Text style={styles.statLabel}>Meilensteine</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>
            {milestones.filter(m => m.status === 'completed').length}
          </Text>
          <Text style={styles.statLabel}>Abgeschlossen</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{upcomingTasks.length}</Text>
          <Text style={styles.statLabel}>Offene Termine</Text>
        </Card>
      </View>

      {/* Milestones List */}
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
              const daysUntil = getDaysUntil(milestone.start_date);
              const isPast = daysUntil < 0;
              const isToday = daysUntil === 0;
              const linkedCount = getLinkedItemCount(milestone.id);
              
              return (
                <View key={milestone.id} style={styles.milestoneCard}>
                  <TouchableOpacity
                    style={styles.milestoneCheckbox}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleToggleMilestone(milestone.id, milestone.status);
                    }}
                  >
                    {milestone.status === "completed" ? (
                      <CheckCircle size={24} color="#22c55e" />
                    ) : (
                      <View style={styles.checkbox} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.milestoneContent}
                    onPress={() => {
                      console.log('List view milestone clicked:', milestone.id);
                      handleMilestoneClick(milestone);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.milestoneTitle,
                      milestone.status === "completed" && styles.milestoneTitleCompleted
                    ]}>
                      {milestone.title}
                    </Text>
                    <View style={styles.milestoneFooter}>
                      <View style={[
                        styles.eventTypeBadge,
                        { backgroundColor: getEventTypeColor(milestone.event_type) }
                      ]}>
                        <Text style={styles.eventTypeBadgeText}>
                          {getEventTypeLabel(milestone.event_type)}
                        </Text>
                      </View>
                      {linkedCount > 0 && (
                        <View style={styles.linkedCountBadge}>
                          <Link2 size={12} color={colors.primary} />
                          <Text style={styles.linkedCountText}>{linkedCount}</Text>
                        </View>
                      )}
                      <Text style={styles.milestoneDate}>
                        {formatDate(milestone.start_date)}
                      </Text>
                    </View>
                    {milestone.status !== "completed" && (
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
                  </TouchableOpacity>
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
    </>
  );

  // Render Timeline View
  const renderTimelineView = () => (
    <View style={styles.timelineContainer}>
      {milestonesWithLinkedItems.length === 0 ? (
        <Card style={styles.emptyStateCard}>
          <Flag size={48} color="#CBD5E1" />
          <Text style={styles.emptyStateTitle}>Keine Meilensteine</Text>
          <Text style={styles.emptyStateText}>
            Erstellen Sie Ihren ersten Meilenstein, um die Timeline zu sehen
          </Text>
        </Card>
      ) : (
        <View style={styles.timelineContent}>
          {milestonesWithLinkedItems.map((milestone, index) => (
            <TouchableOpacity 
              key={milestone.id}
              onPress={() => {
                console.log('Timeline milestone clicked:', milestone.id);
                handleMilestoneClick(milestone);
              }}
              activeOpacity={0.7}
              style={styles.timelineItemWrapper}
            >
              <Card style={[
                styles.timelineCard,
                { borderLeftWidth: 4, borderLeftColor: milestone.color || getEventTypeColor(milestone.event_type) }
              ]}>
                {/* Header Row */}
                <View style={styles.timelineCardHeader}>
                  <View style={styles.timelineCardTitleSection}>
                    <Text style={styles.timelineCardTitle}>{milestone.title}</Text>
                    <View style={styles.timelineCardMeta}>
                      <View style={[
                        styles.timelineTypeBadge,
                        { backgroundColor: milestone.color || getEventTypeColor(milestone.event_type) }
                      ]}>
                        <Text style={styles.timelineTypeBadgeText}>
                          {getEventTypeLabel(milestone.event_type)}
                        </Text>
                      </View>
                      {milestone.status === "completed" && (
                        <View style={styles.timelineCompletedBadge}>
                          <CheckCircle size={12} color="#22c55e" />
                          <Text style={styles.timelineCompletedText}>Abgeschlossen</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.timelineCardDate}>
                    <Text style={styles.timelineCardDateText}>
                      {formatDate(milestone.start_date)}
                    </Text>
                    {milestone.end_date && (
                      <Text style={styles.timelineCardDateRange}>
                        bis {formatDate(milestone.end_date)}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Description */}
                {milestone.description && (
                  <Text style={styles.timelineDescription}>
                    {milestone.description}
                  </Text>
                )}

                {/* Linked Items */}
                {milestone.linkedItems && milestone.linkedItems.length > 0 && (
                  <View style={styles.linkedItemsSection}>
                    <View style={styles.linkedItemsHeader}>
                      <Link2 size={14} color="#64748b" />
                      <Text style={styles.linkedItemsTitle}>
                        Verknüpfte Aufgaben & Mängel ({milestone.linkedItems.length})
                      </Text>
                    </View>
                    <View style={styles.linkedItemsList}>
                      {milestone.linkedItems.map((item: any) => (
                        <TouchableOpacity 
                          key={item.id} 
                          style={styles.linkedItem}
                          onPress={(e) => {
                            e?.stopPropagation?.();
                            handleTaskClick(item);
                          }}
                        >
                          {item.task_type === 'defect' ? (
                            <AlertCircle size={14} color="#EF4444" />
                          ) : (
                            <CheckSquare size={14} color={colors.primary} />
                          )}
                          <Text style={styles.linkedItemTitle}>{item.title}</Text>
                          {item.priority && (
                            <View style={[
                              styles.linkedItemPriority,
                              { backgroundColor: getPriorityColor(item.priority) }
                            ]}>
                              <Text style={styles.linkedItemPriorityText}>
                                {getPriorityLabel(item.priority)}
                              </Text>
                            </View>
                          )}
                          <Text style={[
                            styles.linkedItemStatus,
                            { color: item.status === 'done' || item.status === 'resolved' ? '#22c55e' : '#94a3b8' }
                          ]}>
                            {getStatusLabel(item.status)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Days Until */}
                {milestone.status !== "completed" && (
                  <View style={styles.timelineFooter}>
                    <Text style={[
                      styles.timelineDaysUntil,
                      getDaysUntil(milestone.start_date) < 0 && styles.daysUntilOverdue,
                      getDaysUntil(milestone.start_date) === 0 && styles.daysUntilToday
                    ]}>
                      {getDaysUntil(milestone.start_date) === 0 ? '⚡ Heute!' :
                       getDaysUntil(milestone.start_date) < 0 ? 
                         `⚠️ ${Math.abs(getDaysUntil(milestone.start_date))} Tag(e) überfällig` :
                         `📅 in ${getDaysUntil(milestone.start_date)} Tag(en)`}
                    </Text>
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  // Render Calendar View (Placeholder)
  const renderCalendarView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Adjust so Monday is 0
    
    // Get milestones for current month
    const monthMilestones = milestonesWithLinkedItems.filter(m => {
      const milestoneDate = new Date(m.start_date);
      return milestoneDate.getMonth() === month && milestoneDate.getFullYear() === year;
    });
    
    // Group milestones by day
    const milestonesByDay: { [key: number]: typeof milestonesWithLinkedItems } = {};
    monthMilestones.forEach(m => {
      const day = new Date(m.start_date).getDate();
      if (!milestonesByDay[day]) {
        milestonesByDay[day] = [];
      }
      milestonesByDay[day].push(m);
    });
    
    // Generate calendar days
    const calendarDays: (number | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      calendarDays.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      calendarDays.push(day);
    }
    
    const monthNames = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    
    const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    
    const goToPreviousMonth = () => {
      setCurrentDate(new Date(year, month - 1, 1));
    };
    
    const goToNextMonth = () => {
      setCurrentDate(new Date(year, month + 1, 1));
    };
    
    const goToToday = () => {
      setCurrentDate(new Date());
    };
    
    return (
      <>
        <Card style={styles.calendarCard}>
          {/* Calendar Header */}
          <View style={styles.calendarHeader}>
            <View style={styles.calendarHeaderLeft}>
              <Text style={styles.calendarMonthTitle}>
                {monthNames[month]} {year}
              </Text>
              <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
                <Text style={styles.todayButtonText}>Heute</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.calendarNavigation}>
              <TouchableOpacity style={styles.navButton} onPress={goToPreviousMonth}>
                <Text style={styles.navButtonText}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.navButton} onPress={goToNextMonth}>
                <Text style={styles.navButtonText}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Week Days */}
          <View style={styles.weekDaysRow}>
            {weekDays.map(day => (
              <View key={day} style={styles.weekDayCell}>
                <Text style={styles.weekDayText}>{day}</Text>
              </View>
            ))}
          </View>
          
          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {calendarDays.map((day, index) => {
              const today = new Date();
              const isToday = day !== null && 
                day === today.getDate() && 
                month === today.getMonth() && 
                year === today.getFullYear();
              
              const dayMilestones = day !== null ? milestonesByDay[day] || [] : [];
              const weekday = index % 7;
              const isWeekend = weekday === 5 || weekday === 6; // Saturday or Sunday
              
              return (
                <View key={index} style={[
                  styles.calendarDayCell,
                  isWeekend && styles.calendarDayCellWeekend
                ]}>
                  {day !== null && (
                    <>
                      <View style={[styles.dayNumber, isToday && styles.dayNumberToday]}>
                        <Text style={[styles.dayNumberText, isToday && styles.dayNumberTextToday]}>
                          {day}
                        </Text>
                      </View>
                      
                      {/* Milestone Cards */}
                      <View style={styles.calendarMilestones}>
                        {dayMilestones.map((milestone) => (
                          <TouchableOpacity
                            key={milestone.id}
                            style={[
                              styles.calendarMilestoneCard,
                              { borderLeftColor: milestone.color || getEventTypeColor(milestone.event_type) }
                            ]}
                            onPress={() => handleMilestoneClick(milestone)}
                          >
                            <Text 
                              style={styles.calendarMilestoneTitle}
                              numberOfLines={2}
                            >
                              {milestone.title}
                            </Text>
                            <View style={styles.calendarMilestoneFooter}>
                              <Text style={styles.calendarMilestoneTime}>
                                {new Date(milestone.start_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} hrs
                              </Text>
                              {milestone.status === "completed" && (
                                <View style={styles.calendarMilestoneProgress}>
                                  <Text style={styles.calendarMilestoneProgressText}>100%</Text>
                                </View>
                              )}
                              {milestone.status !== "completed" && milestone.linkedItems && milestone.linkedItems.length > 0 && (
                                <View style={styles.calendarMilestoneProgress}>
                                  <Text style={styles.calendarMilestoneProgressText}>
                                    {Math.round((milestone.linkedItems.filter((i: any) => i.status === 'done' || i.status === 'resolved').length / milestone.linkedItems.length) * 100)}%
                                  </Text>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        </Card>
        
        {/* Calendar Legend */}
        <Card style={styles.legendCard}>
          <Text style={styles.legendTitle}>Legende</Text>
          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: getEventTypeColor('milestone') }]} />
              <Text style={styles.legendText}>Meilenstein</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: getEventTypeColor('deadline') }]} />
              <Text style={styles.legendText}>Deadline</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: getEventTypeColor('phase') }]} />
              <Text style={styles.legendText}>Bauphase</Text>
            </View>
          </View>
        </Card>
        
        {/* Milestone Detail Modal */}
        {selectedMilestone && !isEditMilestoneMode && (
          <ModernModal
            visible={true}
            onClose={() => {
              setSelectedMilestone(null);
              setSelectedMilestoneLinkedItems([]);
            }}
            title={selectedMilestone.title}
            maxWidth={700}
          >
            <View style={styles.milestoneDetailContent}>
              {/* Action Buttons Row */}
              <View style={styles.modalActionButtons}>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={handleEditMilestone}
                >
                  <Edit2 size={16} color={colors.primary} />
                  <Text style={styles.editButtonText}>Bearbeiten</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={handleDeleteMilestone}
                >
                  <Trash2 size={16} color="#EF4444" />
                  <Text style={styles.deleteButtonText}>Löschen</Text>
                </TouchableOpacity>
              </View>

              {/* Type Badge */}
              <View style={[
                styles.eventTypeBadge,
                { 
                  backgroundColor: selectedMilestone.color || getEventTypeColor(selectedMilestone.event_type),
                  alignSelf: 'flex-start'
                }
              ]}>
                <Text style={styles.eventTypeBadgeText}>
                  {getEventTypeLabel(selectedMilestone.event_type)}
                </Text>
              </View>
              
              {/* Date */}
              <View style={styles.detailRow}>
                <Calendar size={16} color="#64748b" />
                <Text style={styles.detailLabel}>Datum:</Text>
                <Text style={styles.detailValue}>{formatDate(selectedMilestone.start_date)}</Text>
              </View>
              
              {selectedMilestone.end_date && (
                <View style={styles.detailRow}>
                  <Calendar size={16} color="#64748b" />
                  <Text style={styles.detailLabel}>Enddatum:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedMilestone.end_date)}</Text>
                </View>
              )}
              
              {/* Description */}
              {selectedMilestone.description && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Beschreibung</Text>
                  <Text style={styles.detailDescription}>{selectedMilestone.description}</Text>
                </View>
              )}
              
              {/* Status */}
              <View style={styles.detailRow}>
                {selectedMilestone.status === 'completed' ? (
                  <>
                    <CheckCircle size={16} color="#22c55e" />
                    <Text style={[styles.detailLabel, { color: '#22c55e' }]}>Abgeschlossen</Text>
                  </>
                ) : (
                  <>
                    <Clock size={16} color="#F59E0B" />
                    <Text style={styles.detailLabel}>
                      {getDaysUntil(selectedMilestone.start_date) === 0 ? 'Heute fällig' :
                       getDaysUntil(selectedMilestone.start_date) < 0 ? 
                         `${Math.abs(getDaysUntil(selectedMilestone.start_date))} Tag(e) überfällig` :
                         `Fällig in ${getDaysUntil(selectedMilestone.start_date)} Tag(en)`}
                    </Text>
                  </>
                )}
              </View>

              {/* Linked Items */}
              {selectedMilestoneLinkedItems.length > 0 && (
                <View style={styles.detailSection}>
                  <View style={styles.linkedItemsHeader}>
                    <Link2 size={16} color="#64748b" />
                    <Text style={styles.detailSectionTitle}>
                      Verknüpfte Aufgaben & Mängel ({selectedMilestoneLinkedItems.length})
                    </Text>
                  </View>
                  <View style={styles.linkedItemsList}>
                    {selectedMilestoneLinkedItems.map((item: any) => (
                      <TouchableOpacity 
                        key={item.id} 
                        style={styles.linkedItemCard}
                        onPress={() => handleTaskClick(item)}
                      >
                        {item.task_type === 'defect' ? (
                          <AlertCircle size={16} color="#EF4444" />
                        ) : (
                          <CheckSquare size={16} color={colors.primary} />
                        )}
                        <Text style={styles.linkedItemTitle}>{item.title}</Text>
                        {item.priority && (
                          <View style={[
                            styles.linkedItemPriority,
                            { backgroundColor: getPriorityColor(item.priority) }
                          ]}>
                            <Text style={styles.linkedItemPriorityText}>
                              {getPriorityLabel(item.priority)}
                            </Text>
                          </View>
                        )}
                        <View style={[
                          styles.linkedItemStatusBadge,
                          { backgroundColor: item.status === 'done' || item.status === 'resolved' ? '#22c55e20' : '#94a3b820' }
                        ]}>
                          <Text style={[
                            styles.linkedItemStatusText,
                            { color: item.status === 'done' || item.status === 'resolved' ? '#22c55e' : '#64748b' }
                          ]}>
                            {getStatusLabel(item.status)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              
              {/* Actions */}
              <View style={styles.milestoneDetailActions}>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedMilestone(null);
                    setSelectedMilestoneLinkedItems([]);
                    setActiveTab('timeline');
                  }}
                  style={{ flex: 1 }}
                >
                  In Timeline anzeigen
                </Button>
                <Button
                  onClick={() => {
                    setSelectedMilestone(null);
                    setSelectedMilestoneLinkedItems([]);
                  }}
                  style={{ flex: 1 }}
                >
                  Schließen
                </Button>
              </View>
            </View>
          </ModernModal>
        )}

        {/* Edit Milestone Modal */}
        {selectedMilestone && isEditMilestoneMode && (
          <ModernModal
            visible={true}
            onClose={() => {
              setIsEditMilestoneMode(false);
              setSelectedMilestone(null);
              resetForm();
            }}
            title="Meilenstein bearbeiten"
            maxWidth={600}
          >
            <View style={styles.formContent}>
              <Input
                label="Titel *"
                value={title}
                onChangeText={setTitle}
                placeholder="z.B. Rohbau abgeschlossen"
              />

              <Input
                label="Beschreibung"
                value={description}
                onChangeText={setDescription}
                placeholder="Weitere Details..."
                multiline
                numberOfLines={3}
              />

              <DatePicker
                label="Startdatum *"
                value={eventDate}
                onChange={setEventDate}
              />

              <DatePicker
                label="Enddatum (optional)"
                value={endDate}
                onChange={setEndDate}
              />

              <View style={styles.formActions}>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditMilestoneMode(false);
                    resetForm();
                  }}
                  style={{ flex: 1 }}
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={handleUpdateMilestone}
                  disabled={!title.trim() || !eventDate}
                  style={{ flex: 1 }}
                >
                  Speichern
                </Button>
              </View>
            </View>
          </ModernModal>
        )}
      </>
    );
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

        {/* Tab Navigation */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'list' && styles.tabActive]}
            onPress={() => setActiveTab('list')}
          >
            <Flag size={18} color={activeTab === 'list' ? colors.primary : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'list' && styles.tabTextActive]}>
              Liste
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'timeline' && styles.tabActive]}
            onPress={() => setActiveTab('timeline')}
          >
            <Clock size={18} color={activeTab === 'timeline' ? colors.primary : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'timeline' && styles.tabTextActive]}>
              Timeline
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'calendar' && styles.tabActive]}
            onPress={() => setActiveTab('calendar')}
          >
            <Calendar size={18} color={activeTab === 'calendar' ? colors.primary : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'calendar' && styles.tabTextActive]}>
              Kalender
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'list' && renderListView()}
          {activeTab === 'timeline' && renderTimelineView()}
          {activeTab === 'calendar' && renderCalendarView()}
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

                <View style={styles.dropdownMainContent}>
                  {/* Left side - Scrollable list */}
                  <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
                    {/* Tasks Section */}
                    {filteredTasks.length > 0 && (
                      <View style={styles.dropdownSection}>
                        <Text style={styles.dropdownSectionTitle}>Aufgaben</Text>
                        {filteredTasks.map(task => {
                          const isSelected = selectedItems.some(i => i.id === task.id);
                          const isPreviewed = previewItem?.id === task.id;
                          return (
                            <View key={task.id} style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected, isPreviewed && styles.dropdownItemPreviewed]}>
                              <TouchableOpacity
                                style={styles.dropdownItemMain}
                                onPress={() => handleToggleItemSelection(task, 'task')}
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
                              <TouchableOpacity
                                style={styles.infoButton}
                                onPress={() => setPreviewItem(isPreviewed ? null : {
                                  id: task.id,
                                  type: 'task',
                                  title: task.title,
                                  status: task.status,
                                  priority: task.priority,
                                  description: task.description || undefined
                                })}
                              >
                                <Info size={16} color={isPreviewed ? colors.primary : '#94a3b8'} />
                              </TouchableOpacity>
                            </View>
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
                          const isPreviewed = previewItem?.id === defect.id;
                          return (
                            <View key={defect.id} style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected, isPreviewed && styles.dropdownItemPreviewed]}>
                              <TouchableOpacity
                                style={styles.dropdownItemMain}
                                onPress={() => handleToggleItemSelection(defect, 'defect')}
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
                              <TouchableOpacity
                                style={styles.infoButton}
                                onPress={() => setPreviewItem(isPreviewed ? null : {
                                  id: defect.id,
                                  type: 'defect',
                                  title: defect.title,
                                  status: defect.status,
                                  priority: defect.priority,
                                  description: defect.description || undefined
                                })}
                              >
                                <Info size={16} color={isPreviewed ? colors.primary : '#94a3b8'} />
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {filteredTasks.length === 0 && filteredDefects.length === 0 && (
                      <Text style={styles.emptyDropdownText}>Keine Ergebnisse gefunden</Text>
                    )}
                  </ScrollView>

                  {/* Right side - Preview Panel */}
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
                        <TouchableOpacity onPress={() => setPreviewItem(null)}>
                          <X size={16} color="#64748b" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.previewTitle}>{previewItem.title}</Text>
                      {previewItem.priority && (
                        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(previewItem.priority), alignSelf: 'flex-start' }]}>
                          <Text style={styles.priorityBadgeText}>{getPriorityLabel(previewItem.priority)}</Text>
                        </View>
                      )}
                      {previewItem.description && (
                        <ScrollView style={styles.previewDescriptionScroll}>
                          <Text style={styles.previewDescription}>
                            {previewItem.description}
                          </Text>
                        </ScrollView>
                      )}
                      <Text style={styles.previewStatus}>
                        Status: {getStatusLabel(previewItem.status)}
                      </Text>
                    </View>
                  )}
                </View>
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

      {/* Task Detail Modal */}
      {selectedTaskForDetail && (
        <TaskDetailModal
          visible={true}
          task={selectedTaskForDetail}
          taskImages={taskImages}
          taskDocumentation={taskDocumentation}
          projectMembers={projectMembers}
          isEditMode={isEditMode}
          editFormData={editFormData}
          docFormData={docFormData}
          isRecording={isRecording}
          onChangeEditFormData={(field, value) => setEditFormData({ ...editFormData, [field]: value })}
          onToggleEditMode={() => setIsEditMode(!isEditMode)}
          onSaveEdit={async () => {
            // Reload task details after save
            if (selectedTaskForDetail) {
              await handleTaskClick(selectedTaskForDetail);
            }
          }}
          onDelete={async () => {
            setSelectedTaskForDetail(null);
            loadScheduleData();
          }}
          onStatusChange={async (status) => {
            if (selectedTaskForDetail) {
              const { error } = await supabase
                .from('tasks')
                .update({ status })
                .eq('id', selectedTaskForDetail.id);
              
              if (!error) {
                await handleTaskClick(selectedTaskForDetail);
              }
            }
          }}
          onImageUpload={async (event) => {
            // Handle image upload if needed
          }}
          onChangeDocFormData={(field, value) => setDocFormData({ ...docFormData, [field]: value })}
          onSaveDocumentation={async () => {
            // Reload documentation after save
            if (selectedTaskForDetail) {
              await handleTaskClick(selectedTaskForDetail);
            }
          }}
          onCancelDocumentation={() => setDocFormData({})}
          onStartRecording={() => setIsRecording(!isRecording)}
          onClose={() => {
            setSelectedTaskForDetail(null);
            setTaskImages([]);
            setTaskDocumentation([]);
          }}
          getUserName={getUserName}
        />
      )}
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
    maxHeight: 500,
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
  dropdownMainContent: {
    flexDirection: 'row',
    maxHeight: 400,
  },
  dropdownScroll: {
    flex: 1,
    maxHeight: 400,
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
    borderRadius: 8,
    marginBottom: 4,
    overflow: 'hidden',
  },
  dropdownItemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  dropdownItemSelected: {
    backgroundColor: '#F1F5F9',
  },
  dropdownItemPreviewed: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: colors.primary + '40',
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
  infoButton: {
    padding: 8,
    marginRight: 4,
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
    width: 280,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
    gap: 12,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  previewDescriptionScroll: {
    maxHeight: 200,
  },
  previewDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
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
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    backgroundColor: '#F8FAFC',
    padding: 6,
    borderRadius: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: colors.primary,
  },
  // Timeline View
  timelineContainer: {
    paddingVertical: 8,
  },
  emptyStateCard: {
    padding: 60,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
    gap: 12,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  timelineContent: {
    gap: 16,
  },
  timelineItemWrapper: {
    width: '100%',
  },
  timelineCard: {
    width: '100%',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  timelineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 16,
  },
  timelineCardTitleSection: {
    flex: 1,
    gap: 8,
  },
  timelineCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  timelineCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  timelineTypeBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  timelineTypeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  timelineCompletedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  timelineCompletedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22c55e',
  },
  timelineCardDate: {
    alignItems: 'flex-end',
    gap: 2,
  },
  timelineCardDateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  timelineCardDateRange: {
    fontSize: 12,
    color: '#64748b',
  },
  timelineDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 16,
  },
  linkedItemsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  linkedItemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  linkedItemsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  linkedItemsList: {
    gap: 8,
  },
  linkedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  linkedItemTitle: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  linkedItemPriority: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  linkedItemPriorityText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  linkedItemStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  timelineFooter: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  timelineDaysUntil: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  // Calendar View
  calendarCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  calendarHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  calendarMonthTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  todayButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  todayButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  calendarNavigation: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#64748b',
  },
  weekDaysRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
    marginBottom: 8,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: '14.285%', // 100% / 7 days
    minHeight: 100,
    padding: 6,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
    position: 'relative',
    backgroundColor: '#ffffff',
  },
  calendarDayCellWeekend: {
    backgroundColor: '#F8FAFC',
  },
  dayNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  dayNumberToday: {
    backgroundColor: colors.primary,
  },
  dayNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  dayNumberTextToday: {
    color: '#ffffff',
  },
  calendarMilestones: {
    gap: 4,
  },
  calendarMilestoneCard: {
    backgroundColor: '#ffffff',
    borderLeftWidth: 3,
    borderRadius: 6,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  calendarMilestoneTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  calendarMilestoneFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  calendarMilestoneTime: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '500',
  },
  calendarMilestoneProgress: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    backgroundColor: '#F0FDF4',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  calendarMilestoneProgressText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#22c55e',
  },
  legendCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 20,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  legendItems: {
    flexDirection: 'row',
    gap: 20,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  legendText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  milestoneDetailContent: {
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  detailValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  detailSection: {
    gap: 8,
    paddingTop: 8,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  detailDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  milestoneDetailActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  linkedCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: `${colors.primary}15`,
    borderRadius: 12,
  },
  linkedCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    backgroundColor: '#EF444410',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  linkedItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  linkedItemStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  linkedItemStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  formContent: {
    gap: 16,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
});
