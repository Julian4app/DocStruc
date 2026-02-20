import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/services/supabase_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/burger_menu_leading.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

String _fmtSize(dynamic bytes) {
  final b = bytes is int ? bytes : int.tryParse(bytes?.toString() ?? '') ?? 0;
  if (b < 1024) return '$b B';
  if (b < 1048576) return '${(b / 1024).toStringAsFixed(1)} KB';
  return '${(b / 1048576).toStringAsFixed(1)} MB';
}

String _fmtDate(String? raw) {
  if (raw == null) return '–';
  try {
    final d = DateTime.parse(raw).toLocal();
    return DateFormat('dd.MM.yyyy HH:mm').format(d);
  } catch (_) {
    return raw;
  }
}

String _fmtDateShort(String? raw) {
  if (raw == null) return '–';
  try {
    final d = DateTime.parse(raw).toLocal();
    return DateFormat('dd.MM.yyyy').format(d);
  } catch (_) {
    return raw;
  }
}

IconData _fileIcon(String? mime) {
  if (mime == null) return LucideIcons.file;
  if (mime.startsWith('image/')) return LucideIcons.image;
  if (mime.startsWith('video/')) return LucideIcons.video;
  if (mime.contains('pdf')) return LucideIcons.fileText;
  if (mime.contains('word') || mime.contains('document')) return LucideIcons.fileText;
  return LucideIcons.file;
}

Color _fileColor(String? mime) {
  if (mime == null) return AppColors.textSecondary;
  if (mime.startsWith('image/')) return const Color(0xFF10B981);
  if (mime.startsWith('video/')) return const Color(0xFF8B5CF6);
  if (mime.contains('pdf')) return const Color(0xFFDC2626);
  return const Color(0xFF3B82F6);
}

String _uploaderName(Map<String, dynamic> file) {
  final p = file['profiles'] as Map?;
  if (p == null) return 'Unbekannt';
  final full = '${p['first_name'] ?? ''} ${p['last_name'] ?? ''}'.trim();
  return full.isNotEmpty ? full : (p['email'] ?? 'Unbekannt') as String;
}

