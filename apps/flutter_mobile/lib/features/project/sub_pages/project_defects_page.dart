import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:intl/intl.dart';

import '../../../core/services/supabase_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/burger_menu_leading.dart';

// ══════════════════════════════════════════════════════════════════════════════
// PRIORITY / STATUS HELPERS
// ══════════════════════════════════════════════════════════════════════════════

Color _defPriorityColor(String? p) {
  switch (p) {
    case 'critical': return const Color(0xFFDC2626);
    case 'high':     return const Color(0xFFF59E0B);
    case 'low':      return const Color(0xFF10B981);
    default:         return const Color(0xFF3B82F6);
  }
}

String _defPriorityLabel(String? p) {
  switch (p) {
    case 'critical': return 'Kritisch';
    case 'high':     return 'Hoch';
    case 'low':      return 'Niedrig';
    default:         return 'Mittel';
  }
}

Color _defStatusColor(String? s) {
  switch (s) {
    case 'open':        return const Color(0xFF3B82F6);
    case 'in_progress': return const Color(0xFFF59E0B);
    case 'resolved':    return const Color(0xFF10B981);
    case 'rejected':    return const Color(0xFF94A3B8);
    default:            return const Color(0xFF94A3B8);
  }
}

String _defStatusLabel(String? s) {
  switch (s) {
    case 'open':        return 'Offen';
    case 'in_progress': return 'In Bearbeitung';
    case 'resolved':    return 'Behoben';
    case 'rejected':    return 'Abgelehnt';
    default:            return s ?? '';
  }
}

String _defVisibilityLabel(String? v) {
  switch (v) {
    case 'private': return 'Privat';
    case 'public':  return 'Öffentlich';
    default:        return 'Team';
  }
}

IconData _defVisibilityIcon(String? v) {
  switch (v) {
    case 'private': return LucideIcons.lock;
    case 'public':  return LucideIcons.globe;
    default:        return LucideIcons.users;
  }
}

String _fmtDateTime(String? d) {
  if (d == null) return '';
  try { return DateFormat('dd.MM.yyyy HH:mm').format(DateTime.parse(d)); }
  catch (_) { return d; }
}

String _fmtDate(String? d) {
  if (d == null) return '';
  try { return DateFormat('dd.MM.yyyy').format(DateTime.parse(d)); }
  catch (_) { return d; }
}

const _dPriorities = [
  {'value': 'low',      'label': 'Niedrig',  'color': Color(0xFF10B981)},
  {'value': 'medium',   'label': 'Mittel',   'color': Color(0xFF3B82F6)},
  {'value': 'high',     'label': 'Hoch',     'color': Color(0xFFF59E0B)},
  {'value': 'critical', 'label': 'Kritisch', 'color': Color(0xFFDC2626)},
];


// ══════════════════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════════════════

class ProjectDefectsPage extends StatefulWidget {
  final String projectId;
  const ProjectDefectsPage({super.key, required this.projectId});
  @override
  State<ProjectDefectsPage> createState() => _ProjectDefectsPageState();
}

