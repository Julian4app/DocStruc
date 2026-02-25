// ignore_for_file: use_build_context_synchronously
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:flutter_html/flutter_html.dart' hide Marker;
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:record/record.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../core/services/supabase_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/tablet_utils.dart';
import '../../../core/widgets/burger_menu_leading.dart';
import 'package:docstruc_mobile/core/widgets/lottie_loader.dart';

// ─── Rich Text Formatting ────────────────────────────────────────────────────

enum _FmtAction { bold, italic, bullet, numbered, h2, h3 }

class _RichTextEditor extends StatefulWidget {
  final TextEditingController controller;
  final String label;
  final int minLines;

  const _RichTextEditor({
    required this.controller,
    required this.label,
    this.minLines = 5,
  });

  @override
  State<_RichTextEditor> createState() => _RichTextEditorState();
}

class _RichTextEditorState extends State<_RichTextEditor> {
  final FocusNode _focusNode = FocusNode();
  OverlayEntry? _toolbarOverlay;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(_onFocusChange);
  }

  @override
  void dispose() {
    _removeToolbar();
    _focusNode.removeListener(_onFocusChange);
    _focusNode.dispose();
    super.dispose();
  }

  void _onFocusChange() {
    if (_focusNode.hasFocus) {
      _showToolbar();
    } else {
      _removeToolbar();
    }
  }

  void _showToolbar() {
    _removeToolbar();
    _toolbarOverlay = OverlayEntry(
      builder: (overlayContext) {
        return _KeyboardToolbarOverlay(
          onFormat: _applyFormat,
        );
      },
    );
    Overlay.of(context).insert(_toolbarOverlay!);
  }

  void _removeToolbar() {
    _toolbarOverlay?.remove();
    _toolbarOverlay = null;
  }

  void _applyFormat(_FmtAction action) {
    final ctrl = widget.controller;
    final text = ctrl.text;
    final sel = ctrl.selection;
    if (!sel.isValid) return;

    final selected = sel.textInside(text);
    String replacement;

    switch (action) {
      case _FmtAction.bold:
        replacement = '**$selected**';
        break;
      case _FmtAction.italic:
        replacement = '_${selected}_';
        break;
      case _FmtAction.bullet:
        if (selected.isEmpty) {
          replacement = '\n• ';
        } else {
          replacement = selected.split('\n').map((l) => '• $l').join('\n');
        }
        break;
      case _FmtAction.numbered:
        if (selected.isEmpty) {
          replacement = '\n1. ';
        } else {
          int idx = 1;
          replacement = selected.split('\n').map((l) => '${idx++}. $l').join('\n');
        }
        break;
      case _FmtAction.h2:
        replacement = '## $selected';
        break;
      case _FmtAction.h3:
        replacement = '### $selected';
        break;
    }

    final newText = text.replaceRange(sel.start, sel.end, replacement);
    ctrl.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: sel.start + replacement.length),
    );
  }

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: widget.controller,
      focusNode: _focusNode,
      minLines: widget.minLines,
      maxLines: null,
      style: const TextStyle(fontSize: 14, color: AppColors.text, height: 1.5),
      decoration: InputDecoration(
        hintText: 'Text eingeben…',
        hintStyle: const TextStyle(color: AppColors.textTertiary, fontSize: 13),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: AppColors.primary, width: 1.5),
        ),
        filled: true,
        fillColor: AppColors.surface,
      ),
    );
  }
}

/// Floating toolbar that sits directly above the keyboard.
class _KeyboardToolbarOverlay extends StatefulWidget {
  final void Function(_FmtAction) onFormat;
  const _KeyboardToolbarOverlay({required this.onFormat});

  @override
  State<_KeyboardToolbarOverlay> createState() => _KeyboardToolbarOverlayState();
}

class _KeyboardToolbarOverlayState extends State<_KeyboardToolbarOverlay> {
  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Positioned(
      left: 0,
      right: 0,
      bottom: bottom,
      child: Material(
        color: Colors.transparent,
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _ToolbarBtn(label: 'B', bold: true, onTap: () => widget.onFormat(_FmtAction.bold)),
                _ToolbarBtn(label: 'I', italic: true, onTap: () => widget.onFormat(_FmtAction.italic)),
                const _ToolbarDivider(),
                _ToolbarBtn(label: 'H2', onTap: () => widget.onFormat(_FmtAction.h2)),
                _ToolbarBtn(label: 'H3', onTap: () => widget.onFormat(_FmtAction.h3)),
                const _ToolbarDivider(),
                _ToolbarIconBtn(icon: LucideIcons.list, onTap: () => widget.onFormat(_FmtAction.bullet)),
                _ToolbarIconBtn(icon: LucideIcons.listOrdered, onTap: () => widget.onFormat(_FmtAction.numbered)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ToolbarBtn extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  final bool bold;
  final bool italic;

  const _ToolbarBtn({required this.label, required this.onTap, this.bold = false, this.italic = false});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 3),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: AppColors.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: bold ? FontWeight.w900 : FontWeight.w600,
            fontStyle: italic ? FontStyle.italic : FontStyle.normal,
            color: AppColors.text,
          ),
        ),
      ),
    );
  }
}

class _ToolbarIconBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _ToolbarIconBtn({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 3),
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: AppColors.border),
        ),
        child: Icon(icon, size: 15, color: AppColors.text),
      ),
    );
  }
}

class _ToolbarDivider extends StatelessWidget {
  const _ToolbarDivider();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1, height: 20,
      margin: const EdgeInsets.symmetric(horizontal: 6),
      color: AppColors.border,
    );
  }
}

// ─── Voice Recorder Sheet ─────────────────────────────────────────────────────

class _VoiceRecorderSheet extends StatefulWidget {
  final Future<void> Function(String filePath) onSave;
  const _VoiceRecorderSheet({required this.onSave});

  @override
  State<_VoiceRecorderSheet> createState() => _VoiceRecorderSheetState();
}

class _VoiceRecorderSheetState extends State<_VoiceRecorderSheet> {
  final _recorder = AudioRecorder();
  final _player = AudioPlayer();
  bool _isRecording = false;
  bool _hasRecording = false;
  bool _isPlaying = false;
  bool _isSaving = false;
  String? _recordedPath;
  int _seconds = 0;

  @override
  void initState() {
    super.initState();
    _player.playerStateStream.listen((state) {
      if (mounted) setState(() => _isPlaying = state.playing);
    });
  }

  @override
  void dispose() {
    _recorder.dispose();
    _player.dispose();
    super.dispose();
  }

