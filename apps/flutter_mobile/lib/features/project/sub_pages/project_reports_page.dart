import 'dart:io';
import 'dart:typed_data';

import 'package:archive/archive.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/services/supabase_service.dart';
import '../../../core/utils/tablet_utils.dart';
import '../../../core/widgets/burger_menu_leading.dart';
import '../../../core/widgets/lottie_loader.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Data models
// ─────────────────────────────────────────────────────────────────────────────

class _ReportTemplate {
  final String id;
  final String title;
  final String description;
  final IconData icon;

  const _ReportTemplate({
    required this.id,
    required this.title,
    required this.description,
    required this.icon,
  });
}

class _ProjectStats {
  final int totalTasks;
  final int completedTasks;
  final int totalDefects;
  final int teamMembers;

  const _ProjectStats({
    this.totalTasks = 0,
    this.completedTasks = 0,
    this.totalDefects = 0,
    this.teamMembers = 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Report templates (same 8 as web)
// ─────────────────────────────────────────────────────────────────────────────

const _reports = [
  _ReportTemplate(id: 'status',        title: 'Projektstatus-Report',     description: 'Gesamtübersicht über den Projektstatus',  icon: LucideIcons.barChart2),
  _ReportTemplate(id: 'tasks',         title: 'Aufgaben-Report',          description: 'Detaillierte Liste aller Aufgaben',        icon: LucideIcons.clipboardList),
  _ReportTemplate(id: 'defects',       title: 'Mängel-Report',            description: 'Übersicht aller Mängel',                   icon: LucideIcons.alertTriangle),
  _ReportTemplate(id: 'diary',         title: 'Bautagebuch-Export',       description: 'Komplettes Bautagebuch',                   icon: LucideIcons.bookOpen),
  _ReportTemplate(id: 'documentation', title: 'Projekt-Dokumentation',    description: 'Alle Notizen und Dokumente',               icon: LucideIcons.fileText),
  _ReportTemplate(id: 'participants',  title: 'Teilnehmer-Liste',         description: 'Alle Projektbeteiligten',                  icon: LucideIcons.users),
  _ReportTemplate(id: 'timeline',      title: 'Zeitplan & Meilensteine',  description: 'Terminübersicht',                          icon: LucideIcons.calendar),
  _ReportTemplate(id: 'complete',      title: 'Kompletter Projektbericht',description: 'Alle Daten zusammengefasst',               icon: LucideIcons.fileText),
];

// Reports that support an optional date-range filter
const _timeframeReports = {'diary', 'documentation', 'complete'};

// ─────────────────────────────────────────────────────────────────────────────
// Main page widget
// ─────────────────────────────────────────────────────────────────────────────

class ProjectReportsPage extends StatefulWidget {
  final String projectId;
  const ProjectReportsPage({super.key, required this.projectId});

  @override
  State<ProjectReportsPage> createState() => _ProjectReportsPageState();
}

class _ProjectReportsPageState extends State<ProjectReportsPage> {
  bool _loading = true;
  _ProjectStats _stats = const _ProjectStats();
  Map<String, dynamic>? _projectData;

  // Export sheet state
  _ReportTemplate? _selectedReport;
  String _exportFormat = 'pdf'; // 'pdf' | 'csv' | 'xlsx'
  String _exportTimeframe = 'all'; // 'all' | 'custom'
  DateTime? _startDate;
  DateTime? _endDate;
  bool _exporting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  // ── Load summary stats ─────────────────────────────────────────────────────

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loading = true);
    try {
      final tasks = await SupabaseService.client
          .from('tasks')
          .select('id, status, task_type')
          .eq('project_id', widget.projectId);
      final members = await SupabaseService.client
          .from('project_members')
          .select('id')
          .eq('project_id', widget.projectId);
      final project = await SupabaseService.client
          .from('projects')
          .select('*')
          .eq('id', widget.projectId)
          .maybeSingle();

      final taskList = List<Map<String, dynamic>>.from(tasks as Iterable);
      if (mounted) {
        setState(() {
          _stats = _ProjectStats(
            totalTasks:     taskList.where((t) => t['task_type'] != 'defect').length,
            completedTasks: taskList.where((t) => t['status'] == 'done' && t['task_type'] != 'defect').length,
            totalDefects:   taskList.where((t) => t['task_type'] == 'defect').length,
            teamMembers:    members.length,
          );
          _projectData = project;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        _showToast('Fehler beim Laden der Statistiken', isError: true);
      }
    }
  }

  // ── Export orchestration ────────────────────────────────────────────────────

  Future<void> _startExport() async {
    final report = _selectedReport;
    if (report == null) return;
    setState(() => _exporting = true);
    try {
      final data = await _fetchReportData(report.id);
      if (_exportFormat == 'pdf') {
        final bytes = await _buildPdf(report, data);
        await Printing.sharePdf(
          bytes: bytes,
          filename: '${report.title.replaceAll(' ', '_')}_${_dateStr(DateTime.now())}.pdf',
        );
      } else if (_exportFormat == 'xlsx') {
        final bytes = await _buildXlsx(report.id, data, reportTitle: report.title);
        final filename = '${report.title.replaceAll(' ', '_')}_${_dateStr(DateTime.now())}.xlsx';
        await _shareXlsx(bytes, filename);
      } else {
        final csv = _buildCsv(report.id, data);
        await _shareText(
          csv,
          filename: '${report.title.replaceAll(' ', '_')}_${_dateStr(DateTime.now())}.csv',
        );
      }
      if (mounted) {
        Navigator.of(context).pop(); // close sheet
        _showToast('Export erfolgreich!');
      }
    } catch (e) {
      if (mounted) _showToast('Fehler beim Exportieren: $e', isError: true);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  // ── Data fetchers ───────────────────────────────────────────────────────────

  List<Map<String, dynamic>> _applyTimeframe(List<Map<String, dynamic>> items) {
    if (_exportTimeframe != 'custom' || _startDate == null || _endDate == null) return items;
    final start = _startDate!.millisecondsSinceEpoch;
    final end   = _endDate!.add(const Duration(days: 1)).millisecondsSinceEpoch;
    return items.where((item) {
      final raw = item['entry_date'] ?? item['created_at'] ?? item['start_date'];
      if (raw == null) return false;
      final ms = DateTime.tryParse(raw.toString())?.millisecondsSinceEpoch ?? 0;
      return ms >= start && ms <= end;
    }).toList();
  }

  Future<Map<String, dynamic>> _fetchReportData(String id) async {
    switch (id) {
      case 'status':
      case 'complete':  return _fetchComplete();
      case 'tasks':     return _fetchTasks();
      case 'defects':   return _fetchDefects();
      case 'diary':     return _fetchDiary();
      case 'documentation': return _fetchDocumentation();
      case 'participants':  return _fetchParticipants();
      case 'timeline':  return _fetchTimeline();
      default: throw Exception('Unbekannter Report-Typ: $id');
    }
  }

  Future<Map<String, dynamic>> _fetchComplete() async {
    final tasks = await SupabaseService.client
        .from('tasks')
        .select('*, profiles!tasks_assigned_to_fkey(first_name, last_name, email)')
        .eq('project_id', widget.projectId)
        .order('created_at', ascending: false);
    final members = await SupabaseService.client
        .from('project_members')
        .select('*, profiles!project_members_user_id_fkey(first_name, last_name, email, phone)')
        .eq('project_id', widget.projectId);
    final diary = await SupabaseService.client
        .from('diary_entries')
        .select('*, profiles!diary_entries_created_by_fkey(first_name, last_name, email)')
        .eq('project_id', widget.projectId)
        .order('entry_date', ascending: false);
    final notes = await SupabaseService.client
        .from('project_messages')
        .select('*, profiles!project_messages_user_id_fkey(first_name, last_name, email)')
        .eq('project_id', widget.projectId)
        .eq('is_deleted', false)
        .order('created_at', ascending: false);
    final milestones = await SupabaseService.client
        .from('timeline_events')
        .select('*')
        .eq('project_id', widget.projectId)
        .order('start_date', ascending: true);
    return {
      'project':    _projectData,
      'tasks':      (tasks as List).cast<Map<String, dynamic>>(),
      'members':    (members as List).cast<Map<String, dynamic>>(),
      'diary':      _applyTimeframe((diary as List).cast<Map<String, dynamic>>()),
      'notes':      _applyTimeframe((notes as List).cast<Map<String, dynamic>>()),
      'milestones': (milestones as List).cast<Map<String, dynamic>>(),
    };
  }

  Future<Map<String, dynamic>> _fetchTasks() async {
    final data = await SupabaseService.client
        .from('tasks')
        .select('*, profiles!tasks_assigned_to_fkey(first_name, last_name, email)')
        .eq('project_id', widget.projectId)
        .eq('task_type', 'task')
        .order('created_at', ascending: false);
    return {'tasks': (data as List).cast<Map<String, dynamic>>()};
  }

  Future<Map<String, dynamic>> _fetchDefects() async {
    final data = await SupabaseService.client
        .from('tasks')
        .select('*, profiles!tasks_assigned_to_fkey(first_name, last_name, email)')
        .eq('project_id', widget.projectId)
        .eq('task_type', 'defect')
        .order('created_at', ascending: false);
    return {'defects': (data as List).cast<Map<String, dynamic>>()};
  }

  Future<Map<String, dynamic>> _fetchDiary() async {
    final data = await SupabaseService.client
        .from('diary_entries')
        .select('*, profiles!diary_entries_created_by_fkey(first_name, last_name, email)')
        .eq('project_id', widget.projectId)
        .order('entry_date', ascending: false);
    return {'entries': _applyTimeframe((data as List).cast<Map<String, dynamic>>())};
  }

  Future<Map<String, dynamic>> _fetchDocumentation() async {
    final data = await SupabaseService.client
        .from('project_messages')
        .select('*, profiles!project_messages_user_id_fkey(first_name, last_name, email)')
        .eq('project_id', widget.projectId)
        .eq('message_type', 'note')
        .eq('is_deleted', false)
        .order('created_at', ascending: false);
    return {'notes': _applyTimeframe((data as List).cast<Map<String, dynamic>>())};
  }

  Future<Map<String, dynamic>> _fetchParticipants() async {
    final data = await SupabaseService.client
        .from('project_members')
        .select('*, profiles!project_members_user_id_fkey(first_name, last_name, email, phone)')
        .eq('project_id', widget.projectId);
    return {'members': (data as List).cast<Map<String, dynamic>>()};
  }

  Future<Map<String, dynamic>> _fetchTimeline() async {
    final data = await SupabaseService.client
        .from('timeline_events')
        .select('*')
        .eq('project_id', widget.projectId)
        .order('start_date', ascending: true);
    return {'milestones': (data as List).cast<Map<String, dynamic>>()};
  }

  // ── PDF builder ─────────────────────────────────────────────────────────────

  Future<Uint8List> _buildPdf(_ReportTemplate report, Map<String, dynamic> data) async {
    final doc = pw.Document();
    final projName = (_projectData?['name'] ?? 'Projekt') as String;

    // Color palette (mirrors web)
    const navy   = PdfColor.fromInt(0xFF0E2A47);
    const slate  = PdfColor.fromInt(0xFF475569);
    const light  = PdfColor.fromInt(0xFFF8FAFC);
    const border = PdfColor.fromInt(0xFFE2E8F0);
    const amber  = PdfColor.fromInt(0xFFF59E0B);
    const green  = PdfColor.fromInt(0xFF059668);
    const blue   = PdfColor.fromInt(0xFF3B82F6);
    const red    = PdfColor.fromInt(0xFFDC2626);
    const muted  = PdfColor.fromInt(0xFF94A3B8);
    const textC  = PdfColor.fromInt(0xFF0F172A);

    // ── Header builder for every page ──
    pw.Widget buildPageHeader() => pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.stretch,
      children: [
        pw.Container(
          height: 42,
          color: navy,
          padding: const pw.EdgeInsets.symmetric(horizontal: 18),
          child: pw.Row(
            children: [
              pw.Container(
                width: 28, height: 28,
                decoration: pw.BoxDecoration(color: PdfColors.white, borderRadius: pw.BorderRadius.circular(4)),
                child: pw.Center(child: pw.Text('DS', style: pw.TextStyle(color: navy, fontWeight: pw.FontWeight.bold, fontSize: 13))),
              ),
              pw.SizedBox(width: 12),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                mainAxisAlignment: pw.MainAxisAlignment.center,
                children: [
                  pw.Text(report.title, style: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 14)),
                  pw.Text('$projName  ·  DocStruc Baudokumentation', style: pw.TextStyle(color: muted, fontSize: 8)),
                ],
              ),
              pw.Spacer(),
              pw.Text(
                'Exportiert am ${_fmtDT(DateTime.now().toIso8601String())}',
                style: pw.TextStyle(color: muted, fontSize: 8),
              ),
            ],
          ),
        ),
        pw.Container(height: 2.5, color: amber),
      ],
    );

    // ── Section title helper ──
    pw.Widget buildSection(String title) => pw.Container(
      margin: const pw.EdgeInsets.only(top: 14, bottom: 6),
      padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5),
      color: navy,
      child: pw.Text(title, style: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 11)),
    );

    // ── Table header row ──
    pw.Widget buildTableHeader(List<String> cols, List<double> flex) => pw.Container(
      color: const PdfColor.fromInt(0xFFF1F5F9),
      child: pw.Row(
        children: List.generate(cols.length, (i) => pw.Expanded(
          flex: (flex[i] * 100).round(),
          child: pw.Padding(
            padding: const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 5),
            child: pw.Text(cols[i], style: pw.TextStyle(color: slate, fontWeight: pw.FontWeight.bold, fontSize: 8)),
          ),
        )),
      ),
    );

