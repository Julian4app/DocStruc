// ignore_for_file: avoid_print
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/supabase_service.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────────────────────────────────────

/// Permission snapshot for one user in one project.
class ProjectPermissions {
  final bool isOwner;
  final String? role; // null → not a member
  final Map<String, _ModPerm> _modules;

  const ProjectPermissions({
    required this.isOwner,
    required this.role,
    required Map<String, _ModPerm> modules,
  }) : _modules = modules;

  /// Full access (owner or admin with all rights)
  bool get isAdmin => isOwner || role == 'admin';

  bool canView(String module) =>
      isOwner || (_modules[module]?.view ?? false);
  bool canCreate(String module) =>
      isOwner || (_modules[module]?.create ?? false);
  bool canEdit(String module) =>
      isOwner || (_modules[module]?.edit ?? false);
  bool canDelete(String module) =>
      isOwner || (_modules[module]?.delete ?? false);

  /// Returns true when the user has at least view permission on the module.
  bool hasAccess(String module) => canView(module);

  /// Empty / no-access singleton
  static const none = ProjectPermissions(
    isOwner: false,
    role: null,
    modules: {},
  );

  /// Full-access singleton (owner)
  static const owner = ProjectPermissions(
    isOwner: true,
    role: 'owner',
    modules: {},
  );
}

class _ModPerm {
  final bool view;
  final bool create;
  final bool edit;
  final bool delete;
  const _ModPerm(this.view, this.create, this.edit, this.delete);
}

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

class PermissionsState {
  final bool loading;
  final ProjectPermissions perms;
  final String? error;
  const PermissionsState({
    required this.loading,
    required this.perms,
    this.error,
  });

  factory PermissionsState.initial() =>
      const PermissionsState(loading: true, perms: ProjectPermissions.none);

  PermissionsState copyWith({
    bool? loading,
    ProjectPermissions? perms,
    String? error,
  }) =>
      PermissionsState(
        loading: loading ?? this.loading,
        perms: perms ?? this.perms,
        error: error ?? this.error,
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifier
// ─────────────────────────────────────────────────────────────────────────────

class PermissionsNotifier
    extends AutoDisposeFamilyAsyncNotifier<ProjectPermissions, String> {
  @override
  Future<ProjectPermissions> build(String projectId) async {
    return _fetchPermissions(projectId);
  }

  Future<ProjectPermissions> _fetchPermissions(String projectId) async {
    final userId = SupabaseService.currentUserId;
    if (userId == null) return ProjectPermissions.none;

    try {
      final rows = await SupabaseService.getUserProjectPermissions(
          userId, projectId);

      // Determine role from project_members
      final roleRow = await SupabaseService.client
          .from('project_members')
          .select('role_id, roles(role_name)')
          .eq('project_id', projectId)
          .eq('user_id', userId)
          .maybeSingle();

      // Check if owner
      final projectRow = await SupabaseService.client
          .from('projects')
          .select('owner_id')
          .eq('id', projectId)
          .maybeSingle();

      final isOwner = projectRow?['owner_id'] == userId;
      if (isOwner) return ProjectPermissions.owner;

      final roleName = (roleRow?['roles'] as Map<String, dynamic>?)?['role_name']
          as String?;

      final Map<String, _ModPerm> modules = {};
      for (final row in rows) {
        final key = row['module_key'] as String;
        modules[key] = _ModPerm(
          row['can_view'] == true,
          row['can_create'] == true,
          row['can_edit'] == true,
          row['can_delete'] == true,
        );
      }

      return ProjectPermissions(
        isOwner: false,
        role: roleName,
        modules: modules,
      );
    } catch (e) {
      print('[PermissionsNotifier] error fetching permissions: $e');
      // Fail closed — if we can't load permissions, deny access.
      // The user can retry by refreshing the project.
      return ProjectPermissions.none;
    }
  }

  Future<void> refresh(String projectId) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchPermissions(projectId));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider (family — keyed by projectId)
// ─────────────────────────────────────────────────────────────────────────────

final permissionsProvider = AsyncNotifierProvider.autoDispose
    .family<PermissionsNotifier, ProjectPermissions, String>(
  PermissionsNotifier.new,
);

/// Convenience synchronous accessor — returns [ProjectPermissions.none] while
/// loading and surfaces the value when ready.
extension PermissionsProviderX on WidgetRef {
  ProjectPermissions permissions(String projectId) {
    return watch(permissionsProvider(projectId)).valueOrNull ??
        ProjectPermissions.none;
  }
}
