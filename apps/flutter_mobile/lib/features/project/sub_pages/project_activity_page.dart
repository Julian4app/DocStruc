import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:intl/intl.dart';

import '../../../core/services/supabase_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/burger_menu_leading.dart';
import 'package:docstruc_mobile/core/widgets/lottie_loader.dart';

// ─── Entity type labels ───────────────────────────────────────────────────────
const _kEntityTypeMap = {
  'task': 'Aufgabe',
  'defect': 'Mangel',
  'document': 'Dokument',
  'file': 'Datei',
  'member': 'Mitglied',
  'message': 'Nachricht',
  'note': 'Notiz',
  'diary_entry': 'Tagebucheintrag',
  'time_entry': 'Zeiteintrag',
  'milestone': 'Meilenstein',
  'project': 'Projekt',
  'folder': 'Ordner',
  'image': 'Bild',
};

const _kStatusMap = {
  'todo': 'Offen',
  'in-progress': 'In Bearbeitung',
  'in_progress': 'In Bearbeitung',
  'done': 'Erledigt',
  'blocked': 'Blockiert',
  'open': 'Offen',
  'closed': 'Geschlossen',
  'active': 'Aktiv',
  'inactive': 'Inaktiv',
};

const _kPriorityMap = {
  'low': 'Niedrig',
  'medium': 'Mittel',
  'high': 'Hoch',
  'critical': 'Kritisch',
};

// ─── Helper: build readable sentence from activity log ────────────────────────
String _buildActivityText(Map<String, dynamic> log) {
  final profile = log['profiles'] as Map?;
  final String userName = (profile != null)
      ? ([
          profile['first_name'],
          profile['last_name'],
        ].where((v) => v != null && (v as String).isNotEmpty).join(' '))
      : '';
  final String displayName =
      userName.isNotEmpty ? userName : (profile?['email'] as String? ?? 'System');

  final action = (log['action'] as String? ?? '').toLowerCase();
  final entityType = (log['entity_type'] as String? ?? '');
  final entityTitle = log['entity_title'] as String? ?? 'Element';
  final metadata = log['metadata'] as Map?;
  final oldValues = log['old_values'] as Map?;
  final newValues = log['new_values'] as Map?;

  final entityTypeLabel =
      _kEntityTypeMap[entityType] ?? (entityType.isNotEmpty ? entityType : 'Element');

  switch (action) {
    case 'created':
    case 'create':
      return '$displayName hat $entityTypeLabel "$entityTitle" erstellt';
    case 'updated':
    case 'update':
      final fields = (metadata?['fields'] as List?)?.cast<String>().join(', ');
      if (fields != null && fields.isNotEmpty) {
        return '$displayName hat $entityTypeLabel "$entityTitle" aktualisiert ($fields)';
      }
      return '$displayName hat $entityTypeLabel "$entityTitle" aktualisiert';
    case 'deleted':
    case 'delete':
      return '$displayName hat $entityTypeLabel "$entityTitle" gelöscht';
    case 'completed':
    case 'complete':
      return '$displayName hat $entityTypeLabel "$entityTitle" abgeschlossen';
    case 'assigned':
      final assignedTo = metadata?['assigned_to_name'] as String?;
      if (assignedTo != null && assignedTo.isNotEmpty) {
        return '$displayName hat $entityTypeLabel "$entityTitle" an $assignedTo zugewiesen';
      }
      return '$displayName hat $entityTypeLabel "$entityTitle" zugewiesen';
    case 'unassigned':
      return '$displayName hat die Zuweisung von $entityTypeLabel "$entityTitle" entfernt';
    case 'archived':
      return '$displayName hat $entityTypeLabel "$entityTitle" archiviert';
    case 'restored':
      return '$displayName hat $entityTypeLabel "$entityTitle" wiederhergestellt';
    case 'uploaded':
    case 'upload':
      return '$displayName hat Datei "$entityTitle" hochgeladen';
    case 'commented':
    case 'comment':
      return '$displayName hat einen Kommentar zu $entityTypeLabel "$entityTitle" hinzugefügt';
    case 'status_changed':
    case 'status_change':
      final oldS = _kStatusMap[oldValues?['status'] as String? ?? ''] ?? (oldValues?['status'] as String? ?? 'unbekannt');
      final newS = _kStatusMap[newValues?['status'] as String? ?? ''] ?? (newValues?['status'] as String? ?? 'unbekannt');
      return '$displayName hat den Status von "$entityTitle" von $oldS auf $newS geändert';
    case 'priority_changed':
    case 'priority_change':
      final oldP = oldValues?['priority'] as String? ?? 'unbekannt';
      final newP = newValues?['priority'] as String? ?? 'unbekannt';
      final oLabel = _kPriorityMap[oldP] ?? oldP;
      final nLabel = _kPriorityMap[newP] ?? newP;
      return '$displayName hat die Priorität von "$entityTitle" von $oLabel auf $nLabel geändert';
    case 'invited':
      return '$displayName hat $entityTitle eingeladen';
    case 'joined':
      return '$displayName ist dem Projekt beigetreten';
    case 'removed':
      return '$displayName hat $entityTitle aus dem Projekt entfernt';
    default:
      if (entityType.isNotEmpty && entityTitle.isNotEmpty) {
        return '$displayName hat eine Aktion für $entityTypeLabel "$entityTitle" ausgeführt';
      }
      final desc = log['description'] as String? ?? log['message'] as String? ?? '';
      if (desc.isNotEmpty) return '$displayName: $desc';
      return '$displayName hat eine Aktion ausgeführt';
  }
}

