import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Bell, X, Check, ExternalLink } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  type: 'project_invitation' | 'task_assigned' | 'mention' | 'system';
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at: string;
}

interface NotificationCenterProps {
  onClose?: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
    
    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${supabase.auth.getUser().then(({ data }) => data.user?.id)}`
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error: any) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId
      });

      if (error) throw error;
      
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase.rpc('mark_all_notifications_read');
      if (error) throw error;
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error: any) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error: any) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleAcceptInvitation = async (notification: Notification) => {
    setAccepting(notification.id);
    try {
      const { data, error } = await supabase.rpc('accept_project_invitation', {
        p_invitation_token: notification.data.invitation_token
      });

      if (error) throw error;

      if (data?.success) {
        // Remove notification
        await deleteNotification(notification.id);
        
        // Navigate to project
        if (onClose) onClose();
        navigate(`/projects/${data.project_id}`);
        
        // Reload notifications
        loadNotifications();
      } else {
        alert(data?.error || 'Fehler beim Akzeptieren der Einladung');
      }
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      alert('Fehler beim Akzeptieren der Einladung');
    } finally {
      setAccepting(null);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Handle different notification types
    if (notification.type === 'project_invitation') {
      // Don't navigate, let user click accept button
      return;
    } else if (notification.data?.project_id) {
      if (onClose) onClose();
      navigate(`/projects/${notification.data.project_id}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `vor ${diffMins} Min.`;
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    if (diffDays < 7) return `vor ${diffDays} Tag${diffDays !== 1 ? 'en' : ''}`;
    
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Benachrichtigungen</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Bell size={20} color="#1F2937" />
          <Text style={styles.headerTitle}>Benachrichtigungen</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
              <Check size={16} color="#3B82F6" />
              <Text style={styles.markAllText}>Alle lesen</Text>
            </TouchableOpacity>
          )}
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>Keine Benachrichtigungen</Text>
          </View>
        ) : (
          notifications.map((notification) => (
            <View
              key={notification.id}
              style={[
                styles.notificationCard,
                !notification.read && styles.unreadCard
              ]}
            >
              <TouchableOpacity
                onPress={() => handleNotificationClick(notification)}
                style={styles.notificationContent}
              >
                <View style={styles.notificationHeader}>
                  <Text style={styles.notificationTitle}>{notification.title}</Text>
                  <Text style={styles.notificationTime}>{formatDate(notification.created_at)}</Text>
                </View>
                <Text style={styles.notificationMessage}>{notification.message}</Text>

                {notification.type === 'project_invitation' && (
                  <View style={styles.invitationActions}>
                    <TouchableOpacity
                      onPress={() => handleAcceptInvitation(notification)}
                      style={styles.acceptButton}
                      disabled={accepting === notification.id}
                    >
                      {accepting === notification.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Check size={16} color="#fff" />
                          <Text style={styles.acceptButtonText}>Akzeptieren</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteNotification(notification.id)}
                      style={styles.declineButton}
                      disabled={accepting === notification.id}
                    >
                      <X size={16} color="#DC2626" />
                      <Text style={styles.declineButtonText}>Ablehnen</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>

              {notification.type !== 'project_invitation' && (
                <TouchableOpacity
                  onPress={() => deleteNotification(notification.id)}
                  style={styles.deleteButton}
                >
                  <X size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  badge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  markAllText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9CA3AF',
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#fff',
  },
  unreadCard: {
    backgroundColor: '#F0F9FF',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  notificationTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 120,
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  declineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  declineButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
});
