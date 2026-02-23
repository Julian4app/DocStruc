import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:intl/intl.dart';
import 'package:record/record.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_html/flutter_html.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/permissions_provider.dart';
import '../../../core/services/supabase_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/burger_menu_leading.dart';

// ── Priority helpers ─────────────────────────────────────────────────────────
const _priorities = [
  {'value': 'low',      'label': 'Niedrig',  'color': Color(0xFF10B981)},
  {'value': 'medium',   'label': 'Mittel',   'color': Color(0xFF3B82F6)},
  {'value': 'high',     'label': 'Hoch',     'color': Color(0xFFF59E0B)},
  {'value': 'critical', 'label': 'Kritisch', 'color': Color(0xFFDC2626)},
];

Color _priorityColor(String p) {
  switch (p) {
    case 'low':      return const Color(0xFF10B981);
    case 'high':     return const Color(0xFFF59E0B);
    case 'critical': return const Color(0xFFDC2626);
    default:         return const Color(0xFF3B82F6);
  }
}
String _priorityLabel(String p) {
  switch (p) {
    case 'low':      return 'Niedrig';
    case 'high':     return 'Hoch';
    case 'critical': return 'Kritisch';
    default:         return 'Mittel';
  }
}
Color _statusColor(String? s) {
  switch (s) {
    case 'done':        return AppColors.success;
    case 'in_progress': return AppColors.warning;
    case 'blocked':     return AppColors.danger;
    default:            return AppColors.textTertiary;
  }
}
String _statusLabel(String? s) {
  switch (s) {
    case 'done':        return 'Erledigt';
    case 'in_progress': return 'In Bearbeitung';
    case 'blocked':     return 'Blockiert';
    default:            return 'Offen';
  }
}
String _fmtDate(String? d) {
  if (d == null) return '';
  try { return DateFormat('dd.MM.yyyy').format(DateTime.parse(d)); } catch (_) { return d; }
}
String _fmtDateTime(String? d) {
  if (d == null) return '';
  try { return DateFormat('dd.MM.yyyy HH:mm').format(DateTime.parse(d)); } catch (_) { return d; }
}

// ═════════════════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════════════════

class ProjectTasksPage extends ConsumerStatefulWidget {
  final String projectId;
  const ProjectTasksPage({super.key, required this.projectId});
  @override
  ConsumerState<ProjectTasksPage> createState() => _ProjectTasksPageState();
}

