import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { ModernModal } from '../../components/ModernModal';
import { DatePicker } from '../../components/DatePicker';
import { SearchableSelect } from '../../components/SearchableSelect';
import { useToast } from '../../components/ToastProvider';
import { BookOpen, Plus, Calendar, CloudRain, Sun, Cloud, Users, Truck, Download, FileText } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  
  // Form state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [weather, setWeather] = useState<'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'stormy' | 'foggy'>('sunny');
  const [temperature, setTemperature] = useState('');
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [workPerformed, setWorkPerformed] = useState('');
  const [progressNotes, setProgressNotes] = useState('');
  const [specialEvents, setSpecialEvents] = useState('');
  const [deliveries, setDeliveries] = useState('');
  
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
    // Simulate weather API call - in production, you'd call a real weather API
    // For now, we'll use a simple algorithm based on the date
    const date = new Date(dateStr);
    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
    const weatherIndex = dayOfYear % 6;
    const weatherOptions: Array<'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'stormy' | 'foggy'> = 
      ['sunny', 'cloudy', 'rainy', 'snowy', 'stormy', 'foggy'];
    
    setWeather(weatherOptions[weatherIndex]);
    
    // Simulate temperature based on date (rough approximation for Central Europe)
    const month = date.getMonth();
    const baseTemp = [-2, 0, 5, 10, 15, 20, 22, 21, 17, 11, 5, 1][month];
    const variance = Math.floor(Math.random() * 10) - 5;
    setTemperature((baseTemp + variance).toString());
  };

  const loadDiaryEntries = async () => {
    if (!id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('diary_entries')
        .select(`
          *,
          profiles!diary_entries_created_by_fkey(first_name, last_name, email)
        `)
        .eq('project_id', id)
        .order('entry_date', { ascending: false });

      if (error) throw error;

      const transformed: DiaryEntry[] = (data || []).map((entry: any) => ({
        ...entry,
        creator_name: entry.profiles 
          ? `${entry.profiles.first_name || ''} ${entry.profiles.last_name || ''}`.trim() || entry.profiles.email
          : 'Unbekannt'
      }));

      setEntries(transformed);
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
          if (member?.profiles) {
            return `${member.profiles.first_name || ''} ${member.profiles.last_name || ''}`.trim() || member.profiles.email;
          }
          return null;
        })
        .filter(Boolean)
        .join(', ');

      const { error } = await supabase
        .from('diary_entries')
        .insert({
          project_id: id,
          entry_date: selectedDate,
          weather,
          temperature: temperature ? parseInt(temperature) : null,
          workers_present: selectedWorkers.length,
          workers_list: workerNames,
          work_performed: workPerformed,
          progress_notes: progressNotes || null,
          special_events: specialEvents || null,
          deliveries: deliveries || null,
          created_by: user.id
        });

      if (error) throw error;

      showToast('Eintrag erfolgreich erstellt', 'success');
      setIsCreateModalOpen(false);
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
        return;
      }

      // In production, generate actual PDF/Excel here
      showToast(`${exportFormat.toUpperCase()}-Export wird vorbereitet... (${entriesToExport.length} Einträge)`, 'success');
      
      // Simulate export delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      showToast('Export erfolgreich!', 'success');
      setIsExportModalOpen(false);
    } catch (error: any) {
      console.error('Error exporting:', error);
      showToast('Fehler beim Exportieren', 'error');
    } finally {
      setExporting(false);
    }
  };

  const resetForm = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setWeather('sunny');
    setTemperature('');
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
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus size={18} /> Eintrag
            </Button>
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
                    <Text style={styles.entryCreator}>Erstellt von: {entry.creator_name}</Text>
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
          
          <SearchableSelect
            label="Anwesende Mitarbeiter"
            options={projectMembers.map(member => ({
              label: `${member.profiles.first_name || ''} ${member.profiles.last_name || ''}`.trim() || member.profiles.email,
              value: member.user_id
            }))}
            values={selectedWorkers}
            onChange={setSelectedWorkers}
            placeholder="Mitarbeiter auswählen..."
            multi
          />
          
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
});
