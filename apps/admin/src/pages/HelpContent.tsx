import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import {
  HelpCircle, Video, FileText, BookOpen, Tag, Plus, Trash2, Edit2,
  Save, X, Eye, EyeOff, Upload, Link
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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {allTags.map(t => {
        const active = selected.includes(t.name);
        return (
          <button
            key={t.id}
            onClick={() => toggle(t.name)}
            style={{
              paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5,
              borderRadius: 20, border: `1px solid ${active ? t.color : '#e2e8f0'}`,
              backgroundColor: active ? t.color : '#f8fafc',
              color: active ? '#fff' : '#64748b', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {t.name}
          </button>
        );
      })}
    </div>
  );
}

// ─── Modal Shell ─────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  // Render into document.body so position:fixed covers the full viewport
  const el = (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        backgroundColor: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 680,
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        border: '1px solid #e2e8f0', boxShadow: '0 25px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
            <X size={20} color="#94a3b8" />
          </button>
        </div>
        {/* Body — scrollable */}
        <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
  return ReactDOM.createPortal(el, document.body) as any;
}

// ─── Form Field & Input (HTML-native for use inside portal) ──────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 7 }}>{label}</label>
      {children}
    </div>
  );
}
function FInput({ value, onChangeText, placeholder, multiline, numberOfLines }: any) {
  const rows = numberOfLines || (multiline ? 4 : 1);
  const baseStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px',
    fontSize: 14, color: '#0f172a', outline: 'none', resize: multiline ? 'vertical' : 'none',
    fontFamily: 'inherit', lineHeight: '1.5',
  };
  if (multiline) {
    return <textarea rows={rows} value={value} onChange={e => onChangeText(e.target.value)} placeholder={placeholder} style={{ ...baseStyle, minHeight: rows * 24 + 20 }} />;
  }
  return <input type="text" value={value} onChange={e => onChangeText(e.target.value)} placeholder={placeholder} style={baseStyle} />;
}