class _ProjectTasksPageState extends ConsumerState<ProjectTasksPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  bool _loading = true;
  List<Map<String, dynamic>> _tasks = [];
  List<Map<String, dynamic>> _members = [];
  String _statusFilter = 'alle';
  String _priorityFilter = 'alle';
  String _search = '';
  final _searchCtrl = TextEditingController();
  bool _searchOpen = false;
  final _searchFocusNode = FocusNode();
  DateTime _calMonth = DateTime.now();

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    _searchCtrl.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final tasks = await SupabaseService.getTasks(widget.projectId, taskType: 'task');
      List<Map<String, dynamic>> members = [];
      try { members = await SupabaseService.getProjectMembers(widget.projectId); } catch (_) {}
      if (mounted) setState(() { _tasks = tasks; _members = members; _loading = false; });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filtered {
    var list = _tasks;
    if (_statusFilter != 'alle') list = list.where((t) => t['status'] == _statusFilter).toList();
    if (_priorityFilter != 'alle') list = list.where((t) => t['priority'] == _priorityFilter).toList();
    if (_search.isNotEmpty) {
      final q = _search.toLowerCase();
      list = list.where((t) =>
        (t['title'] ?? '').toString().toLowerCase().contains(q) ||
        (t['description'] ?? '').toString().toLowerCase().contains(q),
      ).toList();
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
        bottom: TabBar(
          controller: _tabs,
          tabs: const [Tab(text: 'Liste'), Tab(text: 'Kanban'), Tab(text: 'Kalender')],
        ),
      ),
      floatingActionButton: ref.permissions(widget.projectId).canCreate('tasks')
          ? FloatingActionButton(
              onPressed: () => _showCreateSheet(context),
              backgroundColor: AppColors.primary,
              child: const Icon(LucideIcons.plus, color: Colors.white),
            )
          : null,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabs,
              children: [_listView(), _kanbanView(), _calendarView()],
            ),
    );
  }

  // ── Filter bar ────────────────────────────────────────────────────────────
  Widget _filterBar() {
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
        child: Row(children: [
          Expanded(child: SizedBox(
            height: 36,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _sChip('alle',        'Alle',        isStatus: true),
                _sChip('open',        'Offen',       isStatus: true),
                _sChip('in_progress', 'Aktiv',       isStatus: true),
                _sChip('done',        'Erledigt',    isStatus: true),
                _sChip('blocked',     'Blockiert',   isStatus: true),
                Container(width: 1, height: 22, margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 7), color: AppColors.border),
                _sChip('alle',        'Alle',        isStatus: false),
                _sChip('low',         'Niedrig',     isStatus: false, dot: const Color(0xFF10B981)),
                _sChip('medium',      'Mittel',      isStatus: false, dot: const Color(0xFF3B82F6)),
                _sChip('high',        'Hoch',        isStatus: false, dot: const Color(0xFFF59E0B)),
                _sChip('critical',    'Kritisch',    isStatus: false, dot: const Color(0xFFDC2626)),
              ],
            ),
          )),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () => setState(() {
              _searchOpen = !_searchOpen;
              if (_searchOpen) { Future.microtask(() => _searchFocusNode.requestFocus()); }
              else { _searchCtrl.clear(); _search = ''; _searchFocusNode.unfocus(); }
            }),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 36, height: 36,
              decoration: BoxDecoration(
                color: _searchOpen ? AppColors.primary.withValues(alpha: 0.12) : AppColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _searchOpen ? AppColors.primary : AppColors.border),
              ),
              child: Icon(_searchOpen ? LucideIcons.x : LucideIcons.search, size: 16,
                  color: _searchOpen ? AppColors.primary : AppColors.textSecondary),
            ),
          ),
        ]),
      ),
      AnimatedSize(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeInOut,
        child: _searchOpen
            ? Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: TextField(
                  controller: _searchCtrl,
                  focusNode: _searchFocusNode,
                  onChanged: (v) => setState(() => _search = v),
                  decoration: InputDecoration(
                    hintText: 'Aufgaben durchsuchen\u2026',
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    prefixIcon: const Icon(LucideIcons.search, size: 16),
                    suffixIcon: _search.isNotEmpty
                        ? IconButton(icon: const Icon(LucideIcons.x, size: 16), onPressed: () { _searchCtrl.clear(); setState(() => _search = ''); })
                        : null,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.primary)),
                    filled: true, fillColor: AppColors.surface,
                  ),
                ),
              )
            : const SizedBox.shrink(),
      ),
      const SizedBox(height: 8),
    ]);
  }

  Widget _sChip(String value, String label, {required bool isStatus, Color? dot}) {
    final current = isStatus ? _statusFilter : _priorityFilter;
    final sel = current == value;
    // Use the dot color as the chip accent when selected for priority chips
    final accentColor = (dot != null && value != 'alle') ? dot : AppColors.primary;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: GestureDetector(
        onTap: () => setState(() { if (isStatus) { _statusFilter = value; } else { _priorityFilter = value; } }),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: sel ? accentColor : AppColors.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: sel ? accentColor : AppColors.border, width: sel ? 1.5 : 1),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (dot != null && value != 'alle') ...[
              Container(width: 7, height: 7, decoration: BoxDecoration(color: sel ? Colors.white : dot, shape: BoxShape.circle)),
              const SizedBox(width: 5),
            ],
            Text(label, style: TextStyle(fontSize: 12, color: sel ? Colors.white : AppColors.text, fontWeight: sel ? FontWeight.w700 : FontWeight.w500)),
          ]),
        ),
      ),
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  Widget _listView() {
    final tasks = _filtered;
    return Column(children: [
      _filterBar(),
      Expanded(child: RefreshIndicator(
        onRefresh: _load,
        child: tasks.isEmpty
            ? ListView(children: [const SizedBox(height: 100), Center(child: Column(children: [
                Icon(_search.isNotEmpty ? LucideIcons.searchX : LucideIcons.checkSquare, size: 48, color: AppColors.textTertiary),
                const SizedBox(height: 12),
                Text(_search.isNotEmpty ? 'Keine Treffer' : 'Keine Aufgaben', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
              ]))]  )
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                itemCount: tasks.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) => _TaskCard(tasks[i], members: _members, projectId: widget.projectId, onRefresh: _load,
                  canEdit: ref.permissions(widget.projectId).canEdit('tasks'),
                  canDelete: ref.permissions(widget.projectId).canDelete('tasks')),
              ),
      )),
    ]);
  }

  // ── KANBAN VIEW ───────────────────────────────────────────────────────────
  Widget _kanbanView() {
    final columns = [
      {'key': 'open',        'label': 'Offen',          'color': AppColors.textTertiary},
      {'key': 'in_progress', 'label': 'In Bearbeitung', 'color': AppColors.warning},
      {'key': 'done',        'label': 'Erledigt',       'color': AppColors.success},
      {'key': 'blocked',     'label': 'Blockiert',      'color': AppColors.danger},
    ];
    final tasks = _filtered;
    return Column(children: [
      _filterBar(),
      Expanded(child: RefreshIndicator(
        onRefresh: _load,
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
          child: IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: columns.map((col) {
            final key   = col['key']   as String;
            final label = col['label'] as String;
            final color = col['color'] as Color;
            final colTasks = tasks.where((t) => t['status'] == key).toList();
            return DragTarget<Map<String, dynamic>>(
              onWillAcceptWithDetails: (d) => d.data['status'] != key,
              onAcceptWithDetails: (d) async {
                await SupabaseService.updateTask(d.data['id'], {'status': key});
                _load();
              },
              builder: (context, candidateData, _) {
                final isHovered = candidateData.isNotEmpty;
                return Container(
                  width: 260,
                  margin: const EdgeInsets.only(right: 12),
                  decoration: isHovered ? BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: color, width: 2), color: color.withValues(alpha: 0.04)) : null,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
                      child: Row(children: [
                        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                        const SizedBox(width: 8),
                        Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: color)),
                        const Spacer(),
                        Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
                          child: Text('${colTasks.length}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color))),
                      ]),
                    ),
                    const SizedBox(height: 8),
                    ...colTasks.map((t) => Padding(padding: const EdgeInsets.only(bottom: 8),
                      child: Draggable<Map<String, dynamic>>(
                        data: t,
                        feedback: Material(color: Colors.transparent, child: SizedBox(width: 244, child: Opacity(opacity: 0.85, child: _KanbanCard(t)))),
                        childWhenDragging: Opacity(opacity: 0.3, child: _KanbanCard(t)),
                        child: _KanbanCard(t),
                      ))),
                    if (colTasks.isEmpty) Container(height: 60, decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(10), border: Border.all(color: isHovered ? color : AppColors.border)),
                      child: Center(child: Text(isHovered ? 'Hier ablegen' : 'Keine Aufgaben', style: TextStyle(fontSize: 12, color: isHovered ? color : AppColors.textTertiary)))),
                  ]),
                );
              },
            );
          }).toList())),
        ),
      )),
    ]);
  }

  // ── CALENDAR VIEW ─────────────────────────────────────────────────────────
  Widget _calendarView() {
    final firstDay = DateTime(_calMonth.year, _calMonth.month, 1);
    final daysInMonth = DateUtils.getDaysInMonth(_calMonth.year, _calMonth.month);
    final startWeekday = (firstDay.weekday - 1) % 7;
    final Map<int, List<Map<String, dynamic>>> tasksByDay = {};
    for (final t in _tasks) {
      final ds = t['due_date'] as String?; if (ds == null) continue;
      final dt = DateTime.tryParse(ds); if (dt == null) continue;
      if (dt.year == _calMonth.year && dt.month == _calMonth.month) {
        tasksByDay.putIfAbsent(dt.day, () => []).add(t);
      }
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(children: [
        Container(padding: const EdgeInsets.fromLTRB(8, 12, 8, 8), child: Row(children: [
          IconButton(icon: const Icon(LucideIcons.chevronLeft), onPressed: () => setState(() => _calMonth = DateTime(_calMonth.year, _calMonth.month - 1, 1))),
          Expanded(child: Center(child: Text(DateFormat('MMMM yyyy', 'de').format(_calMonth), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)))),
          IconButton(icon: const Icon(LucideIcons.chevronRight), onPressed: () => setState(() => _calMonth = DateTime(_calMonth.year, _calMonth.month + 1, 1))),
        ])),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Row(children: ['Mo','Di','Mi','Do','Fr','Sa','So'].map((d) => Expanded(child: Center(child: Text(d, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textTertiary))))).toList())),
        const SizedBox(height: 6),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: GridView.builder(
          shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 7, childAspectRatio: 0.95, crossAxisSpacing: 2, mainAxisSpacing: 2),
          itemCount: startWeekday + daysInMonth,
          itemBuilder: (ctx, i) {
            if (i < startWeekday) return const SizedBox();
            final day = i - startWeekday + 1;
            final items = tasksByDay[day];
            final today = DateTime.now();
            final isToday = today.year == _calMonth.year && today.month == _calMonth.month && today.day == day;
            return GestureDetector(
              onTap: items != null ? () => _showCalDaySheet(ctx, day, items) : null,
              child: Container(
                decoration: BoxDecoration(
                  color: isToday ? AppColors.primary.withValues(alpha: 0.15) : items != null ? AppColors.surface : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                  border: isToday ? Border.all(color: AppColors.primary, width: 1.5) : (items != null ? Border.all(color: AppColors.border) : null),
                ),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text('$day', style: TextStyle(fontSize: 13, fontWeight: isToday ? FontWeight.w700 : FontWeight.w500, color: isToday ? AppColors.primary : AppColors.text)),
                  if (items != null && items.isNotEmpty) Row(mainAxisAlignment: MainAxisAlignment.center, children: items.take(3).map((t) =>
                    Container(margin: const EdgeInsets.symmetric(horizontal: 1), width: 6, height: 6, decoration: BoxDecoration(color: _priorityColor(t['priority'] ?? 'medium'), shape: BoxShape.circle))).toList()),
                ]),
              ),
            );
          },
        )),
        const SizedBox(height: 16),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Wrap(spacing: 16, runSpacing: 8, children: [
          _calLegend('Niedrig', const Color(0xFF10B981)),
          _calLegend('Mittel',  const Color(0xFF3B82F6)),
          _calLegend('Hoch',    const Color(0xFFF59E0B)),
          _calLegend('Kritisch',const Color(0xFFDC2626)),
        ])),
        if (_tasks.any((t) => t['due_date'] == null)) ...[
          Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 8), child: Row(children: [
            const Icon(LucideIcons.calendarX, size: 15, color: AppColors.textTertiary),
            const SizedBox(width: 6),
            const Text('Ohne F\u00e4lligkeitsdatum', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
          ])),
          for (final t in _tasks.where((t) => t['due_date'] == null))
            Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: _TaskCard(t, members: _members, projectId: widget.projectId, onRefresh: _load,
                canEdit: ref.permissions(widget.projectId).canEdit('tasks'),
                canDelete: ref.permissions(widget.projectId).canDelete('tasks'))),
        ],
        const SizedBox(height: 100),
      ]),
    );
  }

  Widget _calLegend(String label, Color c) => Row(mainAxisSize: MainAxisSize.min, children: [
    Container(width: 10, height: 10, decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
    const SizedBox(width: 4),
    Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
  ]);

  void _showCalDaySheet(BuildContext ctx, int day, List<Map<String, dynamic>> tasks) {
    showModalBottomSheet(context: ctx, backgroundColor: Colors.transparent, isScrollControlled: true,
      builder: (_) => Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.75),
        decoration: const BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Padding(padding: const EdgeInsets.only(top: 12), child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
          Padding(padding: const EdgeInsets.all(16), child: Text('Aufgaben am $day. ${DateFormat('MMMM yyyy', 'de').format(_calMonth)}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text))),
          Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 24), children:
            tasks.map((t) => Padding(padding: const EdgeInsets.only(bottom: 8),
              child: _TaskCard(t, members: _members, projectId: widget.projectId, onRefresh: () { Navigator.pop(ctx); _load(); },
                canEdit: ref.permissions(widget.projectId).canEdit('tasks'),
                canDelete: ref.permissions(widget.projectId).canDelete('tasks')))).toList())),
        ]),
      ),
    );
  }

  // ── Pickers ───────────────────────────────────────────────────────────────
  Future<String?> _showMemberPickerSheet(BuildContext ctx, String? currentId) async {
    return showModalBottomSheet<String>(
      context: ctx, backgroundColor: Colors.transparent, isScrollControlled: true,
      builder: (_) => Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.7),
        decoration: const BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(height: 12),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          const Text('Mitglied ausw\u00e4hlen', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
          const SizedBox(height: 8),
          const Divider(height: 1),
          Flexible(child: ListView(shrinkWrap: true, children: [
            ListTile(
              leading: Container(width: 36, height: 36, decoration: BoxDecoration(color: AppColors.border, shape: BoxShape.circle), child: const Icon(LucideIcons.userX, size: 18, color: AppColors.textSecondary)),
              title: const Text('Nicht zugewiesen', style: TextStyle(fontSize: 14, color: AppColors.textSecondary)),
              trailing: currentId == null ? const Icon(LucideIcons.check, size: 18, color: AppColors.primary) : null,
              onTap: () => Navigator.pop(ctx, '__none__'),
            ),
            ..._members.map((m) {
              final profile = m['profiles'] as Map<String, dynamic>?;
              final uid = profile?['id'] as String? ?? '';
              final name = _memberName(m);
              final initials = _memberInitials(name);
              return ListTile(
                leading: Container(width: 36, height: 36, decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.15), shape: BoxShape.circle), child: Center(child: Text(initials, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primary)))),
                title: Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.text)),
                subtitle: (profile?['email'] as String?)?.isNotEmpty == true ? Text(profile!['email'] as String, style: const TextStyle(fontSize: 12, color: AppColors.textTertiary)) : null,
                trailing: currentId == uid ? const Icon(LucideIcons.check, size: 18, color: AppColors.primary) : null,
                onTap: () => Navigator.pop(ctx, uid),
              );
            }),
          ])),
          const SizedBox(height: 16),
        ]),
      ),
    );
  }

  Future<String?> _showVisibilityPickerSheet(BuildContext ctx, String current) async {
    const options = [
      {'value': 'team',    'label': 'Team',       'sub': 'Nur f\u00fcr Projektmitglieder', 'icon': LucideIcons.users},
      {'value': 'private', 'label': 'Privat',     'sub': 'Nur f\u00fcr mich sichtbar',     'icon': LucideIcons.lock},
      {'value': 'public',  'label': '\u00d6ffentlich', 'sub': 'F\u00fcr alle sichtbar',    'icon': LucideIcons.globe},
    ];
    return showModalBottomSheet<String>(
      context: ctx, backgroundColor: Colors.transparent,
      builder: (_) => Container(
        decoration: const BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(height: 12),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          const Text('Sichtbarkeit', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
          const SizedBox(height: 8),
          const Divider(height: 1),
          ...options.map((o) {
            final val = o['value'] as String; final label = o['label'] as String;
            final sub = o['sub'] as String; final icon = o['icon'] as IconData;
            final isSel = current == val;
            return ListTile(
              leading: Container(width: 36, height: 36, decoration: BoxDecoration(color: isSel ? AppColors.primary.withValues(alpha: 0.1) : AppColors.background, shape: BoxShape.circle), child: Icon(icon, size: 18, color: isSel ? AppColors.primary : AppColors.textSecondary)),
              title: Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isSel ? AppColors.primary : AppColors.text)),
              subtitle: Text(sub, style: const TextStyle(fontSize: 12, color: AppColors.textTertiary)),
              trailing: isSel ? const Icon(LucideIcons.check, size: 18, color: AppColors.primary) : null,
              onTap: () => Navigator.pop(ctx, val),
            );
          }),
          const SizedBox(height: 16),
        ]),
      ),
    );
  }

  // ── CREATE SHEET ──────────────────────────────────────────────────────────
  void _showCreateSheet(BuildContext ctx) {
    final titleCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final spCtrl = TextEditingController();
    String priority = 'medium';
    String? assignedTo;
    DateTime? dueDate;
    String visibility = 'all_participants';
    List<({String name, Uint8List bytes})> pendingImages = [];

    showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) => StatefulBuilder(
        builder: (sheetCtx, ss) => Container(
          constraints: BoxConstraints(maxHeight: MediaQuery.of(sheetCtx).size.height * 0.95),
          decoration: const BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Padding(padding: const EdgeInsets.only(top: 12), child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
            Flexible(child: ListView(shrinkWrap: true,
              padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(sheetCtx).viewInsets.bottom + 24),
              children: [
                const Text('Neue Aufgabe', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.text)),
                const SizedBox(height: 20),
                TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Titel *')),
                const SizedBox(height: 14),
                TextField(controller: descCtrl, maxLines: 3, decoration: const InputDecoration(labelText: 'Beschreibung')),
                const SizedBox(height: 18),
                const Text('Priorit\u00e4t', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
                const SizedBox(height: 8),
                Row(children: _priorities.map((p) {
                  final val = p['value'] as String; final label = p['label'] as String; final color = p['color'] as Color;
                  final sel = priority == val;
                  return Expanded(child: GestureDetector(
                    onTap: () => ss(() => priority = val),
                    child: Container(margin: const EdgeInsets.symmetric(horizontal: 3), padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(color: sel ? color : color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10), border: Border.all(color: sel ? color : color.withValues(alpha: 0.3), width: sel ? 2 : 1)),
                      child: Center(child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: sel ? Colors.white : color)))),
                  ));
                }).toList()),
                const SizedBox(height: 18),
                const Text('Zuweisen an', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
                const SizedBox(height: 8),
                _MemberPickerTile(selectedId: assignedTo, members: _members, onTap: () async {
                  final r = await _showMemberPickerSheet(sheetCtx, assignedTo);
                  if (r != null) ss(() => assignedTo = r == '__none__' ? null : r);
                }),
                const SizedBox(height: 18),
                const Text('F\u00e4lligkeitsdatum', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
                const SizedBox(height: 8),
                GestureDetector(
                  onTap: () async {
                    final p = await showDatePicker(context: sheetCtx, initialDate: dueDate ?? DateTime.now().add(const Duration(days: 7)), firstDate: DateTime.now().subtract(const Duration(days: 365)), lastDate: DateTime.now().add(const Duration(days: 365 * 3)));
                    if (p != null) ss(() => dueDate = p);
                  },
                  child: Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                    decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(10), border: Border.all(color: dueDate != null ? AppColors.primary : AppColors.border)),
                    child: Row(children: [
                      Icon(LucideIcons.calendar, size: 16, color: dueDate != null ? AppColors.primary : AppColors.textSecondary),
                      const SizedBox(width: 10),
                      Text(dueDate != null ? DateFormat('dd.MM.yyyy').format(dueDate!) : 'Datum ausw\u00e4hlen', style: TextStyle(fontSize: 14, color: dueDate != null ? AppColors.text : AppColors.textSecondary)),
                      const Spacer(),
                      if (dueDate != null) GestureDetector(onTap: () => ss(() => dueDate = null), child: const Icon(LucideIcons.x, size: 16, color: AppColors.textSecondary)),
                    ]),
                  ),
                ),
                const SizedBox(height: 18),
                Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Story Points', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
                    const SizedBox(height: 8),
                    TextField(controller: spCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(hintText: '0')),
                  ])),
                  const SizedBox(width: 16),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Sichtbarkeit', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
                    const SizedBox(height: 8),
                    _VisibilityPickerTile(value: visibility, onTap: () async {
                      final r = await _showVisibilityPickerSheet(sheetCtx, visibility);
                      if (r != null) ss(() => visibility = r);
                    }),
                  ])),
                ]),
                const SizedBox(height: 18),
                const Text('Bilder hinzuf\u00fcgen', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
                const SizedBox(height: 8),
                GestureDetector(
                  onTap: () async {
                    final picker = ImagePicker();
                    final picked = await picker.pickMultiImage();
                    if (picked.isEmpty) return;
                    final items = <({String name, Uint8List bytes})>[];
                    for (final f in picked) {
                      final bytes = await f.readAsBytes();
                      items.add((name: f.name, bytes: bytes));
                    }
                    ss(() => pendingImages = [...pendingImages, ...items]);
                  },
                  child: Container(padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.primary.withValues(alpha: 0.3))),
                    child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(LucideIcons.camera, size: 18, color: AppColors.primary),
                      SizedBox(width: 8),
                      Text('Bilder aus Galerie w\u00e4hlen', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.primary)),
                    ]),
                  ),
                ),
                if (pendingImages.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  SizedBox(height: 90, child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: pendingImages.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, i) => Stack(children: [
                      ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.memory(pendingImages[i].bytes, width: 80, height: 80, fit: BoxFit.cover)),
                      Positioned(top: 2, right: 2, child: GestureDetector(
                        onTap: () => ss(() { final l = List.of(pendingImages); l.removeAt(i); pendingImages = l; }),
                        child: Container(width: 20, height: 20, decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle), child: const Icon(LucideIcons.x, size: 12, color: Colors.white)),
                      )),
                    ]),
                  )),
                ],
                const SizedBox(height: 24),
                SizedBox(width: double.infinity, child: ElevatedButton(
                  onPressed: () async {
                    if (titleCtrl.text.trim().isEmpty) return;
                    final data = <String, dynamic>{
                      'title': titleCtrl.text.trim(),
                      'description': descCtrl.text.trim(),
                      'priority': priority,
                      'status': 'open',
                      'task_type': 'task',
                      if (assignedTo != null) 'assigned_to': assignedTo,
                      if (dueDate != null) 'due_date': dueDate!.toIso8601String().split('T')[0],
                      if (int.tryParse(spCtrl.text.trim()) != null) 'story_points': int.parse(spCtrl.text.trim()),
                    };
                    final taskId = await SupabaseService.createTaskWithReturn(widget.projectId, data);
                    if (taskId != null) {
                      await SupabaseService.setContentVisibility(
                          taskId, 'tasks', widget.projectId, visibility);
                    }
                    if (taskId != null && pendingImages.isNotEmpty) {
                      for (int i = 0; i < pendingImages.length; i++) {
                        final img = pendingImages[i];
                        final ext = img.name.split('.').last.toLowerCase();
                        final p = '${widget.projectId}/tasks/$taskId/${DateTime.now().millisecondsSinceEpoch}_$i.$ext';
                        try {
                          await SupabaseService.uploadFile(bucket: 'task-images', path: p, bytes: img.bytes, contentType: 'image/$ext');
                          await SupabaseService.addTaskImage(taskId, widget.projectId, p, img.name, i);
                        } catch (_) {}
                      }
                    }
                    if (sheetCtx.mounted) Navigator.pop(sheetCtx);
                    _load();
                  },
                  child: const Text('Erstellen'),
                )),
              ],
            )),
          ]),
        ),
      ),
    );
  }

  // helpers
  String _memberName(Map<String, dynamic> m) {
    final p = m['profiles'] as Map<String, dynamic>?;
    final dn = p?['display_name'] as String?;
    if (dn?.isNotEmpty == true) return dn!;
    final fn = p?['first_name'] as String? ?? '';
    final ln = p?['last_name']  as String? ?? '';
    final full = '$fn $ln'.trim();
    return full.isNotEmpty ? full : (p?['email'] as String? ?? '');
  }

  String _memberInitials(String name) {
    if (name.isEmpty) return '?';
    return name.trim().split(' ').where((s) => s.isNotEmpty).take(2).map((s) => s[0].toUpperCase()).join();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TASK CARD
// ═════════════════════════════════════════════════════════════════════════════
class _TaskCard extends StatelessWidget {
  final Map<String, dynamic> task;
  final List<Map<String, dynamic>> members;
  final String projectId;
  final VoidCallback onRefresh;
  final bool canEdit;
  final bool canDelete;
  const _TaskCard(this.task, {required this.members, required this.projectId, required this.onRefresh, this.canEdit = false, this.canDelete = false});

  String _mName() {
    final uid = task['assigned_to'] as String?;
    if (uid == null) return '';
    for (final m in members) {
      final p = m['profiles'] as Map<String, dynamic>?;
      if (p?['id'] == uid) {
        final n = p?['display_name'] ?? '${p?['first_name'] ?? ''} ${p?['last_name'] ?? ''}'.trim();
        return n.isNotEmpty ? n : (p?['email'] as String? ?? '');
      }
    }
    return '';
  }

  @override
  Widget build(BuildContext context) {
    final title      = task['title'] ?? '';
    final status     = task['status'] ?? 'open';
    final priority   = task['priority'] ?? 'medium';
    final dueDate    = task['due_date'] as String?;
    final storyPoints = task['story_points'];
    final assigneeName = _mName();

    return Container(
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => Navigator.push(context, MaterialPageRoute(fullscreenDialog: true,
          builder: (_) => _TaskDetailPage(task: task, members: members, projectId: projectId, onRefresh: onRefresh, canEdit: canEdit, canDelete: canDelete))),
        child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(width: 10, height: 10, decoration: BoxDecoration(color: _statusColor(status), shape: BoxShape.circle)),
            const SizedBox(width: 10),
            Expanded(child: Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.text), maxLines: 1, overflow: TextOverflow.ellipsis)),
            Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: _priorityColor(priority).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
              child: Text(_priorityLabel(priority), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _priorityColor(priority)))),
          ]),
          if ((task['description'] ?? '').toString().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(task['description'], style: const TextStyle(fontSize: 13, color: AppColors.textSecondary), maxLines: 2, overflow: TextOverflow.ellipsis),
          ],
          const SizedBox(height: 8),
          Wrap(spacing: 12, runSpacing: 4, children: [
            if (dueDate != null) Row(mainAxisSize: MainAxisSize.min, children: [
              const Icon(LucideIcons.calendar, size: 13, color: AppColors.textTertiary),
              const SizedBox(width: 4),
              Text(_fmtDate(dueDate), style: const TextStyle(fontSize: 12, color: AppColors.textTertiary)),
            ]),
            if (assigneeName.isNotEmpty) Row(mainAxisSize: MainAxisSize.min, children: [
              const Icon(LucideIcons.user, size: 13, color: AppColors.textTertiary),
              const SizedBox(width: 4),
              Text(assigneeName, style: const TextStyle(fontSize: 12, color: AppColors.textTertiary), overflow: TextOverflow.ellipsis),
            ]),
            if (storyPoints != null) Row(mainAxisSize: MainAxisSize.min, children: [
              const Icon(LucideIcons.zap, size: 13, color: AppColors.textTertiary),
              const SizedBox(width: 4),
              Text('$storyPoints SP', style: const TextStyle(fontSize: 12, color: AppColors.textTertiary)),
            ]),
          ]),
        ])),
      ),
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
    final dueDate  = task['due_date'] as String?;
    final dueFmt   = dueDate != null ? DateFormat('dd.MM.').format(DateTime.tryParse(dueDate) ?? DateTime.now()) : '';
    return Container(padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(task['title'] ?? '', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text), maxLines: 2, overflow: TextOverflow.ellipsis)),
          const SizedBox(width: 6),
          Container(width: 8, height: 8, decoration: BoxDecoration(color: _priorityColor(priority), shape: BoxShape.circle)),
        ]),
        if (dueFmt.isNotEmpty) ...[
          const SizedBox(height: 6),
          Row(children: [const Icon(LucideIcons.calendar, size: 12, color: AppColors.textTertiary), const SizedBox(width: 4), Text(dueFmt, style: const TextStyle(fontSize: 11, color: AppColors.textTertiary))]),
        ],
      ]),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TASK DETAIL PAGE
