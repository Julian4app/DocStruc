import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../models/todo_model.dart';
import '../providers/todo_provider.dart';
import '../services/todo_service.dart';
import '../../../core/theme/app_colors.dart';

// ─────────────────────────────────────────────────────────────────────────────
// TodoCreateModal
// ─────────────────────────────────────────────────────────────────────────────

class TodoCreateModal extends ConsumerStatefulWidget {
  /// Pre-linked entity (e.g. tapped "Add to ToDo" in Defects page)
  final TodoLink? prelinkedEntity;
  final String?   prefilledName;

  const TodoCreateModal({super.key, this.prelinkedEntity, this.prefilledName});

  @override
  ConsumerState<TodoCreateModal> createState() => _TodoCreateModalState();
}

class _TodoCreateModalState extends ConsumerState<TodoCreateModal> {
  final _formKey    = GlobalKey<FormState>();
  final _nameCtr    = TextEditingController();
  final _descCtr    = TextEditingController();
  final _locCtr     = TextEditingController();

  DateTime?          _dueDate;
  ShareableUser?     _sharedWith;
  List<ShareableUser> _shareableUsers = [];
  List<Map<String, dynamic>> _projects = [];
  String?            _selectedProjectId;
  bool               _saving = false;

  @override
  void initState() {
    super.initState();
    if (widget.prefilledName != null) _nameCtr.text = widget.prefilledName!;
    if (widget.prelinkedEntity != null) {
      _selectedProjectId = widget.prelinkedEntity!.projectId;
    }
    _loadProjects();
  }

  Future<void> _loadProjects() async {
    final projects = await TodoService.getUserProjects();
    if (!mounted) return;
    setState(() => _projects = projects);
    // if a project is pre-selected, load shareable users
    if (_selectedProjectId != null) {
      _loadShareableUsers(_selectedProjectId!);
    }
  }

  Future<void> _loadShareableUsers(String projectId) async {
    final users = await TodoService.getShareableUsers(projectId);
    if (!mounted) return;
    setState(() {
      _shareableUsers = users;
      _sharedWith = null;
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dueDate ?? DateTime.now().add(const Duration(days: 1)),
      firstDate:   DateTime.now().subtract(const Duration(days: 1)),
      lastDate:    DateTime.now().add(const Duration(days: 365 * 5)),
      locale:      const Locale('de', 'DE'),
    );
    if (picked != null) setState(() => _dueDate = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    final links = widget.prelinkedEntity != null ? [widget.prelinkedEntity!] : <TodoLink>[];

    final todo = await ref.read(todoProvider.notifier).createTodo(
      name:              _nameCtr.text.trim(),
      description:       _descCtr.text.trim().isEmpty ? null : _descCtr.text.trim(),
      dueDate:           _dueDate?.toIso8601String(),
      location:          _locCtr.text.trim().isEmpty ? null : _locCtr.text.trim(),
      sharedWithUserId:  _sharedWith?.userId,
      links:             links,
    );

    if (!mounted) return;
    setState(() => _saving = false);

    if (todo != null) {
      Navigator.pop(context, todo);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('ToDo erstellt ✓'), behavior: SnackBarBehavior.floating),
      );
    }
  }