    // ── Table data row ──
    pw.Widget buildTableRow(List<String> cells, List<double> flex, {bool shade = false}) => pw.Container(
      color: shade ? const PdfColor.fromInt(0xFFFAFBFC) : PdfColors.white,
      child: pw.Row(
        children: List.generate(cells.length, (i) => pw.Expanded(
          flex: (flex[i] * 100).round(),
          child: pw.Padding(
            padding: const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 5),
            child: pw.Text(cells[i], style: pw.TextStyle(color: textC, fontSize: 9), maxLines: 1, overflow: pw.TextOverflow.clip),
          ),
        )),
      ),
    );

    // ── Build page content ──
    final List<pw.Widget> content = [];

    switch (report.id) {
      case 'status':
      case 'complete': {
        final tasks   = (data['tasks']   as List? ?? []).cast<Map<String, dynamic>>();
        final members = (data['members'] as List? ?? []).cast<Map<String, dynamic>>();
        final milestones = (data['milestones'] as List? ?? []).cast<Map<String, dynamic>>();
        final taskItems   = tasks.where((t) => t['task_type'] != 'defect').toList();
        final defectItems = tasks.where((t) => t['task_type'] == 'defect').toList();
        final done = taskItems.where((t) => t['status'] == 'done').length;
        final progress = taskItems.isNotEmpty ? (done / taskItems.length * 100).round() : 0;

        // Stats strip
        content.add(pw.Row(children: [
          _statBox('Aufgaben',    '${taskItems.length}', blue),
          _statBox('Erledigt',   '$done',               green),
          _statBox('Mängel',     '${defectItems.length}',red),
          _statBox('Fortschritt','$progress%',           amber),
          _statBox('Team',       '${members.length}',    slate),
        ]));
        // Progress bar
        content.add(pw.SizedBox(height: 10));
        content.add(pw.Stack(children: [
          pw.Container(height: 6, decoration: pw.BoxDecoration(color: border, borderRadius: pw.BorderRadius.circular(3))),
          if (progress > 0)
            pw.Container(
              height: 6,
              width: (PdfPageFormat.a4.availableWidth - 36) * progress / 100,
              decoration: pw.BoxDecoration(color: green, borderRadius: pw.BorderRadius.circular(3)),
            ),
        ]));
        content.add(pw.SizedBox(height: 4));

        if (report.id == 'complete') {
          if (taskItems.isNotEmpty) {
            content.add(buildSection('Aufgaben (${taskItems.length})'));
            content.add(buildTableHeader(['Titel','Status','Priorität','Zugewiesen an','Fällig'], [0.33,0.14,0.13,0.22,0.18]));
            for (var i = 0; i < taskItems.length; i++) {
              final t = taskItems[i];
              content.add(buildTableRow([t['title']??'', _statusLabel(t['status']), _priorityLabel(t['priority']), _personName(t['profiles']), t['due_date'] != null ? _fmtD(t['due_date']) : '-'], [0.33,0.14,0.13,0.22,0.18], shade: i.isOdd));
            }
          }
          if (defectItems.isNotEmpty) {
            content.add(buildSection('Mängel (${defectItems.length})'));
            content.add(buildTableHeader(['Titel','Status','Priorität','Verantwortlich','Erstellt'], [0.33,0.14,0.13,0.22,0.18]));
            for (var i = 0; i < defectItems.length; i++) {
              final t = defectItems[i];
              content.add(buildTableRow([t['title']??'', _defectStatusLabel(t['status']), _priorityLabel(t['priority']), _personName(t['profiles']), _fmtD(t['created_at'])], [0.33,0.14,0.13,0.22,0.18], shade: i.isOdd));
            }
          }
          if (milestones.isNotEmpty) {
            content.add(buildSection('Meilensteine (${milestones.length})'));
            content.add(buildTableHeader(['Meilenstein','Beschreibung','Zeitraum','Typ'], [0.28,0.34,0.24,0.14]));
            for (var i = 0; i < milestones.length; i++) {
              final m = milestones[i];
              content.add(buildTableRow([m['title']??'', m['description']??'-', '${_fmtD(m['start_date'])}${m['end_date']!=null?" – ${_fmtD(m['end_date'])}":""}', _milestoneTypeLabel(m['event_type'])], [0.28,0.34,0.24,0.14], shade: i.isOdd));
            }
          }
          if (members.isNotEmpty) {
            content.add(buildSection('Team (${members.length})'));
            content.add(buildTableHeader(['Name','E-Mail','Telefon','Rolle'], [0.26,0.36,0.22,0.16]));
            for (var i = 0; i < members.length; i++) {
              final m = members[i];
              content.add(buildTableRow([_personName(m['profiles']), m['profiles']?['email']??'-', m['profiles']?['phone']??'-', m['role']??'Mitglied'], [0.26,0.36,0.22,0.16], shade: i.isOdd));
            }
          }
        }
        break;
      }

      case 'tasks': {
        final tasks = (data['tasks'] as List? ?? []).cast<Map<String, dynamic>>();
        content.add(buildSection('Aufgaben (${tasks.length})'));
        content.add(buildTableHeader(['Titel','Status','Priorität','Zugewiesen an','Fällig am'], [0.33,0.14,0.13,0.22,0.18]));
        for (var i = 0; i < tasks.length; i++) {
          final t = tasks[i];
          content.add(buildTableRow([t['title']??'', _statusLabel(t['status']), _priorityLabel(t['priority']), _personName(t['profiles']), t['due_date']!=null?_fmtD(t['due_date']):'-'], [0.33,0.14,0.13,0.22,0.18], shade: i.isOdd));
        }
        break;
      }

      case 'defects': {
        final defects = (data['defects'] as List? ?? []).cast<Map<String, dynamic>>();
        content.add(buildSection('Mängel (${defects.length})'));
        content.add(buildTableHeader(['Titel','Status','Priorität','Verantwortlich','Erstellt am'], [0.33,0.14,0.13,0.22,0.18]));
        for (var i = 0; i < defects.length; i++) {
          final t = defects[i];
          content.add(buildTableRow([t['title']??'', _defectStatusLabel(t['status']), _priorityLabel(t['priority']), _personName(t['profiles']), _fmtD(t['created_at'])], [0.33,0.14,0.13,0.22,0.18], shade: i.isOdd));
        }
        break;
      }

      case 'diary': {
        final entries = (data['entries'] as List? ?? []).cast<Map<String, dynamic>>();
        content.add(buildSection('Bautagebuch (${entries.length} Einträge)'));
        for (final entry in entries) {
          final creator = _personName(entry['profiles']);
          content.add(pw.SizedBox(height: 4));
          content.add(pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5),
            color: light,
            child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
              pw.Text(_fmtD(entry['entry_date']), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, color: navy, fontSize: 10)),
              pw.Text([
                if (entry['weather'] != null) entry['weather'],
                if (entry['temperature'] != null) '${entry['temperature']}°C',
                if (entry['workers_present'] != null) '${entry['workers_present']} Mitarb.',
              ].join(' · '), style: pw.TextStyle(color: slate, fontSize: 8)),
            ]),
          ));
          void field(String label, String? val) {
            if (val == null || val.isEmpty) return;
            content.add(pw.Padding(
              padding: const pw.EdgeInsets.only(left: 4, top: 3),
              child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                pw.Text(label.toUpperCase(), style: pw.TextStyle(color: muted, fontSize: 7, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 1),
                pw.Text(val, style: pw.TextStyle(color: textC, fontSize: 9)),
              ]),
            ));
          }
          field('Anwesende Mitarbeiter', entry['workers_list']);
          field('Durchgeführte Arbeiten', entry['work_performed']);
          field('Fortschrittsnotizen', entry['progress_notes']);
          field('Besondere Vorkommnisse', entry['special_events']);
          field('Lieferungen', entry['deliveries']);
          content.add(pw.Padding(
            padding: const pw.EdgeInsets.only(left: 4, top: 3),
            child: pw.Text('Erstellt von $creator  ·  ${_fmtDT(entry['created_at'])}', style: pw.TextStyle(color: muted, fontSize: 7.5, fontStyle: pw.FontStyle.italic)),
          ));
          content.add(pw.Divider(color: border, thickness: 0.3));
        }
        break;
      }

      case 'documentation': {
        final notes = (data['notes'] as List? ?? []).cast<Map<String, dynamic>>();
        content.add(buildSection('Notizen (${notes.length})'));
        for (var i = 0; i < notes.length; i++) {
          final note = notes[i];
          final stripped = (note['content'] as String? ?? '').replaceAll(RegExp(r'<[^>]+>'), ' ').replaceAll(RegExp(r'\s+'), ' ').trim();
          content.add(pw.Padding(
            padding: const pw.EdgeInsets.only(top: 6),
            child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Row(children: [
                pw.Text(_fmtDT(note['created_at']), style: pw.TextStyle(color: navy, fontWeight: pw.FontWeight.bold, fontSize: 9)),
                pw.Text('  ·  ${_personName(note['profiles'])}', style: pw.TextStyle(color: slate, fontSize: 9)),
              ]),
              pw.SizedBox(height: 3),
              pw.Text(stripped, style: pw.TextStyle(color: textC, fontSize: 9)),
              if (i < notes.length - 1) ...[
                pw.SizedBox(height: 4),
                pw.Divider(color: border, thickness: 0.3),
              ],
            ]),
          ));
        }
        break;
      }

      case 'participants': {
        final members = (data['members'] as List? ?? []).cast<Map<String, dynamic>>();
        content.add(buildSection('Teammitglieder (${members.length})'));
        content.add(buildTableHeader(['Name','E-Mail','Telefon','Rolle'], [0.26,0.36,0.22,0.16]));
        for (var i = 0; i < members.length; i++) {
          final m = members[i];
          content.add(buildTableRow([_personName(m['profiles']), m['profiles']?['email']??'-', m['profiles']?['phone']??'-', m['role']??'Mitglied'], [0.26,0.36,0.22,0.16], shade: i.isOdd));
        }
        break;
      }

      case 'timeline': {
        final milestones = (data['milestones'] as List? ?? []).cast<Map<String, dynamic>>();
        content.add(buildSection('Meilensteine (${milestones.length})'));
        content.add(buildTableHeader(['Meilenstein','Beschreibung','Zeitraum','Typ'], [0.28,0.34,0.24,0.14]));
        for (var i = 0; i < milestones.length; i++) {
          final m = milestones[i];
          content.add(buildTableRow([m['title']??'', m['description']??'-', '${_fmtD(m['start_date'])}${m['end_date']!=null?" – ${_fmtD(m['end_date'])}":""}', _milestoneTypeLabel(m['event_type'])], [0.28,0.34,0.24,0.14], shade: i.isOdd));
        }
        break;
      }
    }

    doc.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(18),
      header: (_) => buildPageHeader(),
      footer: (context) => pw.Align(
        alignment: pw.Alignment.center,
        child: pw.Text(
          'Seite ${context.pageNumber} von ${context.pagesCount}  ·  © ${DateTime.now().year} DocStruc',
          style: pw.TextStyle(color: muted, fontSize: 8),
        ),
      ),
      build: (_) => content,
    ));

    return doc.save();
  }

  // ── Static stat box for PDF ──────────────────────────────────────────────────

  static pw.Widget _statBox(String label, String value, PdfColor color) => pw.Expanded(
    child: pw.Container(
      margin: const pw.EdgeInsets.only(right: 4),
      padding: const pw.EdgeInsets.symmetric(vertical: 10),
      decoration: pw.BoxDecoration(
        color: const PdfColor.fromInt(0xFFF8FAFC),
        borderRadius: pw.BorderRadius.circular(6),
      ),
      child: pw.Column(children: [
        pw.Text(value, style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold, color: color)),
        pw.SizedBox(height: 2),
        pw.Text(label, style: pw.TextStyle(fontSize: 8, color: const PdfColor.fromInt(0xFF475569))),
      ]),
    ),
  );

  // ── CSV builder ──────────────────────────────────────────────────────────────

  String _buildCsv(String id, Map<String, dynamic> data) {
    switch (id) {
      case 'tasks': {
        final tasks = (data['tasks'] as List? ?? []).cast<Map<String, dynamic>>();
        return _toCsv(['Titel','Beschreibung','Status','Priorität','Zugewiesen','Fällig','Erstellt'],
          tasks.map((t) => [t['title']??'', t['description']??'', _statusLabel(t['status']), _priorityLabel(t['priority']), _personName(t['profiles']), t['due_date']!=null?_fmtD(t['due_date']):'', _fmtDT(t['created_at'])]).toList());
      }
      case 'defects': {
        final defects = (data['defects'] as List? ?? []).cast<Map<String, dynamic>>();
        return _toCsv(['Titel','Beschreibung','Status','Priorität','Zugewiesen','Erstellt'],
          defects.map((t) => [t['title']??'', t['description']??'', _defectStatusLabel(t['status']), _priorityLabel(t['priority']), _personName(t['profiles']), _fmtDT(t['created_at'])]).toList());
      }
      case 'diary': {
        final entries = (data['entries'] as List? ?? []).cast<Map<String, dynamic>>();
        return _toCsv(['Datum','Wetter','Temp','Mitarbeiter','Anwesende','Arbeiten','Fortschritt','Ereignisse','Lieferungen','Erstellt von','Erstellt am'],
          entries.map((e) => [_fmtD(e['entry_date']), e['weather']??'', e['temperature']!=null?'${e['temperature']}°C':'', e['workers_present']?.toString()??'', e['workers_list']??'', e['work_performed']??'', e['progress_notes']??'', e['special_events']??'', e['deliveries']??'', _personName(e['profiles']), _fmtDT(e['created_at'])]).toList());
      }
      case 'documentation': {
        final notes = (data['notes'] as List? ?? []).cast<Map<String, dynamic>>();
        return _toCsv(['Datum','Inhalt','Erstellt von'],
          notes.map((n) => [_fmtDT(n['created_at']), (n['content'] as String? ?? '').replaceAll(RegExp(r'<[^>]+>'), ' ').trim(), _personName(n['profiles'])]).toList());
      }
      case 'participants': {
        final members = (data['members'] as List? ?? []).cast<Map<String, dynamic>>();
        return _toCsv(['Name','E-Mail','Telefon','Rolle'],
          members.map((m) => [_personName(m['profiles']), m['profiles']?['email']??'', m['profiles']?['phone']??'', m['role']??'Mitglied']).toList());
      }
      case 'timeline': {
        final milestones = (data['milestones'] as List? ?? []).cast<Map<String, dynamic>>();
        return _toCsv(['Meilenstein','Beschreibung','Start','Ende','Typ'],
          milestones.map((m) => [m['title']??'', m['description']??'', m['start_date']!=null?_fmtD(m['start_date']):'', m['end_date']!=null?_fmtD(m['end_date']):'', _milestoneTypeLabel(m['event_type'])]).toList());
      }
      case 'status':
      case 'complete': {
        final tasks = (data['tasks'] as List? ?? []).cast<Map<String, dynamic>>();
        final members = (data['members'] as List? ?? []).cast<Map<String, dynamic>>();
        final milestones = (data['milestones'] as List? ?? []).cast<Map<String, dynamic>>();
        var csv = '=== PROJEKTSTATUS ===\n';
        csv += 'Aufgaben,${tasks.where((t) => t['task_type'] != 'defect').length}\n';
        csv += 'Erledigt,${tasks.where((t) => t['status'] == 'done' && t['task_type'] != 'defect').length}\n';
        csv += 'Mängel,${tasks.where((t) => t['task_type'] == 'defect').length}\n\n';
        csv += '=== AUFGABEN ===\n${_buildCsv('tasks', {'tasks': tasks.where((t) => t['task_type'] != 'defect').toList()})}\n\n';
        csv += '=== MÄNGEL ===\n${_buildCsv('defects', {'defects': tasks.where((t) => t['task_type'] == 'defect').toList()})}\n\n';
        csv += '=== MEILENSTEINE ===\n${_buildCsv('timeline', {'milestones': milestones})}\n\n';
        csv += '=== TEAM ===\n${_buildCsv('participants', {'members': members})}';
        return csv;
      }
      default: return '';
    }
  }

  String _toCsv(List<String> headers, List<List<dynamic>> rows) {
    final lines = [headers, ...rows].map((row) =>
      row.map((c) => '"${c.toString().replaceAll('"', '""')}"').join(','),
    );
    return '\uFEFF${lines.join('\n')}'; // BOM for Excel UTF-8
  }

  Future<void> _shareText(String content, {required String filename}) async {
    final bytes = Uint8List.fromList(content.codeUnits);
    await Printing.sharePdf(bytes: bytes, filename: filename); // reuses share sheet
  }

  /// Shares an xlsx file on all platforms.
  /// On iPad, [Share.shareXFiles] requires [sharePositionOrigin]; we compute a
  /// centred rect so the popover never crashes with "must be non-zero".
  Future<void> _shareXlsx(Uint8List bytes, String filename) async {
    // Capture screen size synchronously BEFORE any await
    Rect? origin;
    if (Platform.isIOS || Platform.isMacOS) {
      final size = MediaQuery.sizeOf(context);
      origin = Rect.fromCenter(
        center: Offset(size.width / 2, size.height / 2),
        width: 1,
        height: 1,
      );
    }

    // Write to temp file so every platform gets a real file path
    final dir  = await getTemporaryDirectory();
    final file = File('${dir.path}/$filename');
    await file.writeAsBytes(bytes, flush: true);

    await Share.shareXFiles(
      [XFile(file.path, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name: filename)],
      sharePositionOrigin: origin,
    );
  }

  // ── Excel (.xlsx) builder — styled with logo, column widths, navy header ────

  Future<Uint8List> _buildXlsx(
    String id,
    Map<String, dynamic> data, {
    required String reportTitle,
  }) async {
    // Load logo PNG from assets
    Uint8List? logoPng;
    try {
      final bd = await rootBundle.load('assets/images/Logo_DocStruc.png');
      logoPng = bd.buffer.asUint8List();
    } catch (_) {}

    final projectName = (_projectData?['name'] as String?) ?? '';

    // Collect named sheets with per-column widths
    // Each entry: { 'rows': List<List<String>>, 'widths': List<int> }
    final sheets = <String, Map<String, dynamic>>{};

    void addSheet(
      String name,
      List<String> headers,
      List<List<dynamic>> rows, {
      List<int>? colWidths,
    }) {
      final w = colWidths ?? List.filled(headers.length, 20);
      sheets[name] = {
        'rows': [
          headers,
          ...rows.map((r) => r.map((c) => c?.toString() ?? '').toList()),
        ],
        'widths': w,
      };
    }

    switch (id) {
      case 'tasks': {
        final tasks = (data['tasks'] as List? ?? []).cast<Map<String, dynamic>>();
        addSheet('Aufgaben',
          ['Titel','Beschreibung','Status','Priorität','Zugewiesen','Fällig','Erstellt'],
          tasks.map((t) => [t['title']??'', t['description']??'', _statusLabel(t['status']), _priorityLabel(t['priority']), _personName(t['profiles']), t['due_date']!=null?_fmtD(t['due_date']):'', _fmtDT(t['created_at'])]).toList(),
          colWidths: [40, 50, 16, 14, 28, 16, 22]);
        break;
      }
      case 'defects': {
        final defects = (data['defects'] as List? ?? []).cast<Map<String, dynamic>>();
        addSheet('Mängel',
          ['Titel','Beschreibung','Status','Priorität','Zugewiesen','Erstellt'],
          defects.map((t) => [t['title']??'', t['description']??'', _defectStatusLabel(t['status']), _priorityLabel(t['priority']), _personName(t['profiles']), _fmtDT(t['created_at'])]).toList(),
          colWidths: [40, 50, 16, 14, 28, 22]);
        break;
      }
      case 'diary': {
        final entries = (data['entries'] as List? ?? []).cast<Map<String, dynamic>>();
        addSheet('Bautagebuch',
          ['Datum','Wetter','Temp','Mitarbeiter','Anwesende','Arbeiten','Fortschritt','Ereignisse','Lieferungen','Erstellt von','Erstellt am'],
          entries.map((e) => [_fmtD(e['entry_date']), e['weather']??'', e['temperature']!=null?'${e['temperature']}°C':'', e['workers_present']?.toString()??'', e['workers_list']??'', e['work_performed']??'', e['progress_notes']??'', e['special_events']??'', e['deliveries']??'', _personName(e['profiles']), _fmtDT(e['created_at'])]).toList(),
          colWidths: [14,14,10,14,30,40,30,30,25,26,22]);
        break;
      }
      case 'documentation': {
        final notes = (data['notes'] as List? ?? []).cast<Map<String, dynamic>>();
        addSheet('Notizen',
          ['Datum','Inhalt','Erstellt von'],
          notes.map((n) => [_fmtDT(n['created_at']), (n['content'] as String? ?? '').replaceAll(RegExp(r'<[^>]+>'), ' ').trim(), _personName(n['profiles'])]).toList(),
          colWidths: [22, 80, 28]);
        break;
      }
      case 'participants': {
        final members = (data['members'] as List? ?? []).cast<Map<String, dynamic>>();
        addSheet('Team',
          ['Name','E-Mail','Telefon','Rolle'],
          members.map((m) => [_personName(m['profiles']), m['profiles']?['email']??'', m['profiles']?['phone']??'', m['role']??'Mitglied']).toList(),
          colWidths: [32, 38, 20, 18]);
        break;
      }
      case 'timeline': {
        final milestones = (data['milestones'] as List? ?? []).cast<Map<String, dynamic>>();
        addSheet('Meilensteine',
          ['Meilenstein','Beschreibung','Start','Ende','Typ'],
          milestones.map((m) => [m['title']??'', m['description']??'', m['start_date']!=null?_fmtD(m['start_date']):'', m['end_date']!=null?_fmtD(m['end_date']):'', _milestoneTypeLabel(m['event_type'])]).toList(),
          colWidths: [36, 50, 14, 14, 18]);
        break;
      }
      case 'status':
      case 'complete': {
        final tasks      = (data['tasks']      as List? ?? []).cast<Map<String, dynamic>>();
        final members    = (data['members']    as List? ?? []).cast<Map<String, dynamic>>();
        final milestones = (data['milestones'] as List? ?? []).cast<Map<String, dynamic>>();
        final taskItems   = tasks.where((t) => t['task_type'] != 'defect').toList();
        final defectItems = tasks.where((t) => t['task_type'] == 'defect').toList();
        addSheet('Aufgaben',    ['Titel','Status','Priorität','Zugewiesen','Fällig'],     taskItems.map((t)   => [t['title']??'', _statusLabel(t['status']), _priorityLabel(t['priority']), _personName(t['profiles']), t['due_date']!=null?_fmtD(t['due_date']):'']).toList(), colWidths: [44,16,14,28,14]);
        addSheet('Mängel',      ['Titel','Status','Priorität','Verantwortlich','Erstellt'], defectItems.map((t) => [t['title']??'', _defectStatusLabel(t['status']), _priorityLabel(t['priority']), _personName(t['profiles']), _fmtD(t['created_at'])]).toList(), colWidths: [44,16,14,28,14]);
        addSheet('Meilensteine',['Meilenstein','Beschreibung','Start','Ende','Typ'],        milestones.map((m)  => [m['title']??'', m['description']??'', m['start_date']!=null?_fmtD(m['start_date']):'', m['end_date']!=null?_fmtD(m['end_date']):'', _milestoneTypeLabel(m['event_type'])]).toList(), colWidths: [36,50,14,14,18]);
        addSheet('Team',        ['Name','E-Mail','Telefon','Rolle'],                         members.map((m)    => [_personName(m['profiles']), m['profiles']?['email']??'', m['profiles']?['phone']??'', m['role']??'Mitglied']).toList(), colWidths: [32,38,20,18]);
        break;
      }
    }

    return _sheetsToXlsx(
      sheets,
      reportTitle: reportTitle,
      projectName: projectName,
      logoPng: logoPng,
      exportDate: DateTime.now(),
    );
  }

  /// Builds a fully styled .xlsx from named sheets.
  /// Each sheet entry: `{ 'rows': List<List<String>>, 'widths': List<int> }`
  static Uint8List _sheetsToXlsx(
    Map<String, Map<String, dynamic>> sheets, {
    required String reportTitle,
    required String projectName,
    Uint8List? logoPng,
    required DateTime exportDate,
  }) {
    final sheetNames = sheets.keys.toList();

    // ── XML escape ──
    String esc(String s) => s
        .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

    // ── Shared strings ──
    final allStrings = <String>[];
    final stringIndex = <String, int>{};
    int si(String s) {
      if (stringIndex.containsKey(s)) return stringIndex[s]!;
      final idx = allStrings.length;
      allStrings.add(s); stringIndex[s] = idx;
      return idx;
    }
    // Pre-register all cell values (including cover rows added below)
    final coverTitle = 'DocStruc – $reportTitle';
    final coverSub   = projectName.isNotEmpty ? projectName : 'DocStruc Baudokumentation';
    final coverDate  = 'Exportiert am ${DateFormat('dd.MM.yyyy HH:mm').format(exportDate)}';
    si(coverTitle); si(coverSub); si(coverDate); si('');
    for (final sheetData in sheets.values) {
      for (final row in (sheetData['rows'] as List<List<String>>)) {
        for (final cell in row) { si(cell); }
      }
    }

    final sstXml = StringBuffer()
      ..write('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
      ..write('<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${allStrings.length}" uniqueCount="${allStrings.length}">');
    for (final s in allStrings) { sstXml.write('<si><t xml:space="preserve">${esc(s)}</t></si>'); }
    sstXml.write('</sst>');

    // ── Styles ──
    // Fill ids: 0=none, 1=gray125(required), 2=navy(header), 3=light-blue(cover), 4=alt-row
    // Font ids: 0=normal, 1=bold, 2=bold-white-14, 3=bold-white-11, 4=bold-navy-9
    // Border id: 0=none, 1=thin-all
    // Xf ids:
    //   0 = normal
    //   1 = bold header (navy bg, white bold, thin border, vcenter+wrapText)
    //   2 = data cell (thin border, vcenter+wrapText, alt=fill4)
    //   3 = data cell alt row (same + light fill)
    //   4 = cover title (light-blue bg, navy bold 14, vcenter)
    //   5 = cover sub (light-blue bg, navy normal 11, vcenter)
    const stylesXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      '<fonts count="5">'
        '<font><sz val="11"/><name val="Calibri"/><color rgb="FF0F172A"/></font>'
        '<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF0F172A"/></font>'
        '<font><b/><sz val="14"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>'
        '<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>'
        '<font><sz val="10"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>'
      '</fonts>'
      '<fills count="5">'
        '<fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FF0E2A47"/></patternFill></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FFE0EAF4"/></patternFill></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>'
      '</fills>'
      '<borders count="2">'
        '<border><left/><right/><top/><bottom/><diagonal/></border>'
        '<border>'
          '<left style="thin"><color rgb="FFCBD5E1"/></left>'
          '<right style="thin"><color rgb="FFCBD5E1"/></right>'
          '<top style="thin"><color rgb="FFCBD5E1"/></top>'
          '<bottom style="thin"><color rgb="FFCBD5E1"/></bottom>'
          '<diagonal/>'
        '</border>'
      '</borders>'
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
      '<cellXfs count="7">'
        // 0: normal
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>'
        // 1: header — navy bg, white bold, thin border
        '<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>'
        // 2: alt row fill
        '<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>'
        // 3: cover title — navy bg, white bold 14
        '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center" horizontal="left"/></xf>'
        // 4: cover subtitle — light-blue bg, navy normal
        '<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center" horizontal="left"/></xf>'
        // 5: cover date — light-blue bg, white small
        '<xf numFmtId="0" fontId="4" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center" horizontal="left"/></xf>'
        // 6: empty cover filler — navy bg
        '<xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/>'
      '</cellXfs>'
      '</styleSheet>';

    // ── Workbook ──
    final wb = StringBuffer()
      ..write('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
      ..write('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">')
      ..write('<sheets>');
    for (var i = 0; i < sheetNames.length; i++) {
      wb.write('<sheet name="${esc(sheetNames[i])}" sheetId="${i + 1}" r:id="rId${i + 1}"/>');
    }
    wb.write('</sheets></workbook>');

    // ── Workbook rels ──
    final wbRels = StringBuffer()
      ..write('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
      ..write('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">');
    for (var i = 0; i < sheetNames.length; i++) {
      wbRels.write('<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>');
    }
    wbRels.write('<Relationship Id="rId${sheetNames.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>');
    wbRels.write('<Relationship Id="rId${sheetNames.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>');
    wbRels.write('</Relationships>');

    // ── Sheet XMLs ──
    final colLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    String col(int c) => c < 26 ? colLetters[c] : '${colLetters[(c ~/ 26) - 1]}${colLetters[c % 26]}';

    // Logo anchor: placed in drawing1.xml over rows 1-3 of every sheet when logo present
    // We use a simple VML-free approach: xl/drawings/drawing1.xml with xdr:pic
    final bool hasLogo = logoPng != null;
    final sheetXmls   = <String>[];

    for (var sIdx = 0; sIdx < sheetNames.length; sIdx++) {
      final sheetData = sheets[sheetNames[sIdx]]!;
      final rows      = sheetData['rows']   as List<List<String>>;
      final widths    = sheetData['widths'] as List<int>;

      final sb = StringBuffer()
        ..write('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
        ..write('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
                ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">');

      // Column widths
      sb.write('<cols>');
      for (var c = 0; c < widths.length; c++) {
        sb.write('<col min="${c + 1}" max="${c + 1}" width="${widths[c]}" customWidth="1"/>');
      }
      sb.write('</cols>');

      sb.write('<sheetData>');

      // Cover rows (rows 1-3): title | subtitle | date  — spans all columns
      final spanMax = widths.length;
      // Row 1: title (navy bg, white bold 14)
      sb.write('<row r="1" ht="28" customHeight="1">');
      sb.write('<c r="A1" t="s" s="3"><v>${si(coverTitle)}</v></c>');
      for (var c = 1; c < spanMax; c++) { sb.write('<c r="${col(c)}1" s="6"/>'); }
      sb.write('</row>');
      // Row 2: project / subtitle
      sb.write('<row r="2" ht="18" customHeight="1">');
      sb.write('<c r="A2" t="s" s="4"><v>${si(coverSub)}</v></c>');
      for (var c = 1; c < spanMax; c++) { sb.write('<c r="${col(c)}2" s="4"/>'); }
      sb.write('</row>');
      // Row 3: export date
      sb.write('<row r="3" ht="16" customHeight="1">');
      sb.write('<c r="A3" t="s" s="5"><v>${si(coverDate)}</v></c>');
      for (var c = 1; c < spanMax; c++) { sb.write('<c r="${col(c)}3" s="6"/>'); }
      sb.write('</row>');
      // Row 4: empty spacer
      sb.write('<row r="4" ht="8" customHeight="1">');
      for (var c = 0; c < spanMax; c++) { sb.write('<c r="${col(c)}4" s="0"/>'); }
      sb.write('</row>');

      // Data rows start at row 5 (offset = 4)
      const rowOffset = 4;
      for (var r = 0; r < rows.length; r++) {
        final excelRow = r + 1 + rowOffset;
        final isHeader = r == 0;
        final isAlt    = !isHeader && r % 2 == 0; // alternate data rows
        final style    = isHeader ? 1 : (isAlt ? 2 : 0);
        sb.write('<row r="$excelRow" ht="${isHeader ? 20 : 16}" customHeight="1">');
        for (var c = 0; c < rows[r].length; c++) {
          final ref = '${col(c)}$excelRow';
          final idx = si(rows[r][c]);
          sb.write('<c r="$ref" t="s" s="$style"><v>$idx</v></c>');
        }
        sb.write('</row>');
      }

      sb.write('</sheetData>');

      // Freeze pane below header row
      sb.write('<sheetViews><sheetView workbookViewId="0">');
      sb.write('<pane ySplit="${rowOffset + 1}" topLeftCell="A${rowOffset + 2}" activePane="bottomLeft" state="frozenSplit"/>');
      sb.write('</sheetView></sheetViews>');

      // Merge cells for cover rows so title spans all columns
      if (spanMax > 1) {
        sb.write('<mergeCells count="4">');
        sb.write('<mergeCell ref="A1:${col(spanMax - 1)}1"/>');
        sb.write('<mergeCell ref="A2:${col(spanMax - 1)}2"/>');
        sb.write('<mergeCell ref="A3:${col(spanMax - 1)}3"/>');
        sb.write('<mergeCell ref="A4:${col(spanMax - 1)}4"/>');
        sb.write('</mergeCells>');
      }

      if (hasLogo) {
        sb.write('<drawing r:id="rId1"/>');
      }

      sb.write('</worksheet>');
      sheetXmls.add(sb.toString());
    }

    // ── Drawing XML (logo image) ──
    // Uses OOXML xdr:oneCellAnchor to place logo in top-right of cover area
    String? drawingXml;
    String? drawingRelsXml;
    if (hasLogo) {
      drawingXml =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"'
        ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
        ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<xdr:oneCellAnchor>'
          '<xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>'
          '<xdr:ext cx="1200000" cy="600000"/>'
          '<xdr:pic>'
            '<xdr:nvPicPr>'
              '<xdr:cNvPr id="2" name="DocStruc Logo"/>'
              '<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>'
            '</xdr:nvPicPr>'
            '<xdr:blipFill>'
              '<a:blip r:embed="rId1"/>'
              '<a:stretch><a:fillRect/></a:stretch>'
            '</xdr:blipFill>'
            '<xdr:spPr>'
              '<a:xfrm><a:off x="0" y="0"/><a:ext cx="1200000" cy="600000"/></a:xfrm>'
              '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
            '</xdr:spPr>'
          '</xdr:pic>'
        '<xdr:clientData/></xdr:oneCellAnchor>'
        '</xdr:wsDr>';

      drawingRelsXml =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.png"/>'
        '</Relationships>';
    }

    // ── Zip assembly ──
    final archive = Archive();

    void addXml(String path, String content) {
      final bytes = utf8Bytes(content);
      archive.addFile(ArchiveFile(path, bytes.length, bytes));
    }
    void addBin(String path, Uint8List bytes) {
      archive.addFile(ArchiveFile(path, bytes.length, bytes));
    }

    // Content types
    final ct = StringBuffer()
      ..write('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
      ..write('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">')
      ..write('<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>')
      ..write('<Default Extension="xml" ContentType="application/xml"/>')
      ..write('<Default Extension="png" ContentType="image/png"/>')
      ..write('<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>')
      ..write('<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>')
      ..write('<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>');
    for (var i = 0; i < sheetNames.length; i++) {
      ct.write('<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
    }
    if (hasLogo) {
      ct.write('<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>');
    }
    ct.write('</Types>');

    addXml('[Content_Types].xml', ct.toString());
    addXml('_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      '</Relationships>');
    addXml('xl/workbook.xml', wb.toString());
    addXml('xl/_rels/workbook.xml.rels', wbRels.toString());
    addXml('xl/sharedStrings.xml', sstXml.toString());
    addXml('xl/styles.xml', stylesXml);

    for (var i = 0; i < sheetXmls.length; i++) {
      addXml('xl/worksheets/sheet${i + 1}.xml', sheetXmls[i]);
    }

    if (hasLogo) {
      addBin('xl/media/logo.png', logoPng);
      addXml('xl/drawings/drawing1.xml', drawingXml!);
      // Each sheet that has a drawing needs its own rels file
      for (var i = 0; i < sheetNames.length; i++) {
        addXml('xl/worksheets/_rels/sheet${i + 1}.xml.rels', drawingRelsXml!);
      }
    }

    return Uint8List.fromList(ZipEncoder().encode(archive));
  }

  static List<int> utf8Bytes(String s) {
    final result = <int>[];
    for (final rune in s.runes) {
      if (rune < 0x80) {
        result.add(rune);
      } else if (rune < 0x800) {
        result.add(0xC0 | (rune >> 6));
        result.add(0x80 | (rune & 0x3F));
      } else if (rune < 0x10000) {
        result.add(0xE0 | (rune >> 12));
        result.add(0x80 | ((rune >> 6) & 0x3F));
        result.add(0x80 | (rune & 0x3F));
      } else {
        result.add(0xF0 | (rune >> 18));
        result.add(0x80 | ((rune >> 12) & 0x3F));
        result.add(0x80 | ((rune >> 6) & 0x3F));
        result.add(0x80 | (rune & 0x3F));
      }
    }
    return result;
  }

  // ── Format helpers ────────────────────────────────────────────────────────────

  static String _fmtD(dynamic s) {
    if (s == null) return '';
    final dt = DateTime.tryParse(s.toString());
    if (dt == null) return '';
    return DateFormat('dd.MM.yyyy').format(dt);
  }

  static String _fmtDT(dynamic s) {
    if (s == null) return '';
    final dt = DateTime.tryParse(s.toString());
    if (dt == null) return '';
    return DateFormat('dd.MM.yyyy HH:mm').format(dt);
  }

  static String _dateStr(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  static String _personName(dynamic p) {
    if (p == null) return '-';
    final m = p as Map<String, dynamic>;
    final name = '${m['first_name'] ?? ''} ${m['last_name'] ?? ''}'.trim();
    return name.isNotEmpty ? name : (m['email'] as String? ?? '-');
  }

  static String _statusLabel(dynamic s) => const {
    'done': 'Erledigt', 'in_progress': 'In Bearb.', 'blocked': 'Blockiert', 'open': 'Offen',
  }[s] ?? (s?.toString() ?? '-');

  static String _defectStatusLabel(dynamic s) => const {
    'done': 'Behoben', 'in_progress': 'In Bearb.', 'open': 'Offen',
  }[s] ?? (s?.toString() ?? '-');

  static String _priorityLabel(dynamic p) => const {
    'high': 'Hoch', 'medium': 'Mittel', 'low': 'Niedrig', 'critical': 'Kritisch',
  }[p] ?? (p?.toString() ?? '-');

  static String _milestoneTypeLabel(dynamic t) => const {
    'deadline': 'Deadline', 'meeting': 'Meeting', 'milestone': 'Meilenstein',
  }[t] ?? 'Meilenstein';

  // ── Toast helper ─────────────────────────────────────────────────────────────

  void _showToast(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: isError ? const Color(0xFFDC2626) : const Color(0xFF059668),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ));
  }

  // ── Export bottom sheet ────────────────────────────────────────────────────────

  void _openExportSheet(_ReportTemplate report) {
    setState(() {
      _selectedReport = report;
      _exportFormat   = 'pdf';
      _exportTimeframe = 'all';
      _startDate = null;
      _endDate   = null;
    });
    final tablet = isTablet(context);
    if (tablet) {
      showDialog(
        context: context,
        builder: (_) => _ExportDialog(
          report:   report,
          onExport: _startExport,
          state:    this,
        ),
      );
    } else {
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => _ExportSheet(
          report:   report,
          onExport: _startExport,
          state:    this,
        ),
      );
    }
  }

  // ── Build ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final tablet = isTablet(context);

    if (_loading) {
      return const Scaffold(body: LottieLoader());
    }

    final progress = _stats.totalTasks > 0
        ? _stats.completedTasks / _stats.totalTasks
        : 0.0;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: CustomScrollView(
        slivers: [
          // ── App bar ────────────────────────────────────────────────────
          SliverAppBar(
            backgroundColor: const Color(0xFFF8FAFC),
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            pinned: true,
            automaticallyImplyLeading: !tablet,
            leading: tablet ? null : burgerMenuLeading(context),
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text('Berichte & Exporte', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                Text('Reports, Auswertungen und Daten-Export', style: TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w400)),
              ],
            ),
            titleSpacing: tablet ? 20 : 0,
            toolbarHeight: 68,
          ),

          SliverPadding(
            padding: EdgeInsets.symmetric(horizontal: tablet ? 24 : 16, vertical: 8),
            sliver: SliverList(
              delegate: SliverChildListDelegate([

                // ── Stats card ─────────────────────────────────────────────
                _StatsCard(stats: _stats, progress: progress),
                const SizedBox(height: 24),

                // ── Reports section ────────────────────────────────────────
                const Text('Verfügbare Reports',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                const SizedBox(height: 14),

                // 2-column grid
                _ReportGrid(
                  reports: _reports,
                  onGenerate: _openExportSheet,
                ),
                const SizedBox(height: 32),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats card
// ─────────────────────────────────────────────────────────────────────────────

class _StatsCard extends StatelessWidget {
  final _ProjectStats stats;
  final double progress;
  const _StatsCard({required this.stats, required this.progress});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Projekt-Kennzahlen', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
          const SizedBox(height: 16),
          Row(children: [
            _statItem('${stats.totalTasks}',     'Aufgaben', const Color(0xFF3B82F6)),
            _statItem('${stats.completedTasks}', 'Erledigt', const Color(0xFF059668)),
            _statItem('${stats.totalDefects}',   'Mängel',   const Color(0xFFDC2626)),
            _statItem('${stats.teamMembers}',    'Team',     const Color(0xFF6366F1)),
          ]),
          const SizedBox(height: 16),
          const Text('Projektfortschritt', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF475569))),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: const Color(0xFFE2E8F0),
              valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF059668)),
              minHeight: 10,
            ),
          ),
          const SizedBox(height: 4),
          Align(
            alignment: Alignment.centerRight,
            child: Text('${(progress * 100).round()}%',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF059668))),
          ),
        ],
      ),
    );
  }

  Widget _statItem(String value, String label, Color color) => Expanded(
    child: Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(10)),
      child: Column(children: [
        Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
      ]),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Report grid (2-column wrap)
// ─────────────────────────────────────────────────────────────────────────────

class _ReportGrid extends StatelessWidget {
  final List<_ReportTemplate> reports;
  final void Function(_ReportTemplate) onGenerate;
  const _ReportGrid({required this.reports, required this.onGenerate});

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 380,
        mainAxisExtent: 188,
        crossAxisSpacing: 14,
        mainAxisSpacing: 14,
      ),
      itemCount: reports.length,
      itemBuilder: (_, i) => _ReportCard(report: reports[i], onGenerate: onGenerate),
    );
  }
}