// ═════════════════════════════════════════════════════════════════════════════
class _TaskDetailPage extends StatefulWidget {
  final Map<String, dynamic> task;
  final List<Map<String, dynamic>> members;
  final String projectId;
  final VoidCallback onRefresh;
  final bool canEdit;
  final bool canDelete;
  const _TaskDetailPage({required this.task, required this.members, required this.projectId, required this.onRefresh, this.canEdit = false, this.canDelete = false});
  @override State<_TaskDetailPage> createState() => _TaskDetailPageState();
}

class _TaskDetailPageState extends State<_TaskDetailPage> with SingleTickerProviderStateMixin {
  late TabController _tabs;
  late Map<String, dynamic> _task;
  bool _editMode = false;
  bool _loadingMedia = true, _savingDoc = false, _saving = false;
  List<Map<String, dynamic>> _images = [], _docs = [];

  // Edit form controllers
  late TextEditingController _titleCtrl, _descCtrl, _spCtrl;
  late String _status, _priority;
  String? _assignedTo;
  DateTime? _dueDate;
  late String _visibility;

  // Rich text doc input
  final _docBodyCtrl = TextEditingController();
  String _docType = 'text';
  bool _docExpanded = false;
  // Voice recording
  AudioRecorder? _recorder;
  bool _isRecording = false;
  String? _recordPath;
  AudioPlayer? _player;
  bool _isPlaying = false;
  String? _playingDocId;