  Future<void> _startRecording() async {
    final status = await Permission.microphone.request();
    if (status != PermissionStatus.granted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Mikrofon-Berechtigung erforderlich')),
        );
      }
      return;
    }
    final dir = await getTemporaryDirectory();
    final path = '${dir.path}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
    await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: path);
    setState(() { _isRecording = true; _recordedPath = path; _seconds = 0; });
    _tickTimer();
  }

  void _tickTimer() {
    Future.delayed(const Duration(seconds: 1), () {
      if (_isRecording && mounted) {
        setState(() => _seconds++);
        _tickTimer();
      }
    });
  }

  Future<void> _stopRecording() async {
    await _recorder.stop();
    setState(() { _isRecording = false; _hasRecording = true; });
  }

  Future<void> _playPause() async {
    if (_recordedPath == null) return;
    if (_isPlaying) {
      await _player.pause();
    } else {
      await _player.setFilePath(_recordedPath!);
      await _player.play();
    }
  }

  Future<void> _discard() async {
    await _player.stop();
    if (_recordedPath != null) {
      try { File(_recordedPath!).deleteSync(); } catch (_) {}
    }
    setState(() { _hasRecording = false; _recordedPath = null; _seconds = 0; });
  }

  String _fmtDuration(int s) =>
      '${(s ~/ 60).toString().padLeft(2, '0')}:${(s % 60).toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 40),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40, height: 4,
            decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(height: 20),
          const Text('Sprachnachricht aufnehmen',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
          const SizedBox(height: 32),
          Container(
            width: 120, height: 120,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _isRecording
                  ? const Color(0xFFEF4444).withValues(alpha: 0.1)
                  : AppColors.primary.withValues(alpha: 0.08),
              border: Border.all(
                color: _isRecording ? const Color(0xFFEF4444) : AppColors.primary,
                width: 2.5,
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  _isRecording ? LucideIcons.micOff : LucideIcons.mic,
                  size: 32,
                  color: _isRecording ? const Color(0xFFEF4444) : AppColors.primary,
                ),
                const SizedBox(height: 6),
                Text(_fmtDuration(_seconds),
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: _isRecording ? const Color(0xFFEF4444) : AppColors.text,
                    )),
              ],
            ),
          ),
          const SizedBox(height: 28),
          if (!_hasRecording && !_isRecording)
            _BigBtn(icon: LucideIcons.mic, label: 'Aufnahme starten', color: AppColors.primary, onTap: _startRecording),
          if (_isRecording)
            _BigBtn(icon: LucideIcons.square, label: 'Aufnahme stoppen', color: const Color(0xFFEF4444), onTap: _stopRecording),
          if (_hasRecording) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                GestureDetector(
                  onTap: _playPause,
                  child: Container(
                    width: 52, height: 52,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.primary.withValues(alpha: 0.1),
                      border: Border.all(color: AppColors.primary),
                    ),
                    child: Icon(_isPlaying ? LucideIcons.pause : LucideIcons.play, color: AppColors.primary, size: 22),
                  ),
                ),
                const SizedBox(width: 16),
                GestureDetector(
                  onTap: _discard,
                  child: Container(
                    width: 52, height: 52,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFFFEE2E2),
                      border: Border.all(color: const Color(0xFFEF4444)),
                    ),
                    child: const Icon(LucideIcons.trash2, color: Color(0xFFEF4444), size: 20),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _isSaving ? null : () async {
                  if (_recordedPath == null) return;
                  setState(() => _isSaving = true);
                  await widget.onSave(_recordedPath!);
                  if (mounted) Navigator.pop(context);
                },
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: _isSaving
                    ? const SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Speichern & Hochladen',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _BigBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _BigBtn({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.5)),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 10),
          Text(label, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: color)),
        ]),
      ),
    );
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

class ProjectGeneralInfoPage extends StatefulWidget {
  final String projectId;
  const ProjectGeneralInfoPage({super.key, required this.projectId});

  @override
  State<ProjectGeneralInfoPage> createState() => _ProjectGeneralInfoPageState();
}

class _ProjectGeneralInfoPageState extends State<ProjectGeneralInfoPage> {
  bool _loading = true;
  bool _isEditMode = false;
  bool _saving = false;
  bool _canEdit = false;

  Map<String, dynamic>? _project;
  Map<String, dynamic>? _projectInfo;
  List<Map<String, dynamic>> _images = [];
  List<Map<String, dynamic>> _voiceMessages = [];

  // Edit controllers — only for editable fields
  final _descCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  String? _startDate;
  String? _endDate;

  // Contact fields
  final _clientNameCtrl = TextEditingController();
  final _clientEmailCtrl = TextEditingController();
  final _clientPhoneCtrl = TextEditingController();

  bool _uploadingImage = false;

  final _player = AudioPlayer();
  String? _playingVoiceId;
  bool _isAudioPlaying = false;

  @override
  void initState() {
    super.initState();
    _load();
    _player.playerStateStream.listen((state) {
      if (mounted) {
        setState(() => _isAudioPlaying = state.playing);
        if (!state.playing && state.processingState == ProcessingState.completed) {
          setState(() => _playingVoiceId = null);
        }
      }
    });
  }

