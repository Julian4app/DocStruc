import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput as RNTextInput,
} from 'react-native';
import { supabase } from '../lib/supabase';
import {
  Inbox, Search, Filter, Download, X, User, Clock,
  Mail, Phone, Building2, Save, FileJson, FileSpreadsheet,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadStatus = 'new' | 'read' | 'in_progress' | 'replied' | 'closed' | 'spam';
type LeadTopic  = 'general' | 'demo' | 'sales' | 'support' | 'partnership';

interface Lead {
  id: string;
  topic: LeadTopic;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  company_size: string | null;
  subject: string;
  message: string;
  status: LeadStatus;
  admin_notes: string | null;
  assigned_to: string | null;
  replied_at: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  new:         { label: 'Neu',            color: '#2563eb', bg: '#2563eb20' },
  read:        { label: 'Gelesen',        color: '#64748b', bg: '#64748b20' },
  in_progress: { label: 'In Bearbeitung', color: '#f59e0b', bg: '#f59e0b20' },
  replied:     { label: 'Geantwortet',    color: '#10b981', bg: '#10b98120' },
  closed:      { label: 'Geschlossen',    color: '#94a3b8', bg: '#94a3b820' },
  spam:        { label: 'Spam',           color: '#ef4444', bg: '#ef444420' },
};

const TOPIC_CONFIG: Record<LeadTopic, { label: string; color: string; bg: string; emoji: string }> = {
  general:     { label: 'Allgemeine Anfrage', color: '#3b82f6', bg: '#3b82f620', emoji: '📋' },
  demo:        { label: 'Demo anfragen',      color: '#8b5cf6', bg: '#8b5cf620', emoji: '🚀' },
  sales:       { label: 'Verkauf',            color: '#f59e0b', bg: '#f59e0b20', emoji: '💬' },
  support:     { label: 'Support',            color: '#ef4444', bg: '#ef444420', emoji: '🔧' },
  partnership: { label: 'Partnerschaft',      color: '#10b981', bg: '#10b98120', emoji: '🤝' },
};

const ALL_STATUSES: LeadStatus[] = ['new', 'read', 'in_progress', 'replied', 'closed', 'spam'];
const ALL_TOPICS:   LeadTopic[]  = ['general', 'demo', 'sales', 'support', 'partnership'];

const COMPANY_SIZE_LABELS: Record<string, string> = {
  '1-10': '1–10 Mitarbeiter', '11-50': '11–50 Mitarbeiter',
  '51-200': '51–200 Mitarbeiter', '200+': '200+ Mitarbeiter',
  'individual': 'Einzelperson',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[badge.wrap, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
      <Text style={[badge.txt, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function TopicBadge({ topic }: { topic: LeadTopic }) {
  const cfg = TOPIC_CONFIG[topic];
  return (
    <View style={[badge.wrap, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
      <Text style={[badge.txt, { color: cfg.color }]}>{cfg.emoji} {cfg.label}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  txt:  { fontSize: 11, fontWeight: '600' as any },
});

// ─── Export helpers ───────────────────────────────────────────────────────────

function dlCSV(data: Lead[]) {
  const hdr = ['ID','Datum','Thema','Status','Vorname','Nachname','E-Mail','Telefon','Unternehmen','Größe','Betreff','Nachricht'];
  const rows = data.map(l => [
    l.id, formatDate(l.created_at),
    TOPIC_CONFIG[l.topic]?.label ?? l.topic,
    STATUS_CONFIG[l.status]?.label ?? l.status,
    l.first_name, l.last_name, l.email, l.phone ?? '',
    l.company ?? '', l.company_size ? (COMPANY_SIZE_LABELS[l.company_size] ?? l.company_size) : '',
    `"${l.subject.replace(/"/g, '""')}"`,
    `"${l.message.replace(/"/g, '""')}"`,
  ]);
  const csv = '\uFEFF' + [hdr.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `leads_${new Date().toISOString().split('T')[0]}.csv` });
  a.click(); URL.revokeObjectURL(url);
}

function dlJSON(data: Lead[]) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `leads_${new Date().toISOString().split('T')[0]}.json` });
  a.click(); URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Leads() {
  const [leads,    setLeads]    = useState<Lead[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [search,   setSearch]   = useState('');
  const [showF,    setShowF]    = useState(false);
  const [showDl,   setShowDl]   = useState(false);

  // View filters
  const [fStatus, setFStatus] = useState<LeadStatus[]>([]);
  const [fTopics, setFTopics] = useState<LeadTopic[]>([]);
  const [fFrom,   setFFrom]   = useState('');
  const [fTo,     setFTo]     = useState('');

  // Detail edit state
  const [editStatus,   setEditStatus]   = useState<LeadStatus>('new');
  const [editNotes,    setEditNotes]    = useState('');
  const [editAssigned, setEditAssigned] = useState('');

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('website_leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLeads(data || []);
    } catch (e: any) {
      showToast(e.message || 'Fehler beim Laden', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // Sync edit state when a lead is selected
  useEffect(() => {
    if (selected) {
      setEditStatus(selected.status);
      setEditNotes(selected.admin_notes ?? '');
      setEditAssigned(selected.assigned_to ?? '');
    }
  }, [selected?.id]);

  // Auto-mark 'new' → 'read' when opened
  useEffect(() => {
    if (!selected || selected.status !== 'new') return;
    supabase.from('website_leads').update({ status: 'read' }).eq('id', selected.id).then(() => {
      const updated = { ...selected, status: 'read' as LeadStatus };
      setLeads(prev => prev.map(l => l.id === selected.id ? updated : l));
      setSelected(updated);
      setEditStatus('read');
    });
  }, [selected?.id]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updates: Partial<Lead> = {
        status:      editStatus,
        admin_notes: editNotes || null,
        assigned_to: editAssigned || null,
      };
      if (editStatus === 'replied' && selected.status !== 'replied') {
        updates.replied_at = new Date().toISOString();
      }
      const { error } = await supabase.from('website_leads').update(updates).eq('id', selected.id);
      if (error) throw error;
      const updated = { ...selected, ...updates };
      setLeads(prev => prev.map(l => l.id === selected.id ? updated : l));
      setSelected(updated);
      showToast('Gespeichert');
    } catch (e: any) {
      showToast(e.message || 'Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteLead = async (id: string) => {
    if (!(window as any).confirm('Lead wirklich löschen?')) return;
    try {
      const { error } = await supabase.from('website_leads').delete().eq('id', id);
      if (error) throw error;
      setLeads(prev => prev.filter(l => l.id !== id));
      if (selected?.id === id) setSelected(null);
      showToast('Lead gelöscht');
    } catch (e: any) {
      showToast(e.message || 'Fehler beim Löschen', 'error');
    }
  };

  // ── Filtering ─────────────────────────────────────────────────────────────
  const applyFilter = (list: Lead[]) =>
    list.filter(l => {
      if (fStatus.length > 0 && !fStatus.includes(l.status)) return false;
      if (fTopics.length > 0 && !fTopics.includes(l.topic))  return false;
      if (fFrom && new Date(l.created_at) < new Date(fFrom))  return false;
      if (fTo)   { const e = new Date(fTo); e.setHours(23, 59, 59); if (new Date(l.created_at) > e) return false; }
      return true;
    });

  const filtered = applyFilter(leads).filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.first_name.toLowerCase().includes(q) ||
      l.last_name.toLowerCase().includes(q)  ||
      l.email.toLowerCase().includes(q)      ||
      l.subject.toLowerCase().includes(q)    ||
      (l.company ?? '').toLowerCase().includes(q)
    );
  });

  const hasFilter = fStatus.length > 0 || fTopics.length > 0 || fFrom || fTo;

  // ── Stats ─────────────────────────────────────────────────────────────────
  const newCount         = leads.filter(l => l.status === 'new').length;
  const demoCount        = leads.filter(l => l.topic  === 'demo').length;
  const inProgressCount  = leads.filter(l => l.status === 'in_progress').length;

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;

  return (
    <View style={s.root}>
      {toast && (
        <View style={[s.toast, toast.type === 'error' && s.toastErr]}>
          <Text style={s.toastTxt}>{toast.msg}</Text>
        </View>
      )}

      <View style={s.body}>
        {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
        <View style={s.left}>

          {/* Stats */}
          <View style={s.stats}>
            {[
              { v: String(leads.length), l: 'Gesamt',       c: '#0f172a' },
              { v: String(newCount),     l: 'Neu',          c: '#2563eb' },
              { v: String(demoCount),    l: 'Demo-Anfragen', c: '#8b5cf6' },
              { v: String(inProgressCount), l: 'In Bearb.', c: '#f59e0b' },
            ].map(({ v, l, c }) => (
              <View key={l} style={s.statCard}>
                <Text style={[s.statV, { color: c }]}>{v}</Text>
                <Text style={s.statL}>{l}</Text>
              </View>
            ))}
          </View>

          {/* Toolbar */}
          <View style={s.toolbar}>
            <View style={s.srch}>
              <Search size={15} color="#94a3b8" />
              <RNTextInput
                style={s.srchIn} value={search} onChangeText={setSearch}
                placeholder="Name, E-Mail, Betreff…" placeholderTextColor="#94a3b8"
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
                  <X size={14} color="#94a3b8" />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              style={[s.tbBtn, showF && s.tbBtnOn]}
              onPress={() => { setShowF(v => !v); setShowDl(false); }}
              activeOpacity={0.7}
            >
              <Filter size={15} color={showF ? '#2563eb' : '#64748b'} />
              {hasFilter && <View style={s.dot} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tbBtn, showDl && s.tbBtnOn]}
              onPress={() => { setShowDl(v => !v); setShowF(false); }}
              activeOpacity={0.7}
            >
              <Download size={15} color={showDl ? '#2563eb' : '#64748b'} />
            </TouchableOpacity>
          </View>

          {/* Filter panel */}
          {showF && (
            <View style={s.panel}>
              <Text style={s.panelTitle}>Filter</Text>

              <Text style={s.panelLbl}>STATUS</Text>
              <View style={s.chips}>
                {ALL_STATUSES.map(st => {
                  const on  = fStatus.includes(st);
                  const cfg = STATUS_CONFIG[st];
                  return (
                    <TouchableOpacity key={st}
                      style={[s.chip, on && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                      onPress={() => setFStatus(p => on ? p.filter(x => x !== st) : [...p, st])}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.chipTxt, on && { color: cfg.color }]}>{cfg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[s.panelLbl, { marginTop: 10 }]}>THEMA</Text>
              <View style={s.chips}>
                {ALL_TOPICS.map(tp => {
                  const on  = fTopics.includes(tp);
                  const cfg = TOPIC_CONFIG[tp];
                  return (
                    <TouchableOpacity key={tp}
                      style={[s.chip, on && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                      onPress={() => setFTopics(p => on ? p.filter(x => x !== tp) : [...p, tp])}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.chipTxt, on && { color: cfg.color }]}>{cfg.emoji} {cfg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[s.panelLbl, { marginTop: 10 }]}>ZEITRAUM</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={s.dateBox}>
                  <Text style={s.dateLbl}>Von</Text>
                  <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)}
                    style={{ border: 'none', outline: 'none', fontSize: 13, color: '#0f172a', background: 'transparent', width: '100%' }} />
                </View>
                <View style={s.dateBox}>
                  <Text style={s.dateLbl}>Bis</Text>
                  <input type="date" value={fTo} onChange={e => setFTo(e.target.value)}
                    style={{ border: 'none', outline: 'none', fontSize: 13, color: '#0f172a', background: 'transparent', width: '100%' }} />
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <TouchableOpacity style={s.clearBtn}
                  onPress={() => { setFStatus([]); setFTopics([]); setFFrom(''); setFTo(''); }}
                  activeOpacity={0.7}
                >
                  <X size={12} color="#64748b" /><Text style={s.clearTxt}>Zurücksetzen</Text>
                </TouchableOpacity>
                <Text style={s.cnt}>{filtered.length} / {leads.length}</Text>
              </View>
            </View>
          )}

          {/* Download panel */}
          {showDl && (
            <View style={s.panel}>
              <Text style={s.panelTitle}>Export</Text>
              <Text style={s.cnt}>{applyFilter(leads).length} Einträge werden exportiert</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity style={[s.dlBtn, { backgroundColor: '#1d4ed8' }]}
                  onPress={() => { dlJSON(applyFilter(leads)); showToast('JSON exportiert'); setShowDl(false); }}
                  activeOpacity={0.8}
                >
                  <FileJson size={16} color="#fff" /><Text style={s.dlTxt}>JSON</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.dlBtn, { backgroundColor: '#16a34a' }]}
                  onPress={() => { dlCSV(applyFilter(leads)); showToast('CSV exportiert'); setShowDl(false); }}
                  activeOpacity={0.8}
                >
                  <FileSpreadsheet size={16} color="#fff" /><Text style={s.dlTxt}>Excel / CSV</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Lead list */}
          <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
            {filtered.length === 0 && (
              <View style={s.empty}>
                <Inbox size={40} color="#cbd5e1" />
                <Text style={s.emptyTxt}>Keine Leads gefunden</Text>
                <Text style={s.emptySub}>
                  {leads.length === 0
                    ? 'Noch keine Anfragen vom Website-Kontaktformular eingegangen'
                    : 'Keine Einträge für diese Filtereinstellungen'}
                </Text>
              </View>
            )}
            {filtered.map(lead => {
              const isSel = selected?.id === lead.id;
              const sCfg  = STATUS_CONFIG[lead.status];
              const tCfg  = TOPIC_CONFIG[lead.topic];
              const isNew = lead.status === 'new';
              return (
                <TouchableOpacity key={lead.id}
                  style={[s.card, isSel && s.cardSel, isNew && s.cardNew]}
                  onPress={() => setSelected(lead)}
                  activeOpacity={0.7}
                >
                  <View style={s.cardTop}>
                    <View style={[s.cardAvatar, { backgroundColor: tCfg.bg }]}>
                      <Text style={{ fontSize: 16 }}>{tCfg.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={s.cardName} numberOfLines={1}>
                          {lead.first_name} {lead.last_name}
                        </Text>
                        {isNew && <View style={s.newDot} />}
                      </View>
                      <Text style={s.cardEmail} numberOfLines={1}>{lead.email}</Text>
                    </View>
                    <View style={[s.statusDot, { backgroundColor: sCfg.color }]} />
                  </View>
                  <Text style={s.cardSubject} numberOfLines={1}>{lead.subject}</Text>
                  <Text style={s.cardMsg} numberOfLines={2}>{lead.message}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <Text style={s.cardDate}>{formatDate(lead.created_at)}</Text>
                    {lead.company && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Building2 size={11} color="#94a3b8" />
                        <Text style={s.cardCompany} numberOfLines={1}>{lead.company}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 60 }} />
          </ScrollView>
        </View>

        {/* ── RIGHT DETAIL PANEL ──────────────────────────────────────────── */}
        <View style={s.right}>
          {!selected ? (
            <View style={s.noSel}>
              <Inbox size={52} color="#cbd5e1" />
              <Text style={s.noSelTxt}>Lead auswählen</Text>
              <Text style={s.noSelSub}>Klicken Sie auf eine Anfrage, um die Details anzuzeigen</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>

              {/* Header */}
              <View style={s.dHdr}>
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' as any }}>
                    <TopicBadge topic={selected.topic} />
                    <StatusBadge status={selected.status} />
                  </View>
                  <Text style={s.dName}>{selected.first_name} {selected.last_name}</Text>
                  <Text style={s.dMeta}>{formatDate(selected.created_at)}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelected(null)} style={s.closeBtn} activeOpacity={0.7}>
                  <X size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Contact info grid */}
              <View style={s.infoGrid}>
                <View style={s.infoItem}>
                  <View style={s.infoLabelRow}>
                    <Mail size={12} color="#94a3b8" />
                    <Text style={s.dLabel}>E-MAIL</Text>
                  </View>
                  <TouchableOpacity onPress={() => (window as any).open(`mailto:${selected.email}`)} activeOpacity={0.7}>
                    <Text style={s.dLink}>{selected.email}</Text>
                  </TouchableOpacity>
                </View>

                {selected.phone && (
                  <View style={s.infoItem}>
                    <View style={s.infoLabelRow}>
                      <Phone size={12} color="#94a3b8" />
                      <Text style={s.dLabel}>TELEFON</Text>
                    </View>
                    <Text style={s.dVal}>{selected.phone}</Text>
                  </View>
                )}

                {selected.company && (
                  <View style={s.infoItem}>
                    <View style={s.infoLabelRow}>
                      <Building2 size={12} color="#94a3b8" />
                      <Text style={s.dLabel}>UNTERNEHMEN</Text>
                    </View>
                    <Text style={s.dVal}>
                      {selected.company}
                      {selected.company_size
                        ? ` · ${COMPANY_SIZE_LABELS[selected.company_size] ?? selected.company_size}`
                        : ''}
                    </Text>
                  </View>
                )}

                <View style={s.infoItem}>
                  <View style={s.infoLabelRow}>
                    <Clock size={12} color="#94a3b8" />
                    <Text style={s.dLabel}>EINGEGANGEN</Text>
                  </View>
                  <Text style={s.dVal}>{formatDate(selected.created_at)}</Text>
                </View>
              </View>

              {/* Subject */}
              <View style={s.dSection}>
                <Text style={s.dLabel}>BETREFF</Text>
                <Text style={s.dSubject}>{selected.subject}</Text>
              </View>

              {/* Message */}
              <View style={s.dSection}>
                <Text style={s.dLabel}>NACHRICHT</Text>
                <View style={s.msgBox}>
                  <Text style={s.msgTxt}>{selected.message}</Text>
                </View>
              </View>

              {/* Admin section */}
              <View style={s.adminSection}>
                <Text style={s.adminTitle}>Admin</Text>

                <Text style={s.dLabel}>STATUS</Text>
                <View style={[s.chips, { marginTop: 6, marginBottom: 14 }]}>
                  {ALL_STATUSES.map(st => {
                    const on  = editStatus === st;
                    const cfg = STATUS_CONFIG[st];
                    return (
                      <TouchableOpacity key={st}
                        style={[s.chip, on && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                        onPress={() => setEditStatus(st)}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.chipTxt, on && { color: cfg.color }]}>{cfg.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={s.dLabel}>ZUGEWIESEN AN</Text>
                <View style={s.inputWrap}>
                  <User size={14} color="#94a3b8" />
                  <RNTextInput
                    style={s.inputField}
                    value={editAssigned}
                    onChangeText={setEditAssigned}
                    placeholder="Name oder E-Mail des Bearbeiters…"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <Text style={[s.dLabel, { marginTop: 14 }]}>ADMIN-NOTIZEN</Text>
                <RNTextInput
                  style={s.notesField}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Interne Notizen (nicht sichtbar für den Absender)…"
                  placeholderTextColor="#94a3b8"
                  multiline
                />

                {/* Action buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  <TouchableOpacity
                    style={[s.saveBtn, saving && { opacity: 0.6 }]}
                    onPress={save}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    <Save size={16} color="#fff" />
                    <Text style={s.saveBtnTxt}>{saving ? 'Speichert…' : 'Speichern'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.replyBtn}
                    onPress={() => (window as any).open(`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`)}
                    activeOpacity={0.8}
                  >
                    <Mail size={16} color="#2563eb" />
                    <Text style={s.replyBtnTxt}>Antworten</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={s.deleteBtn} onPress={() => deleteLead(selected.id)} activeOpacity={0.7}>
                  <Text style={s.deleteBtnTxt}>Lead löschen</Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#f8fafc', position: 'relative' as any },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toast:    { position: 'absolute' as any, top: 16, right: 16, backgroundColor: '#10b981', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, zIndex: 9999 },
  toastErr: { backgroundColor: '#ef4444' },
  toastTxt: { color: '#fff', fontWeight: '600' as any, fontSize: 14 },

  body: { flex: 1, flexDirection: 'row' },

  // Left panel
  left:     { width: 440, borderRightWidth: 1, borderRightColor: '#e2e8f0', display: 'flex' as any, flexDirection: 'column' },
  stats:    { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  statV:    { fontSize: 20, fontWeight: '800' as any },
  statL:    { fontSize: 10, color: '#94a3b8', marginTop: 2, textAlign: 'center' as any },

  toolbar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10, alignItems: 'center' },
  srch:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 8 },
  srchIn:  { flex: 1, fontSize: 14, color: '#0f172a' },
  tbBtn:   { width: 38, height: 38, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  tbBtnOn: { backgroundColor: '#eff6ff', borderColor: '#93c5fd' },
  dot:     { position: 'absolute' as any, top: 6, right: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef4444' },

  panel:      { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, margin: 16, marginTop: 0, padding: 14 },
  panelTitle: { fontSize: 13, fontWeight: '700' as any, color: '#0f172a', marginBottom: 12 },
  panelLbl:   { fontSize: 11, fontWeight: '700' as any, color: '#94a3b8', marginBottom: 6, letterSpacing: 0.6 },
  chips:      { flexDirection: 'row', flexWrap: 'wrap' as any, gap: 6 },
  chip:       { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  chipTxt:    { fontSize: 12, fontWeight: '600' as any, color: '#64748b' },
  dateBox:    { flex: 1, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', padding: 10 },
  dateLbl:    { fontSize: 10, color: '#94a3b8', marginBottom: 2 },
  clearBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clearTxt:   { fontSize: 12, color: '#64748b' },
  cnt:        { fontSize: 12, color: '#94a3b8' },
  dlBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, paddingVertical: 11 },
  dlTxt:      { fontSize: 14, fontWeight: '700' as any, color: '#fff' },

  list:     { flex: 1, paddingHorizontal: 16 },
  empty:    { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTxt: { color: '#94a3b8', fontSize: 16, fontWeight: '700' as any },
  emptySub: { color: '#cbd5e1', fontSize: 13, textAlign: 'center' as any, maxWidth: 260 },

  card:      { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0', gap: 4 },
  cardSel:   { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  cardNew:   { borderLeftWidth: 3, borderLeftColor: '#2563eb' },
  cardTop:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  cardAvatar:{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardName:  { fontSize: 14, fontWeight: '700' as any, color: '#0f172a' },
  cardEmail: { fontSize: 12, color: '#64748b' },
  cardSubject:{ fontSize: 13, fontWeight: '600' as any, color: '#334155' },
  cardMsg:   { fontSize: 13, color: '#94a3b8', lineHeight: 18 },
  cardDate:  { fontSize: 11, color: '#94a3b8' },
  cardCompany:{ fontSize: 11, color: '#94a3b8', maxWidth: 120 },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  newDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2563eb' },

  // Right panel
  right:    { flex: 1, padding: 28 },
  noSel:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  noSelTxt: { fontSize: 18, fontWeight: '700' as any, color: '#94a3b8' },
  noSelSub: { fontSize: 14, color: '#cbd5e1', textAlign: 'center' as any, maxWidth: 280 },

  dHdr:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  dName:   { fontSize: 22, fontWeight: '800' as any, color: '#0f172a', marginTop: 6 },
  dMeta:   { fontSize: 13, color: '#64748b' },
  closeBtn:{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },

  infoGrid:    { flexDirection: 'row', flexWrap: 'wrap' as any, gap: 16, marginBottom: 20, backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  infoItem:    { minWidth: 180, flex: 1 },
  infoLabelRow:{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },

  dSection: { marginBottom: 20 },
  dLabel:   { fontSize: 11, fontWeight: '700' as any, color: '#94a3b8', letterSpacing: 0.8 },
  dVal:     { fontSize: 14, color: '#0f172a', marginTop: 2 },
  dLink:    { fontSize: 14, color: '#2563eb', textDecorationLine: 'underline', marginTop: 2 },
  dSubject: { fontSize: 17, fontWeight: '700' as any, color: '#0f172a', marginTop: 6 },
  msgBox:   { backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 8 },
  msgTxt:   { fontSize: 15, color: '#334155', lineHeight: 24 },

  adminSection: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 20, marginTop: 4 },
  adminTitle:   { fontSize: 14, fontWeight: '800' as any, color: '#0f172a', marginBottom: 16 },

  inputWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 10, marginTop: 6 },
  inputField: { flex: 1, fontSize: 14, color: '#0f172a' },
  notesField: { backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, fontSize: 14, color: '#0f172a', minHeight: 100, marginTop: 6, textAlignVertical: 'top' as any },

  saveBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12 },
  saveBtnTxt: { fontSize: 14, fontWeight: '700' as any, color: '#fff' },
  replyBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#eff6ff', borderRadius: 10, paddingVertical: 12, borderWidth: 1, borderColor: '#93c5fd' },
  replyBtnTxt:{ fontSize: 14, fontWeight: '700' as any, color: '#2563eb' },
  deleteBtn:  { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  deleteBtnTxt:{ fontSize: 13, color: '#ef4444' },
});
