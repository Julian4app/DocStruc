import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../models/todo_model.dart';
import '../screens/todo_page.dart';
import '../../../core/theme/app_colors.dart';

/// Drop this button anywhere inside a project sub-page to let the user
/// create a ToDo pre-linked to the current entity.
///
/// Example usage in ProjectTasksPage:
/// ```dart
/// AddToTodoButton(
///   entityType:  TodoEntityType.task,
///   entityId:    task['id'],
///   projectId:   widget.projectId,
///   entityLabel: task['title'],
/// )
/// ```
class AddToTodoButton extends StatelessWidget {
  final String entityType;   // one of TodoEntityType.*
  final String entityId;
  final String projectId;
  final String? entityLabel;
  final bool mini;

  const AddToTodoButton({
    super.key,
    required this.entityType,
    required this.entityId,
    required this.projectId,
    this.entityLabel,
    this.mini = false,
  });

  void _open(BuildContext context) {
    HapticFeedback.selectionClick();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => TodoCreateModalWrapper(
        prelinkedEntity: TodoLink(
          id:          '',
          todoId:      '',
          entityType:  entityType,
          entityId:    entityId,
          projectId:   projectId,
          entityLabel: entityLabel,
        ),
        prefilledName: entityLabel != null
            ? '${TodoEntityType.label(entityType)}: $entityLabel'
            : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (mini) {
      return IconButton(
        tooltip: 'Zu ToDo hinzufügen',
        onPressed: () => _open(context),
        icon: const Icon(LucideIcons.clipboardList, size: 18),
        color: AppColors.textSecondary,
        padding: EdgeInsets.zero,
        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
      );
    }

    return OutlinedButton.icon(
      onPressed: () => _open(context),
      icon: const Icon(LucideIcons.clipboardList, size: 15),
      label: const Text('Zu ToDo hinzufügen'),
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primary,
        side: const BorderSide(color: AppColors.border),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        textStyle:
            const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }
}
