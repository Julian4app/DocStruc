import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { colors, spacing } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { ModernModal } from '../../components/ModernModal';
import { useToast } from '../../components/ToastProvider';
import { Plus, AlertCircle, Calendar } from 'lucide-react';

interface Defect {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'rejected';
  due_date: string | null;
  created_at: string;
}

export function ProjectDefects() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');

  useEffect(() => {
    loadDefects();
  }, [id]);

  const loadDefects = async () => {
    if (!id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', id)
        .eq('task_type', 'defect')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDefects(data || []);
    } catch (error: any) {
      console.error('Error loading defects:', error);
      showToast('Fehler beim Laden der Mängel', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDefect = async () => {
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
        task_type: 'defect',
        priority,
        status: 'open',
        creator_id: userData.user?.id
      });

      if (error) throw error;

      showToast('Mangel erfolgreich erstellt', 'success');
      setIsCreateModalOpen(false);
      setTitle('');
      setDescription('');
      setPriority('medium');
      loadDefects();
    } catch (error: any) {
      console.error('Error creating defect:', error);
      showToast('Fehler beim Erstellen des Mangels', 'error');
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'low': return 'Niedrig';
      case 'medium': return 'Mittel';
      case 'high': return 'Hoch';
      case 'critical': return 'Kritisch';
      default: return priority;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#DC2626';
      case 'high': return '#F59E0B';
      case 'medium': return '#3B82F6';
      case 'low': return '#10B981';
      default: return '#94a3b8';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Offen';
      case 'in_progress': return 'In Bearbeitung';
      case 'resolved': return 'Behoben';
      case 'rejected': return 'Abgelehnt';
      default: return status;
    }
  };

  const filteredDefects = priorityFilter === 'all'
    ? defects
    : defects.filter(d => d.priority === priorityFilter);

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
            <Text style={styles.pageTitle}>Mängel</Text>
            <Text style={styles.pageSubtitle}>
              Mängelverwaltung mit Prioritäten und Fristen
            </Text>
          </View>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={18} /> Mangel erfassen
          </Button>
        </View>

        {/* Priority Filter */}
        <View style={styles.filterBar}>
          {['all', 'critical', 'high', 'medium', 'low'].map(p => (
            <TouchableOpacity
              key={p}
              style={[
                styles.filterChip,
                priorityFilter === p && styles.filterChipActive
              ]}
              onPress={() => setPriorityFilter(p)}
            >
              <Text style={[
                styles.filterChipText,
                priorityFilter === p && styles.filterChipTextActive
              ]}>
                {p === 'all' ? 'Alle' : getPriorityLabel(p)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{defects.filter(d => d.status === 'open').length}</Text>
            <Text style={styles.statLabel}>Offen</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{defects.filter(d => d.priority === 'critical').length}</Text>
            <Text style={[styles.statLabel, { color: '#DC2626' }]}>Kritisch</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{defects.filter(d => d.status === 'resolved').length}</Text>
            <Text style={[styles.statLabel, { color: '#10B981' }]}>Behoben</Text>
          </View>
        </View>

        {/* Defects List */}
        <ScrollView style={styles.defectsList} showsVerticalScrollIndicator={false}>
          {filteredDefects.length === 0 ? (
            <Card style={styles.emptyCard}>
              <AlertCircle size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>
                {priorityFilter !== 'all'
                  ? 'Keine Mängel mit dieser Priorität'
                  : 'Noch keine Mängel erfasst'}
              </Text>
              {priorityFilter === 'all' && (
                <Button onClick={() => setIsCreateModalOpen(true)} style={{ marginTop: 16 }}>
                  Ersten Mangel erfassen
                </Button>
              )}
            </Card>
          ) : (
            filteredDefects.map(defect => (
              <TouchableOpacity
                key={defect.id}
                style={[
                  styles.defectCard,
                  { borderLeftColor: getPriorityColor(defect.priority), borderLeftWidth: 4 }
                ]}
                onPress={() => setSelectedDefect(defect)}
              >
                <View style={styles.defectHeader}>
                  <View style={styles.defectTitleRow}>
                    <AlertCircle size={20} color={getPriorityColor(defect.priority)} />
                    <Text style={styles.defectTitle}>{defect.title}</Text>
                  </View>
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(defect.priority) }]}>
                    <Text style={styles.priorityBadgeText}>{getPriorityLabel(defect.priority)}</Text>
                  </View>
                </View>
                {defect.description && (
                  <Text style={styles.defectDescription} numberOfLines={2}>
                    {defect.description}
                  </Text>
                )}
                <View style={styles.defectFooter}>
                  <Text style={styles.defectStatus}>{getStatusLabel(defect.status)}</Text>
                  <Text style={styles.defectDate}>
                    {new Date(defect.created_at).toLocaleDateString('de-DE')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      {/* Create Defect Modal */}
      <ModernModal
        visible={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setTitle('');
          setDescription('');
          setPriority('medium');
        }}
        title="Mangel erfassen"
      >
        <View style={styles.modalContent}>
          <Input
            label="Titel *"
            value={title}
            onChangeText={setTitle}
            placeholder="z.B. Riss in Wand"
          />
          <Input
            label="Beschreibung"
            value={description}
            onChangeText={setDescription}
            placeholder="Details zum Mangel..."
            multiline
            numberOfLines={4}
          />
          
          <View>
            <Text style={styles.inputLabel}>Priorität</Text>
            <View style={styles.priorityGrid}>
              {(['low', 'medium', 'high', 'critical'] as const).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityOption,
                    priority === p && { 
                      backgroundColor: getPriorityColor(p),
                      borderColor: getPriorityColor(p)
                    }
                  ]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={[
                    styles.priorityOptionText,
                    priority === p && { color: '#ffffff' }
                  ]}>
                    {getPriorityLabel(p)}
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
            <Button onClick={handleCreateDefect} style={{ flex: 1 }}>
              Erfassen
            </Button>
          </View>
        </View>
      </ModernModal>

      {/* Defect Detail Modal */}
      {selectedDefect && (
        <ModernModal
          visible={!!selectedDefect}
          onClose={() => setSelectedDefect(null)}
          title={selectedDefect.title}
        >
          <View style={styles.modalContent}>
            <View style={[styles.priorityBadge, { 
              backgroundColor: getPriorityColor(selectedDefect.priority),
              alignSelf: 'flex-start'
            }]}>
              <Text style={styles.priorityBadgeText}>
                {getPriorityLabel(selectedDefect.priority)}
              </Text>
            </View>
            
            {selectedDefect.description && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Beschreibung</Text>
                <Text style={styles.detailText}>{selectedDefect.description}</Text>
              </View>
            )}

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Status</Text>
              <Text style={styles.detailText}>{getStatusLabel(selectedDefect.status)}</Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Erfasst am</Text>
              <Text style={styles.detailText}>
                {new Date(selectedDefect.created_at).toLocaleString('de-DE')}
              </Text>
            </View>

            <Text style={styles.infoBox}>
              📸 Mängelbearbeitung mit Fotos, Zuweisung, Fristen, Abnahme und revisionssicherer Historie folgt in der nächsten Version.
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
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  defectsList: {
    flex: 1,
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  defectCard: {
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
  defectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  defectTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  defectTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  defectDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 20,
  },
  defectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  defectStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  defectDate: {
    fontSize: 12,
    color: '#94a3b8',
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
  priorityGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  priorityOption: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  priorityOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
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
