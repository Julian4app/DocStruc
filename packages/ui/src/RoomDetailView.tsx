import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { Task } from '@docstruc/logic';
import { getTasks, createTask, updateTaskStatus, getProjectMembers, MemberWithUser, uploadFile, getRoomComponents, createRoomComponent } from '@docstruc/api';
import { colors, spacing } from '@docstruc/theme';
import { TaskItem } from './TaskItem';
import { Button } from './Button';
import { Input } from './Input';
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
  const { data: tasks, isLoading: loadingTasks } = useRoomTasks(client, room.id);
  const createTask = useCreateTask(client);
  const updateStatus = useUpdateTaskStatus(client);
  
  const [activeTab, setActiveTab] = useState<'tasks' | 'planning'>('planning');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  
  // Planning / Components State
  const [components, setComponents] = useState<any[]>([]);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [newComponent, setNewComponent] = useState('');

  React.useEffect(() => {
    loadMembers();
    if (activeTab === 'planning') {
        loadComponents();
    }
  }, [activeTab, room.id]);

  const loadMembers = async () => {
    try {
      const data = await getProjectMembers(client, projectId);
      setMembers(data);
    } catch (e) {
       console.log('Could not load members', e);
    }
  };

  const loadComponents = async () => {
      setLoadingComponents(true);
      try {
          const res = await getRoomComponents(client, room.id);
          setComponents(res);
      } catch(e) { console.error(e); }
      setLoadingComponents(false);
  };

  const handleAddComponent = async () => {
      if (!newComponent.trim()) return;
      try {
          await createRoomComponent(client, room.id, newComponent, 'other');
          setNewComponent('');
          loadComponents();
      } catch(e) {
          alert('Failed to add component. Make sure "UPDATE_SCHEMA_V3.sql" was run.');
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
      setIsAddingTask(false);
    } catch (e) {
      console.error(e);
      alert('Error creating task');
    }
  };

  const handleToggleStatus = (task: any) => {
    const newStatus = task.status === 'done' ? 'open' : 'done';
    updateStatus.mutate({ taskId: task.id, status: newStatus, roomId: room.id });
  };

  if (isAddingTask) {
    return (
      <TaskForm 
        onSubmit={handleAddTask}
        onCancel={() => setIsAddingTask(false)}
        members={members}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
            <Text style={styles.title}>{room.name}</Text>
            <Text style={styles.subtitle}>{room.type || 'Standard Room'}</Text>
        </View>
        {onClose && <Button variant="outline" onClick={onClose} size="small">Close</Button>}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity 
            style={[styles.tab, activeTab === 'planning' && styles.activeTab]} 
            onPress={() => setActiveTab('planning')}
        >
            <Text style={[styles.tabText, activeTab === 'planning' && styles.activeTabText]}>Planning</Text>
        </TouchableOpacity>
        <TouchableOpacity 
            style={[styles.tab, activeTab === 'tasks' && styles.activeTab]} 
            onPress={() => setActiveTab('tasks')}
        >
            <Text style={[styles.tabText, activeTab === 'tasks' && styles.activeTabText]}>Tasks</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'planning' ? (
          <ScrollView style={styles.content}>
               <View style={styles.sectionHeader}>
                   <Text style={styles.sectionTitle}>Room Components & Measures</Text>
               </View>
               
               <View style={styles.addComponentRow}>
                   <Input 
                        value={newComponent} 
                        onChangeText={setNewComponent} 
                        placeholder="Add generic component (e.g. 'Drywall North', 'Sink')..." 
                        containerStyle={{ flex: 1, marginBottom: 0 }}
                   />
                   <Button onClick={handleAddComponent} size="medium">Add</Button>
               </View>

               {loadingComponents ? (
                   <ActivityIndicator />
               ) : (
                   <View style={styles.componentList}>
                       {components.map((comp) => (
                           <View key={comp.id} style={styles.componentItem}>
                               <View style={styles.bullet} />
                               <Text style={styles.componentName}>{comp.name}</Text>
                               {/* Placeholder for future detailed variant/type selection */}
                               <Text style={styles.componentType}>{comp.type}</Text>
                           </View>
                       ))}
                       {components.length === 0 && (
                           <Text style={styles.emptyState}>No components planned yet.</Text>
                       )}
                   </View>
               )}
               
               {/* Placeholders for Requirements */}
               <View style={{ marginTop: 24, padding: 16, backgroundColor: '#FFFBEB', borderRadius: 8 }}>
                   <Text style={{ fontWeight: 'bold', color: '#B45309' }}>Recommendations</Text>
                   <Text style={{ color: '#F59E0B', fontSize: 13 }}>Standard {room.type || 'room'} requires approx. 4 sockets.</Text>
               </View>

          </ScrollView>
      ) : (
          <View style={{ flex: 1 }}>
            {canCreateTask && (
                <View style={styles.addTaskContainer}>
                <Button onClick={() => setIsAddingTask(true)} variant="secondary" size="small">+ New Task</Button>
                </View>
            )}

            {loadingTasks ? (
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
                    <Text style={styles.emptyState}>No open tasks.</Text>
                }
                />
            )}
          </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    // borderLeftWidth: 1, // handled by parent layout mostly
    // borderLeftColor: colors.border,
    padding: spacing.m,
  },
  header: {
    marginBottom: spacing.m,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
  },
  tabs: {
      flexDirection: 'row',
      marginBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
  },
  tab: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
  },
  activeTab: {
      borderBottomColor: colors.primary,
  },
  tabText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
  },
  activeTabText: {
      color: colors.primary,
      fontWeight: '600',
  },
  content: {
      flex: 1,
  },
  sectionHeader: {
      marginBottom: 12,
  },
  sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
  },
  addComponentRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
      alignItems: 'center',
  },
  componentList: {
      gap: 8,
  },
  componentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: colors.background,
      borderRadius: 8,
      gap: 12,
  },
  bullet: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
  },
  componentName: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
      flex: 1,
  },
  componentType: {
      fontSize: 12,
      color: colors.textSecondary,
      textTransform: 'uppercase',
  },
  addTaskContainer: {
    marginBottom: spacing.m,
    alignItems: 'flex-start',
  },
  emptyState: {
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 20,
      textAlign: 'center',
  }
});