String _guessMimeFromExt(String ext) {
  switch (ext.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

class ProjectFilesPage extends StatefulWidget {
  final String projectId;
  const ProjectFilesPage({super.key, required this.projectId});

  @override
  State<ProjectFilesPage> createState() => _ProjectFilesPageState();
}

class _ProjectFilesPageState extends State<ProjectFilesPage>
    with SingleTickerProviderStateMixin {
  bool _loading = true;

  List<Map<String, dynamic>> _folders = [];
  List<Map<String, dynamic>> _files = [];
  List<Map<String, dynamic>> _members = [];
  List<Map<String, dynamic>> _allDocs = [];

  final Set<String> _expandedFolders = {};
  late final TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        SupabaseService.getAllFolders(widget.projectId),
        SupabaseService.getAllProjectFiles(widget.projectId),
        SupabaseService.getProjectMembers(widget.projectId),
        SupabaseService.getAllDocuments(widget.projectId),
      ]);
      if (mounted) {
        setState(() {
          _folders = (results[0] as List).cast<Map<String, dynamic>>();
          _files = (results[1] as List).cast<Map<String, dynamic>>();
          _members = (results[2] as List).cast<Map<String, dynamic>>();
          _allDocs = (results[3] as List).cast<Map<String, dynamic>>();
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
      _snack('Fehler beim Laden: $e', error: true);
    }
  }

  int get _totalSize =>
      _files.fold(0, (s, f) => s + ((f['file_size'] as int?) ?? 0));

  // ── Folder CRUD ───────────────────────────────────────────────────────────

  Future<void> _createOrUpdateFolder({Map<String, dynamic>? existing}) async {
    final nameCtrl = TextEditingController(text: existing?['name'] ?? '');
    final descCtrl = TextEditingController(text: existing?['description'] ?? '');
    String? parentId = existing?['parent_folder_id'] as String?;

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _BottomSheet(
        title: existing != null ? 'Ordner bearbeiten' : 'Neuer Ordner',
        child: StatefulBuilder(builder: (ctx2, setSt) {
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _label('Ordnername *'),
              _input(nameCtrl, 'z.B. Pläne & Zeichnungen'),
              const SizedBox(height: 16),
              _label('Beschreibung'),
              _input(descCtrl, 'Optionale Beschreibung', maxLines: 3),
              const SizedBox(height: 16),
              if (existing == null) ...[
                _label('Übergeordneter Ordner (optional)'),
                _folderDropdown(
                  value: parentId,
                  folders: _folders,
                  onChanged: (v) => setSt(() => parentId = v),
                ),
                const SizedBox(height: 16),
              ],
              _actionRow(
                onCancel: () => Navigator.pop(ctx2, false),
                onConfirm: () => Navigator.pop(ctx2, true),
                confirmLabel: existing != null ? 'Aktualisieren' : 'Erstellen',
              ),
            ],
          );
        }),
      ),
    );

    if (confirmed != true) return;
    if (nameCtrl.text.trim().isEmpty) return;

    try {
      if (existing != null) {
        await SupabaseService.updateFolder(existing['id'] as String, {
          'name': nameCtrl.text.trim(),
          'description': descCtrl.text.trim(),
        });
        _snack('Ordner aktualisiert');
      } else {
        await SupabaseService.createFolder(widget.projectId, {
          'name': nameCtrl.text.trim(),
          'description': descCtrl.text.trim(),
          'parent_folder_id': parentId,
          'created_by': SupabaseService.currentUserId,
        });
        _snack('Ordner erstellt');
      }
      await _load();
    } catch (e) {
      _snack('Fehler: $e', error: true);
    }
  }

  Future<void> _confirmDeleteFolder(Map<String, dynamic> folder) async {
    final ctrl = TextEditingController();
    final name = folder['name'] as String? ?? 'Ordner';
    bool nameMatches = false;

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _BottomSheet(
        title: 'Ordner löschen',
        child: StatefulBuilder(builder: (ctx2, setSt) {
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '⚠️ Warnung: Nicht rückgängig machbar',
                      style: TextStyle(
                          color: Color(0xFFDC2626),
                          fontWeight: FontWeight.w700,
                          fontSize: 14),
                    ),
                    SizedBox(height: 6),
                    Text(
                      'Alle Dateien in diesem Ordner werden ebenfalls gelöscht.',
                      style: TextStyle(color: Color(0xFF991B1B), fontSize: 13),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              _label('Ordnernamen eingeben um zu bestätigen:'),
              const SizedBox(height: 4),
              Text(name,
                  style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.text)),
              const SizedBox(height: 8),
              TextField(
                controller: ctrl,
                autofocus: true,
                onChanged: (v) => setSt(() => nameMatches = v == name),
                decoration: _inputDeco('Ordnername eingeben'),
              ),
              const SizedBox(height: 16),
              _actionRow(
                onCancel: () => Navigator.pop(ctx2, false),
                onConfirm: () => Navigator.pop(ctx2, true),
                confirmLabel: 'Endgültig löschen',
                confirmColor: const Color(0xFFDC2626),
                enabled: nameMatches,
              ),
            ],
          );
        }),
      ),
    );

    if (confirmed != true) return;
    try {
      await SupabaseService.deleteFolder(folder['id'] as String);
      _snack('Ordner gelöscht');
      await _load();
    } catch (e) {
      _snack('Fehler: $e', error: true);
    }
  }

  // ── File upload ───────────────────────────────────────────────────────────

  Future<void> _uploadFile({String? folderId}) async {
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: false,
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;
    final picked = result.files.first;
    final bytes = picked.bytes;
    if (bytes == null) return;

    final userId = SupabaseService.currentUserId;
    if (userId == null) {
      _snack('Nicht angemeldet', error: true);
      return;
    }

    setState(() => _loading = true);
    try {
      final ext = picked.extension ?? 'bin';
      final ts = DateTime.now().millisecondsSinceEpoch;
      final rnd = DateTime.now().microsecond;
      final folderPath = folderId ?? 'root';
      final storagePath = '${widget.projectId}/$folderPath/${ts}_$rnd.$ext';
      final mime = picked.extension != null
          ? _guessMimeFromExt(picked.extension!)
          : 'application/octet-stream';

      await SupabaseService.createFile(widget.projectId, {
        'folder_id': folderId,
        'name': picked.name,
        'storage_path': storagePath,
        'file_size': bytes.length,
        'mime_type': mime,
        'version': 1,
        'is_latest_version': true,
        'uploaded_by': userId,
      });

      await SupabaseService.uploadFile(
        bucket: 'project-files',
        path: storagePath,
        bytes: bytes,
        contentType: mime,
      );

      _snack('Datei hochgeladen');
      await _load();
    } catch (e) {
      _snack('Fehler beim Hochladen: $e', error: true);
      if (mounted) setState(() => _loading = false);
    }
  }

  // ── File actions ──────────────────────────────────────────────────────────

  Future<void> _downloadFile(Map<String, dynamic> file) async {
    try {
      final url = await SupabaseService.getSignedUrl(
          'project-files', file['storage_path'] as String);
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        _snack('Kann URL nicht öffnen', error: true);
      }
    } catch (e) {
      _snack('Fehler: $e', error: true);
    }
  }

  Future<void> _renameFile(Map<String, dynamic> file) async {
    final ctrl = TextEditingController(text: file['name'] as String? ?? '');
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _BottomSheet(
        title: 'Datei umbenennen',
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _label('Neuer Name'),
            _input(ctrl, 'Dateiname'),
            const SizedBox(height: 16),
            _actionRow(
              onCancel: () => Navigator.pop(ctx, false),
              onConfirm: () => Navigator.pop(ctx, true),
              confirmLabel: 'Umbenennen',
            ),
          ],
        ),
      ),
    );
    if (confirmed != true || ctrl.text.trim().isEmpty) return;
    try {
      await SupabaseService.renameFile(file['id'] as String, ctrl.text.trim());
      _snack('Datei umbenannt');
      await _load();
    } catch (e) {
      _snack('Fehler: $e', error: true);
    }
  }

  Future<void> _deleteFile(Map<String, dynamic> file) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Datei löschen'),
        content: Text('Möchten Sie "${file['name']}" wirklich löschen?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Abbrechen')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Löschen',
                style: TextStyle(color: Color(0xFFDC2626))),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await SupabaseService.deleteFromStorage(
          'project-files', file['storage_path'] as String);
      await SupabaseService.deleteFileRecord(file['id'] as String);
      _snack('Datei gelöscht');
      await _load();
    } catch (e) {
      _snack('Fehler: $e', error: true);
    }
  }

  Future<void> _showVersionsModal(Map<String, dynamic> file) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) =>
          _VersionsSheet(file: file, projectId: widget.projectId),
    );
    await _load();
  }

  Future<void> _showShareModal(Map<String, dynamic> file) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _ShareSheet(file: file, members: _members),
    );
  }

  Future<void> _showLinkToFolderModal(Map<String, dynamic> doc) async {
    String? selectedFolderId;

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _BottomSheet(
        title: 'Zu Ordner hinzufügen',
        child: StatefulBuilder(builder: (ctx2, setSt) {
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _label('Dokument'),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(doc['name'] ?? '',
                        style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.text)),
                    const SizedBox(height: 2),
                    Text(doc['source'] ?? '',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.textSecondary)),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              _label('Zielordner auswählen'),
              _folderDropdown(
                value: selectedFolderId,
                folders: _folders,
                onChanged: (v) => setSt(() => selectedFolderId = v),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  '💡 Das Dokument wird mit dem ausgewählten Ordner verknüpft.',
                  style: TextStyle(fontSize: 13, color: Color(0xFF1E40AF)),
                ),
              ),
              const SizedBox(height: 16),
              _actionRow(
                onCancel: () => Navigator.pop(ctx2, false),
                onConfirm: () => Navigator.pop(ctx2, true),
                confirmLabel: 'Verknüpfen',
                enabled: selectedFolderId != null,
              ),
            ],
          );
        }),
      ),
    );

    if (confirmed != true || selectedFolderId == null) return;
    try {
      if (doc['doc_type'] == 'project-file') {
        await SupabaseService.linkFileToFolder(
            doc['id'] as String, selectedFolderId!);
      } else {
        final userId = SupabaseService.currentUserId;
        if (userId == null) return;
        await SupabaseService.createFile(widget.projectId, {
          'folder_id': selectedFolderId,
          'name': doc['name'],
          'storage_path': doc['storage_path'],
          'file_size': doc['file_size'] ?? 0,
          'mime_type': doc['mime_type'] ?? 'application/octet-stream',
          'uploaded_by': userId,
          'description': 'Verknüpft von: ${doc['source']}',
        });
      }
      _snack('Dokument verknüpft');
      await _load();
    } catch (e) {
      _snack('Fehler: $e', error: true);
    }
  }

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? const Color(0xFFDC2626) : const Color(0xFF10B981),
      behavior: SnackBarBehavior.floating,
    ));
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: _loading
          ? null
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                FloatingActionButton(
                  heroTag: 'fab_folder',
                  onPressed: () => _createOrUpdateFolder(),
                  backgroundColor: AppColors.surface,
                  foregroundColor: AppColors.primary,
                  elevation: 4,
                  mini: true,
                  tooltip: 'Neuer Ordner',
                  child: const Icon(LucideIcons.folderPlus),
                ),
                const SizedBox(height: 12),
                FloatingActionButton.extended(
                  heroTag: 'fab_upload',
                  onPressed: () => _uploadFile(),
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  elevation: 4,
                  icon: const Icon(LucideIcons.upload, size: 18),
                  label: const Text('Hochladen',
                      style: TextStyle(fontWeight: FontWeight.w600)),
                ),
              ],
            ),
      appBar: AppBar(
        leading: burgerMenuLeading(context),
        title: const Text('Dokumente'),
        bottom: _loading
            ? null
            : TabBar(
                controller: _tabCtrl,
                labelColor: AppColors.primary,
                unselectedLabelColor: AppColors.textSecondary,
                indicatorColor: AppColors.primary,
                indicatorWeight: 3,
                tabs: [
                  const Tab(
                    icon: Icon(LucideIcons.folderOpen, size: 16),
                    text: 'Ordner-Ansicht',
                  ),
                  Tab(
                    icon: const Icon(LucideIcons.files, size: 16),
                    text: 'Alle (${_allDocs.length})',
                  ),
                ],
              ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: TabBarView(
                controller: _tabCtrl,
                children: [
                  _FoldersTab(
                    folders: _folders,
                    files: _files,
                    expandedFolders: _expandedFolders,
                    onToggleFolder: (id) => setState(() =>
                        _expandedFolders.contains(id)
                            ? _expandedFolders.remove(id)
                            : _expandedFolders.add(id)),
                    onUploadToFolder: (fid) => _uploadFile(folderId: fid),
                    onEditFolder: (f) => _createOrUpdateFolder(existing: f),
                    onDeleteFolder: _confirmDeleteFolder,
                    onDownload: _downloadFile,
                    onVersions: _showVersionsModal,
                    onShare: _showShareModal,
                    onRename: _renameFile,
                    onDelete: _deleteFile,
                    totalFiles: _files.length,
                    totalFolders: _folders.length,
                    totalSize: _totalSize,
                  ),
                  _AllDocsTab(
                    docs: _allDocs,
                    onLinkToFolder: _showLinkToFolderModal,
                    onDownload: _downloadFile,
                  ),
                ],
              ),
            ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Folders Tab
// ─────────────────────────────────────────────────────────────────────────────

class _FoldersTab extends StatelessWidget {
  final List<Map<String, dynamic>> folders;
  final List<Map<String, dynamic>> files;
  final Set<String> expandedFolders;
  final void Function(String) onToggleFolder;
  final void Function(String) onUploadToFolder;
  final void Function(Map<String, dynamic>) onEditFolder;
  final void Function(Map<String, dynamic>) onDeleteFolder;
  final void Function(Map<String, dynamic>) onDownload;
  final void Function(Map<String, dynamic>) onVersions;
  final void Function(Map<String, dynamic>) onShare;
  final void Function(Map<String, dynamic>) onRename;
  final void Function(Map<String, dynamic>) onDelete;
  final int totalFiles;
  final int totalFolders;
  final int totalSize;

  const _FoldersTab({
    required this.folders,
    required this.files,
    required this.expandedFolders,
    required this.onToggleFolder,
    required this.onUploadToFolder,
    required this.onEditFolder,
    required this.onDeleteFolder,
    required this.onDownload,
    required this.onVersions,
    required this.onShare,
    required this.onRename,
    required this.onDelete,
    required this.totalFiles,
    required this.totalFolders,
    required this.totalSize,
  });

  List<Map<String, dynamic>> _filesForFolder(String? folderId) =>
      files.where((f) => f['folder_id'] == folderId).toList();

  @override
  Widget build(BuildContext context) {
    final rootFolders =
        folders.where((f) => f['parent_folder_id'] == null).toList();
    final rootFiles = _filesForFolder(null);
    final isEmpty = folders.isEmpty && files.isEmpty;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        // Stats
        Row(
          children: [
            Expanded(
                child: _StatCard(
              icon: LucideIcons.file,
              iconColor: const Color(0xFF3B82F6),
              value: '$totalFiles',
              label: 'Dateien',
            )),
            const SizedBox(width: 12),
            Expanded(
                child: _StatCard(
              icon: LucideIcons.folder,
              iconColor: const Color(0xFFF59E0B),
              value: '$totalFolders',
              label: 'Ordner',
            )),
            const SizedBox(width: 12),
            Expanded(
                child: _StatCard(
              icon: LucideIcons.download,
              iconColor: const Color(0xFF10B981),
              value: _fmtSize(totalSize),
              label: 'Gesamt',
            )),
          ],
        ),
        const SizedBox(height: 16),

        if (isEmpty)
          const _EmptyState(
            icon: LucideIcons.folderOpen,
            title: 'Keine Dateien vorhanden',
            subtitle: 'Erstellen Sie einen Ordner oder laden Sie eine Datei hoch',
          )
        else ...[
          if (rootFiles.isNotEmpty)
            _FolderCard(
              folderId: '__root__',
              folderName: 'Root',
              fileCount: rootFiles.length,
              isExpanded: expandedFolders.contains('__root__'),
              onToggle: () => onToggleFolder('__root__'),
              onUpload: null,
              onEdit: null,
              onDelete: null,
              children: rootFiles
                  .map((f) => _FileRow(
                        file: f,
                        onDownload: onDownload,
                        onVersions: onVersions,
                        onShare: onShare,
                        onRename: onRename,
                        onDelete: onDelete,
                      ))
                  .toList(),
            ),
          ...rootFolders
              .map((f) => _buildFolderTree(folder: f, level: 0)),
        ],
      ],
    );
  }

  Widget _buildFolderTree(
      {required Map<String, dynamic> folder, required int level}) {
    final fid = folder['id'] as String;
    final folderFiles = _filesForFolder(fid);
    final childFolders =
        folders.where((f) => f['parent_folder_id'] == fid).toList();
    final isExpanded = expandedFolders.contains(fid);

    return Padding(
      padding: EdgeInsets.only(left: level * 12.0),
      child: Column(
        children: [
          _FolderCard(
            folderId: fid,
            folderName: folder['name'] as String? ?? 'Ordner',
            fileCount: folderFiles.length,
            isExpanded: isExpanded,
            onToggle: () => onToggleFolder(fid),
            onUpload: () => onUploadToFolder(fid),
            onEdit: () => onEditFolder(folder),
            onDelete: () => onDeleteFolder(folder),
            children: folderFiles
                .map((f) => _FileRow(
                      file: f,
                      onDownload: onDownload,
                      onVersions: onVersions,
                      onShare: onShare,
                      onRename: onRename,
                      onDelete: onDelete,
                    ))
                .toList(),
          ),
          if (isExpanded)
            ...childFolders.map(
                (child) => _buildFolderTree(folder: child, level: level + 1)),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Folder Card (accordion)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Context menu helpers
// ─────────────────────────────────────────────────────────────────────────────

void _showFolderMenu(
  BuildContext context, {
  required String folderName,
  VoidCallback? onUpload,
  VoidCallback? onEdit,
  VoidCallback? onDelete,
}) {
  showModalBottomSheet(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (_) => Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 4),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2)),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
              child: Row(children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(LucideIcons.folder,
                      size: 20, color: Color(0xFFF59E0B)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(folderName,
                      style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F172A))),
                ),
              ]),
            ),
            const Divider(height: 1, indent: 20, endIndent: 20),
            const SizedBox(height: 4),
            if (onUpload != null)
              _MenuTile(
                icon: LucideIcons.upload,
                iconColor: AppColors.primary,
                label: 'Datei hochladen',
                onTap: () { Navigator.pop(context); onUpload(); },
              ),
            if (onEdit != null)
              _MenuTile(
                icon: LucideIcons.pencil,
                iconColor: const Color(0xFF3B82F6),
                label: 'Ordner umbenennen',
                onTap: () { Navigator.pop(context); onEdit(); },
              ),
            if (onDelete != null)
              _MenuTile(
                icon: LucideIcons.trash2,
                iconColor: const Color(0xFFDC2626),
                label: 'Ordner löschen',
                labelColor: const Color(0xFFDC2626),
                onTap: () { Navigator.pop(context); onDelete(); },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    ),
  );
}

