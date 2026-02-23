import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/permissions_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/burger_menu_leading.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Data helpers
// ─────────────────────────────────────────────────────────────────────────────

SupabaseClient get _db => Supabase.instance.client;
String? get _uid => Supabase.instance.client.auth.currentUser?.id;

String _memberTypeLabel(String t) {
  const m = {'employee': 'Mitarbeiter', 'owner': 'Bauherr', 'subcontractor': 'Gewerk', 'other': 'Sonstiges'};
  return m[t] ?? t;
}

Color _memberTypeColor(String t) {
  const m = {'employee': Color(0xFF3B82F6), 'owner': Color(0xFF10B981), 'subcontractor': Color(0xFFF59E0B), 'other': Color(0xFF6B7280)};
  return m[t] ?? const Color(0xFF6B7280);
}

String _statusLabel(String s) {
  const m = {'open': 'Offen', 'invited': 'Eingeladen', 'active': 'Aktiv', 'inactive': 'Inaktiv'};
  return m[s] ?? s;
}

Color _statusColor(String s) {
  const m = {'open': Color(0xFF94A3B8), 'invited': Color(0xFFF59E0B), 'active': Color(0xFF10B981), 'inactive': Color(0xFFEF4444)};
  return m[s] ?? const Color(0xFF6B7280);
}

IconData _statusIcon(String s) {
  switch (s) {
    case 'open': return LucideIcons.userPlus;
    case 'invited': return LucideIcons.mail;
    case 'active': return LucideIcons.userCheck;
    case 'inactive': return LucideIcons.userX;
    default: return LucideIcons.user;
  }
}

String _permissionsSummary(Map<String, dynamic> member) {
  final role = member['role'];
  if (role != null && role['role_name'] != null) {
    return 'Rolle: ${role['role_name']}';
  }
  final perms = (member['custom_permissions'] as List?) ?? [];
  if (perms.isNotEmpty) {
    final v = perms.where((p) => p['can_view'] == true).length;
    final e = perms.where((p) => p['can_edit'] == true || p['can_delete'] == true).length;
    return '$v Module ($e bearbeitbar)';
  }
  return 'Keine Rolle zugewiesen';
}

bool _hasPerms(Map<String, dynamic> member) {
  final perms = (member['custom_permissions'] as List?) ?? [];
  return member['role_id'] != null || perms.isNotEmpty;
}

String _displayName(Map<String, dynamic>? accessor) {
  if (accessor == null) return 'Unbekannt';
  final f = accessor['accessor_first_name'] as String? ?? '';
  final l = accessor['accessor_last_name'] as String? ?? '';
  final full = '$f $l'.trim();
  return full.isNotEmpty ? full : (accessor['accessor_email'] as String? ?? 'Unbekannt');
}

