import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ToastProvider';
import { DatePicker } from '../../components/DatePicker';
import { Settings, Archive, Trash2, Save, AlertTriangle } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  start_date?: string;
  target_end_date?: string;
  city?: string;
  postal_code?: string;
  country?: string;
}

export function ProjectSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [startDate, setStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('Deutschland');

  useEffect(() => {
    if (id) loadProject();
  }, [id]);

  const loadProject = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('projects').select('id, owner_id, name, description, address, status, created_at, updated_at, subtitle, picture_url, detailed_address, start_date, target_end_date').eq('id', id).single();
      if (error) throw error;
      if (data) {
        setProject(data);
        setName(data.name || '');
        setDescription(data.description || '');
        setStatus(data.status || 'active');
        setStartDate(data.start_date || '');
        setTargetEndDate(data.target_end_date || '');
        setCity(data.city || '');
        setPostalCode(data.postal_code || '');
        setCountry(data.country || 'Deutschland');
      }
    } catch (error: any) {
      showToast('Fehler beim Laden', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Projektname erforderlich', 'error');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('projects').update({
        name: name.trim(),
        description: description.trim() || null,
        status,
        start_date: startDate || null,
        target_end_date: targetEndDate || null,
        city: city.trim() || null,
        postal_code: postalCode.trim() || null,
        country: country.trim() || null,
      }).eq('id', id);
      if (error) throw error;
      showToast('Einstellungen gespeichert', 'success');
      loadProject();
    } catch (error: any) {
      showToast('Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Projekt archivieren?')) return;
    try {
      const { error } = await supabase.from('projects').update({ status: 'archived' }).eq('id', id);
      if (error) throw error;
      showToast('Projekt archiviert', 'success');
      navigate('/projects');
    } catch (error: any) {
      showToast('Fehler beim Archivieren', 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Projekt ENDGÜLTIG löschen?')) return;
    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      showToast('Projekt gelöscht', 'success');
      navigate('/projects');
    } catch (error: any) {
      showToast('Fehler beim Löschen', 'error');
    }
  };

  if (loading) {
    return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Projekt Einstellungen</Text>
          <Text style={styles.pageSubtitle}>Projektkonfiguration und Verwaltung</Text>
        </View>
        <Button onClick={handleSave} disabled={saving}><Save size={18} /> {saving ? 'Speichert...' : 'Speichern'}</Button>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Settings size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Allgemeine Einstellungen</Text>
          </View>
          <View style={styles.formGroup}>
            <Input label="Projektname *" value={name} onChangeText={setName} placeholder="z.B. Neubau Einfamilienhaus" />
            <Input label="Beschreibung" value={description} onChangeText={setDescription} placeholder="Kurze Beschreibung..." multiline numberOfLines={3} />
            <View>
              <Text style={styles.inputLabel}>Status</Text>
              <View style={styles.statusGrid}>
                {[{ value: 'planning', label: 'Planung', color: '#F59E0B' }, { value: 'active', label: 'Aktiv', color: '#10B981' }, { value: 'on_hold', label: 'Pausiert', color: '#6366F1' }, { value: 'completed', label: 'Abgeschlossen', color: '#3B82F6' }].map(s => (
                  <TouchableOpacity key={s.value} style={[styles.statusOption, status === s.value && { backgroundColor: s.color, borderColor: s.color }]} onPress={() => setStatus(s.value)}>
                    <Text style={[styles.statusOptionText, status === s.value && { color: '#ffffff' }]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Zeitraum</Text>
          <View style={styles.formGroup}>
            <DatePicker label="Startdatum" value={startDate} onChange={setStartDate} placeholder="TT.MM.JJJJ" />
            <DatePicker label="Ziel-Enddatum" value={targetEndDate} onChange={setTargetEndDate} placeholder="TT.MM.JJJJ" />
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Standort</Text>
          <Text style={styles.noteText}>Hinweis: Detaillierte Adressverwaltung erfolgt über den Superuser-Bereich.</Text>
          <View style={styles.formGroup}>
            <View style={styles.row}>
              <Input label="PLZ" value={postalCode} onChangeText={setPostalCode} placeholder="12345" style={{ flex: 1 }} />
              <Input label="Stadt" value={city} onChangeText={setCity} placeholder="Berlin" style={{ flex: 2 }} />
            </View>
            <Input label="Land" value={country} onChangeText={setCountry} placeholder="Deutschland" />
          </View>
        </Card>

        <Card style={[styles.sectionCard, styles.dangerCard]}>
          <View style={styles.sectionHeader}>
            <AlertTriangle size={20} color="#DC2626" />
            <Text style={[styles.sectionTitle, { color: '#DC2626' }]}>Gefahrenbereich</Text>
          </View>
          <Text style={styles.dangerText}>Aktionen sind unwiderruflich.</Text>
          <View style={styles.dangerActions}>
            <Button variant="outline" onClick={handleArchive} style={styles.dangerButton}><Archive size={16} /> Archivieren</Button>
            <Button variant="outline" onClick={handleDelete} style={[styles.dangerButton, styles.deleteButton]}><Trash2 size={16} /> Löschen</Button>
          </View>
        </Card>
      </ScrollView>
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
  sectionCard: { padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  formGroup: { gap: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
  noteText: { fontSize: 13, color: '#64748b', fontStyle: 'italic', marginBottom: 12 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusOption: { flex: 1, minWidth: '45%', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', alignItems: 'center' },
  statusOptionText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  row: { flexDirection: 'row', gap: 12 },
  dangerCard: { borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' },
  dangerText: { fontSize: 14, color: '#991B1B', marginBottom: 16 },
  dangerActions: { gap: 12 },
  dangerButton: { borderColor: '#DC2626' },
  deleteButton: { backgroundColor: '#DC2626' }
});

