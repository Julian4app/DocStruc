import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:file_picker/file_picker.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

import '../../core/services/supabase_service.dart';
import '../../core/theme/app_colors.dart';
import 'package:docstruc_mobile/core/widgets/lottie_loader.dart';

// ─── Public entry point ──────────────────────────────────────────────────────

void showQuickAddSheet(BuildContext context) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    useRootNavigator: true,
    builder: (_) => const _QuickAddRoot(),
  );
}

// ─── Attachment model ────────────────────────────────────────────────────────

enum _CType { photo, voice, video, text }

class _Att {
  final _CType type;
  final List<int>? bytes;
  final String fileName;
  final String? text;
  const _Att({required this.type, this.bytes, required this.fileName, this.text});
}

// ─── Step enum ───────────────────────────────────────────────────────────────

enum _Step { pickType, recordVoice, enterText, pickProject, pickTarget, pickItem, pickFolder }

// ─── Root stateful widget ─────────────────────────────────────────────────────

class _QuickAddRoot extends StatefulWidget {
  const _QuickAddRoot();
  @override
  State<_QuickAddRoot> createState() => _QuickAddRootState();
}

class _QuickAddRootState extends State<_QuickAddRoot> {
  _Step _step = _Step.pickType;
  _Att? _attachment;
  Map<String, dynamic>? _project;
  String? _targetType; // 'task' | 'defect' | 'file'

  List<Map<String, dynamic>> _projects = [];
  List<Map<String, dynamic>> _items = [];
  List<Map<String, dynamic>> _folders = [];
  bool _loadingProjects = false;
  bool _loadingItems = false;
  bool _saving = false;

  String _itemSearch = '';

  String get _title {
    switch (_step) {
      case _Step.pickType:    return 'Dokumentieren';
      case _Step.recordVoice: return 'Sprachaufnahme';
      case _Step.enterText:   return 'Text hinzufügen';
      case _Step.pickProject: return 'Projekt wählen';
      case _Step.pickTarget:  return 'Ablageort wählen';
      case _Step.pickItem:    return _targetType == 'defect' ? 'Mangel wählen' : 'Aufgabe wählen';
      case _Step.pickFolder:  return 'Ordner wählen';
    }
  }

  bool get _canGoBack => _step != _Step.pickType;

  void _back() {
    setState(() {
      switch (_step) {
        case _Step.recordVoice:
        case _Step.enterText:
          _step = _Step.pickType; break;
        case _Step.pickProject:
          _step = _Step.pickType; _attachment = null; break;
        case _Step.pickTarget:
          _step = _Step.pickProject; break;
        case _Step.pickItem:
        case _Step.pickFolder:
          _step = _Step.pickTarget; break;
        default: break;
      }
    });
  }

