import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/services/supabase_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/burger_menu_leading.dart';
import '../../../core/widgets/lottie_loader.dart';

/// Superuser-only page to manage tag presets and connect them to this project.
///
/// Layout:
///  - Section A: "Meine Tags" — the superuser's personal tag library
///    (add, edit, delete tags).
///  - Section B: "Projekt-Tags" — assign tags from the library to THIS project.
///    Includes a toggle: "Nur diese Tags erlaubt" (restrict_to_preset).
class ProjectTagPresetsPage extends ConsumerStatefulWidget {
  final String projectId;
  const ProjectTagPresetsPage({super.key, required this.projectId});

  @override
  ConsumerState<ProjectTagPresetsPage> createState() =>
      _ProjectTagPresetsPageState();
}

class _ProjectTagPresetsPageState
    extends ConsumerState<ProjectTagPresetsPage> {
  // ── State ──────────────────────────────────────────────────────────────────
  bool _loading = true;

  /// All tags owned by the current superuser
  List<Map<String, dynamic>> _myTags = [];

  /// Tags currently assigned to this project (from project_tag_presets view)
  List<Map<String, dynamic>> _projectTags = [];

  /// Effective restrict flag for this project
  bool _restrictToPreset = false;

  // ── Tag-library editing ───────────────────────────────────────────────────
  final _tagNameCtrl = TextEditingController();
  String? _editingTagId;
  bool _tagSaving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _tagNameCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final results = await Future.wait([
      SupabaseService.getSuperuserTags(),
      SupabaseService.getProjectTagPresets(widget.projectId),
      SupabaseService.getProjectRestrictTags(widget.projectId),
    ]);
    if (!mounted) return;
    setState(() {
      _myTags = results[0] as List<Map<String, dynamic>>;
      _projectTags = results[1] as List<Map<String, dynamic>>;
      _restrictToPreset = results[2] as bool;
      _loading = false;
    });
  }

  // ── Tag library ───────────────────────────────────────────────────────────

  void _showTagSheet({Map<String, dynamic>? existing}) {
    _editingTagId = existing?['id'] as String?;
    _tagNameCtrl.text = existing?['name'] as String? ?? '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 24,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                existing != null ? 'Tag bearbeiten' : 'Neuen Tag erstellen',
                style: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _tagNameCtrl,
                autofocus: true,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  labelText: 'Tag-Name',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10)),
                  prefixIcon:
                      const Icon(LucideIcons.tag, size: 16),
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('Abbrechen'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: StatefulBuilder(builder: (_, setBtn) {
                      return FilledButton(
                        onPressed: _tagSaving
                            ? null
                            : () async {
                                final name =
                                    _tagNameCtrl.text.trim();
                                if (name.isEmpty) return;
                                setBtn(() => _tagSaving = true);
                                if (_editingTagId != null) {
                                  await SupabaseService.updateSuperuserTag(
                                      _editingTagId!, {'name': name});
                                } else {
                                  await SupabaseService
                                      .createSuperuserTag(name: name);
                                }
                                setBtn(() => _tagSaving = false);
                                if (mounted) {
                                  Navigator.pop(ctx);
                                  await _load();
                                }
                              },
                        child: _tagSaving
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white))
                            : const Text('Speichern'),
                      );
                    }),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _deleteTag(Map<String, dynamic> tag) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Tag löschen?'),
        content: Text(
            '"${tag['name']}" wird aus der Bibliothek und aus allen Projekten entfernt.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Abbrechen')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              style: TextButton.styleFrom(
                  foregroundColor: AppColors.danger),
              child: const Text('Löschen')),
        ],
      ),
    );
    if (confirm != true) return;
    await SupabaseService.deleteSuperuserTag(tag['id'] as String);
    await _load();
  }

  // ── Project tag assignments ───────────────────────────────────────────────

  bool _isAssignedToProject(String tagId) =>
      _projectTags.any((pt) => pt['tag_id'] == tagId);

  Future<void> _toggleProjectTag(Map<String, dynamic> tag) async {
    final tagId = tag['id'] as String;
    if (_isAssignedToProject(tagId)) {
      await SupabaseService.removeTagFromProject(
          projectId: widget.projectId, tagId: tagId);
    } else {
      await SupabaseService.assignTagToProject(
        projectId: widget.projectId,
        tagId: tagId,
        restrictToPreset: _restrictToPreset,
      );
    }
    await _load();
  }

  Future<void> _toggleRestrict(bool value) async {
    setState(() => _restrictToPreset = value);
    await SupabaseService.setProjectRestrictTags(
        projectId: widget.projectId, restrict: value);
    // Reload to confirm
    await _load();
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);

    // Guard: only superusers should reach this page, but double-check
    if (!auth.isSuperuser) {
      return Scaffold(
        appBar: AppBar(
          leading: burgerMenuLeading(context),
          title: const Text('Tag-Verwaltung'),
          backgroundColor: AppColors.surface,
          elevation: 0,
        ),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(LucideIcons.lock, size: 56, color: AppColors.textTertiary),
                SizedBox(height: 16),
                Text('Kein Zugriff',
                    style:
                        TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                SizedBox(height: 8),
                Text(
                  'Diese Seite ist nur für Superuser sichtbar.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: burgerMenuLeading(context),
        title: const Text('Tag-Verwaltung'),
        backgroundColor: AppColors.surface,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.refreshCw, size: 20),
            tooltip: 'Aktualisieren',
            onPressed: _load,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showTagSheet(),
        backgroundColor: AppColors.primary,
        icon: const Icon(LucideIcons.plus, color: Colors.white, size: 20),
        label: const Text('Neuer Tag',
            style: TextStyle(
                color: Colors.white, fontWeight: FontWeight.w600)),
      ),
      body: _loading
          ? const LottieLoader()
          : RefreshIndicator(
              onRefresh: _load,
              child: CustomScrollView(
                slivers: [
                  // ── Section A: Tag library ─────────────────────────────
                  SliverToBoxAdapter(
                    child: _SectionHeader(
                      icon: LucideIcons.tags,
                      title: 'Meine Tag-Bibliothek',
                      subtitle:
                          'Erstelle und verwalte Tags für all deine Projekte.',
                    ),
                  ),
                  if (_myTags.isEmpty)
                    SliverToBoxAdapter(
                      child: _EmptyHint(
                        icon: LucideIcons.tag,
                        message:
                            'Noch keine Tags vorhanden. Tippe auf „Neuer Tag", um loszulegen.',
                      ),
                    )
                  else
                    SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) => _TagLibraryTile(
                          tag: _myTags[i],
                          onEdit: () => _showTagSheet(existing: _myTags[i]),
                          onDelete: () => _deleteTag(_myTags[i]),
                        ),
                        childCount: _myTags.length,
                      ),
                    ),

                  // ── Section B: Project assignments ─────────────────────
                  SliverToBoxAdapter(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _SectionHeader(
                          icon: LucideIcons.folderOpen,
                          title: 'Projekt-Tags',
                          subtitle:
                              'Wähle Tags aus deiner Bibliothek für dieses Projekt.',
                        ),
                        // Restrict toggle
                        Container(
                          margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Nur diese Tags erlaubt',
                                      style: TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w600),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      _restrictToPreset
                                          ? 'Nutzer können ausschließlich die unten gewählten Tags verwenden.'
                                          : 'Nutzer können auch eigene Tags hinzufügen.',
                                      style: const TextStyle(
                                          fontSize: 12,
                                          color: AppColors.textSecondary),
                                    ),
                                  ],
                                ),
                              ),
                              Switch.adaptive(
                                value: _restrictToPreset,
                                onChanged: _toggleRestrict,
                                activeColor: AppColors.primary,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (_myTags.isEmpty)
                    SliverToBoxAdapter(
                      child: _EmptyHint(
                        icon: LucideIcons.info,
                        message:
                            'Erstelle zuerst Tags in der Bibliothek, um sie dem Projekt zuzuweisen.',
                      ),
                    )
                  else
                    SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) {
                          final tag = _myTags[i];
                          final assigned = _isAssignedToProject(
                              tag['id'] as String);
                          return _ProjectTagAssignTile(
                            tag: tag,
                            assigned: assigned,
                            onToggle: () => _toggleProjectTag(tag),
                          );
                        },
                        childCount: _myTags.length,
                      ),
                    ),

                  // Bottom spacing for FAB
                  const SliverToBoxAdapter(child: SizedBox(height: 100)),
                ],
              ),
            ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helper widgets
