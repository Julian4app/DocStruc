import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:intl/intl.dart';

import '../../../core/services/supabase_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/burger_menu_leading.dart';

// ── Priority helpers ─────────────────────────────────────────────────────────
const _priorities = [
  {'value': 'low', 'label': 'Niedrig', 'color': Color(0xFF10B981)},
  {'value': 'medium', 'label': 'Mittel', 'color': Color(0xFFF59E0B)},
  {'value': 'high', 'label': 'Hoch', 'color': Color(0xFFEF4444)},
  {'value': 'critical', 'label': 'Kritisch', 'color': Color(0xFF991B1B)},
];

Color _priorityColor(String p) {
  switch (p) {
    case 'low':
      return const Color(0xFF10B981);
    case 'high':
      return const Color(0xFFEF4444);
    case 'critical':
      return const Color(0xFF991B1B);
    default:
      return const Color(0xFFF59E0B);
  }
}

String _priorityLabel(String p) {
  switch (p) {
    case 'low':
      return 'Niedrig';
    case 'high':
      return 'Hoch';
    case 'critical':
      return 'Kritisch';
    default:
      return 'Mittel';
  }
}

Color _statusColor(String? s) {
  switch (s) {
    case 'done':
      return AppColors.success;
    case 'in_progress':
      return AppColors.warning;
    case 'blocked':
      return AppColors.danger;
    default:
      return AppColors.textTertiary;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════════════════

enum _ViewMode { list, kanban, calendar }

class ProjectTasksPage extends StatefulWidget {
  final String projectId;
  const ProjectTasksPage({super.key, required this.projectId});

  @override
  State<ProjectTasksPage> createState() => _ProjectTasksPageState();
}

class _ProjectTasksPageState extends State<ProjectTasksPage> {
  bool _loading = true;
  List<Map<String, dynamic>> _tasks = [];
  List<Map<String, dynamic>> _members = [];
  String _statusFilter = 'alle';
  String _priorityFilter = 'alle';
  String _search = '';
  _ViewMode _view = _ViewMode.list;
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        SupabaseService.getTasks(widget.projectId, taskType: 'task'),
        SupabaseService.getProjectMembers(widget.projectId),
      ]);
      if (mounted) {
        setState(() {
          _tasks = (results[0] as List).cast<Map<String, dynamic>>();
          _members = (results[1] as List).cast<Map<String, dynamic>>();
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filtered {
    var list = _tasks;
    if (_statusFilter != 'alle') {
      list = list.where((t) => t['status'] == _statusFilter).toList();
    }
    if (_priorityFilter != 'alle') {
      list = list.where((t) => t['priority'] == _priorityFilter).toList();
    }
    if (_search.isNotEmpty) {
      final q = _search.toLowerCase();
      list = list
          .where(
              (t) => (t['title'] ?? '').toString().toLowerCase().contains(q))
          .toList();
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: burgerMenuLeading(context),
        title: const Text('Aufgaben'),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showCreateSheet(context),
        backgroundColor: AppColors.primary,
        child: const Icon(LucideIcons.plus, color: Colors.white),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // ── Search ──
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: TextField(
                    controller: _searchCtrl,
                    onChanged: (v) => setState(() => _search = v),
                    decoration: InputDecoration(
                      hintText: 'Aufgaben durchsuchen…',
                      prefixIcon:
                          const Icon(LucideIcons.search, size: 18),
                      suffixIcon: _search.isNotEmpty
                          ? IconButton(
                              icon: const Icon(LucideIcons.x, size: 18),
                              onPressed: () {
                                _searchCtrl.clear();
                                setState(() => _search = '');
                              },
                            )
                          : null,
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                // ── View Switcher ──
                _buildViewSwitcher(),
                const SizedBox(height: 8),

                // ── Status Filters ──
                SizedBox(
                  height: 36,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    children: [
                      _buildFilterChip('alle', 'Alle', isStatus: true),
                      _buildFilterChip('open', 'Offen', isStatus: true),
                      _buildFilterChip('in_progress', 'In Bearbeitung',
                          isStatus: true),
                      _buildFilterChip('done', 'Erledigt', isStatus: true),
                      _buildFilterChip('blocked', 'Blockiert',
                          isStatus: true),
                    ],
                  ),
                ),
                const SizedBox(height: 6),

                // ── Priority Filters ──
                SizedBox(
                  height: 36,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    children: [
                      _buildFilterChip('alle', 'Alle Prioritäten',
                          isStatus: false),
                      _buildFilterChip('low', 'Niedrig',
                          isStatus: false,
                          dotColor: const Color(0xFF10B981)),
                      _buildFilterChip('medium', 'Mittel',
                          isStatus: false,
                          dotColor: const Color(0xFFF59E0B)),
                      _buildFilterChip('high', 'Hoch',
                          isStatus: false,
                          dotColor: const Color(0xFFEF4444)),
                      _buildFilterChip('critical', 'Kritisch',
                          isStatus: false,
                          dotColor: const Color(0xFF991B1B)),
                    ],
                  ),
                ),
                const SizedBox(height: 10),

                // ── Content ──
                Expanded(child: _buildContent()),
              ],
            ),
    );
  }

  // ── View Switcher ─────────────────────────────────────────────────────────
  Widget _buildViewSwitcher() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          _viewTab(LucideIcons.list, 'Liste', _ViewMode.list),
          _viewTab(LucideIcons.columns, 'Kanban', _ViewMode.kanban),
          _viewTab(LucideIcons.calendar, 'Kalender', _ViewMode.calendar),
        ],
      ),
    );
  }

  Widget _viewTab(IconData icon, String label, _ViewMode mode) {
    final active = _view == mode;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _view = mode),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: active ? AppColors.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 15,
                  color: active ? Colors.white : AppColors.textSecondary),
              const SizedBox(width: 6),
              Text(label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                    color:
                        active ? Colors.white : AppColors.textSecondary,
                  )),
            ],
          ),
        ),
      ),
    );
  }

  // ── Filter Chip ───────────────────────────────────────────────────────────
  Widget _buildFilterChip(String value, String label,
      {required bool isStatus, Color? dotColor}) {
    final current = isStatus ? _statusFilter : _priorityFilter;
    final selected = current == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (dotColor != null && value != 'alle') ...[
              Container(
                width: 8,
                height: 8,
                decoration:
                    BoxDecoration(color: dotColor, shape: BoxShape.circle),
              ),
              const SizedBox(width: 6),
            ],
            Text(label,
                style: TextStyle(
                  fontSize: 12,
                  color:
                      selected ? Colors.white : AppColors.textSecondary,
                  fontWeight:
                      selected ? FontWeight.w600 : FontWeight.w500,
                )),
          ],
        ),
        selected: selected,
        selectedColor: AppColors.primary,
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(
              color: selected ? AppColors.primary : AppColors.border),
        ),
        onSelected: (_) {
          setState(() {
            if (isStatus) {
              _statusFilter = value;
            } else {
              _priorityFilter = value;
            }
          });
        },
      ),
    );
  }

  // ── Content Router ────────────────────────────────────────────────────────
  Widget _buildContent() {
    switch (_view) {
      case _ViewMode.kanban:
        return _buildKanban();
      case _ViewMode.calendar:
        return _buildCalendar();
      default:
        return _buildListView();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════════════════════
  Widget _buildListView() {
    final tasks = _filtered;
    return RefreshIndicator(
      onRefresh: _load,
      child: tasks.isEmpty
          ? ListView(children: const [
              SizedBox(height: 100),
              Center(
                child: Column(children: [
                  Icon(LucideIcons.checkSquare,
                      size: 48, color: AppColors.textTertiary),
                  SizedBox(height: 12),
                  Text('Keine Aufgaben',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary)),
                ]),
              ),
            ])
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
              itemCount: tasks.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) =>
                  _TaskCard(tasks[i], members: _members, onRefresh: _load),
            ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // KANBAN VIEW
  // ══════════════════════════════════════════════════════════════════════════
  Widget _buildKanban() {
    final columns = [
      {'key': 'open', 'label': 'Offen', 'color': AppColors.textTertiary},
      {
        'key': 'in_progress',
        'label': 'In Bearbeitung',
        'color': AppColors.warning
      },
      {'key': 'done', 'label': 'Erledigt', 'color': AppColors.success},
      {'key': 'blocked', 'label': 'Blockiert', 'color': AppColors.danger},
    ];
    final tasks = _filtered;

    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: columns.map((col) {
              final key = col['key'] as String;
              final label = col['label'] as String;
              final color = col['color'] as Color;
              final colTasks =
                  tasks.where((t) => t['status'] == key).toList();

              return Container(
                width: 260,
                margin: const EdgeInsets.only(right: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Column header
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(
                                color: color, shape: BoxShape.circle),
                          ),
                          const SizedBox(width: 8),
                          Text(label,
                              style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: color)),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text('${colTasks.length}',
                                style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: color)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    // Cards
                    ...colTasks.map((t) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: _KanbanCard(t),
                        )),
                    if (colTasks.isEmpty)
                      Container(
                        height: 60,
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                              color: AppColors.border,
                              style: BorderStyle.solid),
                        ),
                        child: Center(
                          child: Text('Keine Aufgaben',
                              style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textTertiary)),
                        ),
                      ),
                  ],
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CALENDAR VIEW
  // ══════════════════════════════════════════════════════════════════════════
  Widget _buildCalendar() {
    final now = DateTime.now();
    final firstDay = DateTime(now.year, now.month, 1);
    final lastDay = DateTime(now.year, now.month + 1, 0);
    final startWeekday = firstDay.weekday; // 1=Mon

    // Build map of date -> tasks
    final Map<int, List<Map<String, dynamic>>> tasksByDay = {};
    for (final t in _filtered) {
      final dueStr = t['due_date'] as String?;
      if (dueStr == null) continue;
      try {
        final dt = DateTime.parse(dueStr);
        if (dt.year == now.year && dt.month == now.month) {
          tasksByDay.putIfAbsent(dt.day, () => []);
          tasksByDay[dt.day]!.add(t);
        }
      } catch (_) {}
    }

    final dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    final totalCells = (startWeekday - 1) + lastDay.day;
    final rows = ((totalCells + 6) ~/ 7) * 7;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
        children: [
          // Month header
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Center(
              child: Text(
                DateFormat('MMMM yyyy', 'de').format(now),
                style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.text),
              ),
            ),
          ),
          // Day headers
          Row(
            children: dayNames
                .map((d) => Expanded(
                      child: Center(
                        child: Text(d,
                            style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textSecondary)),
                      ),
                    ))
                .toList(),
          ),
          const SizedBox(height: 8),
          // Calendar grid
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              mainAxisSpacing: 4,
              crossAxisSpacing: 4,
              childAspectRatio: 0.85,
            ),
            itemCount: rows,
            itemBuilder: (ctx, index) {
              final dayNum = index - (startWeekday - 1) + 1;
              if (dayNum < 1 || dayNum > lastDay.day) {
                return const SizedBox();
              }
              final isToday = dayNum == now.day;
              final dayTasks = tasksByDay[dayNum] ?? [];

              return GestureDetector(
                onTap: dayTasks.isNotEmpty
                    ? () => _showDayTasks(context, dayNum, dayTasks)
                    : null,
                child: Container(
                  decoration: BoxDecoration(
                    color: isToday
                        ? AppColors.primary.withValues(alpha: 0.08)
                        : AppColors.surface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isToday
                          ? AppColors.primary.withValues(alpha: 0.4)
                          : AppColors.border,
                    ),
                  ),
                  child: Column(
                    children: [
                      const SizedBox(height: 4),
                      Text(
                        '$dayNum',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight:
                              isToday ? FontWeight.w700 : FontWeight.w500,
                          color: isToday
                              ? AppColors.primary
                              : AppColors.text,
                        ),
                      ),
                      const SizedBox(height: 2),
                      if (dayTasks.isNotEmpty)
                        Wrap(
                          spacing: 2,
                          runSpacing: 2,
                          alignment: WrapAlignment.center,
                          children: dayTasks.take(3).map((t) {
                            return Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color:
                                    _priorityColor(t['priority'] ?? 'medium'),
                                shape: BoxShape.circle,
                              ),
                            );
                          }).toList(),
                        ),
                      if (dayTasks.length > 3)
                        Text('+${dayTasks.length - 3}',
                            style: const TextStyle(
                                fontSize: 9,
                                color: AppColors.textSecondary)),
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 16),
          // Tasks without due date
          ..._buildNoDueDateTasks(),
        ],
      ),
    );
  }

  List<Widget> _buildNoDueDateTasks() {
    final noDate =
        _filtered.where((t) => t['due_date'] == null).toList();
    if (noDate.isEmpty) return [];
    return [
      const Text('Ohne Fälligkeitsdatum',
          style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.text)),
      const SizedBox(height: 8),
      ...noDate.map((t) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _TaskCard(t, members: _members, onRefresh: _load),
          )),
    ];
  }

  void _showDayTasks(BuildContext ctx, int day, List<Map<String, dynamic>> tasks) {
    showModalBottomSheet(
      context: ctx,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 16),
            Text('Aufgaben am $day. ${DateFormat('MMMM', 'de').format(DateTime.now())}',
                style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.text)),
            const SizedBox(height: 12),
            ...tasks.map((t) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child:
                      _TaskCard(t, members: _members, onRefresh: _load),
                )),
          ],
        ),
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE TASK SHEET
  // ══════════════════════════════════════════════════════════════════════════
  void _showCreateSheet(BuildContext ctx) {
    final titleCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final storyPointsCtrl = TextEditingController();
    String priority = 'medium';
    String? assignedTo;
    DateTime? dueDate;
    String visibility = 'team';

    showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) {
          return Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.9,
            ),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              borderRadius:
                  BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Handle
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                        color: AppColors.border,
                        borderRadius: BorderRadius.circular(2)),
                  ),
                ),
                // Scrollable form
                Flexible(
                  child: ListView(
                    shrinkWrap: true,
                    padding: EdgeInsets.fromLTRB(20, 16, 20,
                        MediaQuery.of(context).viewInsets.bottom + 20),
                    children: [
                      const Text('Neue Aufgabe',
                          style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                              color: AppColors.text)),
                      const SizedBox(height: 20),

                      // Title
                      TextField(
                        controller: titleCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Titel *'),
                      ),
                      const SizedBox(height: 14),

                      // Description
                      TextField(
                        controller: descCtrl,
                        decoration: const InputDecoration(
                            labelText: 'Beschreibung'),
                        maxLines: 3,
                      ),
                      const SizedBox(height: 18),

                      // ── Priority (colored buttons) ──
                      const Text('Priorität',
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.text)),
                      const SizedBox(height: 8),
                      Row(
                        children: _priorities.map((p) {
                          final val = p['value'] as String;
                          final label = p['label'] as String;
                          final color = p['color'] as Color;
                          final selected = priority == val;
                          return Expanded(
                            child: GestureDetector(
                              onTap: () =>
                                  setSheetState(() => priority = val),
                              child: Container(
                                margin:
                                    const EdgeInsets.symmetric(horizontal: 3),
                                padding:
                                    const EdgeInsets.symmetric(vertical: 10),
                                decoration: BoxDecoration(
                                  color: selected
                                      ? color
                                      : color.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                      color: selected
                                          ? color
                                          : color.withValues(alpha: 0.3),
                                      width: selected ? 2 : 1),
                                ),
                                child: Center(
                                  child: Text(label,
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: selected
                                            ? Colors.white
                                            : color,
                                      )),
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 18),

                      // ── Zuweisen an ──
                      const Text('Zuweisen an',
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.text)),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        value: assignedTo,
                        decoration: const InputDecoration(
                            hintText: 'Mitglied auswählen'),
                        items: [
                          const DropdownMenuItem<String>(
                              value: null,
                              child: Text('Nicht zugewiesen')),
                          ..._members.map((m) {
                            final profile = m['profiles']
                                as Map<String, dynamic>?;
                            final name = profile?['display_name'] ??
                                '${profile?['first_name'] ?? ''} ${profile?['last_name'] ?? ''}'
                                    .trim();
                            final email =
                                profile?['email'] as String? ?? '';
                            final userId =
                                profile?['id'] as String? ?? '';
                            return DropdownMenuItem<String>(
                              value: userId,
                              child: Text(
                                  name.isNotEmpty ? name : email,
                                  overflow: TextOverflow.ellipsis),
                            );
                          }),
                        ],
                        onChanged: (v) =>
                            setSheetState(() => assignedTo = v),
                      ),
                      const SizedBox(height: 18),

                      // ── Fälligkeitsdatum ──
                      const Text('Fälligkeitsdatum',
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.text)),
                      const SizedBox(height: 8),
                      GestureDetector(
                        onTap: () async {
                          final picked = await showDatePicker(
                            context: context,
                            initialDate:
                                dueDate ?? DateTime.now().add(const Duration(days: 7)),
                            firstDate: DateTime.now()
                                .subtract(const Duration(days: 365)),
                            lastDate: DateTime.now()
                                .add(const Duration(days: 365 * 3)),
                            locale: const Locale('de'),
                          );
                          if (picked != null) {
                            setSheetState(() => dueDate = picked);
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 14),
                          decoration: BoxDecoration(
                            color: AppColors.background,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            children: [
                              Icon(LucideIcons.calendar,
                                  size: 16,
                                  color: dueDate != null
                                      ? AppColors.primary
                                      : AppColors.textSecondary),
                              const SizedBox(width: 10),
                              Text(
                                dueDate != null
                                    ? DateFormat('dd.MM.yyyy')
                                        .format(dueDate!)
                                    : 'Datum auswählen',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: dueDate != null
                                      ? AppColors.text
                                      : AppColors.textSecondary,
                                ),
                              ),
                              const Spacer(),
                              if (dueDate != null)
                                GestureDetector(
                                  onTap: () => setSheetState(
                                      () => dueDate = null),
                                  child: const Icon(LucideIcons.x,
                                      size: 16,
                                      color: AppColors.textSecondary),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),

                      // ── Story Points & Visibility ──
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment:
                                  CrossAxisAlignment.start,
                              children: [
                                const Text('Story Points',
                                    style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.text)),
                                const SizedBox(height: 8),
                                TextField(
                                  controller: storyPointsCtrl,
                                  keyboardType: TextInputType.number,
                                  decoration: const InputDecoration(
                                    hintText: '0',
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment:
                                  CrossAxisAlignment.start,
                              children: [
                                const Text('Sichtbarkeit',
                                    style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.text)),
                                const SizedBox(height: 8),
                                DropdownButtonFormField<String>(
                                  value: visibility,
                                  decoration:
                                      const InputDecoration(),
                                  items: const [
                                    DropdownMenuItem(
                                        value: 'team',
                                        child: Text('Team')),
                                    DropdownMenuItem(
                                        value: 'private',
                                        child: Text('Privat')),
                                    DropdownMenuItem(
                                        value: 'public',
                                        child: Text('Öffentlich')),
                                  ],
                                  onChanged: (v) => setSheetState(
                                      () => visibility = v!),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      // ── Create Button ──
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () async {
                            if (titleCtrl.text.trim().isEmpty) return;
                            final data = <String, dynamic>{
                              'title': titleCtrl.text.trim(),
                              'description': descCtrl.text.trim(),
                              'priority': priority,
                              'status': 'open',
                              'task_type': 'task',
                              'visibility': visibility,
                            };
                            if (assignedTo != null) {
                              data['assigned_to'] = assignedTo;
                            }
                            if (dueDate != null) {
                              data['due_date'] =
                                  dueDate!.toIso8601String().split('T')[0];
                            }
                            final sp =
                                int.tryParse(storyPointsCtrl.text.trim());
                            if (sp != null && sp > 0) {
                              data['story_points'] = sp;
                            }
                            await SupabaseService.createTask(
                                widget.projectId, data);
                            if (context.mounted) {
                              Navigator.pop(context);
                            }
                            _load();
                          },
                          child: const Text('Erstellen'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TASK CARD (List View)
// ═════════════════════════════════════════════════════════════════════════════
class _TaskCard extends StatelessWidget {
  final Map<String, dynamic> task;
  final List<Map<String, dynamic>> members;
  final VoidCallback onRefresh;

  const _TaskCard(this.task,
      {required this.members, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    final title = task['title'] ?? '';
    final status = task['status'] ?? 'open';
    final priority = task['priority'] ?? 'medium';
    final dueDate = task['due_date'];
    final assignedTo = task['assigned_to'] as String?;
    final storyPoints = task['story_points'];

    // Resolve assignee
    String? assigneeName;
    if (assignedTo != null && members.isNotEmpty) {
      for (final m in members) {
        final profile = m['profiles'] as Map<String, dynamic>?;
        if (profile?['id'] == assignedTo) {
          assigneeName = profile?['display_name'] ??
              '${profile?['first_name'] ?? ''} ${profile?['last_name'] ?? ''}'
                  .trim();
          if (assigneeName?.isEmpty ?? true) {
            assigneeName = profile?['email'];
          }
          break;
        }
      }
    }

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => _showDetail(context),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                        color: _statusColor(status),
                        shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(title,
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppColors.text),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _priorityColor(priority).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(_priorityLabel(priority),
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: _priorityColor(priority))),
                  ),
                ],
              ),
              if (task['description'] != null &&
                  task['description'].toString().isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(task['description'],
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.textSecondary),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis),
              ],
              const SizedBox(height: 8),
              // Bottom info row
              Wrap(
                spacing: 12,
                runSpacing: 4,
                children: [
                  if (dueDate != null)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(LucideIcons.calendar,
                            size: 13, color: AppColors.textTertiary),
                        const SizedBox(width: 4),
                        Text(_fmtDate(dueDate),
                            style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textTertiary)),
                      ],
                    ),
                  if (assigneeName != null)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(LucideIcons.user,
                            size: 13, color: AppColors.textTertiary),
                        const SizedBox(width: 4),
                        Text(assigneeName,
                            style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textTertiary),
                            overflow: TextOverflow.ellipsis),
                      ],
                    ),
                  if (storyPoints != null)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(LucideIcons.zap,
                            size: 13, color: AppColors.textTertiary),
                        const SizedBox(width: 4),
                        Text('$storyPoints SP',
                            style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textTertiary)),
                      ],
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _fmtDate(String? d) {
    if (d == null) return '';
    try {
      return DateFormat('dd.MM.yyyy').format(DateTime.parse(d));
    } catch (_) {
      return d;
    }
  }

  void _showDetail(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _TaskDetailSheet(
          task: task, members: members, onRefresh: onRefresh),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// KANBAN CARD
// ═════════════════════════════════════════════════════════════════════════════
class _KanbanCard extends StatelessWidget {
  final Map<String, dynamic> task;
  const _KanbanCard(this.task);

  @override
  Widget build(BuildContext context) {
    final priority = task['priority'] ?? 'medium';
    final dueDate = task['due_date'] as String?;
    String dueFmt = '';
    if (dueDate != null) {
      try {
        dueFmt = DateFormat('dd.MM.').format(DateTime.parse(dueDate));
      } catch (_) {}
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(task['title'] ?? '',
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.text),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis),
              ),
              const SizedBox(width: 6),
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: _priorityColor(priority),
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ),
          if (dueFmt.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(children: [
              const Icon(LucideIcons.calendar,
                  size: 12, color: AppColors.textTertiary),
              const SizedBox(width: 4),
              Text(dueFmt,
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.textTertiary)),
            ]),
          ],
        ],
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TASK DETAIL SHEET
// ═════════════════════════════════════════════════════════════════════════════
class _TaskDetailSheet extends StatefulWidget {
  final Map<String, dynamic> task;
  final List<Map<String, dynamic>> members;
  final VoidCallback onRefresh;

