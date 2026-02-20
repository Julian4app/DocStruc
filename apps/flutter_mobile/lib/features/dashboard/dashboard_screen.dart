import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:image_picker/image_picker.dart';

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
  final _newNameCtrl     = TextEditingController();
  final _newSubtitleCtrl = TextEditingController();
  final _newStreetCtrl   = TextEditingController();
  final _newZipCtrl      = TextEditingController();
  final _newCityCtrl     = TextEditingController();
  final _newDescCtrl     = TextEditingController();
  String _newStatus  = 'In Planung';
  String _newCountry = 'DE';
  List<({String name, Uint8List bytes, String ext})> _pendingImages = [];
  List<({String email, String type})> _pendingMembers = [];
  String? _editingProjectId; // non-null = edit mode

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
    _newSubtitleCtrl.dispose();
    _newStreetCtrl.dispose();
    _newZipCtrl.dispose();
    _newCityCtrl.dispose();
    _newDescCtrl.dispose();
    super.dispose();
  }

  // ── Edit project sheet ───────────────────────────────────────────────────
  void _showEditSheet(Map<String, dynamic> project) {
    _newNameCtrl.text     = project['name'] as String? ?? '';
    _newSubtitleCtrl.text = project['subtitle'] as String? ?? '';
    _newStreetCtrl.text   = project['street'] as String? ?? '';
    _newZipCtrl.text      = project['zip'] as String? ?? '';
    _newCityCtrl.text     = project['city'] as String? ?? '';
    _newDescCtrl.text     = project['description'] as String? ?? '';
    _newStatus  = project['status'] as String? ?? 'In Planung';
    _newCountry = project['country'] as String? ?? 'DE';
    _pendingImages = [];
    _pendingMembers = [];
    _editingProjectId = project['id'] as String;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _CreateProjectSheet(
        nameCtrl:       _newNameCtrl,
        subtitleCtrl:   _newSubtitleCtrl,
        streetCtrl:     _newStreetCtrl,
        zipCtrl:        _newZipCtrl,
        cityCtrl:       _newCityCtrl,
        descCtrl:       _newDescCtrl,
        initialStatus:  _newStatus,
        initialCountry: _newCountry,
        isEditMode:     true,
        onStatusChanged:  (s) => _newStatus = s,
        onCountryChanged: (c) => _newCountry = c,
        onImagesChanged:  (imgs) => _pendingImages = imgs,
        onMembersChanged: (members) => _pendingMembers = members,
        onSubmit: _updateProject,
      ),
    ).whenComplete(() => _editingProjectId = null);
  }

  Future<void> _updateProject() async {
    final projectId = _editingProjectId;
    if (projectId == null || _newNameCtrl.text.trim().isEmpty) return;

    Navigator.of(context).pop();
    setState(() => _loading = true);
    try {
      final addressParts = [_newStreetCtrl.text.trim(), _newZipCtrl.text.trim(), _newCityCtrl.text.trim()]
          .where((s) => s.isNotEmpty).toList();
      final fullAddress = addressParts.join(', ');

      await SupabaseService.updateProject(projectId, {
        'name':        _newNameCtrl.text.trim(),
        'subtitle':    _newSubtitleCtrl.text.trim().isEmpty ? null : _newSubtitleCtrl.text.trim(),
        'address':     fullAddress.isEmpty ? null : fullAddress,
        'street':      _newStreetCtrl.text.trim().isEmpty ? null : _newStreetCtrl.text.trim(),
        'zip':         _newZipCtrl.text.trim().isEmpty ? null : _newZipCtrl.text.trim(),
        'city':        _newCityCtrl.text.trim().isEmpty ? null : _newCityCtrl.text.trim(),
        'country':     _newCountry,
        'description': _newDescCtrl.text.trim().isEmpty ? null : _newDescCtrl.text.trim(),
        'status':      _newStatus,
      });

      // Upload new project images if any
      for (final img in _pendingImages) {
        try {
          await SupabaseService.uploadProjectImage(projectId, img.bytes, img.ext);
        } catch (_) {}
      }

      // Add new members
      final userId = SupabaseService.currentUserId;
      if (userId != null) {
        for (final member in _pendingMembers) {
          try {
            await SupabaseService.addProjectMemberByEmail(
              projectId: projectId,
              email: member.email,
              memberType: member.type,
              addedBy: userId,
            );
          } catch (_) {}
        }
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Projekt aktualisiert'), backgroundColor: AppColors.success, behavior: SnackBarBehavior.floating));
      }
      await _loadProjects();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Projekt konnte nicht aktualisiert werden.')));
      }
      setState(() => _loading = false);
    }
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
            onLongPress: () => _showEditSheet(p),
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
    _newSubtitleCtrl.clear();
    _newStreetCtrl.clear();
    _newZipCtrl.clear();
    _newCityCtrl.clear();
    _newDescCtrl.clear();
    _newStatus  = 'In Planung';
    _newCountry = 'DE';
    _pendingImages = [];
    _pendingMembers = [];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _CreateProjectSheet(
        nameCtrl:       _newNameCtrl,
        subtitleCtrl:   _newSubtitleCtrl,
        streetCtrl:     _newStreetCtrl,
        zipCtrl:        _newZipCtrl,
        cityCtrl:       _newCityCtrl,
        descCtrl:       _newDescCtrl,
        initialStatus:  _newStatus,
        initialCountry: _newCountry,
        isEditMode:     false,
        onStatusChanged:  (s) => _newStatus = s,
        onCountryChanged: (c) => _newCountry = c,
        onImagesChanged:  (imgs) => _pendingImages = imgs,
        onMembersChanged: (members) => _pendingMembers = members,
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
      // Build the full address string from components
      final addressParts = [_newStreetCtrl.text.trim(), _newZipCtrl.text.trim(), _newCityCtrl.text.trim()].where((s) => s.isNotEmpty).toList();
      final fullAddress = addressParts.join(', ');

      await SupabaseService.createProject({
        'name':        _newNameCtrl.text.trim(),
        'subtitle':    _newSubtitleCtrl.text.trim().isEmpty ? null : _newSubtitleCtrl.text.trim(),
        'address':     fullAddress.isEmpty ? null : fullAddress,
        'street':      _newStreetCtrl.text.trim().isEmpty ? null : _newStreetCtrl.text.trim(),
        'zip':         _newZipCtrl.text.trim().isEmpty ? null : _newZipCtrl.text.trim(),
        'city':        _newCityCtrl.text.trim().isEmpty ? null : _newCityCtrl.text.trim(),
        'country':     _newCountry,
        'description': _newDescCtrl.text.trim().isEmpty ? null : _newDescCtrl.text.trim(),
        'status':      _toDbStatus(_newStatus),
        'owner_id':    userId,
      });

      // Upload project images + add pending members
      if (_pendingImages.isNotEmpty || _pendingMembers.isNotEmpty) {
        final projects = await SupabaseService.getProjects();
        final created = projects.isNotEmpty ? projects.first : null;
        if (created != null) {
          final projectId = created['id'] as String;
          for (final img in _pendingImages) {
            try {
              await SupabaseService.uploadProjectImage(projectId, img.bytes, img.ext);
            } catch (_) {}
          }
          for (final member in _pendingMembers) {
            try {
              await SupabaseService.addProjectMemberByEmail(
                projectId: projectId,
                email: member.email,
                memberType: member.type,
                addedBy: userId,
              );
            } catch (_) {}
          }
        }
      }

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
  final VoidCallback onLongPress;

  const _ProjectCard({
    required this.project,
    required this.color,
    required this.dateFormat,
    required this.onTap,
    required this.onLongPress,
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
      onLongPress: onLongPress,
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

              // Edit + Chevron
              GestureDetector(
                onTap: onLongPress, // edit on tap of pencil icon
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: AppColors.background,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: const Icon(LucideIcons.pencil,
                        size: 15, color: AppColors.textTertiary),
                  ),
                ),
              ),
              const Padding(
                padding: EdgeInsets.only(right: 8),
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
  final TextEditingController subtitleCtrl;
  final TextEditingController streetCtrl;
  final TextEditingController zipCtrl;
  final TextEditingController cityCtrl;
  final TextEditingController descCtrl;
  final String initialStatus;
  final String initialCountry;
  final bool isEditMode;
  final ValueChanged<String> onStatusChanged;
  final ValueChanged<String> onCountryChanged;
  final ValueChanged<List<({String name, Uint8List bytes, String ext})>> onImagesChanged;
  final ValueChanged<List<({String email, String type})>> onMembersChanged;
  final VoidCallback onSubmit;

  const _CreateProjectSheet({
    required this.nameCtrl,
    required this.subtitleCtrl,
    required this.streetCtrl,
    required this.zipCtrl,
    required this.cityCtrl,
    required this.descCtrl,
    required this.initialStatus,
    required this.initialCountry,
    required this.isEditMode,
    required this.onStatusChanged,
    required this.onCountryChanged,
    required this.onImagesChanged,
    required this.onMembersChanged,
    required this.onSubmit,
  });

  @override
  State<_CreateProjectSheet> createState() => _CreateProjectSheetState();
}

class _CreateProjectSheetState extends State<_CreateProjectSheet> {
  late String _status;
  late String _country;
  List<({String name, Uint8List bytes, String ext})> _images = [];
  List<({String email, String type})> _members = [];

  static const _countries = [
    ('DE', '🇩🇪', 'Deutschland'),
    ('AT', '🇦🇹', 'Österreich'),
    ('CH', '🇨🇭', 'Schweiz'),
    ('FR', '🇫🇷', 'Frankreich'),
    ('IT', '🇮🇹', 'Italien'),
    ('NL', '🇳🇱', 'Niederlande'),
    ('BE', '🇧🇪', 'Belgien'),
    ('PL', '🇵🇱', 'Polen'),
    ('CZ', '🇨🇿', 'Tschechien'),
    ('LU', '🇱🇺', 'Luxemburg'),
  ];

  // Member type config: (key, label, icon, color)
  static const _memberTypes = [
    ('employee',      'Mitarbeiter',  LucideIcons.hardHat,    Color(0xFF3B82F6)),
    ('owner',         'Bauherren',    LucideIcons.userCheck,  Color(0xFF10B981)),
    ('subcontractor', 'Gewerke',      LucideIcons.wrench,     Color(0xFFF59E0B)),
  ];

  @override
  void initState() {
    super.initState();
    _status  = widget.initialStatus;
    _country = widget.initialCountry;
  }

  Future<void> _pickImages() async {
    final picker = ImagePicker();
    final picked = await picker.pickMultiImage(imageQuality: 80);
    if (picked.isEmpty) return;
    final newImgs = <({String name, Uint8List bytes, String ext})>[];
    for (final f in picked) {
      final bytes = await f.readAsBytes();
      final ext   = f.name.split('.').last.toLowerCase();
      newImgs.add((name: f.name, bytes: bytes, ext: ext));
    }
    setState(() => _images = [..._images, ...newImgs]);
    widget.onImagesChanged(_images);
  }

  void _showAddMemberSheet(String memberType, String memberLabel, Color memberColor) {
    final emailCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final safeBottom = MediaQuery.of(ctx).padding.bottom;
        return Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(ctx).viewInsets.bottom + safeBottom + 24),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            Row(children: [
              Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: memberColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
                child: Icon(_memberTypes.firstWhere((t) => t.$1 == memberType).$3, size: 20, color: memberColor)),
              const SizedBox(width: 12),
              Expanded(child: Text('$memberLabel hinzufügen', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text))),
              GestureDetector(
                onTap: () => Navigator.pop(ctx),
                child: const Icon(LucideIcons.x, size: 20, color: AppColors.textSecondary),
              ),
            ]),
            const SizedBox(height: 6),
            Text('E-Mail-Adresse eingeben. Der Nutzer wird nach der Projekterstellung zur "Beteiligte"-Seite hinzugefügt.',
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
            const SizedBox(height: 16),
            TextField(
              controller: emailCtrl,
              autofocus: true,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(
                hintText: 'email@beispiel.de',
                prefixIcon: const Icon(LucideIcons.mail, size: 18),
                filled: true, fillColor: AppColors.surfaceVariant,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.border)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.border)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: memberColor, width: 1.5)),
              ),
            ),
            const SizedBox(height: 14),
            ElevatedButton(
              onPressed: () {
                final email = emailCtrl.text.trim().toLowerCase();
                if (email.isEmpty || !email.contains('@')) return;
                // Prevent duplicates
                if (_members.any((m) => m.email == email)) {
                  Navigator.pop(ctx);
                  return;
                }
                setState(() => _members = [..._members, (email: email, type: memberType)]);
                widget.onMembersChanged(_members);
                Navigator.pop(ctx);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: memberColor, foregroundColor: Colors.white, elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: Text('$memberLabel hinzufügen', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            ),
          ]),
        );
      },
    );
  }

  // ── Contacts picker from user_accessors / crm_contacts ───────────────────
  void _showContactsPicker() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _ContactsPickerSheet(
        alreadyAdded: _members.map((m) => m.email).toSet(),
        onAdd: (email, type) {
          if (!_members.any((m) => m.email == email)) {
            setState(() => _members = [..._members, (email: email, type: type)]);
            widget.onMembersChanged(_members);
          }
        },
      ),
    );
  }

  String _memberTypeLabel(String type) {
    switch (type) {
      case 'employee': return 'Mitarbeiter';
      case 'owner': return 'Bauherr';
      case 'subcontractor': return 'Gewerk';
      default: return type;
    }
  }

  Color _memberTypeColor(String type) {
    switch (type) {
      case 'employee': return const Color(0xFF3B82F6);
      case 'owner': return const Color(0xFF10B981);
      case 'subcontractor': return const Color(0xFFF59E0B);
      default: return AppColors.textSecondary;
    }
  }

  InputDecoration _dec(String label, IconData icon, {String? hint}) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      labelStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
      prefixIcon: Icon(icon, size: 20, color: AppColors.textTertiary),
      filled: true,
      fillColor: AppColors.surfaceVariant,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.border)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.border)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
    );
  }

  Widget _sectionLabel(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Text(text, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textSecondary, letterSpacing: 0.4)),
  );

  // ── Status colors matching AppColors.statusColor ──────────────────────────
  Color _statusColor(String s) => AppColors.statusColor(s);

  static const _statusOptions = [
    'Angefragt', 'In Planung', 'Genehmigt', 'In Ausführung',
    'Abgeschlossen', 'Pausiert', 'Abgebrochen', 'Nachbesserung',
  ];

  void _showStatusPicker(BuildContext ctx) {
    showModalBottomSheet(
      context: ctx,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) {
        final safeBottom = MediaQuery.of(ctx).padding.bottom;
        return Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Center(child: Container(width: 40, height: 4,
                decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                child: Row(
                  children: [
                    const Icon(LucideIcons.tag, size: 18, color: AppColors.textSecondary),
                    const SizedBox(width: 10),
                    const Expanded(child: Text('Projektstatus wählen',
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text))),
                    GestureDetector(
                      onTap: () => Navigator.pop(ctx),
                      child: const Icon(LucideIcons.x, size: 20, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              ..._statusOptions.map((s) {
                final color = AppColors.statusColor(s);
                final selected = _status == s;
                return InkWell(
                  onTap: () {
                    setState(() => _status = s);
                    widget.onStatusChanged(s);
                    Navigator.pop(ctx);
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
                    child: Row(
                      children: [
                        Container(
                          width: 10, height: 10,
                          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                        ),
                        const SizedBox(width: 14),
                        Expanded(child: Text(s,
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
                              color: selected ? color : AppColors.text,
                            ))),
                        if (selected)
                          Icon(LucideIcons.check, size: 18, color: color),
                      ],
                    ),
                  ),
                );
              }),
              SizedBox(height: safeBottom + 16),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final safeBottom = MediaQuery.of(context).padding.bottom;
    final country = _countries.firstWhere((c) => c.$1 == _country, orElse: () => _countries.first);

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(24, 16, 24, 24 + bottomInset + safeBottom),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Handle
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            // Title row with X button
            Row(
              children: [
                Expanded(child: Text(
                  widget.isEditMode ? 'Projekt bearbeiten' : 'Neues Projekt erstellen',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.text),
                )),
                GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  child: Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      color: AppColors.background,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: const Icon(LucideIcons.x, size: 18, color: AppColors.textSecondary),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 22),

            // ── Projektinformationen ────────────────────────────────────────
            _sectionLabel('PROJEKTINFORMATIONEN'),
            TextField(controller: widget.nameCtrl, textCapitalization: TextCapitalization.sentences, decoration: _dec('Projektname *', LucideIcons.building2)),
            const SizedBox(height: 12),
            TextField(controller: widget.subtitleCtrl, textCapitalization: TextCapitalization.sentences, decoration: _dec('Untertitel (optional)', LucideIcons.fileText, hint: 'z. B. Neubau EFH Mustermann')),
            const SizedBox(height: 12),
            // ── Custom status picker ────────────────────────────────────────
            GestureDetector(
              onTap: () => _showStatusPicker(context),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(children: [
                  Icon(LucideIcons.tag, size: 20, color: AppColors.textTertiary),
                  const SizedBox(width: 12),
                  Container(
                    width: 8, height: 8,
                    decoration: BoxDecoration(
                      color: _statusColor(_status),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(child: Text(_status,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                        color: _statusColor(_status),
                      ))),
                  const Icon(LucideIcons.chevronDown, size: 16, color: AppColors.textTertiary),
                ]),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: widget.descCtrl, maxLines: 3, textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                labelText: 'Beschreibung (optional)',
                labelStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
                prefixIcon: const Padding(padding: EdgeInsets.only(bottom: 40), child: Icon(LucideIcons.alignLeft, size: 20, color: AppColors.textTertiary)),
                filled: true, fillColor: AppColors.surfaceVariant,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.border)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.border)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
              ),
            ),

            const SizedBox(height: 22),
            // ── Adresse ────────────────────────────────────────────────────
            _sectionLabel('ADRESSE'),
            TextField(controller: widget.streetCtrl, textCapitalization: TextCapitalization.sentences, decoration: _dec('Straße & Hausnummer', LucideIcons.mapPin)),
            const SizedBox(height: 12),
            Row(children: [
              SizedBox(width: 110, child: TextField(controller: widget.zipCtrl, keyboardType: TextInputType.number, decoration: _dec('PLZ', LucideIcons.hash))),
              const SizedBox(width: 10),
              Expanded(child: TextField(controller: widget.cityCtrl, textCapitalization: TextCapitalization.words, decoration: _dec('Stadt', LucideIcons.building))),
            ]),
            const SizedBox(height: 12),
            GestureDetector(
              onTap: () async {
                final picked = await showModalBottomSheet<String>(
                  context: context,
                  backgroundColor: AppColors.surface,
                  shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
                  builder: (_) => Column(mainAxisSize: MainAxisSize.min, children: [
                    const SizedBox(height: 12),
                    Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
                    const SizedBox(height: 16),
                    const Padding(padding: EdgeInsets.symmetric(horizontal: 20), child: Text('Land auswählen', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
                    const SizedBox(height: 8),
                    ...(_countries.map((c) => ListTile(
                      leading: Text(c.$2, style: const TextStyle(fontSize: 22)),
                      title: Text(c.$3),
                      trailing: _country == c.$1 ? const Icon(LucideIcons.check, color: AppColors.primary, size: 18) : null,
                      onTap: () => Navigator.pop(context, c.$1),
                    ))),
                    SizedBox(height: MediaQuery.of(context).padding.bottom + 12),
                  ]),
                );
                if (picked != null) { setState(() => _country = picked); widget.onCountryChanged(picked); }
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
                child: Row(children: [
                  const Icon(LucideIcons.globe, size: 20, color: AppColors.textTertiary),
                  const SizedBox(width: 12),
                  Text('${country.$2}  ${country.$3}', style: const TextStyle(fontSize: 15, color: AppColors.text)),
                  const Spacer(),
                  const Icon(LucideIcons.chevronDown, size: 16, color: AppColors.textTertiary),
                ]),
              ),
            ),

            const SizedBox(height: 22),
            // ── Projektbilder ─────────────────────────────────────────────
            _sectionLabel('PROJEKTBILDER'),
            GestureDetector(
              onTap: _pickImages,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.3), style: BorderStyle.solid),
                ),
                child: Column(children: [
                  const Icon(LucideIcons.imagePlus, size: 28, color: AppColors.primary),
                  const SizedBox(height: 6),
                  Text(_images.isEmpty ? 'Bilder hinzufügen' : '${_images.length} Bild${_images.length == 1 ? '' : 'er'} ausgewählt',
                      style: const TextStyle(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w600)),
                ]),
              ),
            ),
            if (_images.isNotEmpty) ...[
              const SizedBox(height: 10),
              SizedBox(height: 72, child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _images.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final img = _images[i];
                  return Stack(children: [
                    ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.memory(img.bytes, width: 72, height: 72, fit: BoxFit.cover)),
                    Positioned(top: 2, right: 2, child: GestureDetector(
                      onTap: () { setState(() { _images = List.from(_images)..removeAt(i); }); widget.onImagesChanged(_images); },
                      child: Container(decoration: BoxDecoration(color: Colors.black54, shape: BoxShape.circle), padding: const EdgeInsets.all(3), child: const Icon(LucideIcons.x, size: 12, color: Colors.white)),
                    )),
                  ]);
                },
              )),
            ],

            const SizedBox(height: 22),
            // ── Team Hinzufügen ───────────────────────────────────────────
            _sectionLabel('BETEILIGTE HINZUFÜGEN (optional)'),

            // Contacts picker button
            GestureDetector(
              onTap: _showContactsPicker,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF6366F1).withValues(alpha: 0.07),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF6366F1).withValues(alpha: 0.25)),
                ),
                child: const Row(children: [
                  Icon(LucideIcons.users, size: 16, color: Color(0xFF6366F1)),
                  SizedBox(width: 10),
                  Expanded(child: Text('Aus Zugreifer-Kontakten wählen',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF6366F1)))),
                  Icon(LucideIcons.chevronRight, size: 14, color: Color(0xFF6366F1)),
                ]),
              ),
            ),

            // 3 group buttons
            Row(children: _memberTypes.map((t) {
              final key = t.$1; final label = t.$2; final icon = t.$3; final color = t.$4;
              final count = _members.where((m) => m.type == key).length;
              return Expanded(child: Padding(
                padding: EdgeInsets.only(right: _memberTypes.last.$1 == key ? 0 : 8),
                child: GestureDetector(
                  onTap: () => _showAddMemberSheet(key, label, color),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: count > 0 ? color.withValues(alpha: 0.1) : AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: count > 0 ? color.withValues(alpha: 0.4) : AppColors.border),
                    ),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Stack(alignment: Alignment.topRight, children: [
                        Icon(icon, size: 22, color: count > 0 ? color : AppColors.textTertiary),
                        if (count > 0) Positioned(top: -4, right: -4,
                          child: Container(width: 16, height: 16,
                            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                            child: Center(child: Text('$count', style: const TextStyle(fontSize: 9, color: Colors.white, fontWeight: FontWeight.w700))),
                          )),
                      ]),
                      const SizedBox(height: 6),
                      Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: count > 0 ? color : AppColors.textSecondary), textAlign: TextAlign.center),
                    ]),
                  ),
                ),
              ));
            }).toList()),

            // Added members list
            if (_members.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
                child: Column(children: _members.asMap().entries.map((entry) {
                  final i = entry.key; final m = entry.value;
                  final color = _memberTypeColor(m.type);
                  return Container(
                    decoration: BoxDecoration(
                      border: i < _members.length - 1 ? Border(bottom: BorderSide(color: AppColors.border)) : null,
                    ),
                    child: ListTile(
                      dense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                      leading: Container(width: 32, height: 32, decoration: BoxDecoration(color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
                        child: Center(child: Text(m.email[0].toUpperCase(), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)))),
                      title: Text(m.email, style: const TextStyle(fontSize: 13, color: AppColors.text)),
                      subtitle: Text(_memberTypeLabel(m.type), style: TextStyle(fontSize: 11, color: color)),
                      trailing: IconButton(
                        icon: const Icon(LucideIcons.x, size: 16, color: AppColors.textTertiary),
                        onPressed: () {
                          setState(() => _members = List.from(_members)..removeAt(i));
                          widget.onMembersChanged(_members);
                        },
                      ),
                    ),
                  );
                }).toList()),
              ),
            ],

            const SizedBox(height: 6),
            Text(
              _members.isEmpty
                  ? 'Mitarbeiter, Bauherren und Gewerke werden direkt zur Beteiligte-Seite hinzugefügt.'
                  : '${_members.length} Person${_members.length == 1 ? '' : 'en'} wird nach Erstellung eingeladen.',
              style: const TextStyle(fontSize: 11, color: AppColors.textTertiary),
            ),

            const SizedBox(height: 24),
            SizedBox(
              height: 50,
              child: ElevatedButton(
                onPressed: widget.onSubmit,
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                child: Text(widget.isEditMode ? 'Änderungen speichern' : 'Projekt erstellen',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── _ContactsPickerSheet (Zugreifer) ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _ContactsPickerSheet extends StatefulWidget {
  final Set<String> alreadyAdded;
  final void Function(String email, String type) onAdd;
  const _ContactsPickerSheet({required this.alreadyAdded, required this.onAdd});
  @override State<_ContactsPickerSheet> createState() => _ContactsPickerSheetState();
}

class _ContactsPickerSheetState extends State<_ContactsPickerSheet> {
  List<Map<String, dynamic>> _contacts = [];
  bool _loading = true;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      // Load from user_accessors first, fall back to crm_contacts
      final accessors = await SupabaseService.getUserAccessors();
      final crm       = await SupabaseService.getCrmContacts();

      // Normalise accessors into same shape
      final normAccessors = accessors.map((a) => {
        'email':      a['accessor_email'] ?? '',
        'first_name': a['accessor_first_name'] ?? '',
        'last_name':  a['accessor_last_name'] ?? '',
        'type':       a['accessor_type'] ?? 'employee',
        'source':     'accessor',
      }).toList();

      final normCrm = crm.map((c) => {
        'email':      c['email'] ?? '',
        'first_name': c['first_name'] ?? '',
        'last_name':  c['last_name'] ?? '',
        'type':       c['type'] ?? 'employee',
        'source':     'crm',
      }).toList();

      // Merge, dedup by email
      final seen = <String>{};
      final merged = <Map<String, dynamic>>[];
      for (final c in [...normAccessors, ...normCrm]) {
        final email = (c['email'] as String).trim().toLowerCase();
        if (email.isNotEmpty && !seen.contains(email)) {
          seen.add(email);
          merged.add({...c, 'email': email});
        }
      }
      merged.sort((a, b) =>
          '${a['first_name']} ${a['last_name']}'.compareTo('${b['first_name']} ${b['last_name']}'));

      if (mounted) setState(() { _contacts = merged; _loading = false; });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_search.isEmpty) return _contacts;
    final q = _search.toLowerCase();
    return _contacts.where((c) {
      final name = '${c['first_name']} ${c['last_name']}'.toLowerCase();
      final email = (c['email'] as String).toLowerCase();
      return name.contains(q) || email.contains(q);
    }).toList();
  }

  Color _typeColor(String t) {
    switch (t) {
      case 'owner': return const Color(0xFF10B981);
      case 'subcontractor': return const Color(0xFFF59E0B);
      default: return const Color(0xFF3B82F6);
    }
  }

  String _typeLabel(String t) {
    switch (t) {
      case 'owner': return 'Bauherr';
      case 'subcontractor': return 'Gewerk';
      default: return 'Mitarbeiter';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(20, 16, 20, 0), child: Column(children: [
          Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 16),
          Row(children: [
            const Icon(LucideIcons.users, size: 20, color: Color(0xFF6366F1)),
            const SizedBox(width: 10),
            const Expanded(child: Text('Zugreifer-Kontakte', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text))),
            GestureDetector(
              onTap: () => Navigator.of(context).pop(),
              child: const Icon(LucideIcons.x, size: 20, color: AppColors.textSecondary)),
          ]),
          const SizedBox(height: 12),
          TextField(
            onChanged: (v) => setState(() => _search = v),
            decoration: InputDecoration(
              hintText: 'Kontakt suchen…', isDense: true,
              prefixIcon: const Icon(LucideIcons.search, size: 16),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF6366F1))),
              filled: true, fillColor: AppColors.background,
            ),
          ),
          const SizedBox(height: 4),
        ])),
        Flexible(child: _loading
          ? const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()))
          : _filtered.isEmpty
            ? const Padding(padding: EdgeInsets.all(32),
                child: Center(child: Text('Keine Kontakte gefunden', style: TextStyle(color: AppColors.textSecondary))))
            : ListView.separated(
                shrinkWrap: true,
                padding: EdgeInsets.fromLTRB(20, 8, 20, MediaQuery.of(context).padding.bottom + 32),
                itemCount: _filtered.length,
                separatorBuilder: (_, __) => const SizedBox(height: 6),
                itemBuilder: (_, i) {
                  final c = _filtered[i];
                  final email = c['email'] as String;
                  final alreadyAdded = widget.alreadyAdded.contains(email);
                  final color = _typeColor(c['type'] as String? ?? 'employee');
                  final name = '${c['first_name']} ${c['last_name']}'.trim();
                  return GestureDetector(
                    onTap: alreadyAdded ? null : () {
                      widget.onAdd(email, c['type'] as String? ?? 'employee');
                      Navigator.of(context).pop();
                    },
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: alreadyAdded ? AppColors.background : AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: alreadyAdded ? AppColors.border : color.withValues(alpha: 0.25)),
                      ),
                      child: Row(children: [
                        Container(width: 40, height: 40,
                          decoration: BoxDecoration(color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
                          child: Center(child: Text(
                            name.isNotEmpty ? name[0].toUpperCase() : email[0].toUpperCase(),
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: color)))),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(name.isNotEmpty ? name : email,
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600,
                                  color: alreadyAdded ? AppColors.textTertiary : AppColors.text)),
                          if (name.isNotEmpty)
                            Text(email, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          const SizedBox(height: 2),
                          Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(4)),
                            child: Text(_typeLabel(c['type'] as String? ?? 'employee'),
                                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color))),
                        ])),
                        if (alreadyAdded)
                          const Icon(LucideIcons.check, size: 18, color: AppColors.success)
                        else
                          Icon(LucideIcons.plus, size: 18, color: color),
                      ]),
                    ),
                  );
                },
              )),
      ]),
    );
  }
}
