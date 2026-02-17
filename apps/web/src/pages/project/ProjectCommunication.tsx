import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { Card, Button } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { ModernModal } from '../../components/ModernModal';
import { useToast } from '../../components/ToastProvider';
import { useProjectPermissionContext } from '../../components/PermissionGuard';
import { useContentVisibility } from '../../hooks/useContentVisibility';
import { VisibilityDropdown, VisibilitySelector, VisibilityLevel } from '../../components/VisibilityControls';
import { MessageSquare, Send, StickyNote, Users, Clock, Pin, Trash2, Edit2, X, PinOff, Plus } from 'lucide-react';

interface Message {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  message_type: 'message' | 'note';
  is_pinned: boolean;
  pinned_by?: string;
  pinned_at?: string;
  parent_message_id?: string;
  is_edited: boolean;
  edited_at?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_avatar?: string;
}

interface CommunicationStats {
  totalMessages: number;
  totalNotes: number;
  activeUsers: number;
}

export function ProjectCommunication() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const ctx = useProjectPermissionContext();
  const pCanCreate = ctx?.isProjectOwner || ctx?.canCreate?.('communication') || false;
  const pCanEdit = ctx?.isProjectOwner || ctx?.canEdit?.('communication') || false;
  const pCanDelete = ctx?.isProjectOwner || ctx?.canDelete?.('communication') || false;
  const { defaultVisibility, filterVisibleItems, setContentVisibility } = useContentVisibility(id, 'communication');
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState<'messages' | 'notes'>('messages');
  const [messageInput, setMessageInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [stats, setStats] = useState<CommunicationStats>({ totalMessages: 0, totalNotes: 0, activeUsers: 0 });
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);
  const [createVisibility, setCreateVisibility] = useState<VisibilityLevel>('all_participants');

  useEffect(() => {
    if (id) {
      loadCommunication();
      getCurrentUser();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel(`project-messages-${id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'project_messages',
            filter: `project_id=eq.${id}`
          },
          () => {
            loadCommunication();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, notes, activeTab]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const loadCommunication = async () => {
    if (!id) return;
    setLoading(true);
    
    try {
      // Load messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('project_messages')
        .select(`
          *,
          profiles!project_messages_user_id_fkey(first_name, last_name, email, avatar_url)
        `)
        .eq('project_id', id)
        .eq('message_type', 'message')
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      // Load notes
      const { data: notesData, error: notesError } = await supabase
        .from('project_messages')
        .select(`
          *,
          profiles!project_messages_user_id_fkey(first_name, last_name, email, avatar_url)
        `)
        .eq('project_id', id)
        .eq('message_type', 'note')
        .eq('is_deleted', false)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;

      // Transform messages
      const transformedMessages: Message[] = (messagesData || []).map((msg: any) => ({
        ...msg,
        user_name: msg.profiles 
          ? `${msg.profiles.first_name || ''} ${msg.profiles.last_name || ''}`.trim() || msg.profiles.email
          : 'Unbekannt',
        user_avatar: msg.profiles?.avatar_url
      }));

      const transformedNotes: Message[] = (notesData || []).map((note: any) => ({
        ...note,
        user_name: note.profiles 
          ? `${note.profiles.first_name || ''} ${note.profiles.last_name || ''}`.trim() || note.profiles.email
          : 'Unbekannt',
        user_avatar: note.profiles?.avatar_url
      }));

      // Apply visibility filtering
      const visibleMessages = await filterVisibleItems(transformedMessages);
      const visibleNotes = await filterVisibleItems(transformedNotes);
      setMessages(visibleMessages);
      setNotes(visibleNotes);

      // Calculate stats from visible items
      const uniqueUsers = new Set([
        ...visibleMessages.map(m => m.user_id),
        ...visibleNotes.map(n => n.user_id)
      ]);

      setStats({
        totalMessages: visibleMessages.length,
        totalNotes: visibleNotes.length,
        activeUsers: uniqueUsers.size
      });
    } catch (error: any) {
      console.error('Error loading communication:', error);
      showToast('Fehler beim Laden der Kommunikation', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || sending) return;
    
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht authentifiziert');

      const { error } = await supabase
        .from('project_messages')
        .insert({
          project_id: id,
          user_id: user.id,
          content: messageInput.trim(),
          message_type: 'message'
        });

      if (error) throw error;

      setMessageInput('');
      showToast('Nachricht gesendet', 'success');
    } catch (error: any) {
      console.error('Error sending message:', error);
      showToast(error.message || 'Fehler beim Senden', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleCreateNote = async () => {
    if (!noteInput.trim()) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht authentifiziert');

      if (editingMessage) {
        // Update existing note
        const { error } = await supabase
          .from('project_messages')
          .update({
            content: noteInput.trim(),
            is_edited: true,
            edited_at: new Date().toISOString()
          })
          .eq('id', editingMessage.id);

        if (error) throw error;
        showToast('Notiz aktualisiert', 'success');
      } else {
        // Create new note
        const { data: newNote, error } = await supabase
          .from('project_messages')
          .insert({
            project_id: id,
            user_id: user.id,
            content: noteInput.trim(),
            message_type: 'note'
          })
          .select()
          .single();

        if (error) throw error;

        // Set visibility if not default
        if (newNote && createVisibility !== 'all_participants') {
          await setContentVisibility(newNote.id, createVisibility);
        }
        setCreateVisibility('all_participants');
        showToast('Notiz erstellt', 'success');
      }

      setNoteInput('');
      setEditingMessage(null);
      setIsNoteModalOpen(false);
    } catch (error: any) {
      console.error('Error creating note:', error);
      showToast(error.message || 'Fehler beim Erstellen der Notiz', 'error');
    }
  };

  const handleTogglePin = async (message: Message) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht authentifiziert');

      const { error } = await supabase
        .from('project_messages')
        .update({
          is_pinned: !message.is_pinned,
          pinned_by: !message.is_pinned ? user.id : null,
          pinned_at: !message.is_pinned ? new Date().toISOString() : null
        })
        .eq('id', message.id);

      if (error) throw error;
      showToast(message.is_pinned ? 'Anheftung entfernt' : 'Angeheftet', 'success');
    } catch (error: any) {
      console.error('Error toggling pin:', error);
      showToast('Fehler beim Anheften', 'error');
    }
  };

  const handleEditNote = (note: Message) => {
    setEditingMessage(note);
    setNoteInput(note.content);
    setIsNoteModalOpen(true);
  };

  const handleDeleteMessage = async (message: Message) => {
    if (!confirm('Möchten Sie diese ' + (message.message_type === 'message' ? 'Nachricht' : 'Notiz') + ' wirklich löschen?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('project_messages')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString()
        })
        .eq('id', message.id);

      if (error) throw error;
      showToast('Gelöscht', 'success');
    } catch (error: any) {
      console.error('Error deleting message:', error);
      showToast('Fehler beim Löschen', 'error');
    }
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
        {activeTab === 'notes' && pCanCreate && (
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => {
              setEditingMessage(null);
              setNoteInput('');
              setIsNoteModalOpen(true);
            }}
          >
            <Plus size={20} color="#ffffff" />
            <Text style={styles.addButtonText}>Notiz erstellen</Text>
          </TouchableOpacity>
        )}
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
                {item.is_pinned && (
                  <View style={styles.pinnedBadge}>
                    <Pin size={12} color="#F59E0B" />
                    <Text style={styles.pinnedText}>Angeheftet</Text>
                  </View>
                )}
                <View style={styles.messageHeader}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.avatarText}>{(item.user_name || 'U').split(' ').map(n => n[0]).join('')}</Text>
                  </View>
                  <View style={styles.messageHeaderInfo}>
                    <Text style={styles.userName}>{item.user_name}</Text>
                    <View style={styles.timeRow}>
                      <Clock size={12} color="#94a3b8" />
                      <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
                      {item.is_edited && (
                        <Text style={styles.editedText}>(bearbeitet)</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.messageActions}>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleTogglePin(item)}
                    >
                      {item.is_pinned ? (
                        <PinOff size={16} color="#64748b" />
                      ) : (
                        <Pin size={16} color="#64748b" />
                      )}
                    </TouchableOpacity>
                    {item.user_id === currentUserId && (
                      <>
                        {activeTab === 'notes' && pCanEdit && (
                          <TouchableOpacity 
                            style={styles.actionButton}
                            onPress={() => handleEditNote(item)}
                          >
                            <Edit2 size={16} color="#64748b" />
                          </TouchableOpacity>
                        )}
                        {pCanDelete && (
                          <TouchableOpacity 
                            style={styles.actionButton}
                            onPress={() => handleDeleteMessage(item)}
                          >
                            <Trash2 size={16} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                </View>
                <Text style={styles.messageContent}>{item.content}</Text>
              </View>
            ))
          )}
        </ScrollView>

        {activeTab === 'messages' && pCanCreate && (
          <View style={styles.inputContainer}>
            <TextInput 
              style={styles.messageInput} 
              placeholder="Nachricht eingeben..." 
              value={messageInput} 
              onChangeText={setMessageInput} 
              multiline 
              onSubmitEditing={handleSendMessage}
            />
            <TouchableOpacity 
              style={[styles.sendButton, (!messageInput.trim() || sending) && styles.sendButtonDisabled]} 
              onPress={handleSendMessage} 
              disabled={!messageInput.trim() || sending}
            >
              <Send size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
      </Card>

      <ModernModal
        visible={isNoteModalOpen}
        onClose={() => {
          setIsNoteModalOpen(false);
          setEditingMessage(null);
          setNoteInput('');
        }}
        title={editingMessage ? 'Notiz bearbeiten' : 'Neue Notiz erstellen'}
      >
        <View style={styles.modalContent}>
          {/* Visibility selector at top */}
          <View style={{ marginBottom: 8 }}>
            <VisibilityDropdown
              value={createVisibility}
              onChange={setCreateVisibility}
            />
          </View>
          <TextInput
            style={styles.noteTextArea}
            placeholder="Notiz eingeben..."
            value={noteInput}
            onChangeText={setNoteInput}
            multiline
            numberOfLines={6}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => {
                setIsNoteModalOpen(false);
                setEditingMessage(null);
                setNoteInput('');
              }}
            >
              <X size={18} color="#64748b" />
              <Text style={styles.modalCancelText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveButton, !noteInput.trim() && styles.modalSaveButtonDisabled]}
              onPress={handleCreateNote}
              disabled={!noteInput.trim()}
            >
              <Text style={styles.modalSaveText}>
                {editingMessage ? 'Aktualisieren' : 'Erstellen'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ModernModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 4, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 15, color: '#64748b' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.primary, borderRadius: 12 },
  addButtonText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
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
  editedText: { fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginLeft: 4 },
  messageActions: { flexDirection: 'row', gap: 8 },
  actionButton: { padding: 8, borderRadius: 8, backgroundColor: '#F1F5F9' },
  messageContent: { fontSize: 14, color: '#0f172a', lineHeight: 20 },
  inputContainer: { flexDirection: 'row', gap: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  messageInput: { flex: 1, minHeight: 48, maxHeight: 120, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 14, color: '#0f172a' },
  sendButton: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { backgroundColor: '#CBD5E1' },
  modalContent: { gap: 16 },
  noteTextArea: { minHeight: 120, padding: 16, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 14, color: '#0f172a', textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalCancelButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#F1F5F9', borderRadius: 12 },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  modalSaveButton: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: colors.primary, borderRadius: 12 },
  modalSaveButtonDisabled: { backgroundColor: '#CBD5E1' },
  modalSaveText: { fontSize: 15, fontWeight: '600', color: '#ffffff' }
});
