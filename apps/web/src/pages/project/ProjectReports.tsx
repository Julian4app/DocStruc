import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { ModernModal } from '../../components/ModernModal';
import { useToast } from '../../components/ToastProvider';
import { FileText, Download, BarChart3, TrendingUp, FileSpreadsheet, Mail, Calendar, X } from 'lucide-react';

interface ReportTemplate {
  id: string;
  title: string;
  description: string;
  icon: any;
  formats: ('pdf' | 'csv' | 'excel')[];
}

interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  totalDefects: number;
  teamMembers: number;
}

interface ExportOptions {
  format: 'pdf' | 'csv';
  reportId: string;
}

export function ProjectReports() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportTemplate | null>(null);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv'>('pdf');
  const [stats, setStats] = useState<ProjectStats>({ totalTasks: 0, completedTasks: 0, totalDefects: 0, teamMembers: 0 });
  const [projectData, setProjectData] = useState<any>(null);

  const reportTemplates: ReportTemplate[] = [
    { id: 'status', title: 'Projektstatus-Report', description: 'Gesamtübersicht über den Projektstatus', icon: BarChart3, formats: ['pdf', 'csv'] },
    { id: 'tasks', title: 'Aufgaben-Report', description: 'Detaillierte Liste aller Aufgaben', icon: FileText, formats: ['pdf', 'csv'] },
    { id: 'defects', title: 'Mängel-Report', description: 'Übersicht aller Mängel', icon: FileText, formats: ['pdf', 'csv'] },
    { id: 'diary', title: 'Bautagebuch-Export', description: 'Komplettes Bautagebuch', icon: Calendar, formats: ['pdf', 'csv'] },
    { id: 'documentation', title: 'Projekt-Dokumentation', description: 'Alle Notizen und Dokumente', icon: FileText, formats: ['pdf', 'csv'] },
    { id: 'participants', title: 'Teilnehmer-Liste', description: 'Alle Projektbeteiligten', icon: FileSpreadsheet, formats: ['pdf', 'csv'] },
    { id: 'timeline', title: 'Zeitplan & Meilensteine', description: 'Terminübersicht', icon: Calendar, formats: ['pdf', 'csv'] },
    { id: 'complete', title: 'Kompletter Projektbericht', description: 'Alle Daten zusammengefasst', icon: FileText, formats: ['pdf', 'csv'] }
  ];

  useEffect(() => {
    if (id) {
      loadStats();
      loadProjectData();
    }
  }, [id]);

  const loadProjectData = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, owner_id, name, description, address, status, created_at, updated_at, subtitle, picture_url, detailed_address, start_date, target_end_date')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      setProjectData(data);
    } catch (error: any) {
      console.error('Error loading project:', error);
    }
  };

  const loadStats = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: tasksData } = await supabase.from('tasks').select('id, status, task_type').eq('project_id', id);
      const { data: membersData } = await supabase.from('project_members').select('id').eq('project_id', id);
      setStats({
        totalTasks: tasksData?.length || 0,
        completedTasks: tasksData?.filter(t => t.status === 'done').length || 0,
        totalDefects: tasksData?.filter(t => t.task_type === 'defect').length || 0,
        teamMembers: membersData?.length || 0
      });
    } catch (error: any) {
      showToast('Fehler beim Laden', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = (report: ReportTemplate) => {
    setSelectedReport(report);
    setExportFormat(report.formats.includes('pdf') ? 'pdf' : 'csv');
    setIsExportModalOpen(true);
  };

  const handleExport = async () => {
    if (!selectedReport || !id) return;
    
    setExporting(true);
    try {
      const data = await fetchReportData(selectedReport.id);
      
      if (exportFormat === 'pdf') {
        const htmlContent = generateHTMLReport(selectedReport.id, data);
        downloadPDF(htmlContent, `${selectedReport.title}_${new Date().toISOString().split('T')[0]}.html`);
      } else {
        const csvContent = generateCSVReport(selectedReport.id, data);
        downloadCSV(csvContent, `${selectedReport.title}_${new Date().toISOString().split('T')[0]}.csv`);
      }
      
      showToast('Export erfolgreich!', 'success');
      setIsExportModalOpen(false);
    } catch (error: any) {
      console.error('Error exporting:', error);
      showToast(error.message || 'Fehler beim Exportieren', 'error');
    } finally {
      setExporting(false);
    }
  };

  const fetchReportData = async (reportId: string) => {
    if (!id) throw new Error('Keine Projekt-ID');

    switch (reportId) {
      case 'status':
      case 'complete':
        return await fetchCompleteProjectData();
      case 'tasks':
        return await fetchTasksData();
      case 'defects':
        return await fetchDefectsData();
      case 'diary':
        return await fetchDiaryData();
      case 'documentation':
        return await fetchDocumentationData();
      case 'participants':
        return await fetchParticipantsData();
      case 'timeline':
        return await fetchTimelineData();
      default:
        throw new Error('Unbekannter Report-Typ');
    }
  };

  const fetchCompleteProjectData = async () => {
    const [tasks, members, diary, messages, milestones] = await Promise.all([
      supabase.from('tasks').select('*, profiles!tasks_assigned_to_fkey(first_name, last_name, email)').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('project_members').select('*, profiles!project_members_user_id_fkey(first_name, last_name, email)').eq('project_id', id),
      supabase.from('diary_entries').select('*, profiles!diary_entries_created_by_fkey(first_name, last_name, email)').eq('project_id', id).order('entry_date', { ascending: false }),
      supabase.from('project_messages').select('*, profiles!project_messages_user_id_fkey(first_name, last_name, email)').eq('project_id', id).eq('is_deleted', false).order('created_at', { ascending: false }),
      supabase.from('timeline_events').select('id, project_id, title, description, start_date, end_date, status, event_type, color, created_at').eq('project_id', id).order('start_date', { ascending: true })
    ]);

    return {
      project: projectData,
      tasks: tasks.data || [],
      members: members.data || [],
      diary: diary.data || [],
      messages: messages.data || [],
      milestones: milestones.data || []
    };
  };

  const fetchTasksData = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, profiles!tasks_assigned_to_fkey(first_name, last_name, email)')
      .eq('project_id', id)
      .eq('task_type', 'task')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { tasks: data || [] };
  };

  const fetchDefectsData = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, profiles!tasks_assigned_to_fkey(first_name, last_name, email)')
      .eq('project_id', id)
      .eq('task_type', 'defect')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { defects: data || [] };
  };

  const fetchDiaryData = async () => {
    const { data, error } = await supabase
      .from('diary_entries')
      .select('*, profiles!diary_entries_created_by_fkey(first_name, last_name, email)')
      .eq('project_id', id)
      .order('entry_date', { ascending: false });
    
    if (error) throw error;
    return { entries: data || [] };
  };

  const fetchDocumentationData = async () => {
    const { data, error } = await supabase
      .from('project_messages')
      .select('*, profiles!project_messages_user_id_fkey(first_name, last_name, email)')
      .eq('project_id', id)
      .eq('message_type', 'note')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { notes: data || [] };
  };

  const fetchParticipantsData = async () => {
    const { data, error } = await supabase
      .from('project_members')
      .select('*, profiles!project_members_user_id_fkey(first_name, last_name, email, phone)')
      .eq('project_id', id);
    
    if (error) throw error;
    return { members: data || [] };
  };

  const fetchTimelineData = async () => {
    const { data, error } = await supabase
      .from('timeline_events')
      .select('id, project_id, title, description, start_date, end_date, status, event_type, color, created_at')
      .eq('project_id', id)
      .order('start_date', { ascending: true });
    
    if (error) throw error;
    return { milestones: data || [] };
  };

  const generateHTMLReport = (reportId: string, data: any): string => {
    const headerHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${selectedReport?.title || 'Bericht'}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #1e3a5f; padding-bottom: 20px; }
          .logo { width: 80px; height: 80px; margin: 0 auto 20px; }
          h1 { color: #1e3a5f; margin: 10px 0; font-size: 32px; }
          h2 { color: #1e3a5f; margin: 25px 0 15px; font-size: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
          h3 { color: #475569; margin: 20px 0 10px; font-size: 18px; }
          .subtitle { color: #666; font-size: 14px; margin-top: 10px; }
          .stats { display: flex; gap: 20px; margin: 30px 0; }
          .stat-card { flex: 1; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center; }
          .stat-value { font-size: 32px; font-weight: bold; color: #1e3a5f; }
          .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #f1f5f9; padding: 12px; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #cbd5e1; }
          td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
          tr:hover { background: #f8fafc; }
          .status-badge { padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; display: inline-block; }
          .status-todo { background: #fee2e2; color: #991b1b; }
          .status-in-progress { background: #dbeafe; color: #1e40af; }
          .status-done { background: #d1fae5; color: #065f46; }
          .priority-high { color: #dc2626; font-weight: 600; }
          .priority-medium { color: #f59e0b; font-weight: 600; }
          .priority-low { color: #10b981; font-weight: 600; }
          .entry { margin-bottom: 25px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; page-break-inside: avoid; }
          .entry-header { font-weight: bold; color: #1e3a5f; margin-bottom: 10px; font-size: 16px; }
          .entry-content { color: #0f172a; line-height: 1.6; }
          .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
          @media print { .entry, tr { page-break-inside: avoid; } }
        </style>
      </head>
      <body>
        <div class="header">
          <svg class="logo" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#1e3a5f;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0f2642;stop-opacity:1" />
              </linearGradient>
            </defs>
            <rect width="512" height="512" rx="90" fill="url(#bgGrad)"/>
            <path d="M 280 90 L 360 150 L 360 180 L 340 180 L 340 160 L 300 130 L 280 140 Z" fill="#1e3a5f" stroke="#fff" stroke-width="3"/>
            <circle cx="445" cy="135" r="20" fill="#F59E0B" stroke="#fff" stroke-width="3"/>
            <line x1="445" y1="155" x2="445" y2="200" stroke="#1e3a5f" stroke-width="8"/>
            <text x="75" y="360" font-family="Arial, sans-serif" font-size="280" font-weight="bold" fill="#fff">DS</text>
          </svg>
          <h1>${selectedReport?.title || 'Bericht'}</h1>
          <div class="subtitle">DocStruc - Baudokumentation • ${projectData?.name || 'Projekt'}</div>
          <div class="subtitle">Exportiert am ${formatDateTime(new Date().toISOString())}</div>
        </div>
    `;

    let bodyHTML = '';

    switch (reportId) {
      case 'status':
      case 'complete':
        bodyHTML = generateCompleteReport(data);
        break;
      case 'tasks':
        bodyHTML = generateTasksReport(data.tasks);
        break;
      case 'defects':
        bodyHTML = generateDefectsReport(data.defects);
        break;
      case 'diary':
        bodyHTML = generateDiaryReport(data.entries);
        break;
      case 'documentation':
        bodyHTML = generateDocumentationReport(data.notes);
        break;
      case 'participants':
        bodyHTML = generateParticipantsReport(data.members);
        break;
      case 'timeline':
        bodyHTML = generateTimelineReport(data.milestones);
        break;
    }

    return headerHTML + bodyHTML + `<div class="footer">© ${new Date().getFullYear()} DocStruc • Baudokumentation</div></body></html>`;
  };

  const generateCompleteReport = (data: any): string => {
    let html = '<h2>Projektstatus</h2>';
    html += `<div class="stats">
      <div class="stat-card"><div class="stat-value">${data.tasks.length}</div><div class="stat-label">Aufgaben</div></div>
      <div class="stat-card"><div class="stat-value">${data.tasks.filter((t: any) => t.status === 'done').length}</div><div class="stat-label">Erledigt</div></div>
      <div class="stat-card"><div class="stat-value">${data.tasks.filter((t: any) => t.task_type === 'defect').length}</div><div class="stat-label">Mängel</div></div>
      <div class="stat-card"><div class="stat-value">${data.members.length}</div><div class="stat-label">Team</div></div>
    </div>`;

    html += '<h2>Aufgaben</h2>' + generateTasksReport(data.tasks.filter((t: any) => t.task_type === 'task'));
    html += '<h2>Mängel</h2>' + generateDefectsReport(data.tasks.filter((t: any) => t.task_type === 'defect'));
    html += '<h2>Meilensteine</h2>' + generateTimelineReport(data.milestones);
    html += '<h2>Team</h2>' + generateParticipantsReport(data.members);
    
    return html;
  };

  const generateTasksReport = (tasks: any[]): string => {
    if (tasks.length === 0) return '<p>Keine Aufgaben vorhanden.</p>';
    
    let html = `<table>
      <thead>
        <tr>
          <th>Titel</th>
          <th>Status</th>
          <th>Priorität</th>
          <th>Zugewiesen an</th>
          <th>Fällig am</th>
        </tr>
      </thead>
      <tbody>`;
    
    tasks.forEach(task => {
      const statusClass = task.status === 'done' ? 'status-done' : task.status === 'in-progress' ? 'status-in-progress' : 'status-todo';
      const priorityClass = task.priority === 'high' ? 'priority-high' : task.priority === 'medium' ? 'priority-medium' : 'priority-low';
      const statusLabel = task.status === 'done' ? 'Erledigt' : task.status === 'in-progress' ? 'In Bearbeitung' : 'Offen';
      const priorityLabel = task.priority === 'high' ? 'Hoch' : task.priority === 'medium' ? 'Mittel' : 'Niedrig';
      const assignedTo = task.profiles ? `${task.profiles.first_name || ''} ${task.profiles.last_name || ''}`.trim() : 'Nicht zugewiesen';
      
      html += `<tr>
        <td><strong>${task.title}</strong>${task.description ? `<br><small style="color: #64748b;">${task.description}</small>` : ''}</td>
        <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        <td><span class="${priorityClass}">${priorityLabel}</span></td>
        <td>${assignedTo}</td>
        <td>${task.due_date ? formatDate(task.due_date) : '-'}</td>
      </tr>`;
    });
    
    html += '</tbody></table>';
    return html;
  };

  const generateDefectsReport = (defects: any[]): string => {
    if (defects.length === 0) return '<p>Keine Mängel vorhanden.</p>';
    
    let html = `<table>
      <thead>
        <tr>
          <th>Titel</th>
          <th>Status</th>
          <th>Priorität</th>
          <th>Verantwortlich</th>
          <th>Erstellt am</th>
        </tr>
      </thead>
      <tbody>`;
    
    defects.forEach(defect => {
      const statusClass = defect.status === 'done' ? 'status-done' : defect.status === 'in-progress' ? 'status-in-progress' : 'status-todo';
      const priorityClass = defect.priority === 'high' ? 'priority-high' : defect.priority === 'medium' ? 'priority-medium' : 'priority-low';
      const statusLabel = defect.status === 'done' ? 'Behoben' : defect.status === 'in-progress' ? 'In Bearbeitung' : 'Offen';
      const priorityLabel = defect.priority === 'high' ? 'Hoch' : defect.priority === 'medium' ? 'Mittel' : 'Niedrig';
      const assignedTo = defect.profiles ? `${defect.profiles.first_name || ''} ${defect.profiles.last_name || ''}`.trim() : 'Nicht zugewiesen';
      
      html += `<tr>
        <td><strong>${defect.title}</strong>${defect.description ? `<br><small style="color: #64748b;">${defect.description}</small>` : ''}</td>
        <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        <td><span class="${priorityClass}">${priorityLabel}</span></td>
        <td>${assignedTo}</td>
        <td>${formatDate(defect.created_at)}</td>
      </tr>`;
    });
    
    html += '</tbody></table>';
    return html;
  };

  const generateDiaryReport = (entries: any[]): string => {
    if (entries.length === 0) return '<p>Keine Bautagebuch-Einträge vorhanden.</p>';
    
    let html = '';
    entries.forEach(entry => {
      const creatorName = entry.profiles ? `${entry.profiles.first_name || ''} ${entry.profiles.last_name || ''}`.trim() : 'Unbekannt';
      
      html += `<div class="entry">
        <div class="entry-header">${formatDate(entry.entry_date)} • ${entry.weather || 'Wetter unbekannt'}${entry.temperature ? ` • ${entry.temperature}°C` : ''}</div>
        ${entry.workers_present ? `<p><strong>Mitarbeiter vor Ort:</strong> ${entry.workers_present}</p>` : ''}
        ${entry.workers_list ? `<p><strong>Anwesende:</strong> ${entry.workers_list}</p>` : ''}
        <div class="entry-content">
          ${entry.work_performed ? `<p><strong>Durchgeführte Arbeiten:</strong><br>${entry.work_performed}</p>` : ''}
          ${entry.progress_notes ? `<p><strong>Fortschritt:</strong><br>${entry.progress_notes}</p>` : ''}
          ${entry.special_events ? `<p><strong>Besondere Vorkommnisse:</strong><br>${entry.special_events}</p>` : ''}
          ${entry.deliveries ? `<p><strong>Lieferungen:</strong><br>${entry.deliveries}</p>` : ''}
        </div>
        <small style="color: #94a3b8;">Erstellt von ${creatorName} am ${formatDateTime(entry.created_at)}</small>
      </div>`;
    });
    
    return html;
  };

  const generateDocumentationReport = (notes: any[]): string => {
    if (notes.length === 0) return '<p>Keine Notizen vorhanden.</p>';
    
    let html = '';
    notes.forEach(note => {
      const userName = note.profiles ? `${note.profiles.first_name || ''} ${note.profiles.last_name || ''}`.trim() : 'Unbekannt';
      
      html += `<div class="entry">
        <div class="entry-header">${formatDateTime(note.created_at)}${note.is_pinned ? ' 📌 Angeheftet' : ''}</div>
        <div class="entry-content">${note.content}</div>
        <small style="color: #94a3b8;">Von ${userName}${note.is_edited ? ' (bearbeitet am ' + formatDateTime(note.edited_at) + ')' : ''}</small>
      </div>`;
    });
    
    return html;
  };

  const generateParticipantsReport = (members: any[]): string => {
    if (members.length === 0) return '<p>Keine Teammitglieder vorhanden.</p>';
    
    let html = `<table>
      <thead>
        <tr>
          <th>Name</th>
          <th>E-Mail</th>
          <th>Telefon</th>
          <th>Rolle</th>
        </tr>
      </thead>
      <tbody>`;
    
    members.forEach(member => {
      const name = member.profiles ? `${member.profiles.first_name || ''} ${member.profiles.last_name || ''}`.trim() : 'Unbekannt';
      const email = member.profiles?.email || '-';
      const phone = member.profiles?.phone || '-';
      const role = member.role || 'Mitglied';
      
      html += `<tr>
        <td><strong>${name}</strong></td>
        <td>${email}</td>
        <td>${phone}</td>
        <td>${role}</td>
      </tr>`;
    });
    
    html += '</tbody></table>';
    return html;
  };

  const generateTimelineReport = (milestones: any[]): string => {
    if (milestones.length === 0) return '<p>Keine Meilensteine vorhanden.</p>';
    
    let html = `<table>
      <thead>
        <tr>
          <th>Meilenstein</th>
          <th>Beschreibung</th>
          <th>Zeitraum</th>
          <th>Typ</th>
        </tr>
      </thead>
      <tbody>`;
    
    milestones.forEach(milestone => {
      const eventType = milestone.event_type || 'milestone';
      const typeLabel = eventType === 'deadline' ? 'Deadline' : eventType === 'meeting' ? 'Meeting' : 'Meilenstein';
      
      html += `<tr>
        <td><strong>${milestone.title}</strong></td>
        <td>${milestone.description || '-'}</td>
        <td>${milestone.start_date ? formatDate(milestone.start_date) : '-'}${milestone.end_date ? ' - ' + formatDate(milestone.end_date) : ''}</td>
        <td>${typeLabel}</td>
      </tr>`;
    });
    
    html += '</tbody></table>';
    return html;
  };

  const generateCSVReport = (reportId: string, data: any): string => {
    switch (reportId) {
      case 'tasks':
        return generateTasksCSV(data.tasks);
      case 'defects':
        return generateDefectsCSV(data.defects);
      case 'diary':
        return generateDiaryCSV(data.entries);
      case 'documentation':
        return generateDocumentationCSV(data.notes);
      case 'participants':
        return generateParticipantsCSV(data.members);
      case 'timeline':
        return generateTimelineCSV(data.milestones);
      case 'status':
      case 'complete':
        return generateCompleteCSV(data);
      default:
        return '';
    }
  };

  const generateTasksCSV = (tasks: any[]): string => {
    const headers = ['Titel', 'Beschreibung', 'Status', 'Priorität', 'Zugewiesen an', 'Fällig am', 'Erstellt am'];
    const rows = tasks.map(task => {
      const assignedTo = task.profiles ? `${task.profiles.first_name || ''} ${task.profiles.last_name || ''}`.trim() : 'Nicht zugewiesen';
      const statusLabel = task.status === 'done' ? 'Erledigt' : task.status === 'in-progress' ? 'In Bearbeitung' : 'Offen';
      const priorityLabel = task.priority === 'high' ? 'Hoch' : task.priority === 'medium' ? 'Mittel' : 'Niedrig';
      
      return [
        task.title,
        task.description || '',
        statusLabel,
        priorityLabel,
        assignedTo,
        task.due_date ? formatDate(task.due_date) : '',
        formatDateTime(task.created_at)
      ];
    });
    
    return [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  };

  const generateDefectsCSV = (defects: any[]): string => {
    const headers = ['Titel', 'Beschreibung', 'Status', 'Priorität', 'Verantwortlich', 'Erstellt am'];
    const rows = defects.map(defect => {
      const assignedTo = defect.profiles ? `${defect.profiles.first_name || ''} ${defect.profiles.last_name || ''}`.trim() : 'Nicht zugewiesen';
      const statusLabel = defect.status === 'done' ? 'Behoben' : defect.status === 'in-progress' ? 'In Bearbeitung' : 'Offen';
      const priorityLabel = defect.priority === 'high' ? 'Hoch' : defect.priority === 'medium' ? 'Mittel' : 'Niedrig';
      
      return [
        defect.title,
        defect.description || '',
        statusLabel,
        priorityLabel,
        assignedTo,
        formatDateTime(defect.created_at)
      ];
    });
    
    return [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  };

  const generateDiaryCSV = (entries: any[]): string => {
    const headers = ['Datum', 'Wetter', 'Temperatur', 'Mitarbeiter', 'Anwesende', 'Arbeiten', 'Fortschritt', 'Ereignisse', 'Lieferungen', 'Erstellt von', 'Erstellt am'];
    const rows = entries.map(entry => {
      const creatorName = entry.profiles ? `${entry.profiles.first_name || ''} ${entry.profiles.last_name || ''}`.trim() : 'Unbekannt';
      
      return [
        formatDate(entry.entry_date),
        entry.weather || '',
        entry.temperature ? `${entry.temperature}°C` : '',
        entry.workers_present || '',
        entry.workers_list || '',
        entry.work_performed || '',
        entry.progress_notes || '',
        entry.special_events || '',
        entry.deliveries || '',
        creatorName,
        formatDateTime(entry.created_at)
      ];
    });
    
    return [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  };

  const generateDocumentationCSV = (notes: any[]): string => {
    const headers = ['Datum', 'Inhalt', 'Erstellt von', 'Angeheftet', 'Bearbeitet'];
    const rows = notes.map(note => {
      const userName = note.profiles ? `${note.profiles.first_name || ''} ${note.profiles.last_name || ''}`.trim() : 'Unbekannt';
      
      return [
        formatDateTime(note.created_at),
        note.content,
        userName,
        note.is_pinned ? 'Ja' : 'Nein',
        note.is_edited ? formatDateTime(note.edited_at) : 'Nein'
      ];
    });
    
    return [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  };

  const generateParticipantsCSV = (members: any[]): string => {
    const headers = ['Name', 'E-Mail', 'Telefon', 'Rolle'];
    const rows = members.map(member => {
      const name = member.profiles ? `${member.profiles.first_name || ''} ${member.profiles.last_name || ''}`.trim() : 'Unbekannt';
      
      return [
        name,
        member.profiles?.email || '',
        member.profiles?.phone || '',
        member.role || 'Mitglied'
      ];
    });
    
    return [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  };

  const generateTimelineCSV = (milestones: any[]): string => {
    const headers = ['Meilenstein', 'Beschreibung', 'Startdatum', 'Enddatum', 'Typ'];
    const rows = milestones.map(milestone => {
      const eventType = milestone.event_type || 'milestone';
      const typeLabel = eventType === 'deadline' ? 'Deadline' : eventType === 'meeting' ? 'Meeting' : 'Meilenstein';
      
      return [
        milestone.title,
        milestone.description || '',
        milestone.start_date ? formatDate(milestone.start_date) : '',
        milestone.end_date ? formatDate(milestone.end_date) : '',
        typeLabel
      ];
    });
    
    return [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  };

  const generateCompleteCSV = (data: any): string => {
    let csv = '=== PROJEKTSTATUS ===\n';
    csv += `Gesamtaufgaben,${data.tasks.length}\n`;
    csv += `Erledigte Aufgaben,${data.tasks.filter((t: any) => t.status === 'done').length}\n`;
    csv += `Mängel,${data.tasks.filter((t: any) => t.task_type === 'defect').length}\n`;
    csv += `Teammitglieder,${data.members.length}\n\n`;

    csv += '=== AUFGABEN ===\n';
    csv += generateTasksCSV(data.tasks.filter((t: any) => t.task_type === 'task')) + '\n\n';

    csv += '=== MÄNGEL ===\n';
    csv += generateDefectsCSV(data.tasks.filter((t: any) => t.task_type === 'defect')) + '\n\n';

    csv += '=== MEILENSTEINE ===\n';
    csv += generateTimelineCSV(data.milestones) + '\n\n';

    csv += '=== TEAM ===\n';
    csv += generateParticipantsCSV(data.members);

    return csv;
  };

  const downloadPDF = (htmlContent: string, filename: string) => {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadCSV = (csvContent: string, filename: string) => {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleScheduleReport = () => {
    showToast('Automatische Report-Versendung folgt', 'info');
  };

  if (loading) {
    return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>);
  }

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
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>Projekt-Kennzahlen</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalTasks}</Text>
              <Text style={styles.statLabel}>Aufgaben</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.completedTasks}</Text>
              <Text style={styles.statLabel}>Erledigt</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalDefects}</Text>
              <Text style={styles.statLabel}>Mängel</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.teamMembers}</Text>
              <Text style={styles.statLabel}>Team</Text>
            </View>
          </View>
          <View style={styles.progressSection}>
            <Text style={styles.progressLabel}>Projektfortschritt</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0}%` }]} />
            </View>
            <Text style={styles.progressText}>{stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%</Text>
          </View>
        </Card>

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
                      {report.formats.includes('pdf') && (
                        <View style={[styles.formatBadge, { backgroundColor: '#DC2626' }]}>
                          <Text style={styles.formatBadgeText}>PDF</Text>
                        </View>
                      )}
                      {report.formats.includes('csv') && (
                        <View style={[styles.formatBadge, { backgroundColor: '#3B82F6' }]}>
                          <Text style={styles.formatBadgeText}>CSV</Text>
                        </View>
                      )}
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

      <ModernModal
        visible={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title={`${selectedReport?.title} exportieren`}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalLabel}>Export-Format wählen</Text>
          <View style={styles.formatOptions}>
            {selectedReport?.formats.includes('pdf') && (
              <TouchableOpacity
                style={[styles.formatOption, exportFormat === 'pdf' && styles.formatOptionActive]}
                onPress={() => setExportFormat('pdf')}
              >
                <FileText size={24} color={exportFormat === 'pdf' ? colors.primary : '#64748b'} />
                <Text style={[styles.formatOptionText, exportFormat === 'pdf' && styles.formatOptionTextActive]}>
                  PDF (HTML)
                </Text>
                <Text style={styles.formatOptionDesc}>Visuell formatiertes Dokument</Text>
              </TouchableOpacity>
            )}
            {selectedReport?.formats.includes('csv') && (
              <TouchableOpacity
                style={[styles.formatOption, exportFormat === 'csv' && styles.formatOptionActive]}
                onPress={() => setExportFormat('csv')}
              >
                <FileSpreadsheet size={24} color={exportFormat === 'csv' ? colors.primary : '#64748b'} />
                <Text style={[styles.formatOptionText, exportFormat === 'csv' && styles.formatOptionTextActive]}>
                  CSV
                </Text>
                <Text style={styles.formatOptionDesc}>Daten für Excel/Tabellen</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setIsExportModalOpen(false)}
            >
              <X size={18} color="#64748b" />
              <Text style={styles.modalCancelText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalExportButton, exporting && styles.modalExportButtonDisabled]}
              onPress={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Download size={18} color="#ffffff" />
                  <Text style={styles.modalExportText}>Exportieren</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ModernModal>
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
  progressFill: { height: '100%', backgroundColor: colors.primary },
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
  modalContent: { gap: 20 },
  modalLabel: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
  formatOptions: { flexDirection: 'row', gap: 12 },
  formatOption: { flex: 1, padding: 20, borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, alignItems: 'center', gap: 8 },
  formatOptionActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  formatOptionText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  formatOptionTextActive: { color: colors.primary },
  formatOptionDesc: { fontSize: 12, color: '#94a3b8', textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end', marginTop: 10 },
  modalCancelButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#F1F5F9', borderRadius: 12 },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  modalExportButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: colors.primary, borderRadius: 12 },
  modalExportButtonDisabled: { backgroundColor: '#CBD5E1' },
  modalExportText: { fontSize: 15, fontWeight: '600', color: '#ffffff' }
});

