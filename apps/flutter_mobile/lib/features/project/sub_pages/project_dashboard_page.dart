import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../project_detail_screen.dart';

import '../../../core/services/supabase_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/burger_menu_leading.dart';

class ProjectDashboardPage extends StatefulWidget {
  final String projectId;
  const ProjectDashboardPage({super.key, required this.projectId});

  @override
  State<ProjectDashboardPage> createState() => _ProjectDashboardPageState();
}

class _ProjectDashboardPageState extends State<ProjectDashboardPage> {
  bool _loading = true;

  // Stats
  int _totalTasks = 0;
  int _completedTasks = 0;
  int _activeTasks = 0;
  int _blockedTasks = 0;
  int _openDefects = 0;
  int _criticalDefects = 0;

  // Recent tasks (latest 5)
  List<Map<String, dynamic>> _recentTasks = [];

  // Upcoming events (next 7 days)
  List<Map<String, dynamic>> _upcomingEvents = [];

  // Upcoming milestones
  List<Map<String, dynamic>> _milestones = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loading = true);
    try {
      final now = DateTime.now();
      final weekFromNow = now.add(const Duration(days: 7));

      final results = await Future.wait([
        SupabaseService.getTasks(widget.projectId),
        SupabaseService.client
            .from('timeline_events')
            .select('id, title, start_date, event_type')
            .eq('project_id', widget.projectId)
            .gte('start_date', now.toIso8601String())
            .lte('start_date', weekFromNow.toIso8601String())
            .order('start_date', ascending: true)
            .limit(5),
        SupabaseService.client
            .from('timeline_events')
            .select('id, title, event_date, end_date, description, color, event_type, completed')
            .eq('project_id', widget.projectId)
            .gte('event_date', now.toIso8601String().split('T')[0])
            .order('event_date', ascending: true)
            .limit(5),
      ]);

      final allTasks = (results[0] as List).cast<Map<String, dynamic>>();
      final events = (results[1] as List).cast<Map<String, dynamic>>();
      final milestones = (results[2] as List).cast<Map<String, dynamic>>();

      final taskItems = allTasks.where((t) => t['task_type'] == 'task' || t['task_type'] == null).toList();
      final defectItems = allTasks.where((t) => t['task_type'] == 'defect').toList();

      if (mounted) {
        setState(() {
          _totalTasks = taskItems.length;
          _completedTasks = taskItems.where((t) => t['status'] == 'done').length;
          _activeTasks = taskItems.where((t) => t['status'] == 'in_progress').length;
          _blockedTasks = taskItems.where((t) => t['status'] == 'blocked').length;
          _openDefects = defectItems.where((t) => t['status'] != 'done').length;
          _criticalDefects = defectItems.where((t) => t['priority'] == 'critical' && t['status'] != 'done').length;
          _recentTasks = allTasks.take(5).toList();
          _upcomingEvents = events;
          _milestones = milestones;
          _loading = false;
        });
      }
    } catch (e) {
      debugPrint('[Dashboard] load error: $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(leading: burgerMenuLeading(context), title: const Text('Übersicht')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.screenH, 16, AppSpacing.screenH, 32),
                children: [
                  // ── Progress Card ──────────────────────────────────────
                  _buildProgressCard(),
                  const SizedBox(height: 16),

                  // ── Stats Grid ─────────────────────────────────────────
                  _buildStatsGrid(),
                  const SizedBox(height: 16),

                  // ── Recent Activity ────────────────────────────────────
                  _buildRecentActivity(),
                  const SizedBox(height: 16),

                  // ── Upcoming Events ────────────────────────────────────
                  _buildUpcomingEvents(),
                  const SizedBox(height: 16),

                  // ── Defects Summary ────────────────────────────────────
                  if (_openDefects > 0) ...[
                    _buildDefectsSummary(),
                    const SizedBox(height: 16),
                  ],

                  // ── Milestones ─────────────────────────────────────────
                  _buildMilestones(),
                ],
              ),
            ),
    );
  }

  // ── Progress Card ──────────────────────────────────────────────────────────
  Widget _buildProgressCard() {
    final taskPct = _totalTasks > 0 ? (_completedTasks / _totalTasks) : 0.0;
    final milestoneDone = _milestones.where((m) => m['completed'] == true).length;
    final milestonePct = _milestones.isNotEmpty ? (milestoneDone / _milestones.length) : 0.0;
    final progress = (_totalTasks > 0 || _milestones.isNotEmpty)
        ? (taskPct * 0.7 + milestonePct * 0.3)
        : 0.0;
    final pct = (progress * 100).round();

    return _SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Gesamtfortschritt',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.text)),
          const SizedBox(height: 4),
          const Text('Alle Aufgaben und Meilensteine',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _ProgressDetail('Aufgaben', '${(taskPct * 100).round()}%'),
              _ProgressDetail('Meilensteine', '${(milestonePct * 100).round()}%'),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 10,
              backgroundColor: AppColors.border,
              valueColor: AlwaysStoppedAnimation<Color>(_progressColor(pct)),
            ),
          ),
          const SizedBox(height: 8),
          Text('$pct% abgeschlossen',
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary)),
        ],
      ),
    );
  }

  Color _progressColor(int pct) {
    if (pct < 33) return const Color(0xFFEF4444);
    if (pct < 66) return const Color(0xFFF59E0B);
    return const Color(0xFF22C55E);
  }

  // ── Stats Grid ─────────────────────────────────────────────────────────────
  Widget _buildStatsGrid() {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.6,
      children: [
        _StatCard(
          icon: LucideIcons.checkCircle,
          label: 'Abgeschlossen',
          value: '$_completedTasks',
          bgColor: const Color(0xFFEFF6FF),
          iconColor: AppColors.primary,
        ),
        _StatCard(
          icon: LucideIcons.clock,
          label: 'In Bearbeitung',
          value: '$_activeTasks',
          bgColor: const Color(0xFFFEF3C7),
          iconColor: const Color(0xFFF59E0B),
        ),
        _StatCard(
          icon: LucideIcons.alertTriangle,
          label: 'Blockiert',
          value: '$_blockedTasks',
          bgColor: const Color(0xFFFEE2E2),
          iconColor: const Color(0xFFEF4444),
        ),
        _StatCard(
          icon: LucideIcons.listTodo,
          label: 'Gesamt',
          value: '$_totalTasks',
          bgColor: const Color(0xFFF3E8FF),
          iconColor: const Color(0xFFA855F7),
        ),
      ],
    );
  }

  // ── Recent Activity ────────────────────────────────────────────────────────
  Widget _buildRecentActivity() {
    return _SectionCard(
      header: _CardHeader(
        icon: LucideIcons.activity,
        title: 'Letzte Aktivitäten',
        onAction: _recentTasks.isNotEmpty
            ? () => BurgerMenuScope.of(context)?.navigateTo?.call('tasks')
            : null,
        actionLabel: 'Alle',
      ),
      child: _recentTasks.isEmpty
          ? _emptyRow('Keine Aktivitäten vorhanden')
          : Column(
              children: _recentTasks.map((t) {
                final isDefect = t['task_type'] == 'defect';
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 7),
                  child: Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: isDefect
                              ? const Color(0xFFFEF3C7)
                              : const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(
                          isDefect
                              ? LucideIcons.alertTriangle
                              : LucideIcons.checkSquare,
                          size: 15,
                          color: isDefect
                              ? const Color(0xFFF59E0B)
                              : AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              t['title'] ?? '',
                              style: const TextStyle(
                                  fontSize: 14, color: AppColors.text),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              '${isDefect ? 'Mangel' : 'Aufgabe'} · ${_statusLabel(t['status'])}',
                              style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
    );
  }

  // ── Upcoming Events ────────────────────────────────────────────────────────
  Widget _buildUpcomingEvents() {
    return _SectionCard(
      header: _CardHeader(
        icon: LucideIcons.calendar,
        title: 'Anstehende Termine',
        onAction: () => BurgerMenuScope.of(context)?.navigateTo?.call('schedule'),
        actionLabel: 'Alle',
      ),
      child: _upcomingEvents.isEmpty
          ? _emptyRow('Keine Termine in den nächsten 7 Tagen')
          : Column(
              children: _upcomingEvents.map((e) {
                final dateStr = e['start_date'] as String?;
                String dateLabel = '';
                if (dateStr != null) {
                  try {
                    final dt = DateTime.parse(dateStr);
                    dateLabel =
                        '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}. '
                        '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
                  } catch (_) {}
                }
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 7),
                  child: Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(LucideIcons.calendar,
                            size: 15, color: AppColors.primary),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              e['title'] ?? '',
                              style: const TextStyle(
                                  fontSize: 14, color: AppColors.text),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (dateLabel.isNotEmpty)
                              Text(dateLabel,
                                  style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary)),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
    );
  }

  // ── Defects Summary ────────────────────────────────────────────────────────
  Widget _buildDefectsSummary() {
    return GestureDetector(
      onTap: () => BurgerMenuScope.of(context)?.navigateTo?.call('defects'),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _criticalDefects > 0
              ? const Color(0xFFFEF2F2)
              : AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: _criticalDefects > 0
                  ? const Color(0xFFFCA5A5)
                  : AppColors.border),
        ),
        child: Row(
          children: [
            Icon(LucideIcons.alertCircle,
                size: 20,
                color: _criticalDefects > 0
                    ? const Color(0xFFEF4444)
                    : AppColors.primary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Mängel',
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: AppColors.text)),
                  Text(
                    '$_openDefects offen'
                    '${_criticalDefects > 0 ? ' · $_criticalDefects kritisch' : ''}',
                    style: TextStyle(
                        fontSize: 13,
                        color: _criticalDefects > 0
                            ? const Color(0xFFEF4444)
                            : AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            const Icon(LucideIcons.chevronRight,
                size: 16, color: AppColors.textTertiary),
          ],
        ),
      ),
    );
  }

  // ── Milestones ─────────────────────────────────────────────────────────────
  Widget _buildMilestones() {
    return _SectionCard(
      header: _CardHeader(
        icon: LucideIcons.flag,
        title: 'Meilensteine & Termine',
        onAction: () => BurgerMenuScope.of(context)?.navigateTo?.call('schedule'),
        actionLabel: 'Alle',
      ),
      child: _milestones.isEmpty
          ? _emptyRow('Keine anstehenden Meilensteine')
          : Column(
              children: _milestones.map((m) {
                final dateStr = m['event_date'] as String?;
                DateTime? dt;
                if (dateStr != null) {
                  try { dt = DateTime.parse(dateStr); } catch (_) {}
                }
                final daysUntil = dt != null
                    ? dt.difference(DateTime.now()).inDays
                    : null;
                final isToday = daysUntil == 0;
                final isOverdue = daysUntil != null && daysUntil < 0;
                final isUpcoming = daysUntil != null && daysUntil > 0 && daysUntil <= 7;

                final barColor = m['color'] != null
                    ? _parseHex(m['color'] as String)
                    : (m['event_type'] == 'deadline'
                        ? const Color(0xFFEF4444)
                        : m['event_type'] == 'phase'
                            ? const Color(0xFF8B5CF6)
                            : AppColors.primary);

                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      // Color bar
                      Container(
                        width: 4,
                        height: 62.0,
                        decoration: BoxDecoration(
                          color: barColor,
                          borderRadius: const BorderRadius.only(
                            topLeft: Radius.circular(10),
                            bottomLeft: Radius.circular(10),
                          ),
                        ),
                      ),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      m['title'] ?? '',
                                      style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.text),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  if (m['completed'] == true)
                                    const Icon(LucideIcons.checkCircle,
                                        size: 14,
                                        color: Color(0xFF22C55E)),
                                ],
                              ),
                              const SizedBox(height: 3),
                              Row(
                                children: [
                                  if (dt != null)
                                    Text(
                                      '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}.${dt.year}',
                                      style: const TextStyle(
                                          fontSize: 12,
                                          color: AppColors.textSecondary),
                                    ),
                                  if (daysUntil != null) ...[
                                    const SizedBox(width: 8),
                                    Text(
                                      isToday
                                          ? '⚡ Heute'
                                          : isOverdue
                                              ? '⚠ ${daysUntil.abs()} Tag(e) überfällig'
                                              : isUpcoming
                                                  ? 'in $daysUntil Tag(en)'
                                                  : 'in $daysUntil Tag(en)',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: isToday || isUpcoming
                                            ? AppColors.primary
                                            : isOverdue
                                                ? const Color(0xFFEF4444)
                                                : AppColors.textSecondary,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
    );
  }

  String _statusLabel(String? s) {
    switch (s) {
      case 'open': return 'Offen';
      case 'in_progress': return 'In Bearbeitung';
      case 'done': return 'Erledigt';
      case 'blocked': return 'Blockiert';
      default: return s ?? '';
    }
  }

  Color _parseHex(String hex) {
    try {
      return Color(int.parse(hex.replaceFirst('#', '0xFF')));
    } catch (_) {
      return AppColors.primary;
    }
  }
}

// ── Shared Widgets ──────────────────────────────────────────────────────────

class _CardHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  const _CardHeader({
    required this.icon,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.primary),
        const SizedBox(width: 8),
        Expanded(
          child: Text(title,
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.text)),
        ),
        if (onAction != null && actionLabel != null)
          GestureDetector(
            onTap: onAction,
            child: Text(
              '$actionLabel →',
              style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.primary,
                  fontWeight: FontWeight.w600),
            ),
          ),
      ],
    );
  }
}

class _SectionCard extends StatelessWidget {
  final Widget child;
  final _CardHeader? header;

  const _SectionCard({required this.child, this.header});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (header != null) ...[header!, const SizedBox(height: 14)],
          child,
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color bgColor;
  final Color iconColor;

  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.bgColor,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, size: 18, color: iconColor),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(value,
                  style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.text)),
              Text(label,
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.textSecondary)),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProgressDetail extends StatelessWidget {
  final String label;
  final String value;
  const _ProgressDetail(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        margin: const EdgeInsets.symmetric(horizontal: 4),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w500)),
            Text(value,
                style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.primary,
                    fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}

Widget _emptyRow(String text) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Center(
        child: Text(text,
            style: const TextStyle(
                fontSize: 13, color: AppColors.textSecondary)),
      ),
    );
