import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Task } from '@docstruc/logic';
import { getTasks, createTask, updateTaskStatus, getProjectMembers, MemberWithUser, uploadFile } from '@docstruc/api';
import { colors, spacing } from '@docstruc/theme';
import { TaskItem } from './TaskItem';
import { Button } from './Button';
import { TaskForm } from './TaskForm';
import { useRoomTasks, useCreateTask, useUpdateTaskStatus } from '@docstruc/hooks';
import { SupabaseClient } from '@supabase/supabase-js';

interface RoomDetailViewProps {
  room: { id: string; name: string; project_id?: string; [key: string]: any };
  projectId: string; 
  onClose?: () => void;
  canCreateTask?: boolean;
  client: SupabaseClient;
}

export function RoomDetailView({ room, projectId, onClose, canCreateTask = true, client }: RoomDetailViewProps) {
  const { data: tasks, isLoading: loading } = useRoomTasks(client, room.id);
  const createTask = useCreateTask(client);
  const updateStatus = useUpdateTaskStatus(client);
  
  const [isAdding, setIsAdding] = useState(false);
  const [members, setMembers] = useState<MemberWithUser[]>([]);

  React.useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const data = await getProjectMembers(client, projectId);
      setMembers(data);
    } catch (e) {
       console.log('Could not load members', e);
    }
  };

  const handleAddTask = async (formData: any) => {
    try {
      await createTask.mutateAsync({
        projectId: projectId,
        roomId: room.id,
        title: formData.title,
        description: formData.description,
        assigned_to: formData.assigned_to,
        due_date: formData.due_date,
        imageUri: formData.imageUri,
        webFile: formData.webFile
      });
      setIsAdding(false);
    } catch (e) {
      console.error(e);
      alert('Error creating task');
    }
  };

  const handleToggleStatus = (task: any) => {
    const newStatus = task.status === 'done' ? 'open' : 'done';
    updateStatus.mutate({ taskId: task.id, status: newStatus, roomId: room.id });
  };

  if (isAdding) {
    return (
      <TaskForm 
        onSubmit={handleAddTask}
        onCancel={() => setIsAdding(false)}
        members={members}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{room.name} - Aufgaben</Text>
        {onClose && <Button variant="outline" onClick={onClose}>Schließen</Button>}
      </View>

      {canCreateTask && (
        <View style={styles.addTaskContainer}>
           <Button onClick={() => setIsAdding(true)}>+ Neue Aufgabe</Button>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <FlatList
          data={tasks || []}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TaskItem 
              task={item} 
              onStatusChange={() => handleToggleStatus(item)} 
            />
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Keine Aufgaben in diesem Raum.</Text>
          }
          style={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.m,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  addTaskContainer: {
    marginBottom: spacing.m,
  },
  list: {
    flex: 1,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.l,
  }
});