  @override
  void dispose() {
    _descCtrl.dispose();
    _notesCtrl.dispose();
    _clientNameCtrl.dispose();
    _clientEmailCtrl.dispose();
    _clientPhoneCtrl.dispose();
    _player.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loading = true);
    try {
      final uid = Supabase.instance.client.auth.currentUser?.id;
      final project = await SupabaseService.getProject(widget.projectId);
      final info = await SupabaseService.getProjectInfo(widget.projectId);
      List<Map<String, dynamic>> images = [];
      List<Map<String, dynamic>> voices = [];
      if (info != null) {
        final infoId = info['id'] as String?;
        if (infoId != null) {
          final r = await Future.wait([
            SupabaseService.getProjectInfoImages(infoId),
            SupabaseService.getProjectVoiceMessages(infoId),
          ]);
          images = r[0];
          voices = r[1];
        }
      }

      bool canEdit = false;
      if (uid != null && project != null) {
        if (project['owner_id'] == uid) {
          canEdit = true;
        } else {
          try {
            final member = await Supabase.instance.client
                .from('project_members')
                .select('id, role_id')
                .eq('project_id', widget.projectId)
                .eq('user_id', uid)
                .maybeSingle();
            if (member != null) {
              final perm = await Supabase.instance.client
                  .from('project_member_permissions')
                  .select('can_edit')
                  .eq('project_member_id', member['id'])
                  .eq('module_key', 'general_info')
                  .maybeSingle();
              if (perm != null) {
                canEdit = perm['can_edit'] == true;
              } else if (member['role_id'] != null) {
                final rp = await Supabase.instance.client
                    .from('role_permissions')
                    .select('can_edit')
                    .eq('role_id', member['role_id'])
                    .eq('module_key', 'general_info')
                    .maybeSingle();
                canEdit = rp?['can_edit'] == true;
              }
            }
          } catch (_) {}
        }
      }

      if (mounted) {
        setState(() {
          _project = project;
          _projectInfo = info;
          _images = images;
          _voiceMessages = voices;
          _canEdit = canEdit;
          _loading = false;
        });
      }

      // Geocode address if coords are missing
      if (info != null) {
        final lat = (info['latitude'] as num?)?.toDouble()
            ?? (project?['latitude'] as num?)?.toDouble();
        final lng = (info['longitude'] as num?)?.toDouble()
            ?? (project?['longitude'] as num?)?.toDouble();
        if (lat == null || lng == null) {
          await _geocodeAndStore(project, info);
        }
      }
    } catch (e) {
      debugPrint('[GeneralInfo] load error: $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Geocode the project address via Nominatim and persist coords to project_info.
  Future<void> _geocodeAndStore(
      Map<String, dynamic>? project, Map<String, dynamic> info) async {
    try {
      final street = project?['street']?.toString() ?? '';
      final zip = project?['zip']?.toString() ?? '';
      final city = project?['city']?.toString() ?? '';
      final country = project?['country']?.toString() ?? 'DE';
      final address = project?['address']?.toString() ?? '';

      // Build a query string from available fields
      final queryParts = <String>[];
      if (street.isNotEmpty) queryParts.add(street);
      if (zip.isNotEmpty) queryParts.add(zip);
      if (city.isNotEmpty) queryParts.add(city);
      if (country.isNotEmpty) queryParts.add(country);
      if (queryParts.isEmpty && address.isNotEmpty) queryParts.add(address);
      if (queryParts.isEmpty) return;

      final query = queryParts.join(', ');
      debugPrint('[GeneralInfo] geocoding: $query');

      final uri = Uri.https('nominatim.openstreetmap.org', '/search', {
        'q': query,
        'format': 'json',
        'limit': '1',
      });

      final client = HttpClient();
      client.userAgent = 'DocStruc/1.0 (contact@docstruc.app)';
      final request = await client.getUrl(uri);
      request.headers.set('Accept', 'application/json');
      final response = await request.close().timeout(const Duration(seconds: 8));
      final body = await response.transform(utf8.decoder).join();
      client.close();

      final List<dynamic> results = json.decode(body) as List<dynamic>;
      if (results.isNotEmpty) {
        final lat = double.tryParse(results[0]['lat']?.toString() ?? '');
        final lng = double.tryParse(results[0]['lon']?.toString() ?? '');
        if (lat != null && lng != null) {
          debugPrint('[GeneralInfo] geocoded to $lat, $lng');
          // Persist to project_info
          await Supabase.instance.client
              .from('project_info')
              .update({'latitude': lat, 'longitude': lng})
              .eq('id', info['id'] as String);
          // Update local state
          if (mounted) {
            setState(() {
              _projectInfo = {...info, 'latitude': lat, 'longitude': lng};
            });
          }
        }
      }
    } catch (e) {
      debugPrint('[GeneralInfo] geocode error: $e');
    }
  }


  void _enterEditMode() {
    _clientNameCtrl.text = _project?['client_name']?.toString() ?? '';
    _clientEmailCtrl.text = _project?['client_email']?.toString() ?? '';
    _clientPhoneCtrl.text = _project?['client_phone']?.toString() ?? '';
    _startDate = _project?['start_date']?.toString();
    _endDate = (_project?['target_end_date'] ?? _project?['end_date'])?.toString();
    _descCtrl.text = _rawMarkdown(_projectInfo?['detailed_description']);
    _notesCtrl.text = _rawMarkdown(_projectInfo?['notes']);
    setState(() => _isEditMode = true);
  }

  String _rawMarkdown(dynamic v) {
    if (v == null) return '';
    final s = v.toString();
    return s
        .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
        .replaceAll(RegExp(r'<p[^>]*>', caseSensitive: false), '')
        .replaceAll(RegExp(r'</p>', caseSensitive: false), '\n\n')
        .replaceAll(RegExp(r'<[^>]+>'), '')
        .trim();
  }

  String _markdownToHtml(String text) {
    if (text.trim().isEmpty) return '';
    final lines = text.split('\n');
    final buf = StringBuffer();
    for (final line in lines) {
      var l = line;
      if (l.startsWith('### ')) { buf.writeln('<h3>${l.substring(4)}</h3>'); continue; }
      if (l.startsWith('## '))  { buf.writeln('<h2>${l.substring(3)}</h2>'); continue; }
      if (l.startsWith('• ') || l.startsWith('- ')) {
        buf.writeln('<li>${_inlineFormat(l.substring(2))}</li>'); continue;
      }
      final numMatch = RegExp(r'^\d+\. (.+)').firstMatch(l);
      if (numMatch != null) { buf.writeln('<li>${_inlineFormat(numMatch.group(1)!)}</li>'); continue; }
      if (l.trim().isEmpty) { buf.writeln('<br>'); } else { buf.writeln('<p>${_inlineFormat(l)}</p>'); }
    }
    return buf.toString();
  }

  String _inlineFormat(String s) {
    return s
        .replaceAllMapped(RegExp(r'\*\*(.+?)\*\*'), (m) => '<strong>${m[1]}</strong>')
        .replaceAllMapped(RegExp(r'_(.+?)_'), (m) => '<em>${m[1]}</em>');
  }

  Future<void> _save() async {
    if (_project == null) return;
    setState(() => _saving = true);
    try {
      // Update dates (these columns exist)
      final projectUpdates = <String, dynamic>{};
      if (_startDate != null) projectUpdates['start_date'] = _startDate;
      if (_endDate != null) projectUpdates['target_end_date'] = _endDate;
      if (projectUpdates.isNotEmpty) {
        try {
          await Supabase.instance.client
              .from('projects')
              .update(projectUpdates)
              .eq('id', widget.projectId);
        } catch (_) {}
      }

      // Update project_info (description, notes)
      if (_projectInfo != null) {
        final desc = _markdownToHtml(_descCtrl.text);
        final notes = _markdownToHtml(_notesCtrl.text);
        await Supabase.instance.client
            .from('project_info')
            .update({
              'detailed_description': desc.isEmpty ? null : desc,
              'notes': notes.isEmpty ? null : notes,
            })
            .eq('id', _projectInfo!['id'] as String);
      }

      // Try contact fields — silently ignore if columns don't exist
      try {
        final cName = _clientNameCtrl.text.trim();
        final cEmail = _clientEmailCtrl.text.trim();
        final cPhone = _clientPhoneCtrl.text.trim();
        await Supabase.instance.client.from('projects').update({
          'client_name': cName.isEmpty ? null : cName,
          'client_email': cEmail.isEmpty ? null : cEmail,
          'client_phone': cPhone.isEmpty ? null : cPhone,
        }).eq('id', widget.projectId);
      } catch (_) {}

      if (mounted) {
        setState(() { _isEditMode = false; _saving = false; });
        _load();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✓ Gespeichert'),
            backgroundColor: AppColors.success,
            duration: Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      debugPrint('[GeneralInfo] save error: $e');
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Fehler beim Speichern: $e'),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _pickDate(bool isStart) async {
    final current = isStart ? _startDate : _endDate;
    final initial = DateTime.tryParse(current ?? '') ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(colorScheme: ColorScheme.light(primary: AppColors.primary)),
        child: child!,
      ),
    );
    if (picked != null && mounted) {
      setState(() {
        final s = picked.toIso8601String().substring(0, 10);
        if (isStart) _startDate = s; else _endDate = s;
      });
    }
  }

  // ── Image Upload ─────────────────────────────────────────────────────────

  Future<void> _pickAndUploadImage() async {
    if (_projectInfo == null) return;
    final infoId = _projectInfo!['id'] as String;
    final source = await _showImageSourceSheet();
    if (source == null) return;
    final picker = ImagePicker();
    final file = await picker.pickImage(source: source, imageQuality: 85);
    if (file == null) return;

    setState(() => _uploadingImage = true);
    try {
      final bytes = await file.readAsBytes();
      final ext = file.path.split('.').last;
      final uid = Supabase.instance.client.auth.currentUser?.id ?? 'anon';
      final path = '$uid/${widget.projectId}/${DateTime.now().millisecondsSinceEpoch}.$ext';
      await Supabase.instance.client.storage
          .from('project-info-images')
          .uploadBinary(path, bytes, fileOptions: FileOptions(contentType: 'image/$ext'));
      await Supabase.instance.client.from('project_info_images').insert({
        'project_info_id': infoId,
        'storage_path': path,
        'display_order': _images.length,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✓ Bild hochgeladen'), backgroundColor: AppColors.success, behavior: SnackBarBehavior.floating),
        );
        _load();
      }
    } catch (e) {
      debugPrint('[GeneralInfo] image upload error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Fehler beim Hochladen: $e'), backgroundColor: AppColors.danger, behavior: SnackBarBehavior.floating),
        );
      }
    } finally {
      if (mounted) setState(() => _uploadingImage = false);
    }
  }

  Future<ImageSource?> _showImageSourceSheet() async {
    return showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(width: 36, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(LucideIcons.camera, color: AppColors.primary),
              title: const Text('Kamera'),
              onTap: () => Navigator.pop(context, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(LucideIcons.image, color: AppColors.primary),
              title: const Text('Aus Galerie wählen'),
              onTap: () => Navigator.pop(context, ImageSource.gallery),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Future<void> _deleteImage(Map<String, dynamic> img) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Bild löschen?'),
        content: const Text('Dieses Bild wird dauerhaft gelöscht.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Abbrechen')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Löschen', style: TextStyle(color: Color(0xFFEF4444)))),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      final path = img['storage_path'] as String? ?? '';
      if (path.isNotEmpty) await Supabase.instance.client.storage.from('project-info-images').remove([path]);
      await Supabase.instance.client.from('project_info_images').delete().eq('id', img['id']);
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Fehler: $e'), backgroundColor: AppColors.danger));
    }
  }

  // ── Voice ────────────────────────────────────────────────────────────────

  Future<void> _showVoiceRecorder() async {
    if (_projectInfo == null) return;
    final infoId = _projectInfo!['id'] as String;
    await showAdaptiveSheet(
      context,
      isScrollControlled: true,
      builder: (_) => _VoiceRecorderSheet(
        onSave: (filePath) async {
          try {
            final bytes = await File(filePath).readAsBytes();
            final uid = Supabase.instance.client.auth.currentUser?.id ?? 'anon';
            final storagePath = '$uid/${widget.projectId}/${DateTime.now().millisecondsSinceEpoch}.m4a';
            await Supabase.instance.client.storage
                .from('project-voice-messages')
                .uploadBinary(storagePath, bytes, fileOptions: const FileOptions(contentType: 'audio/mp4'));
            final now = DateTime.now();
            final fileName = 'Aufnahme ${now.day}.${now.month}.${now.year}';
            await Supabase.instance.client.from('project_voice_messages').insert({
              'project_info_id': infoId,
              'file_name': fileName,
              'storage_path': storagePath,
            });
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('✓ Sprachnachricht gespeichert'), backgroundColor: AppColors.success, behavior: SnackBarBehavior.floating),
              );
              _load();
            }
          } catch (e) {
            if (mounted) ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Fehler: $e'), backgroundColor: AppColors.danger),
            );
          }
        },
      ),
    );
  }

  Future<void> _deleteVoiceMessage(Map<String, dynamic> vm) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Sprachnachricht löschen?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Abbrechen')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Löschen', style: TextStyle(color: Color(0xFFEF4444)))),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      final path = vm['storage_path'] as String? ?? '';
      if (path.isNotEmpty) await Supabase.instance.client.storage.from('project-voice-messages').remove([path]);
      await Supabase.instance.client.from('project_voice_messages').delete().eq('id', vm['id']);
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Fehler: $e'), backgroundColor: AppColors.danger));
    }
  }

  Future<void> _togglePlayVoice(Map<String, dynamic> vm) async {
    final id = vm['id'] as String;
    if (_playingVoiceId == id && _isAudioPlaying) {
      await _player.pause();
      setState(() => _playingVoiceId = null);
      return;
    }
    final path = vm['storage_path'] as String? ?? '';
    if (path.isEmpty) return;
    try {
      final url = SupabaseService.getVoiceMessageUrl(path);
      await _player.setUrl(url);
      await _player.play();
      setState(() => _playingVoiceId = id);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Wiedergabe fehlgeschlagen: $e')));
    }
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: burgerMenuLeading(context),
        title: const Text('Allgemeine Info'),
        titleTextStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text),
        actions: [
          if (!_loading && _canEdit && !_isEditMode)
            IconButton(
              onPressed: _enterEditMode,
              icon: const Icon(LucideIcons.edit2, size: 20),
              tooltip: 'Bearbeiten',
              style: IconButton.styleFrom(foregroundColor: AppColors.primary),
            ),
          if (_isEditMode) ...[
            IconButton(
              onPressed: _saving ? null : () => setState(() => _isEditMode = false),
              icon: const Icon(LucideIcons.x, size: 20),
              tooltip: 'Abbrechen',
              style: IconButton.styleFrom(foregroundColor: AppColors.textSecondary),
            ),
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: IconButton(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
                    : const Icon(LucideIcons.save, size: 20),
                tooltip: 'Speichern',
                style: IconButton.styleFrom(foregroundColor: AppColors.primary),
              ),
            ),
          ],
        ],
      ),
      body: _loading
          ? const LottieLoader()
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary,
              child: ListView(
                padding: EdgeInsets.fromLTRB(AppSpacing.screenH, 16, AppSpacing.screenH, 48),
                children: [
                  _buildProjectDetails(),
                  const SizedBox(height: 16),
                  _buildAddress(),
                  const SizedBox(height: 16),
                  _buildContact(),
                  const SizedBox(height: 16),
                  _buildTimeline(),
                  const SizedBox(height: 16),
                  _buildDescription(),
                  const SizedBox(height: 16),
                  _buildLocationCard(),
                  const SizedBox(height: 16),
                  _buildGallery(),
                  const SizedBox(height: 16),
                  _buildVoiceMessages(),
                  const SizedBox(height: 16),
                  _buildNotes(),
                  const SizedBox(height: 16),
                ],
              ),
            ),
    );
  }

  // ── Project Details (read-only) ───────────────────────────────────────────

  Widget _buildProjectDetails() {
    return _SectionCard(
      title: 'Projektdetails',
      icon: LucideIcons.building2,
      child: Column(
        children: [
          _infoRow('Projektname', _project?['name']?.toString() ?? '-', bold: true),
          _divider(),
          _infoRow('Status', _statusLabel(_project?['status']?.toString())),
          if ((_project?['project_number']) != null) ...[
            _divider(),
            _infoRow('Projektnummer', _project!['project_number'].toString()),
          ],
          if ((_project?['description']) != null) ...[
            _divider(),
            _infoRow('Kurzbeschreibung', _project!['description'].toString()),
          ],
        ],
      ),
    );
  }

  // ── Address (read-only) ───────────────────────────────────────────────────

  Widget _buildAddress() {
    final street = (_project?['street'] ?? _project?['address'] ?? '').toString();
    final houseNum = (_project?['house_number'] ?? '').toString();
    final streetFull = [street, houseNum].where((s) => s.isNotEmpty).join(' ');
    final zip = (_project?['zip_code'] ?? _project?['postal_code'] ?? '').toString();
    final city = (_project?['city'] ?? '').toString();
    final country = (_project?['country'] ?? 'Deutschland').toString();

    return _SectionCard(
      title: 'Adresse',
      icon: LucideIcons.mapPin,
      trailingWidget: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(6)),
        child: const Text('Nur Lesen',
            style: TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
      ),
      child: Column(
        children: [
          if (streetFull.isNotEmpty) _infoRow('Straße', streetFull),
          if (zip.isNotEmpty || city.isNotEmpty) ...[
            _divider(),
            _infoRow('PLZ / Stadt', [zip, city].where((s) => s.isNotEmpty).join(' ')),
          ],
          _divider(),
          _infoRow('Land', country),
        ],
      ),
    );
  }

  // ── Contact ───────────────────────────────────────────────────────────────

  Widget _buildContact() {
    if (_isEditMode) {
      return _EditCard(
        title: 'Kontakt',
        icon: LucideIcons.phone,
        children: [
          _editField('Bauherr / Auftraggeber', _clientNameCtrl),
          const SizedBox(height: 12),
          _editField('E-Mail', _clientEmailCtrl, keyboardType: TextInputType.emailAddress, prefixIcon: LucideIcons.mail),
          const SizedBox(height: 12),
          _editField('Telefon', _clientPhoneCtrl, keyboardType: TextInputType.phone, prefixIcon: LucideIcons.phone),
        ],
      );
    }
    return _SectionCard(
      title: 'Kontakt',
      icon: LucideIcons.phone,
      child: Column(
        children: [
          _infoRow('Bauherr', _project?['client_name']?.toString() ?? '-'),
          _divider(),
          _infoRow('E-Mail', _project?['client_email']?.toString() ?? '-'),
          _divider(),
          _infoRow('Telefon', _project?['client_phone']?.toString() ?? '-'),
        ],
      ),
    );
  }

  // ── Timeline ──────────────────────────────────────────────────────────────

  Widget _buildTimeline() {
    if (_isEditMode) {
      return _EditCard(
        title: 'Zeitrahmen',
        icon: LucideIcons.calendar,
        children: [
          _datePickerRow('Startdatum', _startDate, () => _pickDate(true)),
          const SizedBox(height: 12),
          _datePickerRow('Enddatum (geplant)', _endDate, () => _pickDate(false)),
        ],
      );
    }
    return _SectionCard(
      title: 'Zeitrahmen',
      icon: LucideIcons.calendar,
      child: Column(
        children: [
          _infoRow('Startdatum', _formatDate(_project?['start_date']?.toString())),
          _divider(),
          _infoRow('Enddatum', _formatDate((_project?['target_end_date'] ?? _project?['end_date'])?.toString())),
        ],
      ),
    );
  }

  // ── Description ───────────────────────────────────────────────────────────

  Widget _buildDescription() {
    final html = _projectInfo?['detailed_description']?.toString();
    if (_isEditMode) {
      return _EditCard(
        title: 'Detaillierte Beschreibung',
        icon: LucideIcons.fileText,
        children: [_RichTextEditor(controller: _descCtrl, label: 'Beschreibung', minLines: 6)],
      );
    }
    if (html == null || html.trim().isEmpty) {
      if (!_canEdit) return const SizedBox.shrink();
      return _SectionCard(
        title: 'Detaillierte Beschreibung',
        icon: LucideIcons.fileText,
        child: _emptyWithAction('Noch keine Beschreibung', LucideIcons.fileText, 'Hinzufügen', _enterEditMode),
      );
    }
    return _buildHtmlCard('Detaillierte Beschreibung', LucideIcons.fileText, html);
  }

  // ── Notes ─────────────────────────────────────────────────────────────────

  Widget _buildNotes() {
    final html = _projectInfo?['notes']?.toString();
    if (_isEditMode) {
      return _EditCard(
        title: 'Notizen',
        icon: LucideIcons.stickyNote,
        children: [_RichTextEditor(controller: _notesCtrl, label: 'Notizen', minLines: 5)],
      );
    }
    if (html == null || html.trim().isEmpty) {
      if (!_canEdit) return const SizedBox.shrink();
      return _SectionCard(
        title: 'Notizen',
        icon: LucideIcons.stickyNote,
        child: _emptyWithAction('Noch keine Notizen', LucideIcons.stickyNote, 'Hinzufügen', _enterEditMode),
      );
    }
    return _buildHtmlCard('Notizen', LucideIcons.stickyNote, html);
  }

  Widget _buildHtmlCard(String title, IconData icon, String html) {
    final isHtml = html.contains('<');
    final displayHtml = isHtml ? html : '<p>${html.replaceAll('\n', '<br>')}</p>';
    return _SectionCard(
      title: title,
      icon: icon,
      child: Html(
        data: displayHtml,
        style: {
          'body': Style(margin: Margins.zero, padding: HtmlPaddings.zero, fontSize: FontSize(14), color: AppColors.text, lineHeight: const LineHeight(1.6)),
          'p': Style(margin: Margins.only(bottom: 8)),
          'strong': Style(fontWeight: FontWeight.bold),
          'em': Style(fontStyle: FontStyle.italic),
          'h2': Style(fontSize: FontSize(17), fontWeight: FontWeight.bold, margin: Margins.only(bottom: 6, top: 8)),
          'h3': Style(fontSize: FontSize(15), fontWeight: FontWeight.bold, margin: Margins.only(bottom: 4, top: 6)),
          'li': Style(margin: Margins.only(bottom: 4)),
        },
      ),
    );
  }

  // ── Location card ─────────────────────────────────────────────────────────

  Widget _buildLocationCard() {
    final lat = (_projectInfo?['latitude'] as num?)?.toDouble()
        ?? (_project?['latitude'] as num?)?.toDouble();
    final lng = (_projectInfo?['longitude'] as num?)?.toDouble()
        ?? (_project?['longitude'] as num?)?.toDouble();
    final hasCoords = lat != null && lng != null;

    final address = (_projectInfo?['formatted_address'] ?? _project?['address'] ?? '').toString();
    final city = (_project?['city'] ?? '').toString();
    final fullAddress = [address, city].where((s) => s.isNotEmpty).join(', ');

    return _SectionCard(
      title: 'Standort & Karte',
      icon: LucideIcons.mapPin,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: hasCoords
                ? () => Navigator.push(context, MaterialPageRoute(builder: (_) => _FullscreenMapPage(lat: lat, lng: lng, title: fullAddress)))
                : null,
            child: Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: SizedBox(
                    height: 180, width: double.infinity,
                    child: hasCoords
                        ? _OpenStreetMap(lat: lat, lng: lng)
                        : _mapPlaceholder(fullAddress),
                  ),
                ),
                if (hasCoords)
                  Positioned(
                    top: 8, right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.55),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(LucideIcons.maximize2, size: 12, color: Colors.white),
                        SizedBox(width: 4),
                        Text('Vollbild', style: TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w600)),
                      ]),
                    ),
                  ),
              ],
            ),
          ),
          if (fullAddress.isNotEmpty) ...[
            const SizedBox(height: 12),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(LucideIcons.mapPin, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 6),
              Expanded(child: Text(fullAddress, style: const TextStyle(fontSize: 14, color: AppColors.text))),
            ]),
          ],
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () => _openMaps(hasCoords ? '$lat,$lng' : fullAddress),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.07),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(LucideIcons.navigation, size: 16, color: AppColors.primary),
                const SizedBox(width: 8),
                const Text('In Google Maps öffnen',
                    style: TextStyle(fontSize: 14, color: AppColors.primary, fontWeight: FontWeight.w600)),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _mapPlaceholder(String address) {
    return GestureDetector(
      onTap: address.isNotEmpty ? () => _openMaps(address) : null,
      child: Container(
        color: const Color(0xFFE2E8F0),
        child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(LucideIcons.map, size: 36, color: AppColors.textTertiary),
          const SizedBox(height: 8),
          Text(
            address.isNotEmpty ? 'Tippen um Karte zu öffnen' : 'Kein Standort hinterlegt',
            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
          ),
        ])),
      ),
    );
  }

  Future<void> _openMaps(String query) async {
    final uri = Uri.parse('https://maps.google.com/?q=${Uri.encodeComponent(query)}');
    if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  // ── Gallery ───────────────────────────────────────────────────────────────

  Widget _buildGallery() {
    return _SectionCard(
      title: 'Bildergalerie',
      icon: LucideIcons.image,
      trailingWidget: _canEdit
          ? GestureDetector(
              onTap: _uploadingImage ? null : _pickAndUploadImage,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: _uploadingImage
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
                    : Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(LucideIcons.plus, size: 14, color: AppColors.primary),
                        const SizedBox(width: 4),
                        const Text('Hinzufügen',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
                      ]),
              ),
            )
          : null,
      child: _images.isEmpty
          ? _canEdit
              ? _emptyWithAction('Noch keine Bilder', LucideIcons.image, 'Bild hinzufügen', _pickAndUploadImage)
              : _emptyState(LucideIcons.image, 'Noch keine Bilder vorhanden')
          : _ImageCarousel(
              images: _images,
              getImageUrl: SupabaseService.getProjectInfoImageUrl,
              canDelete: _canEdit,
              onDelete: _deleteImage,
            ),
    );
  }

  Widget _imgPlaceholder() => Container(
    color: AppColors.border,
    child: const Icon(LucideIcons.image, color: AppColors.textTertiary),
  );

  // ── Voice Messages ────────────────────────────────────────────────────────

  Widget _buildVoiceMessages() {
    return _SectionCard(
      title: 'Sprachnachrichten',
      icon: LucideIcons.mic,
      trailingWidget: _canEdit
          ? GestureDetector(
              onTap: _showVoiceRecorder,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(LucideIcons.mic, size: 14, color: AppColors.primary),
                  const SizedBox(width: 4),
                  const Text('Aufnehmen',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
                ]),
              ),
            )
          : null,
      child: _voiceMessages.isEmpty
          ? _canEdit
              ? _emptyWithAction('Noch keine Sprachnachrichten', LucideIcons.mic, 'Aufnahme starten', _showVoiceRecorder)
              : _emptyState(LucideIcons.mic, 'Noch keine Sprachnachrichten')
          : Column(
              children: _voiceMessages.map((vm) {
                final vmId = vm['id'] as String;
                final fileName = (vm['file_name']?.toString() ?? 'Aufnahme').replaceAll(RegExp(r'\.[^.]+$'), '');
                final transcription = vm['transcription']?.toString();
                final seconds = vm['duration_seconds'] as int?;
                final durLabel = seconds != null
                    ? '${(seconds ~/ 60).toString().padLeft(2, '0')}:${(seconds % 60).toString().padLeft(2, '0')}'
                    : null;
                final isPlayingThis = _playingVoiceId == vmId && _isAudioPlaying;

                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(children: [
                          GestureDetector(
                            onTap: () => _togglePlayVoice(vm),
                            child: Container(
                              width: 44, height: 44,
                              decoration: BoxDecoration(
                                color: AppColors.primary.withValues(alpha: 0.1),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                isPlayingThis ? LucideIcons.pause : LucideIcons.play,
                                size: 20, color: AppColors.primary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(fileName,
                                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text),
                                  maxLines: 1, overflow: TextOverflow.ellipsis),
                              if (durLabel != null)
                                Text(durLabel, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                            ],
                          )),
                          if (_canEdit)
                            IconButton(
                              icon: const Icon(LucideIcons.trash2, size: 16, color: Color(0xFFEF4444)),
                              onPressed: () => _deleteVoiceMessage(vm),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                            ),
                        ]),
                      ),
                      if (transcription != null && transcription.trim().isNotEmpty) ...[
                        const Divider(height: 1),
                        Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                const Icon(LucideIcons.fileText, size: 12, color: AppColors.primary),
                                const SizedBox(width: 6),
                                const Text('Transkription',
                                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary)),
                              ]),
                              const SizedBox(height: 6),
                              Text(transcription.trim(),
                                  style: const TextStyle(fontSize: 13, color: AppColors.text, height: 1.4)),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                );
              }).toList(),
            ),
    );
  }

  // ── Edit helpers ──────────────────────────────────────────────────────────

  Widget _editField(String label, TextEditingController ctrl, {TextInputType? keyboardType, IconData? prefixIcon}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
        const SizedBox(height: 6),
        TextFormField(
          controller: ctrl,
          keyboardType: keyboardType,
          style: const TextStyle(fontSize: 14, color: AppColors.text),
          decoration: InputDecoration(
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            prefixIcon: prefixIcon != null ? Icon(prefixIcon, size: 16, color: AppColors.textSecondary) : null,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: AppColors.primary, width: 1.5)),
            filled: true,
            fillColor: AppColors.background,
          ),
        ),
      ],
    );
  }

  Widget _datePickerRow(String label, String? value, VoidCallback onTap) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
            child: Row(children: [
              const Icon(LucideIcons.calendar, size: 16, color: AppColors.textSecondary),
              const SizedBox(width: 8),
              Text(
                value != null ? _formatDate(value) : 'Datum wählen',
                style: TextStyle(fontSize: 14, color: value != null ? AppColors.text : AppColors.textTertiary),
              ),
              const Spacer(),
              const Icon(LucideIcons.chevronRight, size: 16, color: AppColors.textTertiary),
            ]),
          ),
        ),
      ],
    );
  }

  // ── Generic helpers ───────────────────────────────────────────────────────

  Widget _infoRow(String label, String value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
          width: 120,
          child: Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
        ),
        Expanded(
          child: Text(value,
              style: TextStyle(fontSize: 14, color: AppColors.text, fontWeight: bold ? FontWeight.w600 : FontWeight.w400)),
        ),
      ]),
    );
  }

  Widget _divider() => const Divider(height: 1, color: Color(0xFFF1F5F9));

  Widget _emptyState(IconData icon, String message) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Center(child: Column(children: [
        Icon(icon, size: 32, color: AppColors.textTertiary),
        const SizedBox(height: 8),
        Text(message, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
      ])),
    );
  }

  Widget _emptyWithAction(String message, IconData icon, String actionLabel, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Icon(icon, size: 32, color: AppColors.textTertiary),
            const SizedBox(height: 8),
            Text(message, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            const SizedBox(height: 12),
            GestureDetector(
              onTap: onTap,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(LucideIcons.plus, size: 14, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Text(actionLabel, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary)),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _statusLabel(String? s) {
    if (s == null) return '-';
    const map = {
      'planning': 'In Planung', 'active': 'In Ausführung',
      'completed': 'Abgeschlossen', 'archived': 'Archiviert',
      'paused': 'Pausiert', 'cancelled': 'Abgebrochen',
    };
    return map[s.toLowerCase()] ?? s;
  }

  String _formatDate(String? d) {
    if (d == null) return '-';
    try {
      final dt = DateTime.parse(d);
      return '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}.${dt.year}';
    } catch (_) { return d; }
  }
}

// ─── Shared Widgets ──────────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget child;
  final Widget? trailingWidget;

  const _SectionCard({required this.title, required this.icon, required this.child, this.trailingWidget});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 12, 12),
            child: Row(children: [
              Icon(icon, size: 17, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.text)),
              const Spacer(),
              if (trailingWidget != null) trailingWidget!,
            ]),
          ),
          const Divider(height: 1),
          Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 16), child: child),
        ],
      ),
    );
  }
}

