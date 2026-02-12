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
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { colors } from '@docstruc/theme';
import { Select } from '../../components/Select';
import { DatePicker } from '../../components/DatePicker';

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

// Helper Component: Create/Edit Task Modal
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
  // Image upload props for create mode
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

            {/* Image Upload Section - Only in Create Mode */}
            {mode === 'create' && (
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Bilder hinzufügen</Text>
                
                {/* Drag and Drop Zone */}
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

                {/* Image Previews */}
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
            )}
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

// Helper Component: Task Detail Modal
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
  const [isDragging, setIsDragging] = React.useState(false);

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
      // Create a synthetic event for compatibility
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

          <ScrollView style={styles.detailBody}>
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
              <View style={styles.detailSectionHeader}>
                <Text style={styles.detailSectionTitle}>Bilder ({taskImages.length})</Text>
              </View>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${isDragging ? colors.primary : 'transparent'}`,
                  borderRadius: 8,
                  padding: isDragging ? 16 : 0,
                  backgroundColor: isDragging ? '#f1f5f9' : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                {isDragging && (
                  <View style={{ 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    padding: 24,
                    marginBottom: 12,
                  }}>
                    <Image size={32} color={colors.primary} style={{ marginBottom: 8 }} />
                    <Text style={{ color: colors.primary, fontSize: 14 }}>
                      Bilder hier ablegen...
                    </Text>
                  </View>
                )}
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
                  <label htmlFor="image-upload" style={styles.imageUploadButton}>
                    <Plus size={24} color="#94a3b8" />
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
              </div>
            </View>

            {/* Documentation */}
            <View style={styles.detailSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={[styles.detailSectionTitle, { fontSize: 18 }]}>📝 Dokumentation</Text>
                <View style={{ backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#ffffff' }}>{taskDocumentation.length}</Text>
                </View>
              </View>

              {/* Documentation List */}
              {taskDocumentation.length > 0 ? (
                <View style={{ gap: 12, marginBottom: 16 }}>
                  {taskDocumentation.map((doc) => {
                  const docIcons = {
                    text: FileText,
                    voice: Mic,
                    image: Image,
                    video: Video,
                  };
                  const DocIcon = docIcons[doc.documentation_type as keyof typeof docIcons] || FileText;

                  return (
                    <View key={doc.id} style={[
                      styles.docItem,
                      {
                        backgroundColor: doc.documentation_type === 'text' ? '#F8FAFC' : '#EFF6FF',
                        borderLeftWidth: 4,
                        borderLeftColor: doc.documentation_type === 'text' ? colors.primary : '#F59E0B',
                        padding: 16,
                        borderRadius: 12,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 3,
                        elevation: 1,
                      }
                    ]}>
                      <View style={[styles.docItemIcon, { width: 44, height: 44, borderRadius: 22 }]}>
                        <DocIcon size={20} color="#ffffff" />
                      </View>
                      <View style={styles.docItemContent}>
                        <View style={styles.docItemHeader}>
                          <Text style={styles.docItemUser}>{getUserName(doc.user_id)}</Text>
                          <Text style={styles.docItemTime}>{formatDateTime(doc.created_at)}</Text>
                        </View>
                        {doc.documentation_type === 'text' ? (
                          <Text style={[styles.docItemText, { fontSize: 14, lineHeight: 22, color: '#334155' }]}>{doc.content}</Text>
                        ) : (
                          <View style={styles.docItemFile}>
                            <Text style={[styles.docItemFileName, { fontSize: 14 }]}>{doc.file_name}</Text>
                            {doc.duration_seconds && (
                              <Text style={[styles.docItemTime, { fontSize: 12 }]}>
                                {Math.floor(doc.duration_seconds / 60)}:{String(doc.duration_seconds % 60).padStart(2, '0')}
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
                <View style={{ padding: 24, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: '#E2E8F0', alignItems: 'center', marginBottom: 16 }}>
                  <FileText size={32} color="#cbd5e1" style={{ marginBottom: 8 }} />
                  <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center' }}>Noch keine Dokumentation vorhanden</Text>
                  <Text style={{ fontSize: 12, color: '#cbd5e1', textAlign: 'center', marginTop: 4 }}>Fügen Sie unten Notizen, Sprachaufnahmen oder Videos hinzu</Text>
                </View>
              )}

              {/* Add Documentation */}
              <View style={[styles.docAddSection, { backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#E2E8F0', padding: 16, marginTop: 0 }]}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 12 }}>➕ Neue Dokumentation hinzufügen</Text>
                <View style={styles.docAddButtons}>
                  <TouchableOpacity
                    style={[
                      styles.docAddButton,
                      docFormData.type === 'text' && styles.docAddButtonActive,
                    ]}
                    onPress={() => onChangeDocFormData('type', 'text')}
                  >
                    <FileText size={16} color={docFormData.type === 'text' ? '#ffffff' : '#64748b'} />
                    <Text
                      style={[
                        styles.docAddButtonText,
                        docFormData.type === 'text' && styles.docAddButtonTextActive,
                      ]}
                    >
                      Text
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.docAddButton,
                      docFormData.type === 'voice' && styles.docAddButtonActive,
                    ]}
                    onPress={() => onChangeDocFormData('type', 'voice')}
                  >
                    <Mic size={16} color={docFormData.type === 'voice' ? '#ffffff' : '#64748b'} />
                    <Text
                      style={[
                        styles.docAddButtonText,
                        docFormData.type === 'voice' && styles.docAddButtonTextActive,
                      ]}
                    >
                      Sprache
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.docAddButton,
                      docFormData.type === 'video' && styles.docAddButtonActive,
                    ]}
                    onPress={() => onChangeDocFormData('type', 'video')}
                  >
                    <Video size={16} color={docFormData.type === 'video' ? '#ffffff' : '#64748b'} />
                    <Text
                      style={[
                        styles.docAddButtonText,
                        docFormData.type === 'video' && styles.docAddButtonTextActive,
                      ]}
                    >
                      Video
                    </Text>
                  </TouchableOpacity>
                </View>

                {docFormData.type === 'text' && (
                  <>
                    <TextInput
                      style={styles.docAddInput}
                      value={docFormData.content}
                      onChangeText={(value) => onChangeDocFormData('content', value)}
                      placeholder="Dokumentation eingeben..."
                      multiline
                      numberOfLines={3}
                    />
                    <View style={styles.docAddActions}>
                      <TouchableOpacity
                        style={[styles.docAddActionButton, styles.docAddActionButtonCancel]}
                        onPress={onCancelDocumentation}
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
                  <View>
                    {isRecording && (
                      <View style={styles.recordingIndicator}>
                        <View style={styles.recordingDot} />
                        <Text style={styles.recordingText}>Aufnahme läuft...</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={[styles.detailSectionButton, { backgroundColor: isRecording ? '#ef4444' : colors.primary }]}
                      onPress={onStartRecording}
                    >
                      <Mic size={16} color="#ffffff" />
                      <Text style={styles.detailSectionButtonText}>
                        {isRecording ? 'Aufnahme stoppen' : 'Aufnahme starten'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {docFormData.type === 'video' && (
                  <View>
                    <label htmlFor="video-upload" style={{ display: 'block' }}>
                      <View style={[styles.detailSectionButton, { marginTop: 0 }]}>
                        <Video size={16} color="#ffffff" />
                        <Text style={styles.detailSectionButtonText}>Video auswählen</Text>
                      </View>
                      <input
                        id="video-upload"
                        type="file"
                        accept="video/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          console.log('Video-Upload noch nicht implementiert');
                        }}
                      />
                    </label>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 600, maxHeight: '90%' },
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
  detailModalContent: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 800, maxHeight: '90%' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  detailHeaderLeft: { flex: 1 },
  detailTitle: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  detailBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  detailHeaderRight: { flexDirection: 'row', gap: 8 },
  detailIconButton: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  detailBody: { maxHeight: 600 },
  detailSection: { marginBottom: 24 },
  detailSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  detailSectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  detailSectionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: colors.primary },
  detailSectionButtonText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
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
  imageUploadButton: { width: 100, height: 100, borderRadius: 8, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  docList: { gap: 12 },
  docItem: { flexDirection: 'row', gap: 12, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 8 },
  docItemIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  docItemContent: { flex: 1 },
  docItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  docItemUser: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  docItemTime: { fontSize: 11, color: '#64748b' },
  docItemText: { fontSize: 13, color: '#334155', lineHeight: 18 },
  docItemFile: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  docItemFileName: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  docAddSection: { marginTop: 12, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 8 },
  docAddButtons: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  docAddButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#ffffff' },
  docAddButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  docAddButtonText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  docAddButtonTextActive: { color: '#ffffff' },
  docAddInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, fontSize: 14, color: '#0f172a', minHeight: 80, textAlignVertical: 'top', marginBottom: 8 },
  docAddActions: { flexDirection: 'row', gap: 8 },
  docAddActionButton: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  docAddActionButtonCancel: { borderWidth: 1, borderColor: '#E2E8F0' },
  docAddActionButtonSave: { backgroundColor: colors.primary },
  docAddActionButtonText: { fontSize: 13, fontWeight: '700' },
  docAddActionButtonTextCancel: { color: '#64748b' },
  docAddActionButtonTextSave: { color: '#ffffff' },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#FEE2E2', borderRadius: 8, marginVertical: 12 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626' },
  recordingText: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  priorityBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  priorityBadgeText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  statusBadgeText: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
});