// ─────────────────────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _SectionHeader({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.text),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: const TextStyle(
                fontSize: 12, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _EmptyHint extends StatelessWidget {
  final IconData icon;
  final String message;

  const _EmptyHint({required this.icon, required this.message});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: AppColors.textTertiary),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(
                    fontSize: 13, color: AppColors.textSecondary),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Tile for the superuser tag library (Section A)
class _TagLibraryTile extends StatelessWidget {
  final Map<String, dynamic> tag;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _TagLibraryTile({
    required this.tag,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
                color: AppColors.primary, shape: BoxShape.circle),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              tag['name'] as String? ?? '',
              style: const TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w500),
            ),
          ),
          IconButton(
            icon:
                const Icon(LucideIcons.edit2, size: 16, color: AppColors.textSecondary),
            tooltip: 'Bearbeiten',
            onPressed: onEdit,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
          ),
          IconButton(
            icon: const Icon(LucideIcons.trash2, size: 16, color: AppColors.danger),
            tooltip: 'Löschen',
            onPressed: onDelete,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
          ),
        ],
      ),
    );
  }
}

/// Tile for assigning/unassigning a tag to the project (Section B)
class _ProjectTagAssignTile extends StatelessWidget {
  final Map<String, dynamic> tag;
  final bool assigned;
  final VoidCallback onToggle;

  const _ProjectTagAssignTile({
    required this.tag,
    required this.assigned,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: assigned
            ? AppColors.primary.withValues(alpha: 0.05)
            : AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
            color: assigned ? AppColors.primary.withValues(alpha: 0.3) : AppColors.border),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onToggle,
        child: Row(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: assigned ? AppColors.primary : Colors.transparent,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                    color: assigned
                        ? AppColors.primary
                        : AppColors.textTertiary,
                    width: 1.5),
              ),
              child: assigned
                  ? const Icon(LucideIcons.check,
                      size: 13, color: Colors.white)
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                tag['name'] as String? ?? '',
                style: TextStyle(
                    fontSize: 14,
                    fontWeight:
                        assigned ? FontWeight.w600 : FontWeight.w500,
                    color: assigned
                        ? AppColors.primary
                        : AppColors.text),
              ),
            ),
            if (assigned)
              const Icon(LucideIcons.check,
                  size: 16, color: AppColors.primary),
          ],
        ),
      ),
    );
  }
}
