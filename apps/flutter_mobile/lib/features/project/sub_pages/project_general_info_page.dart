import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:flutter_html/flutter_html.dart' hide Marker;
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/services/supabase_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/burger_menu_leading.dart';

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

  // Edit form controllers
  final _notesCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _addrCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _clientNameCtrl = TextEditingController();
  final _clientEmailCtrl = TextEditingController();
  final _clientPhoneCtrl = TextEditingController();
  String? _startDate;
  String? _endDate;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    _descCtrl.dispose();
    _addrCtrl.dispose();
    _nameCtrl.dispose();
    _clientNameCtrl.dispose();
    _clientEmailCtrl.dispose();
    _clientPhoneCtrl.dispose();
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

      // Check edit permission: owner OR member with can_edit on general_info
      bool canEdit = false;
      if (uid != null && project != null) {
        if (project['owner_id'] == uid) {
          canEdit = true;
        } else {
          try {
            final member = await Supabase.instance.client
                .from('project_members')
                .select('id')
                .eq('project_id', widget.projectId)
                .eq('user_id', uid)
                .maybeSingle();
            if (member != null) {
              // Check custom permission for general_info
              final perm = await Supabase.instance.client
                  .from('project_member_permissions')
                  .select('can_edit')
                  .eq('project_member_id', member['id'])
                  .eq('module_key', 'general_info')
                  .maybeSingle();
              if (perm != null) {
                canEdit = perm['can_edit'] == true;
              } else {
                // Fall back to role default
                final memberFull = await Supabase.instance.client
                    .from('project_members')
                    .select('role_id')
                    .eq('id', member['id'])
                    .maybeSingle();
                if (memberFull?['role_id'] != null) {
                  final rp = await Supabase.instance.client
                      .from('role_permissions')
                      .select('can_edit')
                      .eq('role_id', memberFull!['role_id'])
                      .eq('module_key', 'general_info')
                      .maybeSingle();
                  canEdit = rp?['can_edit'] == true;
                }
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
    } catch (e) {
      debugPrint('[GeneralInfo] load error: \$e');
      if (mounted) setState(() => _loading = false);
    }
  }

  void _enterEditMode() {
    _nameCtrl.text = _project?['name'] ?? '';
    _clientNameCtrl.text = _project?['client_name'] ?? '';
    _clientEmailCtrl.text = _project?['client_email'] ?? '';
    _clientPhoneCtrl.text = _project?['client_phone'] ?? '';
    _startDate = _project?['start_date'];
    _endDate = _project?['end_date'];
    _descCtrl.text = _rawHtml(_projectInfo?['detailed_description']);
    _notesCtrl.text = _rawHtml(_projectInfo?['notes']);
    _addrCtrl.text = _projectInfo?['formatted_address'] ?? _project?['address'] ?? '';
    setState(() => _isEditMode = true);
  }

  String _rawHtml(dynamic v) {
    if (v == null) return '';
    final s = v.toString();
    // Strip HTML for plain text editing
    return s
        .replaceAll(RegExp(r'<br\s*/?>'), '\n')
        .replaceAll(RegExp(r'<p[^>]*>'), '')
        .replaceAll(RegExp(r'</p>'), '\n\n')
        .replaceAll(RegExp(r'<[^>]+>'), '')
        .trim();
  }

  Future<void> _save() async {
    if (_project == null) return;
    setState(() => _saving = true);
    try {
      // Update projects table
      await SupabaseService.updateProject(widget.projectId, {
        'name': _nameCtrl.text.trim(),
        'client_name': _clientNameCtrl.text.trim(),
        'client_email': _clientEmailCtrl.text.trim(),
        'client_phone': _clientPhoneCtrl.text.trim(),
        if (_startDate != null) 'start_date': _startDate,
        if (_endDate != null) 'end_date': _endDate,
      });
      // Update project_info table
      if (_projectInfo != null) {
        await Supabase.instance.client
            .from('project_info')
            .update({
              'detailed_description': _descCtrl.text.trim().isEmpty
                  ? null
                  : _descCtrl.text.trim(),
              'notes': _notesCtrl.text.trim().isEmpty
                  ? null
                  : _notesCtrl.text.trim(),
              'formatted_address': _addrCtrl.text.trim().isEmpty
                  ? null
                  : _addrCtrl.text.trim(),
            })
            .eq('id', _projectInfo!['id']);
      }
      if (mounted) {
        setState(() { _isEditMode = false; _saving = false; });
        _load();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Gespeichert'),
            backgroundColor: AppColors.success,
            duration: Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      debugPrint('[GeneralInfo] save error: \$e');
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Fehler beim Speichern: \$e'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _pickDate(bool isStart) async {
    final initial = DateTime.tryParse(isStart ? (_startDate ?? '') : (_endDate ?? '')) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null && mounted) {
      setState(() {
        final s = picked.toIso8601String().substring(0, 10);
        if (isStart) _startDate = s;
        else _endDate = s;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: burgerMenuLeading(context),
        title: const Text('Allgemeine Informationen'),
        actions: [
          if (!_loading && _canEdit && !_isEditMode)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: TextButton.icon(
                onPressed: _enterEditMode,
                icon: const Icon(LucideIcons.edit2, size: 16),
                label: const Text('Bearbeiten'),
                style: TextButton.styleFrom(foregroundColor: AppColors.primary),
              ),
            ),
          if (_isEditMode) ...[
            TextButton(
              onPressed: _saving ? null : () => setState(() => _isEditMode = false),
              child: const Text('Abbrechen',
                  style: TextStyle(color: AppColors.textSecondary)),
            ),
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: TextButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: AppColors.primary))
                    : const Icon(LucideIcons.save, size: 16),
                label: const Text('Speichern'),
                style: TextButton.styleFrom(foregroundColor: AppColors.primary),
              ),
            ),
          ],
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary,
              child: ListView(
                padding: EdgeInsets.fromLTRB(
                    AppSpacing.screenH, 16, AppSpacing.screenH, 32),
                children: [
                  // ── Projektdetails ──────────────────────────────────────
                  _isEditMode
                      ? _buildEditSection(
                          title: 'Projektdetails',
                          icon: LucideIcons.building2,
                          children: [
                            _editField('Projektname', _nameCtrl),
                            const SizedBox(height: 12),
                            _readOnlyRow('Status',
                                _statusLabel(_project?['status'])),
                          ],
                        )
                      : _InfoSection(
                          title: 'Projektdetails',
                          icon: LucideIcons.building2,
                          rows: [
                            _InfoRow('Projektname',
                                _project?['name'] ?? '-'),
                            _InfoRow('Status',
                                _statusLabel(_project?['status'])),
                            _InfoRow('Beschreibung',
                                _project?['description'] ?? '-'),
                          ],
                        ),
                  const SizedBox(height: 16),

                  // ── Adresse ─────────────────────────────────────────────
                  _InfoSection(
                    title: 'Adresse',
                    icon: LucideIcons.mapPin,
                    rows: [
                      _InfoRow('Straße',
                          _project?['address'] ?? _project?['street'] ?? '-'),
                      _InfoRow('PLZ',
                          _project?['zip_code'] ?? _project?['postal_code'] ?? '-'),
                      _InfoRow('Stadt', _project?['city'] ?? '-'),
                      _InfoRow('Land',
                          _project?['country'] ?? 'Deutschland'),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // ── Kontakt ─────────────────────────────────────────────
                  _isEditMode
                      ? _buildEditSection(
                          title: 'Kontakt',
                          icon: LucideIcons.phone,
                          children: [
                            _editField('Bauherr', _clientNameCtrl),
                            const SizedBox(height: 12),
                            _editField('E-Mail', _clientEmailCtrl,
                                keyboardType: TextInputType.emailAddress),
                            const SizedBox(height: 12),
                            _editField('Telefon', _clientPhoneCtrl,
                                keyboardType: TextInputType.phone),
                          ],
                        )
                      : _InfoSection(
                          title: 'Kontakt',
                          icon: LucideIcons.phone,
                          rows: [
                            _InfoRow('Bauherr',
                                _project?['client_name'] ?? '-'),
                            _InfoRow('E-Mail',
                                _project?['client_email'] ?? '-'),
                            _InfoRow('Telefon',
                                _project?['client_phone'] ?? '-'),
                          ],
                        ),
                  const SizedBox(height: 16),

                  // ── Zeitrahmen ──────────────────────────────────────────
                  _isEditMode
                      ? _buildEditSection(
                          title: 'Zeitrahmen',
                          icon: LucideIcons.calendar,
                          children: [
                            _datePickerRow('Startdatum', _startDate, () => _pickDate(true)),
                            const SizedBox(height: 12),
                            _datePickerRow('Enddatum', _endDate, () => _pickDate(false)),
                          ],
                        )
                      : _InfoSection(
                          title: 'Zeitrahmen',
                          icon: LucideIcons.calendar,
                          rows: [
                            _InfoRow('Startdatum',
                                _formatDate(_project?['start_date'])),
                            _InfoRow('Enddatum',
                                _formatDate(_project?['end_date'])),
                          ],
                        ),
                  const SizedBox(height: 16),

                  // ── Detaillierte Beschreibung ───────────────────────────
                  if (_isEditMode || _hasContent(_projectInfo?['detailed_description'])) ...[
                    _isEditMode
                        ? _buildEditSection(
                            title: 'Detaillierte Beschreibung',
                            icon: LucideIcons.fileText,
                            children: [
                              _editField('Beschreibung', _descCtrl,
                                  maxLines: 8),
                            ],
                          )
                        : _buildRichTextCard(
                            title: 'Detaillierte Beschreibung',
                            icon: LucideIcons.fileText,
                            html: _projectInfo!['detailed_description'] as String,
                          ),
                    const SizedBox(height: 16),
                  ],

                  // ── Standort & Karte ────────────────────────────────────
                  _isEditMode
                      ? _buildEditSection(
                          title: 'Standort & Karte',
                          icon: LucideIcons.mapPin,
                          children: [
                            _editField('Adresse / Standort', _addrCtrl),
                          ],
                        )
                      : _buildLocationCard(),
                  const SizedBox(height: 16),

                  // ── Bildergalerie ───────────────────────────────────────
                  _buildGallery(),
                  const SizedBox(height: 16),

                  // ── Sprachnachrichten ───────────────────────────────────
                  _buildVoiceMessages(),
                  const SizedBox(height: 16),

                  // ── Notizen ─────────────────────────────────────────────
                  if (_isEditMode || _hasContent(_projectInfo?['notes'])) ...[
                    _isEditMode
                        ? _buildEditSection(
                            title: 'Notizen',
                            icon: LucideIcons.stickyNote,
                            children: [
                              _editField('Notizen', _notesCtrl, maxLines: 6),
                            ],
                          )
                        : _buildRichTextCard(
                            title: 'Notizen',
                            icon: LucideIcons.stickyNote,
                            html: _projectInfo!['notes'] as String,
                          ),
                  ],
                ],
              ),
            ),
    );
  }

  // ── Edit helpers ──────────────────────────────────────────────────────────

  Widget _buildEditSection({
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(children: [
              Icon(icon, size: 18, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(title,
                  style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.text)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text('Bearbeitung',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary)),
              ),
            ]),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: children),
          ),
        ],
      ),
    );
  }

  Widget _editField(
    String label,
    TextEditingController ctrl, {
    int maxLines = 1,
    TextInputType? keyboardType,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary)),
        const SizedBox(height: 6),
        TextFormField(
          controller: ctrl,
          maxLines: maxLines,
          keyboardType: keyboardType,
          decoration: InputDecoration(
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(
                horizontal: 12, vertical: 10),
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
              borderSide:
                  const BorderSide(color: AppColors.primary, width: 1.5),
            ),
            filled: true,
            fillColor: AppColors.background,
          ),
          style: const TextStyle(fontSize: 14, color: AppColors.text),
        ),
      ],
    );
  }

  Widget _readOnlyRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 110,
          child: Text(label,
              style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500)),
        ),
        Expanded(
          child: Text(value,
              style: const TextStyle(fontSize: 14, color: AppColors.text)),
        ),
      ],
    );
  }

  Widget _datePickerRow(String label, String? value, VoidCallback onTap) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary)),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Icon(LucideIcons.calendar, size: 16, color: AppColors.textSecondary),
                const SizedBox(width: 8),
                Text(
                  value != null ? _formatDate(value) : 'Datum wählen',
                  style: TextStyle(
                      fontSize: 14,
                      color: value != null
                          ? AppColors.text
                          : AppColors.textTertiary),
                ),
                const Spacer(),
                const Icon(LucideIcons.chevronDown,
                    size: 16, color: AppColors.textTertiary),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ── Rich text card (HTML rendering) ───────────────────────────────────────
  Widget _buildRichTextCard({
    required String title,
    required IconData icon,
    required String html,
  }) {
    // Wrap plain text in a paragraph if no HTML tags detected
    final isHtml = html.contains('<');
    final displayHtml = isHtml ? html : '<p>${html.replaceAll('\n', '<br>')}</p>';
    return _SectionCard(
      title: title,
      icon: icon,
      child: Html(
        data: displayHtml,
        style: {
          'body': Style(
            margin: Margins.zero,
            padding: HtmlPaddings.zero,
            fontSize: FontSize(14),
            color: AppColors.text,
            lineHeight: const LineHeight(1.6),
          ),
          'p': Style(
            margin: Margins.only(bottom: 8),
          ),
          'strong': Style(fontWeight: FontWeight.bold),
          'b': Style(fontWeight: FontWeight.bold),
          'em': Style(fontStyle: FontStyle.italic),
          'i': Style(fontStyle: FontStyle.italic),
          'ul': Style(margin: Margins.only(left: 16, bottom: 8)),
          'ol': Style(margin: Margins.only(left: 16, bottom: 8)),
          'li': Style(margin: Margins.only(bottom: 4)),
          'h1': Style(
            fontSize: FontSize(20),
            fontWeight: FontWeight.bold,
            margin: Margins.only(bottom: 8),
          ),
          'h2': Style(
            fontSize: FontSize(18),
            fontWeight: FontWeight.bold,
            margin: Margins.only(bottom: 6),
          ),
          'h3': Style(
            fontSize: FontSize(16),
            fontWeight: FontWeight.bold,
            margin: Margins.only(bottom: 4),
          ),
        },
      ),
    );
  }

  // ── Standort & Karte ──────────────────────────────────────────────────────
  Widget _buildLocationCard() {
    final lat = (_projectInfo?['latitude'] as num?)?.toDouble() ??
        (_project?['latitude'] as num?)?.toDouble();
    final lng = (_projectInfo?['longitude'] as num?)?.toDouble() ??
        (_project?['longitude'] as num?)?.toDouble();
    final hasCoords = lat != null && lng != null;

    final address = _projectInfo?['formatted_address'] as String? ??
        _project?['address'] as String? ?? '';
    final city = _project?['city'] as String? ?? '';
    final fullAddress =
        [address, city].where((s) => s.isNotEmpty).join(', ');

    final mapQuery = hasCoords ? '\$lat,\$lng' : fullAddress;

    return _SectionCard(
      title: 'Standort & Karte',
      icon: LucideIcons.mapPin,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Map Preview ──────────────────────────────────────────────────
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              height: 200,
              width: double.infinity,
              child: hasCoords
                  ? _OpenStreetMap(lat: lat, lng: lng)
                  : GestureDetector(
                      onTap: fullAddress.isNotEmpty
                          ? () => _openMaps(fullAddress)
                          : null,
                      child: _mapPlaceholder(fullAddress),
                    ),
            ),
          ),
          const SizedBox(height: 12),
          if (fullAddress.isNotEmpty) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(LucideIcons.mapPin,
                    size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(fullAddress,
                      style: const TextStyle(
                          fontSize: 14, color: AppColors.text)),
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
          GestureDetector(
            onTap: () => _openMaps(mapQuery),
            child: Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                    color: AppColors.primary.withValues(alpha: 0.25)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.navigation,
                      size: 16, color: AppColors.primary),
                  const SizedBox(width: 8),
                  const Text('In Google Maps öffnen',
                      style: TextStyle(
                          fontSize: 14,
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _mapPlaceholder(String address) {
    return Container(
      color: const Color(0xFFE2E8F0),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(LucideIcons.map, size: 40, color: AppColors.textTertiary),
            const SizedBox(height: 8),
            Text(
              address.isNotEmpty
                  ? 'Tippen um Karte zu öffnen'
                  : 'Kein Standort hinterlegt',
              style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openMaps(String query) async {
    final uri = Uri.parse('https://maps.google.com/?q=${Uri.encodeComponent(query)}');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  // ── Bildergalerie ─────────────────────────────────────────────────────────
  Widget _buildGallery() {
    return _SectionCard(
      title: 'Bildergalerie',
      icon: LucideIcons.image,
      child: _images.isEmpty
          ? _emptyState(LucideIcons.image, 'Noch keine Bilder vorhanden')
          : GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
          childAspectRatio: 1.3,
        ),
        itemCount: _images.length,
        itemBuilder: (ctx, i) {
          final img = _images[i];
          final storagePath = img['storage_path'] as String? ?? '';
          final caption = img['caption'] as String?;
          final url = storagePath.isNotEmpty
              ? SupabaseService.getProjectInfoImageUrl(storagePath)
              : '';
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: url.isNotEmpty
                      ? Image.network(
                          url,
                          fit: BoxFit.cover,
                          width: double.infinity,
                          errorBuilder: (_, __, ___) => Container(
                            color: AppColors.border,
                            child: const Icon(LucideIcons.image,
                                color: AppColors.textTertiary),
                          ),
                        )
                      : Container(
                          color: AppColors.border,
                          child: const Icon(LucideIcons.image,
                              color: AppColors.textTertiary),
                        ),
                ),
              ),
              if (caption != null && caption.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(caption,
                      style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.textSecondary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                ),
            ],
          );
        },
      ),
    );
  }

  // ── Sprachnachrichten ─────────────────────────────────────────────────────
  Widget _buildVoiceMessages() {
    return _SectionCard(
      title: 'Sprachnachrichten mit Transkription',
      icon: LucideIcons.mic,
      child: _voiceMessages.isEmpty
          ? _emptyState(LucideIcons.mic, 'Noch keine Sprachnachrichten vorhanden')
          : Column(
        children: _voiceMessages.map((vm) {
          final fileName = vm['file_name'] as String? ?? 'Aufnahme';
          final transcription = vm['transcription'] as String?;
          final seconds = vm['duration_seconds'] as int?;
          final durLabel = seconds != null
              ? '${(seconds ~/ 60).toString().padLeft(2, '0')}:${(seconds % 60).toString().padLeft(2, '0')}'
              : null;
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(LucideIcons.mic, size: 18, color: AppColors.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        fileName.replaceAll(RegExp(r'\.[^.]+$'), ''),
                        style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.text),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (durLabel != null)
                        Text(durLabel,
                            style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary)),
                      if (transcription != null &&
                          transcription.trim().isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.05),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                                color: AppColors.primary.withValues(alpha: 0.15)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                Icon(LucideIcons.fileText,
                                    size: 12, color: AppColors.primary),
                                const SizedBox(width: 6),
                                const Text('Transkription',
                                    style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.primary)),
                              ]),
                              const SizedBox(height: 6),
                              Text(
                                transcription.trim(),
                                style: const TextStyle(
                                    fontSize: 13,
                                    color: AppColors.text,
                                    height: 1.4),
                              ),
                            ],
                          ),
                        ),
                      ],
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

  // ── Helpers ───────────────────────────────────────────────────────────────
  bool _hasContent(dynamic v) =>
      v != null && v.toString().trim().isNotEmpty;

  Widget _emptyState(IconData icon, String message) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Center(
        child: Column(children: [
          Icon(icon, size: 36, color: AppColors.textTertiary),
          const SizedBox(height: 10),
          Text(message,
              style: const TextStyle(
                  fontSize: 13, color: AppColors.textSecondary)),
        ]),
      ),
    );
  }

  String _statusLabel(String? s) {
    if (s == null) return '-';
    const knownGerman = {
      'Angefragt', 'In Planung', 'Genehmigt', 'In Ausführung',
      'Abgeschlossen', 'Pausiert', 'Abgebrochen', 'Nachbesserung',
    };
    if (knownGerman.contains(s)) return s;
    switch (s.toLowerCase()) {
      case 'planning':  return 'In Planung';
      case 'active':    return 'In Ausführung';
      case 'completed': return 'Abgeschlossen';
      case 'archived':  return 'Archiviert';
      default:          return s;
    }
  }

  String _formatDate(String? d) {
    if (d == null) return '-';
    try {
      final dt = DateTime.parse(d);
      return '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}.${dt.year}';
    } catch (_) {
      return d;
    }
  }
}

