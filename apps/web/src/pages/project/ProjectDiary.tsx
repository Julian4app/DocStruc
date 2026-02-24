import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { LottieLoader } from '../../components/LottieLoader';

import { Card, Button, Input } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { ModernModal } from '../../components/ModernModal';
import { useProjectPermissionContext } from '../../components/PermissionGuard';
import { useContentVisibility } from '../../hooks/useContentVisibility';
import { VisibilityBadge, VisibilityDropdown, VisibilitySelector, VisibilityLevel } from '../../components/VisibilityControls';
import { DatePicker } from '../../components/DatePicker';
import { SearchableSelect } from '../../components/SearchableSelect';
import { useToast } from '../../components/ToastProvider';
import { useAuth } from '../../contexts/AuthContext';
import { LoadMoreButton } from '../../components/LoadMoreButton';
import { BookOpen, Plus, Calendar, CloudRain, Sun, Cloud, Users, Truck, Download, FileText, Clock, History, Pencil, Save, AlertCircle } from 'lucide-react';

interface DiaryHistoryItem {
  id: string;
  diary_entry_id: string;
  changed_by: string;
  changed_at: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  change_type: string;
  changer_name?: string;
}

interface DiaryEntry {
  id: string;
  project_id: string;
  entry_date: string;
  weather: string;
  temperature?: number;
  workers_present?: number;
  workers_list?: string;
  work_performed: string;
  progress_notes?: string;
  special_events?: string;
  deliveries?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  updated_by?: string;
  creator_name?: string;
}

