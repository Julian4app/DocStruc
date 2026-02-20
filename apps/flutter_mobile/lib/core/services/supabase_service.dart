import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseService {
  SupabaseService._();

  static SupabaseClient get client => Supabase.instance.client;
  static GoTrueClient get auth => client.auth;
  static SupabaseStorageClient get storage => client.storage;

  // Helper for getting current user id
  static String? get currentUserId => auth.currentUser?.id;
  static String? get currentEmail => auth.currentUser?.email;

  // ── Auth ──────────────────────────────────────────────────────────────────
  static Future<AuthResponse> signIn(String email, String password) =>
      auth.signInWithPassword(email: email, password: password);

  static Future<AuthResponse> signUp({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String? phone,
    String? companyName,
    String? position,
  }) =>
      auth.signUp(
        email: email,
        password: password,
        data: {
          'first_name': firstName,
          'last_name': lastName,
          if (phone != null) 'phone': phone,
          if (companyName != null) 'company_name': companyName,
          if (position != null) 'position': position,
        },
      );

  static Future<void> signOut() => auth.signOut();

  static Future<void> resetPassword(String email) =>
      auth.resetPasswordForEmail(email);

  // ── Profile ───────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>?> getProfile(String userId) async {
    final res = await client
        .from('profiles')
        .select()
        .eq('id', userId)
        .maybeSingle();
    return res;
  }

  static Future<void> updateProfile(
      String userId, Map<String, dynamic> data) async {
    await client.from('profiles').update(data).eq('id', userId);
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> getProjects() async {
    final userId = currentUserId;
    if (userId == null) return [];

    final allProjects = <String, Map<String, dynamic>>{};

    // 1. Projects where user is owner
    try {
      final owned = await client
          .from('projects')
          .select()
          .eq('owner_id', userId)
          .order('created_at', ascending: false);
      for (final p in (owned as List).cast<Map<String, dynamic>>()) {
        allProjects[p['id'] as String] = p;
      }
    } catch (e) {
      debugPrint('[getProjects] owned query failed: $e');
    }

    // 2. Projects where user is a direct member
    try {
      final memberRows = await client
          .from('project_members')
          .select('project_id, status')
          .eq('user_id', userId);

      final memberProjectIds = (memberRows as List)
          .cast<Map<String, dynamic>>()
          .map((r) => r['project_id'] as String)
          .where((id) => !allProjects.containsKey(id))
          .toList();

      if (memberProjectIds.isNotEmpty) {
        final memberProjects = await client
            .from('projects')
            .select()
            .inFilter('id', memberProjectIds);
        for (final p in (memberProjects as List).cast<Map<String, dynamic>>()) {
          allProjects[p['id'] as String] = p;
        }
      }
    } catch (e) {
      debugPrint('[getProjects] member query failed: $e');
    }

    // 3. Projects via team access
    try {
      final profile = await client
          .from('profiles')
          .select('team_id')
          .eq('id', userId)
          .maybeSingle();
      final teamId = profile?['team_id'] as String?;
      if (teamId != null) {
        final teamRows = await client
            .from('team_project_access')
            .select('project_id')
            .eq('team_id', teamId);
        final teamProjectIds = (teamRows as List)
            .map((r) => r['project_id'] as String)
            .where((id) => !allProjects.containsKey(id))
            .toList();
        if (teamProjectIds.isNotEmpty) {
          final teamProjects = await client
              .from('projects')
              .select()
              .inFilter('id', teamProjectIds);
          for (final p in (teamProjects as List).cast<Map<String, dynamic>>()) {
            allProjects[p['id'] as String] = p;
          }
        }
      }
    } catch (e) {
      debugPrint('[getProjects] team query failed: $e');
    }

    final result = allProjects.values.toList();
    result.sort((a, b) =>
        (b['created_at'] as String? ?? '').compareTo(a['created_at'] as String? ?? ''));
    return result;
  }

  static Future<Map<String, dynamic>?> getProject(String id) async {
    return await client.from('projects').select().eq('id', id).maybeSingle();
  }

  static Future<void> createProject(Map<String, dynamic> data) async {
    // Ensure owner_id is set; support legacy created_by key from callers
    final userId = currentUserId;
    final payload = Map<String, dynamic>.from(data);
    if (!payload.containsKey('owner_id') && userId != null) {
      payload['owner_id'] = userId;
    }
    // Remove created_by if caller passed it – column does not exist
    payload.remove('created_by');
    await client.from('projects').insert(payload);
  }

  static Future<void> updateProject(
      String id, Map<String, dynamic> data) async {
    await client.from('projects').update(data).eq('id', id);
  }

  static Future<void> deleteProject(String id) async {
    await client.from('projects').delete().eq('id', id);
  }

  static Future<String> uploadProjectImage(String projectId, Uint8List bytes, String ext) async {
    final path = 'projects/$projectId/${DateTime.now().millisecondsSinceEpoch}.$ext';
    await client.storage.from('project-images').uploadBinary(path, bytes, fileOptions: FileOptions(contentType: 'image/$ext', upsert: false));
    final url = client.storage.from('project-images').getPublicUrl(path);
    await client.from('project_images').insert({'project_id': projectId, 'storage_path': path, 'url': url});
    return url;
  }

  /// Adds a project member by email. Creates a user_accessor if needed, then inserts into project_members.
  static Future<void> addProjectMemberByEmail({
    required String projectId,
    required String email,
    required String memberType, // 'employee' | 'owner' | 'subcontractor'
    required String addedBy,
    String? firstName,
    String? lastName,
  }) async {
    // Find or create a user_accessor for this email
    final existing = await client
        .from('user_accessors')
        .select('id, registered_user_id')
        .eq('accessor_email', email)
        .maybeSingle();

    String accessorId;
    String? registeredUserId;
    if (existing != null) {
      accessorId = existing['id'] as String;
      registeredUserId = existing['registered_user_id'] as String?;
    } else {
      // Try to find a registered user with that email
      final profileMatch = await client
          .from('profiles')
          .select('id, first_name, last_name')
          .eq('email', email)
          .maybeSingle();
      registeredUserId = profileMatch?['id'] as String?;
      final newAcc = await client.from('user_accessors').insert({
        'owner_id': addedBy,
        'accessor_email': email,
        'accessor_first_name': firstName ?? profileMatch?['first_name'],
        'accessor_last_name': lastName ?? profileMatch?['last_name'],
        'accessor_type': memberType,
        'registered_user_id': registeredUserId,
        'is_active': true,
      }).select('id').single();
      accessorId = newAcc['id'] as String;
    }

    // Check if already a member
    final alreadyMember = await client
        .from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('accessor_id', accessorId)
        .maybeSingle();
    if (alreadyMember != null) return;

    await client.from('project_members').insert({
      'project_id': projectId,
      'user_id': registeredUserId,
      'accessor_id': accessorId,
      'member_type': memberType,
      'added_by': addedBy,
      'status': registeredUserId != null ? 'active' : 'open',
    });
  }

  // ── Tasks & Defects ───────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> getTasks(String projectId,
      {String? taskType}) async {
    try {
      if (taskType == 'task') {
        // Get tasks: exclude defects. RLS handles visibility.
        final result = await client
            .from('tasks')
            .select()
            .eq('project_id', projectId)
            .neq('task_type', 'defect')
            .order('created_at', ascending: false);
        return (result as List).cast<Map<String, dynamic>>();
      } else if (taskType == 'defect') {
        final result = await client
            .from('tasks')
            .select()
            .eq('project_id', projectId)
            .eq('task_type', 'defect')
            .order('created_at', ascending: false);
        return (result as List).cast<Map<String, dynamic>>();
      } else {
        final result = await client
            .from('tasks')
            .select()
            .eq('project_id', projectId)
            .order('created_at', ascending: false);
        return (result as List).cast<Map<String, dynamic>>();
      }
    } catch (e) {
      debugPrint('[getTasks] error: $e');
      return [];
    }
  }

  // ── Task Images ───────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> getTaskImages(String taskId) async {
    try {
      return (await client
              .from('task_images')
              .select()
              .eq('task_id', taskId)
              .order('display_order', ascending: true))
          .cast<Map<String, dynamic>>();
    } catch (e) {
      debugPrint('[getTaskImages] error: $e');
      return [];
    }
  }

  static String getTaskImageUrl(String storagePath) =>
      client.storage.from('task-images').getPublicUrl(storagePath);

  static Future<void> deleteTaskImage(String imageId, String storagePath) async {
    try {
      await client.storage.from('task-images').remove([storagePath]);
    } catch (_) {}
    await client.from('task_images').delete().eq('id', imageId);
  }

  static Future<void> addTaskImage(
      String taskId, String projectId, String storagePath, String fileName, int order) async {
    final userId = currentUserId;
    await client.from('task_images').insert({
      'task_id': taskId,
      'project_id': projectId,
      'storage_path': storagePath,
      'file_name': fileName,
      'display_order': order,
      if (userId != null) 'uploaded_by': userId,
    });
  }

  // ── Task Documentation (per task) ─────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> getTaskDocs(String taskId) async {
    try {
      return (await client
              .from('task_documentation')
              .select('*, profiles!task_documentation_user_id_fkey(id, first_name, last_name, display_name, email)')
              .eq('task_id', taskId)
              .order('created_at', ascending: false))
          .cast<Map<String, dynamic>>();
    } catch (e) {
      debugPrint('[getTaskDocs] error: $e');
      // Fallback without profile join in case foreign key name differs
      try {
        return (await client
                .from('task_documentation')
                .select()
                .eq('task_id', taskId)
                .order('created_at', ascending: false))
            .cast<Map<String, dynamic>>();
      } catch (_) {
        return [];
      }
    }
  }

  static Future<void> addTaskDoc(
      String taskId, String projectId, Map<String, dynamic> data) async {
    final userId = currentUserId;
    await client.from('task_documentation').insert({
      ...data,
      'task_id': taskId,
      'project_id': projectId,
      if (userId != null) 'user_id': userId,
    });
  }

  static Future<void> deleteTaskDoc(String docId) async {
    await client.from('task_documentation').delete().eq('id', docId);
  }

  // ── Milestone Tasks (linked items) ────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> getMilestoneTasks(String milestoneId) async {
    try {
      final links = (await client
              .from('milestone_tasks')
              .select('task_id')
              .eq('milestone_id', milestoneId))
          .cast<Map<String, dynamic>>();
      if (links.isEmpty) return [];
      final ids = links.map((l) => l['task_id'] as String).toList();
      return (await client
              .from('tasks')
              .select('id, title, status, priority, task_type, description, due_date')
              .inFilter('id', ids))
          .cast<Map<String, dynamic>>();
    } catch (e) {
      debugPrint('[getMilestoneTasks] error: $e');
      return [];
    }
  }

  static Future<void> linkMilestoneTask(String milestoneId, String taskId) async {
    await client.from('milestone_tasks').insert({
      'milestone_id': milestoneId,
      'task_id': taskId,
    });
  }

  static Future<void> unlinkMilestoneTask(String milestoneId, String taskId) async {
    await client
        .from('milestone_tasks')
        .delete()
        .eq('milestone_id', milestoneId)
        .eq('task_id', taskId);
  }

  static Future<void> replaceAllMilestoneTasks(
      String milestoneId, List<String> taskIds) async {
    await client.from('milestone_tasks').delete().eq('milestone_id', milestoneId);
    if (taskIds.isNotEmpty) {
      await client.from('milestone_tasks').insert(
            taskIds.map((id) => {'milestone_id': milestoneId, 'task_id': id}).toList(),
          );
    }
  }

  // ── Project details (start/end dates) ────────────────────────────────────
  static Future<Map<String, dynamic>?> getProjectDates(String projectId) async {
    try {
      return await client
          .from('projects')
          .select('start_date, target_end_date')
          .eq('id', projectId)
          .maybeSingle();
    } catch (e) {
      debugPrint('[getProjectDates] error: $e');
      return null;
    }
  }

  static Future<void> createTask(
      String projectId, Map<String, dynamic> data) async {
    final userId = currentUserId;
    await client.from('tasks').insert({
      ...data,
      'project_id': projectId,
      if (userId != null) 'created_by': userId,
    });
  }

  /// Creates a task and returns the new row's id, or null on failure.
  static Future<String?> createTaskWithReturn(
      String projectId, Map<String, dynamic> data) async {
    final userId = currentUserId;
    final response = await client
        .from('tasks')
        .insert({
          ...data,
          'project_id': projectId,
          if (userId != null) 'created_by': userId,
        })
        .select('id')
        .single();
    return response['id'] as String?;
  }

  static Future<void> updateTask(
      String id, Map<String, dynamic> data) async {
    await client
        .from('tasks')
        .update({...data, 'updated_at': DateTime.now().toIso8601String()})
        .eq('id', id);
  }

  static Future<void> deleteTask(String id) async {
    await client.from('tasks').delete().eq('id', id);
  }

  // ── Timeline Events ───────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> getTimelineEvents(
      String projectId) async {
    return (await client
            .from('timeline_events')
            .select()
            .eq('project_id', projectId)
            .order('start_date'))
        .cast<Map<String, dynamic>>();
  }

  static Future<void> createTimelineEvent(
      String projectId, Map<String, dynamic> data) async {
    await client.from('timeline_events').insert({
      ...data,
      'project_id': projectId,
    });
  }

  static Future<void> updateTimelineEvent(
      String id, Map<String, dynamic> data) async {
    await client.from('timeline_events').update(data).eq('id', id);
  }

  static Future<void> deleteTimelineEvent(String id) async {
    await client.from('timeline_events').delete().eq('id', id);
  }

  // ── Project Members ───────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> getProjectMembers(
      String projectId) async {
    try {
      return (await client
              .from('project_members')
              .select('*, profiles!project_members_user_id_fkey(id, email, first_name, last_name, display_name, avatar_url, company_name)')
              .eq('project_id', projectId))
          .cast<Map<String, dynamic>>();
    } catch (e) {
      debugPrint('[getProjectMembers] error: $e');
      return [];
    }
  }

  // ── CRM Contacts (Zugreifer) ──────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> getCrmContacts() async {
    try {
      return (await client
              .from('crm_contacts')
              .select()
              .order('first_name'))
          .cast<Map<String, dynamic>>();
    } catch (e) {
      debugPrint('[getCrmContacts] error: $e');
      return [];
    }
  }

  static Future<List<Map<String, dynamic>>> getUserAccessors() async {
    try {
      final userId = currentUserId;
      if (userId == null) return [];
      return (await client
              .from('user_accessors')
              .select()
              .eq('owner_id', userId)
              .order('accessor_first_name'))
          .cast<Map<String, dynamic>>();
    } catch (e) {
      debugPrint('[getUserAccessors] error: $e');
      return [];
    }
  }

  static Future<void> addProjectMember(String projectId, String email, String role) async {
    // Look up user by email in profiles
    final profiles = await client
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

    if (profiles == null) {
      throw Exception('Nutzer mit dieser E-Mail nicht gefunden');
    }

    final userId = profiles['id'] as String;

    // Check if already a member
    final existing = await client
        .from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .maybeSingle();

    if (existing != null) {
      throw Exception('Nutzer ist bereits Mitglied dieses Projekts');
    }

    await client.from('project_members').insert({
      'project_id': projectId,
      'user_id': userId,
      'role': role,
      'status': 'active',
    });
  }

  static Future<void> removeProjectMember(String memberId) async {
    await client.from('project_members').delete().eq('id', memberId);
  }

  // ── Diary ─────────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> getDiaryEntries(
      String projectId) async {
    try {
      final rows = await client
          .from('diary_entries')
          .select('*, profiles!diary_entries_created_by_fkey(first_name, last_name, email)')
          .eq('project_id', projectId)
          .order('entry_date', ascending: false);
      return (rows as List).cast<Map<String, dynamic>>();
    } catch (e) {
      debugPrint('[getDiaryEntries] join error: $e');
      // Fallback without profile join
      try {
        return (await client
                .from('diary_entries')
                .select()
                .eq('project_id', projectId)
                .order('entry_date', ascending: false))
            .cast<Map<String, dynamic>>();
      } catch (e2) {
        debugPrint('[getDiaryEntries] fallback error: $e2');
        rethrow;
      }
    }
  }

  static Future<void> createDiaryEntry(
      String projectId, Map<String, dynamic> data) async {
    final userId = currentUserId;
    await client.from('diary_entries').insert({
      ...data,
      'project_id': projectId,
      if (userId != null) 'created_by': userId,
    });
  }

  /// Finds the existing entry for (projectId, entryDate) and updates it.
  static Future<void> upsertDiaryEntry(
      String projectId, String entryDate, Map<String, dynamic> data) async {
    final existing = await client
        .from('diary_entries')
        .select('id')
        .eq('project_id', projectId)
        .eq('entry_date', entryDate)
        .maybeSingle();
    if (existing != null) {
      await client
          .from('diary_entries')
          .update(data)
          .eq('id', existing['id'] as String);
    } else {
      await createDiaryEntry(projectId, data);
    }
  }

  static Future<void> updateDiaryEntry(
      String id, Map<String, dynamic> data) async {
    await client.from('diary_entries').update(data).eq('id', id);
  }

  static Future<void> deleteDiaryEntry(String id) async {
    await client.from('diary_entries').delete().eq('id', id);
  }

  // ── Content Visibility ────────────────────────────────────────────────────
  /// Returns the effective visibility level for a specific content item.
  /// Falls back to 'all_participants' if no override exists.
  static Future<String> getContentVisibility(
      String contentId, String moduleKey) async {
    try {
      final row = await client
          .from('content_visibility_overrides')
          .select('visibility')
          .eq('module_key', moduleKey)
          .eq('content_id', contentId)
          .maybeSingle();
      return (row?['visibility'] as String?) ?? 'all_participants';
    } catch (e) {
      debugPrint('[getContentVisibility] error: $e');
      return 'all_participants';
    }
  }

  /// Upserts a visibility override for a content item.
  static Future<void> setContentVisibility(
      String contentId,
      String moduleKey,
      String projectId,
      String visibilityLevel) async {
    final userId = currentUserId;
    if (userId == null) return;
    await client.from('content_visibility_overrides').upsert({
      'module_key': moduleKey,
      'content_id': contentId,
      'project_id': projectId,
      'visibility': visibilityLevel,
      'created_by': userId,
    }, onConflict: 'module_key,content_id');
  }

  /// Returns the module-level default visibility for a project.
  /// Falls back to 'all_participants' if no default is configured.
  static Future<String> getModuleDefaultVisibility(
      String projectId, String moduleKey) async {
    try {
      final row = await client
          .from('project_content_defaults')
          .select('default_visibility')
          .eq('project_id', projectId)
          .eq('module_key', moduleKey)
          .maybeSingle();
      return (row?['default_visibility'] as String?) ?? 'all_participants';
    } catch (e) {
      debugPrint('[getModuleDefaultVisibility] error: $e');
      return 'all_participants';
    }
  }

  // ── Project Messages (Communication) ──────────────────────────────────────
  static Future<List<Map<String, dynamic>>> getMessages(
      String projectId) async {
    return (await client
            .from('project_messages')
            .select('*, profiles!project_messages_user_id_fkey(id, first_name, last_name, avatar_url)')
            .eq('project_id', projectId)
            .eq('is_deleted', false)
            .order('created_at', ascending: false)
            .limit(100))
        .cast<Map<String, dynamic>>();
  }

  static Future<void> sendMessage(
      String projectId, Map<String, dynamic> data) async {
    final userId = currentUserId;
    await client.from('project_messages').insert({
      ...data,
      'project_id': projectId,
      if (userId != null && !data.containsKey('user_id')) 'user_id': userId,
    });
  }

  static Future<List<Map<String, dynamic>>> getNotes(
      String projectId, {int limit = 30, int offset = 0}) async {
    return (await client
            .from('project_messages')
            .select('*, profiles!project_messages_user_id_fkey(id, first_name, last_name, avatar_url)')
            .eq('project_id', projectId)
            .eq('message_type', 'note')
            .eq('is_deleted', false)
            .order('is_pinned', ascending: false)
            .order('created_at', ascending: false)
            .range(offset, offset + limit - 1))
        .cast<Map<String, dynamic>>();
  }

  static Future<List<Map<String, dynamic>>> getMessagesPaginated(
      String projectId, {int limit = 50, int offset = 0}) async {
    return (await client
            .from('project_messages')
            .select('*, profiles!project_messages_user_id_fkey(id, first_name, last_name, avatar_url)')
            .eq('project_id', projectId)
            .eq('message_type', 'message')
            .eq('is_deleted', false)
            .order('created_at', ascending: false)
            .range(offset, offset + limit - 1))
        .cast<Map<String, dynamic>>();
  }

  static Future<void> createNote(String projectId, String content) async {
    final userId = currentUserId;
    await client.from('project_messages').insert({
      'project_id': projectId,
      'user_id': userId,
      'content': content,
      'message_type': 'note',
    });
  }

  static Future<void> updateMessageContent(String id, String content) async {
    await client.from('project_messages').update({
      'content': content,
      'is_edited': true,
      'edited_at': DateTime.now().toIso8601String(),
    }).eq('id', id);
  }

  static Future<void> softDeleteMessage(String id) async {
    await client.from('project_messages').update({
      'is_deleted': true,
      'deleted_at': DateTime.now().toIso8601String(),
    }).eq('id', id);
  }

  static Future<void> togglePinMessage(
      String id, bool currentlyPinned) async {
    final userId = currentUserId;
    await client.from('project_messages').update({
      'is_pinned': !currentlyPinned,
      'pinned_by': !currentlyPinned ? userId : null,
      'pinned_at': !currentlyPinned ? DateTime.now().toIso8601String() : null,
    }).eq('id', id);
  }

  // ── Activity Logs ─────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> getActivityLogs(
      String projectId) async {
    try {
      return (await client
              .from('activity_logs')
              .select(
                  '*, profiles!activity_logs_user_id_fkey(id, first_name, last_name, email, avatar_url)')
              .eq('project_id', projectId)
              .order('created_at', ascending: false)
              .limit(200))
          .cast<Map<String, dynamic>>();
    } catch (_) {
      // Fallback without FK hint if the explicit alias fails
      return (await client
              .from('activity_logs')
              .select('*')
              .eq('project_id', projectId)
              .order('created_at', ascending: false)
              .limit(200))
          .cast<Map<String, dynamic>>();
    }
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> getNotifications() async {
    final userId = currentUserId;
    if (userId == null) return [];
    return (await client
            .from('notifications')
            .select()
            .eq('user_id', userId)
            .order('created_at', ascending: false)
            .limit(50))
        .cast<Map<String, dynamic>>();
  }

  static Future<void> markNotificationRead(String id) async {
    await client
        .from('notifications')
        .update({'is_read': true}).eq('id', id);
  }

  static Future<void> markAllNotificationsRead() async {
    final userId = currentUserId;
    if (userId == null) return;
    await client
        .from('notifications')
        .update({'is_read': true})
        .eq('user_id', userId)
        .eq('is_read', false);
  }

  // ── Files ─────────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> getProjectFolders(
      String projectId) async {
    return (await client
            .from('project_folders')
            .select()
            .eq('project_id', projectId)
            .order('name'))
        .cast<Map<String, dynamic>>();
  }

  static Future<List<Map<String, dynamic>>> getProjectFiles(
      String folderId) async {
    return (await client
            .from('project_files')
            .select()
            .eq('folder_id', folderId)
            .order('created_at', ascending: false))
        .cast<Map<String, dynamic>>();
  }

  // ── Help Center ───────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> getHelpFaqs() async {
    return (await client
            .from('help_faqs')
            .select()
            .eq('is_published', true)
            .order('sort_order'))
        .cast<Map<String, dynamic>>();
  }

  static Future<List<Map<String, dynamic>>> getHelpWalkthroughs() async {
    return (await client
            .from('help_walkthroughs')
            .select('*, help_walkthrough_steps(*)')
            .eq('is_published', true)
            .order('sort_order'))
        .cast<Map<String, dynamic>>();
  }

  static Future<List<Map<String, dynamic>>> getHelpVideos() async {
    return (await client
            .from('help_videos')
            .select()
            .eq('is_published', true)
            .order('sort_order'))
        .cast<Map<String, dynamic>>();
  }

  static Future<List<Map<String, dynamic>>> getHelpDocuments() async {
    return (await client
            .from('help_documents')
            .select()
            .eq('is_published', true)
            .order('sort_order'))
        .cast<Map<String, dynamic>>();
  }

  static Future<List<Map<String, dynamic>>> getHelpTags() async {
    return (await client.from('help_tags').select().order('name'))
        .cast<Map<String, dynamic>>();
  }

  static Future<void> sendSupportMessage(Map<String, dynamic> data) async {
    await client.from('support_messages').insert(data);
  }

  // ── Feedback ──────────────────────────────────────────────────────────────
  static Future<void> sendFeedback(Map<String, dynamic> data) async {
    await client.from('feedback').insert(data);
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>?> getUserSettings() async {
    final userId = currentUserId;
    if (userId == null) return null;
    return await client
        .from('user_settings')
        .select()
        .eq('user_id', userId)
        .maybeSingle();
  }

  static Future<void> upsertUserSettings(Map<String, dynamic> data) async {
    final userId = currentUserId;
    if (userId == null) return;
    await client
        .from('user_settings')
        .upsert({...data, 'user_id': userId});
  }

  // ── Building Structure ────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> getBuildings(
      String projectId) async {
    return (await client
            .from('buildings')
            .select()
            .eq('project_id', projectId)
            .order('name'))
        .cast<Map<String, dynamic>>();
  }

  static Future<List<Map<String, dynamic>>> getFloors(
      String buildingId) async {
    return (await client
            .from('floors')
            .select()
            .eq('building_id', buildingId)
            .order('floor_number'))
        .cast<Map<String, dynamic>>();
  }

  static Future<List<Map<String, dynamic>>> getRooms(String floorId) async {
    return (await client
            .from('rooms')
            .select()
            .eq('floor_id', floorId)
            .order('name'))
        .cast<Map<String, dynamic>>();
  }

  // ── Storage Upload ────────────────────────────────────────────────────────
  static Future<String> uploadFile({
    required String bucket,
    required String path,
    required List<int> bytes,
    String? contentType,
  }) async {
    await storage.from(bucket).uploadBinary(
          path,
          bytes as dynamic,
          fileOptions: FileOptions(
            upsert: true,
            contentType: contentType,
          ),
        );
    return storage.from(bucket).getPublicUrl(path);
  }

  // ── Documentation ─────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> getTaskDocumentation(
      String projectId) async {
    return (await client
            .from('task_documentation')
            .select('*, tasks(title, task_type)')
            .eq('project_id', projectId)
            .order('created_at', ascending: false)
            .limit(50))
        .cast<Map<String, dynamic>>();
  }

  // ── Convenience aliases used by feature screens ───────────────────────────
  static Future<List<Map<String, dynamic>>> getFaqs() => getHelpFaqs();
  static Future<List<Map<String, dynamic>>> getWalkthroughs() =>
      getHelpWalkthroughs();
  static Future<List<Map<String, dynamic>>> getVideos() => getHelpVideos();
  static Future<List<Map<String, dynamic>>> getDocuments() =>
      getHelpDocuments();

  // Files & Folders with parent support
  static Future<List<Map<String, dynamic>>> getFiles(String projectId,
      {String? folderId}) async {
    var query = client.from('project_files').select().eq('project_id', projectId);
    if (folderId != null) {
      query = query.eq('folder_id', folderId);
    } else {
      query = query.isFilter('folder_id', null);
    }
    return (await query.order('created_at', ascending: false))
        .cast<Map<String, dynamic>>();
  }

  static Future<List<Map<String, dynamic>>> getFolders(String projectId,
      {String? parentId}) async {
    var query =
        client.from('project_folders').select().eq('project_id', projectId);
    if (parentId != null) {
      query = query.eq('parent_id', parentId);
    } else {
      query = query.isFilter('parent_id', null);
    }
    return (await query.order('name')).cast<Map<String, dynamic>>();
  }

  static Future<void> createFolder(
      String projectId, Map<String, dynamic> data) async {
    await client.from('project_folders').insert({
      ...data,
      'project_id': projectId,
    });
  }

  static Future<void> createFile(
      String projectId, Map<String, dynamic> data) async {
    final userId = currentUserId;
    await client.from('project_files').insert({
      ...data,
      'project_id': projectId,
      if (userId != null) 'uploaded_by': userId,
    });
  }

  // Simple uploadFile(path, bytes, name) convenience wrapper
  static Future<String> uploadFileSimple(
      String path, List<int> bytes, String fileName) async {
    return uploadFile(
      bucket: 'project-files',
      path: path,
      bytes: bytes,
      contentType: _guessMime(fileName),
    );
  }

  // ── Project Files – extended operations ───────────────────────────────────

  /// Load all project_files for a project (all folders, latest version only).
  static Future<List<Map<String, dynamic>>> getAllProjectFiles(
      String projectId) async {
    try {
      final result = await client
          .from('project_files')
          .select(
              '*, profiles!project_files_uploaded_by_fkey(email, first_name, last_name)')
          .eq('project_id', projectId)
          .eq('is_latest_version', true)
          .order('uploaded_at', ascending: false);
      return (result as List).cast<Map<String, dynamic>>();
    } catch (e) {
      debugPrint('[getAllProjectFiles] error: $e');
      return [];
    }
  }

  /// Load all folders for a project (flat list, no parent filter).
  static Future<List<Map<String, dynamic>>> getAllFolders(
      String projectId) async {
    try {
      final result = await client
          .from('project_folders')
          .select()
          .eq('project_id', projectId)
          .order('name');
      return (result as List).cast<Map<String, dynamic>>();
    } catch (e) {
      debugPrint('[getAllFolders] error: $e');
      return [];
    }
  }

  /// Update a folder's name / description.
  static Future<void> updateFolder(
      String folderId, Map<String, dynamic> data) async {
    await client.from('project_folders').update(data).eq('id', folderId);
  }

  /// Delete a folder by id.
  static Future<void> deleteFolder(String folderId) async {
    await client.from('project_folders').delete().eq('id', folderId);
  }

  /// Rename a project file.
  static Future<void> renameFile(String fileId, String newName) async {
    await client
        .from('project_files')
        .update({'name': newName})
        .eq('id', fileId);
  }

  /// Delete a project file record (storage deletion handled separately on device).
  static Future<void> deleteFileRecord(String fileId) async {
    await client.from('project_files').delete().eq('id', fileId);
  }

  /// Delete from storage bucket.
  static Future<void> deleteFromStorage(
      String bucket, String storagePath) async {
    await storage.from(bucket).remove([storagePath]);
  }

  /// Get a signed / public download URL.
  static String getFilePublicUrl(String bucket, String storagePath) {
    return storage.from(bucket).getPublicUrl(storagePath);
  }

  /// Generate a short-lived signed URL (60 min).
  static Future<String> getSignedUrl(
      String bucket, String storagePath) async {
    return await storage
        .from(bucket)
        .createSignedUrl(storagePath, 3600);
  }

  /// Load file version history.
  static Future<List<Map<String, dynamic>>> getFileVersions(
      String fileId) async {
    try {
      final result = await client
          .from('project_file_versions')
          .select(
              '*, profiles!project_file_versions_uploaded_by_fkey(email, first_name, last_name)')
          .eq('file_id', fileId)
          .order('version', ascending: false);
      return (result as List).cast<Map<String, dynamic>>();
    } catch (e) {
      debugPrint('[getFileVersions] error: $e');
      return [];
    }
  }

  /// Store a new version record, mark old as non-latest, update the file row.
  static Future<void> uploadNewFileVersion({
    required Map<String, dynamic> existingFile,
    required String newStoragePath,
    required int newFileSize,
  }) async {
    final userId = currentUserId;
    final fileId = existingFile['id'] as String;
    final currentVersion = (existingFile['version'] as int?) ?? 1;

    // Archive current version
    await client.from('project_file_versions').insert({
      'file_id': fileId,
      'version': currentVersion,
      'storage_path': existingFile['storage_path'],
      'file_size': existingFile['file_size'],
      'uploaded_by': existingFile['uploaded_by'],
      'uploaded_at': existingFile['uploaded_at'],
    });

    // Update file row to new version
    await client.from('project_files').update({
      'storage_path': newStoragePath,
      'file_size': newFileSize,
      'version': currentVersion + 1,
      if (userId != null) 'uploaded_by': userId,
      'uploaded_at': DateTime.now().toIso8601String(),
    }).eq('id', fileId);
  }

  /// Load shares for a file.
  static Future<List<Map<String, dynamic>>> getFileShares(
      String fileId) async {
    try {
      final result = await client
          .from('project_file_shares')
          .select()
          .eq('file_id', fileId);
      return (result as List).cast<Map<String, dynamic>>();
    } catch (e) {
      debugPrint('[getFileShares] error: $e');
      return [];
    }
  }

  /// Create a file share.
  static Future<void> createFileShare(Map<String, dynamic> data) async {
    final userId = currentUserId;
    await client.from('project_file_shares').insert({
      ...data,
      if (userId != null) 'shared_by': userId,
    });
  }

  /// Remove a file share.
  static Future<void> removeFileShare(String shareId) async {
    await client.from('project_file_shares').delete().eq('id', shareId);
  }

  /// Link an existing doc (project-file or task-doc) to a folder.
  static Future<void> linkFileToFolder(
      String fileId, String folderId) async {
    await client
        .from('project_files')
        .update({'folder_id': folderId})
        .eq('id', fileId);
  }

  /// Load unified documents: task_documentation + project_files.
  static Future<List<Map<String, dynamic>>> getAllDocuments(
      String projectId) async {
    final allDocs = <Map<String, dynamic>>[];

    try {
      final taskDocs = await client
          .from('task_documentation')
          .select('*, tasks(title), profiles!task_documentation_user_id_fkey(email, first_name, last_name)')
          .eq('project_id', projectId)
          .not('storage_path', 'is', null)
          .order('created_at', ascending: false);

      for (final doc in (taskDocs as List).cast<Map<String, dynamic>>()) {
        final profile = doc['profiles'] as Map?;
        final profileName = profile != null
            ? ('${profile['first_name'] ?? ''} ${profile['last_name'] ?? ''}'
                    .trim()
                    .isNotEmpty
                ? '${profile['first_name'] ?? ''} ${profile['last_name'] ?? ''}'
                    .trim()
                : profile['email'] ?? 'Unbekannt')
            : 'Unbekannt';
        allDocs.add({
          'id': doc['id'],
          'name': doc['file_name'] ?? 'Dokument',
          'doc_type': 'task-documentation',
          'source': 'Aufgabe: ${(doc['tasks'] as Map?)?['title'] ?? 'Unbekannt'}',
          'storage_path': doc['storage_path'],
          'file_size': doc['file_size'],
          'mime_type': doc['mime_type'],
          'uploader_name': profileName,
          'created_at': doc['created_at'],
          'folder_id': null,
        });
      }
    } catch (e) {
      debugPrint('[getAllDocuments] task_documentation error: $e');
    }

    try {
      final projectFiles = await client
          .from('project_files')
          .select(
              '*, profiles!project_files_uploaded_by_fkey(email, first_name, last_name), project_folders(name)')
          .eq('project_id', projectId)
          .order('uploaded_at', ascending: false);

      for (final file in (projectFiles as List).cast<Map<String, dynamic>>()) {
        final profile = file['profiles'] as Map?;
        final profileName = profile != null
            ? ('${profile['first_name'] ?? ''} ${profile['last_name'] ?? ''}'
                    .trim()
                    .isNotEmpty
                ? '${profile['first_name'] ?? ''} ${profile['last_name'] ?? ''}'
                    .trim()
                : profile['email'] ?? 'Unbekannt')
            : 'Unbekannt';
        final folderName =
            (file['project_folders'] as Map?)?['name'] as String?;
        allDocs.add({
          'id': file['id'],
          'name': file['name'],
          'doc_type': 'project-file',
          'source': file['folder_id'] != null
              ? 'Ordner: ${folderName ?? 'Unbekannt'}'
              : 'Root',
          'storage_path': file['storage_path'],
          'file_size': file['file_size'],
          'mime_type': file['mime_type'],
          'uploader_name': profileName,
          'created_at': file['uploaded_at'],
          'folder_id': file['folder_id'],
          'linked_folder_name': folderName,
        });
      }
    } catch (e) {
      debugPrint('[getAllDocuments] project_files error: $e');
    }

    return allDocs;
  }

  static String? _guessMime(String name) {
    final ext = name.split('.').last.toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'pdf':
        return 'application/pdf';
      case 'doc':
      case 'docx':
        return 'application/msword';
      default:
        return null;
    }
  }

  // ── Task Documentation Timeline (Dokumentation page) ─────────────────────

  /// Load all task_documentation entries for a project (paginated).
  /// Returns enriched entries with task info and uploader name.
  static Future<Map<String, dynamic>> getTaskDocEntries({
    required String projectId,
    int from = 0,
    int pageSize = 50,
  }) async {
    try {
      // Count total — separate lightweight query
      final countData = await client
          .from('task_documentation')
          .select('id')
          .eq('project_id', projectId);
      final total = (countData as List).length;

      final data = await client
          .from('task_documentation')
          .select(
              'id, task_id, content, documentation_type, created_at, storage_path, file_name, user_id, tasks(title, task_type, status, assigned_to, due_date, priority)')
          .eq('project_id', projectId)
          .order('created_at', ascending: false)
          .range(from, from + pageSize - 1);

      final rows = (data as List).cast<Map<String, dynamic>>();

      // Fetch profiles for the user_ids
      final userIds = rows
          .map((r) => r['user_id'])
          .whereType<String>()
          .toSet()
          .toList();
      Map<String, String> nameMap = {};
      if (userIds.isNotEmpty) {
        try {
          final profiles = await client
              .from('profiles')
              .select('id, first_name, last_name')
              .inFilter('id', userIds);
          for (final p in (profiles as List).cast<Map<String, dynamic>>()) {
            final name =
                '${p['first_name'] ?? ''} ${p['last_name'] ?? ''}'.trim();
            nameMap[p['id'] as String] = name.isNotEmpty ? name : 'Unbekannt';
          }
        } catch (_) {}
      }

      final entries = rows.map((entry) {
        final task = entry['tasks'] as Map?;
        return {
          'id': entry['id'],
          'task_id': entry['task_id'],
          'task_title': task?['title'] ?? 'Gelöschte Aufgabe',
          'task_type': task?['task_type'] == 'defect' ? 'defect' : 'task',
          'task_status': task?['status'],
          'task_priority': task?['priority'],
          'task_due_date': task?['due_date'],
          'task_assigned_to': task?['assigned_to'],
          'content': entry['content'] ?? '',
          'documentation_type': entry['documentation_type'] ?? 'text',
          'created_at': entry['created_at'],
          'user_name': nameMap[entry['user_id'] as String?] ?? 'Unbekannt',
          'storage_path': entry['storage_path'],
          'file_name': entry['file_name'],
        };
      }).toList();

      return {
        'entries': entries,
        'total': total,
        'hasMore': entries.length == pageSize
      };
    } catch (e) {
      debugPrint('[getTaskDocEntries] error: $e');
      return {
        'entries': <Map<String, dynamic>>[],
        'total': 0,
        'hasMore': false
      };
    }
  }

  // Project Documentation (project-level docs, not task docs)
  static Future<List<Map<String, dynamic>>> getDocumentation(
      String projectId) async {
    return (await client
            .from('project_documentation')
            .select()
            .eq('project_id', projectId)
            .order('created_at', ascending: false))
        .cast<Map<String, dynamic>>();
  }

  static Future<void> createDocumentation(
      String projectId, Map<String, dynamic> data) async {
    final userId = currentUserId;
    await client.from('project_documentation').insert({
      ...data,
      'project_id': projectId,
      if (userId != null) 'created_by': userId,
    });
  }

  // ── Project Info (detailed info, map, gallery, voice messages) ────────────

  /// Fetch or lazily create a project_info row for the given project.
  static Future<Map<String, dynamic>?> getProjectInfo(String projectId) async {
    try {
      final existing = await client
          .from('project_info')
          .select()
          .eq('project_id', projectId)
          .maybeSingle();
      if (existing != null) return existing;
      // Row doesn't exist yet — create a minimal placeholder
      final inserted = await client
          .from('project_info')
          .insert({'project_id': projectId})
          .select()
          .maybeSingle();
      return inserted;
    } catch (e) {
      debugPrint('[getProjectInfo] error: $e');
      return null;
    }
  }

  /// Fetch images attached to a project_info row, ordered by display_order.
  static Future<List<Map<String, dynamic>>> getProjectInfoImages(
      String projectInfoId) async {
    try {
      return (await client
              .from('project_info_images')
              .select()
              .eq('project_info_id', projectInfoId)
              .order('display_order', ascending: true))
          .cast<Map<String, dynamic>>();
    } catch (e) {
      debugPrint('[getProjectInfoImages] error: $e');
      return [];
    }
  }

  /// Fetch voice messages attached to a project_info row.
  static Future<List<Map<String, dynamic>>> getProjectVoiceMessages(
      String projectInfoId) async {
    try {
      return (await client
              .from('project_voice_messages')
              .select()
              .eq('project_info_id', projectInfoId)
              .order('created_at', ascending: false))
          .cast<Map<String, dynamic>>();
    } catch (e) {
      debugPrint('[getProjectVoiceMessages] error: $e');
      return [];
    }
  }

  /// Public URL for a project-info image stored in the `project-info-images` bucket.
  static String getProjectInfoImageUrl(String storagePath) =>
      client.storage.from('project-info-images').getPublicUrl(storagePath);

  /// Public URL for a voice message stored in the `project-voice-messages` bucket.
  static String getVoiceMessageUrl(String storagePath) =>
      client.storage.from('project-voice-messages').getPublicUrl(storagePath);
}
