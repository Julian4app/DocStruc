import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLayout } from '../layouts/LayoutContext';
import { useToast } from '../components/ToastProvider';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare, Plus, Trash2, Edit2, X, Calendar, MapPin,
  Circle, CheckCircle2, Clock, PauseCircle, List, Columns,
  ChevronDown, AlertCircle, Search, Filter, Link2
} from 'lucide-react';
import { colors } from '@docstruc/theme';
import { ModernModal } from '../components/ModernModal';
import { DatePicker } from '../components/DatePicker';
import { Select } from '../components/Select';

// ─── Types ─────────────────────────────────────────────────────────────────

export type TodoStatus = 'open' | 'in_progress' | 'waiting' | 'done';

interface Todo {
  id: string;
  name: string;
  description: string | null;
  status: TodoStatus;
  due_date: string | null;
  location: string | null;
  owner_user_id: string;
  shared_with_user_id: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<TodoStatus, { label: string; color: string; bgColor: string; icon: React.FC<any> }> = {
  open:        { label: 'Offen',          color: '#3B82F6', bgColor: '#EFF6FF', icon: Circle },
  in_progress: { label: 'In Bearbeitung', color: '#F59E0B', bgColor: '#FFFBEB', icon: Clock },
  waiting:     { label: 'Wartend',        color: '#8B5CF6', bgColor: '#F5F3FF', icon: PauseCircle },
  done:        { label: 'Erledigt',       color: '#22C55E', bgColor: '#F0FDF4', icon: CheckCircle2 },
};

const ALL_STATUSES: TodoStatus[] = ['open', 'in_progress', 'waiting', 'done'];

// ─── TodoModal ─────────────────────────────────────────────────────────────

export interface TodoModalProps {
  isOpen: boolean;
  todo?: Todo | null;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  // Pre-linking from external detail modals
  prelinkedProjectId?: string;
  prelinkedEntityType?: string;
  prelinkedEntityId?: string;
  prelinkedEntityLabel?: string;
}

interface ProjectOption {
  value: string;
  label: string;
}

interface EntityOption {
  value: string;
  label: string;
}

export function TodoModal({
  isOpen,
  todo,
  onClose,
  onSaved,
  userId,
  prelinkedProjectId,
  prelinkedEntityType,
  prelinkedEntityId,
  prelinkedEntityLabel,
}: TodoModalProps) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TodoStatus>('open');
  const [dueDate, setDueDate] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  // Entity linking state
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [linkProjectId, setLinkProjectId] = useState('');
  const [linkEntityType, setLinkEntityType] = useState('');
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [linkEntityId, setLinkEntityId] = useState('');
  const [loadingEntities, setLoadingEntities] = useState(false);

  // Prelinked = external entity already provided (from task/defect/milestone/document detail)
  const hasPrelink = !!(prelinkedProjectId && prelinkedEntityType && prelinkedEntityId);

  useEffect(() => {
    if (todo) {
      setName(todo.name);
      setDescription(todo.description || '');
      setStatus(todo.status);
      setDueDate(todo.due_date ? todo.due_date.split('T')[0] : '');
      setLocation(todo.location || '');
    } else {
      setName('');
      setDescription('');
      setStatus('open');
      setDueDate('');
      setLocation('');
    }
    // Reset linking state when modal opens
    setLinkProjectId(prelinkedProjectId || '');
    setLinkEntityType(prelinkedEntityType || '');
    setLinkEntityId(prelinkedEntityId || '');
    setEntities([]);
  }, [todo, isOpen, prelinkedProjectId, prelinkedEntityType, prelinkedEntityId]);

