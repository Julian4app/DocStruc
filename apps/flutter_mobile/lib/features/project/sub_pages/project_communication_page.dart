import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/permissions_provider.dart';
import '../../../core/services/supabase_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/burger_menu_leading.dart';

const _pageSize = 50;
const _notePageSize = 30;

class ProjectCommunicationPage extends ConsumerStatefulWidget {
  final String projectId;
  const ProjectCommunicationPage({super.key, required this.projectId});

  @override
  ConsumerState<ProjectCommunicationPage> createState() =>
      _ProjectCommunicationPageState();
}

class _ProjectCommunicationPageState extends ConsumerState<ProjectCommunicationPage> {
  List<Map<String, dynamic>> _messages = [];
  List<Map<String, dynamic>> _notes = [];
  bool _loading = true;
  bool _loadingMoreMessages = false;
  bool _loadingMoreNotes = false;
  bool _hasMoreMessages = true;
  bool _hasMoreNotes = true;
  int _messageOffset = 0;
  int _noteOffset = 0;
  String _activeTab = 'messages';

  final _msgCtrl = TextEditingController();
  bool _sending = false;
  RealtimeChannel? _channel;

  String get _currentUserId => SupabaseService.currentUserId ?? '';

  @override
  void initState() {
    super.initState();
    _load();
    _subscribeRealtime();
  }

  @override
  void dispose() {
    _channel?.unsubscribe();
    _msgCtrl.dispose();
    super.dispose();
  }

