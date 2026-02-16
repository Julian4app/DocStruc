import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationCenter } from '@docstruc/ui';
import { supabase } from '../lib/supabase';

interface NotificationDB {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
}

interface Notification {
  id: string;
  type: 'project_invitation' | 'task_assigned' | 'mention' | 'system';
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
}

interface NotificationCenterWrapperProps {
  onClose?: () => void;
}

export const NotificationCenterWrapper: React.FC<NotificationCenterWrapperProps> = ({ onClose }) => {
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
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Loading notifications for user:', user?.id);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      console.log('Notifications loaded:', data);
      if (error) {
        console.error('Error loading notifications:', error);
        throw error;
      }
      // Map DB column notification_type to frontend field type
      const mapped: Notification[] = (data || []).map((n: any) => ({
        id: n.id,
        type: n.notification_type || 'system',
        title: n.title || '',
        message: n.message || '',
        data: n.data || {},
        is_read: n.is_read ?? false,
        created_at: n.created_at,
      }));
      setNotifications(mapped);
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
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase.rpc('mark_all_notifications_read');
      if (error) throw error;
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
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
        navigate(`/project/${data.project_id}`);
        
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
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Handle different notification types
    if (notification.type === 'project_invitation') {
      // Don't navigate, let user click accept button
      return;
    } else if (notification.data?.project_id) {
      if (onClose) onClose();
      navigate(`/project/${notification.data.project_id}`);
    }
  };

  return (
    <NotificationCenter
      notifications={notifications}
      loading={loading}
      onClose={onClose}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
      onDelete={deleteNotification}
      onAcceptInvitation={handleAcceptInvitation}
      onNotificationClick={handleNotificationClick}
      acceptingId={accepting}
    />
  );
};