  Future<void> _pickPhoto({required bool camera}) async {
    final xfile = camera
        ? await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 85)
        : await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (xfile == null || !mounted) return;
    final bytes = (await xfile.readAsBytes()).toList();
    _gotAttachment(_Att(type: _CType.photo, bytes: bytes, fileName: p.basename(xfile.path)));
  }

  Future<void> _pickVideo({required bool camera}) async {
    final xfile = camera
        ? await ImagePicker().pickVideo(source: ImageSource.camera)
        : await ImagePicker().pickVideo(source: ImageSource.gallery);
    if (xfile == null || !mounted) return;
    final bytes = (await xfile.readAsBytes()).toList();
    _gotAttachment(_Att(type: _CType.video, bytes: bytes, fileName: p.basename(xfile.path)));
  }

  Future<void> _pickAudio() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.audio, withData: true);
    if (result == null || result.files.isEmpty || !mounted) return;
    final f = result.files.first;
    _gotAttachment(_Att(type: _CType.voice, bytes: f.bytes?.toList(), fileName: f.name));
  }

  void _gotAttachment(_Att att) {
    setState(() { _attachment = att; });
    _goToProjects();
  }

  void _goToProjects() {
    setState(() { _step = _Step.pickProject; _loadingProjects = true; });
    SupabaseService.getProjects().then((ps) {
      if (mounted) setState(() { _projects = ps; _loadingProjects = false; });
    }).catchError((_) {
      if (mounted) setState(() => _loadingProjects = false);
    });
  }

  void _selectProject(Map<String, dynamic> proj) {
    setState(() { _project = proj; _step = _Step.pickTarget; });
  }

  void _selectTarget(String type) {
    setState(() { _targetType = type; });
    if (type == 'file') {
      setState(() { _step = _Step.pickFolder; _loadingItems = true; });
      SupabaseService.getFolders(_project!['id'] as String).then((f) {
        if (mounted) setState(() { _folders = f; _loadingItems = false; });
      }).catchError((_) {
        if (mounted) setState(() => _loadingItems = false);
      });
    } else {
      setState(() { _step = _Step.pickItem; _loadingItems = true; _items = []; _itemSearch = ''; });
      SupabaseService.getTasks(_project!['id'] as String).then((tasks) {
        if (mounted) setState(() {
          _items = tasks.where((t) {
            final tt = t['task_type'] as String? ?? 'task';
            return type == 'defect' ? tt == 'defect' : tt != 'defect';
          }).toList();
          _loadingItems = false;
        });
      }).catchError((_) {
        if (mounted) setState(() => _loadingItems = false);
      });
    }
  }

  Future<void> _attachToTask(Map<String, dynamic> task) async {
    setState(() => _saving = true);
    try {
      final taskId = task['id'] as String;
      final projectId = _project!['id'] as String;
      await _doAttach(taskId, projectId);
      if (mounted) {
        Navigator.of(context).pop();
        _showSuccess('Inhalt zu "${task['title']}" hinzugefügt');
      }
    } catch (e) {
      if (mounted) _showError(e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _createAndAttach(String title, String desc, String priority) async {
    setState(() => _saving = true);
    try {
      final projectId = _project!['id'] as String;
      final taskId = await SupabaseService.createTaskWithReturn(projectId, {
        'title': title,
        'description': desc,
        'priority': priority,
        'status': 'open',
        'task_type': _targetType == 'defect' ? 'defect' : 'task',
      });
      if (taskId != null) await _doAttach(taskId, projectId);
      if (mounted) {
        Navigator.of(context).pop();
        _showSuccess('${_targetType == "defect" ? "Mangel" : "Aufgabe"} erstellt & Inhalt angehängt');
      }
    } catch (e) {
      if (mounted) _showError(e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _saveToFolder({String? folderId}) async {
    setState(() => _saving = true);
    try {
      final projectId = _project!['id'] as String;
      final att = _attachment!;
      if (att.type == _CType.text) {
        await SupabaseService.createFile(projectId, {
          'name': 'Notiz_${DateTime.now().millisecondsSinceEpoch}.txt',
          'file_type': 'text/plain',
          'size': att.text?.length ?? 0,
          if (folderId != null) 'folder_id': folderId,
        });
      } else {
        final bytes = att.bytes;
        if (bytes == null) throw Exception('Keine Daten');
        final ext = p.extension(att.fileName).isEmpty ? _defExt(att.type) : p.extension(att.fileName);
        final storagePath = '$projectId/files/${DateTime.now().millisecondsSinceEpoch}_${att.fileName}';
        final url = await SupabaseService.uploadFile(
          bucket: 'project-files',
          path: storagePath,
          bytes: bytes,
          contentType: _mime(att.type, ext),
        );
        await SupabaseService.createFile(projectId, {
          'name': att.fileName,
          'file_url': url,
          'storage_path': storagePath,
          'file_type': att.type == _CType.photo ? 'image' : att.type == _CType.voice ? 'audio' : 'video',
          'size': bytes.length,
          if (folderId != null) 'folder_id': folderId,
        });
      }
      if (mounted) {
        Navigator.of(context).pop();
        _showSuccess('Datei gespeichert');
      }
    } catch (e) {
      if (mounted) _showError(e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _doAttach(String taskId, String projectId) async {
    final att = _attachment!;
    if (att.type == _CType.text) {
      await SupabaseService.addTaskDoc(taskId, projectId, {
        'documentation_type': 'text',
        'content': att.text ?? '',
      });
      return;
    }
    final bytes = att.bytes;
    if (bytes == null) return;
    final ext = p.extension(att.fileName).isEmpty ? _defExt(att.type) : p.extension(att.fileName);
    final storagePath = '$projectId/tasks/$taskId/${DateTime.now().millisecondsSinceEpoch}$ext';
    final bucket = att.type == _CType.photo ? 'task-images' : 'task-docs';
    final url = await SupabaseService.uploadFile(
      bucket: bucket, path: storagePath, bytes: bytes,
      contentType: _mime(att.type, ext),
    );
    if (att.type == _CType.photo) {
      await SupabaseService.addTaskImage(taskId, projectId, storagePath, att.fileName, 0);
    } else {
      await SupabaseService.addTaskDoc(taskId, projectId, {
        'documentation_type': att.type == _CType.voice ? 'voice' : 'video',
        'file_url': url,
        'file_name': att.fileName,
      });
    }
  }

  String _defExt(_CType t) =>
      t == _CType.photo ? '.jpg' : t == _CType.voice ? '.m4a' : '.mp4';

  String _mime(_CType t, String ext) {
    if (t == _CType.photo) return 'image/${ext.replaceFirst('.', '')}';
    if (t == _CType.voice) return 'audio/m4a';
    if (t == _CType.video) return 'video/mp4';
    return 'text/plain';
  }

  void _showSuccess(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(msg),
        backgroundColor: AppColors.success,
        behavior: SnackBarBehavior.floating));
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Fehler: $msg'),
        backgroundColor: AppColors.danger,
        behavior: SnackBarBehavior.floating));
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_canGoBack,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _canGoBack) _back();
      },
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.92,
          minHeight: MediaQuery.of(context).size.height * 0.5,
        ),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Stack(children: [
          Column(children: [
            _buildHandle(),
            _buildHeader(),
            if (_attachment != null && _step != _Step.pickType &&
                _step != _Step.recordVoice && _step != _Step.enterText)
              _buildAttachmentBar(),
            Expanded(child: _buildStepContent()),
          ]),
          if (_saving)
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: Colors.black26,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                ),
                child: Center(child: CircularProgressIndicator()),
              ),
            ),
        ]),
      ),
    );
  }

  Widget _buildHandle() => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: Center(child: Container(
      width: 40, height: 4,
      decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)),
    )),
  );

  Widget _buildHeader() => Padding(
    padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
    child: Row(children: [
      if (_canGoBack) ...[
        GestureDetector(
          onTap: _back,
          child: Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: const Icon(LucideIcons.chevronLeft, size: 18, color: AppColors.text),
          ),
        ),
        const SizedBox(width: 12),
      ],
      Expanded(child: Text(_title,
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.text))),
      GestureDetector(
        onTap: () => Navigator.of(context).pop(),
        child: Container(
          width: 36, height: 36,
          decoration: BoxDecoration(
            color: AppColors.background,
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(LucideIcons.x, size: 18, color: AppColors.textSecondary),
        ),
      ),
    ]),
  );

  Widget _buildAttachmentBar() {
    final att = _attachment!;
    IconData icon; Color color; String label;
    switch (att.type) {
      case _CType.photo: icon = LucideIcons.image; color = const Color(0xFF6366F1); label = att.fileName; break;
      case _CType.voice: icon = LucideIcons.mic; color = const Color(0xFFEF4444); label = att.fileName; break;
      case _CType.video: icon = LucideIcons.video; color = const Color(0xFF10B981); label = att.fileName; break;
      case _CType.text:
        icon = LucideIcons.fileText; color = AppColors.primary;
        final t = att.text ?? '';
        label = t.length > 50 ? '${t.substring(0, 50)}…' : t;
        break;
    }
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 10),
        Expanded(child: Text(label,
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color),
            maxLines: 1, overflow: TextOverflow.ellipsis)),
        if (_project != null) ...[
          const Icon(LucideIcons.chevronRight, size: 12, color: AppColors.textTertiary),
          const SizedBox(width: 4),
          Text(_project!['name'] ?? '', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        ],
      ]),
    );
  }

  Widget _buildStepContent() {
    switch (_step) {
      case _Step.pickType:
        return _StepPickType(onPhoto: _pickPhoto, onVideo: _pickVideo, onAudio: _pickAudio,
            onRecord: () => setState(() => _step = _Step.recordVoice),
            onText: () => setState(() => _step = _Step.enterText));
      case _Step.recordVoice:
        return _StepRecordVoice(onDone: (att) { setState(() => _attachment = att); _goToProjects(); });
      case _Step.enterText:
        return _StepEnterText(onDone: (att) { setState(() => _attachment = att); _goToProjects(); });
      case _Step.pickProject:
        return _StepPickProject(loading: _loadingProjects, projects: _projects, onSelect: _selectProject);
      case _Step.pickTarget:
        return _StepPickTarget(onSelect: _selectTarget);
      case _Step.pickItem:
        return _StepPickItem(
            loading: _loadingItems, items: _items, isDefect: _targetType == 'defect',
            search: _itemSearch, onSearchChanged: (v) => setState(() => _itemSearch = v),
            onAttach: _attachToTask,
            onCreateNew: (title, desc, priority) => _createAndAttach(title, desc, priority));
      case _Step.pickFolder:
        return _StepPickFolder(loading: _loadingItems, folders: _folders, onSave: _saveToFolder);
    }
  }
}

