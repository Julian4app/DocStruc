import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { Card } from '@docstruc/ui';
import { colors, spacing } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { ModernModal } from '../../components/ModernModal';
import { useToast } from '../../components/ToastProvider';
import { useProjectPermissionContext } from '../../components/PermissionGuard';
import { useContentVisibility } from '../../hooks/useContentVisibility';
import { VisibilityBadge, VisibilityDropdown, VisibilitySelector, VisibilityLevel } from '../../components/VisibilityControls';
import { TaskModal, TaskDetailModal } from './TaskModals';
import { Select } from '../../components/Select';
import { DatePicker } from '../../components/DatePicker';
import { 
  Plus, Search, Filter, CheckCircle, Clock, XCircle, AlertCircle, 
  Calendar, List, LayoutGrid, Edit, Trash2, Image as ImageIcon, 
  Mic, Video, FileText, User, ChevronLeft, ChevronRight, Users,
  Upload, X, MessageSquare, PlayCircle, PauseCircle, Circle, GripVertical
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'done' | 'blocked';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  due_date: string | null;
  assigned_to: string | null;
  story_points?: number | null;
  labels?: string[];
  board_position?: number;
  created_at: string;
  updated_at?: string;
  creator_id?: string;
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
  content?: string | null;
  documentation_type: 'text' | 'voice' | 'image' | 'video';
  storage_path?: string | null;
  file_name?: string | null;
  duration_seconds?: number | null;
  created_at: string;
  user_id: string;
  user?: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
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

type ViewMode = 'kanban' | 'list' | 'calendar';

export function ProjectTasks() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const ctx = useProjectPermissionContext();
  const pCanCreate = ctx?.isProjectOwner || ctx?.canCreate?.('tasks') || false;
  const pCanEdit = ctx?.isProjectOwner || ctx?.canEdit?.('tasks') || false;
  const pCanDelete = ctx?.isProjectOwner || ctx?.canDelete?.('tasks') || false;
  const { defaultVisibility, filterVisibleItems, setContentVisibility, getContentVisibility } = useContentVisibility(id, 'tasks');
  const [createVisibility, setCreateVisibility] = useState<VisibilityLevel>('all_participants');
  const [editVisibility, setEditVisibility] = useState<VisibilityLevel>('all_participants');
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Task form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<string>('medium');
  const [formAssignedTo, setFormAssignedTo] = useState<string>('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formStoryPoints, setFormStoryPoints] = useState('');
  const [formStatus, setFormStatus] = useState<string>('open');
  
  // Form data objects for modals
  const [createFormData, setCreateFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'open',
    assigned_to: '',
    due_date: '',
    story_points: ''
  });
  
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'open',
    assigned_to: '',
    due_date: '',
    story_points: ''
  });
  
  const [docFormData, setDocFormData] = useState({
    type: '',
    content: ''
  });
  
  // Task detail state
  const [taskImages, setTaskImages] = useState<TaskImage[]>([]);
  const [taskDocumentation, setTaskDocumentation] = useState<TaskDocumentation[]>([]);
  const [newDocText, setNewDocText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  
  // Image upload for create modal
  const [createImages, setCreateImages] = useState<File[]>([]);
  const [isDraggingCreate, setIsDraggingCreate] = useState(false);
  
  // Native drag-and-drop state for Kanban
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadTasks();
      loadProjectMembers();
    }
  }, [id]);

  useEffect(() => {
    filterTasks();
  }, [tasks, searchQuery, statusFilter, priorityFilter, defaultVisibility]);

  const loadTasks = async () => {
    if (!id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          profiles:assigned_to(id, email, first_name, last_name)
        `)
        .eq('project_id', id)
        .order('board_position', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      console.error('Error loading tasks:', error);
      showToast('Fehler beim Laden der Aufgaben', 'error');
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

  const loadTaskDetails = async (taskId: string) => {
    try {
      // Load images
      const { data: images } = await supabase
        .from('task_images')
        .select('id, task_id, image_url, display_order, created_at')
        .eq('task_id', taskId)
        .order('display_order', { ascending: true });
      
      setTaskImages(images || []);

      // Load documentation
      const { data: docs } = await supabase
        .from('task_documentation')
        .select(`
          *,
          user:user_id(email, first_name, last_name)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      
      setTaskDocumentation(docs || []);
    } catch (error: any) {
      console.error('Error loading task details:', error);
    }
  };

  const filterTasks = async () => {
    let filtered = [...tasks];

    if (searchQuery) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(task => task.priority === priorityFilter);
    }

    // Apply content visibility (Freigaben) filtering
    try {
      filtered = await filterVisibleItems(filtered);
    } catch (error) {
      console.error('Error filtering visible tasks:', error);
    }

    setFilteredTasks(filtered);
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormPriority('medium');
    setFormAssignedTo('');
    setFormDueDate('');
    setFormStoryPoints('');
    setFormStatus('open');
    setCreateImages([]);
  };

  const handleCreateTask = async () => {
    if (!createFormData.title.trim()) {
      showToast('Bitte geben Sie einen Titel ein', 'error');
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // Create the task first
      const { data: newTask, error: taskError } = await supabase.from('tasks').insert({
        project_id: id,
        title: createFormData.title.trim(),
        description: createFormData.description.trim(),
        status: createFormData.status,
        priority: createFormData.priority,
        assigned_to: createFormData.assigned_to || null,
        due_date: createFormData.due_date || null,
        story_points: createFormData.story_points ? parseInt(createFormData.story_points) : null,
        creator_id: userData.user?.id,
        board_position: tasks.length
      }).select().single();

      if (taskError) throw taskError;

      // Upload images if any
      if (createImages.length > 0 && newTask) {
        for (let i = 0; i < createImages.length; i++) {
          const file = createImages[i];
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${id}/${newTask.id}/${fileName}`;

          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from('task-attachments')
            .upload(filePath, file);

          if (uploadError) {
            console.error('Error uploading image:', uploadError);
            continue;
          }

          // Save to database
          await supabase.from('task_images').insert({
            task_id: newTask.id,
            project_id: id,
            uploaded_by: userData.user?.id,
            storage_path: filePath,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            display_order: i
          });
        }
      }

      showToast('Aufgabe erfolgreich erstellt', 'success');

      // Set content visibility override if not default
      if (newTask && createVisibility !== 'all_participants') {
        await setContentVisibility(newTask.id, createVisibility);
      }

      setIsCreateModalOpen(false);
      setCreateFormData({ title: '', description: '', priority: 'medium', status: 'open', assigned_to: '', due_date: '', story_points: '' });
      setCreateVisibility(defaultVisibility || 'all_participants');
      setCreateImages([]);
      loadTasks();
    } catch (error: any) {
      console.error('Error creating task:', error);
      showToast('Fehler beim Erstellen der Aufgabe', 'error');
    }
  };

  const handleUpdateTask = async () => {
    if (!selectedTask) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: editFormData.title?.trim() || selectedTask.title,
          description: editFormData.description?.trim() || selectedTask.description || '',
          status: editFormData.status,
          priority: editFormData.priority,
          assigned_to: editFormData.assigned_to || null,
          due_date: editFormData.due_date || null,
          story_points: editFormData.story_points ? parseInt(editFormData.story_points) : null,
        })
        .eq('id', selectedTask.id);

      if (error) throw error;

      // Save content visibility
      await setContentVisibility(selectedTask.id, editVisibility);

      showToast('Aufgabe aktualisiert', 'success');
      setIsEditMode(false);
      loadTasks();
      
      // Update selected task
      const updatedTask = {
        ...selectedTask,
        title: editFormData.title.trim(),
        description: editFormData.description.trim(),
        status: editFormData.status as any,
        priority: editFormData.priority as any,
        assigned_to: editFormData.assigned_to || null,
        due_date: editFormData.due_date || null,
        story_points: editFormData.story_points ? parseInt(editFormData.story_points) : undefined,
      };
      setSelectedTask(updatedTask);
    } catch (error: any) {
      console.error('Error updating task:', error);
      showToast('Fehler beim Aktualisieren', 'error');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Aufgabe wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      showToast('Aufgabe gelöscht', 'success');
      setSelectedTask(null);
      loadTasks();
    } catch (error: any) {
      console.error('Error deleting task:', error);
      showToast('Fehler beim Löschen', 'error');
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      showToast('Status aktualisiert', 'success');
      loadTasks();
      
      if (selectedTask?.id === taskId) {
        setSelectedTask({ ...selectedTask, status: newStatus as any });
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      showToast('Fehler beim Aktualisieren', 'error');
    }
  };

  const handleAddDocumentation = async (type: 'text' | 'voice' | 'image' | 'video') => {
    if (!selectedTask) return;

    if (type === 'text' && !docFormData.content.trim()) {
      showToast('Bitte Text eingeben', 'error');
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('task_documentation').insert({
        task_id: selectedTask.id,
        project_id: id,
        user_id: userData.user?.id,
        content: type === 'text' ? docFormData.content.trim() : null,
        documentation_type: type
      });

      if (error) throw error;

      showToast('Dokumentation hinzugefügt', 'success');
      setDocFormData({ type: '', content: '' });
      loadTaskDetails(selectedTask.id);
    } catch (error: any) {
      console.error('Error adding documentation:', error);
      showToast('Fehler beim Hinzufügen', 'error');
    }
  };

  const handleImageUpload = async (event: any) => {
    if (!selectedTask) return;
    
    const files = event.target?.files ? Array.from(event.target.files) as File[] : [];
    if (files.length === 0) return;

    try {
      const { data: userData } = await supabase.auth.getUser();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${id}/${selectedTask.id}/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Error uploading image:', uploadError);
          continue;
        }

        // Save to database
        await supabase.from('task_images').insert({
          task_id: selectedTask.id,
          project_id: id,
          uploaded_by: userData.user?.id,
          storage_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          display_order: taskImages.length + i
        });
      }

      showToast(`${files.length} Bild(er) hochgeladen`, 'success');
      loadTaskDetails(selectedTask.id);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      showToast('Fehler beim Hochladen', 'error');
    }
  };

  const openTaskDetail = async (task: Task) => {
    setSelectedTask(task);
    setEditFormData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority || 'medium',
      assigned_to: task.assigned_to || '',
      due_date: task.due_date || '',
      story_points: task.story_points?.toString() || ''
    });
    setIsEditMode(false);
    setIsDetailModalOpen(true);
    loadTaskDetails(task.id);

    // Load current visibility for this task
    try {
      const info = await getContentVisibility(task.id);
      setEditVisibility(info.effective_visibility);
    } catch {
      setEditVisibility(defaultVisibility || 'all_participants');
    }
  };

  // Handle image upload for create modal
  const handleCreateImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setCreateImages(prev => [...prev, ...filesArray]);
    }
  };

  const handleRemoveCreateImage = (index: number) => {
    setCreateImages(prev => prev.filter((_, i) => i !== index));
  };

  // Drag and drop handlers for create modal
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCreate(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCreate(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCreate(false);

    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );

    if (files.length > 0) {
      setCreateImages(prev => [...prev, ...files]);
    } else {
      showToast('Bitte nur Bilddateien hochladen', 'error');
    }
  };

  // Native HTML5 drag-and-drop handlers for Kanban
  const handleTaskDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    // Add a slight delay so the drag image renders
    requestAnimationFrame(() => {
      (e.target as HTMLElement).style.opacity = '0.5';
    });
  };

  const handleTaskDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDragTaskId(null);
    setDragOverColumn(null);
  };

  const handleColumnDragOver = (e: React.DragEvent<HTMLDivElement>, columnStatus: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnStatus);
  };

  const handleColumnDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only clear if actually leaving the column (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null);
    }
  };

  const handleColumnDrop = async (e: React.DragEvent<HTMLDivElement>, newStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    // Check edit permission
    if (!pCanEdit) {
      showToast('Keine Berechtigung zum Bearbeiten', 'error');
      setDragTaskId(null);
      return;
    }
    
    const taskId = e.dataTransfer.getData('text/plain') || dragTaskId;
    if (!taskId) return;
    
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) {
      setDragTaskId(null);
      return;
    }

    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as any } : t));
    setDragTaskId(null);

    // Update in database
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;
      showToast('Status aktualisiert', 'success');
      
      if (selectedTask?.id === taskId) {
        setSelectedTask({ ...selectedTask, status: newStatus as any } as Task);
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      showToast('Fehler beim Aktualisieren', 'error');
      loadTasks();
    }
  };  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return <CheckCircle size={20} color="#22c55e" />;
      case 'in_progress': return <Clock size={20} color="#F59E0B" />;
      case 'blocked': return <XCircle size={20} color="#EF4444" />;
      default: return <AlertCircle size={20} color="#94a3b8" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Offen';
      case 'in_progress': return 'In Bearbeitung';
      case 'done': return 'Erledigt';
      case 'blocked': return 'Blockiert';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return '#dcfce7';
      case 'in_progress': return '#FEF3C7';
      case 'blocked': return '#FEE2E2';
      default: return '#F1F5F9';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical': return '#DC2626';
      case 'high': return '#F59E0B';
      case 'medium': return '#3B82F6';
      case 'low': return '#10B981';
      default: return '#94a3b8';
    }
  };

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'critical': return 'Kritisch';
      case 'high': return 'Hoch';
      case 'medium': return 'Mittel';
      case 'low': return 'Niedrig';
      default: return 'Keine';
    }
  };

  const getUserName = (userId: string) => {
    const member = projectMembers.find(m => m.user_id === userId);
    if (!member) return 'Unbekannt';
    const profile = member.profiles;
    if (profile.first_name && profile.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    return profile.email;
  };

  // Render functions for different views
  const renderKanbanView = () => {
    const columns = [
      { status: 'open', label: 'Offen', color: '#F1F5F9' },
      { status: 'in_progress', label: 'In Bearbeitung', color: '#FEF3C7' },
      { status: 'done', label: 'Erledigt', color: '#dcfce7' },
      { status: 'blocked', label: 'Blockiert', color: '#FEE2E2' }
    ];

    return (
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '16px 0' }}>
        {columns.map(column => {
          const columnTasks = filteredTasks.filter(t => t.status === column.status);
          const isOver = dragOverColumn === column.status;
          
          return (
            <div key={column.status} style={{ minWidth: 300, flex: '0 0 300px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ backgroundColor: column.color, padding: 12, borderRadius: 8, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{column.label}</span>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: '4px 8px', borderRadius: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{columnTasks.length}</span>
                </div>
              </div>
              
              {/* Droppable Column */}
              <div
                onDragOver={(e) => handleColumnDragOver(e, column.status)}
                onDragLeave={handleColumnDragLeave}
                onDrop={(e) => handleColumnDrop(e, column.status)}
                style={{
                  minHeight: 200,
                  padding: 8,
                  backgroundColor: isOver ? '#DBEAFE' : '#F8FAFC',
                  borderRadius: 8,
                  transition: 'background-color 0.2s, border-color 0.2s',
                  border: isOver ? '2px dashed #3B82F6' : '2px dashed transparent',
                  flex: 1,
                }}
              >
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable={pCanEdit}
                    onDragStart={(e) => handleTaskDragStart(e, task.id)}
                    onDragEnd={handleTaskDragEnd}
                    onClick={() => openTaskDetail(task)}
                    style={{
                      marginBottom: 12,
                      padding: 16,
                      backgroundColor: dragTaskId === task.id ? '#DBEAFE' : '#ffffff',
                      borderRadius: 12,
                      border: dragTaskId === task.id ? `2px solid ${colors.primary}` : '1px solid #E2E8F0',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      cursor: pCanEdit ? 'grab' : 'pointer',
                      transition: 'box-shadow 0.2s, transform 0.15s, opacity 0.2s',
                      userSelect: 'none' as const,
                    }}
                    onMouseEnter={(e) => {
                      if (!dragTaskId) {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', flex: 1, marginRight: 8 }}>{task.title}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <GripVertical size={14} color="#94a3b8" />
                        {task.priority && (
                          <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getPriorityColor(task.priority) }} />
                        )}
                      </div>
                    </div>
                    
                    {task.description && (
                      <p style={{ fontSize: 13, color: '#64748b', lineHeight: '18px', marginBottom: 12, margin: '0 0 12px 0', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                        {task.description}
                      </p>
                    )}
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {task.assigned_to && (
                          <div style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
                              {projectMembers.find(m => m.user_id === task.assigned_to)?.profiles?.first_name?.[0] ||
                               projectMembers.find(m => m.user_id === task.assigned_to)?.profiles?.email?.[0] || '?'}
                            </span>
                          </div>
                        )}
                        {task.due_date && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', backgroundColor: new Date(task.due_date) < new Date() ? '#FEE2E2' : '#F1F5F9', borderRadius: 6 }}>
                            <Calendar size={12} color={new Date(task.due_date) < new Date() ? '#DC2626' : '#64748b'} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: new Date(task.due_date) < new Date() ? '#DC2626' : '#64748b' }}>
                              {new Date(task.due_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                            </span>
                          </div>
                        )}
                      </div>
                      {task.story_points && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', backgroundColor: '#F1F5F9', padding: '2px 8px', borderRadius: 6 }}>
                          {task.story_points} SP
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                
                {columnTasks.length === 0 && (
                  <div style={{ padding: 24, textAlign: 'center', backgroundColor: isOver ? 'transparent' : '#F8FAFC', borderRadius: 8, border: isOver ? 'none' : '2px dashed #E2E8F0' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', margin: '0 0 4px 0' }}>Keine Aufgaben</p>
                    <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0 }}>Ziehen Sie Aufgaben hierher</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderListView = () => {
    return (
      <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
        {filteredTasks.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Keine Aufgaben gefunden</Text>
          </Card>
        ) : (
          filteredTasks.map(task => (
            <TouchableOpacity
              key={task.id}
              style={styles.listCard}
              onPress={() => openTaskDetail(task)}
            >
              <View style={styles.listCardLeft}>
                {getStatusIcon(task.status)}
                <View style={styles.listCardContent}>
                  <Text style={styles.listCardTitle}>{task.title}</Text>
                  {task.description && (
                    <Text style={styles.listCardDesc} numberOfLines={1}>{task.description}</Text>
                  )}
                </View>
              </View>
              
              <View style={styles.listCardRight}>
                {defaultVisibility !== 'all_participants' && (
                  <VisibilityBadge visibility={defaultVisibility} size="small" showLabel />
                )}
                {task.due_date && (
                  <View style={[styles.dueDateBadge, new Date(task.due_date) < new Date() ? { backgroundColor: '#FEE2E2' } : {}]}>
                    <Calendar size={12} color={new Date(task.due_date) < new Date() ? '#DC2626' : '#64748b'} />
                    <Text style={[styles.dueDateText, new Date(task.due_date) < new Date() ? { color: '#DC2626' } : {}]}>
                      {new Date(task.due_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                    </Text>
                  </View>
                )}
                {task.priority && (
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) }]}>
                    <Text style={styles.priorityBadgeText}>{getPriorityLabel(task.priority)}</Text>
                  </View>
                )}
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) }]}>
                  <Text style={styles.statusBadgeText}>{getStatusLabel(task.status)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    );
  };

  const renderCalendarView = () => {
    const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      // Adjust so Monday is 0 (European calendar)
      const startingDayOfWeek = (firstDay.getDay() + 6) % 7;
      
      return { daysInMonth, startingDayOfWeek, year, month };
    };

    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
    const days = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayTasks = filteredTasks.filter(t => t.due_date && t.due_date.substring(0, 10) === dateStr);
      const isToday = todayStr === dateStr;
      const isPast = new Date(dateStr) < new Date(todayStr);
      
      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.calendarDay,
            isToday && styles.calendarDayToday,
            dayTasks.length > 0 && styles.calendarDayHasTasks
          ]}
          onPress={() => {
            if (dayTasks.length > 0) {
              openTaskDetail(dayTasks[0]);
            }
          }}
        >
          <Text style={[
            styles.calendarDayNumber,
            isToday && styles.calendarDayNumberToday,
            isPast && !isToday && styles.calendarDayNumberPast
          ]}>
            {day}
          </Text>
          {dayTasks.length > 0 && (
            <View style={{ width: '100%', gap: 2, marginTop: 2 }}>
              {dayTasks.slice(0, 2).map((task) => (
                <div
                  key={task.id}
                  style={{
                    width: '100%',
                    padding: '2px 4px',
                    backgroundColor: getPriorityColor(task.priority || 'medium'),
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <span style={{ fontSize: 9, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                    {task.title}
                  </span>
                </div>
              ))}
              {dayTasks.length > 2 && (
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#64748b', textAlign: 'center' }}>+{dayTasks.length - 2} mehr</Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity 
            onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            style={styles.calendarNavButton}
          >
            <ChevronLeft size={20} color={colors.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => setCurrentMonth(new Date())}
            style={styles.calendarTodayButton}
          >
            <Text style={styles.calendarHeaderText}>
              {currentMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            </Text>
            <Text style={styles.calendarTodayButtonText}>Heute</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            style={styles.calendarNavButton}
          >
            <ChevronRight size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.calendarWeekdays}>
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
            <View key={day} style={styles.calendarWeekday}>
              <Text style={styles.calendarWeekdayText}>{day}</Text>
            </View>
          ))}
        </View>
        
        <View style={styles.calendarGrid}>{days}</View>
        
        {/* Legend */}
        <View style={styles.calendarLegend}>
          <Text style={styles.calendarLegendTitle}>Prioritäten:</Text>
          <View style={styles.calendarLegendItems}>
            {[
              { label: 'Kritisch', color: getPriorityColor('critical') },
              { label: 'Hoch', color: getPriorityColor('high') },
              { label: 'Mittel', color: getPriorityColor('medium') },
              { label: 'Niedrig', color: getPriorityColor('low') },
            ].map(item => (
              <View key={item.label} style={styles.calendarLegendItem}>
                <View style={[styles.calendarLegendDot, { backgroundColor: item.color }]} />
                <Text style={styles.calendarLegendText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
        
        {/* Tasks for selected month */}
        <ScrollView style={styles.calendarTasksList}>
          <Text style={styles.calendarTasksTitle}>
            Aufgaben mit Fälligkeitsdatum ({filteredTasks.filter(t => t.due_date && new Date(t.due_date).getMonth() === month && new Date(t.due_date).getFullYear() === year).length})
          </Text>
          {filteredTasks
            .filter(t => t.due_date && new Date(t.due_date).getMonth() === month && new Date(t.due_date).getFullYear() === year)
            .sort((a, b) => {
              if (!a.due_date) return 1;
              if (!b.due_date) return -1;
              return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
            })
            .map(task => (
              <TouchableOpacity
                key={task.id}
                style={styles.calendarTaskCard}
                onPress={() => openTaskDetail(task)}
              >
                <View style={styles.calendarTaskCardLeft}>
                  <View style={[styles.calendarTaskCardIndicator, { backgroundColor: getPriorityColor(task.priority || 'medium') }]} />
                  <View>
                    <Text style={styles.calendarTaskCardDate}>
                      {task.due_date ? new Date(task.due_date).toLocaleDateString('de-DE', { 
                        weekday: 'short',
                        day: '2-digit', 
                        month: 'short' 
                      }) : '-'}
                    </Text>
                    <Text style={styles.calendarTaskCardTitle}>{task.title}</Text>
                    {task.assigned_to && (
                      <Text style={styles.calendarTaskCardAssignee}>
                        {getUserName(task.assigned_to)}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) }]}>
                  <Text style={styles.statusBadgeText}>{getStatusLabel(task.status)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          {filteredTasks.filter(t => t.due_date && new Date(t.due_date).getMonth() === month && new Date(t.due_date).getFullYear() === year).length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Keine Aufgaben mit Fälligkeitsdatum in diesem Monat</Text>
            </View>
          )}

          {/* Tasks without due date */}
          {filteredTasks.filter(t => !t.due_date).length > 0 && (
            <>
              <Text style={[styles.calendarTasksTitle, { marginTop: 20 }]}>
                Ohne Fälligkeitsdatum ({filteredTasks.filter(t => !t.due_date).length})
              </Text>
              {filteredTasks.filter(t => !t.due_date).map(task => (
                <TouchableOpacity
                  key={task.id}
                  style={styles.calendarTaskCard}
                  onPress={() => openTaskDetail(task)}
                >
                  <View style={styles.calendarTaskCardLeft}>
                    <View style={[styles.calendarTaskCardIndicator, { backgroundColor: getPriorityColor(task.priority || 'medium') }]} />
                    <View>
                      <Text style={[styles.calendarTaskCardDate, { color: '#94a3b8' }]}>Kein Datum</Text>
                      <Text style={styles.calendarTaskCardTitle}>{task.title}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) }]}>
                    <Text style={styles.statusBadgeText}>{getStatusLabel(task.status)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    );
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
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Aufgaben</Text>
            <Text style={styles.pageSubtitle}>Scrum Board & Task Management</Text>
          </View>
          {pCanCreate && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              backgroundColor: colors.primary,
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.4)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(59,130,246,0.3)'; }}
          >
            <Plus size={18} /> Neue Aufgabe
          </button>
          )}
        </View>

        {/* View Switcher & Filters */}
        <View style={styles.toolBar}>
          <View style={styles.viewSwitcher}>
            <TouchableOpacity
              style={[styles.viewButton, viewMode === 'kanban' && styles.viewButtonActive]}
              onPress={() => setViewMode('kanban')}
            >
              <LayoutGrid size={18} color={viewMode === 'kanban' ? '#ffffff' : '#64748b'} />
              <Text style={[styles.viewButtonText, viewMode === 'kanban' && styles.viewButtonTextActive]}>Kanban</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.viewButton, viewMode === 'list' && styles.viewButtonActive]}
              onPress={() => setViewMode('list')}
            >
              <List size={18} color={viewMode === 'list' ? '#ffffff' : '#64748b'} />
              <Text style={[styles.viewButtonText, viewMode === 'list' && styles.viewButtonTextActive]}>Liste</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.viewButton, viewMode === 'calendar' && styles.viewButtonActive]}
              onPress={() => setViewMode('calendar')}
            >
              <Calendar size={18} color={viewMode === 'calendar' ? '#ffffff' : '#64748b'} />
              <Text style={[styles.viewButtonText, viewMode === 'calendar' && styles.viewButtonTextActive]}>Kalender</Text>
            </TouchableOpacity>
          </View>

          <div style={{
            position: 'relative',
            width: 320,
            display: 'flex',
            alignItems: 'center',
          }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, zIndex: 1, pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: 40,
                paddingRight: 16,
                paddingTop: 10,
                paddingBottom: 10,
                fontSize: 14,
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                outline: 'none',
                backgroundColor: '#F8FAFC',
                transition: 'all 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.backgroundColor = '#ffffff';
                e.target.style.borderColor = colors.primary;
              }}
              onBlur={(e) => {
                e.target.style.backgroundColor = '#F8FAFC';
                e.target.style.borderColor = '#E2E8F0';
              }}
            />
          </div>
        </View>

        {/* Filters */}
        {viewMode !== 'calendar' && (
          <View style={styles.filterBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b', alignSelf: 'center', marginRight: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status:</Text>
              <TouchableOpacity
                style={[styles.filterChip, statusFilter === 'all' && styles.filterChipActive]}
                onPress={() => setStatusFilter('all')}
              >
                <Text style={[styles.filterChipText, statusFilter === 'all' && styles.filterChipTextActive]}>
                  Alle
                </Text>
              </TouchableOpacity>
              
              {['open', 'in_progress', 'done', 'blocked'].map(status => (
                <TouchableOpacity
                  key={status}
                  style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
                  onPress={() => setStatusFilter(status)}
                >
                  <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>
                    {getStatusLabel(status)}
                  </Text>
                </TouchableOpacity>
              ))}
              
              <View style={styles.filterDivider} />
              
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b', alignSelf: 'center', marginRight: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Priorität:</Text>
              
              <TouchableOpacity
                style={[styles.filterChip, priorityFilter === 'all' && styles.filterChipActive]}
                onPress={() => setPriorityFilter('all')}
              >
                <Text style={[styles.filterChipText, priorityFilter === 'all' && styles.filterChipTextActive]}>
                  Alle
                </Text>
              </TouchableOpacity>
              
              {['critical', 'high', 'medium', 'low'].map(priority => (
                <TouchableOpacity
                  key={priority}
                  style={[styles.filterChip, priorityFilter === priority && styles.filterChipActive]}
                  onPress={() => setPriorityFilter(priority)}
                >
                  <Text style={[styles.filterChipText, priorityFilter === priority && styles.filterChipTextActive]}>
                    {getPriorityLabel(priority)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Content based on view mode */}
        {viewMode === 'kanban' && renderKanbanView()}
        {viewMode === 'list' && renderListView()}
        {viewMode === 'calendar' && renderCalendarView()}
      </View>

      {/* Create/Edit Task Modal */}
      <TaskModal
        visible={isCreateModalOpen || isEditModalOpen}
        mode={isCreateModalOpen ? 'create' : 'edit'}
        task={selectedTask ? { ...selectedTask, priority: selectedTask.priority || 'medium' } : null}
        projectId={id || ''}
        projectMembers={projectMembers
          .filter(m => m.profiles?.email)
          .map(m => ({
            user_id: m.user_id,
            email: m.profiles.email,
            role: m.role || 'member'
          }))}
        formData={isCreateModalOpen ? createFormData : editFormData}
        onChangeFormData={(field, value) => {
          if (isCreateModalOpen) {
            setCreateFormData({ ...createFormData, [field]: value });
          } else {
            setEditFormData({ ...editFormData, [field]: value });
          }
        }}
        onSubmit={isCreateModalOpen ? handleCreateTask : handleUpdateTask}
        onClose={() => {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          setSelectedTask(null);
        }}
        createImages={createImages}
        onAddCreateImage={handleCreateImageSelect}
        onRemoveCreateImage={handleRemoveCreateImage}
        isDragging={isDraggingCreate}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        visibilityControls={isCreateModalOpen ? (
          <VisibilitySelector
            value={createVisibility}
            onChange={setCreateVisibility}
            compact
          />
        ) : undefined}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        visible={isDetailModalOpen}
        task={selectedTask ? { ...selectedTask, priority: selectedTask.priority || 'medium' } : null}
        taskImages={taskImages}
        taskDocumentation={taskDocumentation}
        projectMembers={projectMembers
          .filter(m => m.profiles?.email)
          .map(m => ({
            user_id: m.user_id,
            email: m.profiles.email,
            role: m.role || 'member'
          }))}
        isEditMode={isEditMode}
        editFormData={editFormData}
        docFormData={docFormData}
        isRecording={isRecording}
        canEditPerm={pCanEdit}
        canDeletePerm={pCanDelete}
        visibilityControls={isEditMode ? (
          <VisibilityDropdown
            value={editVisibility}
            onChange={setEditVisibility}
          />
        ) : undefined}
        onChangeEditFormData={(field, value) => setEditFormData({ ...editFormData, [field]: value })}
        onToggleEditMode={() => setIsEditMode(!isEditMode)}
        onSaveEdit={handleUpdateTask}
        onDelete={() => selectedTask && handleDeleteTask(selectedTask.id)}
        onStatusChange={(status) => selectedTask && handleStatusChange(selectedTask.id, status)}
        onImageUpload={handleImageUpload}
        onChangeDocFormData={(field, value) => setDocFormData({ ...docFormData, [field]: value })}
        onSaveDocumentation={() => handleAddDocumentation(docFormData.type as any)}
        onCancelDocumentation={() => {
          setDocFormData({ type: '', content: '' });
        }}
        onStartRecording={() => {
          if (isRecording) {
            setIsRecording(false);
            showToast('Aufnahme gestoppt (Web Audio API noch nicht implementiert)', 'success');
          } else {
            setIsRecording(true);
            showToast('Aufnahme gestartet (Web Audio API noch nicht implementiert)', 'info');
          }
        }}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedTask(null);
          setIsEditMode(false);
        }}
        getUserName={getUserName}
      />
    </>
  );
}

// Styles will be added in a separate message due to length
const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 4, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 15, color: '#64748b' },
  toolBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 16 },
  viewSwitcher: { flexDirection: 'row', gap: 4, backgroundColor: '#ffffff', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  viewButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  viewButtonActive: { backgroundColor: colors.primary },
  viewButtonText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  viewButtonTextActive: { color: '#ffffff' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, maxWidth: 400, backgroundColor: '#ffffff', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput: { flex: 1, border: 'none', fontSize: 14 },
  filterBar: { marginBottom: 16 },
  filterScroll: { flexDirection: 'row' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', marginRight: 8 },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  filterChipTextActive: { color: '#ffffff' },
  filterDivider: { width: 2, height: 32, backgroundColor: '#CBD5E1', marginHorizontal: 14, alignSelf: 'center', borderRadius: 1 },
  kanbanContainer: { flex: 1 },
  kanbanColumn: { width: 320, marginRight: 16, backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 16 },
  kanbanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 12 },
  kanbanHeaderText: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  kanbanCount: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.5)', alignItems: 'center', justifyContent: 'center' },
  kanbanCountText: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  kanbanCards: { flex: 1 },
  kanbanCard: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', cursor: 'pointer', transition: 'all 0.2s' },
  kanbanCardDragging: { boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)', transform: 'rotate(2deg)' },
  kanbanCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  kanbanCardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', flex: 1, marginRight: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  kanbanCardDesc: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 12 },
  kanbanCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assigneeAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  assigneeAvatarText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  dueDateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#F1F5F9', borderRadius: 6 },
  dueDateText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  emptyColumn: { padding: 24, alignItems: 'center' },
  emptyColumnText: { fontSize: 13, color: '#94a3b8', marginBottom: 4 },
  emptyColumnHint: { fontSize: 11, color: '#cbd5e1', fontStyle: 'italic' },
  listContainer: { flex: 1 },
  listCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  listCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  listCardContent: { flex: 1 },
  listCardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  listCardDesc: { fontSize: 13, color: '#64748b' },
  listCardRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  statusBadgeText: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  priorityBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  priorityBadgeText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  calendarContainer: { flex: 1 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, backgroundColor: '#ffffff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  calendarHeaderText: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  calendarTodayButton: { flex: 1, alignItems: 'center', gap: 4 },
  calendarTodayButtonText: { fontSize: 12, fontWeight: '600', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  calendarNavButton: { padding: 8 },
  calendarWeekdays: { flexDirection: 'row', marginBottom: 8 },
  calendarWeekday: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  calendarWeekdayText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#ffffff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  calendarDay: { width: `${100 / 7}%` as any, minHeight: 80, padding: 6, alignItems: 'center', justifyContent: 'flex-start', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 8, position: 'relative' },
  calendarDayToday: { backgroundColor: '#EFF6FF', borderWidth: 2, borderColor: colors.primary },
  calendarDayHasTasks: { backgroundColor: '#fef3c7' },
  calendarDayNumber: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  calendarDayNumberToday: { color: colors.primary, fontWeight: '700' },
  calendarDayNumberPast: { color: '#94a3b8' },
  calendarTaskIndicators: { flexDirection: 'row', gap: 2, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
  calendarTaskDot: { width: 6, height: 6, borderRadius: 3 },
  calendarTaskMore: { fontSize: 9, fontWeight: '700', color: '#64748b', marginLeft: 2 },
  calendarLegend: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  calendarLegendTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 8 },
  calendarLegendItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  calendarLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  calendarLegendDot: { width: 10, height: 10, borderRadius: 5 },
  calendarLegendText: { fontSize: 12, color: '#64748b' },
  calendarTasksList: { flex: 1 },
  calendarTasksTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  calendarTaskCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: '#ffffff', padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  calendarTaskCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  calendarTaskCardIndicator: { width: 4, height: 40, borderRadius: 2 },
  calendarTaskCardDate: { fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 2 },
  calendarTaskCardTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  calendarTaskCardAssignee: { fontSize: 11, color: '#64748b', marginTop: 2 },
  emptyCard: { padding: 40, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
  
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
});
