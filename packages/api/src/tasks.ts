import { SupabaseClient } from '@supabase/supabase-js';
import { Task, TaskStatus } from '@docstruc/logic';

export const getTasks = async (client: SupabaseClient, roomId: string): Promise<Task[]> => {
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export interface CreateTaskPayload {
  project_id: string;
  room_id: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  due_date?: string;
  assigned_to?: string;
  planned_duration_minutes?: number;
  images?: string[]; 
}

export const createTask = async (
  client: SupabaseClient, 
  task: CreateTaskPayload
) => {
  const user = await client.auth.getUser();
  const userId = user.data.user?.id;

  if (!userId) throw new Error('User not authenticated');

  const { data, error } = await client
    .from('tasks')
    .insert({
      ...task,
      creator_id: userId,
      status: task.status || 'open'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateTask = async (
  client: SupabaseClient, 
  taskId: string, 
  updates: Partial<Task>
) => {
  const { data, error } = await client
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateTaskStatus = async (client: SupabaseClient, taskId: string, status: TaskStatus) => {
  const { data, error } = await client
    .from('tasks')
    .update({ status })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getProjectTasks = async (client: SupabaseClient, projectId: string): Promise<Task[]> => {
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};