  void _subscribeRealtime() {
    _channel = Supabase.instance.client
        .channel('project-messages-${widget.projectId}')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'project_messages',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'project_id',
            value: widget.projectId,
          ),
          callback: (_) => _load(silent: true),
        )
        .subscribe();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent && mounted) setState(() => _loading = true);
    try {
      final results = await Future.wait([
        SupabaseService.getMessagesPaginated(widget.projectId, limit: _pageSize, offset: 0),
        SupabaseService.getNotes(widget.projectId, limit: _notePageSize, offset: 0),
      ]);
      if (!mounted) return;
      setState(() {
        _messages = results[0];
        _notes = results[1];
        _messageOffset = results[0].length;
        _noteOffset = results[1].length;
        _hasMoreMessages = results[0].length >= _pageSize;
        _hasMoreNotes = results[1].length >= _notePageSize;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      _snack('Fehler beim Laden: $e', error: true);
    }
  }

  Future<void> _loadMoreMessages() async {
    if (_loadingMoreMessages || !_hasMoreMessages) return;
    setState(() => _loadingMoreMessages = true);
    try {
      final more = await SupabaseService.getMessagesPaginated(
          widget.projectId, limit: _pageSize, offset: _messageOffset);
      if (!mounted) return;
      setState(() {
        _messages = [...more, ..._messages];
        _messageOffset += more.length;
        _hasMoreMessages = more.length >= _pageSize;
        _loadingMoreMessages = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingMoreMessages = false);
    }
  }

  Future<void> _loadMoreNotes() async {
    if (_loadingMoreNotes || !_hasMoreNotes) return;
    setState(() => _loadingMoreNotes = true);
    try {
      final more = await SupabaseService.getNotes(
          widget.projectId, limit: _notePageSize, offset: _noteOffset);
      if (!mounted) return;
      setState(() {
        _notes.addAll(more);
        _noteOffset += more.length;
        _hasMoreNotes = more.length >= _notePageSize;
        _loadingMoreNotes = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingMoreNotes = false);
    }
  }

  Future<void> _sendMessage() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await SupabaseService.sendMessage(widget.projectId, {
        'content': text,
        'message_type': 'message',
      });
      _msgCtrl.clear();
      await _load(silent: true);
      _snack('Nachricht gesendet');
    } catch (e) {
      _snack('Fehler: $e', error: true);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _openNoteModal({Map<String, dynamic>? existing}) async {
    final isEdit = existing != null;
    final ctrl = TextEditingController(text: existing?['content'] ?? '');
    String selectedVisibility = 'all_participants';

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _NoteModal(
        controller: ctrl,
        isEdit: isEdit,
        initialVisibility: selectedVisibility,
        onVisibilityChanged: (v) => selectedVisibility = v,
      ),
    );
    if (confirmed == true && mounted) {
      final text = ctrl.text.trim();
      if (text.isEmpty) return;
      try {
        if (isEdit) {
          await SupabaseService.updateMessageContent(existing['id'] as String, text);
          _snack('Notiz aktualisiert');
        } else {
          await SupabaseService.createNote(widget.projectId, text);
          _snack('Notiz erstellt');
        }
        await _load(silent: true);
      } catch (e) {
        _snack('Fehler: $e', error: true);
      }
    }
    ctrl.dispose();
  }

  Future<void> _togglePin(Map<String, dynamic> item) async {
    try {
      final wasPinned = item['is_pinned'] as bool? ?? false;
      await SupabaseService.togglePinMessage(item['id'] as String, wasPinned);
      _snack(wasPinned ? 'Anheftung entfernt' : 'Angeheftet');
      await _load(silent: true);
    } catch (e) {
      _snack('Fehler: $e', error: true);
    }
  }

  Future<void> _deleteItem(Map<String, dynamic> item) async {
    final isNote = item['message_type'] == 'note';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.danger.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(LucideIcons.trash2, size: 18, color: AppColors.danger),
            ),
            const SizedBox(width: 12),
            const Text('Löschen?', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
          ],
        ),
        content: Text(
            'Möchten Sie diese ${isNote ? 'Notiz' : 'Nachricht'} wirklich löschen?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Abbrechen', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Löschen', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      try {
        await SupabaseService.softDeleteMessage(item['id'] as String);
        await _load(silent: true);
        _snack('Gelöscht');
      } catch (e) {
        _snack('Fehler: $e', error: true);
      }
    }
  }

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(
        children: [
          Icon(error ? LucideIcons.alertCircle : LucideIcons.checkCircle,
              color: Colors.white, size: 18),
          const SizedBox(width: 10),
          Expanded(child: Text(msg)),
        ],
      ),
      backgroundColor: error ? AppColors.danger : AppColors.primary,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      margin: const EdgeInsets.all(12),
    ));
  }

  int get _activeUsers {
    final ids = <String>{};
    for (final m in _messages) {
      if (m['user_id'] != null) ids.add(m['user_id'] as String);
    }
    for (final n in _notes) {
      if (n['user_id'] != null) ids.add(n['user_id'] as String);
    }
    return ids.length;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: burgerMenuLeading(context),
        title: const Text('Kommunikation',
            style: TextStyle(
                color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 18)),
        actions: [
          if (_activeTab == 'notes')
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: TextButton.icon(
                onPressed: () => _openNoteModal(),
                icon: const Icon(LucideIcons.plus, size: 16, color: Colors.white),
                label: const Text('Notiz erstellen',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                style: TextButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () => _load(silent: true),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header + Stats + TabBar — scrollable top section
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                        AppSpacing.screenH, 20, AppSpacing.screenH, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Kommunikation',
                            style: TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A),
                                letterSpacing: -0.5)),
                        const SizedBox(height: 2),
                        const Text('Nachrichten, Notizen und Kommunikation',
                            style: TextStyle(
                                fontSize: 14, color: AppColors.textSecondary)),
                        const SizedBox(height: 20),
                        _StatsRow(
                          messageCount: _messages.length,
                          noteCount: _notes.length,
                          activeUsers: _activeUsers,
                        ),
                        const SizedBox(height: 16),
                        _TabBar(
                          activeTab: _activeTab,
                          onTabChanged: (t) => setState(() => _activeTab = t),
                        ),
                        const SizedBox(height: 16),
                      ],
                    ),
                  ),
                  // Content card fills remaining space
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(
                          AppSpacing.screenH, 0, AppSpacing.screenH, 16),
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
                          border: Border.all(color: const Color(0xFFF1F5F9)),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.04),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
                          child: _activeTab == 'messages'
                              ? _MessagesContent(
                                  messages: _messages,
                                  currentUserId: _currentUserId,
                                  msgCtrl: _msgCtrl,
                                  sending: _sending,
                                  hasMore: _hasMoreMessages,
                                  loadingMore: _loadingMoreMessages,
                                  onSend: ref.permissions(widget.projectId).canCreate('communication') ? _sendMessage : null,
                                  onLoadMore: _loadMoreMessages,
                                  onPin: _togglePin,
                                  onDelete: _deleteItem,
                                )
                              : _NotesContent(
                                  notes: _notes,
                                  currentUserId: _currentUserId,
                                  hasMore: _hasMoreNotes,
                                  loadingMore: _loadingMoreNotes,
                                  onLoadMore: _loadMoreNotes,
                                  onPin: _togglePin,
                                  onEdit: (n) => _openNoteModal(existing: n),
                                  onDelete: _deleteItem,
                                ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

// =============================================================================
// Stats Row
// =============================================================================
class _StatsRow extends StatelessWidget {
  final int messageCount;
  final int noteCount;
  final int activeUsers;
  const _StatsRow(
      {required this.messageCount, required this.noteCount, required this.activeUsers});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
            child: _StatCard(
                icon: LucideIcons.messageSquare,
                label: 'Nachrichten',
                value: '$messageCount',
                color: AppColors.info)),
        const SizedBox(width: 12),
        Expanded(
            child: _StatCard(
                icon: LucideIcons.stickyNote,
                label: 'Notizen',
                value: '$noteCount',
                color: AppColors.warning)),
        const SizedBox(width: 12),
        Expanded(
            child: _StatCard(
                icon: LucideIcons.users,
                label: 'Aktive User',
                value: '$activeUsers',
                color: AppColors.success)),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  const _StatCard(
      {required this.icon, required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 4,
              offset: const Offset(0, 1))
        ],
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 6),
          Text(value,
              style: const TextStyle(
                  color: Color(0xFF0F172A), fontWeight: FontWeight.w800, fontSize: 22)),
          const SizedBox(height: 2),
          Text(label,
              style: const TextStyle(
                  color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

// =============================================================================
// Tab Bar — pill style matching web exactly
// =============================================================================
class _TabBar extends StatelessWidget {
  final String activeTab;
  final ValueChanged<String> onTabChanged;
  const _TabBar({required this.activeTab, required this.onTabChanged});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
            child: _TabButton(
                icon: LucideIcons.messageSquare,
                label: 'Nachrichten',
                isActive: activeTab == 'messages',
                onTap: () => onTabChanged('messages'))),
        const SizedBox(width: 8),
        Expanded(
            child: _TabButton(
                icon: LucideIcons.stickyNote,
                label: 'Notizen',
                isActive: activeTab == 'notes',
                onTap: () => onTabChanged('notes'))),
      ],
    );
  }
}

