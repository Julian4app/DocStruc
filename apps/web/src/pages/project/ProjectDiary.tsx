import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
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
import { BookOpen, Plus, Calendar, CloudRain, Sun, Cloud, Users, Truck, Download, FileText, Clock } from 'lucide-react';

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
          profiles!inner(id, first_name, last_name, email)
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
      const { data, error } = await supabase
        .from('diary_entries')
        .select(`
          id, project_id, created_by, entry_date, content, weather, temperature, wind, notes, work_done, issues, materials_used, workers_count, created_at, updated_at,
          profiles!diary_entries_created_by_fkey(first_name, last_name, email)
        `)
        .eq('project_id', id)
        .order('entry_date', { ascending: false })
        .limit(500);

      if (error) throw error;

      const transformed: DiaryEntry[] = (data || []).map((entry: any) => ({
        ...entry,
        creator_name: entry.profiles 
          ? `${entry.profiles.first_name || ''} ${entry.profiles.last_name || ''}`.trim() || entry.profiles.email
          : 'Unbekannt'
      }));

      // Apply content visibility (Freigaben) filtering
      let visibleEntries = transformed;
      try {
        visibleEntries = await filterVisibleItems(visibleEntries);
      } catch (err) {
        console.error('Error filtering visible diary entries:', err);
      }

      setEntries(visibleEntries);
    } catch (error: any) {
      console.error('Error loading diary entries:', error);
      showToast('Fehler beim Laden der Einträge', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEntry = async () => {
    if (!selectedDate || !workPerformed.trim()) {
      showToast('Bitte Datum und Arbeiten eingeben', 'error');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht authentifiziert');

      // Get selected worker names
      const workerNames = selectedWorkers
        .map(userId => {
          const member = projectMembers.find(m => m.user_id === userId);
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
          created_by: user.id
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

      // Generate document content
      if (exportFormat === 'pdf') {
        // Generate PDF
        const content = generatePDFContent(entriesToExport);
        downloadPDF(content, `Bautagebuch_${new Date().toISOString().split('T')[0]}.pdf`);
      } else {
        // Generate CSV
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

  const generateCSVContent = (entries: DiaryEntry[]) => {
    const headers = ['Datum', 'Wetter', 'Temperatur', 'Mitarbeiter', 'Arbeiten', 'Fortschritt', 'Ereignisse', 'Lieferungen', 'Erstellt von', 'Erstellt am'];
    const rows = entries.map(entry => [
      formatDate(entry.entry_date),
      getWeatherLabel(entry.weather),
      entry.temperature ? `${entry.temperature}°C` : '',
      entry.workers_present || '',
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

  const generatePDFContent = (entries: DiaryEntry[]) => {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Bautagebuch Export</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #1e3a5f; padding-bottom: 20px; }
          .logo { width: 80px; height: 80px; margin: 0 auto 20px; }
          h1 { color: #1e3a5f; margin: 10px 0; }
          .subtitle { color: #666; font-size: 14px; }
          .entry { margin-bottom: 30px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; page-break-inside: avoid; }
          .entry-header { background: #f8fafc; padding: 12px; margin: -20px -20px 15px; border-radius: 8px 8px 0 0; border-bottom: 2px solid #e2e8f0; }
          .entry-date { font-size: 18px; font-weight: bold; color: #1e3a5f; margin-bottom: 5px; }
          .entry-meta { display: flex; gap: 20px; font-size: 13px; color: #64748b; }
          .section { margin: 15px 0; }
          .section-title { font-weight: bold; color: #475569; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }
          .section-content { color: #0f172a; line-height: 1.6; }
          .footer { margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; font-style: italic; }
          @media print { .entry { page-break-inside: avoid; } }
        </style>
      </head>
      <body>
        <div class="header">
          <svg class="logo" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            <rect width="512" height="512" rx="90" fill="#1e3a5f"/>
            <path d="M 280 90 L 360 150 L 360 180 L 340 180 L 340 160 L 300 130 L 280 140 Z" fill="#1e3a5f" stroke="#fff" stroke-width="3"/>
            <circle cx="445" cy="135" r="20" fill="#F59E0B" stroke="#fff" stroke-width="3"/>
            <line x1="445" y1="155" x2="445" y2="200" stroke="#1e3a5f" stroke-width="8"/>
            <text x="75" y="360" font-family="Arial" font-size="280" font-weight="bold" fill="#fff">DS</text>
          </svg>
          <h1>Bautagebuch</h1>
          <div class="subtitle">DocStruc - Baudokumentation • Exportiert am ${formatDateTime(new Date().toISOString())}</div>
        </div>
    `;

    entries.forEach(entry => {
      html += `
        <div class="entry">
          <div class="entry-header">
            <div class="entry-date">${formatDate(entry.entry_date)}</div>
            <div class="entry-meta">
              <span>${getWeatherLabel(entry.weather)}${entry.temperature ? ` • ${entry.temperature}°C` : ''}</span>
              ${entry.workers_present ? `<span>👷 ${entry.workers_present} Mitarbeiter</span>` : ''}
            </div>
          </div>
          ${entry.workers_list ? `
            <div class="section">
              <div class="section-title">Anwesende Mitarbeiter</div>
              <div class="section-content">${entry.workers_list}</div>
            </div>
          ` : ''}
          <div class="section">
            <div class="section-title">Durchgeführte Arbeiten</div>
            <div class="section-content">${entry.work_performed}</div>
          </div>
          ${entry.progress_notes ? `
            <div class="section">
              <div class="section-title">Fortschrittsnotizen</div>
              <div class="section-content">${entry.progress_notes}</div>
            </div>
          ` : ''}
          ${entry.special_events ? `
            <div class="section">
              <div class="section-title">Besondere Vorkommnisse</div>
              <div class="section-content">${entry.special_events}</div>
            </div>
          ` : ''}
          ${entry.deliveries ? `
            <div class="section">
              <div class="section-title">Lieferungen</div>
              <div class="section-content">${entry.deliveries}</div>
            </div>
          ` : ''}
          <div class="footer">
            Erstellt von: ${entry.creator_name} • ${formatDateTime(entry.created_at)}
          </div>
        </div>
      `;
    });

    html += '</body></html>';
    return html;
  };

  const downloadPDF = (htmlContent: string, filename: string) => {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace('.pdf', '.html');
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
        <ActivityIndicator size="large" color={colors.primary} />
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
                    </View>
                  </View>
                  <View style={styles.entryMeta}>
                    <View style={styles.metaItem}>
                      {getWeatherIcon(entry.weather)}
                      <Text style={styles.metaText}>
                        {getWeatherLabel(entry.weather)}
                        {entry.temperature && ` • ${entry.temperature}°C`}
                      </Text>
                    </View>
                    {entry.workers_present && (
                      <View style={styles.metaItem}>
                        <Users size={16} color="#64748b" />
                        <Text style={styles.metaText}>{entry.workers_present} Mitarbeiter</Text>
                      </View>
                    )}
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
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          )}
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
});
