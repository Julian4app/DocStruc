import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/todo_model.dart';
import '../providers/todo_provider.dart';
import '../widgets/todo_card.dart';
import '../widgets/todo_edit_modal.dart';
import '../../../core/theme/app_colors.dart';

class TodoListView extends ConsumerWidget {
  final List<TodoModel> todos;
  final ScrollController? scrollController;

  const TodoListView({
    super.key,
    required this.todos,
    this.scrollController,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (todos.isEmpty) {
      return const _EmptyState();
    }

    return ListView.builder(
      controller: scrollController,
      padding: const EdgeInsets.only(top: 8, bottom: 120),
      itemCount: todos.length,
      itemBuilder: (context, i) {
        final todo = todos[i];
        return TodoCard(
          todo: todo,
          onTap: () => _openEdit(context, ref, todo),
          onEdit: () => _openEdit(context, ref, todo),
          onDelete: () => _confirmDelete(context, ref, todo),
          onMarkDone: () => ref.read(todoProvider.notifier).markDone(todo.id),
        );
      },
    );
  }

  void _openEdit(BuildContext context, WidgetRef ref, TodoModel todo) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => TodoEditModal(todo: todo),
    );
  }

  void _confirmDelete(BuildContext context, WidgetRef ref, TodoModel todo) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('ToDo löschen?'),
        content: Text('„${todo.name}" wird unwiderruflich gelöscht.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Abbrechen'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ref.read(todoProvider.notifier).deleteTodo(todo.id);
            },
            child: const Text('Löschen',
                style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.07),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.checklist_rounded,
                  size: 36, color: AppColors.primary),
            ),
            const SizedBox(height: 16),
            const Text('Keine ToDos',
                style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    color: AppColors.text)),
            const SizedBox(height: 6),
            const Text('Tippe auf + um ein ToDo zu erstellen.',
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary)),
          ],
        ),
      );
}
