import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/todo_model.dart';
import '../../../core/services/supabase_service.dart';

class TodoService {
  static SupabaseClient get _db => SupabaseService.client;

  // ── Fetch ──────────────────────────────────────────────────────────────────

  /// Returns all ToDos the current user owns or was shared with,
  /// newest first, with links and shared-user profile.
  static Future<List<TodoModel>> getTodosForUser({
    String? statusFilter,
    int page = 0,
    int pageSize = 30,
  }) async {
    var baseQuery = _db
        .from('todos')
        .select('''
          *,
          todo_links(*),
          shared_profile:shared_with_user_id(first_name, last_name, avatar_url)
        ''')
        .or('owner_user_id.eq.${SupabaseService.currentUserId},'
            'shared_with_user_id.eq.${SupabaseService.currentUserId}');

    final filtered = (statusFilter != null && statusFilter.isNotEmpty)
        ? baseQuery.eq('status', statusFilter)
        : baseQuery;

    final res = await filtered
        .order('created_at', ascending: false)
        .range(page * pageSize, (page + 1) * pageSize - 1);
    return (res as List).map((j) => TodoModel.fromJson(j as Map<String, dynamic>)).toList();
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  static Future<TodoModel> createTodo({
    required String name,
    String? description,
    String? dueDate,
    String? location,
    String? sharedWithUserId,
  }) async {
    final uid = SupabaseService.currentUserId!;
    final res = await _db
        .from('todos')
        .insert({
          'name':                 name,
          'description':          description,
          'due_date':             dueDate,
          'location':             location,
          'owner_user_id':        uid,
          'shared_with_user_id':  sharedWithUserId,
          'status':               TodoStatus.open,
        })
        .select('''
          *,
          todo_links(*),
          shared_profile:shared_with_user_id(first_name, last_name, avatar_url)
        ''')
        .single();
    return TodoModel.fromJson(res as Map<String, dynamic>);
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  static Future<TodoModel> updateTodo({
    required String id,
    String? name,
    String? description,
    String? status,
    String? dueDate,
    bool clearDueDate = false,
    String? location,
    String? sharedWithUserId,
    bool clearShared = false,
  }) async {
    final updates = <String, dynamic>{};
    if (name != null)               updates['name']        = name;
    if (description != null)        updates['description'] = description;
    if (status != null)             updates['status']      = status;
    if (dueDate != null)            updates['due_date']    = dueDate;
    if (clearDueDate)               updates['due_date']    = null;
    if (location != null)           updates['location']    = location;
    if (sharedWithUserId != null)   updates['shared_with_user_id'] = sharedWithUserId;
    if (clearShared)                updates['shared_with_user_id'] = null;

    final res = await _db
        .from('todos')
        .update(updates)
        .eq('id', id)
        .select('''
          *,
          todo_links(*),
          shared_profile:shared_with_user_id(first_name, last_name, avatar_url)
        ''')
        .single();
    return TodoModel.fromJson(res as Map<String, dynamic>);
  }

  // ── Status only (Kanban drag) ──────────────────────────────────────────────

  static Future<void> updateTodoStatus(String id, String status) async {
    await _db.from('todos').update({'status': status}).eq('id', id);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  static Future<void> deleteTodo(String id) async {
    await _db.from('todos').delete().eq('id', id);
  }

  // ── Links ──────────────────────────────────────────────────────────────────

  static Future<TodoLink> linkEntityToTodo({
    required String todoId,
    required String entityType,
    required String entityId,
    required String projectId,
  }) async {
    final res = await _db
        .from('todo_links')
        .insert({
          'todo_id':     todoId,
          'entity_type': entityType,
          'entity_id':   entityId,
          'project_id':  projectId,
        })
        .select()
        .single();
    return TodoLink.fromJson(res as Map<String, dynamic>);
  }

  static Future<void> removeLinkFromTodo(String linkId) async {
    await _db.from('todo_links').delete().eq('id', linkId);
  }

  // ── Sharing ────────────────────────────────────────────────────────────────

  static Future<void> shareTodo(String todoId, String? sharedWithUserId) async {
    await _db
        .from('todos')
        .update({'shared_with_user_id': sharedWithUserId})
        .eq('id', todoId);
  }

  /// Returns project members the current user can share with.
  static Future<List<ShareableUser>> getShareableUsers(String projectId) async {
    final res = await _db.rpc(
      'get_todo_shareable_users',
      params: {'p_project_id': projectId},
    );
    return (res as List)
        .map((j) => ShareableUser.fromJson(j as Map<String, dynamic>))
        .toList();
  }

  /// Returns all projects the current user is a member of (for pickers).
  static Future<List<Map<String, dynamic>>> getUserProjects() async {
    final uid = SupabaseService.currentUserId!;
    final res = await _db
        .from('project_members')
        .select('project_id, projects(id, name, status)')
        .eq('user_id', uid)
        .eq('status', 'active');
    return (res as List)
        .map((r) => r['projects'] as Map<String, dynamic>)
        .where((p) => p['id'] != null)
        .toList();
  }
}