// ─── Step: pick type ─────────────────────────────────────────────────────────

class _StepPickType extends StatelessWidget {
  final void Function({required bool camera}) onPhoto;
  final void Function({required bool camera}) onVideo;
  final VoidCallback onAudio;
  final VoidCallback onRecord;
  final VoidCallback onText;
  const _StepPickType({required this.onPhoto, required this.onVideo, required this.onAudio,
      required this.onRecord, required this.onText});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Was möchtest du dokumentieren?',
            style: TextStyle(fontSize: 14, color: AppColors.textSecondary)),
        const SizedBox(height: 24),

        _SectionHead(icon: LucideIcons.image, label: 'Foto', color: const Color(0xFF6366F1)),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: _TypeCard(icon: LucideIcons.camera, label: 'Aufnehmen',
              color: const Color(0xFF6366F1), onTap: () => onPhoto(camera: true))),
          const SizedBox(width: 10),
          Expanded(child: _TypeCard(icon: LucideIcons.imagePlus, label: 'Galerie',
              color: const Color(0xFF8B5CF6), onTap: () => onPhoto(camera: false))),
        ]),
        const SizedBox(height: 20),

        _SectionHead(icon: LucideIcons.mic, label: 'Sprachaufnahme', color: const Color(0xFFEF4444)),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: _TypeCard(icon: LucideIcons.mic, label: 'Aufnehmen',
              color: const Color(0xFFEF4444), onTap: onRecord)),
          const SizedBox(width: 10),
          Expanded(child: _TypeCard(icon: LucideIcons.upload, label: 'Datei wählen',
              color: const Color(0xFFF97316), onTap: onAudio)),
        ]),
        const SizedBox(height: 20),

        _SectionHead(icon: LucideIcons.video, label: 'Video', color: const Color(0xFF10B981)),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: _TypeCard(icon: LucideIcons.video, label: 'Aufnehmen',
              color: const Color(0xFF10B981), onTap: () => onVideo(camera: true))),
          const SizedBox(width: 10),
          Expanded(child: _TypeCard(icon: LucideIcons.film, label: 'Galerie',
              color: const Color(0xFF0EA5E9), onTap: () => onVideo(camera: false))),
        ]),
        const SizedBox(height: 20),

        _SectionHead(icon: LucideIcons.fileText, label: 'Text', color: AppColors.primary),
        const SizedBox(height: 10),
        _TypeCard(icon: LucideIcons.fileText, label: 'Text hinzufügen',
            color: AppColors.primary, onTap: onText, fullWidth: true),
      ]),
    );
  }
}