  @override
  void dispose() {
    _nameCtr.dispose();
    _descCtr.dispose();
    _locCtr.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _TodoModalShell(
        title:   'Neues ToDo',
        saving:  _saving,
        onSave:  _save,
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Name
              _ModalField(
                label: 'Titel *',
                child: TextFormField(
                  controller: _nameCtr,
                  decoration: _inputDeco('Aufgabe benennen…'),
                  validator: (v) => v == null || v.trim().isEmpty ? 'Pflichtfeld' : null,
                  textCapitalization: TextCapitalization.sentences,
                ),
              ),

              // Description
              _ModalField(
                label: 'Beschreibung',
                child: TextFormField(
                  controller: _descCtr,
                  decoration: _inputDeco('Details, Notizen…'),
                  maxLines: 4,
                  textCapitalization: TextCapitalization.sentences,
                ),
              ),

              // Due date
              _ModalField(
                label: 'Fälligkeitsdatum',
                child: GestureDetector(
                  onTap: _pickDate,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        const Icon(LucideIcons.calendar, size: 16, color: AppColors.textSecondary),
                        const SizedBox(width: 10),
                        Text(
                          _dueDate != null
                              ? DateFormat('dd.MM.yyyy').format(_dueDate!)
                              : 'Datum wählen',
                          style: TextStyle(
                            color: _dueDate != null ? AppColors.text : AppColors.textTertiary,
                          ),
                        ),
                        const Spacer(),
                        if (_dueDate != null)
                          GestureDetector(
                            onTap: () => setState(() => _dueDate = null),
                            child: const Icon(LucideIcons.x, size: 14, color: AppColors.textTertiary),
                          ),
                      ],
                    ),
                  ),
                ),
              ),

              // Location
              _ModalField(
                label: 'Ort / Standort',
                child: TextFormField(
                  controller: _locCtr,
                  decoration: _inputDeco('z.B. Baustelle, Raum 3.2'),
                ),
              ),

              // Project picker (to enable sharing)
              if (_projects.isNotEmpty)
                _ModalField(
                  label: 'Projekt (für Teilen)',
                  child: DropdownButtonFormField<String>(
                    value: _selectedProjectId,
                    decoration: _inputDeco('Projekt wählen…'),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('— kein Projekt —')),
                      ..._projects.map((p) => DropdownMenuItem(
                            value: p['id'] as String,
                            child: Text(p['name'] as String? ?? p['id']),
                          )),
                    ],
                    onChanged: (v) {
                      setState(() {
                        _selectedProjectId = v;
                        _sharedWith = null;
                        _shareableUsers = [];
                      });
                      if (v != null) _loadShareableUsers(v);
                    },
                  ),
                ),

              // Share with colleague
              if (_selectedProjectId != null && _shareableUsers.isNotEmpty)
                _ModalField(
                  label: 'Teilen mit Kollegen',
                  child: DropdownButtonFormField<String?>(
                    value: _sharedWith?.userId,
                    decoration: _inputDeco('Kollegen wählen…'),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('— nicht teilen —')),
                      ..._shareableUsers.map((u) => DropdownMenuItem(
                            value: u.userId,
                            child: Text(u.displayName),
                          )),
                    ],
                    onChanged: (v) => setState(() {
                      _sharedWith = v != null
                          ? _shareableUsers.firstWhere((u) => u.userId == v)
                          : null;
                    }),
                  ),
                ),

              // Pre-linked entity badge
              if (widget.prelinkedEntity != null)
                _ModalField(
                  label: 'Verknüpftes Element',
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.info.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.info.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(LucideIcons.link2, size: 15, color: AppColors.info),
                        const SizedBox(width: 8),
                        Text(
                          TodoEntityType.label(widget.prelinkedEntity!.entityType),
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              color: AppColors.info),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// TodoEditModal
// ─────────────────────────────────────────────────────────────────────────────

class TodoEditModal extends ConsumerStatefulWidget {
  final TodoModel todo;
  const TodoEditModal({super.key, required this.todo});

  @override
  ConsumerState<TodoEditModal> createState() => _TodoEditModalState();
}

class _TodoEditModalState extends ConsumerState<TodoEditModal> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameCtr;
  late final TextEditingController _descCtr;
  late final TextEditingController _locCtr;

  late String    _status;
  DateTime?      _dueDate;
  ShareableUser? _sharedWith;
  List<ShareableUser> _shareableUsers = [];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _nameCtr = TextEditingController(text: widget.todo.name);
    _descCtr = TextEditingController(text: widget.todo.description ?? '');
    _locCtr  = TextEditingController(text: widget.todo.location ?? '');
    _status  = widget.todo.status;
    _dueDate = widget.todo.dueDate;
    _loadUsersFromLinks();
  }

  Future<void> _loadUsersFromLinks() async {
    final projectIds = widget.todo.links.map((l) => l.projectId).toSet();
    if (projectIds.isEmpty) return;
    final users = await TodoService.getShareableUsers(projectIds.first);
    if (!mounted) return;
    setState(() {
      _shareableUsers = users;
      _sharedWith = widget.todo.sharedWithUserId != null
          ? users.where((u) => u.userId == widget.todo.sharedWithUserId).firstOrNull
          : null;
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dueDate ?? DateTime.now().add(const Duration(days: 1)),
      firstDate:   DateTime.now().subtract(const Duration(days: 1)),
      lastDate:    DateTime.now().add(const Duration(days: 365 * 5)),
      locale:      const Locale('de', 'DE'),
    );
    if (picked != null) setState(() => _dueDate = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    final ok = await ref.read(todoProvider.notifier).updateTodo(
      id:               widget.todo.id,
      name:             _nameCtr.text.trim(),
      description:      _descCtr.text.trim().isEmpty ? null : _descCtr.text.trim(),
      status:           _status,
      dueDate:          _dueDate?.toIso8601String(),
      clearDueDate:     _dueDate == null,
      location:         _locCtr.text.trim().isEmpty ? null : _locCtr.text.trim(),
      sharedWithUserId: _sharedWith?.userId,
      clearShared:      _sharedWith == null,
    );

    if (!mounted) return;
    setState(() => _saving = false);
    if (ok) {
      Navigator.pop(context);
    }
  }

  @override
  void dispose() {
    _nameCtr.dispose();
    _descCtr.dispose();
    _locCtr.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _TodoModalShell(
        title:  'ToDo bearbeiten',
        saving: _saving,
        onSave: _save,
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Name
              _ModalField(
                label: 'Titel *',
                child: TextFormField(
                  controller: _nameCtr,
                  decoration: _inputDeco('Aufgabe benennen…'),
                  validator: (v) => v == null || v.trim().isEmpty ? 'Pflichtfeld' : null,
                  textCapitalization: TextCapitalization.sentences,
                ),
              ),

              // Status
              _ModalField(
                label: 'Status',
                child: _StatusSelector(
                  current: _status,
                  onChanged: (s) => setState(() => _status = s),
                ),
              ),

              // Description
              _ModalField(
                label: 'Beschreibung',
                child: TextFormField(
                  controller: _descCtr,
                  decoration: _inputDeco('Details, Notizen…'),
                  maxLines: 4,
                  textCapitalization: TextCapitalization.sentences,
                ),
              ),

              // Due date
              _ModalField(
                label: 'Fälligkeitsdatum',
                child: GestureDetector(
                  onTap: _pickDate,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        const Icon(LucideIcons.calendar, size: 16, color: AppColors.textSecondary),
                        const SizedBox(width: 10),
                        Text(
                          _dueDate != null
                              ? DateFormat('dd.MM.yyyy').format(_dueDate!)
                              : 'Datum wählen',
                          style: TextStyle(
                            color: _dueDate != null ? AppColors.text : AppColors.textTertiary,
                          ),
                        ),
                        const Spacer(),
                        if (_dueDate != null)
                          GestureDetector(
                            onTap: () => setState(() => _dueDate = null),
                            child: const Icon(LucideIcons.x, size: 14, color: AppColors.textTertiary),
                          ),
                      ],
                    ),
                  ),
                ),
              ),

              // Location
              _ModalField(
                label: 'Ort / Standort',
                child: TextFormField(
                  controller: _locCtr,
                  decoration: _inputDeco('z.B. Baustelle, Raum 3.2'),
                ),
              ),

              // Share with colleague
              if (_shareableUsers.isNotEmpty)
                _ModalField(
                  label: 'Teilen mit Kollegen',
                  child: DropdownButtonFormField<String?>(
                    value: _sharedWith?.userId,
                    decoration: _inputDeco('Kollegen wählen…'),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('— nicht teilen —')),
                      ..._shareableUsers.map((u) => DropdownMenuItem(
                            value: u.userId,
                            child: Text(u.displayName),
                          )),
                    ],
                    onChanged: (v) => setState(() {
                      _sharedWith = v != null
                          ? _shareableUsers.firstWhere((u) => u.userId == v)
                          : null;
                    }),
                  ),
                ),

              // Links
              if (widget.todo.links.isNotEmpty) ...[
                _ModalField(
                  label: 'Verknüpfte Elemente',
                  child: Column(
                    children: widget.todo.links.map((link) => Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.info.withValues(alpha: 0.07),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.info.withValues(alpha: 0.25)),
                      ),
                      child: Row(
                        children: [
                          const Icon(LucideIcons.link2, size: 13, color: AppColors.info),
                          const SizedBox(width: 6),
                          Expanded(child: Text(
                            TodoEntityType.label(link.entityType),
                            style: const TextStyle(fontSize: 13, color: AppColors.info),
                          )),
                        ],
                      ),
                    )).toList(),
                  ),
                ),
              ],
            ],
          ),
        ),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared modal shell
