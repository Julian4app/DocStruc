import React, { useState, useEffect, useContext, useRef } from 'react';
import ReactDOM from 'react-dom';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput as RNTextInput, ActivityIndicator } from 'react-native';
import { LayoutContext } from '../layouts/LayoutContext';
import { useNavigate } from 'react-router-dom';
import { colors } from '@docstruc/theme';
import { supabase } from '../lib/supabase';
import {
  HelpCircle,
  Search,
  BookOpen,
  Video,
  MessageCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Download,
  X,
  Send,
  Tag,
  Play,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface HelpTag { id: string; name: string; color: string; }
interface HelpFaq { id: string; question: string; answer: string; tags: string[]; }
interface WalkthroughStep { id: string; title: string; description: string; image_url: string; step_order: number; }
interface HelpWalkthrough { id: string; title: string; description: string; tags: string[]; steps: WalkthroughStep[]; }
interface HelpVideo { id: string; title: string; description: string; video_url: string; thumbnail_url: string; tags: string[]; }
interface HelpDocument { id: string; title: string; description: string; file_url: string; file_name: string; file_size_bytes: number; tags: string[]; }

type SectionId = 'walkthroughs' | 'videos' | 'faqs' | 'documents' | null;

// ─── Contact Modal ─────────────────────────────────────────────────────────────
function ContactModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setSent(false);
      setError('');
      // Pre-fill from user session if logged in
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setForm(f => ({ ...f, email: user.email || '' }));
          supabase.from('profiles').select('first_name, last_name').eq('id', user.id).single().then(({ data }) => {
            if (data) setForm(f => ({ ...f, name: `${data.first_name || ''} ${data.last_name || ''}`.trim() }));
          });
        }
      });
    }
  }, [visible]);

  const send = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      setError('Bitte füllen Sie alle Felder aus.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: err } = await supabase.from('support_messages').insert({
        user_id: user?.id || null,
        sender_name: form.name,
        sender_email: form.email,
        subject: form.subject,
        message: form.message,
        status: 'open',
      });
      if (err) throw err;
      setSent(true);
      setTimeout(onClose, 2500);
    } catch (e: any) {
      setError(e.message || 'Fehler beim Senden');
    } finally {
      setSending(false);
    }
  };

  if (!visible) return null;

  const el = (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Support kontaktieren</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}><X size={20} color="#94a3b8" /></button>
        </div>
        {sent ? (
          <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 40 }}>✓</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Nachricht gesendet!</span>
            <span style={{ fontSize: 15, color: '#64748b', textAlign: 'center' }}>Wir melden uns so schnell wie möglich bei Ihnen.</span>
          </div>
        ) : (
          <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
            {error ? <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 14 }}>{error}</div> : null}
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 6, marginTop: 12 }}>Ihr Name *</label>
            <input style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 15, color: '#0f172a', outline: 'none' }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Max Mustermann" />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 6, marginTop: 12 }}>E-Mail *</label>
            <input type="email" style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 15, color: '#0f172a', outline: 'none' }} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="max@firma.de" />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 6, marginTop: 12 }}>Betreff *</label>
            <input style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 15, color: '#0f172a', outline: 'none' }} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Worum geht es?" />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 6, marginTop: 12 }}>Nachricht *</label>
            <textarea style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 15, color: '#0f172a', outline: 'none', resize: 'vertical', minHeight: 120, fontFamily: 'inherit', lineHeight: '1.5' }} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Beschreiben Sie Ihr Anliegen..." rows={5} />
            <button
              onClick={send}
              disabled={sending}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, color: '#fff', border: 'none', borderRadius: 12, padding: '14px 0', width: '100%', fontSize: 15, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', marginTop: 20, opacity: sending ? 0.6 : 1, fontFamily: 'inherit' }}
            >
              {sending ? '...' : <><Send size={16} color="#fff" /><span>Nachricht senden</span></>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
  return ReactDOM.createPortal(el, document.body) as any;
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


export function Help() {
  const { setTitle, setSubtitle } = useContext(LayoutContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>(null);
  const [contactVisible, setContactVisible] = useState(false);
  const [activeWalkthrough, setActiveWalkthrough] = useState<HelpWalkthrough | null>(null);
  const navigate = useNavigate();

  // Data
  const [tags, setTags] = useState<HelpTag[]>([]);
  const [faqs, setFaqs] = useState<HelpFaq[]>([]);
  const [walkthroughs, setWalkthroughs] = useState<HelpWalkthrough[]>([]);
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [documents, setDocuments] = useState<HelpDocument[]>([]);
  const [loading, setLoading] = useState(true);

  // Section refs for scroll
  const walkthroughsRef = useRef<any>(null);
  const videosRef = useRef<any>(null);
  const faqsRef = useRef<any>(null);
  const documentsRef = useRef<any>(null);

  useEffect(() => {
    setTitle('Hilfe Center');
    setSubtitle('Finden Sie Antworten und Anleitungen');
    return () => { setTitle('DocStruc'); setSubtitle(''); };
  }, [setTitle, setSubtitle]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [tagsRes, faqRes, walkRes, vidRes, docRes] = await Promise.all([
        supabase.from('help_tags').select('*').order('name'),
        supabase.from('help_faqs').select('*').eq('is_published', true).order('sort_order'),
        supabase.from('help_walkthroughs').select('*, help_walkthrough_steps(*)').eq('is_published', true).order('sort_order'),
        supabase.from('help_videos').select('*').eq('is_published', true).order('sort_order'),
        supabase.from('help_documents').select('*').eq('is_published', true).order('sort_order'),
      ]);
      setTags(tagsRes.data || []);
      setFaqs(faqRes.data || []);
      setWalkthroughs((walkRes.data || []).map((w: any) => ({
        ...w,
        steps: (w.help_walkthrough_steps || []).sort((a: any, b: any) => a.step_order - b.step_order),
      })));
      setVideos(vidRes.data || []);
      setDocuments(docRes.data || []);
      setLoading(false);
    };
    load();
  }, []);

  // Filter helpers
  const matchesFilter = (itemTags: string[]) =>
    !activeTag || itemTags.includes(activeTag);

  const matchesSearch = (texts: string[]) =>
    !searchQuery || texts.some(t => t?.toLowerCase().includes(searchQuery.toLowerCase()));

  const filteredFaqs = faqs.filter(f =>
    matchesFilter(f.tags || []) && matchesSearch([f.question, f.answer])
  );
  const filteredWalkthroughs = walkthroughs.filter(w =>
    matchesFilter(w.tags || []) && matchesSearch([w.title, w.description])
  );
  const filteredVideos = videos.filter(v =>
    matchesFilter(v.tags || []) && matchesSearch([v.title, v.description])
  );
  const filteredDocuments = documents.filter(d =>
    matchesFilter(d.tags || []) && matchesSearch([d.title, d.description])
  );

  const scrollTo = (ref: any) => {
    if (ref?.current?.scrollIntoView) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (ref?.current?.measureLayout) {
      // RN scroll handled by parent
    }
  };

  const quickLinks = [
    {
      icon: BookOpen, title: 'Erste Schritte', desc: 'Schritt-für-Schritt Anleitungen', color: '#3b82f6',
      onPress: () => navigate('/help/erste-schritte'),
    },
    {
      icon: Video, title: 'Video Tutorials', desc: 'Visuelle Schritt-für-Schritt Guides', color: '#8b5cf6',
      onPress: () => navigate('/help/video-tutorials'),
    },
    {
      icon: MessageCircle, title: 'Support kontaktieren', desc: 'Persönliche Hilfe erhalten', color: '#10b981',
      onPress: () => setContactVisible(true),
    },
    {
      icon: FileText, title: 'Dokumentation', desc: 'Vollständige Referenz & Downloads', color: '#f59e0b',
      onPress: () => navigate('/help/dokumentation'),
    },
  ];

  const getYouTubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
    return url;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      {/* Contact Modal */}
      <ContactModal visible={contactVisible} onClose={() => setContactVisible(false)} />

      {/* Walkthrough Viewer */}
      {activeWalkthrough && (
        <WalkthroughViewer wt={activeWalkthrough} onClose={() => setActiveWalkthrough(null)} />
      )}

      <ScrollView style={styles.container}>
        <View style={styles.content}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <HelpCircle size={32} color="#fff" />
            </View>
            <Text style={styles.title}>Wie können wir helfen?</Text>
            <Text style={styles.subtitle}>
              Durchsuchen Sie unsere Wissensdatenbank oder kontaktieren Sie unser Support-Team
            </Text>
            <View style={styles.searchBar}>
              <Search size={20} color="#94a3b8" />
              <RNTextInput
                style={styles.searchInput as any}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Suchen Sie nach Themen oder Fragen..."
                placeholderTextColor="#94a3b8"
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={18} color="#94a3b8" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* ── Quick Links ── */}
          <View style={styles.quickLinksGrid}>
            {quickLinks.map((link, index) => {
              const Icon = link.icon;
              return (
                <TouchableOpacity key={index} style={styles.quickLinkCard} onPress={link.onPress} activeOpacity={0.7}>
                  <View style={[styles.quickLinkIcon, { backgroundColor: link.color + '20' }]}>
                    <Icon size={24} color={link.color} />
                  </View>
                  <Text style={styles.quickLinkTitle}>{link.title}</Text>
                  <Text style={styles.quickLinkDesc}>{link.desc}</Text>
                  <ChevronRight size={18} color="#94a3b8" style={{ marginTop: 8 }} />
                </TouchableOpacity>
              );
            })}
          </View>

          {loading ? (
            <View style={{ alignItems: 'center', padding: 48 }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <>
              {/* ── Tag Categories ── */}
              {tags.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Kategorien durchsuchen</Text>
                  <View style={styles.tagsRow}>
                    <TouchableOpacity
                      style={[styles.tagChip, !activeTag && styles.tagChipActive]}
                      onPress={() => setActiveTag(null)}
                      activeOpacity={0.7}
                    >
                      <Tag size={14} color={!activeTag ? '#fff' : '#64748b'} />
                      <Text style={[styles.tagChipText, !activeTag && styles.tagChipTextActive]}>Alle</Text>
                    </TouchableOpacity>
                    {tags.map(tag => {
                      const isActive = activeTag === tag.name;
                      return (
                        <TouchableOpacity
                          key={tag.id}
                          style={[styles.tagChip, isActive && { backgroundColor: tag.color, borderColor: tag.color }]}
                          onPress={() => setActiveTag(isActive ? null : tag.name)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.tagChipText, isActive && styles.tagChipTextActive]}>{tag.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* ── Walkthroughs ── */}
              {filteredWalkthroughs.length > 0 && (
                <View style={styles.section} ref={walkthroughsRef}>
                  <Text style={styles.sectionTitle}>Erste Schritte</Text>
                  <View style={styles.cardGrid}>
                    {filteredWalkthroughs.map(wt => (
                      <TouchableOpacity key={wt.id} style={styles.wtCard} onPress={() => setActiveWalkthrough(wt)} activeOpacity={0.7}>
                        <View style={styles.wtIconWrap}>
                          <BookOpen size={22} color="#3b82f6" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.wtTitle}>{wt.title}</Text>
                          {wt.description ? <Text style={styles.wtDesc} numberOfLines={2}>{wt.description}</Text> : null}
                          <Text style={styles.wtSteps}>{wt.steps?.length || 0} Schritte</Text>
                        </View>
                        <ChevronRight size={18} color="#94a3b8" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* ── Videos ── */}
              {filteredVideos.length > 0 && (
                <View style={styles.section} ref={videosRef}>
                  <Text style={styles.sectionTitle}>Video Tutorials</Text>
                  <View style={styles.videoGrid}>
                    {filteredVideos.map(vid => (
                      <View key={vid.id} style={styles.videoCard}>
                        {vid.video_url ? (
                          <iframe
                            src={getYouTubeEmbedUrl(vid.video_url)}
                            style={{ width: '100%', height: 200, borderRadius: 10, border: 'none', marginBottom: 14 }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : vid.thumbnail_url ? (
                          <img src={vid.thumbnail_url} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 10, marginBottom: 14 }} />
                        ) : (
                          <View style={styles.videoPlaceholder}>
                            <Play size={32} color="#8b5cf6" />
                          </View>
                        )}
                        <Text style={styles.videoTitle}>{vid.title}</Text>
                        {vid.description ? <Text style={styles.videoDesc} numberOfLines={3}>{vid.description}</Text> : null}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* ── FAQs ── */}
              {filteredFaqs.length > 0 && (
                <View style={styles.section} ref={faqsRef}>
                  <Text style={styles.sectionTitle}>Häufig gestellte Fragen</Text>
                  <View style={styles.faqList}>
                    {filteredFaqs.map(faq => {
                      const open = expandedFaq === faq.id;
                      return (
                        <TouchableOpacity
                          key={faq.id}
                          style={[styles.faqItem, open && styles.faqItemOpen]}
                          activeOpacity={0.7}
                          onPress={() => setExpandedFaq(open ? null : faq.id)}
                        >
                          <View style={styles.faqHeader}>
                            <Text style={styles.faqQuestion}>{faq.question}</Text>
                            {open ? <ChevronUp size={20} color={colors.primary} /> : <ChevronDown size={20} color="#94a3b8" />}
                          </View>
                          {open && <Text style={styles.faqAnswer}>{faq.answer}</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* ── Documents ── */}
              {filteredDocuments.length > 0 && (
                <View style={styles.section} ref={documentsRef}>
                  <Text style={styles.sectionTitle}>Dokumentation</Text>
                  <View style={styles.docList}>
                    {filteredDocuments.map(doc => (
                      <TouchableOpacity
                        key={doc.id}
                        style={styles.docCard}
                        activeOpacity={0.8}
                        onPress={() => { if (doc.file_url) window.open(doc.file_url, '_blank'); }}
                      >
                        <View style={styles.docIcon}>
                          <FileText size={20} color="#f59e0b" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.docTitle}>{doc.title}</Text>
                          {doc.description ? <Text style={styles.docDesc} numberOfLines={2}>{doc.description}</Text> : null}
                          {doc.file_name && (
                            <Text style={styles.docMeta}>{doc.file_name}{doc.file_size_bytes ? ` · ${formatFileSize(doc.file_size_bytes)}` : ''}</Text>
                          )}
                        </View>
                        <Download size={18} color="#f59e0b" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Empty state */}
              {searchQuery && filteredFaqs.length === 0 && filteredWalkthroughs.length === 0 && filteredVideos.length === 0 && filteredDocuments.length === 0 && (
                <View style={styles.emptyState}>
                  <HelpCircle size={40} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>Keine Ergebnisse gefunden</Text>
                  <Text style={styles.emptyText}>Versuchen Sie einen anderen Suchbegriff oder kontaktieren Sie uns direkt.</Text>
                </View>
              )}
            </>
          )}

          {/* ── Support Card ── */}
          <View style={styles.supportCard}>
            <Text style={styles.supportTitle}>Haben Sie noch Fragen?</Text>
            <Text style={styles.supportText}>
              Unser Support-Team ist für Sie da und hilft Ihnen gerne weiter.
            </Text>
            <View style={styles.supportButtons}>
              <TouchableOpacity style={styles.supportButton} onPress={() => setContactVisible(true)} activeOpacity={0.7}>
                <MessageCircle size={18} color="#fff" />
                <Text style={styles.supportButtonText}>Nachricht senden</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.supportButton, styles.supportButtonSecondary]} onPress={() => setContactVisible(true)} activeOpacity={0.7}>
                <ExternalLink size={18} color={colors.primary} />
                <Text style={[styles.supportButtonText, { color: colors.primary }]}>
                  E-Mail senden
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { maxWidth: 1000, width: '100%', alignSelf: 'center' },
  header: { alignItems: 'center', marginBottom: 48 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '800', color: '#0f172a', marginBottom: 12, textAlign: 'center' as any },
  subtitle: { fontSize: 15, color: '#64748b', textAlign: 'center' as any, maxWidth: 600, marginBottom: 32 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 20, height: 56, width: '100%', maxWidth: 600 },
  searchInput: { flex: 1, fontSize: 15, color: '#0f172a', outline: 'none', border: 'none' },
  quickLinksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginBottom: 48 },
  quickLinkCard: { flex: 1, minWidth: 220, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center', cursor: 'pointer' as any },
  quickLinkIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  quickLinkTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 6, textAlign: 'center' as any },
  quickLinkDesc: { fontSize: 14, color: '#64748b', textAlign: 'center' as any },
  section: { marginBottom: 48 },
  sectionTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 24 },

  // Tags
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', cursor: 'pointer' as any },
  tagChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tagChipText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tagChipTextActive: { color: '#fff' },

  // Walkthroughs
  cardGrid: { gap: 12 },
  wtCard: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#F1F5F9', cursor: 'pointer' as any },
  wtIconWrap: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#3b82f620', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  wtTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 3 },
  wtDesc: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  wtSteps: { fontSize: 12, color: '#3b82f6', fontWeight: '600' },

  // Videos
  videoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  videoCard: { flex: 1, minWidth: 280, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  videoPlaceholder: { width: '100%', height: 160, backgroundColor: '#8b5cf610', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  videoTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  videoDesc: { fontSize: 13, color: '#64748b', lineHeight: 20 },

  // FAQs
  faqList: { gap: 12 },
  faqItem: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#F1F5F9', cursor: 'pointer' as any },
  faqItemOpen: { borderColor: colors.primary + '40' },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  faqQuestion: { flex: 1, fontSize: 15, fontWeight: '600', color: '#0f172a' },
  faqAnswer: { marginTop: 14, fontSize: 14, lineHeight: 22, color: '#475569' },

  // Documents
  docList: { gap: 10 },
  docCard: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#F1F5F9', cursor: 'pointer' as any },
  docIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#f59e0b20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  docTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 3 },
  docDesc: { fontSize: 13, color: '#64748b', marginBottom: 3 },
  docMeta: { fontSize: 12, color: '#94a3b8' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#64748b' },
  emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center' as any, maxWidth: 320 },

  // Support card
  supportCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 32, alignItems: 'center', marginBottom: 40 },
  supportTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 8, textAlign: 'center' as any },
  supportText: { fontSize: 15, color: '#64748b', textAlign: 'center' as any, marginBottom: 24, maxWidth: 500 },
  supportButtons: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' as any, justifyContent: 'center' },
  supportButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, cursor: 'pointer' as any },
  supportButtonSecondary: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.primary },
  supportButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
