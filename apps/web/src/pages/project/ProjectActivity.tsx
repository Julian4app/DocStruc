import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ToastProvider';
import { 
  Activity, CheckCircle, Plus, Edit, Trash2, AlertCircle, FileText, 
  Users, MessageSquare, Calendar, Archive, Upload, UserPlus, UserMinus,
  Clock, CheckSquare, XCircle, RefreshCw, Flag
} from 'lucide-react';

interface ActivityLog {
  id: string;
  project_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  entity_title?: string;
  old_values?: any;
  new_values?: any;
  metadata?: any;
  created_at: string;
  profiles?: {
    email: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
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
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel(`activity-logs-${id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'activity_logs',
            filter: `project_id=eq.${id}`
          },
          () => {
            loadActivities();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id]);

  const loadActivities = async () => {
    if (!id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          id, project_id, user_id, action, entity_type, entity_id, details, created_at,
          profiles!activity_logs_user_id_fkey(email, first_name, last_name, avatar_url)
        `)
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      setActivities(data || []);
    } catch (error: any) {
      console.error('Error loading activities:', error);
      showToast('Fehler beim Laden der Aktivitäten', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (action: string, entityType: string) => {
    // Action-based icons
    if (action === 'created') return <Plus size={16} color="#10B981" />;
    if (action === 'updated') return <Edit size={16} color="#3B82F6" />;
    if (action === 'deleted') return <Trash2 size={16} color="#EF4444" />;
    if (action === 'completed') return <CheckCircle size={16} color="#22c55e" />;
    if (action === 'assigned') return <UserPlus size={16} color="#8B5CF6" />;
    if (action === 'unassigned') return <UserMinus size={16} color="#94a3b8" />;
    if (action === 'archived') return <Archive size={16} color="#F59E0B" />;
    if (action === 'restored') return <RefreshCw size={16} color="#10B981" />;
    if (action === 'uploaded') return <Upload size={16} color="#3B82F6" />;
    if (action === 'commented') return <MessageSquare size={16} color="#8B5CF6" />;
    if (action === 'status_changed') return <Flag size={16} color="#F59E0B" />;
    
    // Entity-based icons
    if (entityType === 'task') return <CheckSquare size={16} color="#3B82F6" />;
    if (entityType === 'defect') return <AlertCircle size={16} color="#F59E0B" />;
    if (entityType === 'document' || entityType === 'file') return <FileText size={16} color="#8B5CF6" />;
    if (entityType === 'member') return <Users size={16} color="#3B82F6" />;
    if (entityType === 'message' || entityType === 'note') return <MessageSquare size={16} color="#10B981" />;
    if (entityType === 'diary_entry') return <Calendar size={16} color="#F59E0B" />;
    if (entityType === 'time_entry') return <Clock size={16} color="#3B82F6" />;
    
    return <Activity size={16} color="#94a3b8" />;
  };

  const getActivityText = (activity: ActivityLog) => {
    const userName = activity.profiles?.first_name && activity.profiles?.last_name
      ? `${activity.profiles.first_name} ${activity.profiles.last_name}`
      : activity.profiles?.email || 'Jemand';

    const entityName = activity.entity_title || 'Element';
    
    // Entity type translations
    const entityTypeMap: { [key: string]: string } = {
      task: 'Aufgabe',
      defect: 'Mangel',
      document: 'Dokument',
      file: 'Datei',
      member: 'Mitglied',
      message: 'Nachricht',
      note: 'Notiz',
      diary_entry: 'Tagebucheintrag',
      time_entry: 'Zeiteintrag',
      milestone: 'Meilenstein',
      project: 'Projekt'
    };

    const entityTypeLabel = entityTypeMap[activity.entity_type] || activity.entity_type;

    // Action translations with context
    switch (activity.action) {
      case 'created':
        return `${userName} hat ${entityTypeLabel} "${entityName}" erstellt`;
      case 'updated':
        if (activity.metadata?.fields) {
          const fields = activity.metadata.fields.join(', ');
          return `${userName} hat ${entityTypeLabel} "${entityName}" aktualisiert (${fields})`;
        }
        return `${userName} hat ${entityTypeLabel} "${entityName}" aktualisiert`;
      case 'deleted':
        return `${userName} hat ${entityTypeLabel} "${entityName}" gelöscht`;
      case 'completed':
        return `${userName} hat ${entityTypeLabel} "${entityName}" abgeschlossen`;
      case 'assigned':
        const assignedTo = activity.metadata?.assigned_to_name || 'jemandem';
        return `${userName} hat ${entityTypeLabel} "${entityName}" ${assignedTo} zugewiesen`;
      case 'unassigned':
        return `${userName} hat die Zuweisung von ${entityTypeLabel} "${entityName}" entfernt`;
      case 'archived':
        return `${userName} hat ${entityTypeLabel} "${entityName}" archiviert`;
      case 'restored':
        return `${userName} hat ${entityTypeLabel} "${entityName}" wiederhergestellt`;
      case 'uploaded':
        return `${userName} hat Datei "${entityName}" hochgeladen`;
      case 'commented':
        return `${userName} hat einen Kommentar zu ${entityTypeLabel} "${entityName}" hinzugefügt`;
      case 'status_changed':
        const oldStatus = activity.old_values?.status || 'unbekannt';
        const newStatus = activity.new_values?.status || 'unbekannt';
        const statusMap: { [key: string]: string } = {
          'todo': 'Offen',
          'in-progress': 'In Bearbeitung',
          'done': 'Erledigt',
          'blocked': 'Blockiert'
        };
        return `${userName} hat den Status von "${entityName}" von ${statusMap[oldStatus] || oldStatus} auf ${statusMap[newStatus] || newStatus} geändert`;
      case 'priority_changed':
        const oldPriority = activity.old_values?.priority || 'unbekannt';
        const newPriority = activity.new_values?.priority || 'unbekannt';
        const priorityMap: { [key: string]: string } = {
          'low': 'Niedrig',
          'medium': 'Mittel',
          'high': 'Hoch'
        };
        return `${userName} hat die Priorität von "${entityName}" von ${priorityMap[oldPriority] || oldPriority} auf ${priorityMap[newPriority] || newPriority} geändert`;
      default:
        return `${userName} hat eine Aktion für ${entityTypeLabel} "${entityName}" ausgeführt`;
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
        {['all', 'task', 'defect', 'document', 'member', 'message', 'diary_entry', 'file'].map(f => (
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
               f === 'member' ? 'Mitglieder' :
               f === 'message' ? 'Nachrichten' :
               f === 'diary_entry' ? 'Tagebuch' :
               'Dateien'}
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