class _ProjectDefectsPageState extends State<ProjectDefectsPage> {
  bool _loading = true;
  List<Map<String, dynamic>> _defects = [];
  List<Map<String, dynamic>> _members = [];
  String _statusFilter = 'alle';
  String _priorityFilter = 'alle';
  bool _searchOpen = false;
  String _search = '';
  final _searchCtrl = TextEditingController();
  final _searchFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final defects = await SupabaseService.getTasks(widget.projectId, taskType: 'defect');
      debugPrint('[Defects] loaded ${defects.length} defects');
      if (mounted) setState(() { _defects = defects; _loading = false; });
    } catch (e) {
      debugPrint('[Defects] getTasks error: $e');
      if (mounted) setState(() => _loading = false);
    }
    try {
      final members = await SupabaseService.getProjectMembers(widget.projectId);
      debugPrint('[Defects] loaded ${members.length} members');
      if (mounted) setState(() => _members = members);
    } catch (e) {
      debugPrint('[Defects] getProjectMembers error: $e');
    }
  }

  List<Map<String, dynamic>> get _filtered {
    var list = _defects;
    if (_statusFilter != 'alle')   list = list.where((d) => d['status']   == _statusFilter).toList();
    if (_priorityFilter != 'alle') list = list.where((d) => d['priority'] == _priorityFilter).toList();
    if (_search.isNotEmpty) {
      final q = _search.toLowerCase();
      list = list.where((d) =>
        (d['title']       as String? ?? '').toLowerCase().contains(q) ||
        (d['description'] as String? ?? '').toLowerCase().contains(q) ||
        (d['location']    as String? ?? '').toLowerCase().contains(q),
      ).toList();
    }
    return list;
  }

  // ── pickers ────────────────────────────────────────────────────────────────

  Future<String?> _showMemberPickerSheet(BuildContext ctx, String? currentId) {
    return showModalBottomSheet<String>(
      context: ctx,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.7),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 16),
            const Text('Mitglied auswählen', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
            const SizedBox(height: 8),
            const Divider(height: 1),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  ListTile(
                    leading: Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(color: AppColors.border, shape: BoxShape.circle),
                      child: const Icon(LucideIcons.userX, size: 18, color: AppColors.textSecondary),
                    ),
                    title: const Text('Nicht zugewiesen', style: TextStyle(fontSize: 14, color: AppColors.textSecondary)),
                    trailing: currentId == null ? const Icon(LucideIcons.check, size: 18, color: AppColors.primary) : null,
                    onTap: () => Navigator.pop(ctx, '__none__'),
                  ),
                  ..._members.map((m) {
                    final profile     = m['profiles']      as Map<String, dynamic>?;
                    final firstName   = profile?['first_name']   as String? ?? '';
                    final lastName    = profile?['last_name']    as String? ?? '';
                    final displayName = profile?['display_name'] as String?;
                    final email       = profile?['email']        as String? ?? '';
                    final uid         = profile?['id']           as String? ?? '';
                    final name = (displayName?.isNotEmpty ?? false)
                        ? displayName!
                        : ('$firstName $lastName'.trim().isNotEmpty ? '$firstName $lastName'.trim() : email);
                    final initials = name.isNotEmpty
                        ? name.trim().split(' ').where((s) => s.isNotEmpty).take(2).map((s) => s[0].toUpperCase()).join()
                        : '?';
                    final isSelected = currentId == uid;
                    return ListTile(
                      leading: Container(
                        width: 36, height: 36,
                        decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.15), shape: BoxShape.circle),
                        child: Center(child: Text(initials, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primary))),
                      ),
                      title: Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.text)),
                      subtitle: email.isNotEmpty ? Text(email, style: const TextStyle(fontSize: 12, color: AppColors.textTertiary)) : null,
                      trailing: isSelected ? const Icon(LucideIcons.check, size: 18, color: AppColors.primary) : null,
                      onTap: () => Navigator.pop(ctx, uid),
                    );
                  }),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Future<String?> _showVisibilityPickerSheet(BuildContext ctx, String current) {
    const options = [
      {'value': 'team',    'label': 'Team',         'sub': 'Nur für Projektmitglieder', 'icon': LucideIcons.users},
      {'value': 'private', 'label': 'Privat',       'sub': 'Nur für mich sichtbar',    'icon': LucideIcons.lock},
      {'value': 'public',  'label': 'Öffentlich',   'sub': 'Für alle sichtbar',        'icon': LucideIcons.globe},
    ];
    return showModalBottomSheet<String>(
      context: ctx,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 16),
            const Text('Sichtbarkeit', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
            const SizedBox(height: 8),
            const Divider(height: 1),
            ...options.map((o) {
              final val   = o['value'] as String;
              final label = o['label'] as String;
              final sub   = o['sub']   as String;
              final icon  = o['icon']  as IconData;
              final isSel = current == val;
              return ListTile(
                leading: Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    color: isSel ? AppColors.primary.withValues(alpha: 0.1) : AppColors.background,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, size: 18, color: isSel ? AppColors.primary : AppColors.textSecondary),
                ),
                title: Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isSel ? AppColors.primary : AppColors.text)),
                subtitle: Text(sub, style: const TextStyle(fontSize: 12, color: AppColors.textTertiary)),
                trailing: isSel ? const Icon(LucideIcons.check, size: 18, color: AppColors.primary) : null,
                onTap: () => Navigator.pop(ctx, val),
              );
            }),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  // ── build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final open     = _defects.where((d) => d['status'] == 'open').length;
    final critical = _defects.where((d) => d['priority'] == 'critical').length;
    final resolved = _defects.where((d) => d['status'] == 'resolved').length;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: burgerMenuLeading(context),
        title: const Text('Mängel'),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showCreateSheet(context),
        backgroundColor: const Color(0xFFDC2626),
        child: const Icon(LucideIcons.plus, color: Colors.white),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // ── Top bar: stats + search icon ──
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Row(children: [
                    _miniStat('Offen',    open,            const Color(0xFF3B82F6)),
                    const SizedBox(width: 8),
                    _miniStat('Kritisch', critical,        const Color(0xFFDC2626)),
                    const SizedBox(width: 8),
                    _miniStat('Behoben',  resolved,        const Color(0xFF10B981)),
                    const SizedBox(width: 8),
                    _miniStat('Gesamt',   _defects.length, AppColors.textSecondary),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: () {
                        setState(() {
                          _searchOpen = !_searchOpen;
                          if (_searchOpen) {
                            Future.microtask(() => _searchFocusNode.requestFocus());
                          } else {
                            _searchCtrl.clear();
                            _search = '';
                            _searchFocusNode.unfocus();
                          }
                        });
                      },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: _searchOpen
                              ? const Color(0xFFDC2626).withValues(alpha: 0.1)
                              : AppColors.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: _searchOpen
                                ? const Color(0xFFDC2626).withValues(alpha: 0.4)
                                : AppColors.border,
                          ),
                        ),
                        child: Icon(
                          _searchOpen ? LucideIcons.x : LucideIcons.search,
                          size: 17,
                          color: _searchOpen
                              ? const Color(0xFFDC2626)
                              : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ]),
                ),
                // ── Expandable search bar ──
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
                            style: const TextStyle(fontSize: 14, color: AppColors.text),
                            decoration: InputDecoration(
                              hintText: 'Mängel durchsuchen…',
                              hintStyle: const TextStyle(fontSize: 13),
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              prefixIcon: const Icon(LucideIcons.search, size: 16),
                              suffixIcon: _search.isNotEmpty
                                  ? IconButton(
                                      icon: const Icon(LucideIcons.x, size: 16),
                                      onPressed: () {
                                        _searchCtrl.clear();
                                        setState(() => _search = '');
                                      },
                                    )
                                  : null,
                              border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: AppColors.border)),
                              enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: AppColors.border)),
                              focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: Color(0xFFDC2626))),
                            ),
                          ),
                        )
                      : const SizedBox.shrink(),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  height: 36,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    children: [
                      _sChip('alle',        'Alle'),
                      _sChip('open',        'Offen'),
                      _sChip('in_progress', 'In Bearb.'),
                      _sChip('resolved',    'Behoben'),
                      _sChip('rejected',    'Abgelehnt'),
                      Container(width: 1, height: 24, margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 6), color: AppColors.border),
                      _pChip('alle',     'Alle',     null),
                      _pChip('critical', 'Kritisch', const Color(0xFFDC2626)),
                      _pChip('high',     'Hoch',     const Color(0xFFF59E0B)),
                      _pChip('medium',   'Mittel',   const Color(0xFF3B82F6)),
                      _pChip('low',      'Niedrig',  const Color(0xFF10B981)),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _load,
                    child: _filtered.isEmpty
                        ? ListView(children: [
                            const SizedBox(height: 100),
                            Center(child: Column(children: [
                              Icon(
                                _search.isNotEmpty ? LucideIcons.searchX : LucideIcons.alertTriangle,
                                size: 48, color: AppColors.textTertiary,
                              ),
                              const SizedBox(height: 12),
                              Text(
                                _search.isNotEmpty ? 'Keine Treffer' : 'Keine Mängel',
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                              ),
                            ])),
                          ])
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                            itemCount: _filtered.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 8),
                            itemBuilder: (_, i) => _DefectCard(
                              defect: _filtered[i],
                              members: _members,
                              projectId: widget.projectId,
                              onRefresh: _load,
                            ),
                          ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _sChip(String v, String l) {
    final sel = _statusFilter == v;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: ChoiceChip(
        label: Text(l, style: TextStyle(fontSize: 12, color: sel ? Colors.white : AppColors.textSecondary, fontWeight: sel ? FontWeight.w600 : FontWeight.w500)),
        selected: sel, selectedColor: const Color(0xFFDC2626), backgroundColor: AppColors.surface,
        padding: const EdgeInsets.symmetric(horizontal: 4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: BorderSide(color: sel ? const Color(0xFFDC2626) : AppColors.border)),
        onSelected: (_) => setState(() => _statusFilter = v),
      ),
    );
  }

  Widget _pChip(String v, String l, Color? dot) {
    final sel = _priorityFilter == v;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: ChoiceChip(
        label: Row(mainAxisSize: MainAxisSize.min, children: [
          if (dot != null) ...[Container(width: 7, height: 7, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)), const SizedBox(width: 5)],
          Text(l, style: TextStyle(fontSize: 12, color: sel ? Colors.white : AppColors.textSecondary, fontWeight: sel ? FontWeight.w600 : FontWeight.w500)),
        ]),
        selected: sel, selectedColor: dot ?? const Color(0xFFDC2626), backgroundColor: AppColors.surface,
        padding: const EdgeInsets.symmetric(horizontal: 4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: BorderSide(color: sel ? (dot ?? const Color(0xFFDC2626)) : AppColors.border)),
        onSelected: (_) => setState(() => _priorityFilter = v),
      ),
    );
  }

  Widget _miniStat(String l, int c, Color col) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
      child: Column(children: [
        Text('$c', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: col)),
        const SizedBox(height: 2),
        Text(l, style: const TextStyle(fontSize: 10, color: AppColors.textSecondary)),
      ]),
    ),
  );

  void _showCreateSheet(BuildContext ctx) {
    final titleCtrl    = TextEditingController();
    final descCtrl     = TextEditingController();
    final locationCtrl = TextEditingController();
    String priority   = 'medium';
    String visibility = 'team';
    String? assignedTo;
    DateTime? dueDate;
    List<({String name, Uint8List bytes})> pendingImages = [];

    showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, ss) => Container(
          constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.92),
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).viewInsets.bottom + 24),
                  children: [
                    const Text('Neuer Mangel', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.text)),
                    const SizedBox(height: 20),
                    TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Titel *')),
                    const SizedBox(height: 14),
                    TextField(controller: descCtrl, maxLines: 3, decoration: const InputDecoration(labelText: 'Beschreibung')),
                    const SizedBox(height: 14),
                    TextField(controller: locationCtrl, decoration: const InputDecoration(labelText: 'Ort / Bereich')),
                    const SizedBox(height: 18),
                    const Text('Priorität', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
                    const SizedBox(height: 8),
                    Row(
                      children: _dPriorities.map((p) {
                        final val = p['value'] as String;
                        final lbl = p['label'] as String;
                        final col = p['color'] as Color;
                        final sel = priority == val;
                        return Expanded(
                          child: GestureDetector(
                            onTap: () => ss(() => priority = val),
                            child: Container(
                              margin: const EdgeInsets.symmetric(horizontal: 3),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              decoration: BoxDecoration(
                                color: sel ? col : col.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: sel ? col : col.withValues(alpha: 0.3), width: sel ? 2 : 1),
                              ),
                              child: Center(child: Text(lbl, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: sel ? Colors.white : col))),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 18),
                    const Text('Zuweisen an', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
                    const SizedBox(height: 8),
                    _DefMemberPickerTile(
                      selectedId: assignedTo,
                      members: _members,
                      onTap: () async {
                        final result = await _showMemberPickerSheet(context, assignedTo);
                        if (result != null) ss(() => assignedTo = result == '__none__' ? null : result);
                      },
                    ),
                    const SizedBox(height: 18),
                    const Text('Fälligkeitsdatum', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: dueDate ?? DateTime.now().add(const Duration(days: 7)),
                          firstDate: DateTime.now().subtract(const Duration(days: 365)),
                          lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
                        );
                        if (picked != null) ss(() => dueDate = picked);
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                        decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
                        child: Row(children: [
                          Icon(LucideIcons.calendar, size: 16, color: dueDate != null ? AppColors.primary : AppColors.textSecondary),
                          const SizedBox(width: 10),
                          Text(dueDate != null ? DateFormat('dd.MM.yyyy').format(dueDate!) : 'Datum wählen',
                              style: TextStyle(fontSize: 14, color: dueDate != null ? AppColors.text : AppColors.textSecondary)),
                          const Spacer(),
                          if (dueDate != null)
                            GestureDetector(
                              onTap: () => ss(() => dueDate = null),
                              child: const Icon(LucideIcons.x, size: 16, color: AppColors.textSecondary),
                            ),
                        ]),
                      ),
                    ),
                    const SizedBox(height: 18),
                    const Text('Sichtbarkeit', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
                    const SizedBox(height: 8),
                    _DefVisibilityPickerTile(
                      value: visibility,
                      onTap: () async {
                        final result = await _showVisibilityPickerSheet(context, visibility);
                        if (result != null) ss(() => visibility = result);
                      },
                    ),
                    const SizedBox(height: 18),

                    // ── Photos ───────────────────────────────────────────────
                    const Text('Bilder hinzufügen', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
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
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          color: AppColors.danger.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
                        ),
                        child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          Icon(LucideIcons.camera, size: 18, color: AppColors.danger),
                          SizedBox(width: 8),
                          Text('Bilder aus Galerie wählen', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.danger)),
                        ]),
                      ),
                    ),
                    if (pendingImages.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      SizedBox(
                        height: 90,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: pendingImages.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 8),
                          itemBuilder: (_, i) => Stack(children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.memory(pendingImages[i].bytes, width: 80, height: 80, fit: BoxFit.cover),
                            ),
                            Positioned(top: 2, right: 2, child: GestureDetector(
                              onTap: () => ss(() {
                                final l = List.of(pendingImages);
                                l.removeAt(i);
                                pendingImages = l;
                              }),
                              child: Container(
                                width: 20, height: 20,
                                decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                                child: const Icon(LucideIcons.x, size: 12, color: Colors.white),
                              ),
                            )),
                          ]),
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () async {
                          if (titleCtrl.text.trim().isEmpty) return;
                          final taskId = await SupabaseService.createTaskWithReturn(widget.projectId, {
                            'title':       titleCtrl.text.trim(),
                            'description': descCtrl.text.trim(),
                            'location':    locationCtrl.text.trim(),
                            'priority':    priority,
                            'status':      'open',
                            'task_type':   'defect',
                            'visibility':  visibility,
                            if (assignedTo != null) 'assigned_to': assignedTo,
                            if (dueDate != null) 'due_date': dueDate!.toIso8601String().split('T')[0],
                          });
                          // Upload pending images
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
                          if (context.mounted) Navigator.pop(context);
                          _load();
                        },
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
                        child: const Text('Mangel erstellen'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DEFECT CARD
// ══════════════════════════════════════════════════════════════════════════════

class _DefectCard extends StatelessWidget {
  final Map<String, dynamic> defect;
  final List<Map<String, dynamic>> members;
  final String projectId;
  final VoidCallback onRefresh;
  const _DefectCard({required this.defect, required this.members, required this.projectId, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    final status     = defect['status']   ?? 'open';
    final priority   = defect['priority'] ?? 'medium';
    final location   = defect['location'] as String?;
    final dueDate    = defect['due_date'] as String?;
    final assignedTo = defect['assigned_to'] as String?;
    final isOverdue  = dueDate != null &&
        DateTime.tryParse(dueDate)?.isBefore(DateTime.now()) == true &&
        status != 'resolved';

    String? assigneeName;
    if (assignedTo != null) {
      for (final m in members) {
        final p = m['profiles'] as Map<String, dynamic>?;
        if (p?['id'] == assignedTo) {
          assigneeName = p?['display_name'] ?? '${p?['first_name'] ?? ''} ${p?['last_name'] ?? ''}'.trim();
          if (assigneeName?.isEmpty ?? true) assigneeName = p?['email'] as String?;
          break;
        }
      }
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 4, color: _defPriorityColor(priority)),
              Expanded(
                child: InkWell(
                  onTap: () => Navigator.push(context, MaterialPageRoute(
                    fullscreenDialog: true,
                    builder: (_) => _DefectDetailPage(defect: defect, members: members, projectId: projectId, onRefresh: onRefresh),
                  )),
        child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(LucideIcons.alertCircle, size: 18, color: _defPriorityColor(priority)),
            const SizedBox(width: 8),
            Expanded(child: Text(defect['title'] ?? '', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.text), maxLines: 1, overflow: TextOverflow.ellipsis)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: _defPriorityColor(priority).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
              child: Text(_defPriorityLabel(priority), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _defPriorityColor(priority))),
            ),
          ]),
          if (defect['description'] != null && defect['description'].toString().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(defect['description'], style: const TextStyle(fontSize: 13, color: AppColors.textSecondary), maxLines: 2, overflow: TextOverflow.ellipsis),
          ],
          const SizedBox(height: 8),
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: _defStatusColor(status).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
              child: Text(_defStatusLabel(status), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _defStatusColor(status))),
            ),
            const Spacer(),
            if (dueDate != null) ...[
              Icon(LucideIcons.calendar, size: 12, color: isOverdue ? AppColors.danger : AppColors.textTertiary),
              const SizedBox(width: 3),
              Text(_fmtDate(dueDate), style: TextStyle(fontSize: 11, color: isOverdue ? AppColors.danger : AppColors.textTertiary)),
              const SizedBox(width: 8),
            ],
            if (location != null && location.isNotEmpty) ...[
              const Icon(LucideIcons.mapPin, size: 12, color: AppColors.textTertiary),
              const SizedBox(width: 3),
              Text(location, style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
              const SizedBox(width: 8),
            ],
            if (assigneeName != null) ...[
              const Icon(LucideIcons.user, size: 12, color: AppColors.textTertiary),
              const SizedBox(width: 3),
              Text(assigneeName, style: const TextStyle(fontSize: 11, color: AppColors.textTertiary), overflow: TextOverflow.ellipsis),
            ],
          ]),
        ])),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DEFECT DETAIL PAGE