  @override
  void initState() {
    super.initState();
    _task = Map.from(widget.task);
    _tabs = TabController(length: 3, vsync: this);
    _initForm();
    _loadMedia();
    _loadVisibility();
  }

  void _initForm() {
    _titleCtrl = TextEditingController(text: _task['title'] ?? '');
    _descCtrl  = TextEditingController(text: _task['description'] ?? '');
    _spCtrl    = TextEditingController(text: _task['story_points']?.toString() ?? '');
    _status    = _task['status']     ?? 'open';
    _priority  = _task['priority']   ?? 'medium';
    _assignedTo = _task['assigned_to'] as String?;
    _visibility = 'all_participants'; // will be updated by _loadVisibility
    final ds = _task['due_date'] as String?;
    _dueDate   = ds != null ? DateTime.tryParse(ds) : null;
  }

  Future<void> _loadVisibility() async {
    final taskId = _task['id'] as String?;
    if (taskId == null) return;
    final v = await SupabaseService.getContentVisibility(taskId, 'tasks');
    if (mounted) setState(() => _visibility = v);
  }

  @override
  void dispose() {
    _tabs.dispose();
    _titleCtrl.dispose(); _descCtrl.dispose(); _spCtrl.dispose();
    _docBodyCtrl.dispose();
    _recorder?.dispose();
    _player?.dispose();
    super.dispose();
  }

  Future<void> _loadMedia() async {
    setState(() => _loadingMedia = true);
    final r = await Future.wait([
      SupabaseService.getTaskImages(_task['id']),
      SupabaseService.getTaskDocs(_task['id']),
    ]);
    if (mounted) setState(() {
      _images = (r[0] as List).cast<Map<String, dynamic>>();
      _docs   = (r[1] as List).cast<Map<String, dynamic>>();
      _loadingMedia = false;
    });
  }

  Future<void> _save() async {
    if (_titleCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Titel darf nicht leer sein')));
      return;
    }
    setState(() => _saving = true);
    try {
      final data = <String, dynamic>{
        'title':       _titleCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        'status':      _status,
        'priority':    _priority,
        'assigned_to': _assignedTo,
        'due_date':    _dueDate?.toIso8601String().split('T')[0],
      };
      final sp = int.tryParse(_spCtrl.text.trim());
      if (sp != null) data['story_points'] = sp;
      await SupabaseService.updateTask(_task['id'] as String, data);
      await SupabaseService.setContentVisibility(
          _task['id'] as String, 'tasks', widget.projectId, _visibility);
      if (!mounted) return;
      setState(() {
        _task = {..._task, ...data};
        _editMode = false;
        _saving = false;
      });
      widget.onRefresh();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Gespeichert ✓'), duration: Duration(seconds: 2)));
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Fehler beim Speichern: $e'), backgroundColor: Colors.red));
    }
  }

  Future<void> _uploadImages() async {
    final picker = ImagePicker();
    final picked = await picker.pickMultiImage();
    if (picked.isEmpty) return;
    for (int i = 0; i < picked.length; i++) {
      final f = picked[i];
      final bytes = await f.readAsBytes();
      final ext = f.name.split('.').last.toLowerCase();
      final p = '${widget.projectId}/tasks/${_task['id']}/${DateTime.now().millisecondsSinceEpoch}_$i.$ext';
      try {
        await SupabaseService.uploadFile(bucket: 'task-images', path: p, bytes: bytes, contentType: 'image/$ext');
        await SupabaseService.addTaskImage(_task['id'], widget.projectId, p, f.name, _images.length + i);
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Fehler: $e')));
      }
    }
    _loadMedia();
  }

  Future<void> _addTextDoc() async {
    final text = _docBodyCtrl.text.trim();
    if (text.isEmpty) return;
    setState(() => _savingDoc = true);
    await SupabaseService.addTaskDoc(_task['id'], widget.projectId, {'documentation_type': 'text', 'content': text});
    _docBodyCtrl.clear();
    setState(() => _savingDoc = false);
    _loadMedia();
  }

