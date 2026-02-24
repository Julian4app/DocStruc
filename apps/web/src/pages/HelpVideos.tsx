import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LottieLoader } from '../components/LottieLoader';

import { LayoutContext } from '../layouts/LayoutContext';
import { colors } from '@docstruc/theme';
import { supabase } from '../lib/supabase';
import { Video, ChevronLeft, Play } from 'lucide-react';
import { TouchableOpacity } from 'react-native';
import { useNavigate } from 'react-router-dom';

interface HelpVideo {
  id: string; title: string; description: string; video_url: string; thumbnail_url: string; tags: string[];
}

function getYouTubeEmbedUrl(url: string) {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  return url;
}

export function HelpVideos() {
  const { setTitle, setSubtitle } = useContext(LayoutContext);
  const navigate = useNavigate();
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTitle('Video Tutorials');
    setSubtitle('Visuelle Anleitungen für alle Funktionen');
    return () => { setTitle('DocStruc'); setSubtitle(''); };
  }, [setTitle, setSubtitle]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('help_videos')
        .select('*')
        .eq('is_published', true)
        .order('sort_order');
      setVideos(data || []);
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
            <Video size={28} color="#fff" />
          </View>
          <Text style={styles.title}>Video Tutorials</Text>
          <Text style={styles.subtitle}>
            Schauen Sie sich unsere Video-Anleitungen an und lernen Sie alle Funktionen von DocStruc kennen.
          </Text>
        </View>

        {loading ? (
          <View style={{ alignItems: 'center', padding: 48 }}>
            <LottieLoader size={120} />
          </View>
        ) : videos.length === 0 ? (
          <View style={styles.empty}>
            <Video size={40} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Noch keine Videos verfügbar</Text>
            <Text style={styles.emptyText}>Schauen Sie bald wieder vorbei.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {videos.map(vid => (
              <View key={vid.id} style={styles.card}>
                {vid.video_url ? (
                  <iframe
                    src={getYouTubeEmbedUrl(vid.video_url)}
                    style={{ width: '100%', height: 220, borderRadius: 12, border: 'none', marginBottom: 16 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : vid.thumbnail_url ? (
                  <img src={vid.thumbnail_url} style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 12, marginBottom: 16 }} />
                ) : (
                  <View style={styles.placeholder}>
                    <Play size={36} color="#8b5cf6" />
                  </View>
                )}
                <Text style={styles.cardTitle}>{vid.title}</Text>
                {vid.description ? <Text style={styles.cardDesc}>{vid.description}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { maxWidth: 1000, width: '100%', alignSelf: 'center', padding: 24 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 32, alignSelf: 'flex-start' as any, cursor: 'pointer' as any },
  backText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  header: { alignItems: 'center', marginBottom: 48 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#8b5cf6', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 10, textAlign: 'center' as any },
  subtitle: { fontSize: 15, color: '#64748b', textAlign: 'center' as any, maxWidth: 540 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  card: { flex: 1, minWidth: 280, backgroundColor: '#ffffff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#f1f5f9' },
  placeholder: { width: '100%', height: 180, backgroundColor: '#8b5cf610', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  cardDesc: { fontSize: 13, color: '#64748b', lineHeight: 20 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#64748b' },
  emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center' as any },
});
