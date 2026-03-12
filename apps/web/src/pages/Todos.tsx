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
  Search, Filter, Link2
} from 'lucide-react';
import { colors } from '@docstruc/theme';
import { ModernModal } from '../components/ModernModal';
import { DatePicker } from '../components/DatePicker';
import { Select } from '../components/Select';
import { ConfirmDialog } from '../components/ConfirmDialog';

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

// ─── Entity-linking types ──────────────────────────────────────────────────

type EntityType = 'task' | 'defect' | 'milestone' | 'document' | 'note' | 'message';

interface ProjectOption { value: string; label: string; }

/** Normalised item shown in the entity picker */
interface EntityItem {
  id: string;
  entityType: EntityType;
  displayTitle: string;
  projectId: string;
}

// Config for each entity type: which table to query and which column holds the label
const ENTITY_CONFIGS: Record<EntityType, {
  table: string;
  labelCol: string;
  label: string;
  extraFilter?: (q: any) => any;
}> = {
  task:      { table: 'tasks',           labelCol: 'title',   label: 'Aufgaben',       extraFilter: q => q.neq('task_type', 'defect') },
  defect:    { table: 'tasks',           labelCol: 'title',   label: 'Mängel',         extraFilter: q => q.eq('task_type', 'defect') },
  milestone: { table: 'timeline_events', labelCol: 'title',   label: 'Meilensteine',   extraFilter: q => q.eq('event_type', 'milestone') },
  document:  { table: 'project_files',   labelCol: 'name',    label: 'Dokumente' },
  note:      { table: 'documentation_items', labelCol: 'title', label: 'Notizen' },
  message:   { table: 'project_messages', labelCol: 'content', label: 'Nachrichten',   extraFilter: q => q.eq('is_deleted', false) },
};

const ALL_ENTITY_TYPES: EntityType[] = ['task', 'defect', 'milestone', 'document', 'note', 'message'];

