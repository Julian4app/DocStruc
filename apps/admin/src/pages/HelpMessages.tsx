import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput as RNTextInput } from 'react-native';
import { supabase } from '../lib/supabase';
import { MessageCircle, Mail, User, Clock, ChevronRight, X, Save, Circle } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
type MessageStatus = 'open' | 'read' | 'action_required' | 'redirected' | 'finished';

interface SupportMessage {
  id: string;
  user_id: string | null;
  sender_name: string;
  sender_email: string;
  subject: string;
  message: string;
  status: MessageStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<MessageStatus, { label: string; color: string; bg: string }> = {
  open: { label: 'Offen', color: '#3b82f6', bg: '#3b82f620' },
  read: { label: 'Gelesen', color: '#64748b', bg: '#64748b20' },
  action_required: { label: 'Handlung erforderlich', color: '#ef4444', bg: '#ef444420' },
  redirected: { label: 'Weitergeleitet', color: '#f97316', bg: '#f9731620' },
  finished: { label: 'Erledigt', color: '#10b981', bg: '#10b98120' },
};

const ALL_STATUSES: MessageStatus[] = ['open', 'read', 'action_required', 'redirected', 'finished'];

function StatusBadge({ status }: { status: MessageStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[sb.badge, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
      <Text style={[sb.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  text: { fontSize: 12, fontWeight: '600' },
});

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HelpMessages() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<SupportMessage | null>(null);
  const [filterStatus, setFilterStatus] = useState<MessageStatus | 'all'>('all');
  const [adminNotes, setAdminNotes] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<MessageStatus>('open');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [search, setSearch] = useState('');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => { loadMessages(); }, []);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMessages(data || []);
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  const openDetail = (msg: SupportMessage) => {
    setSelected(msg);
    setAdminNotes(msg.admin_notes || '');
    setSelectedStatus(msg.status);
    // Auto-mark as read
    if (msg.status === 'open') {
      updateStatus(msg.id, 'read', msg.admin_notes || '');
    }
  };

  const updateStatus = async (id: string, status: MessageStatus, notes: string) => {
    try {
      await supabase
        .from('support_messages')
        .update({ status, admin_notes: notes, updated_at: new Date().toISOString() })
        .eq('id', id);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status, admin_notes: notes } : m));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status, admin_notes: notes } : null);
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const saveChanges = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await supabase
        .from('support_messages')
        .update({ status: selectedStatus, admin_notes: adminNotes, updated_at: new Date().toISOString() })
        .eq('id', selected.id);
      setMessages(prev => prev.map(m => m.id === selected.id ? { ...m, status: selectedStatus, admin_notes: adminNotes } : m));
      setSelected(prev => prev ? { ...prev, status: selectedStatus, admin_notes: adminNotes } : null);
      showToast('Gespeichert');
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const deleteMessage = async (id: string) => {
    if (!confirm('Nachricht wirklich löschen?')) return;
    try {
      await supabase.from('support_messages').delete().eq('id', id);
      setMessages(prev => prev.filter(m => m.id !== id));
      if (selected?.id === id) setSelected(null);
      showToast('Nachricht gelöscht');
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const filtered = messages.filter(m => {
    const matchesStatus = filterStatus === 'all' || m.status === filterStatus;
    const q = search.toLowerCase();
    const matchesSearch = !q || m.sender_name.toLowerCase().includes(q) || m.sender_email.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q) || m.message.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const counts = ALL_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = messages.filter(m => m.status === s).length;
    return acc;
  }, {});

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

      <View style={s.body}>
        {/* ── Left Panel: Message List ── */}
        <View style={s.leftPanel}>
          {/* Stats row */}
          <View style={s.statsRow}>
            <TouchableOpacity
              style={[s.statChip, filterStatus === 'all' && s.statChipActive]}
              onPress={() => setFilterStatus('all')}
              activeOpacity={0.7}
            >
              <Text style={[s.statChipText, filterStatus === 'all' && s.statChipTextActive]}>
                Alle ({messages.length})
              </Text>
            </TouchableOpacity>
            {ALL_STATUSES.map(st => {
              const cfg = STATUS_CONFIG[st];
              const active = filterStatus === st;
              return (
                <TouchableOpacity
                  key={st}
                  style={[s.statChip, active && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                  onPress={() => setFilterStatus(st)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.statChipText, active && { color: cfg.color }]}>
                    {cfg.label} ({counts[st] || 0})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Search */}
          <RNTextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Suchen nach Name, E-Mail, Betreff..."
            placeholderTextColor="#475569"
          />

          {/* List */}
          <ScrollView style={s.msgList} showsVerticalScrollIndicator={false}>
            {filtered.length === 0 && (
              <View style={s.emptyState}>
                <MessageCircle size={32} color="#334155" />
                <Text style={s.emptyText}>Keine Nachrichten gefunden</Text>
              </View>
            )}
            {filtered.map(msg => {
              const cfg = STATUS_CONFIG[msg.status];
              const isSelected = selected?.id === msg.id;
              return (
                <TouchableOpacity
                  key={msg.id}
                  style={[s.msgCard, isSelected && s.msgCardSelected]}
                  onPress={() => openDetail(msg)}
                  activeOpacity={0.7}
                >
                  <View style={s.msgCardTop}>
                    <View style={s.senderInfo}>
                      <View style={s.avatar}>
                        <Text style={s.avatarText}>{msg.sender_name?.charAt(0)?.toUpperCase() || '?'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.senderName} numberOfLines={1}>{msg.sender_name}</Text>
                        <Text style={s.senderEmail} numberOfLines={1}>{msg.sender_email}</Text>
                      </View>
                    </View>
                    <View style={[sb.badge, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
                      <Text style={[sb.text, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                  <Text style={s.msgSubject} numberOfLines={1}>{msg.subject}</Text>
                  <Text style={s.msgPreview} numberOfLines={2}>{msg.message}</Text>
                  <Text style={s.msgDate}>{formatDate(msg.created_at)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Right Panel: Detail View ── */}
        <View style={s.rightPanel}>
          {!selected ? (
            <View style={s.noSelection}>
              <MessageCircle size={48} color="#334155" />
              <Text style={s.noSelectionText}>Nachricht auswählen</Text>
              <Text style={s.noSelectionSub}>Klicken Sie auf eine Nachricht, um die Details anzuzeigen</Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={s.detailHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.detailSubject}>{selected.subject}</Text>
                  <View style={s.detailMeta}>
                    <User size={14} color="#64748b" />
                    <Text style={s.detailMetaText}>{selected.sender_name}</Text>
                    <Mail size={14} color="#64748b" style={{ marginLeft: 12 }} />
                    <Text style={s.detailMetaText}>{selected.sender_email}</Text>
                  </View>
                  <View style={s.detailMeta}>
                    <Clock size={14} color="#64748b" />
                    <Text style={s.detailMetaText}>{formatDate(selected.created_at)}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setSelected(null)} style={s.closeBtn}>
                  <X size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Message Body */}
              <View style={s.msgBody}>
                <Text style={s.msgBodyText}>{selected.message}</Text>
              </View>

              {/* Status Selector */}
              <View style={s.section}>
                <Text style={s.sectionLabel}>Status ändern</Text>
                <View style={s.statusGrid}>
                  {ALL_STATUSES.map(st => {
                    const cfg = STATUS_CONFIG[st];
                    const active = selectedStatus === st;
                    return (
                      <TouchableOpacity
                        key={st}
                        style={[s.statusOption, active && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                        onPress={() => setSelectedStatus(st)}
                        activeOpacity={0.7}
                      >
                        <Circle size={10} color={active ? cfg.color : '#475569'} fill={active ? cfg.color : 'transparent'} />
                        <Text style={[s.statusOptionText, active && { color: cfg.color }]}>{cfg.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Admin Notes */}
              <View style={s.section}>
                <Text style={s.sectionLabel}>Interne Notizen</Text>
                <RNTextInput
                  style={s.notesInput}
                  value={adminNotes}
                  onChangeText={setAdminNotes}
                  placeholder="Notizen für das Team (nicht sichtbar für Nutzer)..."
                  placeholderTextColor="#475569"
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />
              </View>

              {/* Action Buttons */}
              <View style={s.detailActions}>
                <TouchableOpacity
                  style={[s.saveBtn, saving && s.saveBtnDisabled]}
                  onPress={saveChanges}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  {saving ? <ActivityIndicator size="small" color="#0f172a" /> : <><Save size={16} color="#0f172a" /><Text style={s.saveBtnText}>Speichern</Text></>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.deleteBtn}
                  onPress={() => deleteMessage(selected.id)}
                  activeOpacity={0.8}
                >
                  <Text style={s.deleteBtnText}>Löschen</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Status Actions */}
              <View style={s.quickActions}>
                <Text style={s.sectionLabel}>Schnellaktionen</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' as any }}>
                  {(['finished', 'action_required', 'redirected'] as MessageStatus[]).map(st => {
                    const cfg = STATUS_CONFIG[st];
                    return (
                      <TouchableOpacity
                        key={st}
                        style={[s.quickBtn, { borderColor: cfg.color, backgroundColor: cfg.bg }]}
                        onPress={() => {
                          setSelectedStatus(st);
                          updateStatus(selected.id, st, adminNotes);
                          showToast(`Status: ${cfg.label}`);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.quickBtnText, { color: cfg.color }]}>Als "{cfg.label}" markieren</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a', position: 'relative' as any },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toast: { position: 'absolute' as any, top: 16, right: 16, backgroundColor: '#10b981', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, zIndex: 9999, flexDirection: 'row', alignItems: 'center', gap: 8 },
  toastError: { backgroundColor: '#ef4444' },
  toastText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  body: { flex: 1, flexDirection: 'row', gap: 0 },

  // Left panel
  leftPanel: { width: 380, borderRightWidth: 1, borderRightColor: '#1e293b', paddingRight: 16, flexShrink: 0 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  statChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  statChipActive: { backgroundColor: '#38bdf820', borderColor: '#38bdf8' },
  statChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  statChipTextActive: { color: '#38bdf8' },
  searchInput: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#f1f5f9', marginBottom: 12 },
  msgList: { flex: 1 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: '#475569', fontSize: 15, fontWeight: '600' },

  // Message card
  msgCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#1e293b' },
  msgCardSelected: { borderColor: '#38bdf8', backgroundColor: '#38bdf808' },
  msgCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  senderInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#38bdf820', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#38bdf8' },
  senderName: { fontSize: 14, fontWeight: '700', color: '#f1f5f9' },
  senderEmail: { fontSize: 12, color: '#64748b' },
  msgSubject: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 4 },
  msgPreview: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 6 },
  msgDate: { fontSize: 11, color: '#475569' },

  // Right panel
  rightPanel: { flex: 1, paddingLeft: 24 },
  noSelection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  noSelectionText: { fontSize: 18, fontWeight: '700', color: '#475569' },
  noSelectionSub: { fontSize: 14, color: '#334155', textAlign: 'center' as any, maxWidth: 280 },

  // Detail
  detailHeader: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  detailSubject: { fontSize: 20, fontWeight: '700', color: '#f1f5f9', marginBottom: 8 },
  detailMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  detailMetaText: { fontSize: 13, color: '#64748b' },
  closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  msgBody: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  msgBodyText: { fontSize: 15, color: '#cbd5e1', lineHeight: 24 },

  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 10, textTransform: 'uppercase' as any, letterSpacing: 0.8 },

  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusOption: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  statusOptionText: { fontSize: 13, fontWeight: '600', color: '#64748b' },

  notesInput: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#f1f5f9', minHeight: 120, textAlignVertical: 'top' as any },

  detailActions: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#38bdf8', borderRadius: 10, paddingVertical: 13 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  deleteBtn: { paddingHorizontal: 20, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#ef444460', backgroundColor: '#ef444415', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: '#ef4444' },

  quickActions: { marginBottom: 30 },
  quickBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  quickBtnText: { fontSize: 13, fontWeight: '600' },
});