class _EditCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;

  const _EditCard({required this.title, required this.icon, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
        boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 14, 12),
            child: Row(children: [
              Icon(icon, size: 17, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.text)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
                child: const Text('Bearbeitung', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary)),
              ),
            ]),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
          ),
        ],
      ),
    );
  }
}

// ─── Map widget ───────────────────────────────────────────────────────────────

class _OpenStreetMap extends StatelessWidget {
  final double lat;
  final double lng;
  const _OpenStreetMap({required this.lat, required this.lng});

  @override
  Widget build(BuildContext context) {
    final center = LatLng(lat, lng);
    return FlutterMap(
      options: MapOptions(
        initialCenter: center,
        initialZoom: 15,
        interactionOptions: const InteractionOptions(flags: InteractiveFlag.none),
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.docstruc.mobile',
        ),
        MarkerLayer(markers: [
          Marker(
            point: center,
            width: 40, height: 40,
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.4), blurRadius: 8, offset: const Offset(0, 3))],
              ),
              child: const Icon(LucideIcons.mapPin, size: 20, color: Colors.white),
            ),
          ),
        ]),
      ],
    );
  }
}

// ─── Fullscreen map page ──────────────────────────────────────────────────────

class _FullscreenMapPage extends StatelessWidget {
  final double lat;
  final double lng;
  final String title;
  const _FullscreenMapPage({required this.lat, required this.lng, required this.title});

