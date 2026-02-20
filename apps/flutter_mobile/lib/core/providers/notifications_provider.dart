import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/supabase_service.dart';
import '../services/notification_service.dart';

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

  /// IDs already seen so we don't fire duplicate push notifications.
  final Set<String> _seenIds = {};

  /// Cached user notification settings (loaded from user_settings).
  Map<String, dynamic> _notifSettings = {};

  NotificationsNotifier() : super(const NotificationsState()) {
    _initAndLoad();
  }

  Future<void> _initAndLoad() async {
    // Load notification settings first
    await _reloadSettings();

    // Request permission if push is enabled
    if (_notifSettings['pushNotifications'] != false) {
      final hasPerm = await NotificationService.hasPermission();
      if (!hasPerm) {
        await NotificationService.requestPermission();
      }
    }

    await load();

    // Poll every 30 seconds for new notifications
    _pollTimer =
        Timer.periodic(const Duration(seconds: 30), (_) => _poll());
  }

  Future<void> _reloadSettings() async {
    try {
      final data = await SupabaseService.getUserSettings();
      if (data != null && data['settings'] is Map) {
        _notifSettings = Map<String, dynamic>.from(
            data['settings'] as Map<String, dynamic>);
      }
    } catch (_) {}
  }

  /// Update in-memory settings (called from SettingsScreen after save).
  void updateSettings(Map<String, dynamic> settings) {
    _notifSettings = Map<String, dynamic>.from(settings);
  }

  Future<void> load() async {
    try {
      final data = await SupabaseService.getNotifications();
      // Mark all existing IDs as seen on first load (no spurious pushes)
      if (_seenIds.isEmpty) {
        for (final n in data) {
          final id = n['id'] as String?;
          if (id != null) _seenIds.add(id);
        }
      }
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

  /// Called on poll timer – fires push for genuinely new notifications.
  Future<void> _poll() async {
    try {
      // Refresh settings in case user changed them
      await _reloadSettings();

      final data = await SupabaseService.getNotifications();
      final unread = data.where((n) => n['is_read'] != true).length;
      state = state.copyWith(notifications: data, unreadCount: unread);

      // Fire local push for any new notification not yet seen
      for (final n in data) {
        final id = n['id'] as String?;
        if (id == null) continue;
        if (_seenIds.contains(id)) continue;
        _seenIds.add(id);

        // Only push for unread ones
        if (n['is_read'] == true) continue;

        await NotificationService.showForDbNotification(n, _notifSettings);
      }
    } catch (_) {}
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