// ─── Shared button styles for modal actions ────────────────────────────────────
const btnStyle = (disabled?: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  backgroundColor: disabled ? '#93c5fd' : '#2563eb', color: '#ffffff',
  border: 'none', borderRadius: 10, padding: '13px 0', width: '100%',
  fontSize: 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
  marginTop: 20, fontFamily: 'inherit', opacity: disabled ? 0.6 : 1,
});
const iconBtnStyle: React.CSSProperties = {
  background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6,
  width: 28, height: 28, cursor: 'pointer', fontSize: 13, color: '#64748b',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
};

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
      const payload = { question: form.question, answer: form.answer, tags: form.tags || [], sort_order: Number(form.sort_order) || 0, is_published: form.is_published ?? true };
      if (modal?.data?.id) {
        const { error } = await supabase.from('help_faqs').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', modal.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('help_faqs').insert(payload);
        if (error) throw error;
      }
      showToast('FAQ gespeichert');
      setModal(null);
      loadAll();
    } catch (e: any) { showToast(e.message || 'Speichern fehlgeschlagen – RLS prüfen', 'error'); }
    finally { setSaving(false); }
  };

  const saveWalkthrough = async () => {
    if (!form.title?.trim()) return showToast('Titel ist Pflichtfeld', 'error');
    setSaving(true);
    try {
      const payload = { title: form.title, description: form.description || '', tags: form.tags || [], sort_order: Number(form.sort_order) || 0, is_published: form.is_published ?? true };
      let wtId = modal?.data?.id;
      if (wtId) {
        const { error } = await supabase.from('help_walkthroughs').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', wtId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('help_walkthroughs').insert(payload).select().single();
        if (error) throw error;
        wtId = data?.id;
      }
      // Save steps
      if (wtId) {
        const { error: delErr } = await supabase.from('help_walkthrough_steps').delete().eq('walkthrough_id', wtId);
        if (delErr) throw delErr;
        const validSteps = steps.filter(s => s.title?.trim());
        if (validSteps.length > 0) {
          const { error: insErr } = await supabase.from('help_walkthrough_steps').insert(
            validSteps.map((s, i) => ({ walkthrough_id: wtId, title: s.title, description: s.description || '', image_url: s.image_url || '', step_order: i }))
          );
          if (insErr) throw insErr;
        }
      }
      showToast('Walkthrough gespeichert');
      setModal(null);
      loadAll();
    } catch (e: any) { showToast(e.message || 'Speichern fehlgeschlagen – RLS prüfen', 'error'); }
    finally { setSaving(false); }
  };

  const saveVideo = async () => {
    if (!form.title?.trim() || !form.video_url?.trim()) return showToast('Titel und Video-URL sind Pflichtfelder', 'error');
    setSaving(true);
    try {
      const payload = { title: form.title, description: form.description || '', video_url: form.video_url, thumbnail_url: form.thumbnail_url || '', tags: form.tags || [], sort_order: Number(form.sort_order) || 0, is_published: form.is_published ?? true };
      if (modal?.data?.id) {
        const { error } = await supabase.from('help_videos').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', modal.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('help_videos').insert(payload);
        if (error) throw error;
      }
      showToast('Video gespeichert');
      setModal(null);
      loadAll();
    } catch (e: any) { showToast(e.message || 'Speichern fehlgeschlagen – RLS prüfen', 'error'); }
    finally { setSaving(false); }
  };

  const saveDocument = async () => {
    if (!form.title?.trim() || !form.file_url?.trim()) return showToast('Titel und Datei-URL sind Pflichtfelder', 'error');
    setSaving(true);
    try {
      const payload = { title: form.title, description: form.description || '', file_url: form.file_url, file_name: form.file_name || form.title, file_size_bytes: Number(form.file_size_bytes) || 0, tags: form.tags || [], sort_order: Number(form.sort_order) || 0, is_published: form.is_published ?? true };
      if (modal?.data?.id) {
        const { error } = await supabase.from('help_documents').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', modal.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('help_documents').insert(payload);
        if (error) throw error;
      }
      showToast('Dokument gespeichert');
      setModal(null);
      loadAll();
    } catch (e: any) { showToast(e.message || 'Speichern fehlgeschlagen – RLS prüfen', 'error'); }
    finally { setSaving(false); }
  };

  const saveTag = async () => {
    if (!form.name?.trim()) return showToast('Tag-Name ist Pflichtfeld', 'error');
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), color: form.color || '#3b82f6' };
      if (modal?.data?.id) {
        const { error } = await supabase.from('help_tags').update(payload).eq('id', modal.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('help_tags').insert(payload);
        if (error) throw error;
      }
      showToast('Tag gespeichert');
      setModal(null);
      loadAll();
    } catch (e: any) { showToast(e.message || 'Speichern fehlgeschlagen – RLS prüfen', 'error'); }
    finally { setSaving(false); }
  };

  const deleteItem = async (table: string, id: string) => {
    if (!confirm('Wirklich löschen?')) return;
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      showToast('Gelöscht');
      loadAll();
    } catch (e: any) { showToast(e.message || 'Löschen fehlgeschlagen', 'error'); }
  };

  const togglePublished = async (table: string, id: string, current: boolean) => {
    try {
      const { error } = await supabase.from(table).update({ is_published: !current, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      loadAll();
    } catch (e: any) { showToast(e.message || 'Aktualisierung fehlgeschlagen', 'error'); }
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
    <View style={s.centered}><ActivityIndicator size="large" color="#2563eb" /></View>
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
              <Icon size={16} color={active ? '#2563eb' : '#64748b'} />
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
                    <Edit2 size={16} color="#2563eb" />
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
                    <Edit2 size={16} color="#2563eb" />
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
                    <Edit2 size={16} color="#2563eb" />
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
                    <Edit2 size={16} color="#2563eb" />
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
                    <Edit2 size={14} color="#2563eb" />
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
            <FInput value={form.answer || ''} onChangeText={(v: string) => setForm((f: any) => ({ ...f, answer: v }))} placeholder="Die Antwort ist..." multiline numberOfLines={6} />
          </Field>
          <Field label="Reihenfolge">
            <FInput value={String(form.sort_order || 0)} onChangeText={(v: string) => setForm((f: any) => ({ ...f, sort_order: v }))} placeholder="0" />
          </Field>
          <Field label="Tags">
            <TagPicker selected={form.tags || []} allTags={allTags} onChange={tags => setForm((f: any) => ({ ...f, tags }))} />
          </Field>
          <button
            onClick={saveFaq}
            disabled={saving}
            style={btnStyle(saving)}
          >
            {saving ? '...' : '💾  Speichern'}
          </button>
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
          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '16px 0' }} />

          {/* Steps */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Schritte ({steps.length})</span>
              <button onClick={addStep} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eff6ff', border: '1px solid #2563eb', borderRadius: 8, padding: '6px 12px', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                + Schritt hinzufügen
              </button>
            </div>
            {steps.map((step, idx) => (
              <div key={idx} style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>Schritt {idx + 1}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => moveStep(idx, -1)} style={iconBtnStyle}>↑</button>
                    <button onClick={() => moveStep(idx, 1)} style={iconBtnStyle}>↓</button>
                    <button onClick={() => removeStep(idx)} style={{ ...iconBtnStyle, color: '#ef4444' }}>✕</button>
                  </div>
                </div>
                <FInput value={step.title || ''} onChangeText={(v: string) => updateStep(idx, 'title', v)} placeholder="Schritt-Titel *" />
                <div style={{ marginTop: 8 }}>
                  <FInput value={step.description || ''} onChangeText={(v: string) => updateStep(idx, 'description', v)} placeholder="Beschreibung..." multiline numberOfLines={3} />
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <FInput value={step.image_url || ''} onChangeText={(v: string) => updateStep(idx, 'image_url', v)} placeholder="Bild-URL oder hochladen..." />
                  </div>
                  <button
                    style={{ width: 42, height: 42, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file'; input.accept = 'image/*';
                      input.onchange = (e: any) => { const file = e.target.files?.[0]; if (file) uploadStepImage(idx, file); };
                      input.click();
                    }}
                  >
                    <Upload size={14} color="#2563eb" />
                  </button>
                </div>
                {step.image_url && (
                  <img src={step.image_url} alt="preview" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />
                )}
              </div>
            ))}
          </div>

          <button onClick={saveWalkthrough} disabled={saving} style={{ ...btnStyle(saving), marginTop: 8 }}>
            {saving ? '...' : '💾  Speichern'}
          </button>
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
          <button onClick={saveVideo} disabled={saving} style={btnStyle(saving)}>
            {saving ? '...' : '💾  Speichern'}
          </button>
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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <FInput value={form.file_url || ''} onChangeText={(v: string) => setForm((f: any) => ({ ...f, file_url: v }))} placeholder="https://... oder Datei hochladen" />
              </div>
              <button
                style={{ width: 42, height: 42, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip';
                  input.onchange = (e: any) => { const file = e.target.files?.[0]; if (file) uploadDocFile(file); };
                  input.click();
                }}
              >
                <Upload size={14} color="#2563eb" />
              </button>
            </div>
            {form.file_name && <p style={{ color: '#10b981', fontSize: 12, margin: '4px 0 0' }}>✓ {form.file_name}</p>}
          </Field>
          <Field label="Reihenfolge">
            <FInput value={String(form.sort_order || 0)} onChangeText={(v: string) => setForm((f: any) => ({ ...f, sort_order: v }))} placeholder="0" />
          </Field>
          <Field label="Tags">
            <TagPicker selected={form.tags || []} allTags={allTags} onChange={tags => setForm((f: any) => ({ ...f, tags }))} />
          </Field>
          <button onClick={saveDocument} disabled={saving} style={btnStyle(saving)}>
            {saving ? '...' : '💾  Speichern'}
          </button>
        </Modal>
      )}

      {/* Tag Modal */}
      {modal?.type === 'tags' && (
        <Modal title={modal.data ? 'Tag bearbeiten' : 'Neuer Tag'} onClose={() => setModal(null)}>
          <Field label="Tag-Name *">
            <FInput value={form.name || ''} onChangeText={(v: string) => setForm((f: any) => ({ ...f, name: v }))} placeholder="z.B. Erste Schritte" />
          </Field>
          <Field label="Farbe">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
              {TAG_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm((f: any) => ({ ...f, color: c }))}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, border: form.color === c ? '3px solid #fff' : '3px solid transparent', cursor: 'pointer', outline: form.color === c ? '2px solid ' + c : 'none', outlineOffset: 2 }}
                />
              ))}
            </div>
          </Field>
          <button onClick={saveTag} disabled={saving} style={btnStyle(saving)}>
            {saving ? '...' : '💾  Speichern'}
          </button>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc', position: 'relative' as any },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toast: { position: 'absolute' as any, top: 16, right: 16, backgroundColor: '#10b981', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, zIndex: 9999, flexDirection: 'row', alignItems: 'center', gap: 8 },
  toastError: { backgroundColor: '#ef4444' },
  toastText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  tabBar: { flexDirection: 'row', gap: 4, paddingHorizontal: 0, marginBottom: 20, backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 9 },
  tabActive: { backgroundColor: '#ffffff' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  tabLabelActive: { color: '#2563eb' },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  count: { fontSize: 14, color: '#64748b' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  list: { flex: 1 },
  empty: { color: '#94a3b8', textAlign: 'center' as any, marginTop: 40, fontSize: 15 },
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTop: { flexDirection: 'row', gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#64748b', marginBottom: 8 },
  url: { fontSize: 12, color: '#94a3b8', marginBottom: 8 },
  stepCount: { fontSize: 12, color: '#2563eb', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  chipTxt: { fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'column', gap: 8, justifyContent: 'flex-start' },
  iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tagCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ffffff', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minWidth: 160 },
  tagDot: { width: 10, height: 10, borderRadius: 5 },
  tagName: { flex: 1, color: '#0f172a', fontSize: 14, fontWeight: '600' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 13, marginTop: 20 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  miniBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#2563eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  miniBtnText: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
  stepCard: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  stepNum: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
  uploadBtn: { width: 42, height: 42, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
