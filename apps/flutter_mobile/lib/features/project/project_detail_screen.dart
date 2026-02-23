import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/providers/permissions_provider.dart';
import '../../core/services/supabase_service.dart';
import '../../core/theme/app_colors.dart';
import 'sub_pages/project_dashboard_page.dart';
import 'sub_pages/project_general_info_page.dart';
import 'sub_pages/project_tasks_page.dart';
import 'sub_pages/project_defects_page.dart';
import 'sub_pages/project_schedule_page.dart';
import 'sub_pages/project_files_page.dart';
import 'sub_pages/project_diary_page.dart';
import 'sub_pages/project_communication_page.dart';
import 'sub_pages/project_participants_page.dart';
import 'sub_pages/project_documentation_page.dart';
import 'sub_pages/project_activity_page.dart';
import 'sub_pages/project_objektplan_page.dart';

// Maps drawer route keys → permission module keys
const _routeToModule = {
  'general-info':   'general_info',
  'tasks':          'tasks',
  'defects':        'defects',
  'schedule':       'schedule',
  'files':          'files',
  'diary':          'diary',
  'communication':  'communication',
  'documentation':  'documentation',
  'objektplan':     'documentation',
  'participants':   'participants',
  'activity':       'activity',
  // 'dashboard' — always visible, no module guard
};

/// Project host screen.
/// Embeds the active sub-page directly and provides a dark left-side drawer
/// (opened via a hamburger button) for switching between sections.
/// Uses [permissionsProvider] to hide restricted menu items and show
/// a "Kein Zugriff" screen when a user navigates to a locked section.
class ProjectDetailScreen extends ConsumerStatefulWidget {
  final String projectId;
  const ProjectDetailScreen({super.key, required this.projectId});

  @override
  ConsumerState<ProjectDetailScreen> createState() => _ProjectDetailScreenState();
}

class _ProjectDetailScreenState extends ConsumerState<ProjectDetailScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  Map<String, dynamic>? _project;
  bool _loading = true;
  String _activeRoute = 'dashboard';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final p = await SupabaseService.getProject(widget.projectId);
    if (mounted) setState(() { _project = p; _loading = false; });
  }

  Widget _buildSubPage(ProjectPermissions perms) {
    // Check if route requires a module permission
    final moduleKey = _routeToModule[_activeRoute];
    if (moduleKey != null && !perms.canView(moduleKey)) {
      return _NoAccessPage(route: _activeRoute);
    }

    switch (_activeRoute) {
      case 'dashboard':        return ProjectDashboardPage(projectId: widget.projectId);
      case 'general-info':     return ProjectGeneralInfoPage(projectId: widget.projectId);
      case 'tasks':            return ProjectTasksPage(projectId: widget.projectId);
      case 'defects':          return ProjectDefectsPage(projectId: widget.projectId);
      case 'schedule':         return ProjectSchedulePage(projectId: widget.projectId);
      case 'files':            return ProjectFilesPage(projectId: widget.projectId);
      case 'diary':            return ProjectDiaryPage(projectId: widget.projectId);
      case 'communication':    return ProjectCommunicationPage(projectId: widget.projectId);
      case 'participants':     return ProjectParticipantsPage(projectId: widget.projectId);
      case 'documentation':    return ProjectDocumentationPage(projectId: widget.projectId);
      case 'objektplan':       return ProjectObjektplanPage(projectId: widget.projectId);
      case 'activity':         return ProjectActivityPage(projectId: widget.projectId);
      default:                 return ProjectDashboardPage(projectId: widget.projectId);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final name   = _project?['name'] ?? 'Projekt';
    final status = _project?['status'] ?? 'active';
    final color  = _parseColor(_project?['color']);

    // Watch permissions — show loading spinner while resolving
    final permsAsync = ref.watch(permissionsProvider(widget.projectId));
    final perms = permsAsync.valueOrNull ?? ProjectPermissions.none;

    return Scaffold(
      key: _scaffoldKey,
      drawer: _ProjectDrawer(
        projectName: name,
        status: status,
        color: color,
        activeRoute: _activeRoute,
        perms: perms,
        onSelectRoute: (route) {
          setState(() => _activeRoute = route);
          Navigator.of(context).pop();
        },
        onCloseProject: () {
          Navigator.of(context).pop();
          context.go('/');
        },
      ),
      body: BurgerMenuScope(
        openDrawer: () => _scaffoldKey.currentState?.openDrawer(),
        navigateTo: (route) => setState(() => _activeRoute = route),
        child: permsAsync.isLoading
            ? const Center(child: CircularProgressIndicator())
            : _buildSubPage(perms),
      ),
    );
  }

  Color _parseColor(String? hex) {
    if (hex == null || hex.isEmpty) return AppColors.primary;
    try { return Color(int.parse(hex.replaceFirst('#', '0xFF'))); }
    catch (_) { return AppColors.primary; }
  }
}

