import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { colors, spacing } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { ModernModal } from '../../components/ModernModal';
import { useToast } from '../../components/ToastProvider';
import { Plus, Search, Filter, CheckCircle, Clock, XCircle } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'done' | 'blocked';
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
}

export function ProjectTasks() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadTasks();
  }, [id]);

  useEffect(() => {
    filterTasks();
  }, [tasks, searchQuery, statusFilter]);

  const loadTasks = async () => {
    if (!id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      console.error('Error loading tasks:', error);
      showToast('Fehler beim Laden der Aufgaben', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filterTasks = () => {
    let filtered = [...tasks];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    setFilteredTasks(filtered);
  };

  const handleCreateTask = async () => {
    if (!title.trim()) {
      showToast('Bitte geben Sie einen Titel ein', 'error');
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('tasks').insert({
        project_id: id,
        title: title.trim(),
        description: description.trim(),
        status: 'open',
        creator_id: userData.user?.id
      });

      if (error) throw error;

      showToast('Aufgabe erfolgreich erstellt', 'success');
      setIsCreateModalOpen(false);
      setTitle('');
      setDescription('');
      loadTasks();
    } catch (error: any) {
      console.error('Error creating task:', error);
      showToast('Fehler beim Erstellen der Aufgabe', 'error');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle size={20} color="#22c55e" />;
      case 'in_progress':
        return <Clock size={20} color="#F59E0B" />;
      case 'blocked':
        return <XCircle size={20} color="#EF4444" />;
      default:
        return <Clock size={20} color="#94a3b8" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Offen';
      case 'in_progress': return 'In Bearbeitung';
      case 'done': return 'Abgeschlossen';
      case 'blocked': return 'Blockiert';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return '#dcfce7';
      case 'in_progress': return '#FEF3C7';
      case 'blocked': return '#FEE2E2';
      default: return '#F1F5F9';
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
            <Text style={styles.pageTitle}>Aufgaben</Text>
            <Text style={styles.pageSubtitle}>
              Zentraler Arbeits- und Dokumentationsbereich
            </Text>
          </View>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={18} /> Neue Aufgabe
          </Button>
        </View>

        {/* Filters */}
        <View style={styles.filterBar}>
          <View style={styles.searchContainer}>
            <Search size={18} color="#94a3b8" />
            <Input
              placeholder="Aufgaben durchsuchen..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
          </View>

          <View style={styles.statusFilters}>
            {['all', 'open', 'in_progress', 'done', 'blocked'].map(status => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterChip,
                  statusFilter === status && styles.filterChipActive
                ]}
                onPress={() => setStatusFilter(status)}
              >
                <Text style={[
                  styles.filterChipText,
                  statusFilter === status && styles.filterChipTextActive
                ]}>
                  {status === 'all' ? 'Alle' : getStatusLabel(status)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tasks List */}
        <ScrollView style={styles.tasksList} showsVerticalScrollIndicator={false}>
          {filteredTasks.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {searchQuery || statusFilter !== 'all'
                  ? 'Keine Aufgaben gefunden'
                  : 'Noch keine Aufgaben erstellt'}
              </Text>
              {!searchQuery && statusFilter === 'all' && (
                <Button onClick={() => setIsCreateModalOpen(true)} style={{ marginTop: 16 }}>
                  Erste Aufgabe erstellen
                </Button>
              )}
            </Card>
          ) : (
            filteredTasks.map(task => (
              <TouchableOpacity
                key={task.id}
                style={styles.taskCard}
                onPress={() => setSelectedTask(task)}
              >
                <View style={styles.taskHeader}>
                  <View style={styles.taskTitleRow}>
                    {getStatusIcon(task.status)}
                    <Text style={styles.taskTitle}>{task.title}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) }]}>
                    <Text style={styles.statusBadgeText}>{getStatusLabel(task.status)}</Text>
                  </View>
                </View>
                {task.description && (
                  <Text style={styles.taskDescription} numberOfLines={2}>
                    {task.description}
                  </Text>
                )}
                <View style={styles.taskFooter}>
                  <Text style={styles.taskDate}>
                    Erstellt: {new Date(task.created_at).toLocaleDateString('de-DE')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      {/* Create Task Modal */}
      <ModernModal
        visible={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setTitle('');
          setDescription('');
        }}
        title="Neue Aufgabe erstellen"
      >
        <View style={styles.modalContent}>
          <Input
            label="Titel *"
            value={title}
            onChangeText={setTitle}
            placeholder="z.B. Fundament prüfen"
          />
          <Input
            label="Beschreibung"
            value={description}
            onChangeText={setDescription}
            placeholder="Details zur Aufgabe..."
            multiline
            numberOfLines={4}
          />
          <View style={styles.modalActions}>
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
              style={{ flex: 1 }}
            >
              Abbrechen
            </Button>
            <Button onClick={handleCreateTask} style={{ flex: 1 }}>
              Erstellen
            </Button>
          </View>
        </View>
      </ModernModal>

      {/* Task Detail Modal */}
      {selectedTask && (
        <ModernModal
          visible={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          title={selectedTask.title}
        >
          <View style={styles.modalContent}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedTask.status), alignSelf: 'flex-start' }]}>
              <Text style={styles.statusBadgeText}>{getStatusLabel(selectedTask.status)}</Text>
            </View>
            
            {selectedTask.description && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Beschreibung</Text>
                <Text style={styles.detailText}>{selectedTask.description}</Text>
              </View>
            )}

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Erstellt am</Text>
              <Text style={styles.detailText}>
                {new Date(selectedTask.created_at).toLocaleString('de-DE')}
              </Text>
            </View>

            <Text style={styles.infoBox}>
              📝 Vollständige Aufgabenbearbeitung mit Fotos, Videos, Spracheingaben, Zeiterfassung und Dokumentation folgt in der nächsten Version.
            </Text>
          </View>
        </ModernModal>
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
  filterBar: {
    marginBottom: 24,
    gap: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
    padding: 0,
  },
  statusFilters: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  tasksList: {
    flex: 1,
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  taskCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  taskDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 20,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  modalContent: {
    gap: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  detailSection: {
    marginTop: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detailText: {
    fontSize: 15,
    color: '#0f172a',
    lineHeight: 22,
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
    marginTop: 16,
  },
});