void _showFileMenu(
  BuildContext context, {
  required Map<String, dynamic> file,
  required void Function(Map<String, dynamic>) onRename,
  required void Function(Map<String, dynamic>) onDelete,
}) {
  final name = file['name'] as String? ?? 'Datei';
  final mime = file['mime_type'] as String?;
  showModalBottomSheet(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (_) => Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 4),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2)),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
              child: Row(children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: _fileColor(mime).withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(_fileIcon(mime), size: 20, color: _fileColor(mime)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F172A))),
                ),
              ]),
            ),
            const Divider(height: 1, indent: 20, endIndent: 20),
            const SizedBox(height: 4),
            _MenuTile(
              icon: LucideIcons.pencil,
              iconColor: const Color(0xFF3B82F6),
              label: 'Umbenennen',
              onTap: () { Navigator.pop(context); onRename(file); },
            ),
            _MenuTile(
              icon: LucideIcons.trash2,
              iconColor: const Color(0xFFDC2626),
              label: 'Datei löschen',
              labelColor: const Color(0xFFDC2626),
              onTap: () { Navigator.pop(context); onDelete(file); },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    ),
  );
}

class _MenuTile extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final Color? labelColor;
  final VoidCallback onTap;

  const _MenuTile({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.onTap,
    this.labelColor,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        child: Row(children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: iconColor),
          ),
          const SizedBox(width: 14),
          Text(label,
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: labelColor ?? const Color(0xFF0F172A))),
        ]),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Folder Card