/// Shown when a user navigates to a section they have no view permission for.
class _NoAccessPage extends StatelessWidget {
  final String route;
  const _NoAccessPage({required this.route});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(LucideIcons.lock, size: 56, color: Colors.grey.shade400),
              const SizedBox(height: 20),
              const Text(
                'Kein Zugriff',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 10),
              Text(
                'Sie haben keine Berechtigung, diesen Bereich zu sehen.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 15, color: Colors.grey.shade600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// InheritedWidget so any sub-page can read the burger-menu callback
/// and navigate between sub-pages.
class BurgerMenuScope extends InheritedWidget {
  final VoidCallback? openDrawer;
  final ValueChanged<String>? navigateTo;
  const BurgerMenuScope({super.key, required this.openDrawer, this.navigateTo, required super.child});
  static BurgerMenuScope? of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<BurgerMenuScope>();
  @override
  bool updateShouldNotify(BurgerMenuScope old) => openDrawer != old.openDrawer || navigateTo != old.navigateTo;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dark left-side drawer
// ═══════════════════════════════════════════════════════════════════════════════

class _ProjectDrawer extends StatelessWidget {
  final String projectName;
  final String status;
  final Color color;
  final String activeRoute;
  final ProjectPermissions perms;
  final ValueChanged<String> onSelectRoute;
  final VoidCallback onCloseProject;

  const _ProjectDrawer({
    required this.projectName,
    required this.status,
    required this.color,
    required this.activeRoute,
    required this.perms,
    required this.onSelectRoute,
    required this.onCloseProject,
  });

  @override
  Widget build(BuildContext context) {
    const bg      = Color(0xFF1E293B);
    const headerBg = Color(0xFF0F172A);
    const txt     = Color(0xFFE2E8F0);
    const muted   = Color(0xFF94A3B8);
    const accent  = Color(0xFF38BDF8);

    return Drawer(
      backgroundColor: bg,
      shape: const RoundedRectangleBorder(),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Close ─────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: InkWell(
                borderRadius: BorderRadius.circular(8),
                onTap: () => Navigator.of(context).pop(),
                child: const Row(
                  children: [
                    Icon(LucideIcons.x, size: 18, color: muted),
                    SizedBox(width: 8),
                    Text('Menü schließen',
                        style: TextStyle(fontSize: 14, color: muted, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // ── Project Card ──────────────────────────────────────────
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: headerBg, borderRadius: BorderRadius.circular(12)),
              child: Row(
                children: [
                  Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(10)),
                    child: Center(
                      child: Text(
                        projectName.isNotEmpty ? projectName[0].toUpperCase() : 'P',
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(projectName,
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white),
                            maxLines: 1, overflow: TextOverflow.ellipsis),
                        const SizedBox(height: 2),
                        Text(_statusLabel(status),
                            style: const TextStyle(fontSize: 12, color: accent)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // ── Menu Items ────────────────────────────────────────────
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: [
                  // Always visible
                  _DItem(LucideIcons.layoutDashboard, 'Übersicht',       'dashboard',      activeRoute, accent, txt, muted, onSelectRoute),
                  if (perms.canView('general_info'))
                    _DItem(LucideIcons.info,            'Allgemeine Info', 'general-info',   activeRoute, accent, txt, muted, onSelectRoute),
                  if (perms.canView('tasks') || perms.canView('defects')) ...[
                    const SizedBox(height: 8),
                    _DSec('AUFGABEN & MÄNGEL', muted),
                  ],
                  if (perms.canView('tasks'))
                    _DItem(LucideIcons.checkSquare,     'Aufgaben',        'tasks',          activeRoute, accent, txt, muted, onSelectRoute),
                  if (perms.canView('defects'))
                    _DItem(LucideIcons.alertTriangle,   'Mängel',          'defects',        activeRoute, accent, txt, muted, onSelectRoute),
                  if (perms.canView('schedule')) ...[
                    const SizedBox(height: 8),
                    _DSec('PLANUNG', muted),
                    _DItem(LucideIcons.calendar,        'Zeitplan',        'schedule',       activeRoute, accent, txt, muted, onSelectRoute),
                  ],
                  if (perms.canView('files') || perms.canView('documentation')) ...[
                    const SizedBox(height: 8),
                    _DSec('DOKUMENTE', muted),
                  ],
                  if (perms.canView('files'))
                    _DItem(LucideIcons.folderOpen,      'Dateien',         'files',          activeRoute, accent, txt, muted, onSelectRoute),
                  if (perms.canView('documentation')) ...[
                    _DItem(LucideIcons.fileText,        'Dokumentation',   'documentation',  activeRoute, accent, txt, muted, onSelectRoute),
                    _DItem(LucideIcons.building2,       'Objektplan',      'objektplan',     activeRoute, accent, txt, muted, onSelectRoute),
                  ],
                  if (perms.canView('diary') || perms.canView('communication')) ...[
                    const SizedBox(height: 8),
                    _DSec('KOMMUNIKATION', muted),
                  ],
                  if (perms.canView('diary'))
                    _DItem(LucideIcons.bookOpen,        'Bautagebuch',     'diary',          activeRoute, accent, txt, muted, onSelectRoute),
                  if (perms.canView('communication'))
                    _DItem(LucideIcons.messageCircle,   'Kommunikation',   'communication',  activeRoute, accent, txt, muted, onSelectRoute),
                  // Participants and Activity are also module-gated
                  if (perms.canView('participants')) ...[
                    const SizedBox(height: 8),
                    _DSec('TEAM', muted),
                    _DItem(LucideIcons.users,           'Beteiligte',      'participants',   activeRoute, accent, txt, muted, onSelectRoute),
                  ],
                  if (perms.canView('activity')) ...[
                    const SizedBox(height: 8),
                    _DSec('WEITERE', muted),
                    _DItem(LucideIcons.activity,        'Aktivitäten',     'activity',       activeRoute, accent, txt, muted, onSelectRoute),
                  ],
                ],
              ),
            ),

            // ── Footer ────────────────────────────────────────────────
            const Divider(color: Color(0xFF334155), height: 1),
            InkWell(
              onTap: onCloseProject,
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Row(
                  children: [
                    Icon(LucideIcons.arrowLeft, size: 18, color: muted),
                    SizedBox(width: 10),
                    Text('Zurück zu Projekten',
                        style: TextStyle(fontSize: 14, color: muted, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _statusLabel(String s) {
    const known = {'Angefragt','In Planung','Genehmigt','In Ausführung','Abgeschlossen','Pausiert','Abgebrochen','Nachbesserung'};
    if (known.contains(s)) return s;
    switch (s.toLowerCase()) {
      case 'planning':  return 'In Planung';
      case 'active':    return 'In Ausführung';
      case 'completed': return 'Abgeschlossen';
      case 'archived':  return 'Archiviert';
      default: return s;
    }
  }
}

class _DSec extends StatelessWidget {
  final String t; final Color c;
  const _DSec(this.t, this.c);
  @override
  Widget build(BuildContext context) =>
      Padding(padding: const EdgeInsets.only(left: 8, top: 8, bottom: 4),
        child: Text(t, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: c, letterSpacing: 0.8)));
}

class _DItem extends StatelessWidget {
  final IconData icon; final String label; final String route; final String activeRoute;
  final Color accent; final Color txt; final Color muted; final ValueChanged<String> onTap;
  const _DItem(this.icon, this.label, this.route, this.activeRoute, this.accent, this.txt, this.muted, this.onTap);
  @override
  Widget build(BuildContext context) {
    final active = route == activeRoute;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () => onTap(route),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
          decoration: BoxDecoration(
            color: active ? accent.withValues(alpha: 0.12) : null,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(children: [
            Icon(icon, size: 18, color: active ? accent : muted),
            const SizedBox(width: 12),
            Expanded(child: Text(label, style: TextStyle(
              fontSize: 15, fontWeight: active ? FontWeight.w700 : FontWeight.w500,
              color: active ? accent : txt))),
          ]),
        ),
      ),
    );
  }
}