  Future<void> _startRecording() async {
    try {
      _recorder = AudioRecorder();
      final hasPermission = await _recorder!.hasPermission();
      if (!hasPermission) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Mikrofonzugriff erforderlich')));
        return;
      }
      final dir = await getTemporaryDirectory();
      _recordPath = '${dir.path}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
      await _recorder!.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: _recordPath!);
      setState(() => _isRecording = true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Aufnahme-Fehler: $e')));
    }
  }

  Future<void> _stopRecordingAndSave() async {
    if (_recorder == null) return;
    await _recorder!.stop();
    setState(() => _isRecording = false);
    final path = _recordPath;
    if (path == null) return;
    // Upload voice file
    try {
      final bytes = await _readFileBytes(path);
      final storagePath = '${widget.projectId}/tasks/${_task['id']}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
      await SupabaseService.uploadFile(bucket: 'task-images', path: storagePath, bytes: bytes, contentType: 'audio/m4a');
      await SupabaseService.addTaskDoc(_task['id'], widget.projectId, {
        'documentation_type': 'voice',
        'content': '',
        'storage_path': storagePath,
        'file_name': 'voice_${DateTime.now().millisecondsSinceEpoch}.m4a',
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sprachaufnahme gespeichert')));
      _loadMedia();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload-Fehler: $e')));
    }
  }

  Future<void> _uploadVoiceFile() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.audio);
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    if (file.bytes == null && file.path == null) return;
    try {
      final bytes = file.bytes ?? await _readFileBytes(file.path!);
      final ext = file.extension ?? 'm4a';
      final storagePath = '${widget.projectId}/tasks/${_task['id']}/voice_${DateTime.now().millisecondsSinceEpoch}.$ext';
      await SupabaseService.uploadFile(bucket: 'task-images', path: storagePath, bytes: bytes, contentType: 'audio/$ext');
      await SupabaseService.addTaskDoc(_task['id'], widget.projectId, {
        'documentation_type': 'voice',
        'content': '',
        'storage_path': storagePath,
        'file_name': file.name,
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Audiodatei hochgeladen')));
      _loadMedia();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload-Fehler: $e')));
    }
  }

  Future<void> _uploadVideoFile() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.video);
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    if (file.bytes == null && file.path == null) return;
    try {
      final bytes = file.bytes ?? await _readFileBytes(file.path!);
      final ext = file.extension ?? 'mp4';
      final storagePath = '${widget.projectId}/tasks/${_task['id']}/video_${DateTime.now().millisecondsSinceEpoch}.$ext';
      await SupabaseService.uploadFile(bucket: 'task-images', path: storagePath, bytes: bytes, contentType: 'video/$ext');
      await SupabaseService.addTaskDoc(_task['id'], widget.projectId, {
        'documentation_type': 'video',
        'content': '',
        'storage_path': storagePath,
        'file_name': file.name,
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Video hochgeladen')));
      _loadMedia();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload-Fehler: $e')));
    }
  }

  Future<void> _recordVideo() async {
    final picker = ImagePicker();
    final video = await picker.pickVideo(source: ImageSource.camera);
    if (video == null) return;
    try {
      final bytes = await video.readAsBytes();
      final ext = video.name.split('.').last.toLowerCase();
      final storagePath = '${widget.projectId}/tasks/${_task['id']}/video_${DateTime.now().millisecondsSinceEpoch}.$ext';
      await SupabaseService.uploadFile(bucket: 'task-images', path: storagePath, bytes: bytes, contentType: 'video/$ext');
      await SupabaseService.addTaskDoc(_task['id'], widget.projectId, {
        'documentation_type': 'video',
        'content': '',
        'storage_path': storagePath,
        'file_name': video.name,
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Video gespeichert')));
      _loadMedia();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Fehler: $e')));
    }
  }

  Future<Uint8List> _readFileBytes(String filePath) async {
    try {
      return await File(filePath).readAsBytes();
    } catch (_) {
      return Uint8List(0);
    }
  }

  Future<void> _playVoice(Map<String, dynamic> doc) async {
    final docId = doc['id'] as String;
    final storagePath = doc['storage_path'] as String?;
    if (storagePath == null) return;
    if (_isPlaying && _playingDocId == docId) {
      await _player?.stop();
      setState(() { _isPlaying = false; _playingDocId = null; });
      return;
    }
    try {
      final url = SupabaseService.getTaskImageUrl(storagePath);
      _player ??= AudioPlayer();
      await _player!.setUrl(url);
      _player!.playerStateStream.listen((state) {
        if (state.processingState == ProcessingState.completed) {
          if (mounted) setState(() { _isPlaying = false; _playingDocId = null; });
        }
      });
      await _player!.play();
      setState(() { _isPlaying = true; _playingDocId = docId; });
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Wiedergabe-Fehler: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_editMode ? 'Bearbeiten' : (_task['title'] ?? 'Aufgabe'), overflow: TextOverflow.ellipsis),
        actions: [
          if (!_editMode) ...[
            if (widget.canEdit) IconButton(icon: const Icon(LucideIcons.edit2), onPressed: () => setState(() { _initForm(); _editMode = true; }), tooltip: 'Bearbeiten'),
            if (widget.canDelete) IconButton(
              icon: const Icon(LucideIcons.trash2, color: AppColors.danger),
              onPressed: () async {
                final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
                  title: const Text('Aufgabe l\u00f6schen'),
                  content: const Text('Wirklich l\u00f6schen?'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Nein')),
                    TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('L\u00f6schen', style: TextStyle(color: AppColors.danger))),
                  ],
                ));
                if (ok != true) return;
                await SupabaseService.deleteTask(_task['id']);
                widget.onRefresh();
                if (context.mounted) Navigator.pop(context);
              },
            ),
          ],
          if (_editMode) ...[
            TextButton(onPressed: _save, child: const Text('Speichern', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700))),
            IconButton(icon: const Icon(LucideIcons.x), onPressed: () { _initForm(); setState(() => _editMode = false); }),
          ],
        ],
        bottom: TabBar(controller: _tabs, tabs: [
          Tab(icon: const Icon(LucideIcons.info, size: 16), child: const Text('Info', style: TextStyle(fontSize: 12))),
          Tab(icon: const Icon(LucideIcons.image, size: 16), child: Text('Bilder (${_images.length})', style: const TextStyle(fontSize: 12))),
          Tab(icon: const Icon(LucideIcons.fileText, size: 16), child: Text('Doku (${_docs.length})', style: const TextStyle(fontSize: 12))),
        ]),
      ),
      body: TabBarView(controller: _tabs, children: [
        _editMode ? _editForm() : _infoTab(),
        _imagesTab(),
        _docsTab(),
      ]),
    );
  }

  // ── INFO TAB (read) ───────────────────────────────────────────────────────
  Widget _infoTab() {
    final dueDate     = _task['due_date']    as String?;
    final storyPoints = _task['story_points'];
    final createdAt   = _task['created_at']  as String?;

    return ListView(padding: const EdgeInsets.all(16), children: [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(_task['title'] ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.text))),
            const SizedBox(width: 8),
            Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: _priorityColor(_priority).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
              child: Text(_priorityLabel(_priority), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _priorityColor(_priority)))),
          ]),
          if ((_task['description'] as String?)?.isNotEmpty ?? false) ...[
            const SizedBox(height: 10),
            Text(_task['description'], style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.5)),
          ],
        ]),
      ),
      const SizedBox(height: 12),

      // Status
      _infoCard(LucideIcons.activity, 'Status', Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(color: _statusColor(_status).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
          child: Text(_statusLabel(_status), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _statusColor(_status)))),
        const SizedBox(height: 12),
        SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
          _statusBtn('open',        'Offen',          AppColors.textTertiary),
          _statusBtn('in_progress', 'In Bearbeitung', AppColors.warning),
          _statusBtn('done',        'Erledigt',       AppColors.success),
          _statusBtn('blocked',     'Blockiert',      AppColors.danger),
        ])),
      ])),
      const SizedBox(height: 12),

      // Priority
      _infoCard(LucideIcons.flag, 'Priorit\u00e4t', Row(children: _priorities.map((p) {
        final val = p['value'] as String; final label = p['label'] as String; final color = p['color'] as Color;
        final sel = _priority == val;
        return Expanded(child: GestureDetector(
          onTap: () async {
            setState(() => _priority = val);
            await SupabaseService.updateTask(_task['id'], {'priority': val});
            setState(() => _task = {..._task, 'priority': val});
            widget.onRefresh();
          },
          child: Container(margin: const EdgeInsets.symmetric(horizontal: 3), padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(color: sel ? color : color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8), border: Border.all(color: sel ? color : color.withValues(alpha: 0.3))),
            child: Center(child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: sel ? Colors.white : color)))),
        ));
      }).toList())),
      const SizedBox(height: 12),

      // Assigned
      _infoCard(LucideIcons.user, 'Zugewiesen an', _MemberPickerTile(
        selectedId: _assignedTo, members: widget.members,
        onTap: () async {
          final r = await _showDetailMemberPicker(context, _assignedTo, widget.members);
          if (r != null) {
            final newVal = r == '__none__' ? null : r;
            setState(() => _assignedTo = newVal);
            await SupabaseService.updateTask(_task['id'], {'assigned_to': newVal});
            setState(() => _task = {..._task, 'assigned_to': newVal});
            widget.onRefresh();
          }
        },
      )),
      const SizedBox(height: 12),

      // Details tile list
      Container(decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
        child: Column(children: [
          _detailTile(LucideIcons.calendar, 'F\u00e4lligkeitsdatum', dueDate != null ? _fmtDate(dueDate) : 'Nicht festgelegt', dueDate != null ? AppColors.primary : AppColors.textTertiary),
          const Divider(height: 1),
          _detailTile(LucideIcons.zap, 'Story Points', storyPoints != null ? '$storyPoints SP' : '–', storyPoints != null ? AppColors.primary : AppColors.textTertiary),
          const Divider(height: 1),
          _detailTile(
            _visibility == 'owner_only' ? LucideIcons.lock : _visibility == 'team_only' ? LucideIcons.userCheck : LucideIcons.users,
            'Sichtbarkeit',
            _visibility == 'owner_only' ? 'Nur ich' : _visibility == 'team_only' ? 'Nur mein Team' : 'Alle Teilnehmer',
            AppColors.textSecondary,
          ),
          if (createdAt != null) ...[const Divider(height: 1), _detailTile(LucideIcons.clock, 'Erstellt', _fmtDateTime(createdAt), AppColors.textTertiary)],
        ]),
      ),
      const SizedBox(height: 40),
    ]);
  }

  // ── EDIT FORM ─────────────────────────────────────────────────────────────
  Widget _editForm() {
    return ListView(padding: const EdgeInsets.all(16), children: [
      TextField(controller: _titleCtrl, decoration: const InputDecoration(labelText: 'Titel *')),
      const SizedBox(height: 14),
      TextField(controller: _descCtrl, maxLines: 4, decoration: const InputDecoration(labelText: 'Beschreibung')),
      const SizedBox(height: 18),
      const Text('Status', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
      const SizedBox(height: 8),
      SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
        _editStatusBtn('open',        'Offen',          AppColors.textTertiary),
        _editStatusBtn('in_progress', 'In Bearbeitung', AppColors.warning),
        _editStatusBtn('done',        'Erledigt',       AppColors.success),
        _editStatusBtn('blocked',     'Blockiert',      AppColors.danger),
      ])),
      const SizedBox(height: 18),
      const Text('Priorit\u00e4t', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
      const SizedBox(height: 8),
      Row(children: _priorities.map((p) {
        final val = p['value'] as String; final label = p['label'] as String; final color = p['color'] as Color; final sel = _priority == val;
        return Expanded(child: GestureDetector(onTap: () => setState(() => _priority = val), child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 3), padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(color: sel ? color : color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10), border: Border.all(color: sel ? color : color.withValues(alpha: 0.3), width: sel ? 2 : 1)),
          child: Center(child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: sel ? Colors.white : color))))));
      }).toList()),
      const SizedBox(height: 18),
      const Text('Zuweisen an', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
      const SizedBox(height: 8),
      _MemberPickerTile(selectedId: _assignedTo, members: widget.members, onTap: () async {
        final r = await _showDetailMemberPicker(context, _assignedTo, widget.members);
        if (r != null) setState(() => _assignedTo = r == '__none__' ? null : r);
      }),
      const SizedBox(height: 18),
      const Text('F\u00e4lligkeitsdatum', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
      const SizedBox(height: 8),
      GestureDetector(
        onTap: () async {
          final p = await showDatePicker(context: context, initialDate: _dueDate ?? DateTime.now().add(const Duration(days: 7)), firstDate: DateTime.now().subtract(const Duration(days: 365)), lastDate: DateTime.now().add(const Duration(days: 365 * 3)));
          if (p != null) setState(() => _dueDate = p);
        },
        child: Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(10), border: Border.all(color: _dueDate != null ? AppColors.primary : AppColors.border)),
          child: Row(children: [
            Icon(LucideIcons.calendar, size: 16, color: _dueDate != null ? AppColors.primary : AppColors.textSecondary),
            const SizedBox(width: 10),
            Text(_dueDate != null ? DateFormat('dd.MM.yyyy').format(_dueDate!) : 'Datum w\u00e4hlen', style: TextStyle(fontSize: 14, color: _dueDate != null ? AppColors.text : AppColors.textSecondary)),
            const Spacer(),
            if (_dueDate != null) GestureDetector(onTap: () => setState(() => _dueDate = null), child: const Icon(LucideIcons.x, size: 16, color: AppColors.textSecondary)),
          ]),
        ),
      ),
      const SizedBox(height: 18),
      const Text('Story Points', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
      const SizedBox(height: 8),
      TextField(controller: _spCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(hintText: '0')),
      const SizedBox(height: 18),
      const Text('Sichtbarkeit', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
      const SizedBox(height: 8),
      _VisibilityPickerTile(value: _visibility, onTap: () async {
        final r = await _showVisibilityPickerSheetStatic(context, _visibility);
        if (r != null) setState(() => _visibility = r);
      }),
      const SizedBox(height: 24),
      ElevatedButton(onPressed: _save, child: const Text('Speichern')),
      const SizedBox(height: 12),
      OutlinedButton(onPressed: () { _initForm(); setState(() => _editMode = false); }, child: const Text('Abbrechen')),
      const SizedBox(height: 40),
    ]);
  }

  // ── IMAGES TAB ────────────────────────────────────────────────────────────
  Widget _imagesTab() {
    return Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(16, 16, 16, 0), child: SizedBox(width: double.infinity, child: ElevatedButton.icon(
        icon: const Icon(LucideIcons.camera, size: 18), label: const Text('Bilder hinzuf\u00fcgen'), onPressed: _uploadImages))),
      const SizedBox(height: 12),
      if (_loadingMedia) const Expanded(child: Center(child: CircularProgressIndicator()))
      else if (_images.isEmpty) Expanded(child: Center(child: Container(
        margin: const EdgeInsets.all(24), padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
        child: const Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(LucideIcons.image, size: 52, color: AppColors.textTertiary), SizedBox(height: 12),
          Text('Noch keine Bilder', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
          SizedBox(height: 6),
          Text('Tippe oben um Bilder hinzuzuf\u00fcgen', style: TextStyle(fontSize: 13, color: AppColors.textTertiary, height: 1.5), textAlign: TextAlign.center),
        ]),
      )))
      else Expanded(child: GridView.builder(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, crossAxisSpacing: 10, mainAxisSpacing: 10, childAspectRatio: 1),
        itemCount: _images.length,
        itemBuilder: (_, i) {
          final img = _images[i];
          final url = SupabaseService.getTaskImageUrl(img['storage_path'] as String);
          return Stack(children: [
            GestureDetector(
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => Scaffold(
                backgroundColor: Colors.black,
                appBar: AppBar(backgroundColor: Colors.black, iconTheme: const IconThemeData(color: Colors.white)),
                body: Center(child: InteractiveViewer(child: Image.network(url, fit: BoxFit.contain))),
              ))),
              child: ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network(url, fit: BoxFit.cover, width: double.infinity, height: double.infinity,
                loadingBuilder: (_, child, p) => p == null ? child : Container(color: AppColors.border, child: const Center(child: CircularProgressIndicator(strokeWidth: 2))),
                errorBuilder: (_, __, ___) => Container(color: AppColors.border, child: const Center(child: Icon(LucideIcons.image, color: AppColors.textTertiary, size: 32))))),
            ),
            Positioned(top: 6, right: 6, child: GestureDetector(
              onTap: () async { await SupabaseService.deleteTaskImage(img['id'] as String, img['storage_path'] as String); _loadMedia(); },
              child: Container(decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle), padding: const EdgeInsets.all(6), child: const Icon(LucideIcons.trash2, size: 14, color: Colors.white)),
            )),
          ]);
        },
      )),
    ]);
  }

  // ── DOCS TAB ──────────────────────────────────────────────────────────────
  Widget _docsTab() {
    return Column(children: [
      // Collapsible doc input card
      Container(
        margin: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Header row — always visible
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
            child: Row(children: [
              const Icon(LucideIcons.filePlus, size: 16, color: AppColors.primary),
              const SizedBox(width: 8),
              const Expanded(child: Text('Neue Dokumentation', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text))),
              if (_docExpanded)
                GestureDetector(
                  onTap: () => setState(() { _docExpanded = false; }),
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(6)),
                    child: const Icon(LucideIcons.x, size: 16, color: AppColors.textSecondary),
                  ),
                ),
            ]),
          ),
          // Type buttons — always visible
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
            child: Row(children: [
              _docTypeBtn('text',  'Text',    LucideIcons.fileText),
              const SizedBox(width: 8),
              _docTypeBtn('voice', 'Sprache', LucideIcons.mic),
              const SizedBox(width: 8),
              _docTypeBtn('video', 'Video',   LucideIcons.video),
            ]),
          ),
          // Expandable input area
          AnimatedSize(
            duration: const Duration(milliseconds: 260),
            curve: Curves.easeInOut,
            child: _docExpanded
                ? Padding(
                    padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                    child: _docType == 'text'
                        ? _richTextInput()
                        : _docType == 'voice'
                            ? _voiceInput()
                            : _videoInput(),
                  )
                : const SizedBox.shrink(),
          ),
        ]),
      ),
      // Docs list
      if (_loadingMedia) const Expanded(child: Center(child: CircularProgressIndicator()))
      else if (_docs.isEmpty) Expanded(child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(LucideIcons.fileText, size: 48, color: AppColors.textTertiary),
        const SizedBox(height: 12),
        const Text('Noch keine Dokumentation', style: TextStyle(fontSize: 15, color: AppColors.textSecondary)),
      ])))
      else Expanded(child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
        itemCount: _docs.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) => _docEntry(_docs[i]),
      )),
    ]);
  }

  Widget _richTextInput() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // Formatting toolbar — shown above keyboard
      _RichTextToolbar(controller: _docBodyCtrl),
      const SizedBox(height: 8),
      TextField(
        controller: _docBodyCtrl,
        maxLines: 5,
        decoration: const InputDecoration(
          hintText: 'Dokumentationstext eingeben\u2026',
          border: OutlineInputBorder(),
          contentPadding: EdgeInsets.all(12),
        ),
      ),
      const SizedBox(height: 10),
      SizedBox(width: double.infinity, child: ElevatedButton.icon(
        icon: _savingDoc ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(LucideIcons.plus, size: 16),
        label: const Text('Hinzuf\u00fcgen'),
        onPressed: _savingDoc ? null : _addTextDoc,
      )),
    ]);
  }

  Widget _voiceInput() {
    return Column(children: [
      Row(children: [
        Expanded(child: ElevatedButton.icon(
          icon: Icon(_isRecording ? LucideIcons.stopCircle : LucideIcons.mic, size: 18, color: Colors.white),
          label: Text(_isRecording ? 'Aufnahme stoppen' : 'Aufnahme starten'),
          style: ElevatedButton.styleFrom(backgroundColor: _isRecording ? AppColors.danger : const Color(0xFFF59E0B)),
          onPressed: _isRecording ? _stopRecordingAndSave : _startRecording,
        )),
      ]),
      if (_isRecording) ...[
        const SizedBox(height: 10),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(width: 10, height: 10, decoration: BoxDecoration(color: AppColors.danger, shape: BoxShape.circle)),
          const SizedBox(width: 8),
          const Text('Aufnahme l\u00e4uft\u2026', style: TextStyle(fontSize: 13, color: AppColors.danger, fontWeight: FontWeight.w600)),
        ]),
      ],
      const SizedBox(height: 10),
      OutlinedButton.icon(
        icon: const Icon(LucideIcons.upload, size: 16),
        label: const Text('Audiodatei hochladen'),
        onPressed: _uploadVoiceFile,
      ),
    ]);
  }

  Widget _videoInput() {
    return Column(children: [
      Row(children: [
        Expanded(child: ElevatedButton.icon(
          icon: const Icon(LucideIcons.video, size: 18),
          label: const Text('Video aufnehmen'),
          onPressed: _recordVideo,
        )),
      ]),
      const SizedBox(height: 10),
      OutlinedButton.icon(
        icon: const Icon(LucideIcons.upload, size: 16),
        label: const Text('Video hochladen'),
        onPressed: _uploadVideoFile,
      ),
    ]);
  }

  Widget _docEntry(Map<String, dynamic> doc) {
    final type    = doc['documentation_type'] ?? 'text';
    final content = doc['content'] as String? ?? '';
    final storagePath = doc['storage_path'] as String?;
    final docId = doc['id'] as String;
    final isPlayingThis = _isPlaying && _playingDocId == docId;

    IconData typeIcon; String typeLabel; Color typeColor;
    switch (type) {
      case 'voice': typeIcon = LucideIcons.mic;      typeLabel = 'Sprachdokumentation'; typeColor = const Color(0xFFF59E0B); break;
      case 'video': typeIcon = LucideIcons.video;    typeLabel = 'Videodokumentation';  typeColor = const Color(0xFF8B5CF6); break;
      case 'image': typeIcon = LucideIcons.image;    typeLabel = 'Bilddokumentation';   typeColor = const Color(0xFF10B981); break;
      default:      typeIcon = LucideIcons.fileText; typeLabel = 'Textdokumentation';   typeColor = AppColors.primary;
    }

    // Author info (user_id present in doc from addTaskDoc)
    final userId = doc['user_id'] as String?;
    String authorName = '';
    if (userId != null) {
      for (final m in widget.members) {
        final p = m['profiles'] as Map<String, dynamic>?;
        if (p?['id'] == userId) {
          final n = p?['display_name'] ?? '${p?['first_name'] ?? ''} ${p?['last_name'] ?? ''}'.trim();
          authorName = n.isNotEmpty ? n : (p?['email'] as String? ?? '');
          break;
        }
      }
    }

    return Container(
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
      child: Column(children: [
        // Header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(color: AppColors.background, borderRadius: const BorderRadius.vertical(top: Radius.circular(12)), border: Border(bottom: BorderSide(color: AppColors.border))),
          child: Row(children: [
            Container(width: 32, height: 32, decoration: BoxDecoration(color: typeColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)), child: Icon(typeIcon, size: 16, color: typeColor)),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(typeLabel, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text)),
              Row(children: [
                Text(_fmtDateTime(doc['created_at'] as String?), style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                if (authorName.isNotEmpty) ...[
                  const Text(' \u2022 ', style: TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                  Text(authorName, style: const TextStyle(fontSize: 11, color: AppColors.textTertiary, fontWeight: FontWeight.w500)),
                ],
              ]),
            ])),
            if (type == 'voice' && storagePath != null)
              GestureDetector(
                onTap: () => _playVoice(doc),
                child: Container(padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(color: isPlayingThis ? const Color(0xFFF59E0B).withValues(alpha: 0.15) : AppColors.surface, borderRadius: BorderRadius.circular(8), border: Border.all(color: isPlayingThis ? const Color(0xFFF59E0B) : AppColors.border)),
                  child: Icon(isPlayingThis ? LucideIcons.pause : LucideIcons.play, size: 16, color: isPlayingThis ? const Color(0xFFF59E0B) : AppColors.primary)),
              ),
            const SizedBox(width: 6),
            GestureDetector(
              onTap: () => SupabaseService.deleteTaskDoc(docId).then((_) => _loadMedia()),
              child: Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: AppColors.danger.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)), child: const Icon(LucideIcons.trash2, size: 14, color: AppColors.danger)),
            ),
          ]),
        ),
        // Content
        if (content.isNotEmpty)
          Padding(padding: const EdgeInsets.all(14), child: Align(alignment: Alignment.centerLeft,
            child: content.contains('<') && content.contains('>')
                ? Html(data: content, style: {'body': Style(margin: Margins.zero, padding: HtmlPaddings.zero, color: AppColors.text)})
                : Text(content, style: const TextStyle(fontSize: 14, color: AppColors.text, height: 1.5)))),
        if (type == 'video' && storagePath != null)
          Padding(padding: const EdgeInsets.fromLTRB(14, 0, 14, 14), child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(8), border: Border.all(color: AppColors.border)),
            child: Row(children: [
              const Icon(LucideIcons.playCircle, size: 20, color: Color(0xFF8B5CF6)),
              const SizedBox(width: 8),
              Expanded(child: Text(doc['file_name'] as String? ?? 'Video', style: const TextStyle(fontSize: 13, color: AppColors.text), overflow: TextOverflow.ellipsis)),
            ]),
          )),
      ]),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  Widget _statusBtn(String val, String label, Color color) {
    final sel = _status == val;
    return GestureDetector(
      onTap: () async {
        setState(() { _status = val; _task = {..._task, 'status': val}; });
        await SupabaseService.updateTask(_task['id'], {'status': val});
        widget.onRefresh();
      },
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(color: sel ? color : color.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(20), border: Border.all(color: sel ? color : color.withValues(alpha: 0.3))),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 7, height: 7, decoration: BoxDecoration(color: sel ? Colors.white : color, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: sel ? Colors.white : color)),
        ]),
      ),
    );
  }

  Widget _editStatusBtn(String val, String label, Color color) {
    final sel = _status == val;
    return GestureDetector(
      onTap: () => setState(() => _status = val),
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(color: sel ? color : color.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(20), border: Border.all(color: sel ? color : color.withValues(alpha: 0.3))),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 7, height: 7, decoration: BoxDecoration(color: sel ? Colors.white : color, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: sel ? Colors.white : color)),
        ]),
      ),
    );
  }

  Widget _docTypeBtn(String type, String label, IconData icon) {
    final active = _docType == type && _docExpanded;
    return Expanded(child: GestureDetector(
      onTap: () => setState(() { _docType = type; _docExpanded = true; }),
      child: Container(padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(color: active ? AppColors.primary.withValues(alpha: 0.1) : AppColors.background, borderRadius: BorderRadius.circular(10), border: Border.all(color: active ? AppColors.primary : AppColors.border, width: active ? 2 : 1)),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 18, color: active ? AppColors.primary : AppColors.textSecondary),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: active ? AppColors.primary : AppColors.textSecondary)),
        ]),
      ),
    ));
  }

  Widget _infoCard(IconData icon, String label, Widget child) => Container(
    width: double.infinity, padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Icon(icon, size: 15, color: AppColors.textTertiary), const SizedBox(width: 6), Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textTertiary))]),
      const SizedBox(height: 8), child,
    ]),
  );

  Widget _detailTile(IconData icon, String label, String value, Color color) {
    return Padding(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12), child: Row(children: [
      Container(width: 32, height: 32, decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)), child: Icon(icon, size: 15, color: color)),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.textTertiary)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
      ])),
    ]));
  }
}

