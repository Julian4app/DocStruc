import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Task, TaskStatus } from '@docstruc/logic';
import { colors, spacing } from '@docstruc/theme';

interface TaskItemProps {
  task: Task;
  onStatusChange?: (newStatus: TaskStatus) => void;
  onPress?: () => void;
}

export function TaskItem({ task, onStatusChange, onPress }: TaskItemProps) {
  const statusColor = task.status === 'done' ? colors.success : 
                     task.status === 'in_progress' ? colors.warning : colors.primary;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.container}>
      <View style={[styles.statusStrip, { backgroundColor: statusColor }]} />
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{task.title}</Text>
          {task.images && task.images.length > 0 && (
             <Text style={styles.attachmentIcon}>📷</Text>
          )}
        </View>
        
        {task.description ? (
          <Text style={styles.description} numberOfLines={2}>{task.description}</Text>
        ) : null}
        
        <View style={styles.footer}>
           <View style={styles.metaRow}>
             <Text style={[styles.statusText, { color: statusColor }]}>{task.status.toUpperCase()}</Text>
             {task.due_date && (
               <Text style={styles.dueDate}>📅 {new Date(task.due_date).toLocaleDateString()}</Text>
             )}
           </View>
        </View>
      </View>
      
      {task.images && task.images.length > 0 && (
        <Image source={{ uri: task.images[0] }} style={styles.thumbnail} />
      )}
      
      {onStatusChange && (
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onStatusChange(task.status === 'done' ? 'open' : 'done')}
        >
          <Text style={styles.actionIcon}>{task.status === 'done' ? '↩' : '✓'}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    flexDirection: 'row',
    marginBottom: spacing.s,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 80,
  },
  statusStrip: {
    width: 6,
    height: '100%',
  },
  content: {
    flex: 1,
    padding: spacing.s,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  attachmentIcon: {
    fontSize: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  footer: {
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  dueDate: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '500',
  },
  date: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  actionButton: {
    padding: spacing.m,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    width: 50,
  },
  actionIcon: {
    fontSize: 20,
    color: colors.primary,
  },
  thumbnail: {
    width: 60,
    height: 60,
    margin: 10,
    borderRadius: 4,
    backgroundColor: colors.border,
  }
});