class _TabButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;
  const _TabButton(
      {required this.icon,
      required this.label,
      required this.isActive,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        decoration: BoxDecoration(
          color: isActive ? const Color(0xFFEFF6FF) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: isActive ? AppColors.primary : Colors.transparent, width: 2),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon,
                size: 18,
                color: isActive ? AppColors.primary : AppColors.textSecondary),
            const SizedBox(width: 8),
            Text(label,
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: isActive ? AppColors.primary : AppColors.textSecondary)),
          ],
        ),
      ),
    );
  }
}

// =============================================================================
// Messages Content
// =============================================================================
class _MessagesContent extends StatelessWidget {
  final List<Map<String, dynamic>> messages;
  final String currentUserId;
  final TextEditingController msgCtrl;
  final bool sending;
  final bool hasMore;
  final bool loadingMore;
  final VoidCallback? onSend;
  final VoidCallback onLoadMore;
  final void Function(Map<String, dynamic>) onPin;
  final void Function(Map<String, dynamic>) onDelete;

  const _MessagesContent({
    required this.messages,
    required this.currentUserId,
    required this.msgCtrl,
    required this.sending,
    required this.hasMore,
    required this.loadingMore,
    required this.onSend,
    required this.onLoadMore,
    required this.onPin,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: messages.isEmpty && !hasMore
              ? const _EmptyState(
                  icon: LucideIcons.messageSquare,
                  title: 'Noch keine Nachrichten')
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  itemCount: messages.length + (hasMore ? 1 : 0),
                  itemBuilder: (ctx, i) {
                    if (i == 0 && hasMore) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Center(
                          child: TextButton.icon(
                            onPressed: loadingMore ? null : onLoadMore,
                            icon: loadingMore
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2, color: AppColors.primary))
                                : const Icon(LucideIcons.history,
                                    size: 16, color: AppColors.primary),
                            label: const Text('Ältere Nachrichten laden',
                                style: TextStyle(color: AppColors.primary, fontSize: 13)),
                          ),
                        ),
                      );
                    }
                    final idx = hasMore ? i - 1 : i;
                    final msg = messages[idx];
                    return _ItemCard(
                      item: msg,
                      currentUserId: currentUserId,
                      isNote: false,
                      onPin: () => onPin(msg),
                      onDelete: () => onDelete(msg),
                    );
                  },
                ),
        ),
        // Input bar
        Container(
          padding: EdgeInsets.fromLTRB(
              16, 12, 16, MediaQuery.of(context).padding.bottom + 12),
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: Color(0xFFF1F5F9))),
          ),
          child: Row(
            children: [
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: TextField(
                    controller: msgCtrl,
                    maxLines: null,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => onSend?.call(),
                    style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A)),
                    decoration: const InputDecoration(
                      hintText: 'Nachricht eingeben...',
                      hintStyle: TextStyle(color: AppColors.textSecondary, fontSize: 14),
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      border: InputBorder.none,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              _SendButton(msgCtrl: msgCtrl, sending: sending, onSend: onSend),
            ],
          ),
        ),
      ],
    );
  }
}