// ══════════════════════════════════════════════════════════════════════════════

class _DefectDetailPage extends StatefulWidget {
  final Map<String, dynamic> defect;
  final List<Map<String, dynamic>> members;
  final String projectId;
  final VoidCallback onRefresh;
  const _DefectDetailPage({required this.defect, required this.members, required this.projectId, required this.onRefresh});
  @override State<_DefectDetailPage> createState() => _DefectDetailPageState();
}

class _DefectDetailPageState extends State<_DefectDetailPage> with SingleTickerProviderStateMixin {
  late TabController _tabs;
  late Map<String, dynamic> _defect;
  bool _editMode = false, _loadingDet = true, _savingDoc = false, _saving = false;
  List<Map<String, dynamic>> _images = [], _docs = [];
  late TextEditingController _titleCtrl, _descCtrl, _locCtrl;
  late String _eStatus, _ePriority, _eVisibility;
  String? _eAssignedTo;
  DateTime? _eDueDate;
  final _docCtrl = TextEditingController();
  String _docType = 'text';
  bool _docExpanded = false;

  @override
  void initState() {
    super.initState();
    _defect = Map.from(widget.defect);
    _tabs = TabController(length: 3, vsync: this);
    _initForm();
    _loadDet();
  }

  void _initForm() {
    _titleCtrl   = TextEditingController(text: _defect['title'] ?? '');
    _descCtrl    = TextEditingController(text: _defect['description'] ?? '');
    _locCtrl     = TextEditingController(text: _defect['location'] ?? '');
    _eStatus     = _defect['status']     ?? 'open';
    _ePriority   = _defect['priority']   ?? 'medium';
    _eVisibility = _defect['visibility'] ?? 'team';
    _eAssignedTo = _defect['assigned_to'] as String?;
    final ds = _defect['due_date'] as String?;
    _eDueDate = ds != null ? DateTime.tryParse(ds) : null;
  }