class _SectionHead extends StatelessWidget {
  final IconData icon; final String label; final Color color;
  const _SectionHead({required this.icon, required this.label, required this.color});
  @override
  Widget build(BuildContext context) => Row(children: [
    Icon(icon, size: 14, color: color),
    const SizedBox(width: 6),
    Text(label.toUpperCase(), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
        color: color, letterSpacing: 0.8)),
  ]);
}

class _TypeCard extends StatelessWidget {
  final IconData icon; final String label; final Color color;
  final VoidCallback onTap; final bool fullWidth;
  const _TypeCard({required this.icon, required this.label, required this.color,
      required this.onTap, this.fullWidth = false});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: fullWidth ? double.infinity : null,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.18)),
        ),
        child: Row(children: [
          Container(width: 36, height: 36,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 18, color: color)),
          const SizedBox(width: 10),
          Expanded(child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color))),
          if (!fullWidth) Icon(LucideIcons.chevronRight, size: 14, color: color.withValues(alpha: 0.5)),
        ]),
      ),
    );
  }
}

// ─── Step: record voice ───────────────────────────────────────────────────────

class _StepRecordVoice extends StatefulWidget {
  final void Function(_Att) onDone;
  const _StepRecordVoice({required this.onDone});
  @override State<_StepRecordVoice> createState() => _StepRecordVoiceState();
}