  @override
  Widget build(BuildContext context) {
    final center = LatLng(lat, lng);
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(title.isNotEmpty ? title : 'Karte', style: const TextStyle(fontSize: 15), overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.navigation),
            tooltip: 'In Google Maps öffnen',
            onPressed: () async {
              final uri = Uri.parse('https://maps.google.com/?q=${Uri.encodeComponent('$lat,$lng')}');
              if (await canLaunchUrl(uri)) launchUrl(uri, mode: LaunchMode.externalApplication);
            },
          ),
        ],
      ),
      body: FlutterMap(
        options: MapOptions(
          initialCenter: center,
          initialZoom: 15,
          interactionOptions: const InteractionOptions(flags: InteractiveFlag.all),
        ),
        children: [
          TileLayer(
            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            userAgentPackageName: 'com.docstruc.mobile',
          ),
          MarkerLayer(markers: [
            Marker(
              point: center,
              width: 44, height: 44,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.45), blurRadius: 10, offset: const Offset(0, 4))],
                ),
                child: const Icon(LucideIcons.mapPin, size: 22, color: Colors.white),
              ),
            ),
          ]),
        ],
      ),
    );
  }
}

// ─── Image Carousel Widget ────────────────────────────────────────────────────

class _ImageCarousel extends StatefulWidget {
  final List<Map<String, dynamic>> images;
  final String Function(String) getImageUrl;
  final bool canDelete;
  final Future<void> Function(Map<String, dynamic>) onDelete;