  Future<void> _loadDet() async {
    setState(() => _loadingDet = true);
    final r = await Future.wait([SupabaseService.getTaskImages(_defect['id']), SupabaseService.getTaskDocs(_defect['id'])]);
    if (mounted) setState(() {
      _images = (r[0] as List).cast<Map<String, dynamic>>();
      _docs   = (r[1] as List).cast<Map<String, dynamic>>();
      _loadingDet = false;
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
        'location':    _locCtrl.text.trim(),
        'status':      _eStatus,
        'priority':    _ePriority,
        'visibility':  _eVisibility,
        'assigned_to': _eAssignedTo,
        'due_date':    _eDueDate?.toIso8601String().split('T')[0],
      };
      await SupabaseService.updateTask(_defect['id'] as String, data);
      if (!mounted) return;
      setState(() {
        _defect = {..._defect, ...data};
        _editMode = false;
        _saving = false;
      });
      widget.onRefresh();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Gespeichert \u2713'), duration: Duration(seconds: 2)));
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Fehler beim Speichern: $e'), backgroundColor: Colors.red));
    }
  }

  Future<void> _quickStatus(String s) async {
    await SupabaseService.updateTask(_defect['id'], {'status': s});
    setState(() { _defect = {..._defect, 'status': s}; _eStatus = s; });
    widget.onRefresh();
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Status: ${_defStatusLabel(s)}')));
  }