class _StepRecordVoiceState extends State<_StepRecordVoice> {
  final _recorder = AudioRecorder();
  bool _isRecording = false;
  bool _hasRecording = false;
  String? _path;
  int _seconds = 0;
  Timer? _timer;

  @override
  void dispose() { _timer?.cancel(); _recorder.dispose(); super.dispose(); }

  Future<void> _start() async {
    if (!await _recorder.hasPermission()) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Mikrofonzugriff erforderlich')));
      return;
    }
    final dir = await getTemporaryDirectory();
    _path = '${dir.path}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
    await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: _path!);
    setState(() { _isRecording = true; _seconds = 0; _hasRecording = false; });
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && _isRecording) setState(() => _seconds++);
    });
  }

  Future<void> _stop() async {
    _timer?.cancel();
    await _recorder.stop();
    setState(() { _isRecording = false; _hasRecording = true; });
  }

  String get _fmt {
    final m = _seconds ~/ 60; final s = _seconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    const red = Color(0xFFEF4444);
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Center(
          child: Container(
            width: 160, height: 160,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _isRecording ? red.withValues(alpha: 0.08) : AppColors.background,
              border: Border.all(color: _isRecording ? red : AppColors.border, width: 2),
            ),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(_isRecording ? LucideIcons.micOff : LucideIcons.mic,
                  size: 44, color: _isRecording ? red : AppColors.textTertiary),
              const SizedBox(height: 8),
              Text(_fmt, style: TextStyle(
                  fontSize: 26, fontWeight: FontWeight.w700,
                  color: _isRecording ? red : AppColors.textSecondary,
                  fontFeatures: const [FontFeature.tabularFigures()])),
            ]),
          ),
        ),
        const SizedBox(height: 20),
        Text(
          _isRecording ? '● Aufnahme läuft…'
              : _hasRecording ? '✓ Aufnahme bereit'
              : 'Tippe zum Starten',
          style: TextStyle(
              fontSize: 14,
              color: _isRecording ? red : _hasRecording ? AppColors.success : AppColors.textSecondary,
              fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 32),
        Row(children: [
          Expanded(child: _isRecording
              ? _ActionBtn(label: 'Stoppen', icon: LucideIcons.square, color: red, onTap: _stop)
              : _ActionBtn(label: 'Aufnehmen', icon: LucideIcons.mic, color: red, onTap: _start)),
          if (_hasRecording) ...[
            const SizedBox(width: 12),
            Expanded(child: _ActionBtn(
              label: 'Weiter', icon: LucideIcons.chevronRight, color: AppColors.primary,
              onTap: () async {
                final bytes = (await File(_path!).readAsBytes()).toList();
                widget.onDone(_Att(type: _CType.voice, bytes: bytes, fileName: p.basename(_path!)));
              },
            )),
          ],
        ]),
      ]),
    );
  }
}

// ─── Step: enter text ────────────────────────────────────────────────────────

class _StepEnterText extends StatefulWidget {
  final void Function(_Att) onDone;
  const _StepEnterText({required this.onDone});
  @override State<_StepEnterText> createState() => _StepEnterTextState();
}

class _StepEnterTextState extends State<_StepEnterText> {
  final _ctrl = TextEditingController();
  @override void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(
            controller: _ctrl, maxLines: 7, autofocus: true,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              hintText: 'Notiz, Bemerkung, Beschreibung…',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: AppColors.border)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: AppColors.border)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
              fillColor: AppColors.background, filled: true,
              contentPadding: const EdgeInsets.all(16),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, child: _ActionBtn(
            label: 'Weiter', icon: LucideIcons.chevronRight, color: AppColors.primary,
            onTap: () {
              final txt = _ctrl.text.trim();
              if (txt.isEmpty) return;
              widget.onDone(_Att(type: _CType.text, fileName: 'note.txt', text: txt));
            },
          )),
        ]),
      ),
    );
  }
}