class _ReportCard extends StatelessWidget {
  final _ReportTemplate report;
  final void Function(_ReportTemplate) onGenerate;
  const _ReportCard({required this.report, required this.onGenerate});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                width: 44, height: 44,
                decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(10)),
                child: Icon(report.icon, size: 22, color: const Color(0xFF3B82F6)),
              ),
              Row(children: [
                _badge('PDF',   const Color(0xFFDC2626)),
                const SizedBox(width: 4),
                _badge('CSV',   const Color(0xFF3B82F6)),
                const SizedBox(width: 4),
                _badge('XLSX',  const Color(0xFF059668)),
              ]),
            ],
          ),
          const SizedBox(height: 10),
          Text(report.title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)), maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 4),
          Text(report.description, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)), maxLines: 2, overflow: TextOverflow.ellipsis),
          const Spacer(),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => onGenerate(report),
              icon: const Icon(LucideIcons.download, size: 15),
              label: const Text('Generieren', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0EA5E9),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 9),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _badge(String text, Color bg) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(5)),
    child: Text(text, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white)),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export Dialog (tablet) — reads/writes parent state
// ─────────────────────────────────────────────────────────────────────────────

class _ExportDialog extends StatefulWidget {
  final _ReportTemplate report;
  final Future<void> Function() onExport;
  final _ProjectReportsPageState state;
  const _ExportDialog({required this.report, required this.onExport, required this.state});