// Special-case for status_changed: returns (text, oldStatus, newStatus) for coloured chips
(String, String?, String?) _buildStatusChangedParts(Map<String, dynamic> log) {
  final profile = log['profiles'] as Map?;
  final String userName = (profile != null)
      ? ([
          profile['first_name'],
          profile['last_name'],
        ].where((v) => v != null && (v as String).isNotEmpty).join(' '))
      : '';
  final String displayName =
      userName.isNotEmpty ? userName : (profile?['email'] as String? ?? 'System');
  final entityTitle = log['entity_title'] as String? ?? 'Element';
  final oldValues = log['old_values'] as Map?;
  final newValues = log['new_values'] as Map?;
  final oldS = oldValues?['status'] as String? ?? '';
  final newS = newValues?['status'] as String? ?? '';
  return (
    '$displayName hat den Status von "$entityTitle" geändert',
    oldS,
    newS,
  );
}

IconData _actionIcon(String action, String entityType) {
  switch (action.toLowerCase()) {
    case 'created':
    case 'create':
      return LucideIcons.plus;
    case 'updated':
    case 'update':
      return LucideIcons.edit2;
    case 'deleted':
    case 'delete':
      return LucideIcons.trash2;
    case 'completed':
    case 'complete':
      return LucideIcons.checkCircle;
    case 'assigned':
      return LucideIcons.userPlus;
    case 'unassigned':
      return LucideIcons.userMinus;
    case 'archived':
      return LucideIcons.archive;
    case 'restored':
      return LucideIcons.refreshCw;
    case 'uploaded':
    case 'upload':
      return LucideIcons.upload;
    case 'commented':
    case 'comment':
      return LucideIcons.messageSquare;
    case 'status_changed':
    case 'status_change':
      return LucideIcons.flag;
    case 'priority_changed':
    case 'priority_change':
      return LucideIcons.alertCircle;
    case 'invited':
      return LucideIcons.mail;
    case 'joined':
      return LucideIcons.userCheck;
    case 'removed':
      return LucideIcons.userX;
    default:
      switch (entityType) {
        case 'task':
          return LucideIcons.checkSquare;
        case 'defect':
          return LucideIcons.alertTriangle;
        case 'document':
        case 'file':
          return LucideIcons.fileText;
        case 'member':
          return LucideIcons.users;
        case 'message':
        case 'note':
          return LucideIcons.messageSquare;
        case 'diary_entry':
          return LucideIcons.calendar;
        default:
          return LucideIcons.activity;
      }
  }
}