// ─── Step: pick project ───────────────────────────────────────────────────────

class _StepPickProject extends StatelessWidget {
  final bool loading;
  final List<Map<String, dynamic>> projects;
  final void Function(Map<String, dynamic>) onSelect;
  const _StepPickProject({required this.loading, required this.projects, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    if (loading) return const LottieLoader();
    if (projects.isEmpty) return const Padding(padding: EdgeInsets.all(40),
        child: Center(child: Text('Keine Projekte vorhanden',
            style: TextStyle(color: AppColors.textSecondary))));
    return ListView.separated(
      shrinkWrap: true,
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      itemCount: projects.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final proj = projects[i];
        final status = proj['status'] as String? ?? 'active';
        Color sc; String sl;
        switch (status) {
          case 'In Planung': case 'planning': sc = AppColors.info; sl = 'In Planung'; break;
          case 'Abgeschlossen': case 'completed': sc = AppColors.success; sl = 'Abgeschlossen'; break;
          default: sc = AppColors.accent; sl = 'Aktiv';
        }
        return GestureDetector(
          onTap: () { HapticFeedback.selectionClick(); onSelect(proj); },
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(children: [
              Container(width: 42, height: 42,
                  decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(10)),
                  child: const Icon(LucideIcons.building2, size: 20, color: AppColors.primary)),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(proj['name'] ?? '', style: const TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.text)),
                const SizedBox(height: 3),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: sc.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(5)),
                  child: Text(sl, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: sc))),
              ])),
              const Icon(LucideIcons.chevronRight, size: 16, color: AppColors.textTertiary),
            ]),
          ),
        );
      },
    );
  }
}

// ─── Step: pick target type ───────────────────────────────────────────────────

class _StepPickTarget extends StatelessWidget {
  final void Function(String) onSelect;
  const _StepPickTarget({required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('Wo soll der Inhalt gespeichert werden?',
            style: TextStyle(fontSize: 14, color: AppColors.textSecondary)),
        const SizedBox(height: 20),
        _TargetTile(icon: LucideIcons.checkSquare, color: const Color(0xFF3B82F6),
            title: 'Aufgabe', subtitle: 'An bestehende Aufgabe anhängen oder neue erstellen',
            onTap: () { HapticFeedback.selectionClick(); onSelect('task'); }),
        const SizedBox(height: 10),
        _TargetTile(icon: LucideIcons.alertTriangle, color: const Color(0xFFEF4444),
            title: 'Mangel', subtitle: 'An bestehenden Mangel anhängen oder neuen erstellen',
            onTap: () { HapticFeedback.selectionClick(); onSelect('defect'); }),
        const SizedBox(height: 10),
        _TargetTile(icon: LucideIcons.folderOpen, color: const Color(0xFFF59E0B),
            title: 'Projektdatei', subtitle: 'Direkt als Datei im Projekt speichern',
            onTap: () { HapticFeedback.selectionClick(); onSelect('file'); }),
      ]),
    );
  }
}

class _TargetTile extends StatelessWidget {
  final IconData icon; final Color color;
  final String title, subtitle; final VoidCallback onTap;
  const _TargetTile({required this.icon, required this.color, required this.title,
      required this.subtitle, required this.onTap});
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.20)),
      ),
      child: Row(children: [
        Container(width: 46, height: 46,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.14), shape: BoxShape.circle),
            child: Icon(icon, size: 22, color: color)),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: color)),
          const SizedBox(height: 3),
          Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        ])),
        Icon(LucideIcons.chevronRight, size: 18, color: color.withValues(alpha: 0.5)),
      ]),
    ),
  );
}

// ─── Step: pick item (task / defect) ─────────────────────────────────────────