  Future<void> _uploadImg() async {
    final picker = ImagePicker();
    final picked = await picker.pickMultiImage();
    if (picked.isEmpty) return;
    final tid = _defect['id'] as String;
    for (int i = 0; i < picked.length; i++) {
      final f = picked[i];
      final bytes = await f.readAsBytes();
      final ext = f.name.split('.').last.toLowerCase();
      final path = '${widget.projectId}/defects/$tid/${DateTime.now().millisecondsSinceEpoch}_$i.$ext';
      try {
        await SupabaseService.uploadFile(bucket: 'task-images', path: path, bytes: bytes, contentType: 'image/$ext');
        await SupabaseService.addTaskImage(tid, widget.projectId, path, f.name, _images.length + i);
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload-Fehler: $e')));
      }
    }
    _loadDet();
  }

  Future<void> _addDoc() async {
    if (_docCtrl.text.trim().isEmpty && _docType == 'text') return;
    setState(() => _savingDoc = true);
    await SupabaseService.addTaskDoc(_defect['id'], widget.projectId, {'documentation_type': _docType, 'content': _docCtrl.text.trim()});
    _docCtrl.clear();
    setState(() => _savingDoc = false);
    _loadDet();
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Mangel löschen'),
        content: const Text('Wirklich loeschen?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Nein')),
          TextButton(onPressed: () => Navigator.pop(context, true),  child: const Text('Loeschen', style: TextStyle(color: AppColors.danger))),
        ],
      ),
    );
    if (ok != true) return;
    await SupabaseService.deleteTask(_defect['id']);
    widget.onRefresh();
    if (mounted) Navigator.pop(context);
  }

  String _mName(String? uid) {
    if (uid == null) return 'Nicht zugewiesen';
    for (final m in widget.members) {
      final p = m['profiles'] as Map<String, dynamic>?;
      if (p?['id'] == uid) {
        final n = p?['display_name'] ?? '${p?['first_name'] ?? ''} ${p?['last_name'] ?? ''}'.trim();
        return n.isNotEmpty ? n : (p?['email'] as String? ?? uid);
      }
    }
    return uid;
  }

  Future<String?> _showMemberPicker(BuildContext ctx) {
    return showModalBottomSheet<String>(
      context: ctx,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.7),
        decoration: const BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(height: 12),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          const Text('Mitglied auswählen', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
          const SizedBox(height: 8),
          const Divider(height: 1),
          Flexible(child: ListView(shrinkWrap: true, children: [
            ListTile(
              leading: Container(width: 36, height: 36, decoration: BoxDecoration(color: AppColors.border, shape: BoxShape.circle), child: const Icon(LucideIcons.userX, size: 18, color: AppColors.textSecondary)),
              title: const Text('Nicht zugewiesen', style: TextStyle(fontSize: 14, color: AppColors.textSecondary)),
              trailing: _eAssignedTo == null ? const Icon(LucideIcons.check, size: 18, color: AppColors.primary) : null,
              onTap: () => Navigator.pop(ctx, '__none__'),
            ),
            ...widget.members.map((m) {
              final profile     = m['profiles']      as Map<String, dynamic>?;
              final firstName   = profile?['first_name']   as String? ?? '';
              final lastName    = profile?['last_name']    as String? ?? '';
              final displayName = profile?['display_name'] as String?;
              final email       = profile?['email']        as String? ?? '';
              final uid         = profile?['id']           as String? ?? '';
              final name = (displayName?.isNotEmpty ?? false) ? displayName! : ('$firstName $lastName'.trim().isNotEmpty ? '$firstName $lastName'.trim() : email);
              final initials = name.isNotEmpty ? name.trim().split(' ').where((s) => s.isNotEmpty).take(2).map((s) => s[0].toUpperCase()).join() : '?';
              final isSelected = _eAssignedTo == uid;
              return ListTile(
                leading: Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.15), shape: BoxShape.circle),
                  child: Center(child: Text(initials, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primary))),
                ),
                title: Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.text)),
                subtitle: email.isNotEmpty ? Text(email, style: const TextStyle(fontSize: 12, color: AppColors.textTertiary)) : null,
                trailing: isSelected ? const Icon(LucideIcons.check, size: 18, color: AppColors.primary) : null,
                onTap: () => Navigator.pop(ctx, uid),
              );
            }),
          ])),
          const SizedBox(height: 16),
        ]),
      ),
    );
  }

  Future<String?> _showVisibilityPicker(BuildContext ctx) {
    const options = [
      {'value': 'team',    'label': 'Team',        'sub': 'Nur für Projektmitglieder', 'icon': LucideIcons.users},
      {'value': 'private', 'label': 'Privat',      'sub': 'Nur für mich sichtbar',     'icon': LucideIcons.lock},
      {'value': 'public',  'label': 'Öffentlich', 'sub': 'Für alle sichtbar',         'icon': LucideIcons.globe},
    ];
    return showModalBottomSheet<String>(
      context: ctx,
      backgroundColor: Colors.transparent,
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
            final val   = o['value'] as String;
            final label = o['label'] as String;
            final sub   = o['sub']   as String;
            final icon  = o['icon']  as IconData;
            final isSel = _eVisibility == val;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_editMode ? 'Mangel bearbeiten' : (_defect['title'] ?? 'Mangeldetails'), overflow: TextOverflow.ellipsis),
        actions: [
          if (!_editMode) IconButton(icon: const Icon(LucideIcons.edit2), onPressed: () => setState(() => _editMode = true)),
          if (_editMode)  TextButton(onPressed: _save, child: const Text('Speichern', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600))),
          IconButton(icon: const Icon(LucideIcons.trash2, color: AppColors.danger), onPressed: _delete),
        ],
        bottom: TabBar(controller: _tabs, tabs: [
          Tab(icon: const Icon(LucideIcons.info,     size: 16), child: const Text('Allgemein', style: TextStyle(fontSize: 12))),
          Tab(icon: const Icon(LucideIcons.image,    size: 16), child: Text('Bilder (${_images.length})',  style: const TextStyle(fontSize: 12))),
          Tab(icon: const Icon(LucideIcons.fileText, size: 16), child: Text('Doku (${_docs.length})',      style: const TextStyle(fontSize: 12))),
        ]),
      ),
      body: TabBarView(controller: _tabs, children: [_infoTab(), _imagesTab(), _docsTab()]),
    );
  }

  Widget _infoTab() {
    if (_editMode) return _editForm();
    final status    = _defect['status']      ?? 'open';
    final priority  = _defect['priority']    ?? 'medium';
    final location  = _defect['location']    as String?;
    final desc      = _defect['description'] as String?;
    final dueDate   = _defect['due_date']    as String?;
    final createdAt = _defect['created_at']  as String?;
    final visibility = _defect['visibility'] as String?;
    final isOverdue = dueDate != null && DateTime.tryParse(dueDate)?.isBefore(DateTime.now()) == true && status != 'resolved';

    return ListView(padding: const EdgeInsets.all(16), children: [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(_defect['title'] ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.text))),
            const SizedBox(width: 8),
            Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), decoration: BoxDecoration(color: _defPriorityColor(priority).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
              child: Text(_defPriorityLabel(priority), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _defPriorityColor(priority)))),
          ]),
          if (desc != null && desc.isNotEmpty) ...[const SizedBox(height: 10), Text(desc, style: const TextStyle(fontSize: 14, color: AppColors.textSecondary))],
        ]),
      ),
      const SizedBox(height: 12),
      _iCard(LucideIcons.activity, 'Status', Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5), decoration: BoxDecoration(color: _defStatusColor(status).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
          child: Text(_defStatusLabel(status), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _defStatusColor(status)))),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: ['open', 'in_progress', 'resolved', 'rejected'].map((s) {
            final active = (_defect['status'] ?? 'open') == s;
            final col    = _defStatusColor(s);
            return GestureDetector(
              onTap: () => _quickStatus(s),
              child: Container(
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: active ? col : col.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: active ? col : col.withValues(alpha: 0.3), width: active ? 2 : 1),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Container(width: 7, height: 7, decoration: BoxDecoration(color: active ? Colors.white : col, shape: BoxShape.circle)),
                  const SizedBox(width: 6),
                  Text(_defStatusLabel(s), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: active ? Colors.white : col)),
                ]),
              ),
            );
          }).toList()),
        ),
      ])),
      const SizedBox(height: 12),
      _iCard(LucideIcons.flag, 'Priorität', Row(children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: _defPriorityColor(priority), shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Text(_defPriorityLabel(priority), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
      ])),
      const SizedBox(height: 12),
      if (location != null && location.isNotEmpty) ...[
        _iCard(LucideIcons.mapPin, 'Ort / Bereich', Text(location, style: const TextStyle(fontSize: 14, color: AppColors.text))),
        const SizedBox(height: 12),
      ],
      _iCard(LucideIcons.calendar, 'Fälligkeitsdatum', Text(
        dueDate != null ? _fmtDate(dueDate) : 'Nicht festgelegt',
        style: TextStyle(fontSize: 14, color: isOverdue ? AppColors.danger : AppColors.text, fontWeight: isOverdue ? FontWeight.w600 : FontWeight.normal),
      )),
      const SizedBox(height: 12),
      _iCard(LucideIcons.user, 'Zugewiesen an', Text(_mName(_defect['assigned_to'] as String?), style: const TextStyle(fontSize: 14, color: AppColors.text))),
      const SizedBox(height: 12),
      _iCard(_defVisibilityIcon(visibility), 'Sichtbarkeit', Text(_defVisibilityLabel(visibility), style: const TextStyle(fontSize: 14, color: AppColors.text))),
      const SizedBox(height: 12),
      if (createdAt != null) ...[
        _iCard(LucideIcons.clock, 'Erfasst am', Text(_fmtDateTime(createdAt), style: const TextStyle(fontSize: 14, color: AppColors.text))),
        const SizedBox(height: 24),
      ],
      OutlinedButton.icon(icon: const Icon(LucideIcons.trash2, size: 16, color: AppColors.danger), label: const Text('Mangel löschen', style: TextStyle(color: AppColors.danger)), onPressed: _delete),
      const SizedBox(height: 40),
    ]);
  }

  Widget _editForm() {
    return ListView(padding: const EdgeInsets.all(16), children: [
      TextField(controller: _titleCtrl, decoration: const InputDecoration(labelText: 'Titel *')),
      const SizedBox(height: 14),
      TextField(controller: _descCtrl, maxLines: 4, decoration: const InputDecoration(labelText: 'Beschreibung')),
      const SizedBox(height: 14),
      TextField(controller: _locCtrl, decoration: const InputDecoration(labelText: 'Ort / Bereich')),
      const SizedBox(height: 18),
      const Text('Status', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
      const SizedBox(height: 8),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: ['open', 'in_progress', 'resolved', 'rejected'].map((s) {
            final sel = _eStatus == s;
            final col = _defStatusColor(s);
            return GestureDetector(
              onTap: () => setState(() => _eStatus = s),
              child: Container(
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(color: sel ? col : col.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(20), border: Border.all(color: sel ? col : col.withValues(alpha: 0.3))),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Container(width: 7, height: 7, decoration: BoxDecoration(color: sel ? Colors.white : col, shape: BoxShape.circle)),
                  const SizedBox(width: 6),
                  Text(_defStatusLabel(s), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: sel ? Colors.white : col)),
                ]),
              ),
            );
          }).toList(),
        ),
      ),
      const SizedBox(height: 18),
      const Text('Priorität', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
      const SizedBox(height: 8),
      Row(children: _dPriorities.map((p) {
        final val = p['value'] as String; final lbl = p['label'] as String; final col = p['color'] as Color; final sel = _ePriority == val;
        return Expanded(child: GestureDetector(onTap: () => setState(() => _ePriority = val), child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 3), padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(color: sel ? col : col.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10), border: Border.all(color: sel ? col : col.withValues(alpha: 0.3), width: sel ? 2 : 1)),
          child: Center(child: Text(lbl, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: sel ? Colors.white : col))))));
      }).toList()),
      const SizedBox(height: 18),
      const Text('Zuweisen an', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
      const SizedBox(height: 8),
      _DefMemberPickerTile(
        selectedId: _eAssignedTo,
        members: widget.members,
        onTap: () async {
          final result = await _showMemberPicker(context);
          if (result != null) setState(() => _eAssignedTo = result == '__none__' ? null : result);
        },
      ),
      const SizedBox(height: 18),
      const Text('Fälligkeitsdatum', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
      const SizedBox(height: 8),
      GestureDetector(
        onTap: () async {
          final picked = await showDatePicker(context: context, initialDate: _eDueDate ?? DateTime.now().add(const Duration(days: 7)), firstDate: DateTime.now().subtract(const Duration(days: 365)), lastDate: DateTime.now().add(const Duration(days: 365 * 3)));
          if (picked != null) setState(() => _eDueDate = picked);
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
          child: Row(children: [
            Icon(LucideIcons.calendar, size: 16, color: _eDueDate != null ? AppColors.primary : AppColors.textSecondary),
            const SizedBox(width: 10),
            Text(_eDueDate != null ? DateFormat('dd.MM.yyyy').format(_eDueDate!) : 'Datum wählen', style: TextStyle(fontSize: 14, color: _eDueDate != null ? AppColors.text : AppColors.textSecondary)),
            const Spacer(),
            if (_eDueDate != null) GestureDetector(onTap: () => setState(() => _eDueDate = null), child: const Icon(LucideIcons.x, size: 16, color: AppColors.textSecondary)),
          ]),
        ),
      ),
      const SizedBox(height: 18),
      const Text('Sichtbarkeit', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
      const SizedBox(height: 8),
      _DefVisibilityPickerTile(
        value: _eVisibility,
        onTap: () async {
          final result = await _showVisibilityPicker(context);
          if (result != null) setState(() => _eVisibility = result);
        },
      ),
      const SizedBox(height: 24),
      ElevatedButton(onPressed: _save, child: const Text('Änderungen speichern')),
      const SizedBox(height: 12),
      OutlinedButton(onPressed: () { _initForm(); setState(() => _editMode = false); }, child: const Text('Abbrechen')),
      const SizedBox(height: 40),
    ]);
  }

  Widget _imagesTab() {
    return Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(16, 16, 16, 0), child: SizedBox(width: double.infinity, child: ElevatedButton.icon(icon: const Icon(LucideIcons.camera, size: 18), label: const Text('Bilder hinzufügen'), onPressed: _uploadImg))),
      const SizedBox(height: 12),
      if (_loadingDet) const Expanded(child: Center(child: CircularProgressIndicator()))
      else if (_images.isEmpty)
        Expanded(child: Center(child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
          child: const Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(LucideIcons.image, size: 48, color: AppColors.textTertiary), SizedBox(height: 12),
            Text('Noch keine Bilder', style: TextStyle(fontSize: 15, color: AppColors.textSecondary)),
            SizedBox(height: 4), Text('Tippen um Bilder hinzuzufuegen', style: TextStyle(fontSize: 12, color: AppColors.textTertiary)),
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
            GestureDetector(onTap: () => _showImageFull(context, url), child: ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network(url, fit: BoxFit.cover, width: double.infinity, height: double.infinity,
              loadingBuilder: (_, child, prog) => prog == null ? child : Container(color: AppColors.border, child: const Center(child: CircularProgressIndicator(strokeWidth: 2))),
              errorBuilder: (_, __, ___) => Container(color: AppColors.border, child: const Center(child: Icon(LucideIcons.image, color: AppColors.textTertiary, size: 32)))))),
            Positioned(top: 6, right: 6, child: GestureDetector(
              onTap: () async { await SupabaseService.deleteTaskImage(img['id'] as String, img['storage_path'] as String); _loadDet(); },
              child: Container(decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle), padding: const EdgeInsets.all(4), child: const Icon(LucideIcons.trash2, size: 14, color: Colors.white)))),
          ]);
        },
      )),
    ]);
  }

  void _showImageFull(BuildContext context, String url) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(backgroundColor: Colors.black, iconTheme: const IconThemeData(color: Colors.white)),
      body: Center(child: InteractiveViewer(child: Image.network(url, fit: BoxFit.contain))),
    )));
  }

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
                        ? Column(children: [
                            TextField(controller: _docCtrl, maxLines: 4, decoration: const InputDecoration(hintText: 'Dokumentation eingeben...', border: OutlineInputBorder())),
                            const SizedBox(height: 10),
                            SizedBox(width: double.infinity, child: ElevatedButton.icon(
                              icon: _savingDoc ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(LucideIcons.plus, size: 16),
                              label: const Text('Hinzuf\u00fcgen'), onPressed: _savingDoc ? null : _addDoc)),
                          ])
                        : Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
                            child: Column(children: [
                              Icon(_docType == 'voice' ? LucideIcons.mic : LucideIcons.video, size: 32, color: AppColors.textTertiary),
                              const SizedBox(height: 8),
                              Text(_docType == 'voice' ? 'Sprachaufnahme \u2013 folgt' : 'Video-Upload \u2013 folgt', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary), textAlign: TextAlign.center),
                            ])),
                  )
                : const SizedBox.shrink(),
          ),
        ]),
      ),
      if (_loadingDet) const Expanded(child: Center(child: CircularProgressIndicator()))
      else if (_docs.isEmpty)
        const Expanded(child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(LucideIcons.fileText, size: 48, color: AppColors.textTertiary), SizedBox(height: 12),
          Text('Noch keine Dokumentation', style: TextStyle(fontSize: 15, color: AppColors.textSecondary)),
        ])))
      else Expanded(child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
        itemCount: _docs.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) {
          final doc = _docs[i]; final type = doc['documentation_type'] ?? 'text'; final content = doc['content'] as String?;
          IconData typeIcon; String typeLabel; Color typeColor;
          switch (type) {
            case 'voice': typeIcon = LucideIcons.mic;      typeLabel = 'Sprachdokumentation'; typeColor = const Color(0xFFF59E0B); break;
            case 'video': typeIcon = LucideIcons.video;    typeLabel = 'Videodokumentation';  typeColor = const Color(0xFF8B5CF6); break;
            case 'image': typeIcon = LucideIcons.image;    typeLabel = 'Bilddokumentation';   typeColor = const Color(0xFF10B981); break;
            default:      typeIcon = LucideIcons.fileText; typeLabel = 'Textdokumentation';   typeColor = AppColors.primary;
          }
          return Container(
            decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
            child: Column(children: [
              Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(color: AppColors.background, borderRadius: const BorderRadius.vertical(top: Radius.circular(12)), border: Border(bottom: BorderSide(color: AppColors.border))),
                child: Row(children: [
                  Container(width: 32, height: 32, decoration: BoxDecoration(color: typeColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)), child: Icon(typeIcon, size: 16, color: typeColor)),
                  const SizedBox(width: 10),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(typeLabel, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text)),
                    Text(_fmtDateTime(doc['created_at'] as String?), style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                  ])),
                  GestureDetector(onTap: () => SupabaseService.deleteTaskDoc(doc['id'] as String).then((_) => _loadDet()),
                    child: Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: AppColors.danger.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)), child: const Icon(LucideIcons.trash2, size: 14, color: AppColors.danger))),
                ])),
              if (content != null && content.isNotEmpty)
                Padding(padding: const EdgeInsets.all(14), child: Align(alignment: Alignment.centerLeft, child: Text(content, style: const TextStyle(fontSize: 14, color: AppColors.text)))),
            ]),
          );
        },
      )),
    ]);
  }

  Widget _docTypeBtn(String type, String label, IconData icon) {
    final active = _docType == type && _docExpanded;
    return Expanded(child: GestureDetector(onTap: () => setState(() { _docType = type; _docExpanded = true; }), child: Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(color: active ? AppColors.primary.withValues(alpha: 0.1) : AppColors.background, borderRadius: BorderRadius.circular(10), border: Border.all(color: active ? AppColors.primary : AppColors.border, width: active ? 2 : 1)),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 18, color: active ? AppColors.primary : AppColors.textSecondary),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: active ? AppColors.primary : AppColors.textSecondary)),
      ]),
    )));
  }

  Widget _iCard(IconData icon, String label, Widget child) => Container(
    width: double.infinity, padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Icon(icon, size: 15, color: AppColors.textTertiary), const SizedBox(width: 6), Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textTertiary))]),
      const SizedBox(height: 8), child,
    ]),
  );

  @override
  void dispose() { _tabs.dispose(); _titleCtrl.dispose(); _descCtrl.dispose(); _locCtrl.dispose(); _docCtrl.dispose(); super.dispose(); }
}

// ══════════════════════════════════════════════════════════════════════════════
// REUSABLE PICKER TILES
// ══════════════════════════════════════════════════════════════════════════════

class _DefMemberPickerTile extends StatelessWidget {
  final String? selectedId;
  final List<Map<String, dynamic>> members;
  final VoidCallback onTap;
  const _DefMemberPickerTile({required this.selectedId, required this.members, required this.onTap});

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
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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

class _DefVisibilityPickerTile extends StatelessWidget {
  final String value;
  final VoidCallback onTap;
  const _DefVisibilityPickerTile({required this.value, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
        child: Row(children: [
          Icon(_defVisibilityIcon(value), size: 16, color: AppColors.primary),
          const SizedBox(width: 10),
          Expanded(child: Text(_defVisibilityLabel(value), style: const TextStyle(fontSize: 14, color: AppColors.text, fontWeight: FontWeight.w500))),
          const Icon(LucideIcons.chevronDown, size: 16, color: AppColors.textTertiary),
        ]),
      ),
    );
  }
}
