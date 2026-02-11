import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ToastProvider';
import { Activity, CheckCircle, Plus, Edit, Trash2, AlertCircle, FileText, Users } from 'lucide-react';

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  created_at: string;
  metadata?: any;
  user?: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

export function ProjectActivity() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (id) {
      loadActivities();
    }
  }, [id]);

  const loadActivities = async () => {
    if (!id) return;
    setLoading(true);

    try {
      // Simulated activity log - in real app this would come from an activity_logs table
      const { data: tasks } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          status,
          created_at,
          updated_at,
          creator_id,
          profiles:creator_id(email, first_name, last_name)
        `)
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(50);

      // Convert tasks to activity logs
      const logs: ActivityLog[] = [];
      if (tasks) {
        tasks.forEach(task => {
          logs.push({
            id: `task-create-${task.id}`,
            action: 'created',
            entity_type: 'task',
            entity_id: task.id,
            user_id: task.creator_id || '',
            created_at: task.created_at,
            metadata: { title: task.title, status: task.status },
            user: task.profiles as any
          });
        });
      }

      logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivities(logs);
    } catch (error: any) {
      console.error('Error loading activities:', error);
      showToast('Fehler beim Laden der Aktivitäten', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (action: string, entityType: string) => {
    if (action === 'created' && entityType === 'task') return <Plus size={16} color="#10B981" />;
    if (action === 'updated') return <Edit size={16} color="#3B82F6" />;
    if (action === 'deleted') return <Trash2 size={16} color="#EF4444" />;
    if (action === 'completed') return <CheckCircle size={16} color="#22c55e" />;
    if (entityType === 'defect') return <AlertCircle size={16} color="#F59E0B" />;
    if (entityType === 'document') return <FileText size={16} color="#8B5CF6" />;
    if (entityType === 'member') return <Users size={16} color="#3B82F6" />;
    return <Activity size={16} color="#94a3b8" />;
  };

  const getActivityText = (activity: ActivityLog) => {
    const userName = activity.user?.first_name && activity.user?.last_name
      ? `${activity.user.first_name} ${activity.user.last_name}`
      : activity.user?.email || 'Jemand';

    const entityName = activity.metadata?.title || activity.entity_type;

    switch (activity.action) {
      case 'created':
        return `${userName} hat ${activity.entity_type === 'task' ? 'Aufgabe' : 'Element'} "${entityName}" erstellt`;
      case 'updated':
        return `${userName} hat ${activity.entity_type === 'task' ? 'Aufgabe' : 'Element'} "${entityName}" aktualisiert`;
      case 'deleted':
        return `${userName} hat ${activity.entity_type === 'task' ? 'Aufgabe' : 'Element'} "${entityName}" gelöscht`;
      case 'completed':
        return `${userName} hat ${activity.entity_type === 'task' ? 'Aufgabe' : 'Element'} "${entityName}" abgeschlossen`;
      default:
        return `${userName} hat eine Aktion ausgeführt`;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffInMinutes < 1) return 'Gerade eben';
    if (diffInMinutes < 60) return `vor ${diffInMinutes} Min.`;
    if (diffInMinutes < 1440) return `vor ${Math.floor(diffInMinutes / 60)} Std.`;
    if (diffInMinutes < 10080) return `vor ${Math.floor(diffInMinutes / 1440)} Tag(en)`;
    
    return date.toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredActivities = filter === 'all' 
    ? activities 
    : activities.filter(a => a.entity_type === filter);

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
          <Text style={styles.pageTitle}>Aktivitäten</Text>
          <Text style={styles.pageSubtitle}>
            Chronologisches Protokoll aller Projektaktivitäten
          </Text>
        </View>
      </View>

      {/* Filter */}
      <View style={styles.filterBar}>
        {['all', 'task', 'defect', 'document', 'member'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'Alle' : 
               f === 'task' ? 'Aufgaben' :
               f === 'defect' ? 'Mängel' :
               f === 'document' ? 'Dokumente' :
               'Mitglieder'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Activity Timeline */}
      <ScrollView style={styles.timeline} showsVerticalScrollIndicator={false}>
        {filteredActivities.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Activity size={48} color="#94a3b8" />
            <Text style={styles.emptyText}>Noch keine Aktivitäten</Text>
          </Card>
        ) : (
          filteredActivities.map((activity, index) => (
            <View key={activity.id} style={styles.activityItem}>
              <View style={styles.timelineLine}>
                {index !== filteredActivities.length - 1 && (
                  <View style={styles.lineConnector} />
                )}
              </View>
              <View style={styles.activityIconContainer}>
                {getActivityIcon(activity.action, activity.entity_type)}
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>
                  {getActivityText(activity)}
                </Text>
                <Text style={styles.activityTime}>
                  {formatDate(activity.created_at)}
                </Text>
              </View>
            </View>
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
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
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
  timeline: {
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
  activityItem: {
    flexDirection: 'row',
    marginBottom: 20,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 20,
    top: 32,
    bottom: -20,
    width: 2,
  },
  lineConnector: {
    width: 2,
    height: '100%',
    backgroundColor: '#E2E8F0',
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    zIndex: 1,
  },
  activityContent: {
    flex: 1,
    paddingTop: 8,
  },
  activityText: {
    fontSize: 15,
    color: '#0f172a',
    lineHeight: 22,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 13,
    color: '#94a3b8',
  },
});
