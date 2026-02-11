import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { ModernModal } from '../../components/ModernModal';
import { useToast } from '../../components/ToastProvider';
import { BookOpen, Plus, Calendar, CloudRain, Sun, Cloud, Users, Truck } from 'lucide-react';

interface DiaryEntry {
  id: string;
  date: string;
  weather: string;
  temperature?: number;
  workers_present?: number;
  notes?: string;
  special_events?: string;
  deliveries?: string;
  created_at: string;
}

export function ProjectDiary() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [weather, setWeather] = useState<'sunny' | 'cloudy' | 'rainy'>('sunny');
  const [temperature, setTemperature] = useState('');
  const [workersPresent, setWorkersPresent] = useState('');
  const [notes, setNotes] = useState('');
  const [specialEvents, setSpecialEvents] = useState('');
  const [deliveries, setDeliveries] = useState('');

  useEffect(() => {
    if (id) {
      loadDiaryEntries();
    }
  }, [id]);

  const loadDiaryEntries = async () => {
    if (!id) return;
    setLoading(true);

    try {
      const mockEntries: DiaryEntry[] = [
        {
          id: '1',
          date: '2026-02-11',
          weather: 'sunny',
          temperature: 8,
          workers_present: 12,
          notes: 'Fortsetzung der Rohbauarbeiten im Erdgeschoss. Mauerarbeiten planmäßig.',
          special_events: 'Abnahme der Fundamente durch Statiker',
          deliveries: 'Lieferung Ziegel (5000 Stk.)',
          created_at: '2026-02-11T08:00:00'
        },
        {
          id: '2',
          date: '2026-02-10',
          weather: 'cloudy',
          temperature: 6,
          workers_present: 10,
          notes: 'Mauerarbeiten im Erdgeschoss fortgesetzt.',
          created_at: '2026-02-10T08:00:00'
        }
      ];
      setEntries(mockEntries);
    } catch (error: any) {
      showToast('Fehler beim Laden', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEntry = async () => {
    if (!selectedDate || !notes.trim()) {
      showToast('Bitte Datum und Notizen eingeben', 'error');
      return;
    }
    showToast('Eintrag erfolgreich erstellt', 'success');
    setIsCreateModalOpen(false);
    resetForm();
    loadDiaryEntries();
  };

  const resetForm = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setWeather('sunny');
    setTemperature('');
    setWorkersPresent('');
    setNotes('');
    setSpecialEvents('');
    setDeliveries('');
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
      default: return <Sun size={20} color="#F59E0B" />;
    }
  };

  const getWeatherLabel = (weather: string) => {
    switch (weather) {
      case 'sunny': return 'Sonnig';
      case 'cloudy': return 'Bewölkt';
      case 'rainy': return 'Regnerisch';
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
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={18} /> Eintrag
          </Button>
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
                {entries.length > 0 ? Math.ceil((Date.now() - new Date(entries[entries.length - 1].date).getTime()) / (1000 * 60 * 60 * 24)) : 0}
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
                      <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
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
                  {entry.notes && (
                    <View style={styles.entrySection}>
                      <Text style={styles.entrySectionTitle}>Tagesbericht</Text>
                      <Text style={styles.entrySectionText}>{entry.notes}</Text>
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
                </Card>
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      <ModernModal
        visible={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); resetForm(); }}
        title="Neuer Bautagebuch-Eintrag"
      >
        <View style={styles.modalContent}>
          <Input label="Datum *" value={selectedDate} onChangeText={setSelectedDate} placeholder="YYYY-MM-DD" />
          <View>
            <Text style={styles.inputLabel}>Wetter</Text>
            <View style={styles.weatherGrid}>
              {(['sunny', 'cloudy', 'rainy'] as const).map((w) => (
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
          <Input label="Temperatur (°C)" value={temperature} onChangeText={setTemperature} placeholder="z.B. 12" />
          <Input label="Anwesende Mitarbeiter" value={workersPresent} onChangeText={setWorkersPresent} placeholder="Anzahl" />
          <Input label="Tagesbericht *" value={notes} onChangeText={setNotes} placeholder="Beschreibung..." multiline numberOfLines={4} />
          <Input label="Besondere Vorkommnisse" value={specialEvents} onChangeText={setSpecialEvents} placeholder="z.B. Abnahmen..." multiline />
          <Input label="Lieferungen" value={deliveries} onChangeText={setDeliveries} placeholder="z.B. Material..." multiline />
          <View style={styles.modalActions}>
            <Button variant="outline" onClick={() => { setIsCreateModalOpen(false); resetForm(); }} style={{ flex: 1 }}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateEntry} style={{ flex: 1 }}>Erstellen</Button>
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
  modalContent: { gap: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
  weatherGrid: { flexDirection: 'row', gap: 8 },
  weatherOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  weatherOptionActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  weatherOptionText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 }
});