class _StepPickItem extends StatefulWidget {
  final bool loading;
  final List<Map<String, dynamic>> items;
  final bool isDefect;
  final String search;
  final ValueChanged<String> onSearchChanged;
  final Future<void> Function(Map<String, dynamic>) onAttach;
  final Future<void> Function(String title, String desc, String priority) onCreateNew;
  const _StepPickItem({required this.loading, required this.items, required this.isDefect,
    required this.search, required this.onSearchChanged,
    required this.onAttach, required this.onCreateNew});
  @override State<_StepPickItem> createState() => _StepPickItemState();
}

class _StepPickItemState extends State<_StepPickItem> {
  bool _showCreate = false;
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _priority = 'medium';

  @override void dispose() { _titleCtrl.dispose(); _descCtrl.dispose(); super.dispose(); }

  List<Map<String, dynamic>> get _filtered {
    if (widget.search.isEmpty) return widget.items;
    final q = widget.search.toLowerCase();
    return widget.items.where((t) =>
        (t['title'] as String? ?? '').toLowerCase().contains(q)).toList();
  }

  Color _sc(String? s) {
    switch (s) {
      case 'done': case 'resolved': return AppColors.success;
      case 'in_progress': return AppColors.warning;
      case 'blocked': case 'rejected': return AppColors.danger;
      default: return AppColors.textTertiary;
    }
  }
  String _sl(String? s) {
    switch (s) {
      case 'done': return 'Erledigt'; case 'in_progress': return 'In Bearbeitung';
      case 'resolved': return 'Gelöst'; case 'blocked': return 'Blockiert';
      default: return 'Offen';
    }
  }

  @override
  Widget build(BuildContext context) {
    final typeLabel = widget.isDefect ? 'Mangel' : 'Aufgabe';
    if (_showCreate) return _buildCreateForm(typeLabel);
    return Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(20, 12, 20, 0), child: Column(children: [
        TextField(
          onChanged: widget.onSearchChanged,
          decoration: InputDecoration(
            hintText: '$typeLabel suchen…', isDense: true,
            prefixIcon: const Icon(LucideIcons.search, size: 16),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: AppColors.border)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: AppColors.border)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: AppColors.primary)),
            filled: true, fillColor: AppColors.background,
          ),
        ),
        const SizedBox(height: 10),
        GestureDetector(
          onTap: () => setState(() => _showCreate = true),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
            ),
            child: Row(children: [
              const Icon(LucideIcons.plus, size: 16, color: AppColors.primary),
              const SizedBox(width: 8),
              Text('Neue $typeLabel erstellen',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary)),
            ]),
          ),
        ),
        const SizedBox(height: 6),
      ])),
      Expanded(child: widget.loading
          ? const LottieLoader()
          : _filtered.isEmpty
              ? Padding(padding: const EdgeInsets.all(32), child: Center(
                  child: Text('Keine ${typeLabel}n gefunden',
                      style: const TextStyle(color: AppColors.textSecondary))))
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
                  itemCount: _filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 6),
                  itemBuilder: (_, i) {
                    final item = _filtered[i];
                    final sc = _sc(item['status'] as String?);
                    return InkWell(
                      onTap: () => widget.onAttach(item),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: AppColors.surface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.border)),
                        child: Row(children: [
                          Container(width: 8, height: 8,
                              decoration: BoxDecoration(color: sc, shape: BoxShape.circle)),
                          const SizedBox(width: 10),
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(item['title'] ?? '',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                                    color: AppColors.text),
                                maxLines: 1, overflow: TextOverflow.ellipsis),
                            Text(_sl(item['status'] as String?),
                                style: TextStyle(fontSize: 11, color: sc)),
                          ])),
                          const Icon(LucideIcons.paperclip, size: 14, color: AppColors.textTertiary),
                          const SizedBox(width: 4),
                          const Icon(LucideIcons.chevronRight, size: 14, color: AppColors.textTertiary),
                        ]),
                      ),
                    );
                  },
                )),
    ]);
  }

  Widget _buildCreateForm(String typeLabel) {
    final priorities = [
      ('low', 'Niedrig', const Color(0xFF10B981)),
      ('medium', 'Mittel', const Color(0xFF3B82F6)),
      ('high', 'Hoch', const Color(0xFFF97316)),
      ('critical', 'Kritisch', const Color(0xFFEF4444)),
    ];
    return SingleChildScrollView(
      padding: EdgeInsets.only(left: 20, right: 20, top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 32),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          GestureDetector(
            onTap: () => setState(() => _showCreate = false),
            child: Container(width: 32, height: 32,
              decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.border)),
              child: const Icon(LucideIcons.chevronLeft, size: 16, color: AppColors.text)),
          ),
          const SizedBox(width: 10),
          Text('Neue $typeLabel', style: const TextStyle(
              fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text)),
        ]),
        const SizedBox(height: 16),
        TextField(controller: _titleCtrl, decoration: InputDecoration(
          labelText: 'Titel *',
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          filled: true, fillColor: AppColors.background)),
        const SizedBox(height: 12),
        TextField(controller: _descCtrl, maxLines: 3, decoration: InputDecoration(
          labelText: 'Beschreibung',
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          filled: true, fillColor: AppColors.background)),
        const SizedBox(height: 16),
        const Text('Priorität', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text)),
        const SizedBox(height: 8),
        Row(children: priorities.map((pr) {
          final sel = _priority == pr.$1;
          return Expanded(child: GestureDetector(
            onTap: () => setState(() => _priority = pr.$1),
            child: Container(
              margin: EdgeInsets.only(right: pr.$1 == 'critical' ? 0 : 6),
              padding: const EdgeInsets.symmetric(vertical: 9),
              decoration: BoxDecoration(
                color: sel ? pr.$3 : pr.$3.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: sel ? pr.$3 : pr.$3.withValues(alpha: 0.3),
                    width: sel ? 2 : 1),
              ),
              child: Center(child: Text(pr.$2, style: TextStyle(
                  fontSize: 10, fontWeight: FontWeight.w600,
                  color: sel ? Colors.white : pr.$3))),
            ),
          ));
        }).toList()),
        const SizedBox(height: 20),
        SizedBox(width: double.infinity, child: _ActionBtn(
          label: '$typeLabel erstellen & anhängen',
          icon: LucideIcons.check, color: AppColors.primary,
          onTap: () {
            if (_titleCtrl.text.trim().isEmpty) return;
            widget.onCreateNew(_titleCtrl.text.trim(), _descCtrl.text.trim(), _priority);
          },
        )),
      ]),
    );
  }
}