String _initials(Map<String, dynamic>? accessor) {
  if (accessor == null) return '?';
  final f = accessor['accessor_first_name'] as String? ?? '';
  final l = accessor['accessor_last_name'] as String? ?? '';
  if (f.isNotEmpty && l.isNotEmpty) return '${f[0]}${l[0]}'.toUpperCase();
  if (f.isNotEmpty) return f[0].toUpperCase();
  final e = accessor['accessor_email'] as String? ?? '';
  return e.isNotEmpty ? e[0].toUpperCase() : '?';
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

class ProjectParticipantsPage extends ConsumerStatefulWidget {
  final String projectId;
  const ProjectParticipantsPage({super.key, required this.projectId});

  @override
  ConsumerState<ProjectParticipantsPage> createState() => _ProjectParticipantsPageState();
}

class _ProjectParticipantsPageState extends ConsumerState<ProjectParticipantsPage> {
  // ── State ──
  bool _loading = true;
  bool _isProjectOwner = false;
  bool _isTeamAdmin = false;
  bool _hasTeamAccess = false;
  String? _userTeamId;

  List<Map<String, dynamic>> _members = [];
  List<Map<String, dynamic>> _availableRoles = [];
  List<Map<String, dynamic>> _availableModules = [];
  List<Map<String, dynamic>> _contentDefaults = [];
  List<Map<String, dynamic>> _teams = [];
  List<Map<String, dynamic>> _teamMembers = [];

  String _activeTab = 'members'; // 'members' | 'freigaben'
  String _statusFilter = 'all';
  bool _savingFreigaben = false;

  // ── Edit Permissions Modal ──
  Map<String, dynamic>? _editingMember;
  String _selectedRoleId = '';
  bool _useCustomPermissions = false;
  Map<String, Map<String, dynamic>> _customPermissions = {};

  // ── Action menus ──
  String? _openMenuId;
  final Set<String> _invitingIds = {};

  // ── Add Team Members ──
  final Set<String> _selectedTeamMemberIds = {};

  // ─────────────────────────────────────────────────────────────────────────
  @override
  void initState() {
    super.initState();
    _load();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD DATA
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loading = true);
    try {
      final uid = _uid;
      if (uid == null) return;

      // 1. Profile (team_id + team_role)
      final profile = await _db.from('profiles').select('team_id, team_role').eq('id', uid).maybeSingle();
      _userTeamId = profile?['team_id'] as String?;
      _isTeamAdmin = profile?['team_role'] == 'team_admin';

      // 2. Check owner
      final project = await _db.from('projects').select('owner_id').eq('id', widget.projectId).maybeSingle();
      _isProjectOwner = project?['owner_id'] == uid;

      // 3. Check team access
      if (_isTeamAdmin && _userTeamId != null) {
        final ta = await _db.from('team_project_access').select('id').eq('project_id', widget.projectId).eq('team_id', _userTeamId!).maybeSingle();
        final ma = await _db.from('project_members').select('id').eq('project_id', widget.projectId).eq('user_id', uid).maybeSingle();
        if (ta != null || ma != null) {
          _hasTeamAccess = true;
          await _loadTeamMembers();
        }
      }

      // 4. Load in parallel
      await Future.wait([
        _loadMembers(),
        _loadRolesAndModules(),
      ]);

      // 5. Freigaben (owner / superuser only — checked server-side, we just try)
      if (_isProjectOwner) {
        await Future.wait([_loadContentDefaults(), _loadProjectTeams()]);
      }
    } catch (e) {
      _snack('Fehler beim Laden: $e', error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMembers() async {
    try {
      final rows = await _db.from('project_members').select('''
        *,
        accessor:user_accessors(*),
        role:roles(id, role_name, role_description)
      ''').eq('project_id', widget.projectId);

      final withPerms = await Future.wait((rows as List<dynamic>).map((m) async {
        final perms = await _db.from('project_member_permissions').select('module_key, can_view, can_create, can_edit, can_delete').eq('project_member_id', m['id'] as String);
        return <String, dynamic>{...Map<String, dynamic>.from(m as Map), 'custom_permissions': perms, 'status': m['status'] ?? 'open'};
      }));

      if (mounted) setState(() => _members = withPerms);
    } catch (e) {
      _snack('Fehler beim Laden der Mitglieder: $e', error: true);
    }
  }

  Future<void> _loadRolesAndModules() async {
    try {
      final rolesResult = await _db.from('project_available_roles').select('role_id, role:roles(id, role_name, role_description)').eq('project_id', widget.projectId);
      final modulesResult = await _db.from('permission_modules').select().eq('is_active', true).order('display_order');

      if (mounted) {
        setState(() {
          _availableRoles = (rolesResult as List).map((r) => Map<String, dynamic>.from(r['role'] as Map? ?? {})).where((r) => r.isNotEmpty).toList();
          _availableModules = (modulesResult as List).cast<Map<String, dynamic>>();
        });
      }
    } catch (e) {
      debugPrint('[loadRolesAndModules] $e');
    }
  }

  Future<void> _loadContentDefaults() async {
    try {
      final result = await _db.rpc('get_project_content_defaults', params: {'p_project_id': widget.projectId});
      if (mounted) setState(() => _contentDefaults = (result as List).cast<Map<String, dynamic>>());
    } catch (e) {
      debugPrint('[loadContentDefaults] $e');
    }
  }

  Future<void> _loadProjectTeams() async {
    try {
      final rows = await _db.from('team_project_access').select('team_id, team:teams(id, name)').eq('project_id', widget.projectId);
      if (mounted) {
        setState(() => _teams = (rows as List).map((r) => Map<String, dynamic>.from(r['team'] as Map? ?? {})).where((t) => t.isNotEmpty).toList());
      }
    } catch (e) {
      debugPrint('[loadProjectTeams] $e');
    }
  }

  Future<void> _loadTeamMembers() async {
    try {
      if (_userTeamId == null) return;
      final rows = await _db.from('profiles').select('id, email, first_name, last_name, team_role').eq('team_id', _userTeamId!);
      if (mounted) setState(() => _teamMembers = (rows as List).cast<Map<String, dynamic>>());
    } catch (e) {
      debugPrint('[loadTeamMembers] $e');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PERMISSIONS MODAL
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> _savePermissions() async {
    if (_editingMember == null) return;
    if (!_useCustomPermissions && _selectedRoleId.isEmpty) {
      _snack('Bitte wählen Sie eine Rolle aus', error: true);
      return;
    }
    try {
      final newRoleId = _useCustomPermissions ? null : (_selectedRoleId.isNotEmpty ? _selectedRoleId : null);
      final updateRes = await _db.from('project_members').update({'role_id': newRoleId}).eq('id', _editingMember!['id'] as String).select();
      if ((updateRes as List).isEmpty) throw Exception('Keine Berechtigung zum Aktualisieren');

      await _db.from('project_member_permissions').delete().eq('project_member_id', _editingMember!['id'] as String);

      if (_useCustomPermissions) {
        final toInsert = _customPermissions.values.where((p) => p['can_view'] == true || p['can_create'] == true || p['can_edit'] == true || p['can_delete'] == true).map((p) => {
          'project_member_id': _editingMember!['id'],
          'module_key': p['module_key'],
          'can_view': p['can_view'],
          'can_create': p['can_create'],
          'can_edit': p['can_edit'],
          'can_delete': p['can_delete'],
        }).toList();
        if (toInsert.isNotEmpty) await _db.from('project_member_permissions').insert(toInsert);
      }

      _snack('Berechtigungen aktualisiert');
      if (mounted) Navigator.of(context).pop();
      await _loadMembers();
    } catch (e) {
      _snack('Fehler: $e', error: true);
    }
  }

  void _togglePermission(String moduleKey, String type) {
    setState(() {
      final p = Map<String, dynamic>.from(_customPermissions[moduleKey] ?? {});
      p[type] = !(p[type] as bool? ?? false);
      if ((p['can_create'] == true || p['can_edit'] == true || p['can_delete'] == true) && p['can_view'] != true) {
        p['can_view'] = true;
      }
      _customPermissions[moduleKey] = p;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INVITE / STATUS
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> _inviteMember(Map<String, dynamic> member) async {
    final accessor = member['accessor'] as Map?;
    final email = accessor?['accessor_email'] as String?;
    if (email == null || email.isEmpty) { _snack('Keine E-Mail-Adresse', error: true); return; }
    if (!_hasPerms(member)) { _snack('Bitte zuerst eine Rolle zuweisen', error: true); return; }

    final id = member['id'] as String;
    setState(() => _invitingIds.add(id));
    try {
      final registeredUserId = (member['user_id'] as String?) ?? (accessor?['registered_user_id'] as String?);
      final res = await _db.rpc('send_project_invitation', params: {
        'p_project_id': widget.projectId,
        'p_user_id': registeredUserId,
        'p_email': email,
      });
      if (res?['success'] != true) throw Exception(res?['error'] ?? 'Fehler beim Einladen');
      _snack(res['notification_created'] == true ? 'Einladung & Benachrichtigung gesendet' : 'Einladung vorbereitet');
      await _loadMembers();
    } catch (e) {
      _snack('Fehler: $e', error: true);
    } finally {
      if (mounted) setState(() => _invitingIds.remove(id));
    }
  }

  Future<void> _inviteAllOpen() async {
    final openWithRole = _members.where((m) => m['status'] == 'open' && _hasPerms(m)).toList();
    if (openWithRole.isEmpty) { _snack('Keine Mitglieder mit Rolle zum Einladen', error: true); return; }
    for (final m in openWithRole) await _inviteMember(m);
  }

  Future<void> _reInviteMember(Map<String, dynamic> member) async {
    setState(() => _openMenuId = null);
    await _inviteMember(member);
  }

  Future<void> _setInactive(Map<String, dynamic> member) async {
    setState(() => _openMenuId = null);
    final name = _displayName(member['accessor'] as Map<String, dynamic>?);
    final ok = await _confirm('$name als inaktiv setzen?', 'Die Person kann das Projekt nicht mehr sehen.');
    if (!ok) return;
    try {
      await _db.from('project_members').update({'status': 'inactive'}).eq('id', member['id'] as String);
      _snack('Mitglied inaktiv gesetzt');
      await _loadMembers();
    } catch (e) { _snack('Fehler: $e', error: true); }
  }

  Future<void> _reactivate(Map<String, dynamic> member) async {
    setState(() => _openMenuId = null);
    try {
      await _db.from('project_members').update({'status': 'active'}).eq('id', member['id'] as String);
      _snack('Mitglied reaktiviert');
      await _loadMembers();
    } catch (e) { _snack('Fehler: $e', error: true); }
  }

  Future<void> _removeMember(String memberId) async {
    setState(() => _openMenuId = null);
    final ok = await _confirm('Mitglied entfernen?', 'Das Mitglied wird endgültig entfernt.');
    if (!ok) return;
    try {
      await _db.from('project_member_permissions').delete().eq('project_member_id', memberId);
      await _db.from('project_members').delete().eq('id', memberId);
      _snack('Mitglied entfernt');
      await _loadMembers();
    } catch (e) { _snack('Fehler: $e', error: true); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEAM MEMBERS
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> _addTeamMembers() async {
    if (_selectedTeamMemberIds.isEmpty) { _snack('Bitte Mitglieder auswählen', error: true); return; }
    final uid = _uid;
    if (uid == null || _userTeamId == null) return;
    try {
      for (final memberId in _selectedTeamMemberIds) {
        final tm = _teamMembers.firstWhere((m) => m['id'] == memberId, orElse: () => {});
        if (tm.isEmpty) continue;
        final exists = _members.any((m) => m['user_id'] == memberId);
        if (exists) continue;

        var accessorRes = await _db.from('user_accessors').select('id').eq('accessor_email', tm['email'] as String).maybeSingle();
        String accessorId;
        if (accessorRes == null) {
          final newAcc = await _db.from('user_accessors').insert({
            'owner_id': uid, 'accessor_email': tm['email'],
            'accessor_first_name': tm['first_name'], 'accessor_last_name': tm['last_name'],
            'accessor_type': 'employee', 'registered_user_id': tm['id'], 'is_active': true,
          }).select('id').single();
          accessorId = newAcc['id'] as String;
        } else {
          accessorId = accessorRes['id'] as String;
        }

        await _db.from('project_members').insert({
          'project_id': widget.projectId, 'user_id': tm['id'],
          'accessor_id': accessorId, 'member_type': 'employee',
          'member_team_id': _userTeamId, 'added_by': uid, 'status': 'active',
        });
      }
      _snack('${_selectedTeamMemberIds.length} Mitglied(er) hinzugefügt');
      if (mounted) Navigator.of(context).pop();
      setState(() { _selectedTeamMemberIds.clear(); });
      await _loadMembers();
    } catch (e) { _snack('Fehler: $e', error: true); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FREIGABEN
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> _saveFreigaben() async {
    final uid = _uid;
    if (uid == null) return;
    setState(() => _savingFreigaben = true);
    try {
      final now = DateTime.now().toIso8601String();
      final payload = _contentDefaults.map((cd) => {
        'project_id': widget.projectId,
        'module_key': cd['module_key'],
        'default_visibility': cd['default_visibility'],
        'updated_by': uid,
        'updated_at': now,
      }).toList();
      await _db.from('project_content_defaults').upsert(payload, onConflict: 'project_id,module_key');
      _snack('Freigabe-Einstellungen gespeichert');
      await _loadContentDefaults();
    } catch (e) { _snack('Fehler: $e', error: true); }
    finally { if (mounted) setState(() => _savingFreigaben = false); }
  }

  void _setVisibility(String moduleKey, String visibility) {
    setState(() {
      _contentDefaults = _contentDefaults.map((cd) => cd['module_key'] == moduleKey ? {...cd, 'default_visibility': visibility} : cd).toList();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(children: [
        Icon(error ? LucideIcons.alertCircle : LucideIcons.checkCircle, color: Colors.white, size: 18),
        const SizedBox(width: 10),
        Expanded(child: Text(msg)),
      ]),
      backgroundColor: error ? AppColors.danger : AppColors.primary,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      margin: const EdgeInsets.all(12),
    ));
  }

  Future<bool> _confirm(String title, String body) async {
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
            content: Text(body),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Abbrechen', style: TextStyle(color: AppColors.textSecondary))),
              ElevatedButton(
                onPressed: () => Navigator.pop(ctx, true),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger, foregroundColor: Colors.white, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                child: const Text('Bestätigen'),
              ),
            ],
          ),
        ) ??
        false;
  }

  Map<String, int> get _statusCounts => {
    'all': _members.length,
    'open': _members.where((m) => m['status'] == 'open').length,
    'invited': _members.where((m) => m['status'] == 'invited').length,
    'active': _members.where((m) => m['status'] == 'active').length,
    'inactive': _members.where((m) => m['status'] == 'inactive').length,
  };

  List<Map<String, dynamic>> get _filteredMembers =>
      _statusFilter == 'all' ? _members : _members.where((m) => m['status'] == _statusFilter).toList();

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: burgerMenuLeading(context),
        title: const Text('Beteiligte', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 18)),
        actions: [
          if (_activeTab == 'members') ...[
            if ((_isTeamAdmin && _hasTeamAccess) || ref.permissions(widget.projectId).canCreate('members'))
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: TextButton.icon(
                  onPressed: () => _showAddTeamModal(),
                  icon: const Icon(LucideIcons.users, size: 15, color: Colors.white),
                  label: const Text('Team', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                  style: TextButton.styleFrom(backgroundColor: AppColors.primary, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                ),
              ),
            if (_isProjectOwner && (_statusCounts['open'] ?? 0) > 0)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: TextButton.icon(
                  onPressed: _inviteAllOpen,
                  icon: const Icon(LucideIcons.send, size: 15, color: AppColors.primary),
                  label: Text('Alle einladen (${_statusCounts['open']})', style: const TextStyle(color: AppColors.primary, fontSize: 13, fontWeight: FontWeight.w600)),
                  style: TextButton.styleFrom(backgroundColor: const Color(0xFFEFF6FF), padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                ),
              ),
          ],
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: _load,
              child: GestureDetector(
                onTap: () => setState(() => _openMenuId = null),
                child: Column(
                  children: [
                    _buildTopTabs(),
                    Expanded(
                      child: _activeTab == 'members' ? _buildMembersTab() : _buildFreigabenTab(),
                    ),
                  ],
                ),
              ),
            ),
      // Modals
      bottomSheet: null,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOP TABS
  // ─────────────────────────────────────────────────────────────────────────

  Widget _buildTopTabs() {
    return Container(
      color: AppColors.surface,
      child: Column(
        children: [
          Row(
            children: [
              _topTab('members', 'Mitglieder', LucideIcons.users),
              if (_isProjectOwner) _topTab('freigaben', 'Freigaben', LucideIcons.share2),
            ],
          ),
          const Divider(height: 1, thickness: 1, color: Color(0xFFE2E8F0)),
        ],
      ),
    );
  }

  Widget _topTab(String tab, String label, IconData icon) {
    final active = _activeTab == tab;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _activeTab = tab),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: active ? AppColors.primary : Colors.transparent, width: 3)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: active ? AppColors.primary : AppColors.textSecondary),
              const SizedBox(width: 8),
              Text(label, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: active ? AppColors.primary : AppColors.textSecondary)),
            ],
          ),
        ),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MEMBERS TAB
  // ─────────────────────────────────────────────────────────────────────────

  Widget _buildMembersTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.screenH, 20, AppSpacing.screenH, 80),
      children: [
        // Page title
        const Text('Beteiligte', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Color(0xFF0F172A), letterSpacing: -0.5)),
        const SizedBox(height: 2),
        const Text('Projektmitglieder, Rollen und Einladungen', style: TextStyle(fontSize: 14, color: AppColors.textSecondary)),
        const SizedBox(height: 16),

        // Info hint for owner
        if (_isProjectOwner)
          Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFE2E8F0))),
            child: const Row(children: [
              Icon(LucideIcons.info, size: 15, color: AppColors.textSecondary),
              SizedBox(width: 8),
              Expanded(child: Text('💡 Mitglieder hinzufügen unter: Projekt → Einstellungen → Beteiligte', style: TextStyle(fontSize: 12, color: AppColors.textSecondary))),
            ]),
          ),

        // Status filter pills
        _buildStatusFilter(),
        const SizedBox(height: 16),

        // Member list
        if (_filteredMembers.isEmpty)
          _emptyCard(
            icon: LucideIcons.users,
            title: _statusFilter == 'all' ? 'Keine Mitglieder' : 'Keine "${_statusLabel(_statusFilter)}" Mitglieder',
            subtitle: _statusFilter == 'all' ? 'Fügen Sie Mitglieder unter Projekt → Einstellungen hinzu.' : 'Wechseln Sie den Filter um andere Mitglieder zu sehen.',
          )
        else
          ...List.generate(_filteredMembers.length, (i) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _buildMemberCard(_filteredMembers[i]),
          )),
      ],
    );
  }

  Widget _buildStatusFilter() {
    final counts = _statusCounts;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final entry in [
            ('all', 'Alle'),
            ('open', 'Offen'),
            ('invited', 'Eingeladen'),
            ('active', 'Aktiv'),
            ('inactive', 'Inaktiv'),
          ])
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: GestureDetector(
                onTap: () => setState(() => _statusFilter = entry.$1),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 14),
                  decoration: BoxDecoration(
                    color: _statusFilter == entry.$1 ? AppColors.primary : AppColors.surface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: _statusFilter == entry.$1 ? AppColors.primary : const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      Text(entry.$2, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _statusFilter == entry.$1 ? Colors.white : AppColors.textSecondary)),
                      if ((counts[entry.$1] ?? 0) > 0) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: _statusFilter == entry.$1 ? Colors.white.withOpacity(0.3) : const Color(0xFFE2E8F0),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text('${counts[entry.$1]}', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _statusFilter == entry.$1 ? Colors.white : AppColors.textSecondary)),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildMemberCard(Map<String, dynamic> member) {
    final accessor = member['accessor'] as Map<String, dynamic>?;
    final status = member['status'] as String? ?? 'open';
    final sColor = _statusColor(status);
    final id = member['id'] as String;
    final isInviting = _invitingIds.contains(id);
    final showMenu = _openMenuId == id;
    final hasP = _hasPerms(member);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Stack(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Avatar
                    Container(
                      width: 48, height: 48,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        shape: BoxShape.circle,
                        border: Border.all(color: sColor, width: 2),
                      ),
                      child: Center(child: Text(_initials(accessor), style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.primary))),
                    ),
                    const SizedBox(width: 12),
                    // Info
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(child: Text(_displayName(accessor), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)))),
                              // Status badge
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: sColor.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: sColor.withOpacity(0.3)),
                                ),
                                child: Row(mainAxisSize: MainAxisSize.min, children: [
                                  Icon(_statusIcon(status), size: 12, color: sColor),
                                  const SizedBox(width: 4),
                                  Text(_statusLabel(status), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: sColor)),
                                ]),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Row(children: [
                            const Icon(LucideIcons.mail, size: 12, color: Color(0xFF94A3B8)),
                            const SizedBox(width: 5),
                            Expanded(child: Text(accessor?['accessor_email'] as String? ?? '', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)))),
                          ]),
                          if ((accessor?['accessor_company'] as String?) != null && (accessor!['accessor_company'] as String).isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 3),
                              child: Row(children: [
                                const Icon(LucideIcons.building, size: 12, color: Color(0xFF94A3B8)),
                                const SizedBox(width: 5),
                                Expanded(child: Text(accessor['accessor_company'] as String, style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)))),
                              ]),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Type badge + action buttons row
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(color: _memberTypeColor(member['member_type'] as String? ?? 'other'), borderRadius: BorderRadius.circular(6)),
                      child: Text(_memberTypeLabel(member['member_type'] as String? ?? 'other'), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
                    ),
                    const Spacer(),
                    // Invite / Re-invite buttons
                    if (status == 'open' && hasP)
                      _actionBtn(
                        label: isInviting ? null : 'Einladen',
                        icon: LucideIcons.send,
                        loading: isInviting,
                        primary: true,
                        onTap: isInviting ? null : () => _inviteMember(member),
                      ),
                    if (status == 'invited')
                      Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: _actionBtn(label: 'Erneut', icon: LucideIcons.refreshCw, loading: isInviting, primary: false, onTap: isInviting ? null : () => _reInviteMember(member)),
                      ),
                    // Three-dot menu
                    const SizedBox(width: 6),
                    _moreMenuBtn(member, id, showMenu),
                  ],
                ),
                const SizedBox(height: 10),

                // Permissions summary
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                  decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFF1F5F9))),
                  child: Row(
                    children: [
                      Icon(LucideIcons.shield, size: 14, color: hasP ? AppColors.textSecondary : AppColors.danger),
                      const SizedBox(width: 8),
                      Expanded(child: Text(_permissionsSummary(member), style: TextStyle(fontSize: 13, color: hasP ? AppColors.textSecondary : AppColors.danger, fontWeight: hasP ? FontWeight.normal : FontWeight.w600))),
                      if (member['invited_at'] != null)
                        Text('Eingeladen: ${_formatDate(member['invited_at'])}', style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                    ],
                  ),
                ),

                // Warning if no role
                if (status == 'open' && !hasP)
                  Container(
                    margin: const EdgeInsets.only(top: 10),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(color: const Color(0xFFFFFBEB), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFFDE68A))),
                    child: Row(
                      children: [
                        const Expanded(child: Text('⚠️ Bitte Rolle zuweisen bevor Sie einladen', style: TextStyle(fontSize: 12, color: Color(0xFF92400E)))),
                        GestureDetector(
                          onTap: () => _openEditPermissions(member),
                          child: const Text('Zuweisen →', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary)),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),

          // Dropdown action menu overlay
          if (showMenu)
            Positioned(
              top: 62, right: 12,
              child: _buildActionMenu(member),
            ),
        ],
      ),
    );
  }

  Widget _actionBtn({required IconData icon, String? label, bool loading = false, required bool primary, VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: primary ? AppColors.primary : const Color(0xFFEFF6FF),
          borderRadius: BorderRadius.circular(8),
          border: primary ? null : Border.all(color: AppColors.primary),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (loading)
              SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: primary ? Colors.white : AppColors.primary))
            else
              Icon(icon, size: 14, color: primary ? Colors.white : AppColors.primary),
            if (label != null) ...[const SizedBox(width: 5), Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: primary ? Colors.white : AppColors.primary))],
          ],
        ),
      ),
    );
  }

  Widget _moreMenuBtn(Map<String, dynamic> member, String id, bool showMenu) {
    return GestureDetector(
      onTap: () => setState(() => _openMenuId = showMenu ? null : id),
      child: Container(
        width: 32, height: 32,
        decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFE2E8F0))),
        child: const Icon(LucideIcons.moreVertical, size: 16, color: Color(0xFF64748B)),
      ),
    );
  }

  Widget _buildActionMenu(Map<String, dynamic> member) {
    final status = member['status'] as String? ?? 'open';
    return Material(
      elevation: 12,
      borderRadius: BorderRadius.circular(12),
      shadowColor: Colors.black.withOpacity(0.12),
      child: Container(
        width: 240,
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _menuItem(LucideIcons.shield, 'Berechtigungen bearbeiten', null, () => _openEditPermissions(member)),
            if (status == 'active') _menuItem(LucideIcons.userX, 'Inaktiv setzen', const Color(0xFFF59E0B), () => _setInactive(member)),
            if (status == 'inactive') _menuItem(LucideIcons.userCheck, 'Reaktivieren', const Color(0xFF10B981), () => _reactivate(member)),
            if (status == 'invited' || status == 'active') _menuItem(LucideIcons.refreshCw, 'Einladung erneut senden', null, () => _reInviteMember(member)),
            Container(height: 1, color: const Color(0xFFF1F5F9)),
            _menuItem(LucideIcons.trash2, 'Entfernen', const Color(0xFFEF4444), () => _removeMember(member['id'] as String)),
          ],
        ),
      ),
    );
  }

  Widget _menuItem(IconData icon, String label, Color? color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        child: Row(children: [
          Icon(icon, size: 14, color: color ?? const Color(0xFF64748B)),
          const SizedBox(width: 10),
          Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: color ?? const Color(0xFF334155))),
        ]),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FREIGABEN TAB
  // ─────────────────────────────────────────────────────────────────────────

  Widget _buildFreigabenTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.screenH, 20, AppSpacing.screenH, 80),
      children: [
        // Info banner
        Container(
          padding: const EdgeInsets.all(16),
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFBFDBFE))),
          child: const Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(LucideIcons.info, size: 20, color: Color(0xFF2563EB)),
              SizedBox(width: 12),
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Sichtbarkeits-Einstellungen', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF1E40AF))),
                  SizedBox(height: 4),
                  Text('Definieren Sie die Standard-Sichtbarkeit für jedes Modul im Projekt. Einzelne Inhalte können zusätzlich individuell freigegeben werden.', style: TextStyle(fontSize: 13, color: Color(0xFF1E40AF), height: 1.5)),
                ],
              )),
            ],
          ),
        ),

        // Teams overview
        if (_teams.isNotEmpty) ...[
          Container(
            padding: const EdgeInsets.all(16),
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFF1F5F9))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Teams in diesem Projekt', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8, runSpacing: 8,
                  children: _teams.map((t) => Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFE2E8F0))),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(LucideIcons.building2, size: 14, color: Color(0xFF64748B)),
                      const SizedBox(width: 6),
                      Text(t['name'] as String? ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                    ]),
                  )).toList(),
                ),
              ],
            ),
          ),
        ],

        // Module visibility cards
        if (_contentDefaults.isEmpty)
          _emptyCard(icon: LucideIcons.share2, title: 'Keine Module verfügbar', subtitle: 'Freigabe-Einstellungen werden nach der Projekterstellung geladen.')
        else ...[
          ...List.generate(_contentDefaults.length, (i) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _buildVisibilityCard(_contentDefaults[i]),
          )),

          // Save button
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              GestureDetector(
                onTap: _savingFreigaben ? null : _saveFreigaben,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 24),
                  decoration: BoxDecoration(
                    color: _savingFreigaben ? const Color(0xFFCBD5E1) : AppColors.primary,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_savingFreigaben)
                        const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      else
                        const Icon(LucideIcons.check, size: 16, color: Colors.white),
                      const SizedBox(width: 8),
                      Text(_savingFreigaben ? 'Wird gespeichert...' : 'Freigaben speichern', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildVisibilityCard(Map<String, dynamic> cd) {
    final current = cd['default_visibility'] as String? ?? 'all_participants';
    final hasCustom = cd['has_custom_default'] as bool? ?? false;
    final vColor = _visibilityColor(current);

    return Container(
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFF1F5F9))),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(color: vColor.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
                  child: Center(child: Icon(_visibilityIcon(current), size: 18, color: vColor)),
                ),
                const SizedBox(width: 10),
                Expanded(child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(cd['module_name'] as String? ?? '', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                    Text(cd['module_key'] as String? ?? '', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                  ],
                )),
                if (hasCustom)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(6), border: Border.all(color: const Color(0xFFBBF7D0))),
                    child: const Text('ANGEPASST', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF16A34A))),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            for (final opt in [
              ('all_participants', 'Alle Beteiligten', 'Alle Projektmitglieder können die Inhalte sehen', const Color(0xFF10B981), LucideIcons.globe),
              ('team_only', 'Nur eigenes Team', 'Jedes Team sieht nur seine eigenen Inhalte', const Color(0xFFF59E0B), LucideIcons.building2),
              ('owner_only', 'Nur Projektersteller', 'Nur Projektersteller & Superuser können sehen', const Color(0xFFEF4444), LucideIcons.lock),
            ])
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _visibilityOption(cd['module_key'] as String, opt.$1, opt.$2, opt.$3, opt.$4, opt.$5, current == opt.$1),
              ),
          ],
        ),
      ),
    );
  }

  Widget _visibilityOption(String moduleKey, String value, String label, String desc, Color color, IconData icon, bool selected) {
    return GestureDetector(
      onTap: () => _setVisibility(moduleKey, value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: selected ? color.withOpacity(0.06) : const Color(0xFFFAFAFA),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: selected ? color : const Color(0xFFE2E8F0), width: 2),
        ),
        child: Row(
          children: [
            Container(
              width: 22, height: 22,
              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: selected ? color : const Color(0xFFCBD5E1), width: 2), color: selected ? color : Colors.white),
              child: selected ? const Icon(LucideIcons.check, size: 12, color: Colors.white) : null,
            ),
            const SizedBox(width: 10),
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 10),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: selected ? color : const Color(0xFF334155))),
                Text(desc, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              ],
            )),
          ],
        ),
      ),
    );
  }

  Color _visibilityColor(String v) {
    switch (v) {
      case 'all_participants': return const Color(0xFF10B981);
      case 'team_only': return const Color(0xFFF59E0B);
      case 'owner_only': return const Color(0xFFEF4444);
      default: return AppColors.primary;
    }
  }

  IconData _visibilityIcon(String v) {
    switch (v) {
      case 'all_participants': return LucideIcons.globe;
      case 'team_only': return LucideIcons.building2;
      case 'owner_only': return LucideIcons.lock;
      default: return LucideIcons.globe;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODALS
  // ─────────────────────────────────────────────────────────────────────────

  // Edit Permissions Modal — shown as overlay on Scaffold
  void _showEditPermModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _EditPermissionsSheet(
        member: _editingMember!,
        availableRoles: _availableRoles,
        availableModules: _availableModules,
        selectedRoleId: _selectedRoleId,
        useCustomPermissions: _useCustomPermissions,
        customPermissions: _customPermissions,
        onRoleChanged: (v) => setState(() => _selectedRoleId = v),
        onModeChanged: (v) => setState(() => _useCustomPermissions = v),
        onToggle: _togglePermission,
        onSave: _savePermissions,
        onCancel: () { Navigator.pop(context); },
      ),
    );
  }

  Future<void> _openEditPermissions(Map<String, dynamic> member) async {
    await _prepareEditPermissions(member);
    if (mounted) _showEditPermModal();
  }

  Future<void> _prepareEditPermissions(Map<String, dynamic> member) async {
    _editingMember = member;
    _selectedRoleId = member['role_id'] as String? ?? '';
    final perms = (member['custom_permissions'] as List?) ?? [];
    _useCustomPermissions = perms.isNotEmpty;

    final permsObj = <String, Map<String, dynamic>>{};
    if (perms.isNotEmpty) {
      for (final p in perms) {
        permsObj[p['module_key'] as String] = Map<String, dynamic>.from(p as Map);
      }
    } else if (_selectedRoleId.isNotEmpty) {
      try {
        final rolePerms = await _db.from('role_permissions').select().eq('role_id', _selectedRoleId);
        for (final rp in (rolePerms as List)) {
          final mod = _availableModules.firstWhere((m) => m['module_key'] == rp['module_key'], orElse: () => {});
          if (mod.isNotEmpty) {
            permsObj[rp['module_key'] as String] = {
              'module_key': rp['module_key'], 'module_name': mod['module_name'],
              'can_view': rp['can_view'] ?? false, 'can_create': rp['can_create'] ?? false,
              'can_edit': rp['can_edit'] ?? false, 'can_delete': rp['can_delete'] ?? false,
            };
          }
        }
      } catch (_) {}
    }

    for (final mod in _availableModules) {
      final k = mod['module_key'] as String;
      if (!permsObj.containsKey(k)) {
        permsObj[k] = {'module_key': k, 'module_name': mod['module_name'], 'can_view': false, 'can_create': false, 'can_edit': false, 'can_delete': false};
      }
    }

    if (mounted) setState(() { _customPermissions = permsObj; _openMenuId = null; });
  }

  // Add Team Members Modal
  void _showAddTeamModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setLocal) => _AddTeamSheet(
          teamMembers: _teamMembers,
          existingMemberIds: _members.map((m) => m['user_id'] as String?).whereType<String>().toSet(),
          selectedIds: _selectedTeamMemberIds,
          onToggle: (id) => setState(() {
            if (_selectedTeamMemberIds.contains(id)) {
              _selectedTeamMemberIds.remove(id);
            } else {
              _selectedTeamMemberIds.add(id);
            }
          }),
          onAdd: _addTeamMembers,
          onCancel: () { setState(() { _selectedTeamMemberIds.clear(); }); Navigator.pop(context); },
        ),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHARED WIDGETS
  // ─────────────────────────────────────────────────────────────────────────

  Widget _emptyCard({required IconData icon, required String title, required String subtitle}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(AppSpacing.cardRadius), border: Border.all(color: const Color(0xFFF1F5F9))),
      child: Column(
        children: [
          Icon(icon, size: 48, color: const Color(0xFFCBD5E1)),
          const SizedBox(height: 16),
          Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
          const SizedBox(height: 8),
          Text(subtitle, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: Color(0xFF64748B), height: 1.5)),
        ],
      ),
    );
  }

  String _formatDate(dynamic iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso.toString())?.toLocal();
    if (dt == null) return '';
    return '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}.${dt.year}';
  }

  // Unused abstract override — just suppress the unused warning
  // ignore: unused_element
  Widget _unused(BuildContext context) => const SizedBox();
}

