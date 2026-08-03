import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/notifications_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';

final notificationsListProvider = FutureProvider.autoDispose<List<AppNotification>>(
  (ref) => ref.watch(notificationsApiProvider).list(),
);

final unreadCountProvider = FutureProvider.autoDispose<int>(
  (ref) => ref.watch(notificationsApiProvider).unreadCount(),
);

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsListProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () async {
              await ref.read(notificationsApiProvider).markAllRead();
              ref.invalidate(notificationsListProvider);
              ref.invalidate(unreadCountProvider);
            },
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            ref.invalidate(notificationsListProvider);
            ref.invalidate(unreadCountProvider);
            await ref.read(notificationsListProvider.future);
          },
          child: notificationsAsync.when(
            loading: () => ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: const [SkeletonCard(), SkeletonCard(), SkeletonCard()],
            ),
            error: (err, _) => ListView(
              children: [
                EmptyState(
                  icon: Icons.wifi_off_rounded,
                  title: 'Could not load notifications',
                  message: 'Check your connection and pull to refresh.',
                  actionLabel: 'Retry',
                  onAction: () => ref.invalidate(notificationsListProvider),
                ),
              ],
            ),
            data: (items) => items.isEmpty
                ? ListView(
                    children: const [
                      SizedBox(height: 100),
                      EmptyState(
                        icon: Icons.notifications_none_rounded,
                        title: 'All caught up',
                        message: 'You\'ll see session requests and updates here.',
                      ),
                    ],
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    itemCount: items.length,
                    itemBuilder: (_, i) => _NotificationTile(notification: items[i]),
                  ),
          ),
        ),
      ),
    );
  }
}

class _NotificationTile extends ConsumerWidget {
  const _NotificationTile({required this.notification});
  final AppNotification notification;

  (IconData, Color) get _iconFor {
    switch (notification.type) {
      case 'SESSION_REQUEST':
        return (Icons.forum_rounded, AppColors.info);
      case 'SESSION_ACCEPTED':
        return (Icons.check_circle_rounded, AppColors.primary);
      case 'SESSION_REJECTED':
        return (Icons.cancel_rounded, AppColors.error);
      case 'SESSION_STARTING':
      case 'SESSION_ENDED':
        return (Icons.call_rounded, AppColors.primary);
      case 'LOW_BALANCE':
      case 'PAYMENT':
        return (Icons.account_balance_wallet_rounded, AppColors.warning);
      case 'REVIEW':
        return (Icons.star_rounded, AppColors.warning);
      case 'VERIFICATION':
        return (Icons.verified_user_rounded, AppColors.primary);
      default:
        return (Icons.notifications_rounded, AppColors.textMuted);
    }
  }

  String _timeAgo(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final (icon, color) = _iconFor;

    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      color: notification.isRead ? AppColors.surface : AppColors.primaryLight,
      onTap: () async {
        if (!notification.isRead) {
          await ref.read(notificationsApiProvider).markRead(notification.id);
          ref.invalidate(notificationsListProvider);
          ref.invalidate(unreadCountProvider);
        }
        if (notification.sessionId != null && context.mounted) {
          context.push('/chats');
        }
      },
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 18, color: color),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(notification.title,
                    style: const TextStyle(
                        fontWeight: AppFont.bold, fontSize: AppFont.sm)),
                if (notification.body != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(notification.body!,
                        style: const TextStyle(
                            fontSize: AppFont.xs,
                            color: AppColors.textSecondary)),
                  ),
                const SizedBox(height: 4),
                Text(_timeAgo(notification.createdAt),
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.textMuted)),
              ],
            ),
          ),
          if (!notification.isRead)
            Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.only(top: 4),
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
            ),
        ],
      ),
    );
  }
}
