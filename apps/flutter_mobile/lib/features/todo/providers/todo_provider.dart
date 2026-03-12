import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/todo_model.dart';
import '../services/todo_service.dart';

// ── State ─────────────────────────────────────────────────────────────────────

class TodoState {
  final List<TodoModel> todos;
  final bool loading;
  final bool loadingMore;
  final String? error;
  final String? statusFilter;
  final int page;
  final bool hasMore;

  const TodoState({
    this.todos       = const [],
    this.loading     = false,
    this.loadingMore = false,
    this.error,
    this.statusFilter,
    this.page    = 0,
    this.hasMore = true,
  });

  TodoState copyWith({
    List<TodoModel>? todos,
    bool? loading,
    bool? loadingMore,
    String? error,
    String? statusFilter,
    int? page,
    bool? hasMore,
    bool clearError = false,
    bool clearFilter = false,
  }) => TodoState(
    todos:        todos        ?? this.todos,
    loading:      loading      ?? this.loading,
    loadingMore:  loadingMore  ?? this.loadingMore,
    error:        clearError   ? null : (error ?? this.error),
    statusFilter: clearFilter  ? null : (statusFilter ?? this.statusFilter),
    page:         page         ?? this.page,
    hasMore:      hasMore      ?? this.hasMore,
  );

  /// Group todos by status for Kanban view.
  Map<String, List<TodoModel>> get kanbanColumns => {
    TodoStatus.open:       todos.where((t) => t.status == TodoStatus.open).toList(),
    TodoStatus.inProgress: todos.where((t) => t.status == TodoStatus.inProgress).toList(),
    TodoStatus.waiting:    todos.where((t) => t.status == TodoStatus.waiting).toList(),
    TodoStatus.done:       todos.where((t) => t.status == TodoStatus.done).toList(),
  };
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class TodoNotifier extends StateNotifier<TodoState> {
  TodoNotifier() : super(const TodoState());

  static const _pageSize = 30;

  Future<void> load({bool refresh = false}) async {
    if (state.loading) return;
    final page = refresh ? 0 : state.page;

    state = state.copyWith(
      loading: refresh || page == 0,
      loadingMore: page > 0,
      clearError: true,
    );

    try {
      final items = await TodoService.getTodosForUser(
        statusFilter: state.statusFilter,
        page: page,
        pageSize: _pageSize,
      );

      state = state.copyWith(
        todos:       refresh ? items : [...state.todos, ...items],
        loading:     false,
        loadingMore: false,
        page:        page + 1,
        hasMore:     items.length >= _pageSize,
      );
    } catch (e) {
      state = state.copyWith(
        loading:     false,
        loadingMore: false,
        error:       e.toString(),
      );
    }
  }

  Future<void> refresh() => load(refresh: true);

  Future<void> setStatusFilter(String? filter) async {
    state = state.copyWith(
      statusFilter: filter,
      clearFilter: filter == null,
      page: 0,
    );
    await load(refresh: true);
  }

  // ── Optimistic Kanban drag ──────────────────────────────────────────────────

  Future<void> moveTodo(String todoId, String newStatus) async {
    // Optimistic update
    final updated = state.todos.map((t) {
      if (t.id == todoId) return t.copyWith(status: newStatus);
      return t;
    }).toList();
    state = state.copyWith(todos: updated);

    try {
      await TodoService.updateTodoStatus(todoId, newStatus);
    } catch (e) {
      // Revert on failure
      await refresh();
    }
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  Future<TodoModel?> createTodo({
    required String name,
    String? description,
    String? dueDate,
    String? location,
    String? sharedWithUserId,
    List<TodoLink> links = const [],
  }) async {
    try {
      final todo = await TodoService.createTodo(
        name: name,
        description: description,
        dueDate: dueDate,
        location: location,
        sharedWithUserId: sharedWithUserId,
      );

      // Insert links sequentially (rare: usually 0–1 links on create)
      for (final link in links) {
        await TodoService.linkEntityToTodo(
          todoId:     todo.id,
          entityType: link.entityType,
          entityId:   link.entityId,
          projectId:  link.projectId,
        );
      }

      await refresh();
      return todo;
    } catch (e) {
      state = state.copyWith(error: e.toString());
      return null;
    }
  }

  Future<bool> updateTodo({
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
    try {
      final updated = await TodoService.updateTodo(
        id:                id,
        name:              name,
        description:       description,
        status:            status,
        dueDate:           dueDate,
        clearDueDate:      clearDueDate,
        location:          location,
        sharedWithUserId:  sharedWithUserId,
        clearShared:       clearShared,
      );
      state = state.copyWith(
        todos: state.todos.map((t) => t.id == id ? updated : t).toList(),
      );
      return true;
    } catch (e) {
      state = state.copyWith(error: e.toString());
      return false;
    }
  }

  Future<bool> deleteTodo(String id) async {
    try {
      await TodoService.deleteTodo(id);
      state = state.copyWith(todos: state.todos.where((t) => t.id != id).toList());
      return true;
    } catch (e) {
      state = state.copyWith(error: e.toString());
      return false;
    }
  }

  Future<void> markDone(String id) => moveTodo(id, TodoStatus.done);

  void clearError() => state = state.copyWith(clearError: true);
}

// ── Providers ─────────────────────────────────────────────────────────────────

final todoProvider = StateNotifierProvider<TodoNotifier, TodoState>((ref) {
  final notifier = TodoNotifier();
  notifier.load();
  return notifier;
});