// ── Rich Text Toolbar ─────────────────────────────────────────────────────────
class _RichTextToolbar extends StatelessWidget {
  final TextEditingController controller;
  const _RichTextToolbar({required this.controller});

  void _wrap(String tag) {
    final sel = controller.selection;
    if (!sel.isValid) return;
    final text = controller.text;
    final before = text.substring(0, sel.start);
    final selected = text.substring(sel.start, sel.end);
    final after = text.substring(sel.end);
    final newText = '$before<$tag>$selected</$tag>$after';
    controller.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: sel.start + tag.length + 2 + selected.length),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(8), border: Border.all(color: AppColors.border)),
      child: SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
        _ToolbarBtn(label: 'B', tooltip: 'Fett', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14), onTap: () => _wrap('strong')),
        _ToolbarBtn(label: 'I', tooltip: 'Kursiv', style: const TextStyle(fontStyle: FontStyle.italic, fontSize: 14), onTap: () => _wrap('em')),
        _ToolbarBtn(label: 'U', tooltip: 'Unterstrichen', style: const TextStyle(decoration: TextDecoration.underline, fontSize: 14), onTap: () => _wrap('u')),
        _ToolbarBtn(label: 'H1', tooltip: '\u00dcberschrift 1', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12), onTap: () => _wrap('h3')),
        _ToolbarBtn(label: '• Liste', tooltip: 'Aufz\u00e4hlung', style: const TextStyle(fontSize: 12), onTap: () => _wrap('li')),
      ])),
    );
  }
}