// ── OpenStreetMap widget ──────────────────────────────────────────────────────
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
        interactionOptions: const InteractionOptions(
          flags: InteractiveFlag.none, // static preview
        ),
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.docstruc.mobile',
        ),
        MarkerLayer(
          markers: [
            Marker(
              point: center,
              width: 40,
              height: 40,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.4),
                        blurRadius: 8,
                        offset: const Offset(0, 3))
                  ],
                ),
                child: const Icon(LucideIcons.mapPin,
                    size: 20, color: Colors.white),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ── Shared Section Widgets ────────────────────────────────────────────────────
class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget child;

  const _SectionCard({
    required this.title,
    required this.icon,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Row(children: [
              Icon(icon, size: 18, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(title,
                  style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.text)),
            ]),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: child,
          ),
        ],
      ),
    );
  }
}

class _InfoSection extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<_InfoRow> rows;

  const _InfoSection({
    required this.title,
    required this.icon,
    required this.rows,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Row(children: [
              Icon(icon, size: 18, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(title,
                  style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.text)),
            ]),
          ),
          const Divider(height: 1),
          ...rows.map((r) => Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 110,
                      child: Text(r.label,
                          style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w500)),
                    ),
                    Expanded(
                      child: Text(r.value,
                          style: const TextStyle(
                              fontSize: 14, color: AppColors.text)),
                    ),
                  ],
                ),
              )),
          const SizedBox(height: 4),
        ],
      ),
    );
  }
}

class _InfoRow {
  final String label;
  final String value;
  const _InfoRow(this.label, this.value);
}
