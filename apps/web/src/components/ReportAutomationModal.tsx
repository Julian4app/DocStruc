import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Switch,
} from 'react-native';
import {
  Mail,
  Plus,
  Trash2,
  Calendar,
  Clock,
  CheckSquare,
  Square,
  ChevronDown,
  Zap,
} from 'lucide-react';
import { ModernModal } from './ModernModal';
import { Button } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './ToastProvider';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReportTemplate {
  id: string;
  title: string;
}

type ScheduleType = 'monthly_first' | 'quarterly_first' | 'weekly_monday' | 'custom_day';
type ExportFormat = 'pdf' | 'csv';

interface Automation {
  id: string;
  project_id: string;
  report_ids: string[];
  schedule_type: ScheduleType;
  custom_day: number | null;
  export_format: ExportFormat;
  is_active: boolean;
  recipient_email: string | null;
  label: string | null;
  last_sent_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  reportTemplates: ReportTemplate[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SCHEDULE_OPTIONS: { value: ScheduleType; label: string; description: string }[] = [
  {
    value: 'monthly_first',
    label: 'Monatlich (1. des Monats)',
    description: 'Daten des vergangenen Kalendermonats',
  },
  {
    value: 'quarterly_first',
    label: 'Quartalsweise (1. des Quartals)',
    description: 'Daten des vergangenen Kalenderquartals',
  },
  {
    value: 'weekly_monday',
    label: 'Wöchentlich (jeden Montag)',
    description: 'Daten der vergangenen Kalenderwoche',
  },
  {
    value: 'custom_day',
    label: 'Individuell (eigener Tag)',
    description: 'Jeden Monat an einem frei gewählten Tag',
  },
];

const FORMAT_OPTIONS: { value: ExportFormat; label: string; color: string }[] = [
  { value: 'pdf', label: 'PDF', color: '#DC2626' },
  { value: 'csv', label: 'CSV', color: '#3B82F6' },
];

/** Returns a human-readable description of when the next report fires. */
function scheduleDescription(s: ScheduleType, customDay?: number | null): string {
  switch (s) {
    case 'monthly_first':   return 'Am 1. jeden Monats für den Vormonat';
    case 'quarterly_first': return 'Am 1. jedes Quartals für das Vorquartal';
    case 'weekly_monday':   return 'Jeden Montag für die Vorwoche';
    case 'custom_day':
      return customDay ? `Am ${customDay}. jeden Monats für den Vormonat` : 'Tag noch nicht gewählt';
    default: return '';
  }
}

/** Compute next run date (client-side preview, not authoritative). */
function nextRunPreview(schedule: ScheduleType, customDay?: number | null): string {
  const now = new Date();
  let next: Date;
  switch (schedule) {
    case 'monthly_first': {
      next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    }
    case 'quarterly_first': {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
      next = new Date(now.getFullYear(), qStartMonth + 3, 1);
      break;
    }
    case 'weekly_monday': {
      const day = now.getDay(); // 0=Sun, 1=Mon ...
      const daysUntilMonday = day === 0 ? 1 : 8 - day;
      next = new Date(now);
      next.setDate(now.getDate() + daysUntilMonday);
      break;
    }
    case 'custom_day': {
      const d = customDay ?? 1;
      next = new Date(now.getFullYear(), now.getMonth() + (now.getDate() >= d ? 1 : 0), d);
      break;
    }
    default: return '-';
  }
  return next.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// ── Empty-state form (new automation) ────────────────────────────────────────

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

interface AutomationFormProps {
  templates: ReportTemplate[];
  userEmail: string;
  onSave: (data: Omit<Automation, 'id' | 'created_at' | 'last_sent_at' | 'next_run_at' | 'project_id'>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  initial?: Automation;
}

function AutomationForm({ templates, userEmail, onSave, onCancel, saving, initial }: AutomationFormProps) {
  const [selectedReports, setSelectedReports] = useState<string[]>(initial?.report_ids ?? []);
  const [schedule, setSchedule]               = useState<ScheduleType>(initial?.schedule_type ?? 'monthly_first');
  const [customDay, setCustomDay]             = useState<number>(initial?.custom_day ?? 1);
  const [format, setFormat]                   = useState<ExportFormat>(initial?.export_format ?? 'pdf');
  const [email, setEmail]                     = useState<string>(initial?.recipient_email ?? userEmail);
  const [label, setLabel]                     = useState<string>(initial?.label ?? '');
  const [showDayPicker, setShowDayPicker]     = useState(false);

  const toggleReport = (id: string) => {
    setSelectedReports(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const canSave = selectedReports.length > 0 && email.length > 2 &&
    (schedule !== 'custom_day' || customDay >= 1);

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      report_ids:      selectedReports,
      schedule_type:   schedule,
      custom_day:      schedule === 'custom_day' ? customDay : null,
      export_format:   format,
      is_active:       true,
      recipient_email: email,
      label:           label || null,
    });
  };

  return (
    <View style={formStyles.container}>
      {/* Label */}
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Bezeichnung (optional)</Text>
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="z. B. Monatsbericht für Bauleiter"
          style={inputStyle}
        />
      </View>

      {/* Report selection */}
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Reports auswählen *</Text>
        <View style={formStyles.checkGrid}>
          {templates.map(t => {
            const checked = selectedReports.includes(t.id);
            return (
              <TouchableOpacity
                key={t.id}
                style={[formStyles.checkItem, checked && formStyles.checkItemActive]}
                onPress={() => toggleReport(t.id)}
              >
                {checked
                  ? <CheckSquare size={16} color={colors.primary} />
                  : <Square      size={16} color="#94A3B8" />
                }
                <Text style={[formStyles.checkLabel, checked && formStyles.checkLabelActive]}>
                  {t.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {selectedReports.length === 0 && (
          <Text style={formStyles.hint}>Mindestens einen Report auswählen</Text>
        )}
      </View>

      {/* Schedule */}
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Versand-Rhythmus *</Text>
        <View style={formStyles.scheduleGrid}>
          {SCHEDULE_OPTIONS.map(opt => {
            const active = schedule === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[formStyles.scheduleItem, active && formStyles.scheduleItemActive]}
                onPress={() => setSchedule(opt.value)}
              >
                <View style={formStyles.scheduleRow}>
                  <Calendar size={14} color={active ? colors.primary : '#94A3B8'} />
                  <Text style={[formStyles.scheduleLabel, active && formStyles.scheduleLabelActive]}>
                    {opt.label}
                  </Text>
                </View>
                <Text style={formStyles.scheduleDesc}>{opt.description}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom day picker */}
        {schedule === 'custom_day' && (
          <View style={formStyles.customDayWrap}>
            <Text style={formStyles.customDayLabel}>Tag des Monats:</Text>
            <TouchableOpacity
              style={formStyles.customDayBtn}
              onPress={() => setShowDayPicker(p => !p)}
            >
              <Text style={formStyles.customDayValue}>{customDay}.</Text>
              <ChevronDown size={14} color="#64748B" />
            </TouchableOpacity>
            {showDayPicker && (
              <View style={formStyles.dayGrid}>
                {DAYS.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[formStyles.dayCell, d === customDay && formStyles.dayCellActive]}
                    onPress={() => { setCustomDay(d); setShowDayPicker(false); }}
                  >
                    <Text style={[formStyles.dayCellText, d === customDay && formStyles.dayCellTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Next run preview */}
        <View style={formStyles.previewBadge}>
          <Clock size={13} color="#0EA5E9" />
          <Text style={formStyles.previewText}>
            Nächster Versand: <Text style={{ fontWeight: '700' }}>
              {nextRunPreview(schedule, customDay)}
            </Text>
          </Text>
        </View>
      </View>

      {/* Format */}
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Dateiformat</Text>
        <View style={formStyles.formatRow}>
          {FORMAT_OPTIONS.map(f => (
            <TouchableOpacity
              key={f.value}
              style={[formStyles.formatBtn, format === f.value && formStyles.formatBtnActive]}
              onPress={() => setFormat(f.value)}
            >
              <View style={[formStyles.formatBadge, { backgroundColor: f.color }]}>
                <Text style={formStyles.formatBadgeText}>{f.label}</Text>
              </View>
              <Text style={[formStyles.formatLabel, format === f.value && formStyles.formatLabelActive]}>
                {f.value === 'pdf' ? 'Druckbares Dokument' : 'Tabellendaten'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Email */}
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Empfänger-E-Mail *</Text>
        <View style={formStyles.emailRow}>
          <Mail size={16} color="#94A3B8" />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@beispiel.de"
            style={{ ...inputStyle, flex: 1, marginLeft: 8 }}
          />
        </View>
      </View>

      {/* Actions */}
      <View style={formStyles.actions}>
        <Button variant="outline" onClick={onCancel} style={{ flex: 1 }}>
          Abbrechen
        </Button>
        <Button onClick={handleSave} disabled={!canSave || saving} style={{ flex: 1 }}>
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <><Zap size={15} /> Automatisierung speichern</>
          }
        </Button>
      </View>
    </View>
  );
}

// ── Automation list item ──────────────────────────────────────────────────────

interface AutomationItemProps {
  automation: Automation;
  templates: ReportTemplate[];
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}

function AutomationItem({ automation, templates, onToggle, onDelete }: AutomationItemProps) {
  const reportNames = automation.report_ids
    .map(rid => templates.find(t => t.id === rid)?.title ?? rid)
    .join(', ');

  const schedOpt = SCHEDULE_OPTIONS.find(s => s.value === automation.schedule_type);

  return (
    <View style={[itemStyles.card, !automation.is_active && itemStyles.cardInactive]}>
      <View style={itemStyles.top}>
        {/* Title / label */}
        <View style={itemStyles.titleRow}>
          <Zap size={16} color={automation.is_active ? colors.primary : '#94A3B8'} />
          <Text style={[itemStyles.title, !automation.is_active && itemStyles.titleInactive]}>
            {automation.label || schedOpt?.label || 'Automatisierung'}
          </Text>
          <View style={[itemStyles.fmtBadge, { backgroundColor: automation.export_format === 'pdf' ? '#DC2626' : '#3B82F6' }]}>
            <Text style={itemStyles.fmtText}>{automation.export_format.toUpperCase()}</Text>
          </View>
        </View>

        {/* Active toggle */}
        <Switch
          value={automation.is_active}
          onValueChange={v => onToggle(automation.id, v)}
          trackColor={{ true: colors.primary, false: '#E2E8F0' }}
          thumbColor="#fff"
        />
      </View>

      {/* Meta */}
      <Text style={itemStyles.meta} numberOfLines={2}>
        📋 {reportNames || '—'}
      </Text>
      <View style={itemStyles.bottomRow}>
        <View style={itemStyles.schedBadge}>
          <Calendar size={12} color="#64748B" />
          <Text style={itemStyles.schedText}>{schedOpt?.label}</Text>
        </View>
        <View style={itemStyles.schedBadge}>
          <Mail size={12} color="#64748B" />
          <Text style={itemStyles.schedText}>{automation.recipient_email ?? '—'}</Text>
        </View>
      </View>
      <View style={itemStyles.dateRow}>
        <Text style={itemStyles.dateText}>
          Nächster Versand: <Text style={{ fontWeight: '600' }}>{fmtDate(automation.next_run_at)}</Text>
        </Text>
        {automation.last_sent_at && (
          <Text style={itemStyles.dateText}>
            Zuletzt: <Text style={{ fontWeight: '600' }}>{fmtDate(automation.last_sent_at)}</Text>
          </Text>
        )}
      </View>

      {/* Delete */}
      <TouchableOpacity style={itemStyles.deleteBtn} onPress={() => onDelete(automation.id)}>
        <Trash2 size={14} color="#EF4444" />
        <Text style={itemStyles.deleteText}>Löschen</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function ReportAutomationModal({ visible, onClose, projectId, reportTemplates }: Props) {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [showForm, setShowForm]       = useState(false);

  // Load automations for this project / user
  useEffect(() => {
    if (visible && projectId) loadAutomations();
  }, [visible, projectId]);

  const loadAutomations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('report_automations')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAutomations(data ?? []);
    } catch (e: any) {
      showToast(e.message || 'Fehler beim Laden', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (
    data: Omit<Automation, 'id' | 'created_at' | 'last_sent_at' | 'next_run_at' | 'project_id'>
  ) => {
    setSaving(true);
    try {
      // Compute next_run_at server-side preview
      const nextRun = computeNextRun(data.schedule_type, data.custom_day);

      const { error } = await supabase.from('report_automations').insert({
        ...data,
        project_id: projectId,
        next_run_at: nextRun.toISOString(),
      });
      if (error) throw error;
      showToast('Automatisierung gespeichert!', 'success');
      setShowForm(false);
      loadAutomations();
    } catch (e: any) {
      showToast(e.message || 'Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('report_automations')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, is_active: isActive } : a));
    } catch (e: any) {
      showToast(e.message || 'Fehler beim Aktualisieren', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Automatisierung wirklich löschen?')) return;
    try {
      const { error } = await supabase.from('report_automations').delete().eq('id', id);
      if (error) throw error;
      setAutomations(prev => prev.filter(a => a.id !== id));
      showToast('Automatisierung gelöscht', 'success');
    } catch (e: any) {
      showToast(e.message || 'Fehler beim Löschen', 'error');
    }
  };

  return (
    <ModernModal
      visible={visible}
      onClose={() => { setShowForm(false); onClose(); }}
      title="Report-Automatisierung"
      maxWidth={680}
    >
      <View style={modalStyles.root}>
        {/* Info banner */}
        <View style={modalStyles.infoBanner}>
          <Zap size={16} color="#0EA5E9" />
          <Text style={modalStyles.infoText}>
            Legen Sie fest, welche Reports automatisch an Ihre E-Mail-Adresse versendet werden sollen —
            monatlich, quartalsweise oder wöchentlich.
          </Text>
        </View>

        {loading ? (
          <View style={modalStyles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : showForm ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <AutomationForm
              templates={reportTemplates}
              userEmail={profile?.email ?? ''}
              onSave={handleSave}
              onCancel={() => setShowForm(false)}
              saving={saving}
            />
          </ScrollView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            {automations.length === 0 ? (
              <View style={modalStyles.empty}>
                <Mail size={48} color="#CBD5E1" />
                <Text style={modalStyles.emptyTitle}>Noch keine Automatisierungen</Text>
                <Text style={modalStyles.emptyDesc}>
                  Erstellen Sie Ihre erste automatische Report-Versendung.
                </Text>
              </View>
            ) : (
              <View style={modalStyles.list}>
                {automations.map(a => (
                  <AutomationItem
                    key={a.id}
                    automation={a}
                    templates={reportTemplates}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </View>
            )}

            {/* Add new button */}
            <TouchableOpacity
              style={modalStyles.addBtn}
              onPress={() => setShowForm(true)}
            >
              <Plus size={18} color={colors.primary} />
              <Text style={modalStyles.addBtnText}>Neue Automatisierung hinzufügen</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </ModernModal>
  );
}

// ── Next-run computation ──────────────────────────────────────────────────────

function computeNextRun(schedule: ScheduleType, customDay?: number | null): Date {
  const now = new Date();
  switch (schedule) {
    case 'monthly_first': {
      return new Date(now.getFullYear(), now.getMonth() + 1, 1, 6, 0, 0);
    }
    case 'quarterly_first': {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return new Date(now.getFullYear(), qStartMonth + 3, 1, 6, 0, 0);
    }
    case 'weekly_monday': {
      const day = now.getDay();
      const daysUntilMonday = day === 0 ? 1 : 8 - day;
      const d = new Date(now);
      d.setDate(now.getDate() + daysUntilMonday);
      d.setHours(6, 0, 0, 0);
      return d;
    }
    case 'custom_day': {
      const cd = customDay ?? 1;
      const month = now.getDate() >= cd ? now.getMonth() + 1 : now.getMonth();
      return new Date(now.getFullYear(), month, cd, 6, 0, 0);
    }
    default: return new Date();
  }
}

// ── Shared input style ────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #E2E8F0',
  borderRadius: 8,
  fontSize: 14,
  color: '#0F172A',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  backgroundColor: '#F8FAFC',
};

// ── Styles ────────────────────────────────────────────────────────────────────

const modalStyles = StyleSheet.create({
  root:       { gap: 16 },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12 },
  infoText:   { flex: 1, fontSize: 13, color: '#0369A1', lineHeight: 18 },
  loading:    { alignItems: 'center', padding: 32 },
  empty:      { alignItems: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#334155' },
  emptyDesc:  { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
  list:       { gap: 12 },
  addBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 14, borderWidth: 2, borderStyle: 'dashed' as any, borderColor: '#CBD5E1', borderRadius: 12 },
  addBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
});

const itemStyles = StyleSheet.create({
  card:          { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 16, gap: 8 },
  cardInactive:  { opacity: 0.6 },
  top:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  title:         { fontSize: 15, fontWeight: '700', color: '#0F172A', flex: 1 },
  titleInactive: { color: '#94A3B8' },
  fmtBadge:      { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  fmtText:       { fontSize: 10, fontWeight: '700', color: '#fff' },
  meta:          { fontSize: 13, color: '#475569', lineHeight: 18 },
  bottomRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  schedBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  schedText:     { fontSize: 12, color: '#64748B' },
  dateRow:       { flexDirection: 'row', justifyContent: 'space-between' },
  dateText:      { fontSize: 12, color: '#94A3B8' },
  deleteBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', paddingVertical: 4 },
  deleteText:    { fontSize: 12, color: '#EF4444', fontWeight: '600' },
});

const formStyles = StyleSheet.create({
  container:          { gap: 20 },
  field:              { gap: 6 },
  label:              { fontSize: 13, fontWeight: '700', color: '#334155' },
  hint:               { fontSize: 12, color: '#EF4444', marginTop: 4 },
  checkGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checkItem:          { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#F8FAFC' },
  checkItemActive:    { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  checkLabel:         { fontSize: 13, color: '#475569' },
  checkLabelActive:   { color: colors.primary, fontWeight: '600' },
  scheduleGrid:       { gap: 8 },
  scheduleItem:       { padding: 12, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10, backgroundColor: '#F8FAFC' },
  scheduleItemActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  scheduleRow:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  scheduleLabel:      { fontSize: 14, fontWeight: '600', color: '#334155' },
  scheduleLabelActive:{ color: colors.primary },
  scheduleDesc:       { fontSize: 12, color: '#94A3B8' },
  customDayWrap:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  customDayLabel:     { fontSize: 13, color: '#475569', fontWeight: '600' },
  customDayBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#fff' },
  customDayValue:     { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  dayGrid:            { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  dayCell:            { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#F8FAFC' },
  dayCellActive:      { backgroundColor: colors.primary, borderColor: colors.primary },
  dayCellText:        { fontSize: 13, color: '#475569' },
  dayCellTextActive:  { color: '#fff', fontWeight: '700' },
  previewBadge:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#F0F9FF', padding: 10, borderRadius: 8 },
  previewText:        { fontSize: 13, color: '#0369A1' },
  formatRow:          { flexDirection: 'row', gap: 10 },
  formatBtn:          { flex: 1, alignItems: 'center', gap: 6, padding: 12, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10, backgroundColor: '#F8FAFC' },
  formatBtnActive:    { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  formatBadge:        { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 5 },
  formatBadgeText:    { fontSize: 12, fontWeight: '800', color: '#fff' },
  formatLabel:        { fontSize: 12, color: '#64748B', textAlign: 'center' },
  formatLabelActive:  { color: colors.primary, fontWeight: '600' },
  emailRow:           { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 10, backgroundColor: '#F8FAFC' },
  actions:            { flexDirection: 'row', gap: 12, marginTop: 8 },
});
