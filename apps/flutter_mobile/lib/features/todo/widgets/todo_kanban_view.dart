import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/todo_model.dart';
import '../providers/todo_provider.dart';
import '../widgets/todo_card.dart';
import '../widgets/todo_edit_modal.dart';
import '../../../core/theme/app_colors.dart';

// Column config
const _columns = [
  (status: TodoStatus.open,       label: 'Offen',          color: Color(0xFF94A3B8)),
  (status: TodoStatus.inProgress, label: 'In Bearbeitung', color: Color(0xFF3B82F6)),
  (status: TodoStatus.waiting,    label: 'Wartend',        color: Color(0xFFF59E0B)),
  (status: TodoStatus.done,       label: 'Erledigt',       color: Color(0xFF10B981)),
];

class TodoKanbanView extends ConsumerStatefulWidget {
  final Map<String, List<TodoModel>> columns;

  const TodoKanbanView({super.key, required this.columns});

  @override
  ConsumerState<TodoKanbanView> createState() => _TodoKanbanViewState();
}

class _TodoKanbanViewState extends ConsumerState<TodoKanbanView> {
  String? _draggingId;
  String? _draggingFromStatus;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: double.infinity,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemCount: _columns.length,
        itemBuilder: (context, ci) {
          final col = _columns[ci];
          final items = widget.columns[col.status] ?? [];
          return _KanbanColumn(
            status:      col.status,
            label:       col.label,
            color:       col.color,
            todos:       items,
            draggingId:  _draggingId,
            onDragStart: (id, status) => setState(() {
              _draggingId = id;
              _draggingFromStatus = status;
            }),
            onDragEnd: () => setState(() {
              _draggingId = null;
              _draggingFromStatus = null;
            }),
            onAccept: (todoId) {
              if (_draggingFromStatus != col.status) {
                HapticFeedback.mediumImpact();
                ref.read(todoProvider.notifier).moveTodo(todoId, col.status);
              }
              setState(() {
                _draggingId = null;
                _draggingFromStatus = null;
              });
            },
            onEdit: (todo) => showModalBottomSheet(
              context: context,
              isScrollControlled: true,
              backgroundColor: Colors.transparent,
              builder: (_) => TodoEditModal(todo: todo),
            ),
            onDelete: (todo) => ref.read(todoProvider.notifier).deleteTodo(todo.id),
            onMarkDone: (todo) => ref.read(todoProvider.notifier).markDone(todo.id),
          );
        },
      ),
    );
  }
}

// ── Single Kanban column ──────────────────────────────────────────────────────

class _KanbanColumn extends StatelessWidget {
  final String status;
  final String label;
  final Color color;
  final List<TodoModel> todos;
  final String? draggingId;
  final void Function(String id, String status) onDragStart;
  final VoidCallback onDragEnd;
  final ValueChanged<String> onAccept;
  final void Function(TodoModel) onEdit;
  final void Function(TodoModel) onDelete;
  final void Function(TodoModel) onMarkDone;

  const _KanbanColumn({
    required this.status,
    required this.label,
    required this.color,
    required this.todos,
    required this.draggingId,
    required this.onDragStart,
    required this.onDragEnd,
    required this.onAccept,
    required this.onEdit,
    required this.onDelete,
    required this.onMarkDone,
  });

  @override
  Widget build(BuildContext context) {
    final isDark      = Theme.of(context).brightness == Brightness.dark;
    final colBg       = isDark ? const Color(0xFF1C1C1E) : const Color(0xFFF8FAFC);
    final isDropTarget = draggingId != null;

    return DragTarget<String>(
      onWillAcceptWithDetails: (details) => true,
      onAcceptWithDetails:     (details) => onAccept(details.data),
      builder: (context, candidateData, rejectedData) {
        final isHovered = candidateData.isNotEmpty;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: 260,
          decoration: BoxDecoration(
            color: isHovered
                ? color.withValues(alpha: 0.07)
                : colBg,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isHovered
                  ? color.withValues(alpha: 0.5)
                  : AppColors.border.withValues(alpha: 0.5),
              width: isHovered ? 2 : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Column header ────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
                child: Row(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color:  color,
                        shape:  BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      label,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.text,
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '${todos.length}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: color,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // ── Cards ────────────────────────────────────────────────
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(8, 4, 8, 16),
                  itemCount: todos.length,
                  itemBuilder: (context, i) {
                    final todo = todos[i];
                    return Draggable<String>(
                      data: todo.id,
                      feedback: Material(
                        color: Colors.transparent,
                        child: SizedBox(
                          width: 244,
                          child: Opacity(
                            opacity: 0.85,
                            child: TodoCard(todo: todo, compact: true),
                          ),
                        ),
                      ),
                      childWhenDragging: Opacity(
                        opacity: 0.3,
                        child: _KanbanCard(
                          todo:       todo,
                          onEdit:     () => onEdit(todo),
                          onDelete:   () => onDelete(todo),
                          onMarkDone: () => onMarkDone(todo),
                        ),
                      ),
                      onDragStarted:   () => onDragStart(todo.id, todo.status),
                      onDragEnd:       (_) => onDragEnd(),
                      onDraggableCanceled: (_, __) => onDragEnd(),
                      child: _KanbanCard(
                        todo:       todo,
                        onEdit:     () => onEdit(todo),
                        onDelete:   () => onDelete(todo),
                        onMarkDone: () => onMarkDone(todo),
                      ),
                    );
                  },
                ),
              ),

              // ── Drop hint ─────────────────────────────────────────────
              if (isDropTarget && !isHovered)
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 0, 8, 10),
                  child: Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: color.withValues(alpha: 0.25),
                          style: BorderStyle.solid),
                    ),
                    child: Center(
                      child: Text(
                        'Hierher ziehen',
                        style: TextStyle(
                          fontSize: 12,
                          color: color,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

// ── Compact card for Kanban ───────────────────────────────────────────────────

class _KanbanCard extends StatelessWidget {
  final TodoModel todo;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onMarkDone;

  const _KanbanCard({
    required this.todo,
    required this.onEdit,
    required this.onDelete,
    required this.onMarkDone,
  });

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: TodoCard(
          todo:       todo,
          compact:    false,
          onTap:      onEdit,
          onEdit:     onEdit,
          onDelete:   onDelete,
          onMarkDone: onMarkDone,
        ),
      );
}