// ─────────────────────────────────────────────────────────────────────────────

class _FolderCard extends StatelessWidget {
  final String folderId;
  final String folderName;
  final int fileCount;
  final bool isExpanded;
  final VoidCallback onToggle;
  final VoidCallback? onUpload;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final List<Widget> children;

  const _FolderCard({
    required this.folderId,
    required this.folderName,
    required this.fileCount,
    required this.isExpanded,
    required this.onToggle,
    required this.onUpload,
    required this.onEdit,
    required this.onDelete,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
        boxShadow: const [
          BoxShadow(
              color: Color(0x08000000), blurRadius: 8, offset: Offset(0, 2))
        ],
      ),
      child: Column(
        children: [
          InkWell(
            onTap: onToggle,
            borderRadius: isExpanded
                ? const BorderRadius.vertical(top: Radius.circular(16))
                : BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Icon(
                    isExpanded
                        ? LucideIcons.chevronDown
                        : LucideIcons.chevronRight,
                    size: 18,
                    color: AppColors.textSecondary,
                  ),
                  const SizedBox(width: 10),
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(LucideIcons.folder,
                        size: 20, color: Color(0xFFF59E0B)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(folderName,
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.text)),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '$fileCount ${fileCount == 1 ? 'Datei' : 'Dateien'}',
                      style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary),
                    ),
                  ),
                  if (onUpload != null || onEdit != null || onDelete != null) ...[
                    const SizedBox(width: 4),
                    GestureDetector(
                      onTap: () => _showFolderMenu(
                        context,
                        folderName: folderName,
                        onUpload: onUpload,
                        onEdit: onEdit,
                        onDelete: onDelete,
                      ),
                      child: Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceVariant,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(LucideIcons.moreVertical,
                            size: 16, color: AppColors.textSecondary),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (isExpanded) ...[
            const Divider(height: 1, color: AppColors.borderLight),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: children.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.symmetric(vertical: 16),
                      child: Center(
                        child: Text('Keine Dateien in diesem Ordner',
                            style: TextStyle(
                                fontSize: 13, color: AppColors.textTertiary)),
                      ),
                    )
                  : Column(children: children),
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// File Row
// ─────────────────────────────────────────────────────────────────────────────

class _FileRow extends StatelessWidget {
  final Map<String, dynamic> file;
  final void Function(Map<String, dynamic>) onDownload;
  final void Function(Map<String, dynamic>) onVersions;
  final void Function(Map<String, dynamic>) onShare;
  final void Function(Map<String, dynamic>) onRename;
  final void Function(Map<String, dynamic>) onDelete;

  const _FileRow({
    required this.file,
    required this.onDownload,
    required this.onVersions,
    required this.onShare,
    required this.onRename,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final name = file['name'] as String? ?? 'Datei';
    final mime = file['mime_type'] as String?;
    final size = file['file_size'];
    final version = (file['version'] as int?) ?? 1;
    final uploadedAt = file['uploaded_at'] as String?;
    final uploader = _uploaderName(file);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: _fileColor(mime).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: Icon(_fileIcon(mime), size: 20, color: _fileColor(mime)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.text),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                const SizedBox(height: 3),
                Wrap(
                  spacing: 6,
                  children: [
                    if (size != null)
                      Text(_fmtSize(size),
                          style: const TextStyle(
                              fontSize: 11, color: AppColors.textTertiary)),
                    Text('v$version',
                        style: const TextStyle(
                            fontSize: 11, color: AppColors.textTertiary)),
                    if (uploadedAt != null)
                      Text(_fmtDate(uploadedAt),
                          style: const TextStyle(
                              fontSize: 11, color: AppColors.textTertiary)),
                    Text(uploader,
                        style: const TextStyle(
                            fontSize: 11, color: AppColors.textTertiary)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 4),
          _IconBtn(
            icon: LucideIcons.download,
            color: const Color(0xFF10B981),
            tooltip: 'Herunterladen',
            onTap: () => onDownload(file),
          ),
          const SizedBox(width: 2),
          _IconBtn(
            icon: LucideIcons.clock,
            color: const Color(0xFF3B82F6),
            tooltip: 'Versionen',
            onTap: () => onVersions(file),
          ),
          const SizedBox(width: 2),
          _IconBtn(
            icon: LucideIcons.share2,
            color: const Color(0xFF8B5CF6),
            tooltip: 'Teilen',
            onTap: () => onShare(file),
          ),
          const SizedBox(width: 2),
          GestureDetector(
            onTap: () => _showFileMenu(
              context,
              file: file,
              onRename: onRename,
              onDelete: onDelete,
            ),
            child: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: AppColors.surfaceVariant,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(LucideIcons.moreVertical,
                  size: 16, color: AppColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// All Documents Tab
// ─────────────────────────────────────────────────────────────────────────────

class _AllDocsTab extends StatelessWidget {
  final List<Map<String, dynamic>> docs;
  final void Function(Map<String, dynamic>) onLinkToFolder;
  final void Function(Map<String, dynamic>) onDownload;

  const _AllDocsTab({
    required this.docs,
    required this.onLinkToFolder,
    required this.onDownload,
  });

  @override
  Widget build(BuildContext context) {
    if (docs.isEmpty) {
      return const _EmptyState(
        icon: LucideIcons.files,
        title: 'Keine Dokumente vorhanden',
        subtitle:
            'Laden Sie Dateien hoch oder fügen Sie Aufgaben mit Anhängen hinzu',
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      itemCount: docs.length,
      separatorBuilder: (context, index) => const SizedBox(height: 10),
      itemBuilder: (ctx, i) {
        final doc = docs[i];
        final mime = doc['mime_type'] as String?;
        final size = doc['file_size'];
        final isProjectFile = doc['doc_type'] == 'project-file';
        final folderName = doc['linked_folder_name'] as String?;

        return Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.borderLight),
            boxShadow: const [
              BoxShadow(
                  color: Color(0x06000000),
                  blurRadius: 6,
                  offset: Offset(0, 2))
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: _fileColor(mime).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(_fileIcon(mime),
                      size: 22, color: _fileColor(mime)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(doc['name'] ?? '',
                          style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.text),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 4),
                      Wrap(
                        spacing: 8,
                        runSpacing: 2,
                        children: [
                          Text(doc['source'] ?? '',
                              style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary)),
                          Text(
                              _fmtDateShort(doc['created_at'] as String?),
                              style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textTertiary)),
                          if (doc['uploader_name'] != null)
                            Text(doc['uploader_name'] as String,
                                style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textTertiary)),
                          if (size != null)
                            Text(_fmtSize(size),
                                style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textTertiary)),
                        ],
                      ),
                      if (folderName != null) ...[
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(LucideIcons.folder,
                                  size: 12, color: Color(0xFF3B82F6)),
                              const SizedBox(width: 4),
                              Text(folderName,
                                  style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF3B82F6))),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          _OutlineButton(
                            icon: LucideIcons.folder,
                            label: 'Zu Ordner',
                            onTap: () => onLinkToFolder(doc),
                          ),
                          if (isProjectFile) ...[
                            const SizedBox(width: 8),
                            _OutlineButton(
                              icon: LucideIcons.download,
                              label: 'Download',
                              onTap: () => onDownload(doc),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Versions Sheet
// ─────────────────────────────────────────────────────────────────────────────

class _VersionsSheet extends StatefulWidget {
  final Map<String, dynamic> file;
  final String projectId;

  const _VersionsSheet({required this.file, required this.projectId});

  @override
  State<_VersionsSheet> createState() => _VersionsSheetState();
}

class _VersionsSheetState extends State<_VersionsSheet> {
  bool _loading = true;
  List<Map<String, dynamic>> _versions = [];

  @override
  void initState() {
    super.initState();
    _loadVersions();
  }

  Future<void> _loadVersions() async {
    setState(() => _loading = true);
    final v =
        await SupabaseService.getFileVersions(widget.file['id'] as String);
    if (mounted) {
      setState(() {
        _versions = v;
        _loading = false;
      });
    }
  }

  Future<void> _uploadNewVersion() async {
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: false,
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;
    final picked = result.files.first;
    final bytes = picked.bytes;
    if (bytes == null) return;

    setState(() => _loading = true);
    try {
      final ext = picked.extension ?? 'bin';
      final ts = DateTime.now().millisecondsSinceEpoch;
      final currentVersion = (widget.file['version'] as int?) ?? 1;
      final storagePath =
          '${widget.projectId}/${widget.file['folder_id'] ?? 'root'}/${ts}_v${currentVersion + 1}.$ext';

      await SupabaseService.uploadFile(
        bucket: 'project-files',
        path: storagePath,
        bytes: bytes,
      );
      await SupabaseService.uploadNewFileVersion(
        existingFile: widget.file,
        newStoragePath: storagePath,
        newFileSize: bytes.length,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Neue Version hochgeladen'),
          backgroundColor: Color(0xFF10B981),
          behavior: SnackBarBehavior.floating,
        ));
      }
      await _loadVersions();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Fehler: $e'),
          backgroundColor: const Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
        ));
        setState(() => _loading = false);
      }
    }
  }

  String _vName(Map<String, dynamic> v) {
    final p = v['profiles'] as Map?;
    if (p == null) return 'Unbekannt';
    final full = '${p['first_name'] ?? ''} ${p['last_name'] ?? ''}'.trim();
    return full.isNotEmpty ? full : (p['email'] ?? 'Unbekannt') as String;
  }

  @override
  Widget build(BuildContext context) {
    final file = widget.file;
    return _BottomSheet(
      title: 'Versionen: ${file['name'] ?? ''}',
      child: _loading
          ? const Center(
              child: Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: CircularProgressIndicator(),
            ))
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _uploadNewVersion,
                    icon: const Icon(LucideIcons.upload, size: 16),
                    label: const Text('Neue Version hochladen'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                _VersionCard(
                  version: (file['version'] as int?) ?? 1,
                  size: file['file_size'],
                  uploadedAt: file['uploaded_at'] as String?,
                  uploaderName: _uploaderName(file),
                  isCurrent: true,
                ),
                ..._versions.map((v) => _VersionCard(
                      version: (v['version'] as int?) ?? 0,
                      size: v['file_size'],
                      uploadedAt: v['uploaded_at'] as String?,
                      uploaderName: _vName(v),
                      isCurrent: false,
                      changeNotes: v['change_notes'] as String?,
                    )),
                if (_versions.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Center(
                      child: Text('Keine älteren Versionen vorhanden',
                          style: TextStyle(
                              color: AppColors.textTertiary, fontSize: 13)),
                    ),
                  ),
              ],
            ),
    );
  }
}

class _VersionCard extends StatelessWidget {
  final int version;
  final dynamic size;
  final String? uploadedAt;
  final String uploaderName;
  final bool isCurrent;
  final String? changeNotes;

  const _VersionCard({
    required this.version,
    required this.size,
    required this.uploadedAt,
    required this.uploaderName,
    required this.isCurrent,
    this.changeNotes,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text('v$version',
                  style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF3B82F6))),
            ),
            if (isCurrent) ...[
              const SizedBox(width: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text('Aktuell',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF16A34A))),
              ),
            ],
          ]),
          const SizedBox(height: 6),
          Wrap(spacing: 8, children: [
            if (size != null)
              Text(_fmtSize(size),
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.textSecondary)),
            if (uploadedAt != null)
              Text(_fmtDate(uploadedAt),
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.textSecondary)),
            Text(uploaderName,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.textSecondary)),
          ]),
          if (changeNotes != null) ...[
            const SizedBox(height: 4),
            Text(changeNotes!,
                style: const TextStyle(
                    fontSize: 12,
                    fontStyle: FontStyle.italic,
                    color: AppColors.textTertiary)),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Share Sheet
// ─────────────────────────────────────────────────────────────────────────────

class _ShareSheet extends StatefulWidget {
  final Map<String, dynamic> file;
  final List<Map<String, dynamic>> members;

  const _ShareSheet({required this.file, required this.members});

  @override
  State<_ShareSheet> createState() => _ShareSheetState();
}

class _ShareSheetState extends State<_ShareSheet> {
  bool _loading = true;
  List<Map<String, dynamic>> _shares = [];
  String? _selectedUserId;
  bool _canDownload = true;
  bool _canEdit = false;
  bool _canDelete = false;
  bool _canShare = false;

  @override
  void initState() {
    super.initState();
    _loadShares();
  }

  Future<void> _loadShares() async {
    setState(() => _loading = true);
    final s =
        await SupabaseService.getFileShares(widget.file['id'] as String);
    if (mounted) {
      setState(() {
        _shares = s;
        _loading = false;
      });
    }
  }

  Future<void> _share() async {
    if (_selectedUserId == null) return;
    try {
      await SupabaseService.createFileShare({
        'file_id': widget.file['id'],
        'shared_with_user_id': _selectedUserId,
        'permission_level': 'viewer',
        'can_download': _canDownload,
        'can_edit': _canEdit,
        'can_delete': _canDelete,
        'can_share': _canShare,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Datei geteilt'),
          backgroundColor: Color(0xFF10B981),
          behavior: SnackBarBehavior.floating,
        ));
        setState(() => _selectedUserId = null);
      }
      await _loadShares();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Fehler: $e'),
          backgroundColor: const Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
        ));
      }
    }
  }

  Future<void> _removeShare(String shareId) async {
    await SupabaseService.removeFileShare(shareId);
    await _loadShares();
  }

  String _memberName(Map<String, dynamic> member) {
    final p = member['profiles'] as Map?;
    if (p == null) return member['user_id'] as String? ?? 'Unbekannt';
    final full = '${p['first_name'] ?? ''} ${p['last_name'] ?? ''}'.trim();
    return full.isNotEmpty ? full : (p['email'] ?? 'Unbekannt') as String;
  }

  String _sharedWithName(String? userId) {
    if (userId == null) return 'Unbekannt';
    final m = widget.members.firstWhere(
        (m) => m['user_id'] == userId,
        orElse: () => <String, dynamic>{});
    if (m.isEmpty) return userId;
    return _memberName(m);
  }

  @override
  Widget build(BuildContext context) {
    return _BottomSheet(
      title: 'Teilen: ${widget.file['name'] ?? ''}',
      child: _loading
          ? const Center(
              child: Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: CircularProgressIndicator(),
            ))
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _label('Benutzer'),
                DropdownButtonFormField<String>(
                  initialValue: _selectedUserId,
                  hint: const Text('Benutzer auswählen'),
                  decoration: InputDecoration(
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide:
                            const BorderSide(color: AppColors.border)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                  ),
                  items: widget.members
                      .where((m) => m['profiles'] != null)
                      .map((m) => DropdownMenuItem<String>(
                            value: m['user_id'] as String?,
                            child: Text(_memberName(m)),
                          ))
                      .toList(),
                  onChanged: (v) => setState(() => _selectedUserId = v),
                ),
                const SizedBox(height: 16),
                _label('Berechtigungen'),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _PermToggle(
                      icon: LucideIcons.download,
                      label: 'Herunterladen',
                      active: _canDownload,
                      onTap: () =>
                          setState(() => _canDownload = !_canDownload),
                    ),
                    _PermToggle(
                      icon: LucideIcons.edit2,
                      label: 'Bearbeiten',
                      active: _canEdit,
                      onTap: () => setState(() => _canEdit = !_canEdit),
                    ),
                    _PermToggle(
                      icon: LucideIcons.trash2,
                      label: 'Löschen',
                      active: _canDelete,
                      onTap: () =>
                          setState(() => _canDelete = !_canDelete),
                    ),
                    _PermToggle(
                      icon: LucideIcons.share2,
                      label: 'Teilen',
                      active: _canShare,
                      onTap: () =>
                          setState(() => _canShare = !_canShare),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _selectedUserId != null ? _share : null,
                    icon: const Icon(LucideIcons.share2, size: 16),
                    label: const Text('Freigeben'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: AppColors.border,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
                if (_shares.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  const Text('Aktive Freigaben',
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.text)),
                  const SizedBox(height: 10),
                  ..._shares.map((s) => Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceVariant,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(children: [
                          const Icon(LucideIcons.user,
                              size: 16, color: AppColors.textSecondary),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _sharedWithName(
                                  s['shared_with_user_id'] as String?),
                              style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.text),
                            ),
                          ),
                          if (s['can_download'] == true)
                            const Icon(LucideIcons.download,
                                size: 14, color: Color(0xFF10B981)),
                          if (s['can_edit'] == true)
                            const Padding(
                              padding: EdgeInsets.only(left: 4),
                              child: Icon(LucideIcons.edit2,
                                  size: 14, color: Color(0xFF3B82F6)),
                            ),
                          if (s['can_delete'] == true)
                            const Padding(
                              padding: EdgeInsets.only(left: 4),
                              child: Icon(LucideIcons.trash2,
                                  size: 14, color: Color(0xFFDC2626)),
                            ),
                          if (s['can_share'] == true)
                            const Padding(
                              padding: EdgeInsets.only(left: 4),
                              child: Icon(LucideIcons.share2,
                                  size: 14, color: Color(0xFF8B5CF6)),
                            ),
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: () =>
                                _removeShare(s['id'] as String),
                            child: const Icon(LucideIcons.x,
                                size: 16, color: Color(0xFFDC2626)),
                          ),
                        ]),
                      )),
                ],
              ],
            ),
    );
  }
}

