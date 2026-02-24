import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LottieLoader } from '../components/LottieLoader';

import { LayoutContext } from '../layouts/LayoutContext';
import { colors } from '@docstruc/theme';
import { supabase } from '../lib/supabase';
import { FileText, ChevronLeft, Download, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HelpDocument {
  id: string; title: string; description: string; file_url: string; file_name: string; file_size_bytes: number; tags: string[];
}

function formatFileSize(bytes: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function HelpDocuments() {
  const { setTitle, setSubtitle } = useContext(LayoutContext);
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<HelpDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTitle('Dokumentation');
    setSubtitle('Vollständige Referenz & Downloads');
    return () => { setTitle('DocStruc'); setSubtitle(''); };
  }, [setTitle, setSubtitle]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('help_documents')
        .select('*')
        .eq('is_published', true)
        .order('sort_order');
      setDocuments(data || []);
      setLoading(false);
    };
    load();
  }, []);

  return (
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
            <FileText size={28} color="#fff" />
          </View>
          <Text style={styles.title}>Dokumentation</Text>
          <Text style={styles.subtitle}>
            Laden Sie unsere vollständigen Handbücher und Referenzdokumente herunter.
          </Text>
        </View>

        {loading ? (
          <View style={{ alignItems: 'center', padding: 48 }}>
            <LottieLoader size={120} />
          </View>
        ) : documents.length === 0 ? (
          <View style={styles.empty}>
            <FileText size={40} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Noch keine Dokumente verfügbar</Text>
            <Text style={styles.emptyText}>Schauen Sie bald wieder vorbei.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {documents.map(doc => (
              <TouchableOpacity
                key={doc.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => { if (doc.file_url) window.open(doc.file_url, '_blank'); }}
              >
                <View style={styles.cardIcon}>
                  <FileText size={22} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{doc.title}</Text>
                  {doc.description ? <Text style={styles.cardDesc} numberOfLines={2}>{doc.description}</Text> : null}
                  {doc.file_name ? (
                    <Text style={styles.cardMeta}>
                      {doc.file_name}{doc.file_size_bytes ? ` · ${formatFileSize(doc.file_size_bytes)}` : ''}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.downloadBtn}>
                  <Download size={18} color="#f59e0b" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* External link footer */}
        {documents.length > 0 && (
          <View style={styles.footer}>
            <ExternalLink size={16} color="#94a3b8" />
            <Text style={styles.footerText}>
              Alle Dokumente öffnen sich in einem neuen Tab. Für eine persönliche Beratung kontaktieren Sie uns über die Hilfe-Seite.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { maxWidth: 800, width: '100%', alignSelf: 'center', padding: 24 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 32, alignSelf: 'flex-start' as any, cursor: 'pointer' as any },
  backText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  header: { alignItems: 'center', marginBottom: 48 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 10, textAlign: 'center' as any },
  subtitle: { fontSize: 15, color: '#64748b', textAlign: 'center' as any, maxWidth: 540 },
  list: { gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#ffffff', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#f1f5f9', cursor: 'pointer' as any, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  cardIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#f59e0b20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#94a3b8' },
  downloadBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f59e0b15', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#64748b' },
  emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center' as any },
  footer: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 32, padding: 16, backgroundColor: '#f8fafc', borderRadius: 12 },
  footerText: { flex: 1, fontSize: 13, color: '#94a3b8', lineHeight: 20 },
});