// =============================================================================
// Edit Permissions Bottom Sheet
// =============================================================================

class _EditPermissionsSheet extends StatefulWidget {
  final Map<String, dynamic> member;
  final List<Map<String, dynamic>> availableRoles;
  final List<Map<String, dynamic>> availableModules;
  final String selectedRoleId;
  final bool useCustomPermissions;
  final Map<String, Map<String, dynamic>> customPermissions;
  final ValueChanged<String> onRoleChanged;
  final ValueChanged<bool> onModeChanged;
  final void Function(String moduleKey, String type) onToggle;
  final VoidCallback onSave;
  final VoidCallback onCancel;

  const _EditPermissionsSheet({
    required this.member,
    required this.availableRoles,
    required this.availableModules,
    required this.selectedRoleId,
    required this.useCustomPermissions,
    required this.customPermissions,
    required this.onRoleChanged,
    required this.onModeChanged,
    required this.onToggle,
    required this.onSave,
    required this.onCancel,
  });

  @override
  State<_EditPermissionsSheet> createState() => _EditPermissionsSheetState();
}

class _EditPermissionsSheetState extends State<_EditPermissionsSheet> {
  late String _roleId;
  late bool _useCustom;
  late Map<String, Map<String, dynamic>> _perms;

  @override
  void initState() {
    super.initState();
    _roleId = widget.selectedRoleId;
    _useCustom = widget.useCustomPermissions;
    _perms = Map.from(widget.customPermissions);
  }