// ─────────────────────────────────────────────────────────────────────────────

class _TodoModalShell extends StatelessWidget {
  final String title;
  final bool saving;
  final VoidCallback onSave;
  final Widget child;

  const _TodoModalShell({
    required this.title,
    required this.saving,
    required this.onSave,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final isDark  = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color:        isDark ? const Color(0xFF1C1C1E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Handle ─────────────────────────────────────────────────
          const SizedBox(height: 12),
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // ── Header ─────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Text(title,
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.text)),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(LucideIcons.x, size: 20, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // ── Body ───────────────────────────────────────────────────
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(20, 16, 20, 16 + bottom),
              child: child,
            ),
          ),

          // ── Save button ────────────────────────────────────────────
          Padding(
            padding: EdgeInsets.fromLTRB(20, 8, 20, 20 + bottom),
            child: SizedBox(
              width: double.infinity,
              height: 50,
              child: FilledButton(
                onPressed: saving ? null : onSave,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                child: saving
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text('Speichern',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status selector widget
// ─────────────────────────────────────────────────────────────────────────────

class _StatusSelector extends StatelessWidget {
  final String current;
  final ValueChanged<String> onChanged;

  const _StatusSelector({required this.current, required this.onChanged});

  @override
  Widget build(BuildContext context) => Row(
        children: TodoStatus.all.map((s) {
          final active = s == current;
          final color  = _statusColor(s);
          return Expanded(
            child: GestureDetector(
              onTap: () => onChanged(s),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                margin: const EdgeInsets.only(right: 4),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: active ? color : color.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: active ? color : Colors.transparent,
                  ),
                ),
                child: Center(
                  child: Text(
                    TodoStatus.label(s),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: active ? Colors.white : color,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      );

  Color _statusColor(String s) {
    switch (s) {
      case TodoStatus.inProgress: return AppColors.info;
      case TodoStatus.waiting:    return AppColors.warning;
      case TodoStatus.done:       return AppColors.success;
      default:                    return AppColors.textTertiary;
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

class _ModalField extends StatelessWidget {
  final String label;
  final Widget child;
  const _ModalField({required this.label, required this.child});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                    letterSpacing: 0.3)),
            const SizedBox(height: 6),
            child,
          ],
        ),
      );
}

InputDecoration _inputDeco(String hint) => InputDecoration(
      hintText:    hint,
      hintStyle:   const TextStyle(color: AppColors.textTertiary),
      filled:      true,
      fillColor:   AppColors.surfaceVariant,
      border:      OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide:   const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide:   const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide:   const BorderSide(color: AppColors.primary, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
    );
