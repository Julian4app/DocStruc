import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getProjectStructure, 
  getProjectTasks, 
  createTask, 
  updateTaskStatus, 
  uploadFile,
  BuildingWithFloors,
  MemberWithUser,
  getProjectMembers
} from '@docstruc/api';
import { Task, AppRole } from '@docstruc/logic';
import { SupabaseClient } from '@supabase/supabase-js';

// Query Keys
export const keys = {
  currentRole: (projectId: string, userId: string) => ['role', projectId, userId], 
  project: (id: string) => ['project', id],
  structure: (id: string) => ['structure', id],
  tasks: (roomId: string) => ['tasks', roomId],
  projectTasks: (projectId: string) => ['projectTasks', projectId],
  members: (projectId: string) => ['members', projectId]
};

// ---------------------------
// Hooks
// ---------------------------

export function useProjectStructureData(client: SupabaseClient, projectId: string) {
  return useQuery({
    queryKey: keys.structure(projectId),
    queryFn: () => getProjectStructure(client, projectId),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5, // 5 minutes fresh
  });
}

export function useRoomTasks(client: SupabaseClient, roomId: string) {
  return useQuery({
    queryKey: keys.tasks(roomId),
    queryFn: async () => {
      // We don't have a direct "getTasksByRoom" that isn't filtered from project? 
      // Actually we implemented getTasks(client, roomId) in api/tasks.ts
      // Let's assume we import the right one.
      const { getTasks } = await import('@docstruc/api'); 
      return getTasks(client, roomId);
    },
    enabled: !!roomId,
  });
}

export function useProjectMembersData(client: SupabaseClient, projectId: string) {
  return useQuery({
    queryKey: keys.members(projectId),
    queryFn: () => getProjectMembers(client, projectId),
    enabled: !!projectId,
  });
}

export function useProjectPermissions(client: SupabaseClient, projectId: string, userId?: string) {
  return useQuery({
    queryKey: keys.currentRole(projectId, userId || ''),
    queryFn: async () => {
      if (!userId) return null;
      
      // Check if owner of project
      const { data: project } = await client
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .single();
        
      if (project?.owner_id === userId) return 'owner' as AppRole;

      // Check member role
      const { data: member } = await client
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single();
        
      return (member?.role as AppRole) || null;
    },
    enabled: !!projectId && !!userId,
    // Add extra info to the result
    select: (role) => {
      const canEditStructure = role === 'owner' || role === 'builder';
      const canManageMembers = role === 'owner';
      const canDeleteTasks = role === 'owner' || role === 'builder';
      const canCreateTask = role !== 'viewer';
      return { role, canEditStructure, canManageMembers, canDeleteTasks, canCreateTask };
    }
  });
}

// ---------------------------
// Mutations
// ---------------------------

export function useCreateTask(client: SupabaseClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { 
      projectId: string; 
      roomId: string; 
      title: string; 
      description?: string; 
      status?: any; 
      assigned_to?: string; 
      due_date?: string; 
      imageUri?: string; 
      webFile?: any 
    }) => {
      let imageUrl = null;
      if (vars.imageUri) {
         const filename = `${vars.projectId}/${Date.now()}.jpg`;
         imageUrl = await uploadFile(
           client, 
           'images', 
           filename, 
           vars.imageUri, 
           vars.webFile
         );
      }
      
      return createTask(client, {
        project_id: vars.projectId,
        room_id: vars.roomId,
        title: vars.title,
        description: vars.description,
        status: vars.status || 'open',
        assigned_to: vars.assigned_to,
        due_date: vars.due_date,
        images: imageUrl ? [imageUrl] : undefined
      });
    },
    onSuccess: (newTask, variables) => {
      // Invalidate relevant queries to refetch
      queryClient.invalidateQueries({ queryKey: keys.tasks(variables.roomId) });
      queryClient.invalidateQueries({ queryKey: keys.projectTasks(variables.projectId) });
    },
  });
}

export function useUpdateTaskStatus(client: SupabaseClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { taskId: string; status: any; roomId: string }) => 
      updateTaskStatus(client, vars.taskId, vars.status),
    onMutate: async (vars) => {
      // Optimistic Update
      await queryClient.cancelQueries({ queryKey: keys.tasks(vars.roomId) });
      const previousTasks = queryClient.getQueryData<Task[]>(keys.tasks(vars.roomId));

      if (previousTasks) {
        queryClient.setQueryData<Task[]>(keys.tasks(vars.roomId), (old) => 
          old?.map(t => t.id === vars.taskId ? { ...t, status: vars.status } : t) || []
        );
      }
      return { previousTasks };
    },
    onError: (err, vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(keys.tasks(vars.roomId), context.previousTasks);
      }
    },
    onSettled: (data, error, vars) => {
      queryClient.invalidateQueries({ queryKey: keys.tasks(vars.roomId) });
    }
  });
}