class _SendButton extends StatefulWidget {
  final TextEditingController msgCtrl;
  final bool sending;
  final VoidCallback? onSend;
  const _SendButton(
      {required this.msgCtrl, required this.sending, required this.onSend});

  @override
  State<_SendButton> createState() => _SendButtonState();
}

class _SendButtonState extends State<_SendButton> {
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    widget.msgCtrl.addListener(_listen);
  }

  void _listen() {
    final h = widget.msgCtrl.text.trim().isNotEmpty;
    if (h != _hasText) setState(() => _hasText = h);
  }

  @override
  void dispose() {
    widget.msgCtrl.removeListener(_listen);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final active = _hasText && !widget.sending && widget.onSend != null;
    return GestureDetector(
      onTap: active ? widget.onSend : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: active ? AppColors.primary : const Color(0xFFCBD5E1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Center(
          child: widget.sending
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Icon(LucideIcons.send, color: Colors.white, size: 20),
        ),
      ),
    );
  }
}

// =============================================================================
// Notes Content
// =============================================================================
class _NotesContent extends StatelessWidget {
  final List<Map<String, dynamic>> notes;
  final String currentUserId;
  final bool hasMore;
  final bool loadingMore;
  final VoidCallback onLoadMore;
  final void Function(Map<String, dynamic>) onPin;
  final void Function(Map<String, dynamic>) onEdit;
  final void Function(Map<String, dynamic>) onDelete;

  const _NotesContent({
    required this.notes,
    required this.currentUserId,
    required this.hasMore,
    required this.loadingMore,
    required this.onLoadMore,
    required this.onPin,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    if (notes.isEmpty && !hasMore) {
      return const _EmptyState(icon: LucideIcons.stickyNote, title: 'Noch keine Notizen');
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: notes.length + (hasMore ? 1 : 0),
      itemBuilder: (ctx, i) {
        if (i == notes.length) {
          return Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Center(
              child: TextButton.icon(
                onPressed: loadingMore ? null : onLoadMore,
                icon: loadingMore
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: AppColors.primary))
                    : const Icon(LucideIcons.chevronDown,
                        size: 16, color: AppColors.primary),
                label: const Text('Mehr Notizen laden',
                    style: TextStyle(color: AppColors.primary, fontSize: 13)),
              ),
            ),
          );
        }
        final note = notes[i];
        return _ItemCard(
          item: note,
          currentUserId: currentUserId,
          isNote: true,
          onPin: () => onPin(note),
          onEdit: () => onEdit(note),
          onDelete: () => onDelete(note),
        );
      },
    );
  }
}