  @override
  State<_ExportDialog> createState() => _ExportDialogState();
}

class _ExportDialogState extends State<_ExportDialog> {
  late String _format;
  late String _timeframe;
  late DateTime? _start;
  late DateTime? _end;

  @override
  void initState() {
    super.initState();
    _format    = widget.state._exportFormat;
    _timeframe = widget.state._exportTimeframe;
    _start     = widget.state._startDate;
    _end       = widget.state._endDate;
  }

  void _sync() {
    widget.state._exportFormat    = _format;
    widget.state._exportTimeframe = _timeframe;
    widget.state._startDate       = _start;
    widget.state._endDate         = _end;
  }

  bool get _canExport {
    if (_timeframe == 'custom' && (_start == null || _end == null)) return false;
    return !widget.state._exporting;
  }

  Future<void> _pickDate({required bool isStart}) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: (isStart ? _start : _end) ?? now,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
      locale: const Locale('de', 'DE'),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) { _start = picked; } else { _end = picked; }
      _sync();
    });
  }

  @override
  Widget build(BuildContext context) {
    final showTimeframe = _timeframeReports.contains(widget.report.id);
    final fmt = DateFormat('dd.MM.yyyy');

    return Dialog(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 120, vertical: 40),
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(10)),
                  child: Icon(widget.report.icon, size: 22, color: const Color(0xFF3B82F6)),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${widget.report.title} exportieren',
                          style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                      Text(widget.report.description,
                          style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(LucideIcons.x, size: 20, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
            const SizedBox(height: 24),
            const Divider(color: Color(0xFFF1F5F9)),
            const SizedBox(height: 20),

            // Format
            const Text('Format', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
            const SizedBox(height: 10),
            Row(children: [
              _fmtOption('pdf',  LucideIcons.fileText,        'PDF',  'Druckbares Dokument', const Color(0xFFDC2626)),
              const SizedBox(width: 10),
              _fmtOption('csv',  LucideIcons.fileSpreadsheet, 'CSV',  'Rohdaten (Text)',     const Color(0xFF3B82F6)),
              const SizedBox(width: 10),
              _fmtOption('xlsx', LucideIcons.fileSpreadsheet, 'XLSX', 'Excel-Arbeitsmappe',  const Color(0xFF059668)),
            ]),

            // Timeframe
            if (showTimeframe) ...[
              const SizedBox(height: 20),
              const Text('Zeitraum', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
              const SizedBox(height: 8),
              _timeframeOption('all',    'Gesamtes Projekt'),
              _timeframeOption('custom', 'Benutzerdefinierter Zeitraum'),
              if (_timeframe == 'custom') ...[
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(child: _datePicker('Von', _start != null ? fmt.format(_start!) : null, () => _pickDate(isStart: true))),
                  const SizedBox(width: 10),
                  Expanded(child: _datePicker('Bis', _end != null ? fmt.format(_end!) : null, () => _pickDate(isStart: false))),
                ]),
              ],
            ],

            const SizedBox(height: 28),

            // Actions
            Row(children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                  child: const Text('Abbrechen', style: TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF475569), fontSize: 15)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed: _canExport ? widget.onExport : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0EA5E9),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    elevation: 0,
                  ),
                  child: widget.state._exporting
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          Icon(LucideIcons.download, size: 17),
                          SizedBox(width: 8),
                          Text('Exportieren', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                        ]),
                ),
              ),
            ]),
          ],
        ),
      ),
    );
  }

  Widget _fmtOption(String value, IconData icon, String label, String desc, Color badgeColor) {
    final active = _format == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() { _format = value; _sync(); }),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
          decoration: BoxDecoration(
            color: active ? const Color(0xFFEFF6FF) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: active ? const Color(0xFF0EA5E9) : const Color(0xFFE2E8F0), width: active ? 2 : 1),
          ),
          child: Column(children: [
            Icon(icon, size: 26, color: active ? const Color(0xFF0EA5E9) : const Color(0xFF64748B)),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(color: badgeColor, borderRadius: BorderRadius.circular(4)),
              child: Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
            ),
            const SizedBox(height: 5),
            Text(desc, style: TextStyle(fontSize: 11, color: active ? const Color(0xFF0EA5E9) : const Color(0xFF94A3B8)), textAlign: TextAlign.center, maxLines: 2),
          ]),
        ),
      ),
    );
  }

  Widget _timeframeOption(String value, String label) {
    final active = _timeframe == value;
    return GestureDetector(
      onTap: () => setState(() { _timeframe = value; _sync(); }),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(children: [
          Container(
            width: 20, height: 20,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: active ? const Color(0xFF0EA5E9) : const Color(0xFF94A3B8), width: 2),
            ),
            child: active
                ? Center(child: Container(width: 10, height: 10, decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFF0EA5E9))))
                : null,
          ),
          const SizedBox(width: 10),
          Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600,
              color: active ? const Color(0xFF0F172A) : const Color(0xFF475569))),
        ]),
      ),
    );
  }

  Widget _datePicker(String label, String? value, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(children: [
          const Icon(LucideIcons.calendar, size: 16, color: Color(0xFF94A3B8)),
          const SizedBox(width: 8),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600)),
            Text(value ?? 'TT.MM.JJJJ', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                color: value != null ? const Color(0xFF0F172A) : const Color(0xFFCBD5E1))),
          ]),
        ]),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export bottom sheet (stateful — reads/writes parent state)
