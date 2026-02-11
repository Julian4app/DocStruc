import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ToastProvider';
import { FileText, Search, Filter, Download, Image, Video, FileType, MessageSquare } from 'lucide-react';

interface DocumentationItem {
  id: string;
  title: string;
  description?: string;
  type: 'task' | 'defect';
  status: string;
  created_at: string;
  has_photos?: boolean;
  has_videos?: boolean;
  has_notes?: boolean;
  has_comments?: boolean;
}

interface DocStats {
  totalItems: number;
  withPhotos: number;
  withVideos: number;
  withNotes: number;
}

export function ProjectDocumentation() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<DocumentationItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<DocumentationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'task' | 'defect'>('all');
  const [stats, setStats] = useState<DocStats>({
    totalItems: 0,
    withPhotos: 0,
    withVideos: 0,
    withNotes: 0
  });

  useEffect(() => {
    if (id) {
      loadDocumentation();
    }
  }, [id]);

  useEffect(() => {
    filterItems();
  }, [items, searchQuery, typeFilter]);

  const loadDocumentation = async () => {
    if (!id) return;
    setLoading(true);

    try {
      // Load all tasks and defects
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, description, status, created_at, task_type')
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // Transform to documentation items
      const docItems: DocumentationItem[] = (tasksData || []).map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        type: task.task_type === 'defect' ? 'defect' : 'task',
        status: task.status,
        created_at: task.created_at,
        // Mock: In real app, these would come from related tables
        has_photos: Math.random() > 0.5,
        has_videos: Math.random() > 0.7,
        has_notes: Math.random() > 0.6,
        has_comments: Math.random() > 0.5
      }));

      setItems(docItems);

      // Calculate stats
      const newStats: DocStats = {
        totalItems: docItems.length,
        withPhotos: docItems.filter(i => i.has_photos).length,
        withVideos: docItems.filter(i => i.has_videos).length,
        withNotes: docItems.filter(i => i.has_notes).length
      };
      setStats(newStats);
    } catch (error: any) {
      console.error('Error loading documentation:', error);
      showToast('Fehler beim Laden der Dokumentation', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filterItems = () => {
    let filtered = [...items];

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(item => item.type === typeFilter);
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredItems(filtered);
  };

  const handleExport = () => {
    showToast('Export-Funktion folgt in Kürze', 'info');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Dokumentation</Text>
          <Text style={styles.pageSubtitle}>
            Aggregierte Dokumentation aller Aufgaben und Mängel
          </Text>
        </View>
        <Button onClick={handleExport}>
          <Download size={18} /> Export
        </Button>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <FileText size={24} color="#3B82F6" />
          <Text style={styles.statValue}>{stats.totalItems}</Text>
          <Text style={styles.statLabel}>Einträge</Text>
        </Card>
        <Card style={styles.statCard}>
          <Image size={24} color="#10B981" />
          <Text style={styles.statValue}>{stats.withPhotos}</Text>
          <Text style={styles.statLabel}>Mit Fotos</Text>
        </Card>
        <Card style={styles.statCard}>
          <Video size={24} color="#8B5CF6" />
          <Text style={styles.statValue}>{stats.withVideos}</Text>
          <Text style={styles.statLabel}>Mit Videos</Text>
        </Card>
        <Card style={styles.statCard}>
          <MessageSquare size={24} color="#F59E0B" />
          <Text style={styles.statValue}>{stats.withNotes}</Text>
          <Text style={styles.statLabel}>Mit Notizen</Text>
        </Card>
      </View>

      {/* Filters */}
      <Card style={styles.filterCard}>
        <View style={styles.searchContainer}>
          <Search size={18} color="#94a3b8" />
          <Input
            placeholder="Dokumentation durchsuchen..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>
        <View style={styles.typeFilters}>
          {['all', 'task', 'defect'].map(type => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterChip,
                typeFilter === type && styles.filterChipActive
              ]}
              onPress={() => setTypeFilter(type as any)}
            >
              <Text style={[
                styles.filterChipText,
                typeFilter === type && styles.filterChipTextActive
              ]}>
                {type === 'all' ? 'Alle' :
                 type === 'task' ? 'Aufgaben' : 'Mängel'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Documentation List */}
      <ScrollView style={styles.docList} showsVerticalScrollIndicator={false}>
        {filteredItems.length === 0 ? (
          <Card style={styles.emptyCard}>
            <FileText size={48} color="#94a3b8" />
            <Text style={styles.emptyText}>
              {searchQuery || typeFilter !== 'all'
                ? 'Keine Einträge gefunden'
                : 'Noch keine Dokumentation vorhanden'}
            </Text>
          </Card>
        ) : (
          filteredItems.map(item => (
            <Card key={item.id} style={styles.docCard}>
              <View style={styles.docHeader}>
                <View style={styles.docTitleRow}>
                  <View style={[
                    styles.typeBadge,
                    { backgroundColor: item.type === 'defect' ? '#FEE2E2' : '#EFF6FF' }
                  ]}>
                    <Text style={[
                      styles.typeBadgeText,
                      { color: item.type === 'defect' ? '#DC2626' : '#3B82F6' }
                    ]}>
                      {item.type === 'defect' ? 'Mangel' : 'Aufgabe'}
                    </Text>
                  </View>
                  <Text style={styles.docTitle}>{item.title}</Text>
                </View>
              </View>
              
              {item.description && (
                <Text style={styles.docDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}

              <View style={styles.docFooter}>
                <View style={styles.docMetaIcons}>
                  {item.has_photos && (
                    <View style={styles.metaIcon}>
                      <Image size={14} color="#10B981" />
                    </View>
                  )}
                  {item.has_videos && (
                    <View style={styles.metaIcon}>
                      <Video size={14} color="#8B5CF6" />
                    </View>
                  )}
                  {item.has_notes && (
                    <View style={styles.metaIcon}>
                      <FileType size={14} color="#F59E0B" />
                    </View>
                  )}
                  {item.has_comments && (
                    <View style={styles.metaIcon}>
                      <MessageSquare size={14} color="#3B82F6" />
                    </View>
                  )}
                </View>
                <Text style={styles.docDate}>{formatDate(item.created_at)}</Text>
              </View>
            </Card>
          ))
        )}
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
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  filterCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 20,
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
  typeFilters: {
    flexDirection: 'row',
    gap: 8,
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
  docList: {
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
  },
  docCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 12,
  },
  docHeader: {
    marginBottom: 12,
  },
  docTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  docTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  docDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 12,
  },
  docFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  docMetaIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  metaIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
});