class _PermToggle extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _PermToggle({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: active ? AppColors.primary : AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
              color: active ? AppColors.primary : AppColors.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon,
                size: 14,
                color: active ? Colors.white : AppColors.textSecondary),
            const SizedBox(width: 6),
            Text(label,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: active ? Colors.white : AppColors.textSecondary)),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared widgets
// ─────────────────────────────────────────────────────────────────────────────

class _StatCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String value;
  final String label;

  const _StatCard({
    required this.icon,
    required this.iconColor,
    required this.value,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderLight),
        boxShadow: const [
          BoxShadow(
              color: Color(0x06000000), blurRadius: 6, offset: Offset(0, 2))
        ],
      ),
      child: Column(children: [
        Icon(icon, size: 24, color: iconColor),
        const SizedBox(height: 6),
        Text(value,
            style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.text)),
        const SizedBox(height: 2),
        Text(label,
            style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary)),
      ]),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _EmptyState({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.only(top: 60),
        child: Column(children: [
          Icon(icon, size: 48, color: AppColors.textTertiary),
          const SizedBox(height: 16),
          Text(title,
              style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.text)),
          const SizedBox(height: 8),
          Text(subtitle,
              style: const TextStyle(
                  fontSize: 14, color: AppColors.textSecondary),
              textAlign: TextAlign.center),
        ]),
      ),
    );
  }
}

