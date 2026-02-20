import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' show Color;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';

/// Handles all local push notifications for the app.
///
/// Notification categories (matching DB `type` + settings keys):
///   • projectUpdates   → new project member, status change
///   • taskUpdates      → task assigned / completed
///   • messages         → new help/chat message
///   • defectUpdates    → new defect / defect resolved
///   • weeklyReports    → weekly summary digest
class NotificationService {
  NotificationService._();

  static final _plugin = FlutterLocalNotificationsPlugin();
  static bool _initialized = false;

  // ── Channel IDs ──────────────────────────────────────────────────────────
  static const _chGeneral = 'docstruc_general';
  static const _chProject = 'docstruc_project';
  static const _chTask    = 'docstruc_task';
  static const _chMessage = 'docstruc_message';
  static const _chWeekly  = 'docstruc_weekly';

  // ── Notification IDs (stable per category) ───────────────────────────────
  static int _nextId = 1;
  static int _newId() => _nextId++;

  // ── Init ──────────────────────────────────────────────────────────────────
  static Future<void> initialize() async {
    if (_initialized) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );

    await _plugin.initialize(
      const InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      ),
    );

    _initialized = true;
  }

  // ── Permission request ────────────────────────────────────────────────────
  static Future<bool> requestPermission() async {
    if (kIsWeb) return false;

    if (Platform.isIOS) {
      final plugin = _plugin
          .resolvePlatformSpecificImplementation<
              IOSFlutterLocalNotificationsPlugin>();
      final granted = await plugin?.requestPermissions(
        alert: true,
        badge: true,
        sound: true,
      );
      return granted ?? false;
    }

    if (Platform.isAndroid) {
      final status = await Permission.notification.request();
      return status.isGranted;
    }

    return false;
  }

  /// Returns true if the user has granted notification permission.
  static Future<bool> hasPermission() async {
    if (kIsWeb) return false;
    if (Platform.isIOS) {
      final status = await Permission.notification.status;
      return status.isGranted;
    }
    if (Platform.isAndroid) {
      final status = await Permission.notification.status;
      return status.isGranted;
    }
    return false;
  }

  // ── Android channel setup ─────────────────────────────────────────────────
  static Future<void> _ensureChannels() async {
    if (!Platform.isAndroid) return;
    final android = _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    if (android == null) return;

    await android.createNotificationChannel(const AndroidNotificationChannel(
      _chGeneral, 'Allgemein',
      description: 'Allgemeine App-Benachrichtigungen',
      importance: Importance.defaultImportance,
    ));
    await android.createNotificationChannel(const AndroidNotificationChannel(
      _chProject, 'Projekt Updates',
      description: 'Änderungen an Ihren Projekten',
      importance: Importance.high,
    ));
    await android.createNotificationChannel(const AndroidNotificationChannel(
      _chTask, 'Aufgaben',
      description: 'Neue und abgeschlossene Aufgaben',
      importance: Importance.high,
    ));
    await android.createNotificationChannel(const AndroidNotificationChannel(
      _chMessage, 'Nachrichten',
      description: 'Neue Nachrichten und Kommentare',
      importance: Importance.high,
    ));
    await android.createNotificationChannel(const AndroidNotificationChannel(
      _chWeekly, 'Wöchentliche Berichte',
      description: 'Wöchentliche Aktivitätszusammenfassung',
      importance: Importance.low,
    ));
  }

  // ── Core show helper ─────────────────────────────────────────────────────
  static Future<void> _show({
    required String title,
    required String body,
    required String channelId,
    String? channelName,
    Importance importance = Importance.defaultImportance,
    Priority priority = Priority.defaultPriority,
  }) async {
    if (!_initialized) await initialize();
    if (!Platform.isAndroid && !Platform.isIOS) return;

    await _ensureChannels();

    final android = AndroidNotificationDetails(
      channelId,
      channelName ?? 'DocStruc',
      channelDescription: 'DocStruc App',
      importance: importance,
      priority: priority,
      styleInformation: BigTextStyleInformation(body),
      color: const Color(0xFF0E2A47),
    );
    const ios = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    await _plugin.show(
      _newId(),
      title,
      body,
      NotificationDetails(android: android, iOS: ios),
    );
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /// Show notification for a new DB notification row based on its type.
  /// [settings] is the map from user_settings.settings.
  static Future<void> showForDbNotification(
    Map<String, dynamic> notification,
    Map<String, dynamic> settings,
  ) async {
    final type    = notification['type'] as String? ?? 'info';
    final title   = notification['title'] as String? ?? 'DocStruc';
    final message = notification['message'] as String? ?? '';

    // Check per-type user preference
    final allowed = _isTypeAllowed(type, settings);
    if (!allowed) return;

    String channelId;
    Importance importance;

    switch (type) {
      case 'project':
        channelId = _chProject;
        importance = Importance.high;
        break;
      case 'task':
        channelId = _chTask;
        importance = Importance.high;
        break;
      case 'message':
        channelId = _chMessage;
        importance = Importance.high;
        break;
      default:
        channelId = _chGeneral;
        importance = Importance.defaultImportance;
    }

    await _show(
      title: title,
      body: message,
      channelId: channelId,
      importance: importance,
      priority: importance == Importance.high ? Priority.high : Priority.defaultPriority,
    );
  }

  /// Show project update notification (e.g. new member, status change).
  static Future<void> showProjectUpdate({
    required String projectName,
    required String detail,
  }) =>
      _show(
        title: 'Projekt Update: $projectName',
        body: detail,
        channelId: _chProject,
        channelName: 'Projekt Updates',
        importance: Importance.high,
        priority: Priority.high,
      );

  /// Show task notification (assignment, completion).
  static Future<void> showTaskUpdate({
    required String taskTitle,
    required String detail,
  }) =>
      _show(
        title: 'Aufgabe: $taskTitle',
        body: detail,
        channelId: _chTask,
        channelName: 'Aufgaben',
        importance: Importance.high,
        priority: Priority.high,
      );

  /// Show message notification.
  static Future<void> showMessage({
    required String sender,
    required String preview,
  }) =>
      _show(
        title: 'Neue Nachricht von $sender',
        body: preview,
        channelId: _chMessage,
        channelName: 'Nachrichten',
        importance: Importance.high,
        priority: Priority.high,
      );

  /// Show weekly report summary.
  static Future<void> showWeeklySummary({
    required String summary,
  }) =>
      _show(
        title: '📊 Ihre Wochenzusammenfassung',
        body: summary,
        channelId: _chWeekly,
        channelName: 'Wöchentliche Berichte',
        importance: Importance.low,
        priority: Priority.low,
      );

  /// Cancel all pending notifications.
  static Future<void> cancelAll() => _plugin.cancelAll();

  // ── Private helpers ──────────────────────────────────────────────────────
  static bool _isTypeAllowed(String type, Map<String, dynamic> settings) {
    // Master switch
    if (settings['pushNotifications'] == false) return false;

    switch (type) {
      case 'project':
        return settings['projectUpdates'] != false;
      case 'task':
        return settings['taskUpdates'] != false;
      case 'message':
        return settings['messages'] != false;
      case 'defect':
        return settings['defectUpdates'] != false;
      default:
        return true;
    }
  }
}