/** Fetch all entities of a given type from a specific project */
async function fetchEntitiesOfType(
  projectId: string,
  type: EntityType,
): Promise<EntityItem[]> {
  const cfg = ENTITY_CONFIGS[type];
  let query: any = supabase
    .from(cfg.table as any)
    .select(`id, ${cfg.labelCol}`)
    .eq('project_id', projectId)
    .order(cfg.labelCol)
    .limit(200);

  if (cfg.extraFilter) query = cfg.extraFilter(query);

  const { data, error } = await query;
  if (error) {
    console.error(`[TodoModal] fetch ${type} error:`, error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    entityType: type,
    displayTitle: (row[cfg.labelCol] as string | null)?.trim() || `(${cfg.label} ohne Titel)`,
    projectId,
  }));
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

  // ── Form fields ──────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TodoStatus>('open');
  const [dueDate, setDueDate] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Linking state ────────────────────────────────────────────────────────
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [linkProjectId, setLinkProjectId] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<EntityType[]>([]);
  const [availableItems, setAvailableItems] = useState<EntityItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Multi-select: set of linked entity IDs (may include prelinked)
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [itemSearch, setItemSearch] = useState('');

  // Prelinked = external entity already provided (from task/defect/milestone/doc detail)
  const hasPrelink = !!(prelinkedProjectId && prelinkedEntityType && prelinkedEntityId);

  // ── Reset on open / close ─────────────────────────────────────────────────
  useEffect(() => {
    if (todo) {
      setName(todo.name);
      setDescription(todo.description || '');
      setStatus(todo.status);
      setDueDate(todo.due_date ? todo.due_date.split('T')[0] : '');
      setLocation(todo.location || '');
    } else {
      setName(''); setDescription(''); setStatus('open'); setDueDate(''); setLocation('');
    }
    // Reset linking state every time the modal opens
    setLinkProjectId(prelinkedProjectId || '');
    setSelectedTypes(
      prelinkedEntityType ? [prelinkedEntityType as EntityType] : []
    );
    setLinkedIds(prelinkedEntityId ? new Set([prelinkedEntityId]) : new Set());
    setAvailableItems([]);
    setItemSearch('');
    setLoadError(false);
  }, [todo, isOpen, prelinkedProjectId, prelinkedEntityType, prelinkedEntityId]);

  // ── Load projects ─────────────────────────────────────────────────────────
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

  // ── Load entities whenever project or selected types change ───────────────
  useEffect(() => {
    if (!linkProjectId || selectedTypes.length === 0 || hasPrelink) {
      setAvailableItems([]);
      return;
    }

    let cancelled = false;
    setLoadingItems(true);
    setLoadError(false);
    setAvailableItems([]);

    Promise.all(selectedTypes.map(t => fetchEntitiesOfType(linkProjectId, t)))
      .then(results => {
        if (cancelled) return;
        const merged = results.flat();
        setAvailableItems(merged);
        // Remove any previously linked IDs that are no longer valid
        setLinkedIds(prev => {
          const validIds = new Set(merged.map(i => i.id));
          const next = new Set([...prev].filter(id => validIds.has(id)));
          return next;
        });
        setLoadingItems(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoadingItems(false);
      });

    return () => { cancelled = true; };
  }, [linkProjectId, selectedTypes, hasPrelink]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const toggleType = (type: EntityType) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleLinked = (id: string) => {
    setLinkedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredItems = itemSearch.trim()
    ? availableItems.filter(i => i.displayTitle.toLowerCase().includes(itemSearch.toLowerCase()))
    : availableItems;

  // Group items by entityType for display
  const groupedItems: Record<string, EntityItem[]> = {};
  for (const item of filteredItems) {
    if (!groupedItems[item.entityType]) groupedItems[item.entityType] = [];
    groupedItems[item.entityType].push(item);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
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

      if (savedTodoId) {
        // Prelinked entity from external modal
        if (hasPrelink) {
          await supabase.from('todo_links').upsert({
            todo_id: savedTodoId,
            entity_type: prelinkedEntityType,
            entity_id: prelinkedEntityId,
            project_id: prelinkedProjectId,
          }, { onConflict: 'todo_id,entity_type,entity_id' });
        } else if (linkProjectId && linkedIds.size > 0) {
          // Build item map for quick lookup
          const itemMap = new Map(availableItems.map(i => [i.id, i]));
          const upserts = [...linkedIds]
            .filter(id => itemMap.has(id))
            .map(id => ({
              todo_id: savedTodoId!,
              entity_type: itemMap.get(id)!.entityType,
              entity_id: id,
              project_id: linkProjectId,
            }));
          if (upserts.length > 0) {
            await supabase.from('todo_links').upsert(upserts, { onConflict: 'todo_id,entity_type,entity_id' });
          }
        }
      }

      onSaved();
      onClose();
    } catch (e: any) {
      showToast(e.message || 'Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
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
          <View style={mStyles.prelinkBadge}>
            <Text style={mStyles.prelinkLabel}>
              Verknüpft mit:{' '}
              <Text style={{ fontWeight: '700' }}>{prelinkedEntityLabel || prelinkedEntityId}</Text>
              {' '}({prelinkedEntityType})
            </Text>
          </View>
        ) : (
          <>
            {/* Step 1: project */}
            <Select
              label="1. Projekt wählen"
              value={linkProjectId}
              options={[{ value: '', label: 'Kein Projekt' }, ...projects]}
              onChange={v => {
                const pid = String(v);
                setLinkProjectId(pid);
                setSelectedTypes([]);
                setAvailableItems([]);
                setLinkedIds(new Set());
                setItemSearch('');
              }}
              placeholder="Projekt wählen..."
            />

            {/* Step 2: category pills (multi-select) */}
            {linkProjectId && (
              <>
                <Text style={mStyles.label}>2. Kategorien wählen</Text>
                <View style={mStyles.typeRow}>
                  {ALL_ENTITY_TYPES.map(type => {
                    const active = selectedTypes.includes(type);
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[mStyles.typeChip, active && mStyles.typeChipActive]}
                        onPress={() => toggleType(type)}
                      >
                        <Text style={[mStyles.typeChipText, active && mStyles.typeChipTextActive]}>
                          {ENTITY_CONFIGS[type].label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Step 3: entity multi-select list */}
            {linkProjectId && selectedTypes.length > 0 && (
              <>
                <Text style={mStyles.label}>3. Elemente wählen</Text>

                {/* Search */}
                <View style={mStyles.searchRow}>
                  <Search size={14} color="#94a3b8" />
                  <TextInput
                    style={mStyles.searchInput}
                    value={itemSearch}
                    onChangeText={setItemSearch}
                    placeholder="Suchen..."
                    placeholderTextColor="#94a3b8"
                  />
                  {itemSearch ? (
                    <TouchableOpacity onPress={() => setItemSearch('')}>
                      <X size={13} color="#94a3b8" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Item list */}
                <ScrollView
                  style={mStyles.itemList}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {loadingItems ? (
                    <Text style={mStyles.itemListHint}>Lade Elemente...</Text>
                  ) : loadError ? (
                    <Text style={[mStyles.itemListHint, { color: '#ef4444' }]}>
                      Fehler beim Laden. Bitte erneut versuchen.
                    </Text>
                  ) : availableItems.length === 0 ? (
                    <Text style={mStyles.itemListHint}>
                      Keine Elemente in diesem Projekt gefunden.
                    </Text>
                  ) : filteredItems.length === 0 ? (
                    <Text style={mStyles.itemListHint}>Keine Treffer für „{itemSearch}"</Text>
                  ) : (
                    Object.entries(groupedItems).map(([type, items]) => (
                      <View key={type}>
                        {/* Group header */}
                        <Text style={mStyles.groupHeader}>
                          {ENTITY_CONFIGS[type as EntityType].label} ({items.length})
                        </Text>
                        {items.map(item => {
                          const checked = linkedIds.has(item.id);
                          return (
                            <TouchableOpacity
                              key={item.id}
                              style={[mStyles.itemRow, checked && mStyles.itemRowChecked]}
                              onPress={() => toggleLinked(item.id)}
                              activeOpacity={0.7}
                            >
                              <View style={[mStyles.checkbox, checked && mStyles.checkboxChecked]}>
                                {checked && <Text style={mStyles.checkmark}>✓</Text>}
                              </View>
                              <Text style={[mStyles.itemLabel, checked && mStyles.itemLabelChecked]} numberOfLines={2}>
                                {item.displayTitle}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ))
                  )}
                </ScrollView>
                {linkedIds.size > 0 && (
                  <View style={mStyles.selectionSummary}>
                    <Text style={mStyles.selectionSummaryText}>
                      {linkedIds.size} Element{linkedIds.size !== 1 ? 'e' : ''} verknüpft
                    </Text>
                    <TouchableOpacity onPress={() => setLinkedIds(new Set())}>
                      <Text style={mStyles.clearSelectionText}>Auswahl löschen</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
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
    flexShrink: 0,
  },
  textarea: { height: 90, minHeight: 90, textAlignVertical: 'top' as any, paddingTop: 10, flexShrink: 0 },
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
  // ── Category type chips ──────────────────────────────────────────────────
  typeRow: { flexDirection: 'row', flexWrap: 'wrap' as any, gap: 6, marginBottom: 4 },
  typeChip: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  typeChipActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  typeChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  typeChipTextActive: { color: colors.primary },
  // ── Search row ────────────────────────────────────────────────────────────
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 6,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#0f172a', outlineStyle: 'none' as any },
  // ── Item list ─────────────────────────────────────────────────────────────
  itemList: {
    maxHeight: 240, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    backgroundColor: '#fff', overflow: 'scroll' as any,
  },
  itemListHint: { fontSize: 13, color: '#94a3b8', padding: 14, textAlign: 'center' as any },
  groupHeader: {
    fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 0.5,
    textTransform: 'uppercase' as any, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4,
    backgroundColor: '#F8FAFC',
  },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  itemRowChecked: { backgroundColor: '#EFF6FF' },
  checkbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
    borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { fontSize: 11, color: '#fff', fontWeight: '800', lineHeight: 14 },
  itemLabel: { flex: 1, fontSize: 13, color: '#374151' },
  itemLabelChecked: { color: colors.primary, fontWeight: '600' },
  // ── Selection summary ─────────────────────────────────────────────────────
  selectionSummary: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8, paddingHorizontal: 4,
  },
  selectionSummaryText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  clearSelectionText: { fontSize: 12, color: '#ef4444', fontWeight: '600' },
});

// ─── TodoDetailModal ──────────────────────────────────────────────────────

interface TodoDetailModalProps {
  todo: Todo | null;
  onClose: () => void;
  onEdit: (t: Todo) => void;
}

function TodoDetailModal({ todo, onClose, onEdit }: TodoDetailModalProps) {
  if (!todo) return null;
  const cfg = STATUS_CONFIG[todo.status];
  const isOverdue = !!(todo.due_date && new Date(todo.due_date) < new Date() && todo.status !== 'done');
  const formatDate = (d: string) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <ModernModal visible={!!todo} onClose={onClose} title="ToDo Details" maxWidth={520}>
      {/* Status badge + title */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: cfg.bgColor }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: cfg.color }}>{cfg.label}</Text>
        </View>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#0f172a', lineHeight: 24 }}>
          {todo.name}
        </Text>
      </View>

      {/* Description */}
      {todo.description ? (
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Beschreibung</Text>
          <Text style={{ fontSize: 14, color: '#475569', lineHeight: 20 }}>{todo.description}</Text>
        </View>
      ) : null}

      {/* Meta info */}
      <View style={{ gap: 8, marginBottom: 16 }}>
        {todo.due_date && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Calendar size={15} color={isOverdue ? '#ef4444' : '#64748b'} />
            <Text style={{ fontSize: 13, color: isOverdue ? '#ef4444' : '#64748b', fontWeight: isOverdue ? '700' : '500' }}>
              Fällig: {formatDate(todo.due_date)}{isOverdue ? ' (Überfällig)' : ''}
            </Text>
          </View>
        )}
        {todo.location && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MapPin size={15} color="#94a3b8" />
            <Text style={{ fontSize: 13, color: '#64748b' }}>{todo.location}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <CheckSquare size={15} color="#94a3b8" />
          <Text style={{ fontSize: 13, color: '#94a3b8' }}>Erstellt: {formatDate(todo.created_at)}</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={{ flexDirection: 'row', gap: 10, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' }}
          onPress={onClose}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748b' }}>Schließen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center' }}
          onPress={() => { onClose(); onEdit(todo); }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Bearbeiten</Text>
        </TouchableOpacity>
      </View>
    </ModernModal>
  );
}

// ─── TodoCard ──────────────────────────────────────────────────────────────

interface TodoCardProps {
  todo: Todo;
  onEdit: (t: Todo) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TodoStatus) => void;
  onDetail?: (t: Todo) => void;
  compact?: boolean;
}

function TodoCard({ todo, onEdit, onDelete, onStatusChange, onDetail, compact = false }: TodoCardProps) {
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

          <TouchableOpacity style={{ flex: 1 }} onPress={() => onDetail && onDetail(todo)} activeOpacity={0.7}>
            <Text style={[cardStyles.name, todo.status === 'done' && cardStyles.nameStrike]} numberOfLines={2}>
              {todo.name}
            </Text>
          </TouchableOpacity>

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
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => {
        // Only clear when leaving the column itself, not a child
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const todoId = e.dataTransfer.getData('text/plain');
        if (todoId) onDrop(todoId, status);
      }}
      style={{
        width: 280,
        flexShrink: 0,
        backgroundColor: dragOver ? '#EFF6FF' : '#F8FAFC',
        borderRadius: 14,
        border: `1.5px solid ${dragOver ? colors.primary : '#F1F5F9'}`,
        padding: 14,
        maxHeight: 'calc(100vh - 260px)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      {/* Column header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        paddingBottom: 12, marginBottom: 12,
        borderBottom: `2px solid ${cfg.color}`,
      }}>
        <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cfg.color }} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{cfg.label}</span>
        <span style={{
          padding: '2px 8px', borderRadius: 10,
          backgroundColor: cfg.bgColor,
          fontSize: 12, fontWeight: 800, color: cfg.color,
        }}>{todos.length}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {todos.map(todo => (
          <div
            key={todo.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', todo.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            style={{ cursor: 'grab' }}
          >
            <TodoCard
              todo={todo}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              compact
            />
          </div>
        ))}
        {todos.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#cbd5e1', fontStyle: 'italic', fontSize: 13 }}>
            Keine Einträge
          </div>
        )}
      </div>
    </div>
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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [viewTodo, setViewTodo] = useState<Todo | null>(null);

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

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    const { error } = await supabase.from('todos').delete().eq('id', pendingDeleteId);
    setPendingDeleteId(null);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('ToDo gelöscht', 'success');
    setTodos(prev => prev.filter(t => t.id !== pendingDeleteId));
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

      <TodoDetailModal
        todo={viewTodo}
        onClose={() => setViewTodo(null)}
        onEdit={t => { setViewTodo(null); setEditingTodo(t); setModalOpen(true); }}
      />

      <ConfirmDialog
        visible={!!pendingDeleteId}
        title="ToDo löschen"
        message="Soll dieses ToDo wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
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

      {/* Status Filter Bar */}
      <View style={pageStyles.filterBar}>
        <Filter size={14} color="#94a3b8" />
        <TouchableOpacity
          style={[pageStyles.filterChip, !statusFilter && pageStyles.filterChipAllActive]}
          onPress={() => setStatusFilter(null)}
        >
          <Text style={[pageStyles.filterChipText, !statusFilter && pageStyles.filterChipAllActiveText]}>Alle</Text>
        </TouchableOpacity>
        {ALL_STATUSES.map(s => {
          const cfg = STATUS_CONFIG[s];
          const active = statusFilter === s;
          return (
            <TouchableOpacity
              key={s}
              style={[pageStyles.filterChip, active && { borderColor: cfg.color, backgroundColor: cfg.bgColor }]}
              onPress={() => setStatusFilter(active ? null : s)}
            >
              <Text style={[pageStyles.filterChipText, active && { color: cfg.color, fontWeight: '700' }]}>{cfg.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

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
              onDetail={t => setViewTodo(t)}
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
        <div style={{ display: 'flex', flexDirection: 'row', gap: 16, overflowX: 'auto', paddingBottom: 40, paddingRight: 32 }}>
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
        </div>
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
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap' as any,
  },
  filterChipRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  filterChipAllActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipAllActiveText: { color: '#fff' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
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