Color _actionColor(String action) {
  switch (action.toLowerCase()) {
    case 'created':
    case 'create':
      return const Color(0xFF10B981);
    case 'updated':
    case 'update':
      return const Color(0xFF3B82F6);
    case 'deleted':
    case 'delete':
      return const Color(0xFFEF4444);
    case 'completed':
    case 'complete':
      return const Color(0xFF22C55E);
    case 'assigned':
    case 'invited':
    case 'joined':
      return const Color(0xFF8B5CF6);
    case 'unassigned':
    case 'removed':
      return const Color(0xFF94A3B8);
    case 'archived':
    case 'priority_changed':
    case 'priority_change':
      return const Color(0xFFF59E0B);
    case 'restored':
    case 'commented':
    case 'comment':
      return const Color(0xFF10B981);
    case 'uploaded':
    case 'upload':
      return const Color(0xFF3B82F6);
    case 'status_changed':
    case 'status_change':
      return const Color(0xFFF59E0B);
    default:
      return const Color(0xFF94A3B8);
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
class ProjectActivityPage extends StatefulWidget {
  final String projectId;
  const ProjectActivityPage({super.key, required this.projectId});

  @override
  State<ProjectActivityPage> createState() => _ProjectActivityPageState();
}

class _ProjectActivityPageState extends State<ProjectActivityPage> {
  bool _loading = true;
  List<Map<String, dynamic>> _logs = [];
  String _filter = 'all';
  DateTime? _dateFrom;
  DateTime? _dateTo;

  static const _filterOptions = [
    ('all', 'Alle'),
    ('task', 'Aufgaben'),
    ('defect', 'Mängel'),
    ('document', 'Dokumente'),
    ('file', 'Dateien'),
    ('member', 'Mitglieder'),
    ('diary_entry', 'Tagebuch'),
    ('message', 'Nachrichten'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loading = true);
    final l = await SupabaseService.getActivityLogs(widget.projectId);
    if (mounted) setState(() { _logs = l; _loading = false; });
  }

  List<Map<String, dynamic>> get _filtered {
    return _logs.where((l) {
      if (_filter != 'all' && l['entity_type'] != _filter) return false;
      if (_dateFrom != null || _dateTo != null) {
        final createdAt = l['created_at'] as String?;
        if (createdAt == null) return false;
        final dt = DateTime.tryParse(createdAt);
        if (dt == null) return false;
        if (_dateFrom != null) {
          final fromDay = DateTime(_dateFrom!.year, _dateFrom!.month, _dateFrom!.day);
          if (dt.isBefore(fromDay)) return false;
        }
        if (_dateTo != null) {
          final toDay = DateTime(_dateTo!.year, _dateTo!.month, _dateTo!.day, 23, 59, 59);
          if (dt.isAfter(toDay)) return false;
        }
      }
      return true;
    }).toList();
  }

  Future<void> _pickDateFrom() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dateFrom ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      locale: const Locale('de'),
    );
    if (picked != null) setState(() => _dateFrom = picked);
  }

  Future<void> _pickDateTo() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dateTo ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      locale: const Locale('de'),
    );
    if (picked != null) setState(() => _dateTo = picked);
  }

  String _fmtDate(DateTime? d) {
    if (d == null) return 'Datum wählen';
    return DateFormat('dd.MM.yyyy').format(d);
  }

  bool get _hasDateFilter => _dateFrom != null || _dateTo != null;

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: burgerMenuLeading(context),
        title: const Text('Aktivitäten'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(52),
          child: _FilterBar(
            selected: _filter,
            options: _filterOptions,
            onSelect: (f) => setState(() => _filter = f),
          ),
        ),
      ),
      body: _loading
          ? const LottieLoader()
          : Column(
              children: [
                // ── Date range filter bar ───────────────────────────────
                Container(
                  color: AppColors.surface,
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                  child: Row(
                    children: [
                      const Icon(LucideIcons.calendar, size: 15, color: AppColors.textSecondary),
                      const SizedBox(width: 6),
                      // From date
                      GestureDetector(
                        onTap: _pickDateFrom,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: _dateFrom != null ? AppColors.primary.withValues(alpha: 0.1) : AppColors.background,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: _dateFrom != null ? AppColors.primary : AppColors.border,
                            ),
                          ),
                          child: Text(
                            'Von: ${_fmtDate(_dateFrom)}',
                            style: TextStyle(
                              fontSize: 12,
                              color: _dateFrom != null ? AppColors.primary : AppColors.textSecondary,
                              fontWeight: _dateFrom != null ? FontWeight.w600 : FontWeight.normal,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      // To date
                      GestureDetector(
                        onTap: _pickDateTo,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: _dateTo != null ? AppColors.primary.withValues(alpha: 0.1) : AppColors.background,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: _dateTo != null ? AppColors.primary : AppColors.border,
                            ),
                          ),
                          child: Text(
                            'Bis: ${_fmtDate(_dateTo)}',
                            style: TextStyle(
                              fontSize: 12,
                              color: _dateTo != null ? AppColors.primary : AppColors.textSecondary,
                              fontWeight: _dateTo != null ? FontWeight.w600 : FontWeight.normal,
                            ),
                          ),
                        ),
                      ),
                      const Spacer(),
                      if (_hasDateFilter)
                        GestureDetector(
                          onTap: () => setState(() { _dateFrom = null; _dateTo = null; }),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                            decoration: BoxDecoration(
                              color: const Color(0xFFfee2e2),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                Icon(LucideIcons.x, size: 12, color: Color(0xFFef4444)),
                                SizedBox(width: 3),
                                Text('Löschen', style: TextStyle(fontSize: 11, color: Color(0xFFef4444), fontWeight: FontWeight.w600)),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                // ── Activity list ──────────────────────────────────────
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _load,
                    child: filtered.isEmpty
                        ? ListView(children: [
                            const SizedBox(height: 120),
                            Center(
                              child: Column(children: [
                                Icon(LucideIcons.activity,
                                    size: 48,
                                    color: AppColors.textTertiary),
                                const SizedBox(height: 12),
                                Text(
                                  (_filter == 'all' && !_hasDateFilter)
                                      ? 'Keine Aktivitäten'
                                      : 'Keine Aktivitäten für diesen Filter',
                                  style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.textSecondary),
                                ),
                              ]),
                            ),
                          ])
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                            itemCount: filtered.length,
                            itemBuilder: (_, i) {
                              final log = filtered[i];
                              final showDate = i == 0 ||
                                  _differentDay(
                                    filtered[i - 1]['created_at'],
                                    log['created_at'],
                                  );
                              final isLast = i == filtered.length - 1;
                              return _TimelineItem(
                                log: log,
                                showDate: showDate,
                                isFirst: i == 0,
                                isLast: isLast,
                              );
                            },
                          ),
                  ),
                ),
              ],
            ),
    );
  }

  bool _differentDay(String? a, String? b) {
    if (a == null || b == null) return true;
    final da = DateTime.tryParse(a);
    final db = DateTime.tryParse(b);
    if (da == null || db == null) return true;
    return da.year != db.year || da.month != db.month || da.day != db.day;
  }
}