  void _toggle(String key, String type) {
    setState(() {
      final p = Map<String, dynamic>.from(_perms[key] ?? {});
      p[type] = !(p[type] as bool? ?? false);
      if ((p['can_create'] == true || p['can_edit'] == true || p['can_delete'] == true) && p['can_view'] != true) {
        p['can_view'] = true;
      }
      _perms[key] = p;
    });
    widget.onToggle(key, type);
  }

  @override
  Widget build(BuildContext context) {
    final accessor = widget.member['accessor'] as Map<String, dynamic>?;
    final status = widget.member['status'] as String? ?? 'open';
    final sColor = _statusColor(status);
    final bottom = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      margin: EdgeInsets.only(bottom: bottom),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(child: Container(margin: const EdgeInsets.only(top: 10, bottom: 4), width: 36, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),

          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
            child: Row(children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                child: const Icon(LucideIcons.shield, color: AppColors.primary, size: 20),
              ),
              const SizedBox(width: 12),
              const Expanded(child: Text('Berechtigungen bearbeiten', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 17))),
              GestureDetector(
                onTap: widget.onCancel,
                child: Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(8)), child: const Icon(LucideIcons.x, size: 18, color: AppColors.textSecondary)),
              ),
            ]),
          ),
          const Divider(height: 20, color: AppColors.border),

          // Member info
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
              child: Row(children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: const Color(0xFFEFF6FF), border: Border.all(color: sColor, width: 2)),
                  child: Center(child: Text(_initials(accessor), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.primary))),
                ),
                const SizedBox(width: 12),
                Expanded(child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_displayName(accessor), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                    Text(accessor?['accessor_email'] as String? ?? '', style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
                  ],
                )),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: sColor.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
                  child: Text(_statusLabel(status), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: sColor)),
                ),
              ]),
            ),
          ),

          // Mode selector
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: Row(children: [
              Expanded(child: _modeOption(false, LucideIcons.shield, 'Vordefinierte Rolle', !_useCustom)),
              const SizedBox(width: 8),
              Expanded(child: _modeOption(true, LucideIcons.edit2, 'Individuell', _useCustom)),
            ]),
          ),

          // Role picker / Custom permissions
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
              child: !_useCustom ? _buildRolePicker() : _buildCustomPerms(),
            ),
          ),

          // Buttons
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                GestureDetector(
                  onTap: widget.onCancel,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
                    decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(12)),
                    child: const Row(children: [
                      Icon(LucideIcons.x, size: 16, color: AppColors.textSecondary),
                      SizedBox(width: 6),
                      Text('Abbrechen', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                    ]),
                  ),
                ),
                const SizedBox(width: 10),
                GestureDetector(
                  onTap: widget.onSave,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 20),
                    decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(12)),
                    child: const Row(children: [
                      Icon(LucideIcons.check, size: 16, color: Colors.white),
                      SizedBox(width: 6),
                      Text('Speichern', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                    ]),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _modeOption(bool isCustom, IconData icon, String label, bool selected) {
    return GestureDetector(
      onTap: () { setState(() => _useCustom = isCustom); widget.onModeChanged(isCustom); },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFEFF6FF) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? AppColors.primary : const Color(0xFFE2E8F0), width: 2),
        ),
        child: Column(children: [
          Icon(icon, size: 20, color: selected ? AppColors.primary : AppColors.textSecondary),
          const SizedBox(height: 6),
          Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: selected ? AppColors.primary : AppColors.textSecondary)),
        ]),
      ),
    );
  }

  Widget _buildRolePicker() {
    if (widget.availableRoles.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(14),
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFFDE68A))),
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('⚠️ Keine Rollen verfügbar', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF92400E))),
            SizedBox(height: 4),
            Text('Der Projektersteller muss zuerst unter "Projektrollen" Rollen definieren.', style: TextStyle(fontSize: 12, color: Color(0xFF92400E))),
          ],
        ),
      );
    }
    return Column(
      children: [
        const Align(alignment: Alignment.centerLeft, child: Padding(padding: EdgeInsets.only(bottom: 8), child: Text('Rolle auswählen *', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)))),
        ...widget.availableRoles.map((r) {
          final selected = _roleId == r['id'];
          return GestureDetector(
            onTap: () { setState(() => _roleId = r['id'] as String); widget.onRoleChanged(r['id'] as String); },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: selected ? const Color(0xFFEFF6FF) : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: selected ? AppColors.primary : const Color(0xFFE2E8F0), width: selected ? 2 : 1),
              ),
              child: Row(children: [
                Container(width: 22, height: 22, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: selected ? AppColors.primary : const Color(0xFFCBD5E1), width: 2), color: selected ? AppColors.primary : Colors.white), child: selected ? const Icon(LucideIcons.check, size: 12, color: Colors.white) : null),
                const SizedBox(width: 12),
                const Icon(LucideIcons.shield, size: 16, color: AppColors.primary),
                const SizedBox(width: 10),
                Expanded(child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(r['role_name'] as String? ?? '', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: selected ? AppColors.primary : const Color(0xFF0F172A))),
                    if ((r['role_description'] as String? ?? '').isNotEmpty)
                      Text(r['role_description'] as String, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                  ],
                )),
              ]),
            ),
          );
        }),
        const SizedBox(height: 8),
      ],
    );
  }

  Widget _buildCustomPerms() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Berechtigungen definieren', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
        const SizedBox(height: 12),
        ...widget.availableModules.map((mod) {
          final k = mod['module_key'] as String;
          final p = _perms[k] ?? {};
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFE2E8F0))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(mod['module_name'] as String? ?? k, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6, runSpacing: 6,
                  children: [
                    _permToggle(k, 'can_view', 'Sehen', LucideIcons.eye, p['can_view'] as bool? ?? false),
                    _permToggle(k, 'can_create', 'Erstellen', LucideIcons.plus, p['can_create'] as bool? ?? false),
                    _permToggle(k, 'can_edit', 'Bearbeiten', LucideIcons.edit2, p['can_edit'] as bool? ?? false),
                    _permToggle(k, 'can_delete', 'Löschen', LucideIcons.trash2, p['can_delete'] as bool? ?? false),
                  ],
                ),
              ],
            ),
          );
        }),
        const SizedBox(height: 8),
      ],
    );
  }

  Widget _permToggle(String key, String type, String label, IconData icon, bool active) {
    return GestureDetector(
      onTap: () => _toggle(key, type),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 10),
        decoration: BoxDecoration(
          color: active ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: active ? AppColors.primary : const Color(0xFFE2E8F0)),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 12, color: active ? Colors.white : AppColors.textSecondary),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: active ? Colors.white : AppColors.textSecondary)),
        ]),
      ),
    );
  }
}

