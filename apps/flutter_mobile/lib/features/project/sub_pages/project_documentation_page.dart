import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/services/supabase_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/burger_menu_leading.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

String _fmtDate(String iso) {
  try {
    final dt = DateTime.parse(iso).toLocal();
    return DateFormat('dd.MM.yyyy', 'de').format(dt);
  } catch (_) {
    return iso;
  }
}

String _fmtTime(String iso) {
  try {
    final dt = DateTime.parse(iso).toLocal();
    return DateFormat('HH:mm', 'de').format(dt);
  } catch (_) {
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

class ProjectDocumentationPage extends StatefulWidget {
  final String projectId;
  const ProjectDocumentationPage({super.key, required this.projectId});

  @override
  State<ProjectDocumentationPage> createState() =>
      _ProjectDocumentationPageState();
}

class _ProjectDocumentationPageState extends State<ProjectDocumentationPage> {
  static const int _pageSize = 50;

  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  int _total = 0;

  List<Map<String, dynamic>> _entries = [];
  List<Map<String, dynamic>> _filtered = [];

  final TextEditingController _searchCtrl = TextEditingController();
  String _search = '';

  // Filters
  String _taskTypeFilter = 'all'; // 'all' | 'task' | 'defect'
  bool _imageFilter = false;
  bool _videoFilter = false;

  bool _showFilterPanel = false;

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(_onSearchChanged);
    _loadPage(reset: true);
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    setState(() {
      _search = _searchCtrl.text;
      _applyFilters();
    });
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  Future<void> _loadPage({bool reset = false}) async {
    if (!reset && (_loadingMore || !_hasMore)) return;

    if (reset) {
      setState(() {
        _loading = true;
        _entries = [];
        _hasMore = true;
      });
    } else {
      setState(() => _loadingMore = true);
    }

    try {
      final result = await SupabaseService.getTaskDocEntries(
        projectId: widget.projectId,
        from: reset ? 0 : _entries.length,
        pageSize: _pageSize,
      );

      final newEntries = (result['entries'] as List).cast<Map<String, dynamic>>();
      final total = result['total'] as int;
      final hasMore = result['hasMore'] as bool;

      if (mounted) {
        setState(() {
          if (reset) {
            _entries = newEntries;
          } else {
            _entries = [..._entries, ...newEntries];
          }
          _total = total;
          _hasMore = hasMore;
          _loading = false;
          _loadingMore = false;
          _applyFilters();
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
        _snack('Fehler beim Laden: $e', error: true);
      }
    }
  }

  void _applyFilters() {
    var filtered = List<Map<String, dynamic>>.from(_entries);

    if (_search.isNotEmpty) {
      final q = _search.toLowerCase();
      filtered = filtered
          .where((e) =>
              (e['task_title'] as String).toLowerCase().contains(q) ||
              (e['content'] as String).toLowerCase().contains(q) ||
              (e['user_name'] as String).toLowerCase().contains(q))
          .toList();
    }

    if (_taskTypeFilter != 'all') {
      filtered = filtered.where((e) => e['task_type'] == _taskTypeFilter).toList();
    }

    if (_imageFilter) {
      filtered = filtered.where((e) => e['documentation_type'] == 'image').toList();
    }

    if (_videoFilter) {
      filtered = filtered.where((e) => e['documentation_type'] == 'video').toList();
    }

    _filtered = filtered;
  }

  // ── Grouping ──────────────────────────────────────────────────────────────

  Map<String, List<Map<String, dynamic>>> _groupByDate(
      List<Map<String, dynamic>> entries) {
    final map = <String, List<Map<String, dynamic>>>{};
    for (final e in entries) {
      final date = _fmtDate(e['created_at'] as String);
      (map[date] ??= []).add(e);
    }
    return map;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  int get _activeFilterCount {
    int c = 0;
    if (_taskTypeFilter != 'all') c++;
    if (_imageFilter) c++;
    if (_videoFilter) c++;
    return c;
  }

  void _clearFilters() {
    setState(() {
      _taskTypeFilter = 'all';
      _imageFilter = false;
      _videoFilter = false;
      _applyFilters();
    });
  }

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor:
          error ? const Color(0xFFDC2626) : const Color(0xFF10B981),
      behavior: SnackBarBehavior.floating,
    ));
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: burgerMenuLeading(context),
        title: const Text('Dokumentation'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // ── Subtitle bar ────────────────────────────────────────────
                Container(
                  color: AppColors.surface,
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                  child: Text(
                    '$_total Einträge · Chronologische Timeline aller Dokumentationen',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
                // ── Search + Filter bar ──────────────────────────────────────
                _SearchFilterBar(
                  controller: _searchCtrl,
                  search: _search,
                  activeFilterCount: _activeFilterCount,
                  showFilterPanel: _showFilterPanel,
                  onToggleFilter: () =>
                      setState(() => _showFilterPanel = !_showFilterPanel),
                  onClearSearch: () {
                    _searchCtrl.clear();
                    setState(() {
                      _search = '';
                      _applyFilters();
                    });
                  },
                ),
                // ── Filter Panel ────────────────────────────────────────────
                if (_showFilterPanel)
                  _FilterPanel(
                    taskTypeFilter: _taskTypeFilter,
                    imageFilter: _imageFilter,
                    videoFilter: _videoFilter,
                    activeFilterCount: _activeFilterCount,
                    onTaskTypeChanged: (v) =>
                        setState(() {
                          _taskTypeFilter = v;
                          _applyFilters();
                        }),
                    onImageFilterChanged: (v) =>
                        setState(() {
                          _imageFilter = v;
                          _applyFilters();
                        }),
                    onVideoFilterChanged: (v) =>
                        setState(() {
                          _videoFilter = v;
                          _applyFilters();
                        }),
                    onClearFilters: _clearFilters,
                  ),
                const SizedBox(height: 4),
                // ── Timeline ────────────────────────────────────────────────
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: () => _loadPage(reset: true),
                    child: _filtered.isEmpty
                        ? _buildEmpty()
                        : _buildTimeline(),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildEmpty() {
    final hasFilters = _search.isNotEmpty || _activeFilterCount > 0;
    return ListView(
      children: [
        const SizedBox(height: 80),
        Center(
          child: Column(
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: AppColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(40),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Icon(LucideIcons.fileText,
                    size: 36, color: AppColors.textTertiary),
              ),
              const SizedBox(height: 20),
              Text(
                hasFilters
                    ? 'Keine Einträge gefunden'
                    : 'Noch keine Dokumentation vorhanden',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.text,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                hasFilters
                    ? 'Versuche, die Suchbegriffe oder Filter zu ändern.'
                    : 'Dokumentationseinträge werden hier angezeigt, sobald\nAufgaben dokumentiert werden.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 14, color: AppColors.textSecondary),
              ),
              if (hasFilters) ...[
                const SizedBox(height: 20),
                TextButton.icon(
                  onPressed: () {
                    _clearFilters();
                    _searchCtrl.clear();
                  },
                  icon: const Icon(LucideIcons.x, size: 16),
                  label: const Text('Filter zurücksetzen'),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.primary,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTimeline() {
    final grouped = _groupByDate(_filtered);
    final dates = grouped.keys.toList();

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
      itemCount: dates.length + (_hasMore ? 1 : 0),
      itemBuilder: (ctx, i) {
        if (i == dates.length) {
          // Load more button
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: _loadingMore
                ? const Center(child: CircularProgressIndicator())
                : OutlinedButton.icon(
                    onPressed: () => _loadPage(),
                    icon: const Icon(LucideIcons.chevronDown, size: 16),
                    label: Text(
                        'Mehr laden (${_entries.length} / $_total Einträge)'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.border),
                      padding: const EdgeInsets.symmetric(
                          vertical: 14, horizontal: 20),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
          );
        }
        final date = dates[i];
        final items = grouped[date]!;
        return _DateSection(
          date: date,
          entries: items,
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Search + Filter Bar
// ─────────────────────────────────────────────────────────────────────────────

class _SearchFilterBar extends StatelessWidget {
  final TextEditingController controller;
  final String search;
  final int activeFilterCount;
  final bool showFilterPanel;
  final VoidCallback onToggleFilter;
  final VoidCallback onClearSearch;

  const _SearchFilterBar({
    required this.controller,
    required this.search,
    required this.activeFilterCount,
    required this.showFilterPanel,
    required this.onToggleFilter,
    required this.onClearSearch,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: Row(
        children: [
          // Search field
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.surfaceVariant,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: TextField(
                controller: controller,
                decoration: InputDecoration(
                  hintText: 'Dokumentation durchsuchen…',
                  hintStyle: const TextStyle(color: AppColors.textTertiary),
                  prefixIcon: const Icon(LucideIcons.search,
                      size: 18, color: AppColors.textTertiary),
                  suffixIcon: search.isNotEmpty
                      ? IconButton(
                          icon: const Icon(LucideIcons.x,
                              size: 16, color: AppColors.textTertiary),
                          onPressed: onClearSearch,
                        )
                      : null,
                  border: InputBorder.none,
                  contentPadding:
                      const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          // Filter button
          GestureDetector(
            onTap: onToggleFilter,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: showFilterPanel || activeFilterCount > 0
                    ? AppColors.primary.withValues(alpha: 0.1)
                    : AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: showFilterPanel || activeFilterCount > 0
                      ? AppColors.primary
                      : AppColors.border,
                  width: showFilterPanel || activeFilterCount > 0 ? 1.5 : 1,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.filter,
                      size: 16,
                      color: showFilterPanel || activeFilterCount > 0
                          ? AppColors.primary
                          : AppColors.textSecondary),
                  const SizedBox(width: 6),
                  Text(
                    'Filter',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: showFilterPanel || activeFilterCount > 0
                          ? AppColors.primary
                          : AppColors.textSecondary,
                    ),
                  ),
                  if (activeFilterCount > 0) ...[
                    const SizedBox(width: 6),
                    Container(
                      width: 20,
                      height: 20,
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '$activeFilterCount',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter Panel
// ─────────────────────────────────────────────────────────────────────────────

class _FilterPanel extends StatelessWidget {
  final String taskTypeFilter;
  final bool imageFilter;
  final bool videoFilter;
  final int activeFilterCount;
  final void Function(String) onTaskTypeChanged;
  final void Function(bool) onImageFilterChanged;
  final void Function(bool) onVideoFilterChanged;
  final VoidCallback onClearFilters;

  const _FilterPanel({
    required this.taskTypeFilter,
    required this.imageFilter,
    required this.videoFilter,
    required this.activeFilterCount,
    required this.onTaskTypeChanged,
    required this.onImageFilterChanged,
    required this.onVideoFilterChanged,
    required this.onClearFilters,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Divider(color: AppColors.border, height: 1),
          const SizedBox(height: 14),
          // Task/Defect filter
          const Text('Aufgaben / Mängel',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary)),
          const SizedBox(height: 8),
          Row(
            children: [
              _FilterChip(
                  label: 'Alle',
                  active: taskTypeFilter == 'all',
                  onTap: () => onTaskTypeChanged('all')),
              const SizedBox(width: 8),
              _FilterChip(
                  label: 'Aufgaben',
                  icon: LucideIcons.checkSquare,
                  iconColor: const Color(0xFF3B82F6),
                  active: taskTypeFilter == 'task',
                  onTap: () => onTaskTypeChanged('task')),
              const SizedBox(width: 8),
              _FilterChip(
                  label: 'Mängel',
                  icon: LucideIcons.alertTriangle,
                  iconColor: const Color(0xFFDC2626),
                  active: taskTypeFilter == 'defect',
                  onTap: () => onTaskTypeChanged('defect')),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(color: AppColors.border, height: 1),
          const SizedBox(height: 14),
          // Media type filter
          const Text('Medientyp',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary)),
          const SizedBox(height: 8),
          Row(
            children: [
              _FilterChip(
                  label: 'Mit Bildern',
                  icon: LucideIcons.image,
                  iconColor: const Color(0xFF10B981),
                  active: imageFilter,
                  onTap: () => onImageFilterChanged(!imageFilter)),
              const SizedBox(width: 8),
              _FilterChip(
                  label: 'Mit Videos',
                  icon: LucideIcons.video,
                  iconColor: const Color(0xFF8B5CF6),
                  active: videoFilter,
                  onTap: () => onVideoFilterChanged(!videoFilter)),
            ],
          ),
          if (activeFilterCount > 0) ...[
            const SizedBox(height: 14),
            const Divider(color: AppColors.border, height: 1),
            const SizedBox(height: 10),
            GestureDetector(
              onTap: onClearFilters,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEE2E2),
                  borderRadius: BorderRadius.circular(8),
                ),
                alignment: Alignment.center,
                child: const Text(
                  'Filter zurücksetzen',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFFDC2626),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final IconData? icon;
  final Color? iconColor;
  final bool active;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    this.icon,
    this.iconColor,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: active
              ? AppColors.primary.withValues(alpha: 0.1)
              : AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: active ? AppColors.primary : AppColors.border,
            width: active ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon,
                  size: 14,
                  color: active
                      ? AppColors.primary
                      : (iconColor ?? AppColors.textSecondary)),
              const SizedBox(width: 5),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: active ? AppColors.primary : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Date Section
// ─────────────────────────────────────────────────────────────────────────────

class _DateSection extends StatelessWidget {
  final String date;
  final List<Map<String, dynamic>> entries;

  const _DateSection({required this.date, required this.entries});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Date header
        Padding(
          padding: const EdgeInsets.only(bottom: 12, top: 20),
          child: Row(
            children: [
              const Icon(LucideIcons.calendar,
                  size: 18, color: AppColors.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      date,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: AppColors.text,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      height: 2,
                      color: AppColors.border,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${entries.length}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
        ),
        // Entries
        ...entries.map((e) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _EntryCard(entry: e),
            )),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry Card
// ─────────────────────────────────────────────────────────────────────────────

class _EntryCard extends StatelessWidget {
  final Map<String, dynamic> entry;

  const _EntryCard({required this.entry});

  @override
  Widget build(BuildContext context) {
    final isDefect = entry['task_type'] == 'defect';
    final docType = entry['documentation_type'] as String? ?? 'text';
    final content = entry['content'] as String? ?? '';
    final fileName = entry['file_name'] as String?;
    final taskTitle = entry['task_title'] as String? ?? 'Unbekannt';
    final userName = entry['user_name'] as String? ?? 'Unbekannt';
    final createdAt = entry['created_at'] as String? ?? '';

    final typeColor =
        isDefect ? const Color(0xFFDC2626) : const Color(0xFF3B82F6);
    final typeBg =
        isDefect ? const Color(0xFFFEE2E2) : const Color(0xFFEFF6FF);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: type badge + task title
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Type badge
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: typeBg,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isDefect
                          ? LucideIcons.alertTriangle
                          : LucideIcons.checkSquare,
                      size: 11,
                      color: typeColor,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      isDefect ? 'MANGEL' : 'AUFGABE',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: typeColor,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              // Task title
              Expanded(
                child: Text(
                  taskTitle,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.text,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Meta row: time, user, media type
          Wrap(
            spacing: 14,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(LucideIcons.clock,
                      size: 12, color: AppColors.textTertiary),
                  const SizedBox(width: 4),
                  Text(_fmtTime(createdAt),
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textSecondary)),
                ],
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(LucideIcons.user,
                      size: 12, color: AppColors.textTertiary),
                  const SizedBox(width: 4),
                  Text(userName,
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textSecondary)),
                ],
              ),
              if (docType == 'image')
                _MediaBadge(
                  icon: LucideIcons.image,
                  label: 'Bild',
                  color: const Color(0xFF16A34A),
                  bg: const Color(0xFFDCFCE7),
                ),
              if (docType == 'video')
                _MediaBadge(
                  icon: LucideIcons.video,
                  label: 'Video',
                  color: const Color(0xFF9333EA),
                  bg: const Color(0xFFF3E8FF),
                ),
              if (docType == 'voice')
                _MediaBadge(
                  icon: LucideIcons.mic,
                  label: 'Sprachnotiz',
                  color: const Color(0xFF0EA5E9),
                  bg: const Color(0xFFE0F2FE),
                ),
            ],
          ),

          // Content
          if (content.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              content,
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.text,
                height: 1.55,
              ),
            ),
          ],

          // File name
          if (fileName != null && fileName.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Divider(color: AppColors.borderLight, height: 1),
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(LucideIcons.file,
                    size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    fileName,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      fontStyle: FontStyle.italic,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Media Badge
// ─────────────────────────────────────────────────────────────────────────────

class _MediaBadge extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final Color bg;

  const _MediaBadge(
      {required this.icon,
      required this.label,
      required this.color,
      required this.bg});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
                fontSize: 11, fontWeight: FontWeight.w700, color: color),
          ),
        ],
      ),
    );
  }
}