// ─── Filter bar ───────────────────────────────────────────────────────────────
class _FilterBar extends StatelessWidget {
  final String selected;
  final List<(String, String)> options;
  final ValueChanged<String> onSelect;
  const _FilterBar(
      {required this.selected,
      required this.options,
      required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        itemCount: options.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final (key, label) = options[i];
          final active = selected == key;
          return GestureDetector(
            onTap: () => onSelect(key),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: active ? AppColors.primary : AppColors.surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                    color: active
                        ? AppColors.primary
                        : AppColors.border),
              ),
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: active ? Colors.white : AppColors.textSecondary,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ─── Timeline item ────────────────────────────────────────────────────────────
class _TimelineItem extends StatelessWidget {
  final Map<String, dynamic> log;
  final bool showDate;
  final bool isFirst;
  final bool isLast;

  const _TimelineItem({
    required this.log,
    required this.showDate,
    required this.isFirst,
    required this.isLast,
  });

  @override
  Widget build(BuildContext context) {
    final action = (log['action'] as String? ?? '').toLowerCase();
    final entityType = log['entity_type'] as String? ?? '';
    final createdAt = log['created_at'] as String?;
    final icon = _actionIcon(action, entityType);
    final color = _actionColor(action);

    final isStatusChange =
        action == 'status_changed' || action == 'status_change';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showDate)
          Padding(
            padding: EdgeInsets.only(top: isFirst ? 0 : 12, bottom: 10),
            child: Text(
              _fmtDateHeader(createdAt),
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary,
                  letterSpacing: 0.3),
            ),
          ),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Timeline line + icon
              SizedBox(
                width: 44,
                child: Column(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: color.withValues(alpha: 0.4), width: 2),
                        boxShadow: [
                          BoxShadow(
                              color: color.withValues(alpha: 0.12),
                              blurRadius: 6,
                              offset: const Offset(0, 2))
                        ],
                      ),
                      child: Icon(icon, size: 16, color: color),
                    ),
                    if (!isLast)
                      Expanded(
                        child: Container(
                          width: 2,
                          margin: const EdgeInsets.only(top: 4),
                          color: AppColors.border,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              // Content
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (isStatusChange)
                          _buildStatusChangedContent()
                        else
                          Text(
                            _buildActivityText(log),
                            style: const TextStyle(
                                fontSize: 13.5,
                                color: AppColors.text,
                                height: 1.5),
                          ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Icon(LucideIcons.clock,
                                size: 11, color: AppColors.textTertiary),
                            const SizedBox(width: 4),
                            Text(
                              _fmtRelativeTime(createdAt),
                              style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.textTertiary),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStatusChangedContent() {
    final (text, oldS, newS) = _buildStatusChangedParts(log);
    final oldLabel = _kStatusMap[oldS ?? ''] ?? oldS ?? '';
    final newLabel = _kStatusMap[newS ?? ''] ?? newS ?? '';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(text,
            style: const TextStyle(
                fontSize: 13.5, color: AppColors.text, height: 1.5)),
        if (oldLabel.isNotEmpty && newLabel.isNotEmpty) ...
          [
            const SizedBox(height: 6),
            Row(
              children: [
                _StatusChip(oldLabel, const Color(0xFF94A3B8)),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6),
                  child: Icon(LucideIcons.arrowRight,
                      size: 12, color: AppColors.textTertiary),
                ),
                _StatusChip(newLabel, const Color(0xFF3B82F6)),
              ],
            ),
          ],
      ],
    );
  }

  String _fmtDateHeader(String? d) {
    if (d == null) return '';
    try {
      final dt = DateTime.parse(d).toLocal();
      final now = DateTime.now();
      if (dt.year == now.year && dt.month == now.month && dt.day == now.day) {
        return 'Heute';
      }
      final yesterday = now.subtract(const Duration(days: 1));
      if (dt.year == yesterday.year &&
          dt.month == yesterday.month &&
          dt.day == yesterday.day) {
        return 'Gestern';
      }
      return DateFormat('dd. MMMM yyyy', 'de_DE').format(dt);
    } catch (_) {
      return d;
    }
  }

  String _fmtRelativeTime(String? d) {
    if (d == null) return '';
    try {
      final dt = DateTime.parse(d).toLocal();
      final now = DateTime.now();
      final diff = now.difference(dt);
      if (diff.inMinutes < 1) return 'Gerade eben';
      if (diff.inMinutes < 60) return 'vor ${diff.inMinutes} Min.';
      if (diff.inHours < 24) return 'vor ${diff.inHours} Std.';
      if (diff.inDays < 7) return 'vor ${diff.inDays} Tag(en)';
      return DateFormat('dd.MM.yyyy HH:mm').format(dt);
    } catch (_) {
      return '';
    }
  }
}

class _StatusChip extends StatelessWidget {
  final String label;
  final Color color;
  const _StatusChip(this.label, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(label,
          style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color)),
    );
  }
}
