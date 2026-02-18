import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput as RNTextInput } from 'react-native';
import { supabase } from '../lib/supabase';
import {
  HelpCircle, Video, FileText, BookOpen, Tag, Plus, Trash2, Edit2,
  Save, X, ChevronDown, ChevronUp, GripVertical, Upload, Eye, EyeOff,
  ArrowUp, ArrowDown, Image as ImageIcon, Link
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface HelpTag { id: string; name: string; color: string; }
interface HelpFaq { id: string; question: string; answer: string; tags: string[]; sort_order: number; is_published: boolean; }
interface HelpWalkthrough { id: string; title: string; description: string; tags: string[]; sort_order: number; is_published: boolean; steps?: WalkthroughStep[]; }
interface WalkthroughStep { id: string; walkthrough_id: string; title: string; description: string; image_url: string; step_order: number; }
interface HelpVideo { id: string; title: string; description: string; video_url: string; thumbnail_url: string; tags: string[]; sort_order: number; is_published: boolean; }
interface HelpDocument { id: string; title: string; description: string; file_url: string; file_name: string; file_size_bytes: number; tags: string[]; sort_order: number; is_published: boolean; }

type ActiveTab = 'faqs' | 'walkthroughs' | 'videos' | 'documents' | 'tags';

// ─── Tag Picker Component ─────────────────────────────────────────────────────
function TagPicker({ selected, allTags, onChange }: { selected: string[]; allTags: HelpTag[]; onChange: (tags: string[]) => void }) {
  const toggle = (name: string) => {
    if (selected.includes(name)) onChange(selected.filter(t => t !== name));
    else onChange([...selected, name]);
  };
  return (
    <View style={tp.wrap}>
      {allTags.map(t => (
        <TouchableOpacity
          key={t.id}
          onPress={() => toggle(t.name)}
          style={[tp.chip, selected.includes(t.name) && { backgroundColor: t.color, borderColor: t.color }]}
          activeOpacity={0.7}
        >
          <Text style={[tp.chipText, selected.includes(t.name) && { color: '#fff' }]}>{t.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const tp = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  chipText: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
});

// ─── Modal Shell ─────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <View style={mod.overlay}>
      <View style={mod.card}>
        <View style={mod.header}>
          <Text style={mod.title}>{title}</Text>
          <TouchableOpacity onPress={onClose}><X size={20} color="#94a3b8" /></TouchableOpacity>
        </View>
        <ScrollView style={mod.body} contentContainerStyle={{ paddingBottom: 16 }}>{children as any}</ScrollView>
      </View>
    </View>
  );
}
const mod = StyleSheet.create({
  overlay: { position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '90%' as any, borderWidth: 1, borderColor: '#334155' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#334155' },
  title: { fontSize: 17, fontWeight: '700', color: '#f1f5f9' },
  body: { padding: 20 },
});

// ─── Form Field ──────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={fld.label}>{label}</Text>
      {children as any}
    </View>
  );
}
function FInput({ value, onChangeText, placeholder, multiline, numberOfLines }: any) {
  return (
    <RNTextInput
      style={[fld.input, multiline && { height: (numberOfLines || 3) * 22 + 20, textAlignVertical: 'top' as any }] as any}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#475569"
      multiline={multiline}
      numberOfLines={numberOfLines}
    />
  );
}
const fld = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 6 },
  input: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#f1f5f9', minHeight: 42 },
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HelpContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('faqs');
  const [allTags, setAllTags] = useState<HelpTag[]>([]);
  const [faqs, setFaqs] = useState<HelpFaq[]>([]);
  const [walkthroughs, setWalkthroughs] = useState<HelpWalkthrough[]>([]);
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [documents, setDocuments] = useState<HelpDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Modal state
  const [modal, setModal] = useState<{ type: ActiveTab | 'steps'; data?: any } | null>(null);
  const [selectedWalkthrough, setSelectedWalkthrough] = useState<HelpWalkthrough | null>(null);

  // Form state (generic — reused across modals)
  const [form, setForm] = useState<Record<string, any>>({});
  const [steps, setSteps] = useState<Partial<WalkthroughStep>[]>([]);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Load Data ──────────────────────────────────────────────────────────────
  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [tagsRes, faqRes, walkRes, vidRes, docRes] = await Promise.all([
        supabase.from('help_tags').select('*').order('name'),
        supabase.from('help_faqs').select('*').order('sort_order'),
        supabase.from('help_walkthroughs').select('*, help_walkthrough_steps(*)').order('sort_order'),
        supabase.from('help_videos').select('*').order('sort_order'),
        supabase.from('help_documents').select('*').order('sort_order'),
      ]);
      setAllTags(tagsRes.data || []);
      setFaqs(faqRes.data || []);
      setWalkthroughs((walkRes.data || []).map((w: any) => ({
        ...w,
        steps: (w.help_walkthrough_steps || []).sort((a: any, b: any) => a.step_order - b.step_order),
      })));
      setVideos(vidRes.data || []);
      setDocuments(docRes.data || []);
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  // ── Open Modal ─────────────────────────────────────────────────────────────
  const openNew = (type: ActiveTab) => {
    setForm({ tags: [], is_published: true, sort_order: 0 });
    if (type === 'walkthroughs') setSteps([{ title: '', description: '', image_url: '', step_order: 0 }]);
    setModal({ type });
  };

  const openEdit = (type: ActiveTab, item: any) => {
    setForm({ ...item });
    if (type === 'walkthroughs') {
      setSteps(item.steps?.length ? [...item.steps] : [{ title: '', description: '', image_url: '', step_order: 0 }]);
      setSelectedWalkthrough(item);
    }
    setModal({ type, data: item });
  };

  const openSteps = (wt: HelpWalkthrough) => {
    setSelectedWalkthrough(wt);
    setSteps(wt.steps?.length ? [...wt.steps] : [{ title: '', description: '', image_url: '', step_order: 0 }]);
    setModal({ type: 'steps', data: wt });
  };

  // ── Save Handlers ──────────────────────────────────────────────────────────
  const saveFaq = async () => {
    if (!form.question?.trim() || !form.answer?.trim()) return showToast('Frage und Antwort sind Pflichtfelder', 'error');
    setSaving(true);
    try {
      const payload = { question: form.question, answer: form.answer, tags: form.tags || [], sort_order: Number(form.sort_order) || 0, is_published: form.is_published ?? true, updated_at: new Date().toISOString() };
      if (modal?.data?.id) {
        await supabase.from('help_faqs').update(payload).eq('id', modal.data.id);
      } else {
        await supabase.from('help_faqs').insert(payload);
      }
      showToast('FAQ gespeichert');
      setModal(null);
      loadAll();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const saveWalkthrough = async () => {
    if (!form.title?.trim()) return showToast('Titel ist Pflichtfeld', 'error');
    setSaving(true);
    try {
      const payload = { title: form.title, description: form.description || '', tags: form.tags || [], sort_order: Number(form.sort_order) || 0, is_published: form.is_published ?? true, updated_at: new Date().toISOString() };
      let wtId = modal?.data?.id;
      if (wtId) {
        await supabase.from('help_walkthroughs').update(payload).eq('id', wtId);
      } else {
        const { data } = await supabase.from('help_walkthroughs').insert(payload).select().single();
        wtId = data?.id;
      }
      // Save steps
      if (wtId) {
        await supabase.from('help_walkthrough_steps').delete().eq('walkthrough_id', wtId);
        const validSteps = steps.filter(s => s.title?.trim());
        if (validSteps.length > 0) {
          await supabase.from('help_walkthrough_steps').insert(
            validSteps.map((s, i) => ({ walkthrough_id: wtId, title: s.title, description: s.description || '', image_url: s.image_url || '', step_order: i, updated_at: new Date().toISOString() }))
          );
        }
      }
      showToast('Walkthrough gespeichert');
      setModal(null);
      loadAll();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const saveVideo = async () => {
    if (!form.title?.trim() || !form.video_url?.trim()) return showToast('Titel und Video-URL sind Pflichtfelder', 'error');
    setSaving(true);
    try {
      const payload = { title: form.title, description: form.description || '', video_url: form.video_url, thumbnail_url: form.thumbnail_url || '', tags: form.tags || [], sort_order: Number(form.sort_order) || 0, is_published: form.is_published ?? true, updated_at: new Date().toISOString() };
      if (modal?.data?.id) {
        await supabase.from('help_videos').update(payload).eq('id', modal.data.id);
      } else {
        await supabase.from('help_videos').insert(payload);
      }
      showToast('Video gespeichert');
      setModal(null);
      loadAll();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const saveDocument = async () => {
    if (!form.title?.trim() || !form.file_url?.trim()) return showToast('Titel und Datei-URL sind Pflichtfelder', 'error');
    setSaving(true);
    try {
      const payload = { title: form.title, description: form.description || '', file_url: form.file_url, file_name: form.file_name || form.title, file_size_bytes: Number(form.file_size_bytes) || 0, tags: form.tags || [], sort_order: Number(form.sort_order) || 0, is_published: form.is_published ?? true, updated_at: new Date().toISOString() };
      if (modal?.data?.id) {
        await supabase.from('help_documents').update(payload).eq('id', modal.data.id);
      } else {
        await supabase.from('help_documents').insert(payload);
      }
      showToast('Dokument gespeichert');
      setModal(null);
      loadAll();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const saveTag = async () => {
    if (!form.name?.trim()) return showToast('Tag-Name ist Pflichtfeld', 'error');
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), color: form.color || '#3b82f6' };
      if (modal?.data?.id) {
        await supabase.from('help_tags').update(payload).eq('id', modal.data.id);
      } else {
        await supabase.from('help_tags').insert(payload);
      }
      showToast('Tag gespeichert');
      setModal(null);
      loadAll();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const deleteItem = async (table: string, id: string) => {
    if (!confirm('Wirklich löschen?')) return;
    try {
      await supabase.from(table).delete().eq('id', id);
      showToast('Gelöscht');
      loadAll();
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const togglePublished = async (table: string, id: string, current: boolean) => {
    try {
      await supabase.from(table).update({ is_published: !current, updated_at: new Date().toISOString() }).eq('id', id);
      loadAll();
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  // ── Steps helpers ──────────────────────────────────────────────────────────
  const addStep = () => setSteps(prev => [...prev, { title: '', description: '', image_url: '', step_order: prev.length }]);
  const removeStep = (idx: number) => setSteps(prev => prev.filter((_, i) => i !== idx));
  const updateStep = (idx: number, field: string, val: string) => setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  const moveStep = (idx: number, dir: -1 | 1) => {
    const arr = [...steps];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setSteps(arr);
  };

  // ── Upload image for walkthrough step ─────────────────────────────────────
  const uploadStepImage = async (idx: number, file: File) => {
    const ext = file.name.split('.').pop();
    const path = `walkthrough-steps/${Date.now()}-${idx}.${ext}`;
    const { error } = await supabase.storage.from('help-assets').upload(path, file, { upsert: true });
    if (error) return showToast(error.message, 'error');
    const { data: urlData } = supabase.storage.from('help-assets').getPublicUrl(path);
    updateStep(idx, 'image_url', urlData.publicUrl);
    showToast('Bild hochgeladen');
  };

  // ── Upload document file ───────────────────────────────────────────────────
  const uploadDocFile = async (file: File) => {
    const path = `documents/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('help-assets').upload(path, file, { upsert: true });
    if (error) return showToast(error.message, 'error');
    const { data: urlData } = supabase.storage.from('help-assets').getPublicUrl(path);
    setForm((f: any) => ({ ...f, file_url: urlData.publicUrl, file_name: file.name, file_size_bytes: file.size }));
    showToast('Datei hochgeladen');
  };

  // ── Tag colors ─────────────────────────────────────────────────────────────
  const TAG_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#14b8a6', '#f97316'];

  const tabs: { key: ActiveTab; label: string; icon: any }[] = [
    { key: 'faqs', label: 'FAQ', icon: HelpCircle },
    { key: 'walkthroughs', label: 'Erste Schritte', icon: BookOpen },
    { key: 'videos', label: 'Video Tutorials', icon: Video },
    { key: 'documents', label: 'Dokumentation', icon: FileText },
    { key: 'tags', label: 'Tags', icon: Tag },
  ];

  if (loading) return (
    <View style={s.centered}><ActivityIndicator size="large" color="#38bdf8" /></View>
  );

  return (
    <View style={s.root}>
      {/* Toast */}
      {toast && (
        <View style={[s.toast, toast.type === 'error' && s.toastError]}>
          <Text style={s.toastText}>{toast.msg}</Text>
        </View>
      )}

      {/* Tabs */}
      <View style={s.tabBar}>
        {tabs.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <TouchableOpacity key={t.key} style={[s.tab, active && s.tabActive]} onPress={() => setActiveTab(t.key)} activeOpacity={0.7}>
              <Icon size={16} color={active ? '#38bdf8' : '#64748b'} />
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Add Button */}
      <View style={s.toolbar}>
        <Text style={s.count}>
          {activeTab === 'faqs' && `${faqs.length} Einträge`}
          {activeTab === 'walkthroughs' && `${walkthroughs.length} Flows`}
          {activeTab === 'videos' && `${videos.length} Videos`}
          {activeTab === 'documents' && `${documents.length} Dokumente`}
          {activeTab === 'tags' && `${allTags.length} Tags`}
        </Text>
        <TouchableOpacity style={s.addBtn} onPress={() => openNew(activeTab)} activeOpacity={0.8}>
          <Plus size={16} color="#0f172a" />
          <Text style={s.addBtnText}>Neu hinzufügen</Text>
        </TouchableOpacity>
      </View>

      {/* ── FAQs ── */}
      {activeTab === 'faqs' && (
        <ScrollView style={s.list}>
          {faqs.length === 0 && <Text style={s.empty}>Noch keine FAQs vorhanden.</Text>}
          {faqs.map(faq => (
            <View key={faq.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{faq.question}</Text>
                  <Text style={s.cardSub} numberOfLines={2}>{faq.answer}</Text>
                  <View style={s.chips}>
                    {(faq.tags || []).map(t => {
                      const tag = allTags.find(at => at.name === t);
                      return <View key={t} style={[s.chip, { backgroundColor: (tag?.color || '#3b82f6') + '25', borderColor: tag?.color || '#3b82f6' }]}><Text style={[s.chipTxt, { color: tag?.color || '#3b82f6' }]}>{t}</Text></View>;
                    })}
                  </View>
                </View>
                <View style={s.actions}>
                  <TouchableOpacity style={s.iconBtn} onPress={() => togglePublished('help_faqs', faq.id, faq.is_published)}>
                    {faq.is_published ? <Eye size={16} color="#10b981" /> : <EyeOff size={16} color="#64748b" />}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconBtn} onPress={() => openEdit('faqs', faq)}>
                    <Edit2 size={16} color="#38bdf8" />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconBtn} onPress={() => deleteItem('help_faqs', faq.id)}>
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Walkthroughs ── */}
      {activeTab === 'walkthroughs' && (
        <ScrollView style={s.list}>
          {walkthroughs.length === 0 && <Text style={s.empty}>Noch keine Walkthroughs vorhanden.</Text>}
          {walkthroughs.map(wt => (
            <View key={wt.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{wt.title}</Text>
                  <Text style={s.cardSub}>{wt.description}</Text>
                  <Text style={s.stepCount}>{wt.steps?.length || 0} Schritte</Text>
                  <View style={s.chips}>
                    {(wt.tags || []).map(t => {
                      const tag = allTags.find(at => at.name === t);
                      return <View key={t} style={[s.chip, { backgroundColor: (tag?.color || '#3b82f6') + '25', borderColor: tag?.color || '#3b82f6' }]}><Text style={[s.chipTxt, { color: tag?.color || '#3b82f6' }]}>{t}</Text></View>;
                    })}
                  </View>
                </View>
                <View style={s.actions}>
                  <TouchableOpacity style={s.iconBtn} onPress={() => togglePublished('help_walkthroughs', wt.id, wt.is_published)}>
                    {wt.is_published ? <Eye size={16} color="#10b981" /> : <EyeOff size={16} color="#64748b" />}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconBtn} onPress={() => openEdit('walkthroughs', wt)}>
                    <Edit2 size={16} color="#38bdf8" />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconBtn} onPress={() => deleteItem('help_walkthroughs', wt.id)}>
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Videos ── */}
      {activeTab === 'videos' && (
        <ScrollView style={s.list}>
          {videos.length === 0 && <Text style={s.empty}>Noch keine Videos vorhanden.</Text>}
          {videos.map(vid => (
            <View key={vid.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{vid.title}</Text>
                  <Text style={s.cardSub} numberOfLines={2}>{vid.description}</Text>
                  <Text style={s.url} numberOfLines={1}>{vid.video_url}</Text>
                  <View style={s.chips}>
                    {(vid.tags || []).map(t => {
                      const tag = allTags.find(at => at.name === t);
                      return <View key={t} style={[s.chip, { backgroundColor: (tag?.color || '#8b5cf6') + '25', borderColor: tag?.color || '#8b5cf6' }]}><Text style={[s.chipTxt, { color: tag?.color || '#8b5cf6' }]}>{t}</Text></View>;
                    })}
                  </View>
                </View>
                <View style={s.actions}>
                  <TouchableOpacity style={s.iconBtn} onPress={() => togglePublished('help_videos', vid.id, vid.is_published)}>
                    {vid.is_published ? <Eye size={16} color="#10b981" /> : <EyeOff size={16} color="#64748b" />}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconBtn} onPress={() => openEdit('videos', vid)}>
                    <Edit2 size={16} color="#38bdf8" />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconBtn} onPress={() => deleteItem('help_videos', vid.id)}>
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Documents ── */}
      {activeTab === 'documents' && (
        <ScrollView style={s.list}>
          {documents.length === 0 && <Text style={s.empty}>Noch keine Dokumente vorhanden.</Text>}
          {documents.map(doc => (
            <View key={doc.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{doc.title}</Text>
                  <Text style={s.cardSub} numberOfLines={2}>{doc.description}</Text>
                  <Text style={s.url}>{doc.file_name} {doc.file_size_bytes ? `(${Math.round(doc.file_size_bytes / 1024)} KB)` : ''}</Text>
                  <View style={s.chips}>
                    {(doc.tags || []).map(t => {
                      const tag = allTags.find(at => at.name === t);
                      return <View key={t} style={[s.chip, { backgroundColor: (tag?.color || '#f59e0b') + '25', borderColor: tag?.color || '#f59e0b' }]}><Text style={[s.chipTxt, { color: tag?.color || '#f59e0b' }]}>{t}</Text></View>;
                    })}
                  </View>
                </View>
                <View style={s.actions}>
                  <TouchableOpacity style={s.iconBtn} onPress={() => togglePublished('help_documents', doc.id, doc.is_published)}>
                    {doc.is_published ? <Eye size={16} color="#10b981" /> : <EyeOff size={16} color="#64748b" />}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconBtn} onPress={() => openEdit('documents', doc)}>
                    <Edit2 size={16} color="#38bdf8" />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconBtn} onPress={() => deleteItem('help_documents', doc.id)}>
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Tags ── */}
      {activeTab === 'tags' && (
        <ScrollView style={s.list}>
          {allTags.length === 0 && <Text style={s.empty}>Noch keine Tags vorhanden.</Text>}
          <View style={s.tagsGrid}>
            {allTags.map(tag => (
              <View key={tag.id} style={[s.tagCard, { borderColor: tag.color }]}>
                <View style={[s.tagDot, { backgroundColor: tag.color }]} />
                <Text style={s.tagName}>{tag.name}</Text>
                <View style={s.actions}>
                  <TouchableOpacity style={s.iconBtn} onPress={() => openEdit('tags', tag)}>
                    <Edit2 size={14} color="#38bdf8" />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconBtn} onPress={() => deleteItem('help_tags', tag.id)}>
                    <Trash2 size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ════════════════════════════════════════ MODALS ═══════════════════════════════════════ */}

      {/* FAQ Modal */}
      {modal?.type === 'faqs' && (
        <Modal title={modal.data ? 'FAQ bearbeiten' : 'Neue FAQ'} onClose={() => setModal(null)}>
          <Field label="Frage *">
            <FInput value={form.question || ''} onChangeText={(v: string) => setForm((f: any) => ({ ...f, question: v }))} placeholder="Wie kann ich...?" />
          </Field>
          <Field label="Antwort *">
            <FInput value={form.answer || ''} onChangeText={(v: string) => setForm((f: any) => ({ ...f, answer: v }))} placeholder="Die Antwort ist..." multiline numberOfLines={5} />
          </Field>
          <Field label="Reihenfolge">
            <FInput value={String(form.sort_order || 0)} onChangeText={(v: string) => setForm((f: any) => ({ ...f, sort_order: v }))} placeholder="0" />
          </Field>
          <Field label="Tags">
            <TagPicker selected={form.tags || []} allTags={allTags} onChange={tags => setForm((f: any) => ({ ...f, tags }))} />
          </Field>
          <TouchableOpacity
            style={[s.saveBtn, saving && s.saveBtnDisabled]}
            onPress={saveFaq}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? <ActivityIndicator size="small" color="#0f172a" /> : <><Save size={16} color="#0f172a" /><Text style={s.saveBtnText}>Speichern</Text></>}
          </TouchableOpacity>
        </Modal>
      )}

      {/* Walkthrough Modal */}
      {modal?.type === 'walkthroughs' && (
        <Modal title={modal.data ? 'Walkthrough bearbeiten' : 'Neuer Walkthrough'} onClose={() => setModal(null)}>
          <Field label="Titel *">
            <FInput value={form.title || ''} onChangeText={(v: string) => setForm((f: any) => ({ ...f, title: v }))} placeholder="Erste Schritte mit DocStruc" />
          </Field>
          <Field label="Beschreibung">
            <FInput value={form.description || ''} onChangeText={(v: string) => setForm((f: any) => ({ ...f, description: v }))} placeholder="Kurze Beschreibung..." multiline numberOfLines={3} />
          </Field>
          <Field label="Tags">
            <TagPicker selected={form.tags || []} allTags={allTags} onChange={tags => setForm((f: any) => ({ ...f, tags }))} />
          </Field>

          {/* Steps */}
          <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={fld.label}>Schritte ({steps.length})</Text>
              <TouchableOpacity style={s.miniBtn} onPress={addStep} activeOpacity={0.8}>
                <Plus size={14} color="#38bdf8" />
                <Text style={s.miniBtnText}>Schritt hinzufügen</Text>
              </TouchableOpacity>
            </View>
            {steps.map((step, idx) => (
              <View key={idx} style={s.stepCard}>
                <View style={s.stepHeader}>
                  <Text style={s.stepNum}>Schritt {idx + 1}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity onPress={() => moveStep(idx, -1)}><ArrowUp size={14} color="#64748b" /></TouchableOpacity>
                    <TouchableOpacity onPress={() => moveStep(idx, 1)}><ArrowDown size={14} color="#64748b" /></TouchableOpacity>
                    <TouchableOpacity onPress={() => removeStep(idx)}><X size={14} color="#ef4444" /></TouchableOpacity>
                  </View>
                </View>
                <FInput value={step.title || ''} onChangeText={(v: string) => updateStep(idx, 'title', v)} placeholder="Schritt-Titel *" />
                <View style={{ marginTop: 8 }}>
                  <FInput value={step.description || ''} onChangeText={(v: string) => updateStep(idx, 'description', v)} placeholder="Beschreibung..." multiline numberOfLines={3} />
                </View>
                <View style={{ marginTop: 8, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <FInput value={step.image_url || ''} onChangeText={(v: string) => updateStep(idx, 'image_url', v)} placeholder="Bild-URL oder hochladen..." />
                  </View>
                  <TouchableOpacity
                    style={s.uploadBtn}
                    onPress={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e: any) => {
                        const file = e.target.files?.[0];
                        if (file) uploadStepImage(idx, file);
                      };
                      input.click();
                    }}
                    activeOpacity={0.8}
                  >
                    <Upload size={14} color="#38bdf8" />
                  </TouchableOpacity>
                </View>
                {step.image_url && (
                  <img src={step.image_url} alt="preview" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />
                )}
              </View>
            ))}
          </View>

          <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={saveWalkthrough} disabled={saving} activeOpacity={0.8}>
            {saving ? <ActivityIndicator size="small" color="#0f172a" /> : <><Save size={16} color="#0f172a" /><Text style={s.saveBtnText}>Speichern</Text></>}
          </TouchableOpacity>
        </Modal>
      )}

      {/* Video Modal */}
      {modal?.type === 'videos' && (
        <Modal title={modal.data ? 'Video bearbeiten' : 'Neues Video'} onClose={() => setModal(null)}>
          <Field label="Titel *">
            <FInput value={form.title || ''} onChangeText={(v: string) => setForm((f: any) => ({ ...f, title: v }))} placeholder="Video-Titel" />
          </Field>
          <Field label="Beschreibung">
            <FInput value={form.description || ''} onChangeText={(v: string) => setForm((f: any) => ({ ...f, description: v }))} placeholder="Kurze Beschreibung..." multiline numberOfLines={3} />
          </Field>
          <Field label="Video-URL (YouTube, Vimeo oder direkt) *">
            <FInput value={form.video_url || ''} onChangeText={(v: string) => setForm((f: any) => ({ ...f, video_url: v }))} placeholder="https://youtube.com/embed/..." />
          </Field>
          <Field label="Thumbnail-URL">
            <FInput value={form.thumbnail_url || ''} onChangeText={(v: string) => setForm((f: any) => ({ ...f, thumbnail_url: v }))} placeholder="https://..." />
          </Field>
          <Field label="Reihenfolge">
            <FInput value={String(form.sort_order || 0)} onChangeText={(v: string) => setForm((f: any) => ({ ...f, sort_order: v }))} placeholder="0" />
          </Field>
          <Field label="Tags">
            <TagPicker selected={form.tags || []} allTags={allTags} onChange={tags => setForm((f: any) => ({ ...f, tags }))} />
          </Field>
          <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={saveVideo} disabled={saving} activeOpacity={0.8}>
            {saving ? <ActivityIndicator size="small" color="#0f172a" /> : <><Save size={16} color="#0f172a" /><Text style={s.saveBtnText}>Speichern</Text></>}
          </TouchableOpacity>
        </Modal>
      )}

      {/* Document Modal */}
      {modal?.type === 'documents' && (
        <Modal title={modal.data ? 'Dokument bearbeiten' : 'Neues Dokument'} onClose={() => setModal(null)}>
          <Field label="Titel *">
            <FInput value={form.title || ''} onChangeText={(v: string) => setForm((f: any) => ({ ...f, title: v }))} placeholder="Dokumenten-Titel" />
          </Field>
          <Field label="Beschreibung">
            <FInput value={form.description || ''} onChangeText={(v: string) => setForm((f: any) => ({ ...f, description: v }))} placeholder="Kurze Beschreibung..." multiline numberOfLines={3} />
          </Field>
          <Field label="Datei hochladen oder URL eingeben *">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <FInput value={form.file_url || ''} onChangeText={(v: string) => setForm((f: any) => ({ ...f, file_url: v }))} placeholder="https://... oder Datei hochladen" />
              </View>
              <TouchableOpacity
                style={s.uploadBtn}
                onPress={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip';
                  input.onchange = (e: any) => {
                    const file = e.target.files?.[0];
                    if (file) uploadDocFile(file);
                  };
                  input.click();
                }}
                activeOpacity={0.8}
              >
                <Upload size={14} color="#38bdf8" />
              </TouchableOpacity>
            </View>
            {form.file_name && <Text style={{ color: '#10b981', fontSize: 12, marginTop: 4 }}>✓ {form.file_name}</Text>}
          </Field>
          <Field label="Reihenfolge">
            <FInput value={String(form.sort_order || 0)} onChangeText={(v: string) => setForm((f: any) => ({ ...f, sort_order: v }))} placeholder="0" />
          </Field>
          <Field label="Tags">
            <TagPicker selected={form.tags || []} allTags={allTags} onChange={tags => setForm((f: any) => ({ ...f, tags }))} />
          </Field>
          <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={saveDocument} disabled={saving} activeOpacity={0.8}>
            {saving ? <ActivityIndicator size="small" color="#0f172a" /> : <><Save size={16} color="#0f172a" /><Text style={s.saveBtnText}>Speichern</Text></>}
          </TouchableOpacity>
        </Modal>
      )}

      {/* Tag Modal */}
      {modal?.type === 'tags' && (
        <Modal title={modal.data ? 'Tag bearbeiten' : 'Neuer Tag'} onClose={() => setModal(null)}>
          <Field label="Tag-Name *">
            <FInput value={form.name || ''} onChangeText={(v: string) => setForm((f: any) => ({ ...f, name: v }))} placeholder="z.B. Erste Schritte" />
          </Field>
          <Field label="Farbe">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
              {TAG_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[{ width: 32, height: 32, borderRadius: 16, backgroundColor: c }, form.color === c && { borderWidth: 3, borderColor: '#fff' }]}
                  onPress={() => setForm((f: any) => ({ ...f, color: c }))}
                  activeOpacity={0.8}
                />
              ))}
            </View>
          </Field>
          <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={saveTag} disabled={saving} activeOpacity={0.8}>
            {saving ? <ActivityIndicator size="small" color="#0f172a" /> : <><Save size={16} color="#0f172a" /><Text style={s.saveBtnText}>Speichern</Text></>}
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a', position: 'relative' as any },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toast: { position: 'absolute' as any, top: 16, right: 16, backgroundColor: '#10b981', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, zIndex: 9999, flexDirection: 'row', alignItems: 'center', gap: 8 },
  toastError: { backgroundColor: '#ef4444' },
  toastText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  tabBar: { flexDirection: 'row', gap: 4, paddingHorizontal: 0, marginBottom: 20, backgroundColor: '#1e293b', borderRadius: 12, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 9 },
  tabActive: { backgroundColor: '#0f172a' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabLabelActive: { color: '#38bdf8' },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  count: { fontSize: 14, color: '#64748b' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#38bdf8', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  list: { flex: 1 },
  empty: { color: '#475569', textAlign: 'center' as any, marginTop: 40, fontSize: 15 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  cardTop: { flexDirection: 'row', gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#f1f5f9', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#94a3b8', marginBottom: 8 },
  url: { fontSize: 12, color: '#475569', marginBottom: 8 },
  stepCount: { fontSize: 12, color: '#38bdf8', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  chipTxt: { fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'column', gap: 8, justifyContent: 'flex-start' },
  iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tagCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1e293b', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minWidth: 160 },
  tagDot: { width: 10, height: 10, borderRadius: 5 },
  tagName: { flex: 1, color: '#f1f5f9', fontSize: 14, fontWeight: '600' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#38bdf8', borderRadius: 10, paddingVertical: 13, marginTop: 20 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  miniBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#38bdf8', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  miniBtnText: { fontSize: 12, color: '#38bdf8', fontWeight: '600' },
  stepCard: { backgroundColor: '#0f172a', borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  stepNum: { fontSize: 13, fontWeight: '700', color: '#38bdf8' },
  uploadBtn: { width: 42, height: 42, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
