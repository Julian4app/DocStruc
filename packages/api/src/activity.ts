import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Log file upload activity
 */
export async function logFileUpload(
  supabase: SupabaseClient,
  projectId: string,
  fileName: string,
  filePath: string,
  fileSize: number,
  entityType: string = 'file',
  entityId?: string
) {
  try {
    const { data, error } = await supabase.rpc('log_file_upload', {
      p_project_id: projectId,
      p_file_name: fileName,
      p_file_path: filePath,
      p_file_size: fileSize,
      p_entity_type: entityType,
      p_entity_id: entityId
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error logging file upload:', error);
    throw error;
  }
}

/**
 * Log custom activity
 */
export async function logActivity(
  supabase: SupabaseClient,
  projectId: string,
  action: string,
  entityType: string,
  entityId?: string,
  entityTitle?: string,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>,
  metadata?: Record<string, any>
) {
  try {
    const { data, error } = await supabase.rpc('log_activity', {
      p_project_id: projectId,
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_entity_title: entityTitle,
      p_old_values: oldValues || {},
      p_new_values: newValues || {},
      p_metadata: metadata || {}
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error logging activity:', error);
    throw error;
  }
}

/**
 * Get activity logs for a project
 */
export async function getActivityLogs(
  supabase: SupabaseClient,
  projectId: string,
  limit: number = 200,
  entityType?: string
) {
  try {
    let query = supabase
      .from('activity_logs')
      .select(`
        *,
        profiles!activity_logs_user_id_fkey(email, first_name, last_name, avatar_url)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    throw error;
  }
}
