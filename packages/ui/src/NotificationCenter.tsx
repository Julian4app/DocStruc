import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Bell, X, Check, ExternalLink } from 'lucide-react-native';

interface Notification {
  id: string;
  type: 'project_invitation' | 'task_assigned' | 'mention' | 'system';
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
}

interface NotificationCenterProps {
  notifications: Notification[];
  loading: boolean;
  onClose?: () => void;
  onMarkAsRead: (notificationId: string) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
  onDelete: (notificationId: string) => Promise<void>;
  onAcceptInvitation: (notification: Notification) => Promise<void>;
  onNotificationClick: (notification: Notification) => Promise<void>;
  acceptingId?: string | null;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  loading,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onAcceptInvitation,
  onNotificationClick,
  acceptingId
}) => {

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

  const unreadCount = notifications.filter(n => !n.is_read).length;

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
                !notification.is_read && styles.unreadCard
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
                      onPress={() => onAcceptInvitation(notification)}
                      style={styles.acceptButton}
                      disabled={acceptingId === notification.id}
                    >
                      {acceptingId === notification.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Check size={16} color="#fff" />
                          <Text style={styles.acceptButtonText}>Akzeptieren</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onDelete(notification.id)}
                      style={styles.declineButton}
                      disabled={acceptingId === notification.id}
                    >
                      <X size={16} color="#DC2626" />
                      <Text style={styles.declineButtonText}>Ablehnen</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>

              {notification.type !== 'project_invitation' && (
                <TouchableOpacity
                  onPress={() => onDelete(notification.id)}
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