interface ProjectMember {
  user_id: string;
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export function ProjectDiary() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const { userId } = useAuth();
  const ctx = useProjectPermissionContext();
  const pCanCreate = ctx?.isProjectOwner || ctx?.canCreate?.('diary') || false;
  const pCanEdit = ctx?.isProjectOwner || ctx?.canEdit?.('diary') || false;
  const pCanDelete = ctx?.isProjectOwner || ctx?.canDelete?.('diary') || false;
  const { defaultVisibility, filterVisibleItems, setContentVisibility } = useContentVisibility(id, 'diary');
  const [createVisibility, setCreateVisibility] = useState<VisibilityLevel>('all_participants');
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Edit state
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // History state
  const [historyEntry, setHistoryEntry] = useState<DiaryEntry | null>(null);
  const [historyItems, setHistoryItems] = useState<DiaryHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Pagination state
  const DIARY_PAGE_SIZE = 30;
  const [hasMoreEntries, setHasMoreEntries] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalEntries, setTotalEntries] = useState<number | null>(null);
  
  // Form state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [weather, setWeather] = useState<'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'stormy' | 'foggy'>('sunny');
  const [temperature, setTemperature] = useState('');
  const [manualWorkerCount, setManualWorkerCount] = useState('');
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [workPerformed, setWorkPerformed] = useState('');
  const [progressNotes, setProgressNotes] = useState('');
  const [specialEvents, setSpecialEvents] = useState('');
  const [deliveries, setDeliveries] = useState('');
  const [loadingWeather, setLoadingWeather] = useState(false);
  
  // Export state
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [exportTimeframe, setExportTimeframe] = useState<'all' | 'custom'>('all');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (id) {
      loadDiaryEntries();
      loadProjectMembers();
      loadWeatherForToday();
    }
  }, [id]);

  useEffect(() => {
    // Load weather when date changes
    if (selectedDate) {
      loadWeatherForDate(selectedDate);
    }
  }, [selectedDate]);

  const loadProjectMembers = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('project_members')
        .select(`
          user_id,
          profiles:user_id(id, first_name, last_name, email)
        `)
        .eq('project_id', id);

      if (error) throw error;
      
      // Transform data to match ProjectMember interface
      const transformed: ProjectMember[] = (data || []).map((item: any) => ({
        user_id: item.user_id,
        profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
      }));
      
      setProjectMembers(transformed);
    } catch (error: any) {
      console.error('Error loading project members:', error);
    }
  };

  const loadWeatherForToday = async () => {
    const today = new Date().toISOString().split('T')[0];
    await loadWeatherForDate(today);
  };

  const loadWeatherForDate = async (dateStr: string) => {
    setLoadingWeather(true);
    try {
      // DWD Bright Sky API - Free weather data for Germany
      // Using Frankfurt as default location (lat: 50.1109, lon: 8.6821)
      // For production, you'd want to get project location coordinates
      const date = new Date(dateStr);
      const apiDate = date.toISOString().split('T')[0];
      
      const response = await fetch(
        `https://api.brightsky.dev/weather?lat=50.1109&lon=8.6821&date=${apiDate}`
      );
      
      if (!response.ok) throw new Error('Weather API failed');
      
      const data = await response.json();
      
      if (data.weather && data.weather.length > 0) {
        // Get midday weather (around 12:00)
        const middayWeather = data.weather.find((w: any) => {
          const hour = new Date(w.timestamp).getHours();
          return hour >= 11 && hour <= 13;
        }) || data.weather[Math.floor(data.weather.length / 2)];
        
        // Map DWD conditions to our weather types
        const condition = middayWeather.condition;
        const precipitation = middayWeather.precipitation || 0;
        const cloudCover = middayWeather.cloud_cover || 0;
        
        let weatherType: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'stormy' | 'foggy' = 'sunny';
        
        if (condition?.includes('snow')) weatherType = 'snowy';
        else if (condition?.includes('thunderstorm')) weatherType = 'stormy';
        else if (condition?.includes('fog')) weatherType = 'foggy';
        else if (precipitation > 1 || condition?.includes('rain')) weatherType = 'rainy';
        else if (cloudCover > 60) weatherType = 'cloudy';
        
        setWeather(weatherType);
        setTemperature(Math.round(middayWeather.temperature || 15).toString());
      } else {
        throw new Error('No weather data available');
      }
    } catch (error) {
      console.error('Error loading weather:', error);
      // Fallback to simulation if API fails
      const date = new Date(dateStr);
      const month = date.getMonth();
      const baseTemp = [-2, 0, 5, 10, 15, 20, 22, 21, 17, 11, 5, 1][month];
      const variance = Math.floor(Math.random() * 10) - 5;
      setTemperature((baseTemp + variance).toString());
      setWeather('cloudy');
    } finally {
      setLoadingWeather(false);
    }
  };

  const loadDiaryEntries = async () => {
    if (!id) return;
    setLoading(true);

    try {
      const { data, error, count } = await supabase
        .from('diary_entries')
        .select(`
          *,
          profiles!diary_entries_created_by_fkey(first_name, last_name, email)
        `, { count: 'exact' })
        .eq('project_id', id)
        .order('entry_date', { ascending: false })
        .range(0, DIARY_PAGE_SIZE - 1);

      if (error) throw error;

      const transformed: DiaryEntry[] = (data || []).map((entry: any) => ({
        ...entry,
        creator_name: entry.profiles 
          ? `${entry.profiles.first_name || ''} ${entry.profiles.last_name || ''}`.trim() || entry.profiles.email
          : 'Unbekannt'
      }));

      // Show data immediately — release spinner as soon as DB responds
      setEntries(transformed);
      setHasMoreEntries((data || []).length === DIARY_PAGE_SIZE);
      if (count !== null) setTotalEntries(count);
      setLoading(false);
      // Apply visibility filtering in the background (non-blocking)
      filterVisibleItems(transformed)
        .then(visible => setEntries(visible))
        .catch(err => console.error('Error filtering visible diary entries:', err));
    } catch (error: any) {
      console.error('Error loading diary entries:', error);
      showToast('Fehler beim Laden der Einträge', 'error');
      setLoading(false);
    }
  };

  const loadMoreEntries = async () => {
    if (!id || loadingMore || !hasMoreEntries) return;
    setLoadingMore(true);

    try {
      const from = entries.length;
      const to = from + DIARY_PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('diary_entries')
        .select(`
          *,
          profiles!diary_entries_created_by_fkey(first_name, last_name, email)
        `)
        .eq('project_id', id)
        .order('entry_date', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const transformed: DiaryEntry[] = (data || []).map((entry: any) => ({
        ...entry,
        creator_name: entry.profiles 
          ? `${entry.profiles.first_name || ''} ${entry.profiles.last_name || ''}`.trim() || entry.profiles.email
          : 'Unbekannt'
      }));

      let visibleMore = transformed;
      try {
        visibleMore = await filterVisibleItems(transformed);
      } catch (err) {
        console.error('Error filtering visible diary entries:', err);
      }

      setEntries(prev => [...prev, ...visibleMore]);
      setHasMoreEntries((data || []).length === DIARY_PAGE_SIZE);
    } catch (error: any) {
      console.error('Error loading more diary entries:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCreateEntry = async () => {
    if (!selectedDate || !workPerformed.trim()) {
      showToast('Bitte Datum und Arbeiten eingeben', 'error');
      return;
    }

    try {
      if (!userId) throw new Error('Nicht authentifiziert');

      // Get selected worker names
      const workerNames = selectedWorkers
        .map(wId => {
          const member = projectMembers.find(m => m.user_id === wId);
          if (member?.profiles?.email) {
            return `${member.profiles.first_name || ''} ${member.profiles.last_name || ''}`.trim() || member.profiles.email;
          }
          return null;
        })
        .filter(Boolean)
        .join(', ');

      // Calculate total workers: manual count + selected workers
      const manualCount = manualWorkerCount ? parseInt(manualWorkerCount) : 0;
      const totalWorkers = manualCount + selectedWorkers.length;
      
      const { data: newEntry, error } = await supabase
        .from('diary_entries')
        .insert({
          project_id: id,
          entry_date: selectedDate,
          weather,
          temperature: temperature ? parseInt(temperature) : null,
          workers_present: totalWorkers,
          workers_list: workerNames,
          work_performed: workPerformed,
          progress_notes: progressNotes || null,
          special_events: specialEvents || null,
          deliveries: deliveries || null,
          created_by: userId
        })
        .select()
        .single();

      if (error) throw error;

      // Set content visibility override if not default
      if (newEntry && createVisibility !== 'all_participants') {
        await setContentVisibility(newEntry.id, createVisibility);
      }

      showToast('Eintrag erfolgreich erstellt', 'success');
      setIsCreateModalOpen(false);
      setCreateVisibility(defaultVisibility || 'all_participants');
      resetForm();
      loadDiaryEntries();
    } catch (error: any) {
      console.error('Error creating entry:', error);
      showToast(error.message || 'Fehler beim Erstellen', 'error');
    }
  };

  const openEditModal = (entry: DiaryEntry) => {
    setEditingEntry({ ...entry });
    // Pre-fill form fields for editing
    setSelectedDate(entry.entry_date);
    setWeather(entry.weather as any);
    setTemperature(entry.temperature?.toString() || '');
    setManualWorkerCount(entry.workers_present?.toString() || '');
    setWorkPerformed(entry.work_performed);
    setProgressNotes(entry.progress_notes || '');
    setSpecialEvents(entry.special_events || '');
    setDeliveries(entry.deliveries || '');
  };

  const handleSaveEdit = async () => {
    if (!editingEntry || !userId) return;
    setIsSaving(true);

    try {
      const manualCount = manualWorkerCount ? parseInt(manualWorkerCount) || 0 : 0;
      const totalWorkers = manualCount + selectedWorkers.length;
      const newTemp = temperature ? parseInt(temperature) : null;

      const updates: Partial<DiaryEntry> = {
        entry_date: selectedDate,
        weather,
        temperature: newTemp ?? undefined,
        workers_present: totalWorkers > 0 ? totalWorkers : undefined,
        work_performed: workPerformed,
        progress_notes: progressNotes || undefined,
        special_events: specialEvents || undefined,
        deliveries: deliveries || undefined,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      };

      // Build history records by comparing old vs new values
      // Use normalised strings so null/""/undefined all compare as ''
      const norm = (v: any): string => (v == null || v === 'undefined' ? '' : String(v).trim());

      const fieldComparisons: Array<{ field: string; label: string; oldVal: string; newVal: string }> = [
        { field: 'entry_date',     label: 'Datum',                    oldVal: norm(editingEntry.entry_date),     newVal: norm(selectedDate) },
        { field: 'weather',        label: 'Wetter',                   oldVal: norm(editingEntry.weather),        newVal: norm(weather) },
        { field: 'temperature',    label: 'Temperatur',               oldVal: norm(editingEntry.temperature),    newVal: norm(newTemp) },
        { field: 'workers_present',label: 'Mitarbeiter (Anzahl)',     oldVal: norm(editingEntry.workers_present),newVal: norm(totalWorkers > 0 ? totalWorkers : null) },
        { field: 'work_performed', label: 'Durchgeführte Arbeiten',   oldVal: norm(editingEntry.work_performed), newVal: norm(workPerformed) },
        { field: 'progress_notes', label: 'Fortschrittsnotizen',      oldVal: norm(editingEntry.progress_notes), newVal: norm(progressNotes) },
        { field: 'special_events', label: 'Besondere Vorkommnisse',   oldVal: norm(editingEntry.special_events), newVal: norm(specialEvents) },
        { field: 'deliveries',     label: 'Lieferungen',              oldVal: norm(editingEntry.deliveries),     newVal: norm(deliveries) },
      ];

      const historyInserts: any[] = [];
      for (const { label, oldVal, newVal } of fieldComparisons) {
        if (oldVal !== newVal) {
          historyInserts.push({
            diary_entry_id: editingEntry.id,
            project_id: editingEntry.project_id,
            changed_by: userId,
            field_name: label,
            old_value: oldVal || null,
            new_value: newVal || null,
            change_type: 'edit',
          });
        }
      }

      const { error } = await supabase
        .from('diary_entries')
        .update(updates)
        .eq('id', editingEntry.id);

      if (error) throw error;

      // Insert history records
      if (historyInserts.length > 0) {
        const { error: hErr } = await supabase.from('diary_entry_history').insert(historyInserts);
        if (hErr) {
          console.error('History insert failed:', hErr);
          showToast(`Verlauf konnte nicht gespeichert werden: ${hErr.message}`, 'error');
        }
      }

      showToast('Eintrag erfolgreich aktualisiert', 'success');
      setEditingEntry(null);
      resetForm();
      loadDiaryEntries();
    } catch (error: any) {
      console.error('Error updating entry:', error);
      showToast(error.message || 'Fehler beim Speichern', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const loadHistory = async (entry: DiaryEntry) => {
    setHistoryEntry(entry);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    setHistoryItems([]);
    setHistoryError(null);
    try {
      // Step 1: fetch raw history rows (no join — changed_by refs auth.users, not public.profiles)
      const { data, error } = await supabase
        .from('diary_entry_history')
        .select('*')
        .eq('diary_entry_id', entry.id)
        .order('changed_at', { ascending: false });

      if (error) {
        console.error('Error loading history:', error);
        setHistoryError(
          error.code === '42P01'
            ? 'Verlaufstabelle nicht gefunden. Bitte führe die SQL-Migration in Supabase aus.'
            : `Fehler: ${error.message}`
        );
        return;
      }

      // Step 2: collect unique changer UUIDs and fetch names from public.profiles
      const rows = data || [];
      const changerIds = [...new Set(rows.map((r: any) => r.changed_by).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (changerIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', changerIds);
        (profileData || []).forEach((p: any) => {
          profileMap[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || 'Unbekannt';
        });
      }

      // Step 3: merge
      const transformed: DiaryHistoryItem[] = rows.map((item: any) => ({
        ...item,
        changer_name: item.changed_by ? (profileMap[item.changed_by] || 'Unbekannt') : 'Unbekannt',
      }));
      setHistoryItems(transformed);
    } catch (error: any) {
      console.error('Error loading history:', error);
      setHistoryError('Unerwarteter Fehler beim Laden des Verlaufs.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    
    try {
      let entriesToExport = entries;

      if (exportTimeframe === 'custom' && exportStartDate && exportEndDate) {
        entriesToExport = entries.filter(entry => {
          const entryDate = new Date(entry.entry_date);
          const startDate = new Date(exportStartDate);
          const endDate = new Date(exportEndDate);
          return entryDate >= startDate && entryDate <= endDate;
        });
      }

      if (entriesToExport.length === 0) {
        showToast('Keine Einträge für den ausgewählten Zeitraum', 'error');
        setExporting(false);
        return;
      }

      if (exportFormat === 'pdf') {
        await generateRealPDF(entriesToExport);
      } else {
        const csv = generateCSVContent(entriesToExport);
        downloadCSV(csv, `Bautagebuch_${new Date().toISOString().split('T')[0]}.csv`);
      }
      
      showToast('Export erfolgreich!', 'success');
      setIsExportModalOpen(false);
    } catch (error: any) {
      console.error('Error exporting:', error);
      showToast('Fehler beim Exportieren', 'error');
    } finally {
      setExporting(false);
    }
  };

  const generateCSVContent = (entriesToExport: DiaryEntry[]) => {
    const headers = ['Datum', 'Wetter', 'Temperatur', 'Mitarbeiter', 'Anwesende', 'Arbeiten', 'Fortschritt', 'Ereignisse', 'Lieferungen', 'Erstellt von', 'Erstellt am'];
    const rows = entriesToExport.map(entry => [
      formatDate(entry.entry_date),
      getWeatherLabel(entry.weather),
      entry.temperature ? `${entry.temperature}°C` : '',
      entry.workers_present || '',
      entry.workers_list || '',
      entry.work_performed || '',
      entry.progress_notes || '',
      entry.special_events || '',
      entry.deliveries || '',
      entry.creator_name || '',
      formatDateTime(entry.created_at)
    ]);
    return [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  };

  const generateRealPDF = async (entriesToExport: DiaryEntry[]) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 18;
    const pageW = doc.internal.pageSize.width;
    const pageH = doc.internal.pageSize.height;
    const contentW = pageW - margin * 2;
    let y = margin;

    const NAVY  = [14, 42, 71] as const;
    const SLATE = [71, 85, 105] as const;
    const LIGHT = [248, 250, 252] as const;
    const BORDER= [226, 232, 240] as const;
    const AMBER = [245, 158, 11] as const;
    const TEXT  = [15, 23, 42] as const;
    const MUTED = [148, 163, 184] as const;

    const checkPage = (needed: number) => {
      if (y + needed > pageH - margin) {
        doc.addPage();
        y = margin;
        // Repeat header stripe on new pages
        doc.setFillColor(...NAVY);
        doc.rect(0, 0, pageW, 8, 'F');
        y = 14;
      }
    };

    // ── Header stripe ──
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 38, 'F');

    // Logo square
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, 6, 22, 22, 3, 3, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text('DS', margin + 5.5, 21);

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Bautagebuch', margin + 28, 16);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text('DocStruc · Baudokumentation', margin + 28, 23);

    // Amber accent bar
    doc.setFillColor(...AMBER);
    doc.rect(0, 38, pageW, 2.5, 'F');
    y = 48;

    // Meta line
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE);
    doc.text(`Exportiert am ${formatDateTime(new Date().toISOString())}  ·  ${entriesToExport.length} Einträge`, margin, y);
    y += 8;

    // Divider
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    // ── Entries ──
    entriesToExport.forEach((entry, idx) => {
      checkPage(40);

      // Date header band
      doc.setFillColor(...LIGHT);
      doc.roundedRect(margin, y, contentW, 11, 2, 2, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text(formatDate(entry.entry_date), margin + 4, y + 7.5);

      // Weather + workers badges (right side)
      const meta = `${getWeatherLabel(entry.weather)}${entry.temperature != null ? `  ·  ${entry.temperature}°C` : ''}${entry.workers_present ? `  ·  ${entry.workers_present} Mitarbeiter` : ''}`;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...SLATE);
      const metaW = doc.getTextWidth(meta);
      doc.text(meta, pageW - margin - metaW, y + 7.5);
      y += 14;

      const section = (label: string, text: string | undefined | null) => {
        if (!text) return;
        checkPage(12);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...MUTED);
        doc.text(label.toUpperCase(), margin + 2, y);
        y += 4;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...TEXT);
        const lines = doc.splitTextToSize(text, contentW - 4);
        lines.forEach((line: string) => {
          checkPage(6);
          doc.text(line, margin + 2, y);
          y += 5.5;
        });
        y += 2;
      };

      if (entry.workers_list) section('Anwesende Mitarbeiter', entry.workers_list);
      section('Durchgeführte Arbeiten', entry.work_performed);
      if (entry.progress_notes)  section('Fortschrittsnotizen', entry.progress_notes);
      if (entry.special_events)  section('Besondere Vorkommnisse', entry.special_events);
      if (entry.deliveries)      section('Lieferungen', entry.deliveries);

      // Footer line
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...MUTED);
      doc.text(`Erstellt von ${entry.creator_name || 'Unbekannt'}  ·  ${formatDateTime(entry.created_at)}`, margin + 2, y);
      y += 4;

      // Separator (except after last entry)
      if (idx < entriesToExport.length - 1) {
        checkPage(4);
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageW - margin, y);
        y += 5;
      }
    });

    // ── Page footer on every page ──
    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      doc.text(
        `Seite ${p} von ${totalPages}  ·  © ${new Date().getFullYear()} DocStruc`,
        pageW / 2, pageH - 8,
        { align: 'center' }
      );
    }

    doc.save(`Bautagebuch_${new Date().toISOString().split('T')[0]}.pdf`);
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

  const resetForm = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setWeather('sunny');
    setTemperature('');
    setManualWorkerCount('');
    setSelectedWorkers([]);
    setWorkPerformed('');
    setProgressNotes('');
    setSpecialEvents('');
    setDeliveries('');
    loadWeatherForToday();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getWeatherIcon = (weather: string) => {
    switch (weather) {
      case 'sunny': return <Sun size={20} color="#F59E0B" />;
      case 'cloudy': return <Cloud size={20} color="#94a3b8" />;
      case 'rainy': return <CloudRain size={20} color="#3B82F6" />;
      case 'snowy': return <Cloud size={20} color="#60A5FA" />;
      case 'stormy': return <CloudRain size={20} color="#7C3AED" />;
      case 'foggy': return <Cloud size={20} color="#6B7280" />;
      default: return <Sun size={20} color="#F59E0B" />;
    }
  };

  const getWeatherLabel = (weather: string) => {
    switch (weather) {
      case 'sunny': return 'Sonnig';
      case 'cloudy': return 'Bewölkt';
      case 'rainy': return 'Regnerisch';
      case 'snowy': return 'Schnee';
      case 'stormy': return 'Sturm';
      case 'foggy': return 'Neblig';
      default: return weather;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LottieLoader size={120} />
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Bautagebuch</Text>
            <Text style={styles.pageSubtitle}>
              Tägliche Dokumentation des Baufortschritts
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button variant="outline" onClick={() => setIsExportModalOpen(true)}>
              <Download size={18} /> Bericht
            </Button>
            {pCanCreate && (
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus size={18} /> Eintrag
              </Button>
            )}
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <BookOpen size={24} color="#3B82F6" />
              <Text style={styles.statValue}>{entries.length}</Text>
              <Text style={styles.statLabel}>Einträge</Text>
            </Card>
            <Card style={styles.statCard}>
              <Calendar size={24} color="#10B981" />
              <Text style={styles.statValue}>
                {entries.length > 0 ? Math.ceil((Date.now() - new Date(entries[entries.length - 1].entry_date).getTime()) / (1000 * 60 * 60 * 24)) : 0}
              </Text>
              <Text style={styles.statLabel}>Bautage</Text>
            </Card>
            <Card style={styles.statCard}>
              <Users size={24} color="#F59E0B" />
              <Text style={styles.statValue}>
                {entries.reduce((sum, e) => sum + (e.workers_present || 0), 0)}
              </Text>
              <Text style={styles.statLabel}>MA-Einsätze</Text>
            </Card>
          </View>

          {entries.length === 0 ? (
            <Card style={styles.emptyCard}>
              <BookOpen size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>Noch keine Bautagebuch-Einträge</Text>
            </Card>
          ) : (
            <View style={styles.entriesList}>
              {entries.map(entry => (
                <Card key={entry.id} style={styles.entryCard}>
                  <View style={styles.entryHeader}>
                    <View style={styles.entryDateRow}>
                      <Calendar size={18} color={colors.primary} />
                      <Text style={styles.entryDate}>{formatDate(entry.entry_date)}</Text>
                      {defaultVisibility !== 'all_participants' && (
                        <VisibilityBadge visibility={defaultVisibility} size="small" />
                      )}
                      {/* Spacer */}
                      <View style={{ flex: 1 }} />
                      {/* History icon button */}
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => loadHistory(entry)}
                        accessibilityLabel="Änderungsverlauf anzeigen"
                      >
                        <History size={16} color="#64748b" />
                      </TouchableOpacity>
                      {/* Edit icon button */}
                      {pCanEdit && (
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => openEditModal(entry)}
                          accessibilityLabel="Eintrag bearbeiten"
                        >
                          <Pencil size={16} color={colors.primary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <View style={styles.entryMeta}>
                    <View style={styles.metaItem}>
                      {getWeatherIcon(entry.weather)}
                      <Text style={styles.metaText}>
                        {getWeatherLabel(entry.weather)}
                        {entry.temperature != null && ` • ${entry.temperature}°C`}
                      </Text>
                    </View>
                    {/* Show workers even when 0 — consistent design */}
                    <View style={styles.metaItem}>
                      <Users size={16} color="#64748b" />
                      <Text style={styles.metaText}>{entry.workers_present ?? 0} Mitarbeiter</Text>
                    </View>
                  </View>
                  {entry.workers_list && (
                    <View style={styles.entrySection}>
                      <Text style={styles.entrySectionTitle}>Anwesende Mitarbeiter</Text>
                      <Text style={styles.entrySectionText}>{entry.workers_list}</Text>
                    </View>
                  )}
                  {entry.work_performed && (
                    <View style={styles.entrySection}>
                      <Text style={styles.entrySectionTitle}>Durchgeführte Arbeiten</Text>
                      <Text style={styles.entrySectionText}>{entry.work_performed}</Text>
                    </View>
                  )}
                  {entry.progress_notes && (
                    <View style={styles.entrySection}>
                      <Text style={styles.entrySectionTitle}>Fortschrittsnotizen</Text>
                      <Text style={styles.entrySectionText}>{entry.progress_notes}</Text>
                    </View>
                  )}
                  {entry.special_events && (
                    <View style={styles.entrySection}>
                      <Text style={styles.entrySectionTitle}>Besondere Vorkommnisse</Text>
                      <Text style={styles.entrySectionText}>{entry.special_events}</Text>
                    </View>
                  )}
                  {entry.deliveries && (
                    <View style={styles.entrySection}>
                      <View style={styles.deliveryHeader}>
                        <Truck size={16} color="#10B981" />
                        <Text style={styles.entrySectionTitle}>Lieferungen</Text>
                      </View>
                      <Text style={styles.entrySectionText}>{entry.deliveries}</Text>
                    </View>
                  )}
                  <View style={styles.entryFooter}>
                    <Text style={styles.entryCreator}>
                      Erstellt von: {entry.creator_name} • {formatDateTime(entry.created_at)}
                      {entry.updated_at && (
                        <Text style={styles.entryUpdated}> · Bearbeitet: {formatDateTime(entry.updated_at)}</Text>
                      )}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          )}

          {/* Load More */}
          <LoadMoreButton
            onLoadMore={loadMoreEntries}
            loading={loadingMore}
            hasMore={hasMoreEntries}
            loadedCount={entries.length}
            totalCount={totalEntries}
            label="Ältere Einträge laden"
          />
        </ScrollView>
      </View>

      {/* Create Entry Modal */}
      <ModernModal
        visible={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); resetForm(); }}
        title="Neuer Bautagebuch-Eintrag"
      >
        <View style={styles.modalContent}>
          {/* Visibility selector (Freigaben) — at top */}
          <View style={{ marginBottom: 8 }}>
            <VisibilityDropdown
              value={createVisibility}
              onChange={setCreateVisibility}
            />
          </View>

          <DatePicker 
            label="Datum *" 
            value={selectedDate} 
            onChange={setSelectedDate}
            placeholder="TT.MM.JJJJ"
          />
          
          <View>
            <Text style={styles.inputLabel}>Wetter (wird automatisch geladen)</Text>
            <View style={styles.weatherGrid}>
              {(['sunny', 'cloudy', 'rainy', 'snowy', 'stormy', 'foggy'] as const).map((w) => (
                <TouchableOpacity
                  key={w}
                  style={[styles.weatherOption, weather === w && styles.weatherOptionActive]}
                  onPress={() => setWeather(w)}
                >
                  {getWeatherIcon(w)}
                  <Text style={styles.weatherOptionText}>{getWeatherLabel(w)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <Input 
            label="Temperatur (°C)" 
            value={temperature} 
            onChangeText={setTemperature} 
            placeholder="Automatisch geladen" 
          />
          
          <Input 
            label="Zusätzliche Mitarbeiter (Anzahl)" 
            value={manualWorkerCount} 
            onChangeText={setManualWorkerCount} 
            placeholder="z.B. 5 externe Mitarbeiter" 
            keyboardType="numeric"
          />
          
          <SearchableSelect
            label="Anwesende Projektmitarbeiter"
            options={projectMembers
              .filter(member => member.profiles?.email)
              .map(member => ({
                label: `${member.profiles.first_name || ''} ${member.profiles.last_name || ''}`.trim() || member.profiles.email,
                value: member.user_id
              }))}
            values={selectedWorkers}
            onChange={setSelectedWorkers}
            placeholder="Mitarbeiter auswählen..."
            multi
          />
          
          <Text style={styles.workerCountInfo}>
            Gesamt: {(manualWorkerCount ? parseInt(manualWorkerCount) || 0 : 0) + selectedWorkers.length} Mitarbeiter
          </Text>
          
          <Input 
            label="Durchgeführte Arbeiten *" 
            value={workPerformed} 
            onChangeText={setWorkPerformed} 
            placeholder="Beschreibung der durchgeführten Arbeiten..." 
            multiline 
            numberOfLines={4} 
          />
          
          <Input 
            label="Fortschrittsnotizen" 
            value={progressNotes} 
            onChangeText={setProgressNotes} 
            placeholder="Zusätzliche Notizen zum Baufortschritt..." 
            multiline
            numberOfLines={3}
          />
          
          <Input 
            label="Besondere Vorkommnisse" 
            value={specialEvents} 
            onChangeText={setSpecialEvents} 
            placeholder="z.B. Abnahmen, Besprechungen, Besuche..." 
            multiline 
          />
          
          <Input 
            label="Lieferungen" 
            value={deliveries} 
            onChangeText={setDeliveries} 
            placeholder="z.B. Materiallieferungen, Geräte..." 
            multiline 
          />
          
          <View style={styles.modalActions}>
            <Button variant="outline" onClick={() => { setIsCreateModalOpen(false); resetForm(); }} style={{ flex: 1 }}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateEntry} style={{ flex: 1 }} disabled={!workPerformed.trim()}>
              Erstellen
            </Button>
          </View>
        </View>
      </ModernModal>

      {/* Export Modal */}
      <ModernModal
        visible={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Bautagebuch exportieren"
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalLabel}>Format</Text>
          <View style={styles.formatOptions}>
            <TouchableOpacity
              style={[styles.formatOption, exportFormat === 'pdf' && styles.formatOptionActive]}
              onPress={() => setExportFormat('pdf')}
            >
              <FileText size={20} color={exportFormat === 'pdf' ? colors.primary : '#64748b'} />
              <Text style={[
                styles.formatOptionText,
                exportFormat === 'pdf' && styles.formatOptionTextActive
              ]}>
                PDF Bericht
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.formatOption, exportFormat === 'excel' && styles.formatOptionActive]}
              onPress={() => setExportFormat('excel')}
            >
              <FileText size={20} color={exportFormat === 'excel' ? colors.primary : '#64748b'} />
              <Text style={[
                styles.formatOptionText,
                exportFormat === 'excel' && styles.formatOptionTextActive
              ]}>
                Excel / CSV
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.modalLabel}>Zeitraum</Text>
          <View style={styles.timeframeOptions}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={exportTimeframe === 'all'}
                onChange={() => setExportTimeframe('all')}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 14, color: '#334155', fontWeight: 600 }}>
                Gesamtes Projekt ({entries.length} Einträge)
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={exportTimeframe === 'custom'}
                onChange={() => setExportTimeframe('custom')}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 14, color: '#334155', fontWeight: 600 }}>Benutzerdefinierter Zeitraum</span>
            </label>
          </View>

          {exportTimeframe === 'custom' && (
            <View style={styles.dateRange}>
              <View style={{ flex: 1 }}>
                <DatePicker
                  label="Von"
                  value={exportStartDate}
                  onChange={setExportStartDate}
                  placeholder="TT.MM.JJJJ"
                />
              </View>
              <View style={{ flex: 1 }}>
                <DatePicker
                  label="Bis"
                  value={exportEndDate}
                  onChange={setExportEndDate}
                  placeholder="TT.MM.JJJJ"
                />
              </View>
            </View>
          )}

          <View style={styles.modalActions}>
            <Button variant="outline" onClick={() => setIsExportModalOpen(false)} style={{ flex: 1 }}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleExport} 
              style={{ flex: 1 }}
              disabled={exporting || (exportTimeframe === 'custom' && (!exportStartDate || !exportEndDate))}
            >
              {exporting ? <ActivityIndicator size="small" color="#fff" /> : <><Download size={16} /> Exportieren</>}
            </Button>
          </View>
        </View>
      </ModernModal>

      {/* Edit Entry Modal */}
      <ModernModal
        visible={!!editingEntry}
        onClose={() => { setEditingEntry(null); resetForm(); }}
        title="Eintrag bearbeiten"
      >
        <View style={styles.modalContent}>
          <DatePicker
            label="Datum *"
            value={selectedDate}
            onChange={setSelectedDate}
            placeholder="TT.MM.JJJJ"
          />

          <View>
            <Text style={styles.inputLabel}>Wetter</Text>
            <View style={styles.weatherGrid}>
              {(['sunny', 'cloudy', 'rainy', 'snowy', 'stormy', 'foggy'] as const).map((w) => (
                <TouchableOpacity
                  key={w}
                  style={[styles.weatherOption, weather === w && styles.weatherOptionActive]}
                  onPress={() => setWeather(w)}
                >
                  {getWeatherIcon(w)}
                  <Text style={styles.weatherOptionText}>{getWeatherLabel(w)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Input
            label="Temperatur (°C)"
            value={temperature}
            onChangeText={setTemperature}
            placeholder="z.B. 18"
          />

          <Input
            label="Zusätzliche Mitarbeiter (Anzahl)"
            value={manualWorkerCount}
            onChangeText={setManualWorkerCount}
            placeholder="z.B. 5 externe Mitarbeiter"
            keyboardType="numeric"
          />

          <SearchableSelect
            label="Anwesende Projektmitarbeiter"
            options={projectMembers
              .filter(member => member.profiles?.email)
              .map(member => ({
                label: `${member.profiles.first_name || ''} ${member.profiles.last_name || ''}`.trim() || member.profiles.email,
                value: member.user_id
              }))}
            values={selectedWorkers}
            onChange={setSelectedWorkers}
            placeholder="Mitarbeiter auswählen..."
            multi
          />

          <Text style={styles.workerCountInfo}>
            Gesamt: {(manualWorkerCount ? parseInt(manualWorkerCount) || 0 : 0) + selectedWorkers.length} Mitarbeiter
          </Text>

          <Input
            label="Durchgeführte Arbeiten *"
            value={workPerformed}
            onChangeText={setWorkPerformed}
            placeholder="Beschreibung der durchgeführten Arbeiten..."
            multiline
            numberOfLines={4}
          />

          <Input
            label="Fortschrittsnotizen"
            value={progressNotes}
            onChangeText={setProgressNotes}
            placeholder="Zusätzliche Notizen zum Baufortschritt..."
            multiline
            numberOfLines={3}
          />

          <Input
            label="Besondere Vorkommnisse"
            value={specialEvents}
            onChangeText={setSpecialEvents}
            placeholder="z.B. Abnahmen, Besprechungen, Besuche..."
            multiline
          />

          <Input
            label="Lieferungen"
            value={deliveries}
            onChangeText={setDeliveries}
            placeholder="z.B. Materiallieferungen, Geräte..."
            multiline
          />

          <View style={styles.modalActions}>
            <Button
              variant="outline"
              onClick={() => { setEditingEntry(null); resetForm(); }}
              style={{ flex: 1 }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSaveEdit}
              style={{ flex: 1 }}
              disabled={isSaving || !workPerformed.trim()}
            >
              {isSaving
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Save size={16} /> Speichern</>
              }
            </Button>
          </View>
        </View>
      </ModernModal>

      {/* History Modal */}
      <ModernModal
        visible={isHistoryModalOpen}
        onClose={() => { setIsHistoryModalOpen(false); setHistoryEntry(null); setHistoryItems([]); }}
        title="Änderungsverlauf"
      >
        <View>
          {historyEntry && (
            <Text style={styles.historyEntryLabel}>
              Eintrag vom {formatDate(historyEntry.entry_date)}
            </Text>
          )}
          {historyLoading ? (
            <View style={styles.historyLoadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : historyError ? (
            <View style={styles.historyEmptyContainer}>
              <AlertCircle size={32} color="#ef4444" />
              <Text style={[styles.historyEmptyText, { color: '#ef4444' }]}>{historyError}</Text>
            </View>
          ) : historyItems.length === 0 ? (
            <View style={styles.historyEmptyContainer}>
              <History size={32} color="#94a3b8" />
              <Text style={styles.historyEmptyText}>Noch keine Änderungen aufgezeichnet.</Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {historyItems.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.historyItem,
                    index === historyItems.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <Text style={styles.historyField}>{item.field_name}</Text>
                  <View style={styles.historyChangeRow}>
                    <Text style={styles.historyOldValue}>{item.old_value || '–'}</Text>
                    <Text style={styles.historyArrow}>→</Text>
                    <Text style={styles.historyNewValue}>{item.new_value || '–'}</Text>
                  </View>
                  <Text style={styles.historyMeta}>
                    {item.changer_name} · {formatDateTime(item.changed_at)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ModernModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 4, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 15, color: '#64748b' },
  content: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  statCard: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center', gap: 8 },
  statValue: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  statLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  emptyCard: { padding: 40, alignItems: 'center', gap: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  emptyText: { fontSize: 16, color: '#94a3b8' },
  entriesList: { gap: 16 },
  entryCard: { padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  entryHeader: { marginBottom: 16 },
  entryDateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entryDate: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  entryMeta: { flexDirection: 'row', gap: 16, marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 14, color: '#64748b' },
  entrySection: { marginBottom: 16 },
  entrySectionTitle: { fontSize: 13, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  entrySectionText: { fontSize: 15, color: '#0f172a', lineHeight: 22 },
  deliveryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  entryFooter: { 
    marginTop: 12, 
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#F1F5F9' 
  },
  entryCreator: { 
    fontSize: 12, 
    color: '#94a3b8', 
    fontStyle: 'italic' 
  },
  modalContent: { gap: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
  weatherGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weatherOption: { 
    minWidth: 100,
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6, 
    paddingVertical: 12, 
    paddingHorizontal: 8,
    borderRadius: 12, 
    borderWidth: 2, 
    borderColor: '#E2E8F0', 
    backgroundColor: '#F8FAFC' 
  },
  weatherOptionActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  weatherOptionText: { fontSize: 12, fontWeight: '600', color: '#475569', textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
    marginTop: 8,
  },
  formatOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  formatOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  formatOptionActive: {
    borderColor: colors.primary,
    backgroundColor: '#EFF6FF',
  },
  formatOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  formatOptionTextActive: {
    color: colors.primary,
  },
  timeframeOptions: {
    marginBottom: 16,
  },
  dateRange: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  workerCountInfo: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    marginTop: -8,
    marginBottom: 8,
  },
  // Icon buttons on entry cards
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  entryUpdated: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  // History modal
  historyEntryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  historyEmptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
  },
  historyEmptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  historyList: {
    gap: 0,
  },
  historyItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyField: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  historyChangeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  historyOldValue: {
    fontSize: 13,
    color: '#ef4444',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: '40%',
  },
  historyArrow: {
    fontSize: 14,
    color: '#94a3b8',
    alignSelf: 'center',
  },
  historyNewValue: {
    fontSize: 13,
    color: '#16a34a',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: '40%',
  },
  historyMeta: {
    fontSize: 12,
    color: '#94a3b8',
  },
});