class _BottomSheet extends StatelessWidget {
  final String title;
  final Widget child;

  const _BottomSheet({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(
          20, 20, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(
                child: Text(title,
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppColors.text)),
              ),
              IconButton(
                icon: const Icon(LucideIcons.x,
                    size: 20, color: AppColors.textSecondary),
                onPressed: () => Navigator.pop(context),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ]),
            const SizedBox(height: 20),
            child,
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _IconBtn extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String tooltip;
  final VoidCallback onTap;

  const _IconBtn({
    required this.icon,
    required this.color,
    required this.tooltip,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 16, color: color),
        ),
      ),
    );
  }
}

class _OutlineButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _OutlineButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: AppColors.textSecondary),
            const SizedBox(width: 5),
            Text(label,
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary)),
          ],
        ),
      ),
    );
  }
}

// ── Form helpers (module-level functions) ────────────────────────────────────

Widget _label(String text) => Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(text,
          style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.text)),
    );

Widget _input(TextEditingController ctrl, String hint,
        {int maxLines = 1}) =>
    TextField(
      controller: ctrl,
      maxLines: maxLines,
      decoration: _inputDeco(hint),
    );

InputDecoration _inputDeco(String hint) => InputDecoration(
      hintText: hint,
      hintStyle:
          const TextStyle(color: AppColors.textTertiary),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide:
            const BorderSide(color: AppColors.primary, width: 2),
      ),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    );

