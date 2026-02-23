import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/permissions_provider.dart';
import '../../../core/services/supabase_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/burger_menu_leading.dart';

// ── Weather helpers ──────────────────────────────────────────────────────────

const _weatherOptions = [
  'sunny',
  'cloudy',
  'rainy',
  'snowy',
  'stormy',
  'foggy',
];

String _weatherLabel(String? w) {
  switch (w) {
    case 'sunny':  return 'Sonnig';
    case 'cloudy': return 'Bewölkt';
    case 'rainy':  return 'Regnerisch';
    case 'snowy':  return 'Schnee';
    case 'stormy': return 'Sturm';
    case 'foggy':  return 'Neblig';
    default:       return w ?? '';
  }
}

IconData _weatherIcon(String? w) {
  switch (w) {
    case 'sunny':  return LucideIcons.sun;
    case 'rainy':  return LucideIcons.cloudRain;
    case 'stormy': return LucideIcons.cloudRain;
    default:       return LucideIcons.cloud;
  }
}

Color _weatherColor(String? w) {
  switch (w) {
    case 'sunny':  return const Color(0xFFF59E0B);
    case 'cloudy': return const Color(0xFF94A3B8);
    case 'rainy':  return const Color(0xFF3B82F6);
    case 'snowy':  return const Color(0xFF93C5FD);
    case 'stormy': return const Color(0xFF7C3AED);
    case 'foggy':  return const Color(0xFF64748B);
    default:       return AppColors.textTertiary;
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

class ProjectDiaryPage extends ConsumerStatefulWidget {
  final String projectId;
  const ProjectDiaryPage({super.key, required this.projectId});

  @override
  ConsumerState<ProjectDiaryPage> createState() => _ProjectDiaryPageState();
}

class _ProjectDiaryPageState extends ConsumerState<ProjectDiaryPage> {
  bool _loading = true;
  List<Map<String, dynamic>> _entries = [];
  List<Map<String, dynamic>> _members = [];
  bool _hasMore = false;

  int get _totalEntries => _entries.length;
  int get _bautage {
    if (_entries.isEmpty) return 0;
    return _entries
        .map((e) => e['entry_date'] as String?)
        .whereType<String>()
        .toSet()
        .length;
  }
  int get _maEinsaetze {
    int total = 0;
    for (final e in _entries) {
      final w = e['workers_present'];
      if (w is int) total += w;
    }
    return total;
  }

  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  Future<void> _loadInitial() async {
    setState(() => _loading = true);
    try {
      await Future.wait([_fetchEntries(), _fetchMembers()]);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _fetchEntries() async {
    try {
      final rows = await SupabaseService.getDiaryEntries(widget.projectId);
      if (mounted) {
        setState(() {
          _entries = rows;
          _hasMore = rows.length >= 30;
        });
      }
    } catch (e) {
      debugPrint('[Diary] fetchEntries error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Fehler beim Laden der Einträge: $e'),
          backgroundColor: AppColors.danger,
          duration: const Duration(seconds: 5),
        ));
      }
    }
  }

  Future<void> _fetchMembers() async {
    try {
      final m = await SupabaseService.getProjectMembers(widget.projectId);
      if (mounted) setState(() => _members = m);
    } catch (e) {
      debugPrint('[Diary] fetchMembers error: $e');
    }
  }

  Future<void> _refresh() => _loadInitial();

  void _showCreateSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CreateEntrySheet(
        projectId: widget.projectId,
        members: _members,
        onCreated: _refresh,
      ),
    );
  }

  void _showExportSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ExportSheet(entries: _entries),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: burgerMenuLeading(context),
        title: const Text('Bautagebuch'),
        backgroundColor: AppColors.surface,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.download, size: 20),
            tooltip: 'Exportieren',
            onPressed: _showExportSheet,
          ),
        ],
      ),
      floatingActionButton: ref.permissions(widget.projectId).canCreate('diary')
          ? FloatingActionButton.extended(
              onPressed: _showCreateSheet,
              backgroundColor: AppColors.primary,
              icon: const Icon(LucideIcons.plus, color: Colors.white, size: 20),
              label: const Text('Eintrag',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
            )
          : null,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _refresh,
              child: CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                      child: Row(
                        children: [
                          _StatCard(
                            icon: LucideIcons.bookOpen,
                            color: const Color(0xFF3B82F6),
                            label: 'Einträge',
                            value: '$_totalEntries',
                          ),
                          const SizedBox(width: 10),
                          _StatCard(
                            icon: LucideIcons.calendar,
                            color: const Color(0xFF10B981),
                            label: 'Bautage',
                            value: '$_bautage',
                          ),
                          const SizedBox(width: 10),
                          _StatCard(
                            icon: LucideIcons.users,
                            color: const Color(0xFFF59E0B),
                            label: 'MA-Einsätze',
                            value: '$_maEinsaetze',
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 16)),
                  if (_entries.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 64, height: 64,
                              decoration: BoxDecoration(
                                color: AppColors.primary.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: const Icon(LucideIcons.bookOpen,
                                  size: 32, color: AppColors.primary),
                            ),
                            const SizedBox(height: 16),
                            const Text('Keine Einträge',
                                style: TextStyle(fontSize: 17,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.text)),
                            const SizedBox(height: 6),
                            const Text('Dokumentieren Sie den Baufortschritt',
                                style: TextStyle(fontSize: 14,
                                    color: AppColors.textSecondary)),
                            const SizedBox(height: 24),
                            ElevatedButton.icon(
                              onPressed: _showCreateSheet,
                              icon: const Icon(LucideIcons.plus, size: 16),
                              label: const Text('Ersten Eintrag erstellen'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 20, vertical: 12),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (ctx, i) {
                            if (i < _entries.length) {
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: _DiaryCard(
                                  entry: _entries[i],
                                  onRefresh: _refresh,
                                  canEdit: ref.permissions(widget.projectId).canEdit('diary'),
                                  canDelete: ref.permissions(widget.projectId).canDelete('diary'),
                                ),
                              );
                            }
                            if (!_hasMore) return const SizedBox.shrink();
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: Center(
                                child: OutlinedButton.icon(
                                  icon: const Icon(LucideIcons.chevronDown, size: 16),
                                  label: const Text('Ältere Einträge laden'),
                                  onPressed: () => setState(() => _hasMore = false),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: AppColors.primary,
                                    side: const BorderSide(color: AppColors.primary),
                                    shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(8)),
                                  ),
                                ),
                              ),
                            );
                          },
                          childCount: _entries.length + 1,
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}

