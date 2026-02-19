import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/notifications_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    ref.read(notificationsProvider.notifier).load();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(notificationsProvider);
    final notifications = state.notifications;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Benachrichtigungen'),
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft),
          onPressed: () => context.go('/'),
        ),
        actions: [
          if (state.unreadCount > 0)
            TextButton.icon(
              onPressed: () =>
                  ref.read(notificationsProvider.notifier).markAllRead(),
              icon: const Icon(LucideIcons.checkCheck, size: 16),
              label: const Text('Alle gelesen',
                  style: TextStyle(fontSize: 13)),
            ),
        ],
      ),
      body: notifications.isEmpty && !state.loading
          ? _buildEmpty()
          : RefreshIndicator(
              onRefresh: () =>
                  ref.read(notificationsProvider.notifier).load(),
              color: AppColors.primary,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.screenH,
                  vertical: AppSpacing.m,
                ),
                itemCount: notifications.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(height: 8),
                itemBuilder: (_, i) =>
                    _NotificationTile(notification: notifications[i]),
              ),
            ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: const Icon(LucideIcons.bellOff,
                size: 36, color: AppColors.primary),
          ),
          const SizedBox(height: 20),
          const Text(
            'Keine Benachrichtigungen',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: AppColors.text,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Hier erscheinen Ihre Benachrichtigungen.',
            style: TextStyle(
              fontSize: 14,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _NotificationTile extends ConsumerWidget {
  final Map<String, dynamic> notification;
  const _NotificationTile({required this.notification});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final title = notification['title'] as String? ?? '';
    final message = notification['message'] as String? ?? '';
    final isRead = notification['is_read'] == true;
    final type = notification['type'] as String? ?? 'info';
    final createdAt = notification['created_at'] as String?;

    String timeAgo = '';
    if (createdAt != null) {
      try {
        final dt = DateTime.parse(createdAt);
        final diff = DateTime.now().difference(dt);
        if (diff.inMinutes < 1) {
          timeAgo = 'Gerade eben';
        } else if (diff.inMinutes < 60) {
          timeAgo = 'Vor ${diff.inMinutes} Min.';
        } else if (diff.inHours < 24) {
          timeAgo = 'Vor ${diff.inHours} Std.';
        } else if (diff.inDays < 7) {
          timeAgo = 'Vor ${diff.inDays} Tag${diff.inDays == 1 ? '' : 'en'}';
        } else {
          timeAgo = DateFormat('dd.MM.yyyy').format(dt);
        }
      } catch (_) {}
    }

    final iconData = _typeIcon(type);
    final iconColor = _typeColor(type);

    return GestureDetector(
      onTap: () {
        if (!isRead) {
          ref
              .read(notificationsProvider.notifier)
              .markRead(notification['id'] as String);
        }
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isRead ? AppColors.surface : AppColors.primary.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isRead ? AppColors.border : AppColors.primary.withValues(alpha: 0.15),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(iconData, size: 18, color: iconColor),
            ),
            const SizedBox(width: 12),
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight:
                                isRead ? FontWeight.w500 : FontWeight.w700,
                            color: AppColors.text,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (!isRead)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  if (message.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      message,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 6),
                  Text(
                    timeAgo,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textTertiary,
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

  static IconData _typeIcon(String type) {
    switch (type) {
      case 'task':
        return LucideIcons.checkSquare;
      case 'message':
        return LucideIcons.messageCircle;
      case 'project':
        return LucideIcons.building2;
      case 'file':
        return LucideIcons.fileUp;
      case 'member':
        return LucideIcons.userPlus;
      case 'warning':
        return LucideIcons.alertTriangle;
      default:
        return LucideIcons.bell;
    }
  }

  static Color _typeColor(String type) {
    switch (type) {
      case 'task':
        return AppColors.info;
      case 'message':
        return AppColors.accent;
      case 'project':
        return AppColors.primary;
      case 'file':
        return AppColors.success;
      case 'member':
        return const Color(0xFF8B5CF6);
      case 'warning':
        return AppColors.warning;
      default:
        return AppColors.textSecondary;
    }
  }
}