// =============================================================================
// Item Card — matches web design exactly
// =============================================================================
class _ItemCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final String currentUserId;
  final bool isNote;
  final VoidCallback onPin;
  final VoidCallback? onEdit;
  final VoidCallback onDelete;

  const _ItemCard({
    required this.item,
    required this.currentUserId,
    required this.isNote,
    required this.onPin,
    this.onEdit,
    required this.onDelete,
  });

  String _initials(Map? profile) {
    if (profile == null) return '?';
    final first = (profile['first_name'] as String? ?? '');
    final last = (profile['last_name'] as String? ?? '');
    final full = '$first $last'.trim();
    if (full.isEmpty) return '?';
    return full.split(' ').map((p) => p.isNotEmpty ? p[0] : '').join('').toUpperCase();
  }

  String _displayName(Map? profile) {
    if (profile == null) return 'Unbekannt';
    final first = profile['first_name'] as String? ?? '';
    final last = profile['last_name'] as String? ?? '';
    final full = '$first $last'.trim();
    return full.isNotEmpty ? full : 'Unbekannt';
  }

  String _formatTime(String? iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Gerade eben';
    if (diff.inMinutes < 60) return 'vor ${diff.inMinutes} Min.';
    if (diff.inHours < 24) return 'vor ${diff.inHours} Std.';
    if (diff.inDays < 7) return 'vor ${diff.inDays} Tag(en)';
    final d = dt;
    return '${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}.${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    final profile = item['profiles'] as Map?;
    final isPinned = item['is_pinned'] as bool? ?? false;
    final isEdited = item['is_edited'] as bool? ?? false;
    final isOwn = item['user_id'] == currentUserId;
    final content = item['content'] as String? ?? '';
    final createdAt = item['created_at'] as String?;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: isPinned
            ? Border.all(color: const Color(0xFFF59E0B).withOpacity(0.4))
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Pinned badge
          if (isPinned)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: const [
                  Icon(LucideIcons.pin, size: 12, color: Color(0xFFF59E0B)),
                  SizedBox(width: 4),
                  Text('Angeheftet',
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFFF59E0B),
                          letterSpacing: 0.3)),
                ],
              ),
            ),
          // Header row
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Avatar
              Container(
                width: 40,
                height: 40,
                decoration: const BoxDecoration(
                    color: AppColors.primary, shape: BoxShape.circle),
                child: Center(
                  child: Text(
                    _initials(profile),
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 14),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              // Name + time
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_displayName(profile),
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A))),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        const Icon(LucideIcons.clock,
                            size: 12, color: Color(0xFF94A3B8)),
                        const SizedBox(width: 4),
                        Text(_formatTime(createdAt),
                            style: const TextStyle(
                                fontSize: 12, color: Color(0xFF94A3B8))),
                        if (isEdited) ...[
                          const SizedBox(width: 6),
                          const Text('(bearbeitet)',
                              style: TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF94A3B8),
                                  fontStyle: FontStyle.italic)),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              // Action buttons
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _ActionBtn(
                    icon: isPinned ? LucideIcons.pinOff : LucideIcons.pin,
                    onTap: onPin,
                    tooltip: isPinned ? 'Loslösen' : 'Anheften',
                  ),
                  if (isOwn) ...[
                    if (isNote)
                      _ActionBtn(
                          icon: LucideIcons.edit2,
                          onTap: onEdit ?? () {},
                          tooltip: 'Bearbeiten'),
                    _ActionBtn(
                      icon: LucideIcons.trash2,
                      onTap: onDelete,
                      tooltip: 'Löschen',
                      color: AppColors.danger,
                    ),
                  ],
                ],
              ),
            ],
          ),
          // Content
          const SizedBox(height: 12),
          Text(content,
              style: const TextStyle(
                  fontSize: 14, color: Color(0xFF0F172A), height: 1.43)),
        ],
      ),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final String tooltip;
  final Color? color;
  const _ActionBtn(
      {required this.icon, required this.onTap, required this.tooltip, this.color});

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(8),
          margin: const EdgeInsets.only(left: 6),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 16, color: color ?? AppColors.textSecondary),
        ),
      ),
    );
  }
}

// =============================================================================
// Note Modal
// =============================================================================
class _NoteModal extends StatefulWidget {
  final TextEditingController controller;
  final bool isEdit;
  final String initialVisibility;
  final ValueChanged<String> onVisibilityChanged;

  const _NoteModal({
    required this.controller,
    required this.isEdit,
    required this.initialVisibility,
    required this.onVisibilityChanged,
  });

