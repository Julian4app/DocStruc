import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import {
  X,
  Check,
  Edit2,
  Trash2,
  Circle,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  FileText,
  Mic,
  Image,
  Video,
  Upload,
  User,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { colors } from '@docstruc/theme';
import { Select } from '../../components/Select';
import { DatePicker } from '../../components/DatePicker';
import { RichTextEditor } from '../../components/RichTextEditor';
import { VoiceRecorder } from '../../components/VoicePlayer';
import DOMPurify from 'dompurify';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigned_to: string | null;
  due_date: string | null;
  story_points?: number | null;
  created_at: string;
  updated_at?: string;
}

interface TaskImage {
  id: string;
  task_id: string;
  storage_path: string;
  file_name: string | null;
  caption?: string | null;
  display_order: number;
  created_at: string;
}

interface TaskDocumentation {
  id: string;
  task_id: string;
  user_id: string;
  content?: string | null;
  documentation_type: string;
  file_name?: string | null;
  storage_path?: string | null;
  duration_seconds?: number | null;
  created_at: string;
}

interface ProjectMember {
  user_id: string;
  email: string;
  role: string;
}

// TaskModal Component - For CREATING tasks (now has full documentation support)
export const TaskModal: React.FC<{
  visible: boolean;
  mode: 'create' | 'edit';
  task?: Task | null;
  projectId: string;
  projectMembers: ProjectMember[];
  formData: {
    title: string;
    description: string;
    priority: string;
    status: string;
    assigned_to: string;
    due_date: string;
    story_points: string;
  };
  onChangeFormData: (field: string, value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  createImages?: File[];
  onAddCreateImage?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveCreateImage?: (index: number) => void;
  isDragging?: boolean;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
}> = ({ 
  visible, 
  mode, 
  task, 
  projectId, 
  projectMembers, 
  formData, 
  onChangeFormData, 
  onSubmit, 
  onClose,
  createImages = [],
  onAddCreateImage,
  onRemoveCreateImage,
  isDragging = false,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  if (!visible) return null;

  const priorities = [
    { value: 'low', label: 'Niedrig', color: '#10b981' },
    { value: 'medium', label: 'Mittel', color: '#f59e0b' },
    { value: 'high', label: 'Hoch', color: '#ef4444' },
    { value: 'critical', label: 'Kritisch', color: '#991b1b' },
  ];

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {mode === 'create' ? 'Neue Aufgabe erstellen' : 'Aufgabe bearbeiten'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Title */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Titel *</Text>
              <TextInput
                style={styles.modalInput}
                value={formData.title}
                onChangeText={(value) => onChangeFormData('title', value)}
                placeholder="Aufgabentitel eingeben..."
              />
            </View>

            {/* Description */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Beschreibung</Text>
              <TextInput
                style={styles.modalTextarea}
                value={formData.description}
                onChangeText={(value) => onChangeFormData('description', value)}
                placeholder="Beschreibung der Aufgabe..."
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Priority */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Priorität</Text>
              <View style={styles.priorityGrid}>
                {priorities.map((priority) => (
                  <TouchableOpacity
                    key={priority.value}
                    style={[
                      styles.priorityButton,
                      { borderColor: priority.color },
                      formData.priority === priority.value && {
                        backgroundColor: priority.color,
                        ...styles.priorityButtonActive,
                      },
                    ]}
                    onPress={() => onChangeFormData('priority', priority.value)}
                  >
                    <Text
                      style={[
                        styles.priorityButtonText,
                        { color: formData.priority === priority.value ? '#ffffff' : priority.color },
                      ]}
                    >
                      {priority.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Assigned To */}
            <Select
              label="Zuweisen an"
              value={formData.assigned_to}
              options={[
                { label: 'Nicht zugewiesen', value: '' },
                ...projectMembers.map((member) => ({
                  label: member.email,
                  value: member.user_id
                }))
              ]}
              onChange={(value) => onChangeFormData('assigned_to', String(value))}
              placeholder="Mitglied auswählen"
            />

            {/* Due Date */}
            <DatePicker
              label="Fälligkeitsdatum"
              value={formData.due_date}
              onChange={(value) => onChangeFormData('due_date', value)}
              placeholder="TT.MM.JJJJ"
            />

            {/* Story Points */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Story Points</Text>
              <TextInput
                style={styles.modalInput}
                value={formData.story_points}
                onChangeText={(value) => onChangeFormData('story_points', value)}
                placeholder="z.B. 5"
                keyboardType="numeric"
              />
            </View>

            {/* Image Upload Section */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Bilder hinzufügen (optional)</Text>
              
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                style={{
                  border: `2px dashed ${isDragging ? colors.primary : '#cbd5e1'}`,
                  borderRadius: 8,
                  padding: 24,
                  textAlign: 'center',
                  backgroundColor: isDragging ? '#f1f5f9' : '#f8fafc',
                  cursor: 'pointer',
                  marginBottom: 12,
                }}
                onClick={() => document.getElementById('create-image-input')?.click()}
              >
                <Image size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                <Text style={{ color: '#64748b', fontSize: 14 }}>
                  Bilder per Drag & Drop ablegen oder klicken zum Auswählen
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                  PNG, JPG, GIF bis 10MB
                </Text>
              </div>

              <input
                id="create-image-input"
                type="file"
                accept="image/*"
                multiple
                onChange={onAddCreateImage}
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
                        onPress={() => onRemoveCreateImage?.(index)}
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
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.modalButtonSecondary} onPress={onClose}>
              <Text style={styles.modalButtonSecondaryText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalButtonPrimary} onPress={onSubmit}>
              <Text style={styles.modalButtonPrimaryText}>
                {mode === 'create' ? 'Erstellen' : 'Speichern'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Task Detail Modal - NEW VERSION WITH TABS
export const TaskDetailModal: React.FC<{
  visible: boolean;
  task: Task | null;
  taskImages: TaskImage[];
  taskDocumentation: TaskDocumentation[];
  projectMembers: ProjectMember[];
  isEditMode: boolean;
  editFormData: any;
  docFormData: any;
  isRecording: boolean;
  onChangeEditFormData: (field: string, value: string) => void;
  onToggleEditMode: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
  onImageUpload: (event: any) => void;
  onChangeDocFormData: (field: string, value: string) => void;
  onSaveDocumentation: () => void;
  onCancelDocumentation: () => void;
  onStartRecording: () => void;
  onClose: () => void;
  getUserName: (userId: string) => string;
}> = ({
  visible,
  task,
  taskImages,
  taskDocumentation,
  projectMembers,
  isEditMode,
  editFormData,
  docFormData,
  isRecording,
  onChangeEditFormData,
  onToggleEditMode,
  onSaveEdit,
  onDelete,
  onStatusChange,
  onImageUpload,
  onChangeDocFormData,
  onSaveDocumentation,
  onCancelDocumentation,
  onStartRecording,
  onClose,
  getUserName,
}) => {
  const [activeTab, setActiveTab] = React.useState<'info' | 'docs'>('info');
  const [isDragging, setIsDragging] = React.useState(false);
  const audioFileInputRef = React.useRef<HTMLInputElement>(null);
  const videoFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );

    if (files.length > 0) {
      const syntheticEvent = {
        target: { files }
      };
      onImageUpload(syntheticEvent as any);
    }
  };

  if (!visible || !task) return null;

  const priorities = [
    { value: 'low', label: 'Niedrig', color: '#10b981' },
    { value: 'medium', label: 'Mittel', color: '#f59e0b' },
    { value: 'high', label: 'Hoch', color: '#ef4444' },
    { value: 'critical', label: 'Kritisch', color: '#991b1b' },
  ];

  const statuses = [
    { value: 'open', label: 'Offen', color: '#94a3b8', icon: Circle },
    { value: 'in_progress', label: 'In Bearbeitung', color: '#f59e0b', icon: Clock },
    { value: 'done', label: 'Erledigt', color: '#10b981', icon: CheckCircle },
    { value: 'blocked', label: 'Blockiert', color: '#ef4444', icon: XCircle },
  ];

  const getPriorityColor = (priority: string) => {
    const p = priorities.find((pr) => pr.value === priority);
    return p ? p.color : '#94a3b8';
  };

  const getStatusColor = (status: string) => {
    const s = statuses.find((st) => st.value === status);
    return s ? s.color : '#94a3b8';
  };

  const getStatusLabel = (status: string) => {
    const s = statuses.find((st) => st.value === status);
    return s ? s.label : status;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.detailModalContent}>
          {/* Header */}
          <View style={styles.detailHeader}>
            <View style={styles.detailHeaderLeft}>
              {isEditMode ? (
                <TextInput
                  style={[styles.detailTitle, { borderWidth: 1, borderColor: '#E2E8F0', padding: 8 }]}
                  value={editFormData.title}
                  onChangeText={(value) => onChangeEditFormData('title', value)}
                />
              ) : (
                <Text style={styles.detailTitle}>{task.title}</Text>
              )}
              <View style={styles.detailBadges}>
                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) }]}>
                  <Text style={styles.priorityBadgeText}>
                    {priorities.find((p) => p.value === task.priority)?.label || task.priority}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) }]}>
                  <Text style={[styles.statusBadgeText, { color: '#ffffff' }]}>
                    {getStatusLabel(task.status)}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.detailHeaderRight}>
              {isEditMode ? (
                <>
                  <TouchableOpacity style={styles.detailIconButton} onPress={onSaveEdit}>
                    <Check size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.detailIconButton} onPress={onToggleEditMode}>
                    <X size={20} color="#64748b" />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={styles.detailIconButton} onPress={onToggleEditMode}>
                    <Edit2 size={20} color="#64748b" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.detailIconButton} onPress={onDelete}>
                    <Trash2 size={20} color="#ef4444" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.detailIconButton} onPress={onClose}>
                    <X size={20} color="#64748b" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'info' && styles.tabActive]}
              onPress={() => setActiveTab('info')}
            >
              <FileText size={18} color={activeTab === 'info' ? colors.primary : '#64748b'} />
              <Text style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}>
                Allgemeine Informationen
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'docs' && styles.tabActive]}
              onPress={() => setActiveTab('docs')}
            >
              <FileText size={18} color={activeTab === 'docs' ? colors.primary : '#64748b'} />
              <Text style={[styles.tabText, activeTab === 'docs' && styles.tabTextActive]}>
                Dokumentation ({taskDocumentation.length})
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.detailBody}>
            {/* TAB 1: GENERAL INFO */}
            {activeTab === 'info' && (
              <>
                {/* Description */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Beschreibung</Text>
                  {isEditMode ? (
                    <TextInput
                      style={styles.modalTextarea}
                      value={editFormData.description}
                      onChangeText={(value) => onChangeEditFormData('description', value)}
                      multiline
                      numberOfLines={4}
                    />
                  ) : (
                    <Text style={styles.detailDescription}>{task.description || 'Keine Beschreibung'}</Text>
                  )}
                </View>

                {/* Info Grid */}
                {!isEditMode && (
                  <View style={styles.detailSection}>
                    <View style={styles.detailInfoGrid}>
                      <View style={styles.detailInfoItem}>
                        <Text style={styles.detailInfoLabel}>Zugewiesen an</Text>
                        <Text style={styles.detailInfoValue}>
                          {task.assigned_to ? getUserName(task.assigned_to) : 'Nicht zugewiesen'}
                        </Text>
                      </View>
                      <View style={styles.detailInfoItem}>
                        <Text style={styles.detailInfoLabel}>Fällig am</Text>
                        <Text style={styles.detailInfoValue}>
                          {task.due_date ? formatDate(task.due_date) : 'Kein Datum'}
                        </Text>
                      </View>
                      <View style={styles.detailInfoItem}>
                        <Text style={styles.detailInfoLabel}>Story Points</Text>
                        <Text style={styles.detailInfoValue}>{task.story_points || '-'}</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Edit Mode Fields */}
                {isEditMode && (
                  <>
                    <View style={styles.detailSection}>
                      <Text style={styles.modalLabel}>Priorität</Text>
                      <View style={styles.priorityGrid}>
                        {priorities.map((priority) => (
                          <TouchableOpacity
                            key={priority.value}
                            style={[
                              styles.priorityButton,
                              { borderColor: priority.color },
                              editFormData.priority === priority.value && {
                                backgroundColor: priority.color,
                                ...styles.priorityButtonActive,
                              },
                            ]}
                            onPress={() => onChangeEditFormData('priority', priority.value)}
                          >
                            <Text
                              style={[
                                styles.priorityButtonText,
                                { color: editFormData.priority === priority.value ? '#ffffff' : priority.color },
                              ]}
                            >
                              {priority.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <Select
                      label="Zuweisen an"
                      value={editFormData.assigned_to}
                      options={[
                        { label: 'Nicht zugewiesen', value: '' },
                        ...projectMembers.map((member) => ({
                          label: member.email,
                          value: member.user_id
                        }))
                      ]}
                      onChange={(value) => onChangeEditFormData('assigned_to', String(value))}
                      placeholder="Mitglied auswählen"
                    />

                    <DatePicker
                      label="Fälligkeitsdatum"
                      value={editFormData.due_date}
                      onChange={(value) => onChangeEditFormData('due_date', value)}
                      placeholder="TT.MM.JJJJ"
                    />

                    <View style={styles.detailSection}>
                      <Text style={styles.modalLabel}>Story Points</Text>
                      <TextInput
                        style={styles.modalInput}
                        value={editFormData.story_points}
                        onChangeText={(value) => onChangeEditFormData('story_points', value)}
                        keyboardType="numeric"
                      />
                    </View>
                  </>
                )}

                {/* Status Change */}
                {!isEditMode && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Status ändern</Text>
                    <View style={styles.statusChangeGrid}>
                      {statuses.map((status) => {
                        const IconComponent = status.icon;
                        return (
                          <TouchableOpacity
                            key={status.value}
                            style={[
                              styles.statusChangeButton,
                              {
                                borderColor: status.color,
                                backgroundColor: task.status === status.value ? status.color : 'transparent',
                              },
                            ]}
                            onPress={() => onStatusChange(status.value)}
                          >
                            <IconComponent
                              size={20}
                              color={task.status === status.value ? '#ffffff' : status.color}
                            />
                            <Text
                              style={[
                                styles.statusChangeButtonText,
                                { color: task.status === status.value ? '#ffffff' : status.color },
                              ]}
                            >
                              {status.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Images */}
                <View style={styles.detailSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Text style={[styles.detailSectionTitle, { fontSize: 18 }]}>🖼️ Bilder</Text>
                    <View style={{ backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#ffffff' }}>{taskImages.length}</Text>
                    </View>
                  </View>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    style={{
                      border: `2px dashed ${isDragging ? colors.primary : '#E2E8F0'}`,
                      borderRadius: 12,
                      padding: 20,
                      backgroundColor: isDragging ? '#EFF6FF' : '#F8FAFC',
                      transition: 'all 0.3s ease',
                      minHeight: 180,
                    }}
                  >
                    {isDragging ? (
                      <View style={{ 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        padding: 32,
                      }}>
                        <Image size={48} color={colors.primary} style={{ marginBottom: 12 }} />
                        <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>
                          Bilder hier ablegen zum Hochladen
                        </Text>
                        <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                          Mehrere Bilder werden unterstützt
                        </Text>
                      </View>
                    ) : taskImages.length === 0 ? (
                      <View style={{ alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                        <Image size={40} color="#cbd5e1" style={{ marginBottom: 12 }} />
                        <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 8 }}>
                          Noch keine Bilder vorhanden
                        </Text>
                        <Text style={{ fontSize: 12, color: '#cbd5e1', textAlign: 'center', marginBottom: 16 }}>
                          Ziehen Sie Bilder hierher oder klicken Sie unten
                        </Text>
                        <label htmlFor="image-upload" style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 20px',
                          backgroundColor: colors.primary,
                          color: '#ffffff',
                          borderRadius: 8,
                          cursor: 'pointer',
                          fontSize: 14,
                          fontWeight: '600',
                          transition: 'all 0.2s',
                        }}>
                          <Plus size={16} />
                          Bilder auswählen
                          <input
                            id="image-upload"
                            type="file"
                            accept="image/*"
                            multiple
                            style={{ display: 'none' }}
                            onChange={onImageUpload}
                          />
                        </label>
                      </View>
                    ) : (
                      <View>
                        <View style={styles.imageGrid}>
                          {taskImages.map((image) => (
                            <View key={image.id} style={styles.imageItem}>
                              <img
                                src={`${supabase.storage.from('task-attachments').getPublicUrl(image.storage_path).data.publicUrl}`}
                                alt={image.file_name || ''}
                                style={styles.imageItemImage}
                              />
                            </View>
                          ))}
                        </View>
                        <label htmlFor="image-upload-additional" style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 20px',
                          backgroundColor: '#ffffff',
                          color: colors.primary,
                          border: `2px solid ${colors.primary}`,
                          borderRadius: 8,
                          cursor: 'pointer',
                          fontSize: 14,
                          fontWeight: '600',
                          marginTop: 16,
                          transition: 'all 0.2s',
                        }}>
                          <Plus size={16} />
                          Weitere Bilder hinzufügen
                          <input
                            id="image-upload-additional"
                            type="file"
                            accept="image/*"
                            multiple
                            style={{ display: 'none' }}
                            onChange={onImageUpload}
                          />
                        </label>
                      </View>
                    )}
                  </div>
                </View>
              </>
            )}

            {/* TAB 2: DOCUMENTATION */}
            {activeTab === 'docs' && (
              <View style={styles.detailSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Text style={[styles.detailSectionTitle, { fontSize: 18 }]}>📝 Dokumentation</Text>
                  <View style={{ backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#ffffff' }}>{taskDocumentation.length}</Text>
                  </View>
                </View>

                {/* Documentation History */}
                {taskDocumentation.length > 0 ? (
                  <View style={{ gap: 16, marginBottom: 24 }}>
                    {taskDocumentation.map((doc) => {
                      const docIcons = {
                        text: FileText,
                        voice: Mic,
                        image: Image,
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
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.05,
                          shadowRadius: 4,
                          elevation: 2,
                        }}>
                          {/* Doc Header with User Info */}
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 12,
                            backgroundColor: '#F8FAFC',
                            borderBottomWidth: 1,
                            borderBottomColor: '#E2E8F0',
                          }}>
                            <View style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              backgroundColor: colors.primary,
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 12,
                            }}>
                              <User size={18} color="#ffffff" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 2 }}>
                                {getUserName(doc.user_id)}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <CalendarIcon size={12} color="#94a3b8" />
                                  <Text style={{ fontSize: 12, color: '#64748b' }}>{formatDateTime(doc.created_at)}</Text>
                                </View>
                                <View style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 2,
                                  borderRadius: 6,
                                  backgroundColor: doc.documentation_type === 'text' ? '#DBEAFE' : '#FEF3C7',
                                }}>
                                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155' }}>
                                    {doc.documentation_type === 'text' ? 'Text' : doc.documentation_type === 'voice' ? 'Sprache' : doc.documentation_type === 'video' ? 'Video' : 'Datei'}
                                  </Text>
                                </View>
                              </View>
                            </View>
                            <View style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: doc.documentation_type === 'text' ? '#DBEAFE' : '#FEF3C7',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <DocIcon size={16} color={doc.documentation_type === 'text' ? colors.primary : '#F59E0B'} />
                            </View>
                          </View>
                          
                          {/* Doc Content */}
                          <View style={{ padding: 16 }}>
                            {doc.documentation_type === 'text' ? (
                              <div 
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(doc.content || '') }} 
                                style={{ 
                                  fontSize: 14, 
                                  lineHeight: '22px', 
                                  color: '#334155',
                                }} 
                              />
                            ) : (
                              <View>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 4 }}>
                                  {doc.file_name}
                                </Text>
                                {doc.duration_seconds && (
                                  <Text style={{ fontSize: 12, color: '#64748b' }}>
                                    Dauer: {Math.floor(doc.duration_seconds / 60)}:{String(doc.duration_seconds % 60).padStart(2, '0')} min
                                  </Text>
                                )}
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={{ padding: 32, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: '#E2E8F0', alignItems: 'center', marginBottom: 24 }}>
                    <FileText size={40} color="#cbd5e1" style={{ marginBottom: 12 }} />
                    <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 4 }}>Noch keine Dokumentation vorhanden</Text>
                    <Text style={{ fontSize: 12, color: '#cbd5e1', textAlign: 'center' }}>Fügen Sie unten Notizen, Sprachaufnahmen oder Videos hinzu</Text>
                  </View>
                )}

                {/* Add New Documentation */}
                <View style={{ backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 12, padding: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12 }}>➕ Neue Dokumentation hinzufügen</Text>
                  
                  {/* Type Selector - Always visible at the top */}
                  <View style={styles.docAddButtons}>
                    <TouchableOpacity
                      style={[styles.docAddButton, docFormData.type === 'text' && { backgroundColor: '#EFF6FF', borderColor: colors.primary, borderWidth: 2 }]}
                      onPress={() => onChangeDocFormData('type', docFormData.type === 'text' ? '' : 'text')}
                    >
                      <FileText size={20} color={colors.primary} />
                      <Text style={[styles.docAddButtonText, { color: colors.primary }]}>
                        Text
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.docAddButton, docFormData.type === 'voice' && { backgroundColor: '#EFF6FF', borderColor: colors.primary, borderWidth: 2 }]}
                      onPress={() => onChangeDocFormData('type', docFormData.type === 'voice' ? '' : 'voice')}
                    >
                      <Mic size={20} color={colors.primary} />
                      <Text style={[styles.docAddButtonText, { color: colors.primary }]}>
                        Sprache
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.docAddButton, docFormData.type === 'video' && { backgroundColor: '#EFF6FF', borderColor: colors.primary, borderWidth: 2 }]}
                      onPress={() => onChangeDocFormData('type', docFormData.type === 'video' ? '' : 'video')}
                    >
                      <Video size={20} color={colors.primary} />
                      <Text style={[styles.docAddButtonText, { color: colors.primary }]}>
                        Video
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Content based on type - Only show when type is selected */}
                  {docFormData.type === 'text' && (
                    <>
                      <View style={{ marginTop: 16, marginBottom: 12 }}>
                        <RichTextEditor
                          value={docFormData.content || ''}
                          onChange={(value) => onChangeDocFormData('content', value)}
                        />
                      </View>
                      <View style={styles.docAddActions}>
                        <TouchableOpacity
                          style={[styles.docAddActionButton, styles.docAddActionButtonCancel]}
                          onPress={() => {
                            onCancelDocumentation();
                            onChangeDocFormData('type', '');
                          }}
                        >
                          <Text style={[styles.docAddActionButtonText, styles.docAddActionButtonTextCancel]}>
                            Abbrechen
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.docAddActionButton, styles.docAddActionButtonSave]}
                          onPress={onSaveDocumentation}
                        >
                          <Text style={[styles.docAddActionButtonText, styles.docAddActionButtonTextSave]}>
                            Speichern
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {docFormData.type === 'voice' && (
                    <View style={{ marginTop: 16 }}>
                      <View style={{ backgroundColor: '#F8FAFC', padding: 20, borderRadius: 12, borderWidth: 2, borderColor: '#E2E8F0' }}>
                        <VoiceRecorder
                          isRecording={isRecording}
                          onStart={() => {
                            if (onStartRecording) onStartRecording();
                          }}
                          onStop={() => {}}
                          disabled={false}
                        />
                        <View style={{ marginTop: 16, alignItems: 'center' }}>
                          <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>oder</Text>
                          <input
                            ref={audioFileInputRef}
                            type="file"
                            accept="audio/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                console.log('Audio file selected:', file.name);
                              }
                            }}
                            style={{ display: 'none' }}
                          />
                          <TouchableOpacity
                            onPress={() => audioFileInputRef.current?.click()}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                              paddingVertical: 10,
                              paddingHorizontal: 20,
                              backgroundColor: '#ffffff',
                              borderRadius: 8,
                              borderWidth: 2,
                              borderColor: colors.primary,
                            }}
                          >
                            <Upload size={16} color={colors.primary} />
                            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
                              Audiodatei hochladen
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.docAddActions}>
                        <TouchableOpacity
                          style={[styles.docAddActionButton, styles.docAddActionButtonCancel]}
                          onPress={() => {
                            onCancelDocumentation();
                            onChangeDocFormData('type', '');
                          }}
                        >
                          <Text style={[styles.docAddActionButtonText, styles.docAddActionButtonTextCancel]}>
                            Abbrechen
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.docAddActionButton, styles.docAddActionButtonSave]}
                          onPress={onSaveDocumentation}
                        >
                          <Text style={[styles.docAddActionButtonText, styles.docAddActionButtonTextSave]}>
                            Speichern
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {docFormData.type === 'video' && (
                    <View style={{ marginTop: 16 }}>
                      <View style={{ backgroundColor: '#F8FAFC', padding: 20, borderRadius: 12, borderWidth: 2, borderColor: '#E2E8F0' }}>
                        <View style={{ alignItems: 'center', marginBottom: 16 }}>
                          <Video size={48} color="#cbd5e1" style={{ marginBottom: 12 }} />
                          <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center' }}>
                            Videodatei hochladen
                          </Text>
                        </View>
                        <input
                          ref={videoFileInputRef}
                          type="file"
                          accept="video/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              console.log('Video file selected:', file.name);
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: 12,
                            borderRadius: 8,
                            border: '2px solid #E2E8F0',
                            backgroundColor: '#ffffff',
                            cursor: 'pointer',
                          }}
                        />
                      </View>
                      <View style={styles.docAddActions}>
                        <TouchableOpacity
                          style={[styles.docAddActionButton, styles.docAddActionButtonCancel]}
                          onPress={() => {
                            onCancelDocumentation();
                            onChangeDocFormData('type', '');
                          }}
                        >
                          <Text style={[styles.docAddActionButtonText, styles.docAddActionButtonTextCancel]}>
                            Abbrechen
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.docAddActionButton, styles.docAddActionButtonSave]}
                          onPress={onSaveDocumentation}
                        >
                          <Text style={[styles.docAddActionButtonText, styles.docAddActionButtonTextSave]}>
                            Speichern
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
          
          {/* Footer with Save Button for Edit Mode */}
          {isEditMode && (
            <View style={styles.detailFooter}>
              <TouchableOpacity
                style={styles.detailFooterButtonSecondary}
                onPress={onToggleEditMode}
              >
                <Text style={styles.detailFooterButtonSecondaryText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.detailFooterButtonPrimary}
                onPress={onSaveEdit}
              >
                <Check size={18} color="#ffffff" />
                <Text style={styles.detailFooterButtonPrimaryText}>Änderungen speichern</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 600, maxHeight: '90%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  modalCloseButton: { padding: 4 },
  modalBody: { maxHeight: 500 },
  modalSection: { marginBottom: 20 },
  modalLabel: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8 },
  modalInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, fontSize: 14, color: '#0f172a' },
  modalTextarea: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, fontSize: 14, color: '#0f172a', minHeight: 100, textAlignVertical: 'top' },
  priorityGrid: { flexDirection: 'row', gap: 8 },
  priorityButton: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center' },
  priorityButtonActive: { borderWidth: 2 },
  priorityButtonText: { fontSize: 13, fontWeight: '700' },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  modalButtonSecondary: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  modalButtonSecondaryText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  modalButtonPrimary: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center' },
  modalButtonPrimaryText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  
  // Detail Modal Styles
  detailModalContent: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 900, maxHeight: '90%', overflow: 'hidden' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  detailHeaderLeft: { flex: 1 },
  detailTitle: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  detailBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  detailHeaderRight: { flexDirection: 'row', gap: 8 },
  detailIconButton: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  
  // Tabs
  tabBar: { flexDirection: 'row', gap: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#E2E8F0' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 3, borderBottomColor: 'transparent', marginBottom: -2 },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: colors.primary },
  
  detailBody: { maxHeight: 600 },
  detailSection: { marginBottom: 24 },
  detailSectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  detailDescription: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  detailInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  detailInfoItem: { flex: 1, minWidth: 150, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 8 },
  detailInfoLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 4 },
  detailInfoValue: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  statusChangeGrid: { flexDirection: 'row', gap: 8 },
  statusChangeButton: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center' },
  statusChangeButtonText: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  imageItem: { width: 100, height: 100, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  imageItemImage: { width: '100%', height: '100%' },
  docAddButtons: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  docAddButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#ffffff' },
  docAddButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  docAddButtonText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  docAddButtonTextActive: { color: '#ffffff' },
  docAddActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  docAddActionButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  docAddActionButtonCancel: { borderWidth: 1, borderColor: '#E2E8F0' },
  docAddActionButtonSave: { backgroundColor: colors.primary },
  docAddActionButtonText: { fontSize: 14, fontWeight: '700' },
  docAddActionButtonTextCancel: { color: '#64748b' },
  docAddActionButtonTextSave: { color: '#ffffff' },
  priorityBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  priorityBadgeText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  statusBadgeText: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  
  // Footer styles for edit mode
  detailFooter: { 
    flexDirection: 'row', 
    gap: 12, 
    paddingTop: 16, 
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderTopWidth: 1, 
    borderTopColor: '#E2E8F0',
    backgroundColor: '#ffffff',
  },
  detailFooterButtonSecondary: { 
    flex: 1, 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  detailFooterButtonSecondaryText: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#64748b' 
  },
  detailFooterButtonPrimary: { 
    flex: 2, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    backgroundColor: colors.primary,
  },
  detailFooterButtonPrimaryText: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#ffffff' 
  },
});