  // Load projects for linking selector
  useEffect(() => {
    if (!isOpen || hasPrelink) return;
    supabase
      .from('projects')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        setProjects((data || []).map((p: any) => ({ value: p.id, label: p.name })));
      });
  }, [isOpen, hasPrelink]);

  // Load entities when project + type selected
  useEffect(() => {
    if (!linkProjectId || !linkEntityType || hasPrelink) return;
    setLoadingEntities(true);
    const tableMap: Record<string, string> = {
      task: 'tasks',
      defect: 'defects',
      milestone: 'timeline_events',
      document: 'documents',
    };
    const table = tableMap[linkEntityType];
    if (!table) { setEntities([]); setLoadingEntities(false); return; }
    supabase
      .from(table as any)
      .select('id, title')
      .eq('project_id', linkProjectId)
      .order('title')
      .then(({ data }) => {
        setEntities((data || []).map((e: any) => ({ value: e.id, label: e.title || e.id })));
        setLoadingEntities(false);
      });
  }, [linkProjectId, linkEntityType, hasPrelink]);

  const handleSave = async () => {
    if (!name.trim()) { showToast('Bitte Namen eingeben', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        status,
        due_date: dueDate || null,
        location: location.trim() || null,
      };

      let savedTodoId: string | null = null;

      if (todo) {
        const { error } = await supabase.from('todos').update(payload).eq('id', todo.id);
        if (error) throw error;
        savedTodoId = todo.id;
        showToast('ToDo aktualisiert', 'success');
      } else {
        const { data, error } = await supabase
          .from('todos')
          .insert({ ...payload, owner_user_id: userId })
          .select('id')
          .single();
        if (error) throw error;
        savedTodoId = data?.id || null;
        showToast('ToDo erstellt', 'success');
      }

      // Insert link if entity selected (prelinked or manually chosen)
      const finalEntityId = prelinkedEntityId || linkEntityId;
      const finalEntityType = prelinkedEntityType || linkEntityType;
      const finalProjectId = prelinkedProjectId || linkProjectId;
      if (savedTodoId && finalEntityId && finalEntityType) {
        await supabase.from('todo_links').upsert({
          todo_id: savedTodoId,
          entity_type: finalEntityType,
          entity_id: finalEntityId,
          project_id: finalProjectId || null,
        }, { onConflict: 'todo_id,entity_type,entity_id' });
      }

      onSaved();
      onClose();
    } catch (e: any) {
      showToast(e.message || 'Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  const entityTypeOptions = [
    { value: '', label: 'Typ wählen...' },
    { value: 'task', label: 'Aufgabe' },
    { value: 'defect', label: 'Mangel' },
    { value: 'milestone', label: 'Meilenstein' },
    { value: 'document', label: 'Dokument' },
  ];

  return (
    <ModernModal
      visible={isOpen}
      onClose={onClose}
      title={todo ? 'ToDo bearbeiten' : 'Neues ToDo'}
      maxWidth={560}
    >
      {/* Name */}
      <Text style={mStyles.label}>Titel *</Text>
      <TextInput
        style={mStyles.input}
        value={name}
        onChangeText={setName}
        placeholder="ToDo Titel..."
        placeholderTextColor="#94a3b8"
      />

      {/* Description */}
      <Text style={mStyles.label}>Beschreibung</Text>
      <TextInput
        style={[mStyles.input, mStyles.textarea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Optionale Beschreibung..."
        placeholderTextColor="#94a3b8"
        multiline
        numberOfLines={3}
      />

      {/* Status */}
      <Text style={mStyles.label}>Status</Text>
      <View style={mStyles.statusRow}>
        {ALL_STATUSES.map(s => {
          const cfg = STATUS_CONFIG[s];
          const active = status === s;
          return (
            <TouchableOpacity
              key={s}
              style={[mStyles.statusChip, active && { backgroundColor: cfg.bgColor, borderColor: cfg.color }]}
              onPress={() => setStatus(s)}
            >
              <Text style={[mStyles.statusChipText, active && { color: cfg.color, fontWeight: '700' }]}>
                {cfg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Due date */}
      <DatePicker
        label="Fälligkeitsdatum"
        value={dueDate}
        onChange={setDueDate}
        placeholder="TT.MM.JJJJ"
      />

      {/* Location */}
      <Text style={mStyles.label}>Ort</Text>
      <TextInput
        style={mStyles.input}
        value={location}
        onChangeText={setLocation}
        placeholder="Optionaler Ort..."
        placeholderTextColor="#94a3b8"
      />

      {/* ─── Entity Linking ─────────────────────────────────────────── */}
      <View style={mStyles.linkSection}>
        <View style={mStyles.linkHeader}>
          <Link2 size={15} color={colors.primary} />
          <Text style={mStyles.linkTitle}>Verknüpfen (optional)</Text>
        </View>

        {hasPrelink ? (
          /* Pre-linked from an external detail modal */
          <View style={mStyles.prelinkBadge}>
            <Text style={mStyles.prelinkLabel}>
              Verknüpft mit:{' '}
              <Text style={{ fontWeight: '700' }}>
                {prelinkedEntityLabel || prelinkedEntityId}
              </Text>
              {' '}({prelinkedEntityType})
            </Text>
          </View>
        ) : (
          /* Manual linking */
          <>
            <Select
              label="Projekt"
              value={linkProjectId}
              options={[{ value: '', label: 'Kein Projekt' }, ...projects]}
              onChange={v => {
                setLinkProjectId(String(v));
                setLinkEntityType('');
                setLinkEntityId('');
                setEntities([]);
              }}
              placeholder="Projekt auswählen..."
            />

            {linkProjectId && (
              <View style={{ marginTop: 12 }}>
                <Select
                  label="Element-Typ"
                  value={linkEntityType}
                  options={entityTypeOptions}
                  onChange={v => {
                    setLinkEntityType(String(v));
                    setLinkEntityId('');
                    setEntities([]);
                  }}
                  placeholder="Typ wählen..."
                />
              </View>
            )}

            {linkProjectId && linkEntityType && (
              <View style={{ marginTop: 12 }}>
                <Select
                  label="Element"
                  value={linkEntityId}
                  options={[
                    { value: '', label: loadingEntities ? 'Lade...' : 'Element wählen...' },
                    ...entities,
                  ]}
                  onChange={v => setLinkEntityId(String(v))}
                  placeholder="Element wählen..."
                />
              </View>
            )}
          </>
        )}
      </View>

      {/* Footer buttons */}
      <View style={mStyles.footer}>
        <TouchableOpacity style={mStyles.cancelBtn} onPress={onClose}>
          <Text style={mStyles.cancelBtnText}>Abbrechen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[mStyles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={mStyles.saveBtnText}>
            {saving ? 'Speichern...' : todo ? 'Aktualisieren' : 'Erstellen'}
          </Text>
        </TouchableOpacity>
      </View>
    </ModernModal>
  );
}

const mStyles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  textarea: { height: 80, textAlignVertical: 'top' as any, paddingTop: 10 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap' as any, gap: 8 },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  statusChipText: { fontSize: 13, color: '#64748b' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  linkSection: {
    marginTop: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  linkHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  linkTitle: { fontSize: 13, fontWeight: '700', color: '#374151' },
  prelinkBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  prelinkLabel: { fontSize: 13, color: '#1D4ED8' },
});

// ─── TodoCard ──────────────────────────────────────────────────────────────

interface TodoCardProps {
  todo: Todo;
  onEdit: (t: Todo) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TodoStatus) => void;
  compact?: boolean;
}

function TodoCard({ todo, onEdit, onDelete, onStatusChange, compact = false }: TodoCardProps) {
  const cfg = STATUS_CONFIG[todo.status];
  const StatusIcon = cfg.icon;
  const isOverdue = !!(todo.due_date && new Date(todo.due_date) < new Date() && todo.status !== 'done');
  const isDueSoon = !!(todo.due_date && !isOverdue &&
    new Date(todo.due_date) < new Date(Date.now() + 3 * 86400_000));

  const formatDate = (d: string) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

  return (
    <View style={[cardStyles.card, compact && cardStyles.cardCompact]}>
      {/* Status bar */}
      <View style={[cardStyles.statusBar, { backgroundColor: cfg.color }]} />

      <View style={cardStyles.content}>
        {/* Top row */}
        <View style={cardStyles.topRow}>
          <TouchableOpacity
            onPress={() => {
              const next: Record<TodoStatus, TodoStatus> = {
                open: 'in_progress', in_progress: 'waiting', waiting: 'done', done: 'open'
              };
              onStatusChange(todo.id, next[todo.status]);
            }}
            style={[cardStyles.statusIconBtn, { backgroundColor: cfg.bgColor }]}
          >
            <StatusIcon size={16} color={cfg.color} />
          </TouchableOpacity>

          <Text style={[cardStyles.name, todo.status === 'done' && cardStyles.nameStrike]} numberOfLines={2}>
            {todo.name}
          </Text>

          <View style={cardStyles.actions}>
            <TouchableOpacity onPress={() => onEdit(todo)} style={cardStyles.actionBtn}>
              <Edit2 size={14} color="#94a3b8" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(todo.id)} style={cardStyles.actionBtn}>
              <Trash2 size={14} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Description */}
        {!compact && todo.description && (
          <Text style={cardStyles.description} numberOfLines={2}>{todo.description}</Text>
        )}

        {/* Footer */}
        <View style={cardStyles.footer}>
          <View style={[cardStyles.statusBadge, { backgroundColor: cfg.bgColor }]}>
            <Text style={[cardStyles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>

          {todo.due_date && (
            <View style={[cardStyles.dateBadge, isOverdue && cardStyles.dateBadgeOverdue, isDueSoon && cardStyles.dateBadgeSoon]}>
              <Calendar size={11} color={isOverdue ? '#ef4444' : isDueSoon ? '#F59E0B' : '#64748b'} />
              <Text style={[cardStyles.dateText, isOverdue && cardStyles.dateTextOverdue, isDueSoon && cardStyles.dateTextSoon]}>
                {formatDate(todo.due_date)}
              </Text>
            </View>
          )}

          {todo.location && (
            <View style={cardStyles.locationBadge}>
              <MapPin size={11} color="#94a3b8" />
              <Text style={cardStyles.locationText} numberOfLines={1}>{todo.location}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 10,
    flexDirection: 'row',
    overflow: 'hidden' as any,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardCompact: { marginBottom: 6 },
  statusBar: { width: 4 },
  content: { flex: 1, padding: 14 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  statusIconBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  name: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0f172a', lineHeight: 20 },
  nameStrike: { textDecorationLine: 'line-through', color: '#94a3b8' },
  actions: { flexDirection: 'row', gap: 4, marginLeft: 4, flexShrink: 0 },
  actionBtn: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center',
  },
  description: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' as any },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  dateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6, backgroundColor: '#F8FAFC',
  },
  dateBadgeOverdue: { backgroundColor: '#FEF2F2' },
  dateBadgeSoon: { backgroundColor: '#FFFBEB' },
  dateText: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  dateTextOverdue: { color: '#ef4444', fontWeight: '700' },
  dateTextSoon: { color: '#F59E0B', fontWeight: '700' },
  locationBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: '#F8FAFC' },
  locationText: { fontSize: 11, color: '#94a3b8', maxWidth: 100 },
});

// ─── KanbanColumn ──────────────────────────────────────────────────────────

interface KanbanColumnProps {
  status: TodoStatus;
  todos: Todo[];
  onEdit: (t: Todo) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TodoStatus) => void;
  onDrop: (todoId: string, targetStatus: TodoStatus) => void;
}

function KanbanColumn({ status, todos, onEdit, onDelete, onStatusChange, onDrop }: KanbanColumnProps) {
  const cfg = STATUS_CONFIG[status];
  const [dragOver, setDragOver] = useState(false);

  return (
    <View
      style={[kanbanStyles.column, dragOver && kanbanStyles.columnDragOver]}
      // @ts-ignore — web-only drag events
      onDragOver={(e: any) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e: any) => {
        e.preventDefault();
        setDragOver(false);
        const todoId = e.dataTransfer?.getData('todoId');
        if (todoId) onDrop(todoId, status);
      }}
    >
      {/* Column header */}
      <View style={[kanbanStyles.columnHeader, { borderBottomColor: cfg.color }]}>
        <View style={[kanbanStyles.colorDot, { backgroundColor: cfg.color }]} />
        <Text style={kanbanStyles.columnTitle}>{cfg.label}</Text>
        <View style={[kanbanStyles.countBadge, { backgroundColor: cfg.bgColor }]}>
          <Text style={[kanbanStyles.countText, { color: cfg.color }]}>{todos.length}</Text>
        </View>
      </View>

      <ScrollView style={kanbanStyles.columnScroll} showsVerticalScrollIndicator={false}>
        {todos.map(todo => (
          <View
            key={todo.id}
            // @ts-ignore
            draggable
            onDragStart={(e: any) => { e.dataTransfer?.setData('todoId', todo.id); }}
          >
            <TodoCard
              todo={todo}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              compact
            />
          </View>
        ))}
        {todos.length === 0 && (
          <View style={kanbanStyles.emptyCol}>
            <Text style={kanbanStyles.emptyColText}>Keine Einträge</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const kanbanStyles = StyleSheet.create({
  column: {
    width: 280,
    flexShrink: 0,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 14,
    maxHeight: 'calc(100vh - 260px)' as any,
  },
  columnDragOver: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 2,
  },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  columnTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a' },
  countBadge: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10,
  },
  countText: { fontSize: 12, fontWeight: '800' },
  columnScroll: { flex: 1 },
  emptyCol: { padding: 20, alignItems: 'center' },
  emptyColText: { fontSize: 13, color: '#cbd5e1', fontStyle: 'italic' },
});

// ─── Main Page ─────────────────────────────────────────────────────────────

export function Todos() {
  const { setTitle, setSubtitle, setActions } = useLayout();
  const { userId } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [statusFilter, setStatusFilter] = useState<TodoStatus | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const PAGE_SIZE = 30;

  const fetchTodos = useCallback(async (reset = false) => {
    if (!userId) return;
    const pageNum = reset ? 0 : page;
    if (reset) { setLoading(true); setPage(0); setHasMore(true); }
    else setLoadingMore(true);

    try {
      let query = supabase
        .from('todos')
        .select('*')
        .or(`owner_user_id.eq.${userId},shared_with_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      if (statusFilter) query = query.eq('status', statusFilter);

      const { data, error } = await query;
      if (error) throw error;

      const fetched = (data || []) as Todo[];
      if (reset) {
        setTodos(fetched);
      } else {
        setTodos(prev => [...prev, ...fetched]);
      }
      setHasMore(fetched.length === PAGE_SIZE);
      if (!reset) setPage(p => p + 1);
    } catch (e: any) {
      showToast(e.message || 'Fehler beim Laden', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId, statusFilter, page]);

  useEffect(() => {
    fetchTodos(true);
  }, [userId, statusFilter]);

  useEffect(() => {
    setTitle('Meine ToDos');
    setSubtitle('Persönliche Aufgaben & Checklisten');
    return () => { setTitle('DocStruc'); setSubtitle(''); setActions(null); };
  }, [setTitle, setSubtitle, setActions]);

  useEffect(() => {
    setActions(
      <TouchableOpacity
        style={pageStyles.newBtn}
        onPress={() => { setEditingTodo(null); setModalOpen(true); }}
        // @ts-ignore
        activeOpacity={0.8}
      >
        <Plus size={16} color="#fff" />
        <Text style={pageStyles.newBtnText}>Neues ToDo</Text>
      </TouchableOpacity>
    );
    return () => setActions(null);
  }, [setActions]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('ToDo wirklich löschen?')) return;
    const { error } = await supabase.from('todos').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('ToDo gelöscht', 'success');
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  const handleStatusChange = async (id: string, status: TodoStatus) => {
    const { error } = await supabase.from('todos').update({ status }).eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    setTodos(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };

  const handleDrop = async (todoId: string, targetStatus: TodoStatus) => {
    await handleStatusChange(todoId, targetStatus);
  };

  const displayTodos = todos.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
  });

  const kanbanGroups = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = displayTodos.filter(t => t.status === s);
    return acc;
  }, {} as Record<TodoStatus, Todo[]>);

  const openCount = todos.filter(t => t.status === 'open').length;
  const inProgressCount = todos.filter(t => t.status === 'in_progress').length;
  const doneCount = todos.filter(t => t.status === 'done').length;

  return (
    <>
      <TodoModal
        isOpen={modalOpen}
        todo={editingTodo}
        onClose={() => { setModalOpen(false); setEditingTodo(null); }}
        onSaved={() => fetchTodos(true)}
        userId={userId || ''}
      />

      {/* Stats Row */}
      <View style={pageStyles.statsRow}>
        {[
          { label: 'Offen', value: openCount, color: '#3B82F6', bg: '#EFF6FF', filter: 'open' as TodoStatus },
          { label: 'In Bearbeitung', value: inProgressCount, color: '#F59E0B', bg: '#FFFBEB', filter: 'in_progress' as TodoStatus },
          { label: 'Erledigt', value: doneCount, color: '#22C55E', bg: '#F0FDF4', filter: 'done' as TodoStatus },
          { label: 'Gesamt', value: todos.length, color: colors.primary, bg: '#EFF6FF', filter: null },
        ].map((s, i) => {
          const active = statusFilter === s.filter;
          return (
            <TouchableOpacity
              key={i}
              style={[pageStyles.statCard, active && { borderColor: s.color, borderWidth: 2 }]}
              onPress={() => setStatusFilter(active ? null : s.filter)}
              activeOpacity={0.7}
            >
              <Text style={[pageStyles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={pageStyles.statLabel}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Toolbar */}
      <View style={pageStyles.toolbar}>
        {/* Search */}
        <View style={pageStyles.searchBox}>
          <Search size={15} color="#94a3b8" />
          <TextInput
            style={pageStyles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Suchen..."
            placeholderTextColor="#94a3b8"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={14} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* View toggle */}
        <View style={pageStyles.viewToggle}>
          <TouchableOpacity
            style={[pageStyles.toggleBtn, viewMode === 'list' && pageStyles.toggleBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <List size={16} color={viewMode === 'list' ? colors.primary : '#94a3b8'} />
            <Text style={[pageStyles.toggleBtnText, viewMode === 'list' && pageStyles.toggleBtnTextActive]}>Liste</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[pageStyles.toggleBtn, viewMode === 'kanban' && pageStyles.toggleBtnActive]}
            onPress={() => setViewMode('kanban')}
          >
            <Columns size={16} color={viewMode === 'kanban' ? colors.primary : '#94a3b8'} />
            <Text style={[pageStyles.toggleBtnText, viewMode === 'kanban' && pageStyles.toggleBtnTextActive]}>Kanban</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter chips */}
      {statusFilter && (
        <View style={pageStyles.filterChipRow}>
          <View style={[pageStyles.filterChip, { borderColor: STATUS_CONFIG[statusFilter].color }]}>
            <Text style={[pageStyles.filterChipText, { color: STATUS_CONFIG[statusFilter].color }]}>
              {STATUS_CONFIG[statusFilter].label}
            </Text>
            <TouchableOpacity onPress={() => setStatusFilter(null)}>
              <X size={12} color={STATUS_CONFIG[statusFilter].color} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={pageStyles.loadingCenter}>
          <Text style={pageStyles.loadingText}>Lade ToDos...</Text>
        </View>
      ) : displayTodos.length === 0 ? (
        <View style={pageStyles.emptyState}>
          <CheckSquare size={48} color="#e2e8f0" />
          <Text style={pageStyles.emptyTitle}>
            {search ? 'Keine Treffer' : statusFilter ? 'Keine ToDos mit diesem Status' : 'Noch keine ToDos'}
          </Text>
          <Text style={pageStyles.emptySubtitle}>
            {!search && !statusFilter && 'Erstelle dein erstes ToDo mit dem Button oben rechts.'}
          </Text>
        </View>
      ) : viewMode === 'list' ? (
        <View style={pageStyles.listContainer}>
          {displayTodos.map(todo => (
            <TodoCard
              key={todo.id}
              todo={todo}
              onEdit={t => { setEditingTodo(t); setModalOpen(true); }}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ))}
          {hasMore && (
            <TouchableOpacity
              style={pageStyles.loadMoreBtn}
              onPress={() => fetchTodos(false)}
              disabled={loadingMore}
            >
              <Text style={pageStyles.loadMoreText}>{loadingMore ? 'Lade...' : 'Mehr laden'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={pageStyles.kanbanContainer}
        >
          {ALL_STATUSES.map(s => (
            <KanbanColumn
              key={s}
              status={s}
              todos={kanbanGroups[s]}
              onEdit={t => { setEditingTodo(t); setModalOpen(true); }}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              onDrop={handleDrop}
            />
          ))}
        </ScrollView>
      )}
    </>
  );
}

const pageStyles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap' as any,
  },
  statCard: {
    flex: 1,
    minWidth: 120,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    cursor: 'pointer' as any,
  },
  statValue: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  statLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    outlineStyle: 'none' as any,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden' as any,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  toggleBtnActive: { backgroundColor: '#EFF6FF' },
  toggleBtnText: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  toggleBtnTextActive: { color: colors.primary },
  filterChipRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1.5, backgroundColor: '#fff',
  },
  filterChipText: { fontSize: 13, fontWeight: '600' },
  listContainer: { paddingBottom: 40 },
  kanbanContainer: {
    flexDirection: 'row',
    gap: 16,
    paddingBottom: 40,
    paddingRight: 32,
  },
  loadMoreBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  loadMoreText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  loadingCenter: { padding: 60, alignItems: 'center' },
  loadingText: { fontSize: 15, color: '#94a3b8' },
  emptyState: { padding: 60, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginTop: 8 },
  emptySubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center' as any, maxWidth: 300 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  newBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
