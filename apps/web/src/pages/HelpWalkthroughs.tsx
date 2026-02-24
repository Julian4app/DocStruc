import React, { useState, useEffect, useContext } from 'react';
import ReactDOM from 'react-dom';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LottieLoader } from '../components/LottieLoader';

import { LayoutContext } from '../layouts/LayoutContext';
import { colors } from '@docstruc/theme';
import { supabase } from '../lib/supabase';
import { BookOpen, ChevronLeft, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WalkthroughStep {
  id: string; title: string; description: string; image_url: string; step_order: number;
}
interface HelpWalkthrough {
  id: string; title: string; description: string; tags: string[]; steps: WalkthroughStep[];
}

// ─── Walkthrough Steps Viewer ─────────────────────────────────────────────────
function WalkthroughViewer({ wt, onClose }: { wt: HelpWalkthrough; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const steps = wt.steps || [];
  const cur = steps[step];

  const el = (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', padding: 24, borderBottom: '1px solid #f1f5f9', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{wt.title}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Schritt {step + 1} von {steps.length}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}><X size={20} color="#94a3b8" /></button>
        </div>
        {cur ? (
          <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
            {cur.image_url ? (
              <img src={cur.image_url} alt={cur.title} style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 12, marginBottom: 20 }} />
            ) : null}
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>{cur.title}</div>
            {cur.description ? <div style={{ fontSize: 15, color: '#475569', lineHeight: '24px' }}>{cur.description}</div> : null}
          </div>
        ) : <div style={{ padding: 24, color: '#475569', fontSize: 15 }}>Keine Schritte vorhanden.</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderTop: '1px solid #f1f5f9' }}>
          <button
            style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: 'none', cursor: step === 0 ? 'not-allowed' : 'pointer', opacity: step === 0 ? 0.4 : 1, fontSize: 14, fontWeight: 600, color: '#0f172a', fontFamily: 'inherit' }}
            onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
          >← Zurück</button>
          <div style={{ display: 'flex', gap: 6 }}>
            {steps.map((_, i) => (
              <div key={i} style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? colors.primary : '#e2e8f0', transition: 'width 0.2s' }} />
            ))}
          </div>
          {step < steps.length - 1 ? (
            <button style={{ padding: '10px 18px', borderRadius: 10, backgroundColor: colors.primary, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'inherit' }} onClick={() => setStep(s => s + 1)}>Weiter →</button>
          ) : (
            <button style={{ padding: '10px 18px', borderRadius: 10, backgroundColor: '#10b981', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'inherit' }} onClick={onClose}>Fertig ✓</button>
          )}
        </div>
      </div>
    </div>
  );
  return ReactDOM.createPortal(el, document.body) as any;
}

export function HelpWalkthroughs() {
  const { setTitle, setSubtitle } = useContext(LayoutContext);
  const navigate = useNavigate();
  const [walkthroughs, setWalkthroughs] = useState<HelpWalkthrough[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<HelpWalkthrough | null>(null);

  useEffect(() => {
    setTitle('Erste Schritte');
    setSubtitle('Schritt-für-Schritt Anleitungen für den Einstieg');
    return () => { setTitle('DocStruc'); setSubtitle(''); };
  }, [setTitle, setSubtitle]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('help_walkthroughs')
        .select('*, help_walkthrough_steps(*)')
        .eq('is_published', true)
        .order('sort_order');
      setWalkthroughs((data || []).map((w: any) => ({
        ...w,
        steps: (w.help_walkthrough_steps || []).sort((a: any, b: any) => a.step_order - b.step_order),
      })));
      setLoading(false);
    };
    load();
  }, []);

  return (
    <>
      {active && <WalkthroughViewer wt={active} onClose={() => setActive(null)} />}
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigate('/help')} activeOpacity={0.7}>
            <ChevronLeft size={18} color={colors.primary} />
            <Text style={styles.backText}>Zurück zur Hilfe</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <BookOpen size={28} color="#fff" />
            </View>
            <Text style={styles.title}>Erste Schritte</Text>
            <Text style={styles.subtitle}>
              Lernen Sie DocStruc Schritt für Schritt kennen – von der Einrichtung bis zur ersten Nutzung.
            </Text>
          </View>

          {loading ? (
            <View style={{ alignItems: 'center', padding: 48 }}>
              <LottieLoader size={120} />
            </View>
          ) : walkthroughs.length === 0 ? (
            <View style={styles.empty}>
              <BookOpen size={40} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Noch keine Anleitungen verfügbar</Text>
              <Text style={styles.emptyText}>Schauen Sie bald wieder vorbei.</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {walkthroughs.map((wt, i) => (
                <TouchableOpacity key={wt.id} style={styles.card} onPress={() => setActive(wt)} activeOpacity={0.7}>
                  <View style={styles.cardNumber}>
                    <Text style={styles.cardNumberText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{wt.title}</Text>
                    {wt.description ? <Text style={styles.cardDesc} numberOfLines={2}>{wt.description}</Text> : null}
                    <Text style={styles.cardMeta}>{wt.steps?.length || 0} Schritte</Text>
                  </View>
                  <ChevronRight size={20} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { maxWidth: 800, width: '100%', alignSelf: 'center', padding: 24 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 32, alignSelf: 'flex-start' as any, cursor: 'pointer' as any },
  backText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  header: { alignItems: 'center', marginBottom: 48 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 10, textAlign: 'center' as any },
  subtitle: { fontSize: 15, color: '#64748b', textAlign: 'center' as any, maxWidth: 540 },
  grid: { gap: 14 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#ffffff', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#f1f5f9', cursor: 'pointer' as any, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  cardNumber: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f620', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardNumberText: { fontSize: 16, fontWeight: '800', color: '#3b82f6' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#64748b', marginBottom: 6 },
  cardMeta: { fontSize: 12, fontWeight: '600', color: '#3b82f6' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#64748b' },
  emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center' as any },
});