// ─────────────────────────────────────────────────────────────────────────────

class _ExportSheet extends StatefulWidget {
  final _ReportTemplate report;
  final Future<void> Function() onExport;
  final _ProjectReportsPageState state;
  const _ExportSheet({required this.report, required this.onExport, required this.state});

  @override
  State<_ExportSheet> createState() => _ExportSheetState();
}

class _ExportSheetState extends State<_ExportSheet> {
  late String _format;
  late String _timeframe;
  late DateTime? _start;
  late DateTime? _end;

  @override
  void initState() {
    super.initState();
    _format    = widget.state._exportFormat;
    _timeframe = widget.state._exportTimeframe;
    _start     = widget.state._startDate;
    _end       = widget.state._endDate;
  }

  void _sync() {
    widget.state._exportFormat    = _format;
    widget.state._exportTimeframe = _timeframe;
    widget.state._startDate       = _start;
    widget.state._endDate         = _end;
  }

  bool get _canExport {
    if (_timeframe == 'custom' && (_start == null || _end == null)) return false;
    return !widget.state._exporting;
  }

  Future<void> _pickDate({required bool isStart}) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: (isStart ? _start : _end) ?? now,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
      locale: const Locale('de', 'DE'),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) { _start = picked; } else { _end = picked; }
      _sync();
    });
  }

  @override
  Widget build(BuildContext context) {
    final showTimeframe = _timeframeReports.contains(widget.report.id);
    final fmt = DateFormat('dd.MM.yyyy');

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle
          Center(child: Container(width: 36, height: 4, decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 16),

          // Title
          Text('${widget.report.title} exportieren',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
          const SizedBox(height: 4),
          Text(widget.report.description,
              style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
          const SizedBox(height: 20),

          // Format
          const Text('Format', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
          const SizedBox(height: 8),
          Row(children: [
            _formatOption('pdf',  LucideIcons.fileText,        'PDF',  'Druckbares Dokument', const Color(0xFFDC2626)),
            const SizedBox(width: 8),
            _formatOption('csv',  LucideIcons.fileSpreadsheet, 'CSV',  'Rohdaten (Text)',     const Color(0xFF3B82F6)),
            const SizedBox(width: 8),
            _formatOption('xlsx', LucideIcons.fileSpreadsheet, 'XLSX', 'Excel-Arbeitsmappe',  const Color(0xFF059668)),
          ]),

          // Timeframe (only for date-based reports)
          if (showTimeframe) ...[
            const SizedBox(height: 20),
            const Text('Zeitraum', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
            const SizedBox(height: 8),
            _timeframeOption('all',    'Gesamtes Projekt'),
            _timeframeOption('custom', 'Benutzerdefinierter Zeitraum'),
            if (_timeframe == 'custom') ...[
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: _datePicker('Von', _start != null ? fmt.format(_start!) : null, () => _pickDate(isStart: true))),
                const SizedBox(width: 10),
                Expanded(child: _datePicker('Bis', _end != null ? fmt.format(_end!) : null, () => _pickDate(isStart: false))),
              ]),
            ],
          ],

          const SizedBox(height: 24),

          // Actions
          Row(children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => Navigator.of(context).pop(),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  side: const BorderSide(color: Color(0xFFE2E8F0)),
                ),
                child: const Text('Abbrechen', style: TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF475569))),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: ElevatedButton(
                onPressed: _canExport ? widget.onExport : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0EA5E9),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  elevation: 0,
                ),
                child: widget.state._exporting
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Icon(LucideIcons.download, size: 16),
                        SizedBox(width: 6),
                        Text('Exportieren', style: TextStyle(fontWeight: FontWeight.w700)),
                      ]),
              ),
            ),
          ]),
        ],
      ),
    );
  }

  Widget _formatOption(String value, IconData icon, String label, String desc, Color badgeColor) {
    final active = _format == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() { _format = value; _sync(); }),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: active ? const Color(0xFFEFF6FF) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: active ? const Color(0xFF0EA5E9) : const Color(0xFFE2E8F0), width: active ? 2 : 1),
          ),
          child: Column(children: [
            Icon(icon, size: 24, color: active ? const Color(0xFF0EA5E9) : const Color(0xFF64748B)),
            const SizedBox(height: 6),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: badgeColor, borderRadius: BorderRadius.circular(4)),
                child: Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
              ),
            ]),
            const SizedBox(height: 4),
            Text(desc, style: TextStyle(fontSize: 11, color: active ? const Color(0xFF0EA5E9) : const Color(0xFF94A3B8)), textAlign: TextAlign.center),
          ]),
        ),
      ),
    );
  }

  Widget _timeframeOption(String value, String label) {
    final active = _timeframe == value;
    return GestureDetector(
      onTap: () => setState(() { _timeframe = value; _sync(); }),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(children: [
          Container(
            width: 20, height: 20,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: active ? const Color(0xFF0EA5E9) : const Color(0xFF94A3B8), width: 2),
            ),
            child: active
                ? Center(child: Container(width: 10, height: 10, decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFF0EA5E9))))
                : null,
          ),
          const SizedBox(width: 10),
          Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: active ? const Color(0xFF0F172A) : const Color(0xFF475569))),
        ]),
      ),
    );
  }

  Widget _datePicker(String label, String? value, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(children: [
          const Icon(LucideIcons.calendar, size: 16, color: Color(0xFF94A3B8)),
          const SizedBox(width: 8),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600)),
            Text(value ?? 'TT.MM.JJJJ', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: value != null ? const Color(0xFF0F172A) : const Color(0xFFCBD5E1))),
          ]),
        ]),
      ),
    );
  }
}