// ── Stat card ─────────────────────────────────────────────────────────────────

class _StatCard extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final String value;
  const _StatCard({required this.icon, required this.color,
      required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
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
            Container(
              width: 32, height: 32,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 16, color: color),
            ),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(
                fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.text)),
            Text(label, style: const TextStyle(
                fontSize: 11, color: AppColors.textTertiary)),
          ],
        ),
      ),
    );
  }
}

// ── Diary card ────────────────────────────────────────────────────────────────

class _DiaryCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  final VoidCallback onRefresh;
  final bool canEdit;
  final bool canDelete;
  const _DiaryCard({required this.entry, required this.onRefresh, this.canEdit = false, this.canDelete = false});

  String _creatorName() {
    final p = entry['profiles'];
    if (p is Map) {
      final full = '${p['first_name'] ?? ''} ${p['last_name'] ?? ''}'.trim();
      if (full.isNotEmpty) return full;
      return p['email'] ?? 'Unbekannt';
    }
    return 'Unbekannt';
  }

  String _fmtDate(String? d) {
    if (d == null) return '';
    try {
      final dt = DateTime.parse(d);
      return '${DateFormat('EEEE', 'de').format(dt)}, ${DateFormat('dd. MMMM yyyy', 'de').format(dt)}';
    } catch (_) { return d; }
  }

  String _fmtCreatedAt(String? d) {
    if (d == null) return '';
    try { return DateFormat('dd.MM.yyyy HH:mm').format(DateTime.parse(d).toLocal()); }
    catch (_) { return d; }
  }

  @override
  Widget build(BuildContext context) {
    final weather      = entry['weather'] as String?;
    final temp         = entry['temperature'];
    final workers      = entry['workers_present'];
    final workersList  = entry['workers_list'] as String?;
    final workPerf     = entry['work_performed'] as String?;
    final progress     = entry['progress_notes'] as String?;
    final special      = entry['special_events'] as String?;
    final deliveries   = entry['deliveries'] as String?;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (_) => _EntryDetailSheet(entry: entry, onRefresh: onRefresh, canEdit: canEdit, canDelete: canDelete),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Date header
              Row(children: [
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(LucideIcons.calendar, size: 17, color: AppColors.primary),
                ),
                const SizedBox(width: 10),
                Expanded(child: Text(_fmtDate(entry['entry_date'] as String?),
                    style: const TextStyle(fontSize: 14,
                        fontWeight: FontWeight.w600, color: AppColors.text))),
              ]),

              // Weather + workers
              if (weather != null || workers != null) ...[
                const SizedBox(height: 10),
                Row(children: [
                  if (weather != null) ...[
                    Icon(_weatherIcon(weather), size: 14, color: _weatherColor(weather)),
                    const SizedBox(width: 4),
                    Text(
                      temp != null ? '${_weatherLabel(weather)}, ${temp}°C' : _weatherLabel(weather),
                      style: TextStyle(fontSize: 12, color: _weatherColor(weather)),
                    ),
                    const SizedBox(width: 16),
                  ],
                  if (workers != null) ...[
                    const Icon(LucideIcons.hardHat, size: 14, color: AppColors.textTertiary),
                    const SizedBox(width: 4),
                    Text('$workers Arbeiter',
                        style: const TextStyle(fontSize: 12, color: AppColors.textTertiary)),
                  ],
                ]),
              ],

              if (workersList != null && workersList.isNotEmpty) ...[
                const SizedBox(height: 10),
                _SectionRow(icon: LucideIcons.users,
                    title: 'Mitarbeiter', content: workersList, maxLines: 2),
              ],
              if (workPerf != null && workPerf.isNotEmpty) ...[
                const SizedBox(height: 10),
                _SectionRow(icon: LucideIcons.clipboardList,
                    title: 'Arbeiten', content: workPerf, maxLines: 3),
              ],
              if (progress != null && progress.isNotEmpty) ...[
                const SizedBox(height: 10),
                _SectionRow(icon: LucideIcons.trendingUp,
                    title: 'Fortschritt', content: progress, maxLines: 2),
              ],
              if (special != null && special.isNotEmpty) ...[
                const SizedBox(height: 10),
                _SectionRow(icon: LucideIcons.alertCircle,
                    title: 'Vorkommnisse', content: special, maxLines: 2),
              ],
              if (deliveries != null && deliveries.isNotEmpty) ...[
                const SizedBox(height: 10),
                _SectionRow(icon: LucideIcons.truck,
                    title: 'Lieferungen', content: deliveries, maxLines: 2),
              ],

              // Footer
              const SizedBox(height: 12),
              Row(children: [
                const Icon(LucideIcons.user, size: 12, color: AppColors.textTertiary),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    'Erstellt von: ${_creatorName()} • ${_fmtCreatedAt(entry["created_at"] as String?)}',
                    style: const TextStyle(fontSize: 11, color: AppColors.textTertiary),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ]),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String content;
  final int maxLines;
  const _SectionRow({required this.icon, required this.title,
      required this.content, this.maxLines = 3});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 1),
          child: Icon(icon, size: 13, color: AppColors.textTertiary),
        ),
        const SizedBox(width: 6),
        Expanded(
          child: RichText(
            text: TextSpan(
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
              children: [
                TextSpan(text: '$title: ',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                TextSpan(text: content),
              ],
            ),
            maxLines: maxLines,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

// ── Entry detail sheet ────────────────────────────────────────────────────────

class _EntryDetailSheet extends StatelessWidget {
  final Map<String, dynamic> entry;
  final VoidCallback onRefresh;
  final bool canEdit;
  final bool canDelete;
  const _EntryDetailSheet({required this.entry, required this.onRefresh, this.canEdit = false, this.canDelete = false});

  String _fmtDate(String? d) {
    if (d == null) return '';
    try { return DateFormat('EEEE, dd. MMMM yyyy', 'de').format(DateTime.parse(d)); }
    catch (_) { return d ?? ''; }
  }

  String _creatorName() {
    final p = entry['profiles'];
    if (p is Map) {
      final full = '${p['first_name'] ?? ''} ${p['last_name'] ?? ''}'.trim();
      if (full.isNotEmpty) return full;
      return p['email'] ?? 'Unbekannt';
    }
    return 'Unbekannt';
  }

  @override
  Widget build(BuildContext context) {
    final weather    = entry['weather'] as String?;
    final temp       = entry['temperature'];
    final workers    = entry['workers_present'];
    final workersList = entry['workers_list'] as String?;
    final workPerf   = entry['work_performed'] as String?;
    final progress   = entry['progress_notes'] as String?;
    final special    = entry['special_events'] as String?;
    final deliveries = entry['deliveries'] as String?;

    return Container(
      constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.88),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          Container(
            margin: const EdgeInsets.only(top: 12, bottom: 8),
            width: 40, height: 4,
            decoration: BoxDecoration(color: AppColors.border,
                borderRadius: BorderRadius.circular(2)),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 16, 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Bautagebuch-Eintrag',
                          style: TextStyle(fontSize: 11,
                              color: AppColors.textTertiary,
                              fontWeight: FontWeight.w500)),
                      const SizedBox(height: 2),
                      Text(_fmtDate(entry['entry_date'] as String?),
                          style: const TextStyle(fontSize: 18,
                              fontWeight: FontWeight.w700, color: AppColors.text)),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(LucideIcons.x, size: 20),
                  onPressed: () => Navigator.pop(context),
                  color: AppColors.textSecondary,
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.border),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                if (weather != null) ...[
                  _DetailSection(
                    icon: _weatherIcon(weather),
                    iconColor: _weatherColor(weather),
                    title: 'Wetter',
                    content: temp != null
                        ? '${_weatherLabel(weather)}, ${temp}°C'
                        : _weatherLabel(weather),
                  ),
                  const SizedBox(height: 16),
                ],
                if (workers != null) ...[
                  _DetailSection(
                    icon: LucideIcons.hardHat,
                    iconColor: const Color(0xFFF59E0B),
                    title: 'Mitarbeiter vor Ort',
                    content: '$workers Personen',
                  ),
                  const SizedBox(height: 16),
                ],
                if (workersList != null && workersList.isNotEmpty) ...[
                  _DetailSection(icon: LucideIcons.users,
                      iconColor: const Color(0xFF3B82F6),
                      title: 'Mitarbeiterliste', content: workersList),
                  const SizedBox(height: 16),
                ],
                if (workPerf != null && workPerf.isNotEmpty) ...[
                  _DetailSection(icon: LucideIcons.clipboardList,
                      iconColor: AppColors.primary,
                      title: 'Durchgeführte Arbeiten', content: workPerf),
                  const SizedBox(height: 16),
                ],
                if (progress != null && progress.isNotEmpty) ...[
                  _DetailSection(icon: LucideIcons.trendingUp,
                      iconColor: const Color(0xFF10B981),
                      title: 'Fortschrittsnotizen', content: progress),
                  const SizedBox(height: 16),
                ],
                if (special != null && special.isNotEmpty) ...[
                  _DetailSection(icon: LucideIcons.alertCircle,
                      iconColor: const Color(0xFFEF4444),
                      title: 'Besondere Vorkommnisse', content: special),
                  const SizedBox(height: 16),
                ],
                if (deliveries != null && deliveries.isNotEmpty) ...[
                  _DetailSection(icon: LucideIcons.truck,
                      iconColor: const Color(0xFF8B5CF6),
                      title: 'Lieferungen', content: deliveries),
                  const SizedBox(height: 16),
                ],
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: AppColors.background,
                      borderRadius: BorderRadius.circular(10)),
                  child: Row(children: [
                    const Icon(LucideIcons.user, size: 14, color: AppColors.textTertiary),
                    const SizedBox(width: 6),
                    Text('Erstellt von: ${_creatorName()}',
                        style: const TextStyle(fontSize: 12,
                            color: AppColors.textSecondary)),
                  ]),
                ),
                const SizedBox(height: 20),
                if (canEdit || canDelete) Row(children: [
                  if (canEdit) Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(LucideIcons.pencil, size: 15, color: AppColors.primary),
                      label: const Text('Bearbeiten',
                          style: TextStyle(color: AppColors.primary)),
                      onPressed: () {
                        Navigator.pop(context);
                        showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          backgroundColor: Colors.transparent,
                          builder: (_) => _EditEntrySheet(
                              entry: entry, onSaved: onRefresh, canEdit: canEdit),
                        );
                      },
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppColors.primary),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  if (canDelete) Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(LucideIcons.trash2, size: 15,
                          color: AppColors.danger),
                      label: const Text('Löschen',
                          style: TextStyle(color: AppColors.danger)),
                      onPressed: () async {
                        final ok = await showDialog<bool>(
                          context: context,
                          builder: (_) => AlertDialog(
                            title: const Text('Eintrag löschen?'),
                            content: const Text(
                                'Dieser Bautagebuch-Eintrag wird unwiderruflich gelöscht.'),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(context, false),
                                  child: const Text('Abbrechen')),
                              TextButton(
                                  onPressed: () => Navigator.pop(context, true),
                                  child: const Text('Löschen',
                                      style: TextStyle(color: AppColors.danger))),
                            ],
                          ),
                        );
                        if (ok == true) {
                          await SupabaseService.deleteDiaryEntry(
                              entry['id'] as String);
                          if (context.mounted) Navigator.pop(context);
                          onRefresh();
                        }
                      },
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppColors.danger),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                ]),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailSection extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String content;
  const _DetailSection({required this.icon, required this.iconColor,
      required this.title, required this.content});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Icon(icon, size: 15, color: iconColor),
          const SizedBox(width: 6),
          Text(title, style: const TextStyle(fontSize: 12,
              fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
        ]),
        const SizedBox(height: 6),
        Text(content, style: const TextStyle(
            fontSize: 14, color: AppColors.text, height: 1.5)),
      ],
    );
  }
}