class _ToolbarBtn extends StatelessWidget {
  final String label;
  final String tooltip;
  final TextStyle? style;
  final VoidCallback onTap;
  const _ToolbarBtn({required this.label, required this.tooltip, this.style, required this.onTap});
  @override
  Widget build(BuildContext context) => Tooltip(
    message: tooltip,
    child: GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 3),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(6), border: Border.all(color: AppColors.border)),
        child: Text(label, style: style ?? const TextStyle(fontSize: 13)),
      ),
    ),
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// REUSABLE WIDGETS
// ═════════════════════════════════════════════════════════════════════════════
class _MemberPickerTile extends StatelessWidget {
  final String? selectedId;
  final List<Map<String, dynamic>> members;
  final VoidCallback onTap;
  const _MemberPickerTile({required this.selectedId, required this.members, required this.onTap});

  @override
  Widget build(BuildContext context) {
    Map<String, dynamic>? profile;
    if (selectedId != null) {
      for (final m in members) {
        final p = m['profiles'] as Map<String, dynamic>?;
        if (p?['id'] == selectedId) { profile = p; break; }
      }
    }
    final firstName   = profile?['first_name']   as String? ?? '';
    final lastName    = profile?['last_name']    as String? ?? '';
    final displayName = profile?['display_name'] as String?;
    final email       = profile?['email']        as String? ?? '';
    final name = (displayName?.isNotEmpty ?? false) ? displayName! : ('$firstName $lastName'.trim().isNotEmpty ? '$firstName $lastName'.trim() : email);
    final initials = name.isNotEmpty ? name.trim().split(' ').where((s) => s.isNotEmpty).take(2).map((s) => s[0].toUpperCase()).join() : '?';
    return GestureDetector(
      onTap: onTap,
      child: Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
        child: Row(children: [
          if (selectedId != null && profile != null) ...[
            Container(width: 28, height: 28, decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.15), shape: BoxShape.circle), child: Center(child: Text(initials, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary)))),
            const SizedBox(width: 10),
            Expanded(child: Text(name, style: const TextStyle(fontSize: 14, color: AppColors.text, fontWeight: FontWeight.w500))),
          ] else ...[
            Container(width: 28, height: 28, decoration: BoxDecoration(color: AppColors.border, shape: BoxShape.circle), child: const Icon(LucideIcons.userX, size: 14, color: AppColors.textSecondary)),
            const SizedBox(width: 10),
            const Expanded(child: Text('Nicht zugewiesen', style: TextStyle(fontSize: 14, color: AppColors.textSecondary))),
          ],
          const Icon(LucideIcons.chevronDown, size: 16, color: AppColors.textTertiary),
        ]),
      ),
    );
  }
}

