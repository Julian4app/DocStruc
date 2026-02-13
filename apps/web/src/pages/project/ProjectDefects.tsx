import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { colors, spacing } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { ModernModal } from '../../components/ModernModal';
import { useToast } from '../../components/ToastProvider';
import { Select } from '../../components/Select';
import { DatePicker } from '../../components/DatePicker';
import { RichTextEditor } from '../../components/RichTextEditor';
import DOMPurify from 'dompurify';
import { 
  Plus, AlertCircle, Calendar, Image as ImageIcon, FileText, Mic, Video,
  Upload, User, Calendar as CalendarIcon, X, Trash2, Edit2
} from 'lucide-react';

interface Defect {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'rejected';
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
  creator_id?: string;
}

interface DefectImage {
  id: string;
  task_id: string;
  storage_path: string;
  file_name: string | null;
  caption?: string | null;
  display_order: number;
  created_at: string;
}

interface DefectDocumentation {
  id: string;
  task_id: string;
  content?: string | null;
  documentation_type: 'text' | 'voice' | 'image' | 'video';
  storage_path?: string | null;
  file_name?: string | null;
  duration_seconds?: number | null;
  user_id: string;
  created_at: string;
}

interface ProjectMember {
  user_id: string;
  role?: string;
  profiles: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

export function ProjectDefects() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'info' | 'docs'>('info');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  // Create modal - image upload with drag & drop
  const [createImages, setCreateImages] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Detail state
  const [defectImages, setDefectImages] = useState<DefectImage[]>([]);
  const [defectDocumentation, setDefectDocumentation] = useState<DefectDocumentation[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Documentation form
  const [docFormData, setDocFormData] = useState({
    type: '',
    content: ''
  });

  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const createImageInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDefects();
    loadProjectMembers();
  }, [id]);

  const loadDefects = async () => {
    if (!id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', id)
        .eq('task_type', 'defect')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDefects(data || []);
    } catch (error: any) {
      console.error('Error loading defects:', error);
      showToast('Fehler beim Laden der Mängel', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadProjectMembers = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('project_members')
        .select(`
          user_id,
          role,
          profiles:user_id(id, email, first_name, last_name)
        `)
        .eq('project_id', id);

      if (error) throw error;
      setProjectMembers((data || []) as any);
    } catch (error: any) {
      console.error('Error loading members:', error);
    }
  };

  const handleCreateDefect = async () => {
    if (!title.trim()) {
      showToast('Bitte geben Sie einen Titel ein', 'error');
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data: newDefect, error } = await supabase.from('tasks').insert({
        project_id: id,
        title: title.trim(),
        description: description.trim(),
        task_type: 'defect',
        priority,
        status: 'open',
        due_date: dueDate || null,
        assigned_to: assignedTo || null,
        creator_id: userData.user?.id
      }).select().single();

      if (error) throw error;

      // Upload images if any
      if (createImages.length > 0 && newDefect) {
        for (let i = 0; i < createImages.length; i++) {
          const file = createImages[i];
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${id}/defects/${newDefect.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('task-images')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          await supabase.from('task_images').insert({
            task_id: newDefect.id,
            project_id: id,
            storage_path: filePath,
            file_name: file.name,
            display_order: i
          });
        }
      }

      showToast('Mangel erfolgreich erstellt', 'success');
      setIsCreateModalOpen(false);
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setAssignedTo('');
      setCreateImages([]);
      loadDefects();
    } catch (error: any) {
      console.error('Error creating defect:', error);
      showToast('Fehler beim Erstellen des Mangels', 'error');
    }
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );
    
    setCreateImages(prev => [...prev, ...files]);
  };

  const handleAddCreateImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setCreateImages(prev => [...prev, ...files]);
  };

  const handleRemoveCreateImage = (index: number) => {
    setCreateImages(prev => prev.filter((_, i) => i !== index));
  };

  const loadDefectDetails = async (defectId: string) => {
    try {
      // Load images
      const { data: images, error: imagesError } = await supabase
        .from('task_images')
        .select('*')
        .eq('task_id', defectId)
        .order('display_order', { ascending: true });

      if (imagesError) throw imagesError;
      setDefectImages(images || []);

      // Load documentation
      const { data: docs, error: docsError } = await supabase
        .from('task_documentation')
        .select('*')
        .eq('task_id', defectId)
        .order('created_at', { ascending: false });

      if (docsError) throw docsError;
      setDefectDocumentation(docs || []);
    } catch (error: any) {
      console.error('Error loading defect details:', error);
    }
  };

  const handleImageUpload = async (event: any) => {
    if (!selectedDefect) return;
    
    const files = event.target?.files ? Array.from(event.target.files) as File[] : [];
    if (files.length === 0) return;

    try {
      const { data: userData } = await supabase.auth.getUser();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${id}/defects/${selectedDefect.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('task-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase.from('task_images').insert({
          task_id: selectedDefect.id,
          project_id: id,
          storage_path: filePath,
          file_name: file.name,
          display_order: defectImages.length + i
        });

        if (dbError) throw dbError;
      }

      showToast(`${files.length} Bild(er) hochgeladen`, 'success');
      loadDefectDetails(selectedDefect.id);
    } catch (error: any) {
      console.error('Error uploading images:', error);
      showToast('Fehler beim Hochladen', 'error');
    }
  };

  const handleAddDocumentation = async (type: 'text' | 'voice' | 'image' | 'video') => {
    if (!selectedDefect) return;

    if (type === 'text' && !docFormData.content.trim()) {
      showToast('Bitte Text eingeben', 'error');
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('task_documentation').insert({
        task_id: selectedDefect.id,
        project_id: id,
        user_id: userData.user?.id,
        content: type === 'text' ? docFormData.content.trim() : null,
        documentation_type: type
      });

      if (error) throw error;

      showToast('Dokumentation hinzugefügt', 'success');
      setDocFormData({ type: '', content: '' });
      loadDefectDetails(selectedDefect.id);
    } catch (error: any) {
      console.error('Error adding documentation:', error);
      showToast('Fehler beim Hinzufügen', 'error');
    }
  };

  const handleDeleteImage = async (imageId: string, storagePath: string) => {
    try {
      await supabase.storage.from('task-images').remove([storagePath]);
      await supabase.from('task_images').delete().eq('id', imageId);
      
      showToast('Bild gelöscht', 'success');
      if (selectedDefect) loadDefectDetails(selectedDefect.id);
    } catch (error: any) {
      console.error('Error deleting image:', error);
      showToast('Fehler beim Löschen', 'error');
    }
  };

  const getUserName = (userId: string) => {
    const member = projectMembers.find(m => m.user_id === userId);
    if (member?.profiles?.first_name && member?.profiles?.last_name) {
      return `${member.profiles.first_name} ${member.profiles.last_name}`;
    }
    return member?.profiles?.email || 'Unbekannt';
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'low': return 'Niedrig';
      case 'medium': return 'Mittel';
      case 'high': return 'Hoch';
      case 'critical': return 'Kritisch';
      default: return priority;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#DC2626';
      case 'high': return '#F59E0B';
      case 'medium': return '#3B82F6';
      case 'low': return '#10B981';
      default: return '#94a3b8';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Offen';
      case 'in_progress': return 'In Bearbeitung';
      case 'resolved': return 'Behoben';
      case 'rejected': return 'Abgelehnt';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return '#3B82F6';
      case 'in_progress': return '#F59E0B';
      case 'resolved': return '#10B981';
      case 'rejected': return '#94a3b8';
      default: return '#94a3b8';
    }
  };

  const filteredDefects = priorityFilter === 'all'
    ? defects
    : defects.filter(d => d.priority === priorityFilter);

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
            <Text style={styles.pageTitle}>Mängel</Text>
            <Text style={styles.pageSubtitle}>
              Mängelverwaltung mit Prioritäten und Fristen
            </Text>
          </View>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={18} /> Mangel erfassen
          </Button>
        </View>

        {/* Priority Filter */}
        <View style={styles.filterBar}>
          {['all', 'critical', 'high', 'medium', 'low'].map(p => (
            <TouchableOpacity
              key={p}
              style={[
                styles.filterChip,
                priorityFilter === p && styles.filterChipActive
              ]}
              onPress={() => setPriorityFilter(p)}
            >
              <Text style={[
                styles.filterChipText,
                priorityFilter === p && styles.filterChipTextActive
              ]}>
                {p === 'all' ? 'Alle' : getPriorityLabel(p)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{defects.filter(d => d.status === 'open').length}</Text>
            <Text style={styles.statLabel}>Offen</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{defects.filter(d => d.priority === 'critical').length}</Text>
            <Text style={[styles.statLabel, { color: '#DC2626' }]}>Kritisch</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{defects.filter(d => d.status === 'resolved').length}</Text>
            <Text style={[styles.statLabel, { color: '#10B981' }]}>Behoben</Text>
          </View>
        </View>

        {/* Defects List */}
        <ScrollView style={styles.defectsList} showsVerticalScrollIndicator={false}>
          {filteredDefects.length === 0 ? (
            <Card style={styles.emptyCard}>
              <AlertCircle size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>
                {priorityFilter !== 'all'
                  ? 'Keine Mängel mit dieser Priorität'
                  : 'Noch keine Mängel erfasst'}
              </Text>
              {priorityFilter === 'all' && (
                <Button onClick={() => setIsCreateModalOpen(true)} style={{ marginTop: 16 }}>
                  Ersten Mangel erfassen
                </Button>
              )}
            </Card>
          ) : (
            filteredDefects.map(defect => (
              <TouchableOpacity
                key={defect.id}
                style={[
                  styles.defectCard,
                  { borderLeftColor: getPriorityColor(defect.priority), borderLeftWidth: 4 }
                ]}
                onPress={() => {
                  setSelectedDefect(defect);
                  loadDefectDetails(defect.id);
                }}
              >
                <View style={styles.defectHeader}>
                  <View style={styles.defectTitleRow}>
                    <AlertCircle size={20} color={getPriorityColor(defect.priority)} />
                    <Text style={styles.defectTitle}>{defect.title}</Text>
                  </View>
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(defect.priority) }]}>
                    <Text style={styles.priorityBadgeText}>{getPriorityLabel(defect.priority)}</Text>
                  </View>
                </View>
                {defect.description && (
                  <Text style={styles.defectDescription} numberOfLines={2}>
                    {defect.description}
                  </Text>
                )}
                <View style={styles.defectFooter}>
                  <Text style={styles.defectStatus}>{getStatusLabel(defect.status)}</Text>
                  <Text style={styles.defectDate}>
                    {new Date(defect.created_at).toLocaleDateString('de-DE')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      {/* Create Defect Modal */}
      <ModernModal
        visible={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setTitle('');
          setDescription('');
          setPriority('medium');
          setDueDate('');
          setAssignedTo('');
          setCreateImages([]);
        }}
        title="Mangel erfassen"
      >
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Title */}
          <View style={styles.modalSection}>
            <Text style={styles.modalLabel}>Titel *</Text>
            <TextInput
              style={styles.modalInput}
              value={title}
              onChangeText={setTitle}
              placeholder="z.B. Riss in Wand"
            />
          </View>

          {/* Description */}
          <View style={styles.modalSection}>
            <Text style={styles.modalLabel}>Beschreibung</Text>
            <TextInput
              style={styles.modalTextarea}
              value={description}
              onChangeText={setDescription}
              placeholder="Details zum Mangel..."
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Priority */}
          <View style={styles.modalSection}>
            <Text style={styles.modalLabel}>Priorität</Text>
            <View style={styles.priorityGrid}>
              {(['low', 'medium', 'high', 'critical'] as const).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityOption,
                    priority === p && { 
                      backgroundColor: getPriorityColor(p),
                      borderColor: getPriorityColor(p)
                    }
                  ]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={[
                    styles.priorityOptionText,
                    priority === p && { color: '#ffffff' }
                  ]}>
                    {getPriorityLabel(p)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Assigned To - Select Dropdown */}
          <Select
            label="Zugewiesen an"
            value={assignedTo}
            options={[
              { label: 'Nicht zugewiesen', value: '' },
              ...projectMembers.map((member) => ({
                label: member.profiles.email,
                value: member.user_id
              }))
            ]}
            onChange={(value) => setAssignedTo(String(value))}
            placeholder="Mitglied auswählen"
          />

          {/* Due Date - DatePicker */}
          <DatePicker
            label="Frist"
            value={dueDate}
            onChange={setDueDate}
            placeholder="TT.MM.JJJJ"
          />

          {/* Image Upload with Drag & Drop */}
          <View style={styles.modalSection}>
            <Text style={styles.modalLabel}>Bilder hinzufügen (optional)</Text>
            
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${isDragging ? colors.primary : '#cbd5e1'}`,
                borderRadius: 8,
                padding: 24,
                textAlign: 'center',
                backgroundColor: isDragging ? '#f1f5f9' : '#f8fafc',
                cursor: 'pointer',
                marginBottom: 12,
              }}
              onClick={() => createImageInputRef.current?.click()}
            >
              <ImageIcon size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <Text style={{ color: '#64748b', fontSize: 14 }}>
                Bilder per Drag & Drop ablegen oder klicken zum Auswählen
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                PNG, JPG, GIF bis 10MB
              </Text>
            </div>

            <input
              ref={createImageInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleAddCreateImage}
              style={{ display: 'none' }}
            />

            {createImages.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {createImages.map((file, index) => (
                  <View
                    key={index}
                    style={{
                      position: 'relative',
                      width: 80,
                      height: 80,
                      borderRadius: 8,
                      overflow: 'hidden',
                      backgroundColor: '#f1f5f9',
                    }}
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <TouchableOpacity
                      onPress={() => handleRemoveCreateImage(index)}
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        borderRadius: 12,
                        padding: 4,
                      }}
                    >
                      <X size={12} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.modalActions}>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateModalOpen(false);
                setCreateImages([]);
              }}
              style={{ flex: 1 }}
            >
              Abbrechen
            </Button>
            <Button onClick={handleCreateDefect} style={{ flex: 1 }}>
              Erfassen
            </Button>
          </View>
        </ScrollView>
      </ModernModal>

      {/* Defect Detail Modal with Tabs */}
      {selectedDefect && (
        <ModernModal
          visible={!!selectedDefect}
          onClose={() => {
            setSelectedDefect(null);
            setDocFormData({ type: '', content: '' });
            setDefectImages([]);
            setDefectDocumentation([]);
            setActiveTab('info');
          }}
          title={selectedDefect.title}
          maxWidth={900}
        >
          {/* Header with Status Badges */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, paddingHorizontal: 20 }}>
            <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(selectedDefect.priority) }]}>
              <Text style={styles.priorityBadgeText}>{getPriorityLabel(selectedDefect.priority)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedDefect.status) }]}>
              <Text style={styles.statusBadgeText}>{getStatusLabel(selectedDefect.status)}</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'info' && styles.tabActive]}
              onPress={() => setActiveTab('info')}
            >
              <FileText size={18} color={activeTab === 'info' ? colors.primary : '#94a3b8'} />
              <Text style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}>
                Allgemeine Informationen
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'docs' && styles.tabActive]}
              onPress={() => setActiveTab('docs')}
            >
              <FileText size={18} color={activeTab === 'docs' ? colors.primary : '#94a3b8'} />
              <Text style={[styles.tabText, activeTab === 'docs' && styles.tabTextActive]}>
                Dokumentation ({defectDocumentation.length})
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 600 }} showsVerticalScrollIndicator={false}>
            {/* Info Tab */}
            {activeTab === 'info' && (
              <View style={{ padding: 20 }}>
                {selectedDefect.description && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Beschreibung</Text>
                    <Text style={styles.detailText}>{selectedDefect.description}</Text>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={styles.detailText}>{getStatusLabel(selectedDefect.status)}</Text>
                </View>

                {selectedDefect.due_date && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Frist</Text>
                    <Text style={styles.detailText}>
                      {new Date(selectedDefect.due_date).toLocaleDateString('de-DE')}
                    </Text>
                  </View>
                )}

                {selectedDefect.assigned_to && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Zugewiesen an</Text>
                    <Text style={styles.detailText}>{getUserName(selectedDefect.assigned_to)}</Text>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Erfasst am</Text>
                  <Text style={styles.detailText}>
                    {new Date(selectedDefect.created_at).toLocaleString('de-DE')}
                  </Text>
                </View>

                {/* Images Section */}
                <View style={styles.detailSection}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={styles.detailLabel}>📸 Fotos ({defectImages.length})</Text>
                    <input
                      ref={imageFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                    <TouchableOpacity
                      onPress={() => imageFileInputRef.current?.click()}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        backgroundColor: colors.primary,
                        borderRadius: 8,
                      }}
                    >
                      <Upload size={14} color="#ffffff" />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#ffffff' }}>
                        Hochladen
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {defectImages.length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                      {defectImages.map((image) => {
                        const { data: { publicUrl } } = supabase.storage
                          .from('task-images')
                          .getPublicUrl(image.storage_path);

                        return (
                          <View key={image.id} style={styles.imageContainer}>
                            <img
                              src={publicUrl}
                              alt={image.file_name || 'Defect image'}
                              style={{
                                width: '100%',
                              height: 120,
                              objectFit: 'cover',
                              borderRadius: 8,
                            }}
                          />
                          <TouchableOpacity
                            onPress={() => handleDeleteImage(image.id, image.storage_path)}
                            style={styles.imageDeleteButton}
                          >
                            <Trash2 size={14} color="#ffffff" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={{ padding: 20, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: '#E2E8F0', alignItems: 'center' }}>
                    <ImageIcon size={32} color="#cbd5e1" style={{ marginBottom: 8 }} />
                    <Text style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
                      Noch keine Fotos hochgeladen
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Documentation Tab */}
          {activeTab === 'docs' && (
            <View style={{ padding: 20 }}>
              {/* Documentation History */}
              {defectDocumentation.length > 0 && (
                <View style={{ gap: 16, marginBottom: 24 }}>
                  {defectDocumentation.map((doc) => {
                    const docIcons = {
                      text: FileText,
                      voice: Mic,
                      image: ImageIcon,
                      video: Video,
                    };
                    const DocIcon = docIcons[doc.documentation_type as keyof typeof docIcons] || FileText;

                    return (
                      <View key={doc.id} style={{
                        backgroundColor: '#ffffff',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        overflow: 'hidden',
                      }}>
                        {/* Doc Header */}
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 12,
                          backgroundColor: '#F8FAFC',
                          borderBottomWidth: 1,
                          borderBottomColor: '#E2E8F0',
                        }}>
                          <View style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: colors.primary,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 10,
                          }}>
                            <User size={16} color="#ffffff" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>
                              {getUserName(doc.user_id)}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <CalendarIcon size={11} color="#94a3b8" />
                              <Text style={{ fontSize: 11, color: '#64748b' }}>{formatDateTime(doc.created_at)}</Text>
                            </View>
                          </View>
                          <View style={{
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 6,
                            backgroundColor: doc.documentation_type === 'text' ? '#DBEAFE' : '#FEF3C7',
                          }}>
                            <DocIcon size={14} color={doc.documentation_type === 'text' ? colors.primary : '#F59E0B'} />
                          </View>
                        </View>
                        
                        {/* Doc Content */}
                        {doc.documentation_type === 'text' && doc.content && (
                          <View style={{ padding: 14 }}>
                            <div 
                              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(doc.content) }} 
                              style={{ 
                                fontSize: 13, 
                                lineHeight: '20px', 
                                color: '#334155',
                              }} 
                            />
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Add New Documentation */}
              <View style={{ marginTop: 16, gap: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#0f172a' }}>
                  Neue Dokumentation hinzufügen
                </Text>

                {/* Documentation Type Buttons - Always Visible */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setDocFormData({ ...docFormData, type: docFormData.type === 'text' ? '' : 'text' })}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor: docFormData.type === 'text' ? '#EFF6FF' : '#ffffff',
                      borderWidth: docFormData.type === 'text' ? 2 : 1,
                      borderColor: docFormData.type === 'text' ? colors.primary : '#E2E8F0',
                      gap: 8,
                    }}
                  >
                    <FileText size={18} color={docFormData.type === 'text' ? colors.primary : '#64748b'} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: docFormData.type === 'text' ? colors.primary : '#64748b' }}>
                      Text
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setDocFormData({ ...docFormData, type: docFormData.type === 'voice' ? '' : 'voice' })}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor: docFormData.type === 'voice' ? '#EFF6FF' : '#ffffff',
                      borderWidth: docFormData.type === 'voice' ? 2 : 1,
                      borderColor: docFormData.type === 'voice' ? colors.primary : '#E2E8F0',
                      gap: 8,
                    }}
                  >
                    <Mic size={18} color={docFormData.type === 'voice' ? colors.primary : '#64748b'} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: docFormData.type === 'voice' ? colors.primary : '#64748b' }}>
                      Sprache
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setDocFormData({ ...docFormData, type: docFormData.type === 'video' ? '' : 'video' })}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor: docFormData.type === 'video' ? '#EFF6FF' : '#ffffff',
                      borderWidth: docFormData.type === 'video' ? 2 : 1,
                      borderColor: docFormData.type === 'video' ? colors.primary : '#E2E8F0',
                      gap: 8,
                    }}
                  >
                    <Video size={18} color={docFormData.type === 'video' ? colors.primary : '#64748b'} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: docFormData.type === 'video' ? colors.primary : '#64748b' }}>
                      Video
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Content Input for Selected Type */}
                {docFormData.type === 'text' && (
                  <View style={{ marginTop: 8 }}>
                    <RichTextEditor
                      value={docFormData.content}
                      onChange={(content) => setDocFormData({ ...docFormData, content })}
                      placeholder="Dokumentation eingeben..."
                    />
                  </View>
                )}

                {docFormData.type === 'voice' && (
                  <View style={{
                    padding: 20,
                    backgroundColor: '#F8FAFC',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    alignItems: 'center',
                    gap: 12,
                  }}>
                    <View style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Mic size={28} color="#ffffff" />
                    </View>
                    <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center' }}>
                      Sprachaufnahme wird bald verfügbar sein
                    </Text>
                  </View>
                )}

                {docFormData.type === 'video' && (
                  <View style={{
                    padding: 20,
                    backgroundColor: '#F8FAFC',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    alignItems: 'center',
                    gap: 12,
                  }}>
                    <View style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Video size={28} color="#ffffff" />
                    </View>
                    <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center' }}>
                      Videoaufnahme wird bald verfügbar sein
                    </Text>
                  </View>
                )}

                {docFormData.type && (
                  <TouchableOpacity
                    onPress={() => handleAddDocumentation(docFormData.type as 'text' | 'voice' | 'image' | 'video')}
                    style={{
                      padding: 14,
                      backgroundColor: colors.primary,
                      borderRadius: 10,
                      alignItems: 'center',
                      marginTop: 8,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>
                      Dokumentation hinzufügen
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Modal Footer */}
        <View style={{
          flexDirection: 'row',
          padding: 20,
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          backgroundColor: '#ffffff',
          gap: 12,
        }}>
          <TouchableOpacity
            onPress={() => {
              setSelectedDefect(null);
              setDefectImages([]);
              setActiveTab('info');
            }}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 10,
              backgroundColor: '#F8FAFC',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748b' }}>
              Schließen
            </Text>
          </TouchableOpacity>
        </View>
      </ModernModal>
      )}
    </>
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
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  defectsList: {
    flex: 1,
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  defectCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  defectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  defectTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  defectTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  defectDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 20,
  },
  defectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  defectStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  defectDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  modalContent: {
    gap: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  priorityGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  priorityOption: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  priorityOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  detailSection: {
    marginTop: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detailText: {
    fontSize: 15,
    color: '#0f172a',
    lineHeight: 22,
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
    marginTop: 16,
  },
  imageContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
  },
  imageDeleteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  docTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: '#ffffff',
  },
  docTypeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  docTypeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  docActionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalSection: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  modalTextarea: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