// ── Create entry sheet ────────────────────────────────────────────────────────

class _CreateEntrySheet extends StatefulWidget {
  final String projectId;
  final List<Map<String, dynamic>> members;
  final VoidCallback onCreated;
  const _CreateEntrySheet({required this.projectId,
      required this.members, required this.onCreated});

  @override
  State<_CreateEntrySheet> createState() => _CreateEntrySheetState();
}

class _CreateEntrySheetState extends State<_CreateEntrySheet> {
  DateTime _date = DateTime.now();
  String? _weather;
  final _tempCtrl = TextEditingController();
  final _extraWorkersCtrl = TextEditingController();
  final _workPerformedCtrl = TextEditingController();
  final _progressNotesCtrl = TextEditingController();
  final _specialEventsCtrl = TextEditingController();
  final _deliveriesCtrl = TextEditingController();
  final Set<String> _selectedIds = {};
  bool _saving = false;

  int get _totalWorkers =>
      (int.tryParse(_extraWorkersCtrl.text) ?? 0) + _selectedIds.length;

  String get _workersListStr => widget.members.where((m) {
        final p = m['profiles'] as Map? ?? m;
        final id = (p['id'] ?? m['user_id']) as String?;
        return id != null && _selectedIds.contains(id);
      }).map((m) {
        final p = m['profiles'] as Map<String, dynamic>? ?? m;
        final first = p['first_name'] ?? '';
        final last = p['last_name'] ?? '';
        final full = '$first $last'.trim();
        return full.isNotEmpty ? full : (p['email'] ?? '');
      }).join(', ');