  const _ImageCarousel({
    required this.images,
    required this.getImageUrl,
    required this.canDelete,
    required this.onDelete,
  });

  @override
  State<_ImageCarousel> createState() => _ImageCarouselState();
}

class _ImageCarouselState extends State<_ImageCarousel> {
  late PageController _pageController;
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _goTo(int index) {
    _pageController.animateToPage(index,
        duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
  }

  void _openFullscreen(int index) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => _FullscreenGallery(
        images: widget.images,
        initialIndex: index,
        getImageUrl: widget.getImageUrl,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final images = widget.images;
    return Column(
      children: [
        // Main carousel area
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Stack(
            children: [
              SizedBox(
                height: 220,
                child: PageView.builder(
                  controller: _pageController,
                  itemCount: images.length,
                  onPageChanged: (i) => setState(() => _currentIndex = i),
                  itemBuilder: (ctx, i) {
                    final img = images[i];
                    final path = img['storage_path']?.toString() ?? '';
                    final url = path.isNotEmpty ? widget.getImageUrl(path) : '';
                    return GestureDetector(
                      onTap: () => _openFullscreen(i),
                      child: url.isNotEmpty
                          ? Image.network(
                              url,
                              fit: BoxFit.cover,
                              width: double.infinity,
                              errorBuilder: (_, __, ___) => Container(
                                color: AppColors.border,
                                child: const Icon(LucideIcons.image, color: AppColors.textTertiary, size: 48),
                              ),
                            )
                          : Container(color: AppColors.border, child: const Icon(LucideIcons.image, color: AppColors.textTertiary, size: 48)),
                    );
                  },
                ),
              ),
              // Prev / Next arrows
              if (images.length > 1) ...[
                Positioned(
                  left: 8, top: 0, bottom: 0,
                  child: Center(
                    child: GestureDetector(
                      onTap: () { if (_currentIndex > 0) _goTo(_currentIndex - 1); },
                      child: Container(
                        width: 34, height: 34,
                        decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.45), shape: BoxShape.circle),
                        child: const Icon(LucideIcons.chevronLeft, size: 18, color: Colors.white),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  right: 8, top: 0, bottom: 0,
                  child: Center(
                    child: GestureDetector(
                      onTap: () { if (_currentIndex < images.length - 1) _goTo(_currentIndex + 1); },
                      child: Container(
                        width: 34, height: 34,
                        decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.45), shape: BoxShape.circle),
                        child: const Icon(LucideIcons.chevronRight, size: 18, color: Colors.white),
                      ),
                    ),
                  ),
                ),
              ],
              // Counter badge
              Positioned(
                top: 10, right: 10,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(12)),
                  child: Text('${_currentIndex + 1} / ${images.length}',
                      style: const TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.w600)),
                ),
              ),
              // Zoom hint
              Positioned(
                bottom: 10, left: 10,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.45), borderRadius: BorderRadius.circular(12)),
                  child: const Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(LucideIcons.maximize2, size: 12, color: Colors.white),
                    SizedBox(width: 4),
                    Text('Tippen zum Vergrößern', style: TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w500)),
                  ]),
                ),
              ),
              // Caption
              if ((images[_currentIndex]['caption']?.toString() ?? '').isNotEmpty)
                Positioned(
                  bottom: 0, left: 0, right: 0,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(12, 20, 12, 10),
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter, end: Alignment.bottomCenter,
                        colors: [Colors.transparent, Colors.black54],
                      ),
                    ),
                    child: Text(
                      images[_currentIndex]['caption']!.toString(),
                      style: const TextStyle(fontSize: 12, color: Colors.white),
                      maxLines: 2, overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              // Delete button
              if (widget.canDelete)
                Positioned(
                  top: 10, left: 10,
                  child: GestureDetector(
                    onTap: () => widget.onDelete(images[_currentIndex]),
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(color: Colors.red.withValues(alpha: 0.8), shape: BoxShape.circle),
                      child: const Icon(LucideIcons.trash2, size: 14, color: Colors.white),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        // Dot indicators
        if (images.length > 1)
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(images.length, (i) => GestureDetector(
              onTap: () => _goTo(i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: i == _currentIndex ? 18 : 7,
                height: 7,
                decoration: BoxDecoration(
                  color: i == _currentIndex ? AppColors.primary : AppColors.border,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            )),
          ),
        const SizedBox(height: 10),
        // Thumbnail strip
        if (images.length > 1)
          SizedBox(
            height: 56,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: images.length,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (ctx, i) {
                final path = images[i]['storage_path']?.toString() ?? '';
                final url = path.isNotEmpty ? widget.getImageUrl(path) : '';
                final isActive = i == _currentIndex;
                return GestureDetector(
                  onTap: () => _goTo(i),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    width: 72,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isActive ? AppColors.primary : Colors.transparent,
                        width: 2,
                      ),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: Opacity(
                        opacity: isActive ? 1.0 : 0.55,
                        child: url.isNotEmpty
                            ? Image.network(url, fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(color: AppColors.border, child: const Icon(LucideIcons.image, size: 16, color: AppColors.textTertiary)))
                            : Container(color: AppColors.border),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}

// ─── Fullscreen Gallery ───────────────────────────────────────────────────────

class _FullscreenGallery extends StatefulWidget {
  final List<Map<String, dynamic>> images;
  final int initialIndex;
  final String Function(String) getImageUrl;

  const _FullscreenGallery({
    required this.images,
    required this.initialIndex,
    required this.getImageUrl,
  });

  @override
  State<_FullscreenGallery> createState() => _FullscreenGalleryState();
}

class _FullscreenGalleryState extends State<_FullscreenGallery> {
  late PageController _pageController;
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _goTo(int index) {
    _pageController.animateToPage(index,
        duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
  }

  @override
  Widget build(BuildContext context) {
    final images = widget.images;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(LucideIcons.x),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          '${_currentIndex + 1} / ${images.length}',
          style: const TextStyle(color: Colors.white, fontSize: 16),
        ),
        centerTitle: true,
      ),
      body: Stack(
        children: [
          PageView.builder(
            controller: _pageController,
            itemCount: images.length,
            onPageChanged: (i) => setState(() => _currentIndex = i),
            itemBuilder: (ctx, i) {
              final path = images[i]['storage_path']?.toString() ?? '';
              final url = path.isNotEmpty ? widget.getImageUrl(path) : '';
              return InteractiveViewer(
                minScale: 0.8,
                maxScale: 4.0,
                child: Center(
                  child: url.isNotEmpty
                      ? Image.network(url, fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => const Icon(LucideIcons.image, color: Colors.white54, size: 64))
                      : const Icon(LucideIcons.image, color: Colors.white54, size: 64),
                ),
              );
            },
          ),
          // Prev/Next
          if (images.length > 1) ...[
            Positioned(
              left: 8, top: 0, bottom: 0,
              child: Center(
                child: GestureDetector(
                  onTap: () { if (_currentIndex > 0) _goTo(_currentIndex - 1); },
                  child: Container(
                    width: 42, height: 42,
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), shape: BoxShape.circle),
                    child: const Icon(LucideIcons.chevronLeft, size: 22, color: Colors.white),
                  ),
                ),
              ),
            ),
            Positioned(
              right: 8, top: 0, bottom: 0,
              child: Center(
                child: GestureDetector(
                  onTap: () { if (_currentIndex < images.length - 1) _goTo(_currentIndex + 1); },
                  child: Container(
                    width: 42, height: 42,
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), shape: BoxShape.circle),
                    child: const Icon(LucideIcons.chevronRight, size: 22, color: Colors.white),
                  ),
                ),
              ),
            ),
          ],
          // Caption + thumbnail strip
          if ((images[_currentIndex]['caption']?.toString() ?? '').isNotEmpty || images.length > 1)
            Positioned(
              bottom: 0, left: 0, right: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter, end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.black87],
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if ((images[_currentIndex]['caption']?.toString() ?? '').isNotEmpty)
                      Text(
                        images[_currentIndex]['caption']!.toString(),
                        style: const TextStyle(color: Colors.white, fontSize: 14),
                        textAlign: TextAlign.center,
                      ),
                    if (images.length > 1) ...[
                      const SizedBox(height: 12),
                      SizedBox(
                        height: 52,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          shrinkWrap: true,
                          itemCount: images.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 6),
                          itemBuilder: (ctx, i) {
                            final path = images[i]['storage_path']?.toString() ?? '';
                            final url = path.isNotEmpty ? widget.getImageUrl(path) : '';
                            return GestureDetector(
                              onTap: () => _goTo(i),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 150),
                                width: 60,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: i == _currentIndex ? Colors.white : Colors.transparent, width: 2),
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(4),
                                  child: Opacity(
                                    opacity: i == _currentIndex ? 1.0 : 0.5,
                                    child: url.isNotEmpty
                                        ? Image.network(url, fit: BoxFit.cover)
                                        : Container(color: Colors.white24),
                                  ),
                                ),
                              ),
                            );
                          },
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