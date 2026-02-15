import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ToastProvider';
import { DatePicker } from '../../components/DatePicker';
import { ImageUploader } from '../../components/ImageUploader';
import { CountrySelect } from '../../components/CountrySelect';
import { StatusSelect } from '../../components/StatusSelect';
import { SearchableSelect } from '../../components/SearchableSelect';
import { useLayout } from '../../layouts/LayoutContext';
import { 
  Settings, Archive, Trash2, Save, AlertTriangle, Building2, MapPin, 
  Calendar, Image, Users, FileText, Briefcase, ArrowLeft 
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  subtitle?: string;
  description?: string;
  status: string;
  start_date?: string;
  target_end_date?: string;
  street?: string;
  zip?: string;
  city?: string;
  country?: string;
  images?: string[];
  picture_url?: string;
}

export function ProjectManagementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { setTitle, setSubtitle } = useLayout();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  
  // Basic Information
  const [name, setName] = useState('');
  const [projectSubtitle, setProjectSubtitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Status & Dates
  const [status, setStatus] = useState('active');
  const [startDate, setStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [statusDate, setStatusDate] = useState('');
  
  // Address
  const [street, setStreet] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('DE');
  
  // Media
  const [images, setImages] = useState<string[]>([]);
  
  // People
  const [employees, setEmployees] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [selectedSubcontractors, setSelectedSubcontractors] = useState<string[]>([]);

  useEffect(() => {
    setTitle('Projekt Management');
    setSubtitle('Vollständige Projektkonfiguration');
    return () => { setTitle(''); setSubtitle(''); };
  }, [setTitle, setSubtitle]);

  useEffect(() => {
    if (id) {
      loadProject();
      loadResources();
    }
  }, [id]);

  const loadProject = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      if (data) {
        setProject(data);
        setName(data.name || '');
        setProjectSubtitle(data.subtitle || '');
        setDescription(data.description || '');
        setStatus(data.status || 'active');
        setStartDate(data.start_date || '');
        setTargetEndDate(data.target_end_date || '');
        setStatusDate(data.status_date || '');
        setStreet(data.street || '');
        setZip(data.zip || '');
        setCity(data.city || '');
        setCountry(data.country || 'DE');
        setImages(data.images || []);
        
        // Load linked people
        loadLinkedPeople();
      }
    } catch (error: any) {
      console.error('Error loading project:', error);
      showToast('Fehler beim Laden', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadResources = async () => {
    try {
      const [empRes, ownRes, subRes] = await Promise.all([
        supabase.from('crm_contacts').select('*').eq('type', 'employee'),
        supabase.from('crm_contacts').select('*').eq('type', 'owner'),
        supabase.from('subcontractors').select('*')
      ]);
      
      if (empRes.data) setEmployees(empRes.data);
      if (ownRes.data) setOwners(ownRes.data);
      if (subRes.data) setSubcontractors(subRes.data);
    } catch (error: any) {
      console.error('Error loading resources:', error);
    }
  };

  const loadLinkedPeople = async () => {
    if (!id) return;
    
    try {
      const [linksRes, subLinksRes] = await Promise.all([
        supabase.from('project_crm_links').select('contact_id, role').eq('project_id', id),
        supabase.from('project_subcontractors').select('subcontractor_id').eq('project_id', id)
      ]);

      if (linksRes.data) {
        const empIds = linksRes.data.filter(l => l.role === 'employee').map(l => l.contact_id);
        const ownIds = linksRes.data.filter(l => l.role === 'owner').map(l => l.contact_id);
        setSelectedEmployees(empIds);
        setSelectedOwners(ownIds);
      }

      if (subLinksRes.data) {
        const subIds = subLinksRes.data.map(l => l.subcontractor_id);
        setSelectedSubcontractors(subIds);
      }
    } catch (error: any) {
      console.error('Error loading linked people:', error);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Projektname erforderlich', 'error');
      return;
    }

    if (!street.trim() || !city.trim()) {
      showToast('Straße und Stadt erforderlich', 'error');
      return;
    }

    setSaving(true);
    try {
      // Build full address
      const fullAddress = `${street}, ${zip} ${city}, ${country}`;

      // Update project
      const { error: projectError } = await supabase
        .from('projects')
        .update({
          name: name.trim(),
          subtitle: projectSubtitle.trim() || null,
          description: description.trim() || null,
          status,
          start_date: startDate || null,
          target_end_date: targetEndDate || null,
          status_date: statusDate || null,
          street: street.trim(),
          zip: zip.trim(),
          city: city.trim(),
          country: country,
          address: fullAddress,
          images: images,
          picture_url: images[0] || null,
        })
        .eq('id', id);

      if (projectError) throw projectError;

      // Update Employee & Owner Links
      await supabase.from('project_crm_links').delete().eq('project_id', id);
      
      const contactLinks = [
        ...selectedEmployees.map(contactId => ({ project_id: id, contact_id: contactId, role: 'employee' })),
        ...selectedOwners.map(contactId => ({ project_id: id, contact_id: contactId, role: 'owner' }))
      ];
      
      if (contactLinks.length > 0) {
        const { error: linkError } = await supabase.from('project_crm_links').insert(contactLinks);
        if (linkError) throw linkError;
      }

      // Update Subcontractor Links
      await supabase.from('project_subcontractors').delete().eq('project_id', id);
      
      if (selectedSubcontractors.length > 0) {
        const subInserts = selectedSubcontractors.map(subId => ({
          project_id: id,
          subcontractor_id: subId
        }));
        const { error: subError } = await supabase.from('project_subcontractors').insert(subInserts);
        if (subError) throw subError;
      }

      showToast('Einstellungen gespeichert', 'success');
      loadProject();
    } catch (error: any) {
      console.error('Error saving project:', error);
      showToast('Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Projekt archivieren?')) return;
    
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'archived' })
        .eq('id', id);

      if (error) throw error;
      showToast('Projekt archiviert', 'success');
      navigate('/manage-projects');
    } catch (error: any) {
      console.error('Error archiving project:', error);
      showToast('Fehler beim Archivieren', 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Projekt ENDGÜLTIG löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
    
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Projekt gelöscht', 'success');
      navigate('/manage-projects');
    } catch (error: any) {
      console.error('Error deleting project:', error);
      showToast('Fehler beim Löschen', 'error');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Status options that need a date
  const statusesWithDate = ['on_hold', 'paused', 'planning'];
  const showStatusDate = statusesWithDate.includes(status);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigate('/manage-projects')} style={styles.backButton}>
            <ArrowLeft size={20} color={colors.primary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.pageTitle}>{project?.name || 'Projekt Management'}</Text>
            <Text style={styles.pageSubtitle}>Vollständige Projektkonfiguration und Verwaltung</Text>
          </View>
        </View>
        <Button onClick={handleSave} disabled={saving}>
          <Save size={18} />
          {saving ? 'Speichert...' : 'Speichern'}
        </Button>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 1. Basic Information */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Building2 size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Grundinformationen</Text>
          </View>
          <View style={styles.formGroup}>
            <Input 
              label="Projektname *" 
              value={name} 
              onChangeText={setName} 
              placeholder="z.B. Neubau Einfamilienhaus"
            />
            <Input 
              label="Untertitel" 
              value={projectSubtitle} 
              onChangeText={setProjectSubtitle} 
              placeholder="Kurzer Zusatz zum Projektnamen"
            />
            <Input 
              label="Beschreibung" 
              value={description} 
              onChangeText={setDescription} 
              placeholder="Ausführliche Projektbeschreibung..." 
              multiline 
              numberOfLines={4}
            />
          </View>
        </Card>

        {/* 2. Address */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MapPin size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Projektadresse</Text>
          </View>
          <Text style={styles.helperText}>
            Vollständige Adresse für Navigation, Google Maps und Dokumentation
          </Text>
          <View style={styles.formGroup}>
            <Input 
              label="Straße & Hausnummer *" 
              value={street} 
              onChangeText={setStreet} 
              placeholder="z.B. Hauptstraße 123"
            />
            <View style={styles.row}>
              <Input 
                label="PLZ" 
                value={zip} 
                onChangeText={setZip} 
                placeholder="10115" 
                style={{ flex: 1 }}
              />
              <Input 
                label="Stadt *" 
                value={city} 
                onChangeText={setCity} 
                placeholder="Berlin" 
                style={{ flex: 2 }}
              />
            </View>
            <CountrySelect 
              label="Land" 
              value={country} 
              onChange={setCountry}
            />
          </View>
        </Card>

        {/* 3. Images */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Image size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Projektbilder</Text>
          </View>
          <Text style={styles.helperText}>
            Projektbilder werden in der Projektübersicht und auf der Dashboard-Seite angezeigt
          </Text>
          <ImageUploader 
            label="" 
            value={images} 
            onChange={setImages} 
            bucketName="project-images"
          />
        </Card>

        {/* 4. Status & Dates */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Calendar size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Status & Zeitplanung</Text>
          </View>
          <View style={styles.formGroup}>
            <StatusSelect 
              label="Projektstatus *"
              value={status}
              onChange={setStatus}
            />
            
            {showStatusDate && (
              <>
                <Text style={styles.helperText}>
                  📅 Statusspezifisches Datum (z.B. "Pausiert bis" oder "Geplant bis")
                </Text>
                <DatePicker 
                  label={`${status === 'on_hold' ? 'Pausiert bis' : status === 'paused' ? 'Unterbrochen bis' : 'Geplant bis'}`}
                  value={statusDate} 
                  onChange={setStatusDate} 
                  placeholder="TT.MM.JJJJ"
                />
              </>
            )}
            
            <DatePicker 
              label="Startdatum" 
              value={startDate} 
              onChange={setStartDate} 
              placeholder="TT.MM.JJJJ"
            />
            <DatePicker 
              label="Ziel-Enddatum" 
              value={targetEndDate} 
              onChange={setTargetEndDate} 
              placeholder="TT.MM.JJJJ"
            />
          </View>
        </Card>

        {/* 5. People & Trades */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Users size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Beteiligte Personen</Text>
          </View>
          <View style={styles.formGroup}>
            <SearchableSelect
              label="Mitarbeiter"
              placeholder="Mitarbeiter auswählen..."
              options={employees.map(e => ({
                label: `${e.first_name} ${e.last_name}`,
                value: e.id
              }))}
              value={selectedEmployees}
              onChange={setSelectedEmployees}
              multiple
            />
            
            <SearchableSelect
              label="Bauherren / Eigentümer"
              placeholder="Eigentümer auswählen..."
              options={owners.map(o => ({
                label: `${o.first_name} ${o.last_name}`,
                value: o.id
              }))}
              value={selectedOwners}
              onChange={setSelectedOwners}
              multiple
            />
            
            <SearchableSelect
              label="Nachunternehmer"
              placeholder="Nachunternehmer auswählen..."
              options={subcontractors.map(s => ({
                label: s.company_name || `${s.first_name} ${s.last_name}`,
                value: s.id
              }))}
              value={selectedSubcontractors}
              onChange={setSelectedSubcontractors}
              multiple
            />
          </View>
        </Card>

        {/* 6. Danger Zone */}
        <Card style={[styles.sectionCard, styles.dangerCard]}>
          <View style={styles.sectionHeader}>
            <AlertTriangle size={20} color="#DC2626" />
            <Text style={[styles.sectionTitle, { color: '#DC2626' }]}>Gefahrenbereich</Text>
          </View>
          <Text style={styles.dangerText}>
            ⚠️ Diese Aktionen sind unwiderruflich und können nicht rückgängig gemacht werden.
          </Text>
          <View style={styles.dangerActions}>
            <Button 
              variant="outline" 
              onClick={handleArchive} 
              style={styles.dangerButton}
            >
              <Archive size={16} />
              Projekt archivieren
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDelete} 
              style={[styles.dangerButton, styles.deleteButton]}
            >
              <Trash2 size={16} />
              Projekt löschen
            </Button>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#64748b',
  },
  content: {
    flex: 1,
  },
  sectionCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  helperText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 18,
  },
  formGroup: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  dangerCard: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  dangerText: {
    fontSize: 14,
    color: '#991B1B',
    marginBottom: 16,
    lineHeight: 20,
  },
  dangerActions: {
    gap: 12,
  },
  dangerButton: {
    borderColor: '#DC2626',
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
});