// ─── Step: pick folder ────────────────────────────────────────────────────────

class _StepPickFolder extends StatelessWidget {
  final bool loading;
  final List<Map<String, dynamic>> folders;
  final Future<void> Function({String? folderId}) onSave;
  const _StepPickFolder({required this.loading, required this.folders, required this.onSave});

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(20, 16, 20, 8), child: Column(children: [
        const Text('Optional: Wähle einen Ordner oder speichere direkt im Projekt.',
            style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        const SizedBox(height: 12),
        SizedBox(width: double.infinity, child: _ActionBtn(
          label: 'Im Hauptverzeichnis speichern',
          icon: LucideIcons.hardDrive, color: AppColors.primary,
          onTap: () => onSave(),
        )),
        const SizedBox(height: 8),
      ])),
      if (loading)
        const LottieLoader()
      else if (folders.isNotEmpty)
        Expanded(child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
          itemCount: folders.length,
          separatorBuilder: (_, __) => const SizedBox(height: 6),
          itemBuilder: (_, i) {
            final folder = folders[i];
            return InkWell(
              onTap: () => onSave(folderId: folder['id'] as String),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border)),
                child: Row(children: [
                  const Icon(LucideIcons.folder, size: 18, color: Color(0xFFF59E0B)),
                  const SizedBox(width: 10),
                  Expanded(child: Text(folder['name'] ?? '',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600,
                          color: AppColors.text))),
                  const Icon(LucideIcons.chevronRight, size: 14, color: AppColors.textTertiary),
                ]),
              ),
            );
          },
        )),
    ]);
  }
}

// ─── Shared: Action button ────────────────────────────────────────────────────

class _ActionBtn extends StatelessWidget {
  final String label; final IconData icon; final Color color; final VoidCallback onTap;
  const _ActionBtn({required this.label, required this.icon, required this.color, required this.onTap});
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(14)),
      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(icon, size: 18, color: Colors.white),
        const SizedBox(width: 8),
        Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
      ]),
    ),
  );
}
