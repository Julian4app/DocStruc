import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/providers/notifications_provider.dart';
import '../../core/services/supabase_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/widgets/shimmer_loading.dart';
import '../../core/widgets/status_pill.dart';
import '../../core/widgets/empty_state.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  List<Map<String, dynamic>> _projects = [];
  bool _loading = true;
  String _searchQuery = '';
  String _activeFilter = 'Alle';

  final _searchCtrl = TextEditingController();
  final _dateFormat = DateFormat('dd.MM.yyyy', 'de');

  static const _filters = [
    'Alle',
    'In Ausführung',
    'In Planung',
    'Angefragt',
    'Genehmigt',
    'Abgeschlossen',
    'Pausiert',
  ];

  // ── New project form controllers ──────────────────────────────────────────
  final _newNameCtrl = TextEditingController();
  final _newAddressCtrl = TextEditingController();
  final _newDescCtrl = TextEditingController();
  String _newStatus = 'In Planung';

  @override
  void initState() {
    super.initState();
    // Use addPostFrameCallback so the widget tree is fully built before loading
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadProjects();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _newNameCtrl.dispose();
    _newAddressCtrl.dispose();
    _newDescCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadProjects() async {
    setState(() => _loading = true);
    try {
      final data = await SupabaseService.getProjects();
      if (mounted) setState(() => _projects = data);
    } catch (_) {
      // Silently handle – empty list shown
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filteredProjects {
    var list = _projects;

    // Status filter – filter values ARE the DB values
    if (_activeFilter != 'Alle') {
      list = list
          .where((p) => (p['status'] as String?) == _activeFilter)
          .toList();
    }

    // Search
    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      list = list.where((p) {
        final name = (p['name'] ?? '').toString().toLowerCase();
        final addr = (p['address'] ?? '').toString().toLowerCase();
        return name.contains(q) || addr.contains(q);
      }).toList();
    }

    return list;
  }

  Color _projectColor(Map<String, dynamic> p) {
    if (p['color'] != null) {
      try {
        final hex = (p['color'] as String).replaceFirst('#', '');
        return Color(int.parse('FF$hex', radix: 16));
      } catch (_) {}
    }
    return AppColors.statusColor(p['status'] ?? '');
  }

  // ── Build ─────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    // Reload projects when user first becomes authenticated
    ref.listen<AuthState>(authProvider, (prev, next) {
      if (prev?.userId == null && next.userId != null && !next.loading) {
        _loadProjects();
      }
    });

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Projekte'),
        actions: [
          // Notification bell
          GestureDetector(
            onTap: () => context.go('/notifications'),
            child: Container(
              margin: const EdgeInsets.only(right: 6),
              child: Stack(
                children: [
                  const Padding(
                    padding: EdgeInsets.all(8),
                    child: Icon(LucideIcons.bell, size: 22, color: AppColors.text),
                  ),
                  Consumer(
                    builder: (context, ref, _) {
                      final unread = ref.watch(notificationsProvider).unreadCount;
                      if (unread == 0) return const SizedBox.shrink();
                      return Positioned(
                        right: 4,
                        top: 4,
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(
                            color: AppColors.danger,
                            shape: BoxShape.circle,
                          ),
                          constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                          child: Text(
                            unread > 9 ? '9+' : '$unread',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w700),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
          // Profile avatar
          GestureDetector(
            onTap: () => context.go('/profile'),
            child: Container(
              margin: const EdgeInsets.only(right: AppSpacing.screenH),
              child: CircleAvatar(
                radius: 18,
                backgroundColor: AppColors.primary,
                backgroundImage: authState.avatarUrl != null
                    ? NetworkImage(authState.avatarUrl!)
                    : null,
                child: authState.avatarUrl == null
                    ? Text(
                        authState.initials,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      )
                    : null,
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateSheet,
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 2,
        icon: const Icon(LucideIcons.plus, size: 20),
        label: const Text(
          'Neues Projekt',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
      ),
      body: Column(
        children: [
          // ── Search + filters ──────────────────────────────────────────────
          _buildSearchAndFilters(),

          // ── Content ───────────────────────────────────────────────────────
          Expanded(child: _buildContent()),
        ],
      ),
    );
  }

  // ── Search & filter bar ───────────────────────────────────────────────────
  Widget _buildSearchAndFilters() {
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screenH,
        AppSpacing.s,
        AppSpacing.screenH,
        AppSpacing.m,
      ),
      child: Column(
        children: [
          // Search
          TextField(
            controller: _searchCtrl,
            onChanged: (v) => setState(() => _searchQuery = v),
            decoration: InputDecoration(
              hintText: 'Projekt suchen…',
              hintStyle: const TextStyle(
                color: AppColors.textTertiary,
                fontSize: 14,
              ),
              prefixIcon: const Icon(LucideIcons.search,
                  size: 18, color: AppColors.textTertiary),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(LucideIcons.x,
                          size: 18, color: AppColors.textTertiary),
                      onPressed: () {
                        _searchCtrl.clear();
                        setState(() => _searchQuery = '');
                      },
                    )
                  : null,
              filled: true,
              fillColor: AppColors.background,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppSpacing.inputRadius),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.m),

          // Filter chips
          SizedBox(
            height: 36,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _filters.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final f = _filters[i];
                final active = f == _activeFilter;
                return GestureDetector(
                  onTap: () => setState(() => _activeFilter = f),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color:
                          active ? AppColors.primary : AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(20),
                      border: active
                          ? null
                          : Border.all(color: AppColors.border),
                    ),
                    child: Text(
                      f,
                      style: TextStyle(
                        color: active ? Colors.white : AppColors.textSecondary,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // ── Main content ──────────────────────────────────────────────────────────
  Widget _buildContent() {
    if (_loading) {
      return const ShimmerList();
    }

    final projects = _filteredProjects;

    if (projects.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadProjects,
        color: AppColors.primary,
        child: ListView(
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.15),
            EmptyState(
              icon: _searchQuery.isNotEmpty || _activeFilter != 'Alle'
                  ? LucideIcons.searchX
                  : LucideIcons.folderOpen,
              title: _searchQuery.isNotEmpty || _activeFilter != 'Alle'
                  ? 'Keine Projekte gefunden'
                  : 'Noch keine Projekte',
              subtitle: _searchQuery.isNotEmpty || _activeFilter != 'Alle'
                  ? 'Versuchen Sie eine andere Suche oder andere Filter.'
                  : 'Erstellen Sie Ihr erstes Projekt mit dem Button unten.',
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadProjects,
      color: AppColors.primary,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screenH,
          AppSpacing.m,
          AppSpacing.screenH,
          100, // extra space for FAB
        ),
        itemCount: projects.length,
        itemBuilder: (context, index) {
          final p = projects[index];
          return _ProjectCard(
            project: p,
            color: _projectColor(p),
            dateFormat: _dateFormat,
            onTap: () => context.go('/project/${p['id']}'),
          ).animate().fadeIn(
                duration: 300.ms,
                delay: (50 * index).ms,
              );
        },
      ),
    );
  }

  // ── Create project bottom sheet ───────────────────────────────────────────
  void _showCreateSheet() {
    _newNameCtrl.clear();
    _newAddressCtrl.clear();
    _newDescCtrl.clear();
    _newStatus = 'In Planung';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _CreateProjectSheet(
        nameCtrl: _newNameCtrl,
        addressCtrl: _newAddressCtrl,
        descCtrl: _newDescCtrl,
        initialStatus: _newStatus,
        onStatusChanged: (s) => _newStatus = s,
        onSubmit: _createProject,
      ),
    );
  }

  // _newStatus already holds the real DB value – pass through directly
  String _toDbStatus(String status) => status;

  Future<void> _createProject() async {
    if (_newNameCtrl.text.trim().isEmpty) return;
    final userId = SupabaseService.currentUserId;
    if (userId == null) return;

    Navigator.of(context).pop(); // close sheet

    setState(() => _loading = true);
    try {
      await SupabaseService.createProject({
        'name': _newNameCtrl.text.trim(),
        'address': _newAddressCtrl.text.trim().isEmpty
            ? null
            : _newAddressCtrl.text.trim(),
        'description': _newDescCtrl.text.trim().isEmpty
            ? null
            : _newDescCtrl.text.trim(),
        'status': _toDbStatus(_newStatus),
        'owner_id': userId,
      });
      await _loadProjects();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Projekt konnte nicht erstellt werden.')),
        );
      }
      setState(() => _loading = false);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── _ProjectCard ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _ProjectCard extends StatelessWidget {
  final Map<String, dynamic> project;
  final Color color;
  final DateFormat dateFormat;
  final VoidCallback onTap;

  const _ProjectCard({
    required this.project,
    required this.color,
    required this.dateFormat,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final name = project['name'] ?? 'Unbenannt';
    final status = project['status'] as String? ?? '';
    final statusLabel = _statusLabel(status);
    final address = project['address'] as String?;
    final createdAt = project['created_at'] as String?;
    String? dateStr;
    if (createdAt != null) {
      try {
        dateStr = dateFormat.format(DateTime.parse(createdAt));
      } catch (_) {}
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.m),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
          border: Border.all(color: AppColors.border),
        ),
        child: IntrinsicHeight(
          child: Row(
            children: [
              // Color indicator bar
              Container(
                width: 5,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(AppSpacing.cardRadius),
                    bottomLeft: Radius.circular(AppSpacing.cardRadius),
                  ),
                ),
              ),

              // Content
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.cardPadding),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Title + status
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              name,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: AppColors.text,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (statusLabel.isNotEmpty)
                            StatusPill(
                              label: statusLabel,
                              color: AppColors.statusColor(status),
                            ),
                        ],
                      ),

                      if (address != null && address.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(LucideIcons.mapPin,
                                size: 14, color: AppColors.textTertiary),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                address,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: AppColors.textSecondary,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],

                      if (dateStr != null) ...[
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            const Icon(LucideIcons.calendar,
                                size: 13, color: AppColors.textTertiary),
                            const SizedBox(width: 6),
                            Text(
                              'Erstellt am $dateStr',
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textTertiary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              // Chevron
              const Padding(
                padding: EdgeInsets.only(right: 12),
                child: Icon(LucideIcons.chevronRight,
                    size: 18, color: AppColors.textTertiary),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _statusLabel(String raw) {
    // Real German DB values pass through as-is
    const knownGerman = {
      'Angefragt', 'In Planung', 'Genehmigt', 'In Ausführung',
      'Abgeschlossen', 'Pausiert', 'Abgebrochen', 'Nachbesserung',
    };
    if (knownGerman.contains(raw)) return raw;
    // Legacy English fallbacks
    switch (raw.toLowerCase()) {
      case 'planning': return 'In Planung';
      case 'active':   return 'In Ausführung';
      case 'completed': return 'Abgeschlossen';
      case 'archived':  return 'Archiviert';
      default:
        return raw.isNotEmpty
            ? raw[0].toUpperCase() + raw.substring(1)
            : '';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── _CreateProjectSheet ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _CreateProjectSheet extends StatefulWidget {
  final TextEditingController nameCtrl;
  final TextEditingController addressCtrl;
  final TextEditingController descCtrl;
  final String initialStatus;
  final ValueChanged<String> onStatusChanged;
  final VoidCallback onSubmit;

  const _CreateProjectSheet({
    required this.nameCtrl,
    required this.addressCtrl,
    required this.descCtrl,
    required this.initialStatus,
    required this.onStatusChanged,
    required this.onSubmit,
  });

  @override
  State<_CreateProjectSheet> createState() => _CreateProjectSheetState();
}

class _CreateProjectSheetState extends State<_CreateProjectSheet> {
  late String _status;

  @override
  void initState() {
    super.initState();
    _status = widget.initialStatus;
  }

  InputDecoration _decoration(String label, IconData icon) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(
        color: AppColors.textSecondary,
        fontSize: 14,
      ),
      prefixIcon: Icon(icon, size: 20, color: AppColors.textTertiary),
      filled: true,
      fillColor: AppColors.surfaceVariant,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(24, 16, 24, 24 + bottomInset),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Handle
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
            const SizedBox(height: 20),
            const Text(
              'Neues Projekt erstellen',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.text,
              ),
            ),
            const SizedBox(height: 20),

            // Name
            TextField(
              controller: widget.nameCtrl,
              textCapitalization: TextCapitalization.sentences,
              decoration: _decoration('Projektname *', LucideIcons.building2),
            ),
            const SizedBox(height: 14),

            // Address
            TextField(
              controller: widget.addressCtrl,
              textCapitalization: TextCapitalization.sentences,
              decoration:
                  _decoration('Adresse (optional)', LucideIcons.mapPin),
            ),
            const SizedBox(height: 14),

            // Description
            TextField(
              controller: widget.descCtrl,
              maxLines: 3,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                labelText: 'Beschreibung (optional)',
                labelStyle: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 14,
                ),
                prefixIcon: const Padding(
                  padding: EdgeInsets.only(bottom: 40),
                  child: Icon(LucideIcons.alignLeft,
                      size: 20, color: AppColors.textTertiary),
                ),
                filled: true,
                fillColor: AppColors.surfaceVariant,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      const BorderSide(color: AppColors.primary, width: 1.5),
                ),
              ),
            ),
            const SizedBox(height: 14),

            // Status dropdown
            DropdownButtonFormField<String>(
              value: _status,
              decoration: _decoration('Status', LucideIcons.tag),
              items: const [
                DropdownMenuItem(value: 'Angefragt',     child: Text('Angefragt')),
                DropdownMenuItem(value: 'In Planung',    child: Text('In Planung')),
                DropdownMenuItem(value: 'Genehmigt',     child: Text('Genehmigt')),
                DropdownMenuItem(value: 'In Ausführung', child: Text('In Ausführung')),
                DropdownMenuItem(value: 'Abgeschlossen', child: Text('Abgeschlossen')),
                DropdownMenuItem(value: 'Pausiert',      child: Text('Pausiert')),
                DropdownMenuItem(value: 'Abgebrochen',   child: Text('Abgebrochen')),
                DropdownMenuItem(value: 'Nachbesserung', child: Text('Nachbesserung')),
              ],
              onChanged: (v) {
                if (v != null) {
                  setState(() => _status = v);
                  widget.onStatusChanged(v);
                }
              },
            ),
            const SizedBox(height: 24),

            // Submit
            SizedBox(
              height: 50,
              child: ElevatedButton(
                onPressed: widget.onSubmit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'Projekt erstellen',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