class _VisibilityPickerTile extends StatelessWidget {
  final String value;
  final VoidCallback onTap;
  const _VisibilityPickerTile({required this.value, required this.onTap});
  @override
  Widget build(BuildContext context) {
    final label = value == 'owner_only' ? 'Nur ich' : value == 'team_only' ? 'Nur mein Team' : 'Alle Teilnehmer';
    final icon  = value == 'owner_only' ? LucideIcons.lock : value == 'team_only' ? LucideIcons.userCheck : LucideIcons.users;
    return GestureDetector(
      onTap: onTap,
      child: Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
        child: Row(children: [
          Icon(icon, size: 16, color: AppColors.primary),
          const SizedBox(width: 10),
          Expanded(child: Text(label, style: const TextStyle(fontSize: 14, color: AppColors.text, fontWeight: FontWeight.w500))),
          const Icon(LucideIcons.chevronDown, size: 16, color: AppColors.textTertiary),
        ]),
      ),
    );
  }
}

Future<String?> _showDetailMemberPicker(BuildContext ctx, String? currentId, List<Map<String, dynamic>> members) {
  return showModalBottomSheet<String>(
    context: ctx, backgroundColor: Colors.transparent, isScrollControlled: true,
    builder: (_) => Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.7),
      decoration: const BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const SizedBox(height: 12),
        Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
        const SizedBox(height: 16),
        const Text('Mitglied ausw\u00e4hlen', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
        const SizedBox(height: 8),
        const Divider(height: 1),
        Flexible(child: ListView(shrinkWrap: true, children: [
          ListTile(
            leading: Container(width: 36, height: 36, decoration: BoxDecoration(color: AppColors.border, shape: BoxShape.circle), child: const Icon(LucideIcons.userX, size: 18, color: AppColors.textSecondary)),
            title: const Text('Nicht zugewiesen', style: TextStyle(fontSize: 14, color: AppColors.textSecondary)),
            trailing: currentId == null ? const Icon(LucideIcons.check, size: 18, color: AppColors.primary) : null,
            onTap: () => Navigator.pop(ctx, '__none__'),
          ),
          ...members.map((m) {
            final profile = m['profiles'] as Map<String, dynamic>?;
            final uid = profile?['id'] as String? ?? '';
            final dn = profile?['display_name'] as String?;
            final fn = profile?['first_name'] as String? ?? '';
            final ln = profile?['last_name']  as String? ?? '';
            final em = profile?['email']      as String? ?? '';
            final name = (dn?.isNotEmpty ?? false) ? dn! : ('$fn $ln'.trim().isNotEmpty ? '$fn $ln'.trim() : em);
            final initials = name.isNotEmpty ? name.trim().split(' ').where((s) => s.isNotEmpty).take(2).map((s) => s[0].toUpperCase()).join() : '?';
            return ListTile(
              leading: Container(width: 36, height: 36, decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.15), shape: BoxShape.circle), child: Center(child: Text(initials, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primary)))),
              title: Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.text)),
              subtitle: em.isNotEmpty ? Text(em, style: const TextStyle(fontSize: 12, color: AppColors.textTertiary)) : null,
              trailing: currentId == uid ? const Icon(LucideIcons.check, size: 18, color: AppColors.primary) : null,
              onTap: () => Navigator.pop(ctx, uid),
            );
          }),
        ])),
        const SizedBox(height: 16),
      ]),
    ),
  );
}

Future<String?> _showVisibilityPickerSheetStatic(BuildContext ctx, String current) async {
  const options = [
    {'value': 'all_participants', 'label': 'Alle Teilnehmer', 'sub': 'Alle Projektmitglieder k\u00f6nnen sehen', 'icon': LucideIcons.users},
    {'value': 'team_only',       'label': 'Nur mein Team',   'sub': 'Nur Teammitglieder k\u00f6nnen sehen',   'icon': LucideIcons.userCheck},
    {'value': 'owner_only',      'label': 'Nur ich',         'sub': 'Nur ich (Eigent\u00fcmer) kann sehen',   'icon': LucideIcons.lock},
  ];
  return showModalBottomSheet<String>(
    context: ctx, backgroundColor: Colors.transparent,
    builder: (_) => Container(
      decoration: const BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const SizedBox(height: 12),
        Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
        const SizedBox(height: 16),
        const Text('Sichtbarkeit', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
        const SizedBox(height: 8),
        const Divider(height: 1),
        ...options.map((o) {
          final val = o['value'] as String; final label = o['label'] as String;
          final sub = o['sub'] as String; final icon = o['icon'] as IconData;
          final isSel = current == val;
          return ListTile(
            leading: Container(width: 36, height: 36, decoration: BoxDecoration(color: isSel ? AppColors.primary.withValues(alpha: 0.1) : AppColors.background, shape: BoxShape.circle), child: Icon(icon, size: 18, color: isSel ? AppColors.primary : AppColors.textSecondary)),
            title: Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isSel ? AppColors.primary : AppColors.text)),
            subtitle: Text(sub, style: const TextStyle(fontSize: 12, color: AppColors.textTertiary)),
            trailing: isSel ? const Icon(LucideIcons.check, size: 18, color: AppColors.primary) : null,
            onTap: () => Navigator.pop(ctx, val),
          );
        }),
        const SizedBox(height: 16),
      ]),
    ),
  );
}
