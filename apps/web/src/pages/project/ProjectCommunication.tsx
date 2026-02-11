import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { Card, Button } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ToastProvider';
import { MessageSquare, Send, StickyNote, Users, Clock, Pin } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  user_id: string;
  user_name: string;
  created_at: string;
  type: 'message' | 'note';
  pinned?: boolean;
}

interface CommunicationStats {
  totalMessages: number;
  totalNotes: number;
  activeUsers: number;
}

export function ProjectCommunication() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState<'messages' | 'notes'>('messages');
  const [messageInput, setMessageInput] = useState('');
  const [stats, setStats] = useState<CommunicationStats>({ totalMessages: 0, totalNotes: 0, activeUsers: 0 });

  useEffect(() => {
    if (id) loadCommunication();
  }, [id]);

  const loadCommunication = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const mockMessages: Message[] = [
        { id: '1', content: 'Die Rohbauarbeiten verlaufen planmäßig.', user_id: 'user1', user_name: 'Max Mustermann', created_at: '2026-02-11T10:30:00', type: 'message' },
        { id: '2', content: 'Bitte die neuen Materialpläne prüfen.', user_id: 'user2', user_name: 'Anna Schmidt', created_at: '2026-02-11T09:15:00', type: 'message' }
      ];
      const mockNotes: Message[] = [
        { id: 'n1', content: 'Fundament vor Frost schützen.', user_id: 'user1', user_name: 'Max Mustermann', created_at: '2026-02-09T14:20:00', type: 'note', pinned: true }
      ];
      setMessages(mockMessages);
      setNotes(mockNotes);
      setStats({ totalMessages: mockMessages.length, totalNotes: mockNotes.length, activeUsers: 2 });
    } catch (error: any) {
      showToast('Fehler beim Laden', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    showToast('Nachricht gesendet', 'success');
    setMessageInput('');
    loadCommunication();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `vor ${diffMins} Min.`;
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    if (diffDays < 7) return `vor ${diffDays} Tag(en)`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const currentItems = activeTab === 'messages' ? messages : notes;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Kommunikation</Text>
          <Text style={styles.pageSubtitle}>Nachrichten, Notizen und Kommunikation</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <MessageSquare size={24} color="#3B82F6" />
          <Text style={styles.statValue}>{stats.totalMessages}</Text>
          <Text style={styles.statLabel}>Nachrichten</Text>
        </Card>
        <Card style={styles.statCard}>
          <StickyNote size={24} color="#F59E0B" />
          <Text style={styles.statValue}>{stats.totalNotes}</Text>
          <Text style={styles.statLabel}>Notizen</Text>
        </Card>
        <Card style={styles.statCard}>
          <Users size={24} color="#10B981" />
          <Text style={styles.statValue}>{stats.activeUsers}</Text>
          <Text style={styles.statLabel}>Aktive User</Text>
        </Card>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, activeTab === 'messages' && styles.tabActive]} onPress={() => setActiveTab('messages')}>
          <MessageSquare size={18} color={activeTab === 'messages' ? colors.primary : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'messages' && styles.tabTextActive]}>Nachrichten</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'notes' && styles.tabActive]} onPress={() => setActiveTab('notes')}>
          <StickyNote size={18} color={activeTab === 'notes' ? colors.primary : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'notes' && styles.tabTextActive]}>Notizen</Text>
        </TouchableOpacity>
      </View>

      <Card style={styles.contentCard}>
        <ScrollView style={styles.messagesList} showsVerticalScrollIndicator={false}>
          {currentItems.length === 0 ? (
            <View style={styles.emptyState}>
              {activeTab === 'messages' ? <MessageSquare size={48} color="#94a3b8" /> : <StickyNote size={48} color="#94a3b8" />}
              <Text style={styles.emptyText}>{activeTab === 'messages' ? 'Noch keine Nachrichten' : 'Noch keine Notizen'}</Text>
            </View>
          ) : (
            currentItems.map(item => (
              <View key={item.id} style={styles.messageCard}>
                {item.pinned && (
                  <View style={styles.pinnedBadge}>
                    <Pin size={12} color="#F59E0B" />
                    <Text style={styles.pinnedText}>Angeheftet</Text>
                  </View>
                )}
                <View style={styles.messageHeader}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.avatarText}>{item.user_name.split(' ').map(n => n[0]).join('')}</Text>
                  </View>
                  <View style={styles.messageHeaderInfo}>
                    <Text style={styles.userName}>{item.user_name}</Text>
                    <View style={styles.timeRow}>
                      <Clock size={12} color="#94a3b8" />
                      <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.messageContent}>{item.content}</Text>
              </View>
            ))
          )}
        </ScrollView>

        {activeTab === 'messages' && (
          <View style={styles.inputContainer}>
            <TextInput style={styles.messageInput} placeholder="Nachricht eingeben..." value={messageInput} onChangeText={setMessageInput} multiline />
            <TouchableOpacity style={[styles.sendButton, !messageInput.trim() && styles.sendButtonDisabled]} onPress={handleSendMessage} disabled={!messageInput.trim()}>
              <Send size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 4, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 15, color: '#64748b' },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  statCard: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center', gap: 8 },
  statValue: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  statLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  tabBar: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  tabActive: { backgroundColor: '#EFF6FF', borderColor: colors.primary },
  tabText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: colors.primary },
  contentCard: { flex: 1, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  messagesList: { flex: 1, marginBottom: 16 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 16 },
  emptyText: { fontSize: 16, color: '#94a3b8' },
  messageCard: { padding: 16, backgroundColor: '#F8FAFC', borderRadius: 12, marginBottom: 12 },
  pinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  pinnedText: { fontSize: 11, fontWeight: '700', color: '#F59E0B', textTransform: 'uppercase' },
  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  messageHeaderInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontSize: 12, color: '#94a3b8' },
  messageContent: { fontSize: 14, color: '#0f172a', lineHeight: 20 },
  inputContainer: { flexDirection: 'row', gap: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  messageInput: { flex: 1, minHeight: 48, maxHeight: 120, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 14, color: '#0f172a' },
  sendButton: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { backgroundColor: '#CBD5E1' }
});
