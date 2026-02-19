import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/supabase_service.dart';

class NotificationsState {
  final List<Map<String, dynamic>> notifications;
  final bool loading;
  final int unreadCount;

  const NotificationsState({
    this.notifications = const [],
    this.loading = false,
    this.unreadCount = 0,
  });

  NotificationsState copyWith({
    List<Map<String, dynamic>>? notifications,
    bool? loading,
    int? unreadCount,
  }) =>
      NotificationsState(
        notifications: notifications ?? this.notifications,
        loading: loading ?? this.loading,
        unreadCount: unreadCount ?? this.unreadCount,
      );
}

class NotificationsNotifier extends StateNotifier<NotificationsState> {
  Timer? _pollTimer;

  NotificationsNotifier() : super(const NotificationsState()) {
    load();
    // Poll every 30 seconds for new notifications
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) => load());
  }

  Future<void> load() async {
    try {
      final data = await SupabaseService.getNotifications();
      final unread = data.where((n) => n['is_read'] != true).length;
      state = state.copyWith(
        notifications: data,
        unreadCount: unread,
        loading: false,
      );
    } catch (_) {
      // Silently handle
    }
  }

  Future<void> markRead(String id) async {
    try {
      await SupabaseService.markNotificationRead(id);
      final updated = state.notifications.map((n) {
        if (n['id'] == id) return {...n, 'is_read': true};
        return n;
      }).toList();
      final unread = updated.where((n) => n['is_read'] != true).length;
      state = state.copyWith(notifications: updated, unreadCount: unread);
    } catch (_) {}
  }

  Future<void> markAllRead() async {
    try {
      await SupabaseService.markAllNotificationsRead();
      final updated = state.notifications
          .map((n) => {...n, 'is_read': true})
          .toList();
      state = state.copyWith(notifications: updated, unreadCount: 0);
    } catch (_) {}
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }
}

final notificationsProvider =
    StateNotifierProvider<NotificationsNotifier, NotificationsState>((ref) {
  return NotificationsNotifier();
});
