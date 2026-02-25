import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProjectPermissionContext } from '../../components/PermissionGuard';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { LottieLoader } from '../../components/LottieLoader';

import { Card, Button } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { ModernModal } from '../../components/ModernModal';
import { ReportAutomationModal } from '../../components/ReportAutomationModal';
import { DatePicker } from '../../components/DatePicker';
import { useToast } from '../../components/ToastProvider';
import { FileText, Download, BarChart3, FileSpreadsheet, Mail, Calendar, Table2 } from 'lucide-react';
import { buildXlsx, downloadXlsx } from '../../lib/xlsxBuilder';

interface ReportTemplate {
  id: string;
  title: string;
  description: string;
  icon: any;
  formats: ('pdf' | 'csv' | 'xlsx')[];
}

interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  totalDefects: number;
  teamMembers: number;
}

export function ProjectReports() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const permCtx = useProjectPermissionContext();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportTemplate | null>(null);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'xlsx'>('pdf');
  const [exportTimeframe, setExportTimeframe] = useState<'all' | 'custom'>('all');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [stats, setStats] = useState<ProjectStats>({ totalTasks: 0, completedTasks: 0, totalDefects: 0, teamMembers: 0 });
  const [projectData, setProjectData] = useState<any>(null);

  const reportTemplates: ReportTemplate[] = [
    { id: 'status',        title: 'Projektstatus-Report',    description: 'Gesamtübersicht über den Projektstatus', icon: BarChart3,      formats: ['pdf', 'csv', 'xlsx'] },
    { id: 'tasks',         title: 'Aufgaben-Report',         description: 'Detaillierte Liste aller Aufgaben',       icon: FileText,       formats: ['pdf', 'csv', 'xlsx'] },
    { id: 'defects',       title: 'Mängel-Report',           description: 'Übersicht aller Mängel',                  icon: FileText,       formats: ['pdf', 'csv', 'xlsx'] },
    { id: 'diary',         title: 'Bautagebuch-Export',      description: 'Komplettes Bautagebuch',                   icon: Calendar,       formats: ['pdf', 'csv', 'xlsx'] },
    { id: 'documentation', title: 'Projekt-Dokumentation',   description: 'Alle Notizen und Dokumente',               icon: FileText,       formats: ['pdf', 'csv', 'xlsx'] },
    { id: 'participants',  title: 'Teilnehmer-Liste',        description: 'Alle Projektbeteiligten',                  icon: FileSpreadsheet,formats: ['pdf', 'csv', 'xlsx'] },
    { id: 'timeline',      title: 'Zeitplan & Meilensteine', description: 'Terminübersicht',                          icon: Calendar,       formats: ['pdf', 'csv', 'xlsx'] },
    { id: 'complete',      title: 'Kompletter Projektbericht',description: 'Alle Daten zusammengefasst',              icon: FileText,       formats: ['pdf', 'csv', 'xlsx'] },
  ];

  // Reports that support timeframe filtering (date-based data)
  const TIMEFRAME_REPORTS = new Set(['diary', 'documentation', 'complete']);

  useEffect(() => {
    if (id) { loadStats(); loadProjectData(); }
  }, [id]);

  const loadProjectData = async () => {
    if (!id) return;
    try {
      const ctxProject = (permCtx as any)?.project;
      if (ctxProject) { setProjectData(ctxProject); return; }
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
      if (error) throw error;
      setProjectData(data);
    } catch (e) { console.error('Error loading project:', e); }
  };

  const loadStats = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: tasksData } = await supabase.from('tasks').select('id, status, task_type').eq('project_id', id);
      const { data: membersData } = await supabase.from('project_members').select('id').eq('project_id', id);
      setStats({
        totalTasks:      tasksData?.filter(t => t.task_type !== 'defect').length || 0,
        completedTasks:  tasksData?.filter(t => t.status === 'done' && t.task_type !== 'defect').length || 0,
        totalDefects:    tasksData?.filter(t => t.task_type === 'defect').length || 0,
        teamMembers:     membersData?.length || 0,
      });
    } catch { showToast('Fehler beim Laden', 'error'); }
    finally { setLoading(false); }
  };

  const handleGenerateReport = (report: ReportTemplate) => {
    setSelectedReport(report);
    setExportFormat('pdf');
    setExportTimeframe('all');
    setExportStartDate('');
    setExportEndDate('');
    setIsExportModalOpen(true);
  };

  const handleExport = async () => {
    if (!selectedReport || !id) return;
    setExporting(true);
    try {
      const data = await fetchReportData(selectedReport.id);
      const dateStr = new Date().toISOString().split('T')[0];
      if (exportFormat === 'pdf') {
        await generatePDF(selectedReport, data);
      } else if (exportFormat === 'xlsx') {
        const blob = await buildXlsx(
          selectedReport.id,
          data,
          selectedReport.title,
          ((data as any).project || projectData)?.name || 'Projekt',
        );
        downloadXlsx(blob, `${selectedReport.title.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
      } else {
        const csv = generateCSVReport(selectedReport.id, data);
        downloadCSV(csv, `${selectedReport.title}_${dateStr}.csv`);
      }
      showToast('Export erfolgreich!', 'success');
      setIsExportModalOpen(false);
    } catch (error: any) {
      console.error('Export error:', error);
      showToast(error.message || 'Fehler beim Exportieren', 'error');
    } finally {
      setExporting(false);
    }
  };

  // ── Data fetchers ──

  const applyTimeframe = <T extends { created_at?: string; entry_date?: string; start_date?: string }>(items: T[]): T[] => {
    if (exportTimeframe !== 'custom' || !exportStartDate || !exportEndDate) return items;
    const start = new Date(exportStartDate).getTime();
    const end   = new Date(exportEndDate).getTime() + 86400000; // inclusive end day
    return items.filter(item => {
      const d = new Date(item.entry_date || item.created_at || item.start_date || '').getTime();
      return d >= start && d <= end;
    });
  };

  const fetchReportData = async (reportId: string) => {
    if (!id) throw new Error('Keine Projekt-ID');
    switch (reportId) {
      case 'status':
      case 'complete':  return await fetchCompleteProjectData();
      case 'tasks':     return await fetchTasksData();
      case 'defects':   return await fetchDefectsData();
      case 'diary':     return await fetchDiaryData();
      case 'documentation': return await fetchDocumentationData();
      case 'participants':  return await fetchParticipantsData();
      case 'timeline':  return await fetchTimelineData();
      default: throw new Error('Unbekannter Report-Typ');
    }
  };

  const fetchCompleteProjectData = async () => {
    const [tasks, members, diary, notes, milestones] = await Promise.all([
      supabase.from('tasks').select('*, profiles!tasks_assigned_to_fkey(first_name, last_name, email)').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('project_members').select('*, profiles!project_members_user_id_fkey(first_name, last_name, email)').eq('project_id', id),
      supabase.from('diary_entries').select('*, profiles!diary_entries_created_by_fkey(first_name, last_name, email)').eq('project_id', id).order('entry_date', { ascending: false }),
      supabase.from('project_messages').select('*, profiles!project_messages_user_id_fkey(first_name, last_name, email)').eq('project_id', id).eq('is_deleted', false).order('created_at', { ascending: false }),
      supabase.from('timeline_events').select('*').eq('project_id', id).order('start_date', { ascending: true }),
    ]);
    return {
      project:    projectData,
      tasks:      tasks.data || [],
      members:    members.data || [],
      diary:      applyTimeframe(diary.data || []),
      notes:      applyTimeframe(notes.data || []),
      milestones: milestones.data || [],
    };
  };

  const fetchTasksData = async () => {
    const { data, error } = await supabase.from('tasks').select('*, profiles!tasks_assigned_to_fkey(first_name, last_name, email)').eq('project_id', id).eq('task_type', 'task').order('created_at', { ascending: false });
    if (error) throw error;
    return { tasks: data || [] };
  };

  const fetchDefectsData = async () => {
    const { data, error } = await supabase.from('tasks').select('*, profiles!tasks_assigned_to_fkey(first_name, last_name, email)').eq('project_id', id).eq('task_type', 'defect').order('created_at', { ascending: false });
    if (error) throw error;
    return { defects: data || [] };
  };

  const fetchDiaryData = async () => {
    const { data, error } = await supabase.from('diary_entries').select('*, profiles!diary_entries_created_by_fkey(first_name, last_name, email)').eq('project_id', id).order('entry_date', { ascending: false });
    if (error) throw error;
    return { entries: applyTimeframe(data || []) };
  };

  const fetchDocumentationData = async () => {
    const { data, error } = await supabase.from('project_messages').select('*, profiles!project_messages_user_id_fkey(first_name, last_name, email)').eq('project_id', id).eq('message_type', 'note').eq('is_deleted', false).order('created_at', { ascending: false });
    if (error) throw error;
    return { notes: applyTimeframe(data || []) };
  };

  const fetchParticipantsData = async () => {
    const { data, error } = await supabase.from('project_members').select('*, profiles!project_members_user_id_fkey(first_name, last_name, email, phone)').eq('project_id', id);
    if (error) throw error;
    return { members: data || [] };
  };

  const fetchTimelineData = async () => {
    const { data, error } = await supabase.from('timeline_events').select('*').eq('project_id', id).order('start_date', { ascending: true });
    if (error) throw error;
    return { milestones: data || [] };
  };

  // ── Real PDF via jsPDF ──

  const generatePDF = async (report: ReportTemplate, data: any) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const margin  = 18;
    const pageW   = doc.internal.pageSize.width;
    const pageH   = doc.internal.pageSize.height;
    const contentW = pageW - margin * 2;
    let y = margin;

    // ── Color palette ──
    const NAVY  = [14, 42, 71]   as const;
    const SLATE = [71, 85, 105]  as const;
    const LIGHT = [248, 250, 252] as const;
    const BORDER= [226, 232, 240] as const;
    const AMBER = [245, 158, 11]  as const;
    const TEXT  = [15, 23, 42]   as const;
    const MUTED = [148, 163, 184] as const;
    const GREEN = [5, 150, 105]  as const;
    const BLUE  = [59, 130, 246] as const;
    const RED   = [220, 38, 38]  as const;
    const ORANGE= [234, 88, 12]  as const;

    const checkPage = (needed: number) => {
      if (y + needed > pageH - margin - 10) {
        doc.addPage();
        // Top stripe on continuation pages
        doc.setFillColor(...NAVY);
        doc.rect(0, 0, pageW, 6, 'F');
        doc.setFillColor(...AMBER);
        doc.rect(0, 6, pageW, 1.5, 'F');
        y = 14;
      }
    };

    // ── Cover header ──
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 42, 'F');

    // Logo box
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, 7, 24, 24, 3, 3, 'F');
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text('DS', margin + 6, 23);

    // Title + subtitle
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(report.title, margin + 30, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    const projName = (data.project || projectData)?.name || 'Projekt';
    doc.text(`${projName}  ·  DocStruc Baudokumentation`, margin + 30, 25);
    doc.text(`Exportiert am ${fmtDT(new Date().toISOString())}`, margin + 30, 31);

    doc.setFillColor(...AMBER);
    doc.rect(0, 42, pageW, 2.5, 'F');
    y = 52;

    // ── Section heading helper ──
    const sectionTitle = (title: string) => {
      checkPage(14);
      doc.setFillColor(...NAVY);
      doc.rect(margin, y, contentW, 9, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(title, margin + 4, y + 6.2);
      y += 13;
    };

    // ── Row helper for tables ──
    const tableRow = (cells: string[], widths: number[], isHeader = false, shade = false) => {
      checkPage(8);
      if (isHeader) {
        doc.setFillColor(241, 245, 249);
        doc.rect(margin, y - 1, contentW, 8, 'F');
      } else if (shade) {
        doc.setFillColor(250, 251, 252);
        doc.rect(margin, y - 1, contentW, 8, 'F');
      }
      let x = margin + 2;
      cells.forEach((cell, i) => {
        doc.setFontSize(isHeader ? 8 : 9);
        doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
        if (isHeader) { doc.setTextColor(71, 85, 105); } else { doc.setTextColor(15, 23, 42); }
        const txt = doc.splitTextToSize(cell, widths[i] - 2)[0];
        doc.text(txt, x, y + 5);
        x += widths[i];
      });
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
      doc.line(margin, y + 7, pageW - margin, y + 7);
      y += 8;
    };

    // ── Content by report type ──
    switch (report.id) {
      case 'status':
      case 'complete': {
        const { tasks = [], members = [], diary = [], milestones = [] } = data;
        const taskItems = tasks.filter((t: any) => t.task_type !== 'defect');
        const defectItems = tasks.filter((t: any) => t.task_type === 'defect');
        const done = taskItems.filter((t: any) => t.status === 'done').length;
        const progress = taskItems.length > 0 ? Math.round((done / taskItems.length) * 100) : 0;

        // Stats strip
        const statBoxes = [
          { label: 'Aufgaben',   value: String(taskItems.length),  color: BLUE },
          { label: 'Erledigt',   value: String(done),              color: GREEN },
          { label: 'Mängel',     value: String(defectItems.length),color: RED },
          { label: 'Fortschritt',value: `${progress}%`,            color: AMBER },
          { label: 'Team',       value: String(members.length),    color: SLATE },
        ];
        const boxW = contentW / statBoxes.length;
        statBoxes.forEach(({ label, value, color }, i) => {
          doc.setFillColor(...LIGHT);
          doc.roundedRect(margin + i * boxW, y, boxW - 2, 18, 2, 2, 'F');
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(color[0], color[1], color[2]);
          doc.text(value, margin + i * boxW + boxW / 2 - 2, y + 10, { align: 'center' });
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...SLATE);
          doc.text(label, margin + i * boxW + boxW / 2 - 2, y + 16, { align: 'center' });
        });
        y += 24;

        // Progress bar
        doc.setFillColor(...BORDER);
        doc.roundedRect(margin, y, contentW, 5, 2, 2, 'F');
        if (progress > 0) {
          doc.setFillColor(...GREEN);
          doc.roundedRect(margin, y, contentW * progress / 100, 5, 2, 2, 'F');
        }
        doc.setFontSize(8);
        doc.setTextColor(...SLATE);
        doc.text(`${progress}% abgeschlossen`, pageW - margin, y + 4, { align: 'right' });
        y += 10;

        if (report.id === 'complete') {
          if (taskItems.length) {
            sectionTitle('Aufgaben');
            tableRow(['Titel', 'Status', 'Priorität', 'Zugewiesen an', 'Fällig'], [70, 28, 25, 40, 27], true);
            taskItems.forEach((t: any, i: number) => tableRow([
              t.title || '',
              statusLabel(t.status),
              priorityLabel(t.priority),
              personName(t.profiles),
              t.due_date ? fmtD(t.due_date) : '-',
            ], [70, 28, 25, 40, 27], false, i % 2 === 1));
          }
          if (defectItems.length) {
            sectionTitle('Mängel');
            tableRow(['Titel', 'Status', 'Priorität', 'Zugewiesen an', 'Erstellt'], [70, 28, 25, 40, 27], true);
            defectItems.forEach((t: any, i: number) => tableRow([
              t.title || '',
              defectStatusLabel(t.status),
              priorityLabel(t.priority),
              personName(t.profiles),
              fmtD(t.created_at),
            ], [70, 28, 25, 40, 27], false, i % 2 === 1));
          }
          if (milestones.length) {
            sectionTitle('Meilensteine');
            tableRow(['Meilenstein', 'Beschreibung', 'Zeitraum', 'Typ'], [55, 60, 40, 35], true);
            milestones.forEach((m: any, i: number) => tableRow([
              m.title || '',
              m.description || '-',
              fmtD(m.start_date) + (m.end_date ? ` – ${fmtD(m.end_date)}` : ''),
              milestoneTypeLabel(m.event_type),
            ], [55, 60, 40, 35], false, i % 2 === 1));
          }
          if (members.length) {
            sectionTitle('Team');
            tableRow(['Name', 'E-Mail', 'Telefon', 'Rolle'], [50, 65, 40, 35], true);
            members.forEach((m: any, i: number) => tableRow([
              personName(m.profiles),
              m.profiles?.email || '-',
              m.profiles?.phone || '-',
              m.role || 'Mitglied',
            ], [50, 65, 40, 35], false, i % 2 === 1));
          }
        }
        break;
      }

      case 'tasks': {
        const { tasks = [] } = data;
        sectionTitle(`Aufgaben (${tasks.length})`);
        tableRow(['Titel', 'Status', 'Priorität', 'Zugewiesen an', 'Fällig am'], [65, 28, 25, 40, 32], true);
        tasks.forEach((t: any, i: number) => tableRow([
          t.title || '',
          statusLabel(t.status),
          priorityLabel(t.priority),
          personName(t.profiles),
          t.due_date ? fmtD(t.due_date) : '-',
        ], [65, 28, 25, 40, 32], false, i % 2 === 1));
        break;
      }

      case 'defects': {
        const { defects = [] } = data;
        sectionTitle(`Mängel (${defects.length})`);
        tableRow(['Titel', 'Status', 'Priorität', 'Verantwortlich', 'Erstellt am'], [65, 28, 25, 40, 32], true);
        defects.forEach((t: any, i: number) => tableRow([
          t.title || '',
          defectStatusLabel(t.status),
          priorityLabel(t.priority),
          personName(t.profiles),
          fmtD(t.created_at),
        ], [65, 28, 25, 40, 32], false, i % 2 === 1));
        break;
      }

      case 'diary': {
        const { entries = [] } = data;
        sectionTitle(`Bautagebuch (${entries.length} Einträge)`);
        entries.forEach((entry: any) => {
          checkPage(30);
          // Entry date bar
          doc.setFillColor(...LIGHT);
          doc.roundedRect(margin, y, contentW, 9, 2, 2, 'F');
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...NAVY);
          doc.text(fmtD(entry.entry_date), margin + 3, y + 6.2);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...SLATE);
          const metaTxt = `${entry.weather || ''}${entry.temperature != null ? ` · ${entry.temperature}°C` : ''}${entry.workers_present ? ` · ${entry.workers_present} Mitarb.` : ''}`;
          doc.text(metaTxt, pageW - margin - 3, y + 6.2, { align: 'right' });
          y += 12;

          const field = (lbl: string, txt: string | null | undefined) => {
            if (!txt) return;
            checkPage(10);
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...MUTED);
            doc.text(lbl.toUpperCase(), margin + 2, y);
            y += 3.5;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...TEXT);
            const lines = doc.splitTextToSize(txt, contentW - 4);
            lines.forEach((line: string) => { checkPage(5.5); doc.text(line, margin + 2, y); y += 5.5; });
            y += 1;
          };

          if (entry.workers_list) field('Anwesende Mitarbeiter', entry.workers_list);
          field('Durchgeführte Arbeiten', entry.work_performed);
          if (entry.progress_notes)  field('Fortschrittsnotizen',    entry.progress_notes);
          if (entry.special_events)  field('Besondere Vorkommnisse', entry.special_events);
          if (entry.deliveries)      field('Lieferungen',            entry.deliveries);

          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(...MUTED);
          const creatorName = entry.profiles ? `${entry.profiles.first_name || ''} ${entry.profiles.last_name || ''}`.trim() || entry.profiles.email : 'Unbekannt';
          doc.text(`Erstellt von ${creatorName}  ·  ${fmtDT(entry.created_at)}`, margin + 2, y);
          y += 4;

          doc.setDrawColor(...BORDER);
          doc.setLineWidth(0.2);
          doc.line(margin, y, pageW - margin, y);
          y += 5;
        });
        break;
      }

      case 'documentation': {
        const { notes = [] } = data;
        sectionTitle(`Notizen (${notes.length})`);
        notes.forEach((note: any, i: number) => {
          checkPage(25);
          const userName = note.profiles ? `${note.profiles.first_name || ''} ${note.profiles.last_name || ''}`.trim() || note.profiles.email : 'Unbekannt';
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...NAVY);
          doc.text(fmtDT(note.created_at), margin + 2, y);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...SLATE);
          doc.text(`  · ${userName}`, margin + 2 + doc.getTextWidth(fmtDT(note.created_at)), y);
          y += 5;
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...TEXT);
          const stripped = (note.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          const lines = doc.splitTextToSize(stripped, contentW - 4);
          lines.forEach((line: string) => { checkPage(5.5); doc.text(line, margin + 2, y); y += 5.5; });
          y += 2;
          if (i < notes.length - 1) {
            doc.setDrawColor(...BORDER); doc.setLineWidth(0.2);
            doc.line(margin, y, pageW - margin, y); y += 4;
          }
        });
        break;
      }

      case 'participants': {
        const { members = [] } = data;
        sectionTitle(`Teammitglieder (${members.length})`);
        tableRow(['Name', 'E-Mail', 'Telefon', 'Rolle'], [50, 70, 35, 35], true);
        members.forEach((m: any, i: number) => tableRow([
          personName(m.profiles),
          m.profiles?.email || '-',
          m.profiles?.phone || '-',
          m.role || 'Mitglied',
        ], [50, 70, 35, 35], false, i % 2 === 1));
        break;
      }

      case 'timeline': {
        const { milestones = [] } = data;
        sectionTitle(`Meilensteine (${milestones.length})`);
        tableRow(['Meilenstein', 'Beschreibung', 'Zeitraum', 'Typ'], [55, 60, 42, 33], true);
        milestones.forEach((m: any, i: number) => tableRow([
          m.title || '',
          m.description || '-',
          fmtD(m.start_date) + (m.end_date ? ` – ${fmtD(m.end_date)}` : ''),
          milestoneTypeLabel(m.event_type),
        ], [55, 60, 42, 33], false, i % 2 === 1));
        break;
      }
    }

    // ── Page footers ──
    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      doc.text(
        `Seite ${p} von ${totalPages}  ·  © ${new Date().getFullYear()} DocStruc`,
        pageW / 2, pageH - 6, { align: 'center' }
      );
    }

    doc.save(`${report.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // ── Format helpers ──
  const fmtD  = (s: string) => { if (!s) return ''; return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); };
  const fmtDT = (s: string) => { if (!s) return ''; return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const personName = (p: any) => p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || '-' : '-';
  const statusLabel  = (s: string) => ({ done: 'Erledigt', in_progress: 'In Bearb.', blocked: 'Blockiert', open: 'Offen' }[s] || s || '-');
  const defectStatusLabel = (s: string) => ({ done: 'Behoben', in_progress: 'In Bearb.', open: 'Offen' }[s] || s || '-');
  const priorityLabel = (p: string) => ({ high: 'Hoch', medium: 'Mittel', low: 'Niedrig', critical: 'Kritisch' }[p] || p || '-');
  const milestoneTypeLabel = (t: string) => ({ deadline: 'Deadline', meeting: 'Meeting', milestone: 'Meilenstein' }[t] || 'Meilenstein');

  // ── CSV generation (unchanged logic) ──
  const generateCSVReport = (reportId: string, data: any): string => {
    switch (reportId) {
      case 'tasks':         return toCSV(['Titel','Beschreibung','Status','Priorität','Zugewiesen','Fällig','Erstellt'], (data.tasks||[]).map((t: any) => [t.title||'', t.description||'', statusLabel(t.status), priorityLabel(t.priority), personName(t.profiles), t.due_date ? fmtD(t.due_date) : '', fmtDT(t.created_at)]));
      case 'defects':       return toCSV(['Titel','Beschreibung','Status','Priorität','Zugewiesen','Erstellt'], (data.defects||[]).map((t: any) => [t.title||'', t.description||'', defectStatusLabel(t.status), priorityLabel(t.priority), personName(t.profiles), fmtDT(t.created_at)]));
      case 'diary':         return toCSV(['Datum','Wetter','Temp','Mitarbeiter','Anwesende','Arbeiten','Fortschritt','Ereignisse','Lieferungen','Erstellt von','Erstellt am'], (data.entries||[]).map((e: any) => [fmtD(e.entry_date), e.weather||'', e.temperature?`${e.temperature}°C`:'', e.workers_present||'', e.workers_list||'', e.work_performed||'', e.progress_notes||'', e.special_events||'', e.deliveries||'', personName(e.profiles), fmtDT(e.created_at)]));
      case 'documentation': return toCSV(['Datum','Inhalt','Erstellt von'], (data.notes||[]).map((n: any) => [fmtDT(n.created_at), (n.content||'').replace(/<[^>]+>/g,' ').trim(), personName(n.profiles)]));
      case 'participants':  return toCSV(['Name','E-Mail','Telefon','Rolle'], (data.members||[]).map((m: any) => [personName(m.profiles), m.profiles?.email||'', m.profiles?.phone||'', m.role||'Mitglied']));
      case 'timeline':      return toCSV(['Meilenstein','Beschreibung','Start','Ende','Typ'], (data.milestones||[]).map((m: any) => [m.title||'', m.description||'', m.start_date?fmtD(m.start_date):'', m.end_date?fmtD(m.end_date):'', milestoneTypeLabel(m.event_type)]));
      case 'status':
      case 'complete': {
        const { tasks=[], members=[], diary=[], milestones=[] } = data;
        let csv = '=== PROJEKTSTATUS ===\n';
        csv += `Aufgaben,${tasks.filter((t:any)=>t.task_type!=='defect').length}\n`;
        csv += `Erledigt,${tasks.filter((t:any)=>t.status==='done'&&t.task_type!=='defect').length}\n`;
        csv += `Mängel,${tasks.filter((t:any)=>t.task_type==='defect').length}\n\n`;
        csv += '=== AUFGABEN ===\n' + generateCSVReport('tasks', { tasks: tasks.filter((t:any)=>t.task_type!=='defect') }) + '\n\n';
        csv += '=== MÄNGEL ===\n' + generateCSVReport('defects', { defects: tasks.filter((t:any)=>t.task_type==='defect') }) + '\n\n';
        csv += '=== MEILENSTEINE ===\n' + generateCSVReport('timeline', { milestones }) + '\n\n';
        csv += '=== TEAM ===\n' + generateCSVReport('participants', { members });
        return csv;
      }
      default: return '';
    }
  };

  const toCSV = (headers: string[], rows: any[][]): string =>
    [headers, ...rows].map(r => r.map(c => `"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n');

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleScheduleReport = () => setIsAutomationModalOpen(true);

  if (loading) {
    return (<View style={styles.loadingContainer}><LottieLoader size={120} /></View>);
  }

  const showTimeframe = selectedReport && TIMEFRAME_REPORTS.has(selectedReport.id);
  const canExport = !exporting && !(exportTimeframe === 'custom' && (!exportStartDate || !exportEndDate));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Berichte & Exporte</Text>
          <Text style={styles.pageSubtitle}>Reports, Auswertungen und Daten-Export</Text>
        </View>
        <Button onClick={handleScheduleReport}><Mail size={18} /> Automatisierung</Button>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>Projekt-Kennzahlen</Text>
          <View style={styles.statsGrid}>
            {[
              { value: stats.totalTasks,     label: 'Aufgaben' },
              { value: stats.completedTasks, label: 'Erledigt' },
              { value: stats.totalDefects,   label: 'Mängel' },
              { value: stats.teamMembers,    label: 'Team' },
            ].map(({ value, label }) => (
              <View key={label} style={styles.statItem}>
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.progressSection}>
            <Text style={styles.progressLabel}>Projektfortschritt</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0}%` as any }]} />
            </View>
            <Text style={styles.progressText}>{stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%</Text>
          </View>
        </Card>

        {/* Report cards */}
        <View style={styles.reportsSection}>
          <Text style={styles.sectionTitle}>Verfügbare Reports</Text>
          <View style={styles.reportGrid}>
            {reportTemplates.map(report => {
              const IconComponent = report.icon;
              return (
                <Card key={report.id} style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <View style={styles.reportIconContainer}><IconComponent size={24} color={colors.primary} /></View>
                    <View style={styles.formatBadges}>
                      {report.formats.includes('pdf')  && <View style={[styles.formatBadge, { backgroundColor: '#DC2626' }]}><Text style={styles.formatBadgeText}>PDF</Text></View>}
                      {report.formats.includes('csv')  && <View style={[styles.formatBadge, { backgroundColor: '#3B82F6' }]}><Text style={styles.formatBadgeText}>CSV</Text></View>}
                      {report.formats.includes('xlsx') && <View style={[styles.formatBadge, { backgroundColor: '#059669' }]}><Text style={styles.formatBadgeText}>XLSX</Text></View>}
                    </View>
                  </View>
                  <Text style={styles.reportTitle}>{report.title}</Text>
                  <Text style={styles.reportDescription}>{report.description}</Text>
                  <TouchableOpacity style={styles.generateButton} onPress={() => handleGenerateReport(report)}>
                    <Download size={16} color="#ffffff" />
                    <Text style={styles.generateButtonText}>Generieren</Text>
                  </TouchableOpacity>
                </Card>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Export Modal */}
      <ModernModal
        visible={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title={`${selectedReport?.title || 'Report'} exportieren`}
      >
        <View style={styles.modalContent}>

          {/* Format picker */}
          <Text style={styles.modalLabel}>Format</Text>
          <View style={styles.formatOptions}>
            <TouchableOpacity
              style={[styles.formatOption, exportFormat === 'pdf' && styles.formatOptionActive]}
              onPress={() => setExportFormat('pdf')}
            >
              <FileText size={22} color={exportFormat === 'pdf' ? colors.primary : '#64748b'} />
              <Text style={[styles.formatOptionText, exportFormat === 'pdf' && styles.formatOptionTextActive]}>PDF</Text>
              <Text style={styles.formatOptionDesc}>Druckbares Dokument</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.formatOption, exportFormat === 'csv' && styles.formatOptionActive]}
              onPress={() => setExportFormat('csv')}
            >
              <FileSpreadsheet size={22} color={exportFormat === 'csv' ? colors.primary : '#64748b'} />
              <Text style={[styles.formatOptionText, exportFormat === 'csv' && styles.formatOptionTextActive]}>CSV</Text>
              <Text style={styles.formatOptionDesc}>Daten für Excel</Text>
            </TouchableOpacity>
            {selectedReport?.formats.includes('xlsx') && (
              <TouchableOpacity
                style={[styles.formatOption, exportFormat === 'xlsx' && styles.formatOptionActive]}
                onPress={() => setExportFormat('xlsx')}
              >
                <Table2 size={22} color={exportFormat === 'xlsx' ? '#059669' : '#64748b'} />
                <Text style={[styles.formatOptionText, exportFormat === 'xlsx' && { color: '#059669' }]}>XLSX</Text>
                <Text style={styles.formatOptionDesc}>Excel-Tabelle</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Timeframe (only for date-based reports) */}
          {showTimeframe && (
            <>
              <Text style={styles.modalLabel}>Zeitraum</Text>
              <View style={styles.timeframeOptions}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
                  <input type="radio" checked={exportTimeframe === 'all'} onChange={() => setExportTimeframe('all')} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  <span style={{ fontSize: 14, color: '#334155', fontWeight: 600 }}>Gesamtes Projekt</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
                  <input type="radio" checked={exportTimeframe === 'custom'} onChange={() => setExportTimeframe('custom')} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  <span style={{ fontSize: 14, color: '#334155', fontWeight: 600 }}>Benutzerdefinierter Zeitraum</span>
                </label>
              </View>
              {exportTimeframe === 'custom' && (
                <View style={styles.dateRange}>
                  <View style={{ flex: 1 }}><DatePicker label="Von" value={exportStartDate} onChange={setExportStartDate} placeholder="TT.MM.JJJJ" /></View>
                  <View style={{ flex: 1 }}><DatePicker label="Bis" value={exportEndDate}   onChange={setExportEndDate}   placeholder="TT.MM.JJJJ" /></View>
                </View>
              )}
            </>
          )}

          {/* Actions */}
          <View style={styles.modalActions}>
            <Button variant="outline" onClick={() => setIsExportModalOpen(false)} style={{ flex: 1 }}>
              Abbrechen
            </Button>
            <Button onClick={handleExport} disabled={!canExport} style={{ flex: 1 }}>
              {exporting ? <ActivityIndicator size="small" color="#fff" /> : <><Download size={16} /> Exportieren</>}
            </Button>
          </View>
        </View>
      </ModernModal>

      {/* Automation Modal */}
      <ReportAutomationModal
        visible={isAutomationModalOpen}
        onClose={() => setIsAutomationModalOpen(false)}
        projectId={id!}
        reportTemplates={reportTemplates.map(r => ({ id: r.id, title: r.title }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 4, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 15, color: '#64748b' },
  content: { flex: 1 },
  statsCard: { padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 24 },
  statsTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  statsGrid: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  statItem: { flex: 1, alignItems: 'center', padding: 16, backgroundColor: '#F8FAFC', borderRadius: 12 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  progressSection: { gap: 8 },
  progressLabel: { fontSize: 14, fontWeight: '600', color: '#475569' },
  progressBar: { height: 12, backgroundColor: '#E2E8F0', borderRadius: 6, overflow: 'hidden' },
  progressFill: { height: '100%' as any, backgroundColor: colors.primary },
  progressText: { fontSize: 14, fontWeight: '700', color: colors.primary, textAlign: 'right' },
  reportsSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  reportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  reportCard: { width: '48%', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  reportIconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  formatBadges: { flexDirection: 'row', gap: 4 },
  formatBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  formatBadgeText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },
  reportTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  reportDescription: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 16 },
  generateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.primary, borderRadius: 10 },
  generateButtonText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  modalContent: { gap: 16 },
  modalLabel: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 4 },
  formatOptions: { flexDirection: 'row', gap: 12 },
  formatOption: { flex: 1, padding: 16, borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 12, alignItems: 'center', gap: 6 },
  formatOptionActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  formatOptionText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  formatOptionTextActive: { color: colors.primary },
  formatOptionDesc: { fontSize: 11, color: '#94a3b8', textAlign: 'center' },
  timeframeOptions: { gap: 0, marginBottom: 4 },
  dateRange: { flexDirection: 'row', gap: 12 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
});