// =============================================================================
// Add Team Members Bottom Sheet
// =============================================================================

class _AddTeamSheet extends StatelessWidget {
  final List<Map<String, dynamic>> teamMembers;
  final Set<String> existingMemberIds;
  final Set<String> selectedIds;
  final ValueChanged<String> onToggle;
  final VoidCallback onAdd;
  final VoidCallback onCancel;

  const _AddTeamSheet({
    required this.teamMembers,
    required this.existingMemberIds,
    required this.selectedIds,
    required this.onToggle,
    required this.onAdd,
    required this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Center(child: Container(margin: const EdgeInsets.only(top: 10, bottom: 4), width: 36, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
            child: Row(children: [
              Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(8)), child: const Icon(LucideIcons.users, color: AppColors.primary, size: 20)),
              const SizedBox(width: 12),
              const Expanded(child: Text('Team-Mitglieder hinzufügen', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 17))),
              GestureDetector(onTap: onCancel, child: Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(8)), child: const Icon(LucideIcons.x, size: 18, color: AppColors.textSecondary))),
            ]),
          ),
          const Divider(height: 20, color: AppColors.border),

          // Info
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFBFDBFE))),
              child: const Row(children: [
                Icon(LucideIcons.info, size: 16, color: Color(0xFF2563EB)),
                SizedBox(width: 8),
                Expanded(child: Text('Sie können Ihre Team-Mitglieder zu diesem Projekt hinzufügen.', style: TextStyle(fontSize: 12, color: Color(0xFF1E40AF)))),
              ]),
            ),
          ),

          // List
          Flexible(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
              shrinkWrap: true,
              children: teamMembers.isEmpty
                  ? [const Padding(padding: EdgeInsets.all(24), child: Text('Keine Team-Mitglieder. Fügen Sie Mitglieder unter "Mein Team" hinzu.', textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: AppColors.textSecondary)))]
                  : teamMembers.map((m) {
                      final id = m['id'] as String;
                      final inProject = existingMemberIds.contains(id);
                      final selected = selectedIds.contains(id);
                      final name = [m['first_name'], m['last_name']].where((v) => v != null && (v as String).isNotEmpty).join(' ');
                      return GestureDetector(
                        onTap: inProject ? null : () => onToggle(id),
                        child: Opacity(
                          opacity: inProject ? 0.5 : 1,
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: selected ? const Color(0xFFEFF6FF) : const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: selected ? AppColors.primary : const Color(0xFFE2E8F0), width: 2),
                            ),
                            child: Row(children: [
                              Container(
                                width: 40, height: 40,
                                decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                                child: Center(child: Text((name.isNotEmpty ? name[0] : (m['email'] as String? ?? '?')[0]).toUpperCase(), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white))),
                              ),
                              const SizedBox(width: 12),
                              Expanded(child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(name.isNotEmpty ? name : (m['email'] as String? ?? ''), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
                                  Text(m['email'] as String? ?? '', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                                  if (inProject) const Text('✓ Bereits im Projekt', style: TextStyle(fontSize: 11, color: Color(0xFF10B981))),
                                ],
                              )),
                              if (m['team_role'] == 'team_admin')
                                Container(margin: const EdgeInsets.only(right: 8), padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(6)), child: const Text('Admin', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFD97706)))),
                              if (!inProject)
                                Container(width: 24, height: 24, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: selected ? AppColors.primary : const Color(0xFFCBD5E1), width: 2), color: selected ? AppColors.primary : Colors.white), child: selected ? const Icon(LucideIcons.check, size: 14, color: Colors.white) : null),
                            ]),
                          ),
                        ),
                      );
                    }).toList(),
            ),
          ),

          if (selectedIds.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text('${selectedIds.length} Mitglied${selectedIds.length != 1 ? 'er' : ''} ausgewählt', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            ),

          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            child: Row(children: [
              Expanded(
                child: GestureDetector(
                  onTap: onCancel,
                  child: Container(padding: const EdgeInsets.symmetric(vertical: 12), decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(12)), child: const Center(child: Text('Abbrechen', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textSecondary)))),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: GestureDetector(
                  onTap: selectedIds.isEmpty ? null : onAdd,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(color: selectedIds.isEmpty ? const Color(0xFFCBD5E1) : AppColors.primary, borderRadius: BorderRadius.circular(12)),
                    child: Center(child: Text(selectedIds.isEmpty ? 'Hinzufügen' : '${selectedIds.length} hinzufügen', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white))),
                  ),
                ),
              ),
            ]),
          ),
        ],
      ),
    );
  }
}