  @override
  State<_NoteModal> createState() => _NoteModalState();
}

class _NoteModalState extends State<_NoteModal> {
  bool _hasText = false;
  late String _visibility;

  @override
  void initState() {
    super.initState();
    _visibility = widget.initialVisibility;
    _hasText = widget.controller.text.trim().isNotEmpty;
    widget.controller.addListener(_onChanged);
  }

  void _onChanged() {
    final has = widget.controller.text.trim().isNotEmpty;
    if (has != _hasText) setState(() => _hasText = has);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      margin: EdgeInsets.only(bottom: bottom),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 10, bottom: 4),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                    color: AppColors.border, borderRadius: BorderRadius.circular(2)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF59E0B).withOpacity(0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(LucideIcons.stickyNote,
                        color: Color(0xFFF59E0B), size: 20),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    widget.isEdit ? 'Notiz bearbeiten' : 'Neue Notiz erstellen',
                    style: const TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.bold,
                        fontSize: 17),
                  ),
                  const Spacer(),
                  GestureDetector(
                    onTap: () => Navigator.pop(context, false),
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppColors.background,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(LucideIcons.x,
                          size: 18, color: AppColors.textSecondary),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 20, color: AppColors.border),
            if (!widget.isEdit) ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Sichtbarkeit',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textSecondary)),
                    const SizedBox(height: 8),
                    Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _visibility,
                          isExpanded: true,
                          borderRadius: BorderRadius.circular(12),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                          icon: const Icon(LucideIcons.chevronDown,
                              size: 18, color: AppColors.textSecondary),
                          items: const [
                            DropdownMenuItem(
                              value: 'all_participants',
                              child: Row(children: [
                                Icon(LucideIcons.users, size: 16, color: AppColors.primary),
                                SizedBox(width: 10),
                                Text('Alle Teilnehmer', style: TextStyle(fontSize: 14)),
                              ]),
                            ),
                            DropdownMenuItem(
                              value: 'team_only',
                              child: Row(children: [
                                Icon(LucideIcons.shield, size: 16, color: AppColors.primary),
                                SizedBox(width: 10),
                                Text('Nur Team', style: TextStyle(fontSize: 14)),
                              ]),
                            ),
                            DropdownMenuItem(
                              value: 'owner_only',
                              child: Row(children: [
                                Icon(LucideIcons.lock, size: 16, color: AppColors.primary),
                                SizedBox(width: 10),
                                Text('Nur Eigentümer', style: TextStyle(fontSize: 14)),
                              ]),
                            ),
                          ],
                          onChanged: (v) {
                            if (v != null) {
                              setState(() => _visibility = v);
                              widget.onVisibilityChanged(v);
                            }
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: TextField(
                  controller: widget.controller,
                  autofocus: true,
                  maxLines: 6,
                  minLines: 6,
                  style: const TextStyle(
                      fontSize: 14, height: 1.4, color: Color(0xFF0F172A)),
                  decoration: const InputDecoration(
                    hintText: 'Notiz eingeben...',
                    hintStyle:
                        TextStyle(color: AppColors.textSecondary, fontSize: 14),
                    contentPadding: EdgeInsets.all(16),
                    border: InputBorder.none,
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  GestureDetector(
                    onTap: () => Navigator.pop(context, false),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Row(
                        children: [
                          Icon(LucideIcons.x, size: 18, color: AppColors.textSecondary),
                          SizedBox(width: 8),
                          Text('Abbrechen',
                              style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textSecondary)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  GestureDetector(
                    onTap: _hasText ? () => Navigator.pop(context, true) : null,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding:
                          const EdgeInsets.symmetric(vertical: 10, horizontal: 20),
                      decoration: BoxDecoration(
                        color: _hasText ? AppColors.primary : const Color(0xFFCBD5E1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        widget.isEdit ? 'Aktualisieren' : 'Erstellen',
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// =============================================================================
// Empty State
// =============================================================================
class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  const _EmptyState({required this.icon, required this.title});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 60),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: const Color(0xFF94A3B8)),
            const SizedBox(height: 16),
            Text(title, style: const TextStyle(fontSize: 16, color: Color(0xFF94A3B8))),
          ],
        ),
      ),
    );
  }
}