  Future<void> _save() async {
    if (_workPerformedCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Bitte durchgeführte Arbeiten eingeben'),
          backgroundColor: AppColors.danger));
      return;
    }
    setState(() => _saving = true);
    final entryDate = DateFormat('yyyy-MM-dd').format(_date);
    final payload = <String, dynamic>{
      'entry_date': entryDate,
      if (_weather != null) 'weather': _weather,
      if (_tempCtrl.text.isNotEmpty)
        'temperature': int.tryParse(_tempCtrl.text.trim()) ?? double.tryParse(_tempCtrl.text.trim())?.round(),
      'workers_present': _totalWorkers,
      if (_workersListStr.isNotEmpty) 'workers_list': _workersListStr,
      'work_performed': _workPerformedCtrl.text.trim(),
      if (_progressNotesCtrl.text.trim().isNotEmpty)
        'progress_notes': _progressNotesCtrl.text.trim(),
      if (_specialEventsCtrl.text.trim().isNotEmpty)
        'special_events': _specialEventsCtrl.text.trim(),
      if (_deliveriesCtrl.text.trim().isNotEmpty)
        'deliveries': _deliveriesCtrl.text.trim(),
    };
    try {
      await SupabaseService.createDiaryEntry(widget.projectId, payload);
      if (mounted) Navigator.pop(context);
      widget.onCreated();
    } catch (e) {
      final isDuplicate = e.toString().contains('23505') ||
          e.toString().contains('diary_entries_project_id_entry_date_key');
      if (isDuplicate && mounted) {
        setState(() => _saving = false);
        // Ask user if they want to update the existing entry for this date
        final confirm = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Eintrag bereits vorhanden'),
            content: Text(
                'Für den ${DateFormat('dd.MM.yyyy').format(_date)} existiert bereits ein Eintrag. '
                'Soll der bestehende Eintrag aktualisiert werden?'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Abbrechen')),
              ElevatedButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('Aktualisieren')),
            ],
          ),
        );
        if (confirm == true && mounted) {
          setState(() => _saving = true);
          try {
            // Find existing entry by date and update it
            await SupabaseService.upsertDiaryEntry(
                widget.projectId, entryDate, payload);
            if (mounted) Navigator.pop(context);
            widget.onCreated();
          } catch (e2) {
            if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                content: Text('Fehler: $e2'),
                backgroundColor: AppColors.danger));
          } finally {
            if (mounted) setState(() => _saving = false);
          }
        }
      } else {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Fehler: $e'), backgroundColor: AppColors.danger));
        if (mounted) setState(() => _saving = false);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _tempCtrl.dispose();
    _extraWorkersCtrl.dispose();
    _workPerformedCtrl.dispose();
    _progressNotesCtrl.dispose();
    _specialEventsCtrl.dispose();
    _deliveriesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.92),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Column(children: [
        Container(
          margin: const EdgeInsets.only(top: 12, bottom: 8),
          width: 40, height: 4,
          decoration: BoxDecoration(color: AppColors.border,
              borderRadius: BorderRadius.circular(2)),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 16, 12),
          child: Row(children: [
            const Expanded(child: Text('Neuer Eintrag',
                style: TextStyle(fontSize: 18,
                    fontWeight: FontWeight.w700, color: AppColors.text))),
            IconButton(
              icon: const Icon(LucideIcons.x, size: 20),
              onPressed: () => Navigator.pop(context),
              color: AppColors.textSecondary,
            ),
          ]),
        ),
        const Divider(height: 1, color: AppColors.border),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              _FormLabel('Datum *'),
              InkWell(
                onTap: () async {
                  final d = await showDatePicker(
                    context: context,
                    initialDate: _date,
                    firstDate: DateTime(2020),
                    lastDate: DateTime(2035),
                  );
                  if (d != null) setState(() => _date = d);
                },
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 12),
                  decoration: BoxDecoration(
                    border: Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(children: [
                    const Icon(LucideIcons.calendar, size: 16,
                        color: AppColors.textSecondary),
                    const SizedBox(width: 8),
                    Text(DateFormat('EEEE, dd. MMMM yyyy', 'de').format(_date),
                        style: const TextStyle(
                            fontSize: 14, color: AppColors.text)),
                  ]),
                ),
              ),
              const SizedBox(height: 20),

              _FormLabel('Wetter'),
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 3,
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                childAspectRatio: 2.2,
                children: _weatherOptions.map((w) {
                  final sel = _weather == w;
                  final col = _weatherColor(w);
                  return InkWell(
                    onTap: () => setState(() => _weather = sel ? null : w),
                    borderRadius: BorderRadius.circular(8),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      decoration: BoxDecoration(
                        color: sel ? col.withValues(alpha: 0.15) : AppColors.background,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                            color: sel ? col : AppColors.border,
                            width: sel ? 1.5 : 1),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(_weatherIcon(w), size: 14,
                              color: sel ? col : AppColors.textTertiary),
                          const SizedBox(width: 4),
                          Text(_weatherLabel(w),
                              style: TextStyle(fontSize: 11,
                                  color: sel ? col : AppColors.textSecondary,
                                  fontWeight: sel
                                      ? FontWeight.w600 : FontWeight.normal)),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),

              _FormLabel('Temperatur (°C)'),
              TextField(
                controller: _tempCtrl,
                keyboardType: const TextInputType.numberWithOptions(
                    signed: true, decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[-0-9.]'))
                ],
                decoration: const InputDecoration(
                  hintText: 'z.B. 18', suffixText: '°C',
                  border: OutlineInputBorder(),
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 20),

              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _FormLabel('Zusätzliche Arbeiter'),
                        TextField(
                          controller: _extraWorkersCtrl,
                          keyboardType: TextInputType.number,
                          inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly],
                          onChanged: (_) => setState(() {}),
                          decoration: const InputDecoration(
                            hintText: '0',
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(
                                horizontal: 12, vertical: 10),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _FormLabel('Gesamt'),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 12),
                          decoration: BoxDecoration(
                            color: AppColors.background,
                            border: Border.all(color: AppColors.border),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Row(children: [
                            const Icon(LucideIcons.users, size: 16,
                                color: AppColors.textSecondary),
                            const SizedBox(width: 6),
                            Text('$_totalWorkers Pers.',
                                style: const TextStyle(
                                    fontSize: 13, color: AppColors.text)),
                          ]),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              if (widget.members.isNotEmpty) ...[
                _FormLabel('Projektmitglieder'),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: widget.members.map((m) {
                    final p = m['profiles'] as Map<String, dynamic>? ?? m;
                    final id = (p['id'] ?? m['user_id']) as String?;
                    if (id == null) return const SizedBox.shrink();
                    final sel = _selectedIds.contains(id);
                    final first = p['first_name'] ?? '';
                    final last  = p['last_name'] ?? '';
                    final name  = '$first $last'.trim().isNotEmpty
                        ? '$first $last'.trim()
                        : (p['email'] ?? 'Unbekannt');
                    return FilterChip(
                      label: Text(name,
                          style: const TextStyle(fontSize: 12)),
                      selected: sel,
                      onSelected: (_) => setState(() {
                        if (sel) _selectedIds.remove(id);
                        else _selectedIds.add(id);
                      }),
                      selectedColor:
                          AppColors.primary.withValues(alpha: 0.15),
                      checkmarkColor: AppColors.primary,
                      side: BorderSide(
                          color: sel ? AppColors.primary : AppColors.border),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 20),
              ],

              _FormLabel('Durchgeführte Arbeiten *'),
              TextField(
                controller: _workPerformedCtrl,
                maxLines: 4,
                decoration: const InputDecoration(
                  hintText: 'Was wurde heute durchgeführt?',
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 16),

              _FormLabel('Fortschrittsnotizen'),
              TextField(
                controller: _progressNotesCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'Aktueller Baufortschritt...',
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 16),

              _FormLabel('Besondere Vorkommnisse'),
              TextField(
                controller: _specialEventsCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'Unfälle, Verzögerungen, besondere Ereignisse...',
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 16),

              _FormLabel('Lieferungen'),
              TextField(
                controller: _deliveriesCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'Materiallieferungen, Geräte...',
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 24),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _saving ? null : _save,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  child: _saving
                      ? const SizedBox(width: 20, height: 20,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2))
                      : const Text('Eintrag erstellen',
                          style: TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ),
      ]),
    );
  }
}

// ── Edit entry sheet ──────────────────────────────────────────────────────────

class _EditEntrySheet extends StatefulWidget {
  final Map<String, dynamic> entry;
  final VoidCallback onSaved;
  final bool canEdit;
  const _EditEntrySheet({required this.entry, required this.onSaved, this.canEdit = false});

  @override
  State<_EditEntrySheet> createState() => _EditEntrySheetState();
}

class _EditEntrySheetState extends State<_EditEntrySheet> {
  late DateTime _date;
  late String? _weather;
  late final TextEditingController _tempCtrl;
  late final TextEditingController _workPerformedCtrl;
  late final TextEditingController _progressNotesCtrl;
  late final TextEditingController _specialEventsCtrl;
  late final TextEditingController _deliveriesCtrl;
  late final TextEditingController _workersCtrl;
  late final TextEditingController _workersListCtrl;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final e = widget.entry;
    try { _date = e['entry_date'] != null
        ? DateTime.parse(e['entry_date'] as String) : DateTime.now(); }
    catch (_) { _date = DateTime.now(); }
    _weather = e['weather'] as String?;
    final temp = e['temperature'];
    _tempCtrl = TextEditingController(text: temp?.toString() ?? '');
    _workPerformedCtrl = TextEditingController(
        text: e['work_performed'] as String? ?? '');
    _progressNotesCtrl = TextEditingController(
        text: e['progress_notes'] as String? ?? '');
    _specialEventsCtrl = TextEditingController(
        text: e['special_events'] as String? ?? '');
    _deliveriesCtrl = TextEditingController(
        text: e['deliveries'] as String? ?? '');
    final workers = e['workers_present'];
    _workersCtrl = TextEditingController(
        text: workers?.toString() ?? '');
    _workersListCtrl = TextEditingController(
        text: e['workers_list'] as String? ?? '');
  }

  @override
  void dispose() {
    _tempCtrl.dispose(); _workPerformedCtrl.dispose();
    _progressNotesCtrl.dispose(); _specialEventsCtrl.dispose();
    _deliveriesCtrl.dispose(); _workersCtrl.dispose();
    _workersListCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await SupabaseService.updateDiaryEntry(widget.entry['id'] as String, {
        'entry_date': DateFormat('yyyy-MM-dd').format(_date),
        'weather': _weather,
        if (_tempCtrl.text.isNotEmpty)
          'temperature': int.tryParse(_tempCtrl.text.trim()) ?? double.tryParse(_tempCtrl.text.trim())?.round(),
        if (_workersCtrl.text.isNotEmpty)
          'workers_present': int.tryParse(_workersCtrl.text.trim()),
        if (_workersListCtrl.text.isNotEmpty)
          'workers_list': _workersListCtrl.text.trim(),
        'work_performed': _workPerformedCtrl.text.trim(),
        if (_progressNotesCtrl.text.trim().isNotEmpty)
          'progress_notes': _progressNotesCtrl.text.trim(),
        if (_specialEventsCtrl.text.trim().isNotEmpty)
          'special_events': _specialEventsCtrl.text.trim(),
        if (_deliveriesCtrl.text.trim().isNotEmpty)
          'deliveries': _deliveriesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
      widget.onSaved();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Fehler: $e'),
          backgroundColor: AppColors.danger));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.92),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Column(children: [
        Container(
          margin: const EdgeInsets.only(top: 12, bottom: 8),
          width: 40, height: 4,
          decoration: BoxDecoration(color: AppColors.border,
              borderRadius: BorderRadius.circular(2)),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 16, 12),
          child: Row(children: [
            const Expanded(child: Text('Eintrag bearbeiten',
                style: TextStyle(fontSize: 18,
                    fontWeight: FontWeight.w700, color: AppColors.text))),
            IconButton(
              icon: const Icon(LucideIcons.x, size: 20),
              onPressed: () => Navigator.pop(context),
              color: AppColors.textSecondary,
            ),
          ]),
        ),
        const Divider(height: 1, color: AppColors.border),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              _FormLabel('Datum'),
              InkWell(
                onTap: () async {
                  final d = await showDatePicker(
                    context: context,
                    initialDate: _date,
                    firstDate: DateTime(2020), lastDate: DateTime(2035),
                  );
                  if (d != null) setState(() => _date = d);
                },
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 12),
                  decoration: BoxDecoration(
                    border: Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(children: [
                    const Icon(LucideIcons.calendar, size: 16,
                        color: AppColors.textSecondary),
                    const SizedBox(width: 8),
                    Text(DateFormat('dd. MMMM yyyy', 'de').format(_date),
                        style: const TextStyle(
                            fontSize: 14, color: AppColors.text)),
                  ]),
                ),
              ),
              const SizedBox(height: 20),

              _FormLabel('Wetter'),
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 3,
                mainAxisSpacing: 8, crossAxisSpacing: 8,
                childAspectRatio: 2.2,
                children: _weatherOptions.map((w) {
                  final sel = _weather == w;
                  final col = _weatherColor(w);
                  return InkWell(
                    onTap: () => setState(() => _weather = sel ? null : w),
                    borderRadius: BorderRadius.circular(8),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      decoration: BoxDecoration(
                        color: sel ? col.withValues(alpha: 0.15) : AppColors.background,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                            color: sel ? col : AppColors.border,
                            width: sel ? 1.5 : 1),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(_weatherIcon(w), size: 14,
                              color: sel ? col : AppColors.textTertiary),
                          const SizedBox(width: 4),
                          Text(_weatherLabel(w),
                              style: TextStyle(fontSize: 11,
                                  color: sel ? col : AppColors.textSecondary,
                                  fontWeight: sel ? FontWeight.w600
                                      : FontWeight.normal)),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),

              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _FormLabel('Temperatur (°C)'),
                        TextField(
                          controller: _tempCtrl,
                          keyboardType: const TextInputType.numberWithOptions(
                              signed: true, decimal: true),
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(RegExp(r'[-0-9.]'))
                          ],
                          decoration: const InputDecoration(
                            hintText: 'z.B. 18', suffixText: '°C',
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(
                                horizontal: 12, vertical: 10),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _FormLabel('Anzahl Arbeiter'),
                        TextField(
                          controller: _workersCtrl,
                          keyboardType: TextInputType.number,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly],
                          decoration: const InputDecoration(
                            hintText: '0',
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(
                                horizontal: 12, vertical: 10),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              _FormLabel('Mitarbeiterliste'),
              TextField(
                controller: _workersListCtrl,
                maxLines: 2,
                decoration: const InputDecoration(
                  hintText: 'Namen der Mitarbeiter...',
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 16),

              _FormLabel('Durchgeführte Arbeiten *'),
              TextField(
                controller: _workPerformedCtrl,
                maxLines: 4,
                decoration: const InputDecoration(
                  hintText: 'Was wurde heute durchgeführt?',
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 16),

              _FormLabel('Fortschrittsnotizen'),
              TextField(
                controller: _progressNotesCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'Aktueller Baufortschritt...',
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 16),

              _FormLabel('Besondere Vorkommnisse'),
              TextField(
                controller: _specialEventsCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'Unfälle, Verzögerungen...',
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 16),

              _FormLabel('Lieferungen'),
              TextField(
                controller: _deliveriesCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'Materiallieferungen...',
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 24),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _saving ? null : _save,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  child: _saving
                      ? const SizedBox(width: 20, height: 20,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2))
                      : const Text('Speichern',
                          style: TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ),
      ]),
    );
  }
}

// ── Export sheet ──────────────────────────────────────────────────────────────

class _ExportSheet extends StatefulWidget {
  final List<Map<String, dynamic>> entries;
  const _ExportSheet({required this.entries});

  @override
  State<_ExportSheet> createState() => _ExportSheetState();
}

class _ExportSheetState extends State<_ExportSheet> {
  String _format = 'pdf';
  String _timeframe = 'all';
  DateTime? _from;
  DateTime? _to;

  List<Map<String, dynamic>> get _filtered {
    if (_timeframe == 'all') return widget.entries;
    return widget.entries.where((e) {
      final d = e['entry_date'] as String?;
      if (d == null) return false;
      try {
        final dt = DateTime.parse(d);
        if (_from != null && dt.isBefore(_from!)) return false;
        if (_to != null && dt.isAfter(_to!.add(const Duration(days: 1)))) return false;
        return true;
      } catch (_) { return false; }
    }).toList();
  }

  String _buildCsv() {
    final buf = StringBuffer();
    buf.writeln(
        'Datum;Wetter;Temperatur;Arbeiter;Mitarbeiterliste;Durchgeführte Arbeiten;'
        'Fortschrittsnotizen;Besondere Vorkommnisse;Lieferungen');
    String esc(dynamic v) =>
        '"${(v ?? '').toString().replaceAll('"', '""')}"';
    for (final e in _filtered) {
      buf.writeln([
        esc(e['entry_date']), esc(e['weather']), esc(e['temperature']),
        esc(e['workers_present']), esc(e['workers_list']),
        esc(e['work_performed']), esc(e['progress_notes']),
        esc(e['special_events']), esc(e['deliveries']),
      ].join(';'));
    }
    return buf.toString();
  }

  void _export() {
    final entries = _filtered;
    if (entries.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Keine Einträge im ausgewählten Zeitraum')));
      return;
    }
    if (_format == 'csv') {
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('CSV Export'),
          content: SizedBox(
            width: double.maxFinite, height: 300,
            child: SingleChildScrollView(
              child: Text(_buildCsv(),
                  style: const TextStyle(fontSize: 10, fontFamily: 'monospace')),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context),
                child: const Text('Schließen')),
          ],
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('${entries.length} Einträge werden als PDF exportiert')));
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
          bottom: math.max(MediaQuery.of(context).viewInsets.bottom, 20)),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          margin: const EdgeInsets.only(top: 12, bottom: 8),
          width: 40, height: 4,
          decoration: BoxDecoration(color: AppColors.border,
              borderRadius: BorderRadius.circular(2)),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 16, 16),
          child: Row(children: [
            const Expanded(child: Text('Bautagebuch exportieren',
                style: TextStyle(fontSize: 18,
                    fontWeight: FontWeight.w700, color: AppColors.text))),
            IconButton(
              icon: const Icon(LucideIcons.x, size: 20),
              onPressed: () => Navigator.pop(context),
              color: AppColors.textSecondary,
            ),
          ]),
        ),
        const Divider(height: 1, color: AppColors.border),
        Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _FormLabel('Format'),
              Row(children: [
                Expanded(child: _FormatToggle(label: 'PDF',
                    icon: LucideIcons.fileText,
                    selected: _format == 'pdf',
                    onTap: () => setState(() => _format = 'pdf'))),
                const SizedBox(width: 10),
                Expanded(child: _FormatToggle(label: 'CSV / Excel',
                    icon: LucideIcons.table2,
                    selected: _format == 'csv',
                    onTap: () => setState(() => _format = 'csv'))),
              ]),
              const SizedBox(height: 20),

              _FormLabel('Zeitraum'),
              Row(children: [
                Expanded(child: _FormatToggle(label: 'Alle Einträge',
                    icon: LucideIcons.list,
                    selected: _timeframe == 'all',
                    onTap: () => setState(() => _timeframe = 'all'))),
                const SizedBox(width: 10),
                Expanded(child: _FormatToggle(label: 'Zeitraum',
                    icon: LucideIcons.calendarRange,
                    selected: _timeframe == 'custom',
                    onTap: () => setState(() => _timeframe = 'custom'))),
              ]),

              if (_timeframe == 'custom') ...[
                const SizedBox(height: 16),
                Row(children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _FormLabel('Von'),
                        InkWell(
                          onTap: () async {
                            final d = await showDatePicker(
                              context: context,
                              initialDate: _from ?? DateTime.now(),
                              firstDate: DateTime(2020),
                              lastDate: DateTime(2035),
                            );
                            if (d != null) setState(() => _from = d);
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(
                              border: Border.all(color: AppColors.border),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              _from != null
                                  ? DateFormat('dd.MM.yyyy').format(_from!)
                                  : 'Datum wählen',
                              style: TextStyle(fontSize: 13,
                                  color: _from != null
                                      ? AppColors.text : AppColors.textTertiary),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _FormLabel('Bis'),
                        InkWell(
                          onTap: () async {
                            final d = await showDatePicker(
                              context: context,
                              initialDate: _to ?? DateTime.now(),
                              firstDate: DateTime(2020),
                              lastDate: DateTime(2035),
                            );
                            if (d != null) setState(() => _to = d);
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(
                              border: Border.all(color: AppColors.border),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              _to != null
                                  ? DateFormat('dd.MM.yyyy').format(_to!)
                                  : 'Datum wählen',
                              style: TextStyle(fontSize: 13,
                                  color: _to != null
                                      ? AppColors.text : AppColors.textTertiary),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ]),
              ],

              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _export,
                  icon: const Icon(LucideIcons.download, size: 16,
                      color: Colors.white),
                  label: const Text('Exportieren',
                      style: TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w600)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ]),
    );
  }
}

class _FormatToggle extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  const _FormatToggle({required this.label, required this.icon,
      required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.primary.withValues(alpha: 0.1) : AppColors.background,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
              color: selected ? AppColors.primary : AppColors.border,
              width: selected ? 1.5 : 1),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 15,
                color: selected ? AppColors.primary : AppColors.textTertiary),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(fontSize: 13,
                color: selected ? AppColors.primary : AppColors.textSecondary,
                fontWeight: selected ? FontWeight.w600 : FontWeight.normal)),
          ],
        ),
      ),
    );
  }
}

class _FormLabel extends StatelessWidget {
  final String text;
  const _FormLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(text, style: const TextStyle(
          fontSize: 13, fontWeight: FontWeight.w600,
          color: AppColors.textSecondary)),
    );
  }
}
