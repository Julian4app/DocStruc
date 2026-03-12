import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../models/todo_model.dart';
import '../providers/todo_provider.dart';
import '../widgets/todo_list_view.dart';
import '../widgets/todo_kanban_view.dart';
import '../widgets/todo_edit_modal.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/lottie_loader.dart';

class TodoPage extends ConsumerStatefulWidget {
  const TodoPage({super.key});

  @override
  ConsumerState<TodoPage> createState() => _TodoPageState();
}

class _TodoPageState extends ConsumerState<TodoPage>
    with SingleTickerProviderStateMixin {
  bool _kanbanMode    = false;
  String? _statusFilter;
  final _scrollCtrl   = ScrollController();
  late AnimationController _fabAnim;

  @override
  void initState() {
    super.initState();
    _fabAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    )..forward();
    _scrollCtrl.addListener(_onScroll);
  }

  void _onScroll() {
    final state = ref.read(todoProvider);
    if (_scrollCtrl.position.pixels >=
            _scrollCtrl.position.maxScrollExtent - 200 &&
        !state.loadingMore &&
        state.hasMore) {
      ref.read(todoProvider.notifier).load();
    }
  }

  @override
  void dispose() {
    _fabAnim.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _openCreate() {
    HapticFeedback.mediumImpact();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const TodoCreateModalWrapper(),
    );
  }

  void _setFilter(String? status) {
    setState(() => _statusFilter = status);
    ref.read(todoProvider.notifier).setStatusFilter(status);
  }

  @override
  Widget build(BuildContext context) {
    final state  = ref.watch(todoProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header ──────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              child: Row(
                children: [
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Meine ToDos',
                            style: TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.w800,
                                color: AppColors.text,
                                letterSpacing: -0.5)),
                        SizedBox(height: 2),
                        Text('Persönliche Aufgabenliste',
                            style: TextStyle(
                                fontSize: 13, color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                  // View toggle
                  _ViewToggle(
                    kanban: _kanbanMode,
                    onToggle: (v) => setState(() => _kanbanMode = v),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ── Status filter chips ──────────────────────────────────────
            SizedBox(
              height: 36,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  _FilterChip(
                    label: 'Alle',
                    active: _statusFilter == null,
                    onTap: () => _setFilter(null),
                    count: state.todos.length,
                  ),
                  ...TodoStatus.all.map((s) => _FilterChip(
                        label: TodoStatus.label(s),
                        active: _statusFilter == s,
                        onTap: () => _setFilter(s == _statusFilter ? null : s),
                        count: state.todos.where((t) => t.status == s).length,
                      )),
                ],
              ),
            ),

            const SizedBox(height: 8),

            // ── Body ─────────────────────────────────────────────────────
            Expanded(
              child: state.loading
                  ? const Center(child: LottieLoader())
                  : state.error != null
                      ? _ErrorState(
                          message: state.error!,
                          onRetry: () =>
                              ref.read(todoProvider.notifier).refresh(),
                        )
                      : RefreshIndicator(
                          onRefresh: () =>
                              ref.read(todoProvider.notifier).refresh(),
                          child: _kanbanMode
                              ? TodoKanbanView(
                                  columns: state.kanbanColumns)
                              : TodoListView(
                                  todos: state.todos,
                                  scrollController: _scrollCtrl,
                                ),
                        ),
            ),

            // Load-more indicator
            if (state.loadingMore)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator()),
              ),
          ],
        ),
      ),

      // ── FAB ──────────────────────────────────────────────────────────
      floatingActionButton: ScaleTransition(
        scale: CurvedAnimation(parent: _fabAnim, curve: Curves.elasticOut),
        child: FloatingActionButton.extended(
          onPressed: _openCreate,
          backgroundColor: AppColors.primary,
          icon: const Icon(LucideIcons.plus, color: Colors.white, size: 20),
          label: const Text('Neues ToDo',
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w600)),
          elevation: 4,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
    );
  }
}

// ── Wrapper that imports TodoCreateModal (avoids circular imports) ─────────────

class TodoCreateModalWrapper extends StatelessWidget {
  final TodoLink? prelinkedEntity;
  final String?   prefilledName;

  const TodoCreateModalWrapper({
    super.key,
    this.prelinkedEntity,
    this.prefilledName,
  });

  @override
  Widget build(BuildContext context) {
    // Import deferred to keep widget file clean
    return _CreateModalInner(
      prelinkedEntity: prelinkedEntity,
      prefilledName:   prefilledName,
    );
  }
}

// Inline to avoid a separate file just for re-export
class _CreateModalInner extends ConsumerStatefulWidget {
  final TodoLink? prelinkedEntity;
  final String?   prefilledName;
  const _CreateModalInner({this.prelinkedEntity, this.prefilledName});
  @override
  ConsumerState<_CreateModalInner> createState() => _CreateModalInnerState();
}

class _CreateModalInnerState extends ConsumerState<_CreateModalInner> {
  @override
  Widget build(BuildContext context) {
    // Delegate to TodoCreateModal from todo_edit_modal.dart
    return TodoCreateModal(
      prelinkedEntity: widget.prelinkedEntity,
      prefilledName:   widget.prefilledName,
    );
  }
}

// ── View toggle ───────────────────────────────────────────────────────────────

class _ViewToggle extends StatelessWidget {
  final bool kanban;
  final ValueChanged<bool> onToggle;
  const _ViewToggle({required this.kanban, required this.onToggle});

  @override
  Widget build(BuildContext context) => Container(
        height: 36,
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: AppColors.border.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _ToggleBtn(
              icon: LucideIcons.list,
              active: !kanban,
              onTap: () => onToggle(false),
            ),
            _ToggleBtn(
              icon: LucideIcons.layoutDashboard,
              active: kanban,
              onTap: () => onToggle(true),
            ),
          ],
        ),
      );
}

class _ToggleBtn extends StatelessWidget {
  final IconData icon;
  final bool active;
  final VoidCallback onTap;
  const _ToggleBtn({required this.icon, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: 34,
          height: 30,
          decoration: BoxDecoration(
            color: active ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(7),
            boxShadow: active
                ? [
                    BoxShadow(
                        color: Colors.black.withValues(alpha: 0.08),
                        blurRadius: 4,
                        offset: const Offset(0, 1))
                  ]
                : null,
          ),
          child: Center(
            child: Icon(
              icon,
              size: 16,
              color: active ? AppColors.primary : AppColors.textTertiary,
            ),
          ),
        ),
      );
}

// ── Filter chip ───────────────────────────────────────────────────────────────

class _FilterChip extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  final int count;
  const _FilterChip(
      {required this.label,
      required this.active,
      required this.onTap,
      required this.count});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          margin: const EdgeInsets.only(right: 8),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color:  active ? AppColors.primary : Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: active ? AppColors.primary : AppColors.border,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: active ? Colors.white : AppColors.textSecondary,
                ),
              ),
              const SizedBox(width: 5),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: active
                      ? Colors.white.withValues(alpha: 0.2)
                      : AppColors.border,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: active ? Colors.white : AppColors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
}

// ── Error state ───────────────────────────────────────────────────────────────

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(LucideIcons.alertCircle,
                  size: 40, color: AppColors.danger),
              const SizedBox(height: 12),
              Text(message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.textSecondary)),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: onRetry,
                style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
                child: const Text('Erneut versuchen'),
              ),
            ],
          ),
        ),
      );
}