Widget _folderDropdown({
  required String? value,
  required List<Map<String, dynamic>> folders,
  required void Function(String?) onChanged,
}) =>
    DropdownButtonFormField<String>(
      initialValue: value,
      hint: const Text('Kein übergeordneter Ordner'),
      decoration: InputDecoration(
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      ),
      items: [
        const DropdownMenuItem<String>(
          value: null,
          child: Text('Kein übergeordneter Ordner'),
        ),
        ...folders.map((f) => DropdownMenuItem<String>(
              value: f['id'] as String?,
              child: Text(f['name'] as String? ?? 'Ordner'),
            )),
      ],
      onChanged: onChanged,
    );

Widget _actionRow({
  required VoidCallback onCancel,
  required VoidCallback onConfirm,
  required String confirmLabel,
  Color? confirmColor,
  bool enabled = true,
}) =>
    Row(children: [
      Expanded(
        child: OutlinedButton(
          onPressed: onCancel,
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10)),
          ),
          child: const Text('Abbrechen'),
        ),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: ElevatedButton(
          onPressed: enabled ? onConfirm : null,
          style: ElevatedButton.styleFrom(
            backgroundColor:
                enabled ? (confirmColor ?? AppColors.primary) : AppColors.border,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10)),
          ),
          child: Text(confirmLabel),
        ),
      ),
    ]);
