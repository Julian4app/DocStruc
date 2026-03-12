import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../models/todo_model.dart';
import '../../../core/theme/app_colors.dart';

// ── Status chip ───────────────────────────────────────────────────────────────

Color _statusColor(String s) {
  switch (s) {
    case TodoStatus.inProgress: return AppColors.info;
    case TodoStatus.waiting:    return AppColors.warning;
    case TodoStatus.done:       return AppColors.success;
    default:                    return AppColors.textTertiary;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class TodoCard extends StatelessWidget {
  final TodoModel todo;
  final bool compact;
  final VoidCallback? onTap;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final VoidCallback? onMarkDone;

  const TodoCard({
    super.key,
    required this.todo,
    this.compact = false,
    this.onTap,
    this.onEdit,
    this.onDelete,
    this.onMarkDone,
  });

  @override
  Widget build(BuildContext context) {
    final isDark      = Theme.of(context).brightness == Brightness.dark;
    final cardColor   = isDark ? const Color(0xFF1C1C1E) : Colors.white;
    final statusColor = _statusColor(todo.status);

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
        decoration: BoxDecoration(
          color:        cardColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: todo.isOverdue
                ? AppColors.danger.withValues(alpha: 0.4)
                : AppColors.border.withValues(alpha: 0.6),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Status bar ──────────────────────────────────────────────
            Container(
              height: 4,
              decoration: BoxDecoration(
                color: statusColor,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Header row ────────────────────────────────────────
                  Row(
                    children: [
                      // Done checkbox
                      GestureDetector(
                        onTap: onMarkDone,
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            color: todo.isDone
                                ? AppColors.success
                                : Colors.transparent,
                            border: Border.all(
                              color: todo.isDone
                                  ? AppColors.success
                                  : AppColors.border,
                              width: 2,
                            ),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: todo.isDone
                              ? const Icon(LucideIcons.check, size: 13, color: Colors.white)
                              : null,
                        ),
                      ),
                      const SizedBox(width: 10),
                      // Title
                      Expanded(
                        child: Text(
                          todo.name,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: todo.isDone
                                ? AppColors.textTertiary
                                : AppColors.text,
                            decoration: todo.isDone
                                ? TextDecoration.lineThrough
                                : null,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      // Actions menu
                      _CardMenu(
                        onEdit:     onEdit,
                        onDelete:   onDelete,
                        onMarkDone: onMarkDone,
                        isDone:     todo.isDone,
                      ),
                    ],
                  ),

                  if (!compact) ...[
                    const SizedBox(height: 10),
                    // ── Meta row ──────────────────────────────────────────
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      children: [
                        // Due date
                        if (todo.dueDate != null)
                          _Chip(
                            icon: LucideIcons.calendar,
                            label: DateFormat('dd.MM.yy').format(todo.dueDate!),
                            color: todo.isOverdue ? AppColors.danger : AppColors.textSecondary,
                          ),
                        // Location
                        if (todo.location != null && todo.location!.isNotEmpty)
                          _Chip(
                            icon: LucideIcons.mapPin,
                            label: todo.location!,
                            color: AppColors.textSecondary,
                          ),
                        // Links count
                        if (todo.links.isNotEmpty)
                          _Chip(
                            icon: LucideIcons.link2,
                            label: '${todo.links.length} Verknüpfung${todo.links.length > 1 ? 'en' : ''}',
                            color: AppColors.info,
                          ),
                        // Status badge
                        _StatusBadge(status: todo.status),
                      ],
                    ),
                    // ── Shared user ───────────────────────────────────────
                    if (todo.isShared && todo.sharedWithName != null) ...[
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          _Avatar(
                            name:      todo.sharedWithName!,
                            avatarUrl: todo.sharedWithAvatar,
                            size:      20,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'Geteilt mit ${todo.sharedWithName}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Small building blocks ─────────────────────────────────────────────────────

class _Chip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _Chip({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 12, color: color)),
        ],
      );
}

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color:        color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        TodoStatus.label(status),
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  final String name;
  final String? avatarUrl;
  final double size;
  const _Avatar({required this.name, this.avatarUrl, this.size = 28});

  String get _initials {
    final p = name.split(' ');
    if (p.length >= 2) return '${p[0][0]}${p[1][0]}'.toUpperCase();
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }

  @override
  Widget build(BuildContext context) => CircleAvatar(
        radius: size / 2,
        backgroundImage: avatarUrl != null ? NetworkImage(avatarUrl!) : null,
        backgroundColor: AppColors.primary.withValues(alpha: 0.15),
        child: avatarUrl == null
            ? Text(_initials,
                style: TextStyle(
                    fontSize: size * 0.38,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary))
            : null,
      );
}

class _CardMenu extends StatelessWidget {
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final VoidCallback? onMarkDone;
  final bool isDone;

  const _CardMenu({
    this.onEdit,
    this.onDelete,
    this.onMarkDone,
    required this.isDone,
  });

  @override
  Widget build(BuildContext context) => PopupMenuButton<String>(
        icon: const Icon(LucideIcons.moreHorizontal, size: 18, color: AppColors.textTertiary),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        itemBuilder: (_) => [
          if (!isDone)
            const PopupMenuItem(value: 'done',  child: Text('Als erledigt markieren')),
          const PopupMenuItem(value: 'edit',   child: Text('Bearbeiten')),
          const PopupMenuItem(
            value: 'delete',
            child: Text('Löschen', style: TextStyle(color: AppColors.danger)),
          ),
        ],
        onSelected: (v) {
          if (v == 'edit')   onEdit?.call();
          if (v == 'delete') onDelete?.call();
          if (v == 'done')   onMarkDone?.call();
        },
      );
}

// ── Exported avatar for reuse ─────────────────────────────────────────────────
class TodoAvatar extends StatelessWidget {
  final String name;
  final String? avatarUrl;
  final double size;
  const TodoAvatar({super.key, required this.name, this.avatarUrl, this.size = 28});

  @override
  Widget build(BuildContext context) =>
      _Avatar(name: name, avatarUrl: avatarUrl, size: size);
}
