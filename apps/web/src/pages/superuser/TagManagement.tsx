import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LottieLoader } from '../../components/LottieLoader';
import { useLayout } from '../../layouts/LayoutContext';
import { Button, Input } from '@docstruc/ui';
import { ModernModal } from '../../components/ModernModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/ToastProvider';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '@docstruc/theme';
import { Tag, Plus, Trash2, Edit2, X, Check, ToggleLeft, ToggleRight } from 'lucide-react';

interface SuperuserTag {
  id: string;
  owner_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
}

interface ProjectTagSetting {
  project_id: string;
  tag_id: string;
  restrict_to_preset: boolean;
}

const TAG_COLOR_OPTIONS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B',
  '#10B981', '#3B82F6', '#14B8A6', '#F97316', '#84CC16',
];

export function TagManagement() {
  const { setTitle, setSubtitle, setActions } = useLayout();
  const { showToast } = useToast();
  const { userId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<SuperuserTag[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tagSettings, setTagSettings] = useState<ProjectTagSetting[]>([]);

  // Tag form
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<SuperuserTag | null>(null);
  const [tagForm, setTagForm] = useState({ name: '', color: TAG_COLOR_OPTIONS[0] });
  const [tagFormLoading, setTagFormLoading] = useState(false);

  // Expanded project accordion
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  // Confirm dialog
  const [pendingDeleteTag, setPendingDeleteTag] = useState<SuperuserTag | null>(null);

  useEffect(() => {
    setTitle('Tag-Verwaltung');
    setSubtitle('Globale Tags erstellen und Projekten zuordnen.');
    return () => setSubtitle('');
  }, [setTitle, setSubtitle]);

  useEffect(() => {
    setActions(
      <Button onClick={() => openCreateTag()}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Plus size={16} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '600' }}>Neuer Tag</Text>
        </View>
      </Button>
    );
    return () => setActions(null);
  }, [setActions]);

  useEffect(() => {
    if (userId) loadAll();
  }, [userId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchTags(), fetchProjects(), fetchTagSettings()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    const { data, error } = await supabase
      .from('superuser_tags')
      .select('*')
      .order('name');
    if (error) console.error('fetchTags:', error);
    else setTags(data || []);
  };

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name')
      .order('name');
    if (error) console.error('fetchProjects:', error);
    else setProjects(data || []);
  };

  const fetchTagSettings = async () => {
    const { data, error } = await supabase
      .from('project_tag_settings')
      .select('project_id, tag_id, restrict_to_preset');
    if (error) console.error('fetchTagSettings:', error);
    else setTagSettings(data || []);
  };

  // ─── Tag CRUD ────────────────────────────────────────────────────────────

  const openCreateTag = () => {
    setEditingTag(null);
    setTagForm({ name: '', color: TAG_COLOR_OPTIONS[0] });
    setIsTagModalOpen(true);
  };

  const openEditTag = (tag: SuperuserTag) => {
    setEditingTag(tag);
    setTagForm({ name: tag.name, color: tag.color || TAG_COLOR_OPTIONS[0] });
    setIsTagModalOpen(true);
  };

  const saveTag = async () => {
    if (!tagForm.name.trim()) return;
    setTagFormLoading(true);
    try {
      if (editingTag) {
        const { error } = await supabase
          .from('superuser_tags')
          .update({ name: tagForm.name.trim(), color: tagForm.color })
          .eq('id', editingTag.id);
        if (error) throw error;
        showToast('Tag aktualisiert', 'success');
      } else {
        const { error } = await supabase
          .from('superuser_tags')
          .insert({ owner_id: userId, name: tagForm.name.trim(), color: tagForm.color });
        if (error) throw error;
        showToast('Tag erstellt', 'success');
      }
      setIsTagModalOpen(false);
      await fetchTags();
    } catch (e: any) {
      showToast('Fehler: ' + e.message, 'error');
    } finally {
      setTagFormLoading(false);
    }
  };

  const deleteTag = (tag: SuperuserTag) => {
    setPendingDeleteTag(tag);
  };

  const confirmDeleteTag = async () => {
    if (!pendingDeleteTag) return;
    const tag = pendingDeleteTag;
    setPendingDeleteTag(null);
    const { error } = await supabase.from('superuser_tags').delete().eq('id', tag.id);
    if (error) showToast('Fehler: ' + error.message, 'error');
    else {
      showToast('Tag gelöscht', 'success');
      await Promise.all([fetchTags(), fetchTagSettings()]);
    }
  };

  // ─── Project–Tag assignment ────────────────────────────────────────────

  const isTagAssigned = (projectId: string, tagId: string) =>
    tagSettings.some(s => s.project_id === projectId && s.tag_id === tagId);

  const getProjectRestrict = (projectId: string) => {
    const setting = tagSettings.find(s => s.project_id === projectId);
    return setting?.restrict_to_preset ?? false;
  };

  const toggleTagAssignment = async (projectId: string, tagId: string) => {
    if (isTagAssigned(projectId, tagId)) {
      const { error } = await supabase
        .from('project_tag_settings')
        .delete()
        .eq('project_id', projectId)
        .eq('tag_id', tagId);
      if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    } else {
      // Use current restrict value for this project (defaults false)
      const restrict = getProjectRestrict(projectId);
      const { error } = await supabase
        .from('project_tag_settings')
        .insert({ project_id: projectId, tag_id: tagId, restrict_to_preset: restrict });
      if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    }
    await fetchTagSettings();
  };

  const toggleRestrict = async (projectId: string) => {
    const currentRestrict = getProjectRestrict(projectId);
    const newRestrict = !currentRestrict;
    // Update all existing settings for this project
    const projectTagIds = tagSettings
      .filter(s => s.project_id === projectId)
      .map(s => s.tag_id);

    if (projectTagIds.length === 0) {
      // No tags assigned yet — store a sentinel row or just reflect in local state
      // We'll insert a placeholder with a dummy tag_id if none exist, or skip
      // Instead, show a toast hint
      showToast(
        newRestrict
          ? 'Weisen Sie zuerst Tags zu, damit die Einschränkung gilt.'
          : 'Einschränkung aufgehoben.',
        'info'
      );
      return;
    }

    const { error } = await supabase
      .from('project_tag_settings')
      .update({ restrict_to_preset: newRestrict })
      .eq('project_id', projectId);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast(newRestrict ? 'Nur diese Tags erlaubt' : 'Freie Tag-Eingabe erlaubt', 'success');
    await fetchTagSettings();
  };

  const assignedTagsForProject = (projectId: string) =>
    tagSettings.filter(s => s.project_id === projectId).map(s => s.tag_id);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <LottieLoader size={120} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* ── Section A: Tag Library ─────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Tag size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Tag-Bibliothek</Text>
          <Text style={styles.sectionCount}>{tags.length} Tags</Text>
        </View>

        {tags.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Noch keine Tags erstellt. Klicke auf „Neuer Tag".</Text>
          </View>
        ) : (
          <View style={styles.tagGrid}>
            {tags.map(tag => (
              <View key={tag.id} style={[styles.tagCard, { borderLeftColor: tag.color || colors.primary }]}>
                <View style={[styles.tagColorDot, { backgroundColor: tag.color || colors.primary }]} />
                <Text style={styles.tagCardName}>{tag.name}</Text>
                <View style={styles.tagCardActions}>
                  <TouchableOpacity style={styles.tagActionBtn} onPress={() => openEditTag(tag)}>
                    <Edit2 size={14} color="#64748b" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.tagActionBtn} onPress={() => deleteTag(tag)}>
                    <Trash2 size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Section B: Project Assignment ─────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Tag size={18} color="#10B981" />
          <Text style={styles.sectionTitle}>Projektzuordnung</Text>
          <Text style={styles.sectionCount}>{projects.length} Projekte</Text>
        </View>

        {tags.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Erstelle zuerst Tags in der Bibliothek oben.</Text>
          </View>
        )}

        {tags.length > 0 && projects.map(project => {
          const isExpanded = expandedProject === project.id;
          const assigned = assignedTagsForProject(project.id);
          const restrict = getProjectRestrict(project.id);

          return (
            <View key={project.id} style={styles.projectAccordion}>
              <TouchableOpacity
                style={styles.projectAccordionHeader}
                onPress={() => setExpandedProject(isExpanded ? null : project.id)}
              >
                <View style={styles.projectAccordionLeft}>
                  <Text style={styles.projectAccordionName}>{project.name}</Text>
                  {assigned.length > 0 && (
                    <View style={styles.assignedBadge}>
                      <Text style={styles.assignedBadgeText}>{assigned.length} Tags</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.accordionChevron}>{isExpanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.projectAccordionBody}>
                  {/* Tag checkboxes */}
                  <Text style={styles.assignLabel}>Tags zuweisen:</Text>
                  <View style={styles.tagCheckGrid}>
                    {tags.map(tag => {
                      const checked = isTagAssigned(project.id, tag.id);
                      return (
                        <TouchableOpacity
                          key={tag.id}
                          style={[styles.tagCheckChip, checked && styles.tagCheckChipActive, checked && { borderColor: tag.color || colors.primary, backgroundColor: (tag.color || colors.primary) + '20' }]}
                          onPress={() => toggleTagAssignment(project.id, tag.id)}
                        >
                          {checked && <Check size={11} color={tag.color || colors.primary} />}
                          <View style={[styles.tagCheckDot, { backgroundColor: tag.color || colors.primary }]} />
                          <Text style={[styles.tagCheckName, checked && { color: tag.color || colors.primary }]}>{tag.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Restrict toggle */}
                  <View style={styles.restrictRow}>
                    <View style={styles.restrictInfo}>
                      <Text style={styles.restrictLabel}>Nur diese Tags erlaubt</Text>
                      <Text style={styles.restrictSub}>
                        {restrict
                          ? 'Benutzer können nur aus den oben zugewiesenen Tags wählen.'
                          : 'Benutzer können beliebige Tags eingeben.'}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => toggleRestrict(project.id)}>
                      {restrict
                        ? <ToggleRight size={32} color={colors.primary} />
                        : <ToggleLeft size={32} color="#94a3b8" />}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* ── Tag Create/Edit Modal ────────────────────────────────── */}
      <ModernModal
        visible={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        title={editingTag ? 'Tag bearbeiten' : 'Neuer Tag'}
      >
        <View style={styles.modalBody}>
          <Input
            label="Name"
            value={tagForm.name}
            onChangeText={(v) => setTagForm(f => ({ ...f, name: v }))}
            placeholder="z.B. Dringend, Revisionsplan, ..."
          />
          <Text style={styles.colorLabel}>Farbe</Text>
          <View style={styles.colorGrid}>
            {TAG_COLOR_OPTIONS.map(color => (
              <TouchableOpacity
                key={color}
                style={[styles.colorSwatch, { backgroundColor: color }, tagForm.color === color && styles.colorSwatchSelected]}
                onPress={() => setTagForm(f => ({ ...f, color }))}
              >
                {tagForm.color === color && <Check size={14} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Preview */}
          <View style={styles.previewRow}>
            <View style={[styles.previewChip, { borderColor: tagForm.color, backgroundColor: tagForm.color + '20' }]}>
              <Tag size={11} color={tagForm.color} />
              <Text style={[styles.previewChipText, { color: tagForm.color }]}>
                {tagForm.name || 'Vorschau'}
              </Text>
            </View>
          </View>

          <View style={styles.modalActions}>
            <Button variant="outline" onClick={() => setIsTagModalOpen(false)}>Abbrechen</Button>
            <Button onClick={saveTag} disabled={tagFormLoading || !tagForm.name.trim()}>
              {tagFormLoading ? 'Speichern...' : editingTag ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </View>
        </View>
      </ModernModal>

      <ConfirmDialog
        visible={pendingDeleteTag !== null}
        title="Tag löschen"
        message={`Tag "${pendingDeleteTag?.name ?? ''}" wirklich löschen? Er wird aus allen Projekten entfernt.`}
        confirmLabel="Löschen"
        variant="danger"
        onConfirm={confirmDeleteTag}
        onCancel={() => setPendingDeleteTag(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  section: {
    margin: 20,
    marginBottom: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  sectionCount: {
    fontSize: 13,
    color: '#94a3b8',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  tagGrid: {
    gap: 8,
  },
  tagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderLeftWidth: 4,
    gap: 10,
  },
  tagColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tagCardName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  tagCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  tagActionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  projectAccordion: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  projectAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
  },
  projectAccordionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  projectAccordionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  assignedBadge: {
    backgroundColor: '#6366F120',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  assignedBadgeText: {
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '600',
  },
  accordionChevron: {
    fontSize: 11,
    color: '#94a3b8',
  },
  projectAccordionBody: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 16,
  },
  assignLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  tagCheckGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagCheckChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  tagCheckChipActive: {
    // borderColor and backgroundColor set dynamically
  },
  tagCheckDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tagCheckName: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  restrictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  restrictInfo: {
    flex: 1,
  },
  restrictLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  restrictSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  // Modal
  modalBody: {
    gap: 16,
    paddingTop: 8,
  },
  colorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  previewChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
});