  const _TaskDetailSheet(
      {required this.task, required this.members, required this.onRefresh});

  @override
  State<_TaskDetailSheet> createState() => _TaskDetailSheetState();
}

class _TaskDetailSheetState extends State<_TaskDetailSheet> {
  late String _status;
  late String _priority;
  String? _assignedTo;

  @override
  void initState() {
    super.initState();
    _status = widget.task['status'] ?? 'open';
    _priority = widget.task['priority'] ?? 'medium';
    _assignedTo = widget.task['assigned_to'] as String?;
  }

  @override
  Widget build(BuildContext context) {
    final dueDate = widget.task['due_date'] as String?;
    final storyPoints = widget.task['story_points'];
    final visibility = widget.task['visibility'] as String?;

    return Container(
      constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.8),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.all(20),
      child: ListView(
        shrinkWrap: true,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const SizedBox(height: 16),
          Text(widget.task['title'] ?? '',
              style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.text)),
          if (widget.task['description'] != null &&
              widget.task['description'].toString().isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(widget.task['description'],
                style: const TextStyle(
                    fontSize: 14, color: AppColors.textSecondary)),
          ],
          const SizedBox(height: 20),

          // Status
          DropdownButtonFormField<String>(
            value: _status,
            decoration: const InputDecoration(labelText: 'Status'),
            items: const [
              DropdownMenuItem(value: 'open', child: Text('Offen')),
              DropdownMenuItem(
                  value: 'in_progress', child: Text('In Bearbeitung')),
              DropdownMenuItem(value: 'done', child: Text('Erledigt')),
              DropdownMenuItem(
                  value: 'blocked', child: Text('Blockiert')),
            ],
            onChanged: (v) async {
              if (v == null) return;
              setState(() => _status = v);
              await SupabaseService.updateTask(
                  widget.task['id'], {'status': v});
              widget.onRefresh();
            },
          ),
          const SizedBox(height: 14),

          // Priority
          const Text('Priorität',
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.text)),
          const SizedBox(height: 8),
          Row(
            children: _priorities.map((p) {
              final val = p['value'] as String;
              final label = p['label'] as String;
              final color = p['color'] as Color;
              final selected = _priority == val;
              return Expanded(
                child: GestureDetector(
                  onTap: () async {
                    setState(() => _priority = val);
                    await SupabaseService.updateTask(
                        widget.task['id'], {'priority': val});
                    widget.onRefresh();
                  },
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: selected
                          ? color
                          : color.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                          color: selected
                              ? color
                              : color.withValues(alpha: 0.3)),
                    ),
                    child: Center(
                      child: Text(label,
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color:
                                  selected ? Colors.white : color)),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 14),

          // Assigned to
          DropdownButtonFormField<String>(
            value: _assignedTo,
            decoration:
                const InputDecoration(labelText: 'Zugewiesen an'),
            items: [
              const DropdownMenuItem<String>(
                  value: null, child: Text('Nicht zugewiesen')),
              ...widget.members.map((m) {
                final profile =
                    m['profiles'] as Map<String, dynamic>?;
                final name = profile?['display_name'] ??
                    '${profile?['first_name'] ?? ''} ${profile?['last_name'] ?? ''}'
                        .trim();
                final email = profile?['email'] as String? ?? '';
                final userId = profile?['id'] as String? ?? '';
                return DropdownMenuItem<String>(
                  value: userId,
                  child: Text(name.isNotEmpty ? name : email,
                      overflow: TextOverflow.ellipsis),
                );
              }),
            ],
            onChanged: (v) async {
              setState(() => _assignedTo = v);
              await SupabaseService.updateTask(
                  widget.task['id'], {'assigned_to': v});
              widget.onRefresh();
            },
          ),
          const SizedBox(height: 14),

          // Info row
          Row(
            children: [
              if (dueDate != null) ...[
                const Icon(LucideIcons.calendar,
                    size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 6),
                Text(
                    _fmtDate(dueDate),
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.textSecondary)),
                const SizedBox(width: 16),
              ],
              if (storyPoints != null) ...[
                const Icon(LucideIcons.zap,
                    size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 6),
                Text('$storyPoints Story Points',
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.textSecondary)),
              ],
            ],
          ),
          if (visibility != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(LucideIcons.eye,
                    size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 6),
                Text(
                    visibility == 'private'
                        ? 'Privat'
                        : visibility == 'public'
                            ? 'Öffentlich'
                            : 'Team',
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.textSecondary)),
              ],
            ),
          ],
          const SizedBox(height: 20),

          // Delete
          OutlinedButton.icon(
            icon: const Icon(LucideIcons.trash2,
                size: 16, color: AppColors.danger),
            label: const Text('Aufgabe löschen',
                style: TextStyle(color: AppColors.danger)),
            onPressed: () async {
              await SupabaseService.deleteTask(widget.task['id']);
              if (context.mounted) Navigator.pop(context);
              widget.onRefresh();
            },
          ),
        ],
      ),
    );
  }

  String _fmtDate(String? d) {
    if (d == null) return '';
    try {
      return DateFormat('dd.MM.yyyy').format(DateTime.parse(d));
    } catch (_) {
      return d;
    }
  }
}
