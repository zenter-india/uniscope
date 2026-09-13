import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/notifications_api.dart';
import '../../core/network/sessions_api.dart' show Session;
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import '../sessions/session_list_screen.dart' show sessionsListProvider;

final notificationsListProvider = FutureProvider.autoDispose<List<AppNotification>>(
  (ref) => ref.watch(notificationsApiProvider).list(),
);

final unreadCountProvider = FutureProvider.autoDispose<int>(
  (ref) => ref.watch(notificationsApiProvider).unreadCount(),
);

/// Notification types that represent a step in one call's lifecycle rather
/// than a standalone event — a single call can fire 2-3 of these in a row
/// (accepted -> starting -> ended), which used to list as that many
/// near-identical rows. Grouped by `sessionId` in `_groupNotifications`;
/// everything else (a chat message, a payment, a review) stays one row.
const _callLifecycleTypes = {
  'SESSION_REQUEST',
  'SESSION_ACCEPTED',
  'SESSION_REJECTED',
  'SESSION_CANCELLED',
  'SESSION_RESCHEDULED',
  'SESSION_STARTING',
  'SESSION_ENDED',
};

/// Collapses consecutive call-lifecycle notifications that share a
/// `sessionId` into one group, positioned where the most recent of them
/// would have sorted (the list is already newest-first from the backend,
/// so the first occurrence of a session id is that position). Everything
/// else stays a singleton group, rendering exactly as before.
List<List<AppNotification>> _groupNotifications(List<AppNotification> items) {
  final groups = <List<AppNotification>>[];
  final bySession = <String, List<AppNotification>>{};
  for (final n in items) {
    final sid = n.sessionId;
    if (sid != null && _callLifecycleTypes.contains(n.type)) {
      final existing = bySession[sid];
      if (existing != null) {
        existing.add(n);
        continue;
      }
      final group = [n];
      bySession[sid] = group;
      groups.add(group);
    } else {
      groups.add([n]);
    }
  }
  return groups;
}

/// The other party on a notification's session, resolved client-side from
/// the already-fetched Sessions list rather than a backend change — the
/// notification's own `metadata` only ever carries `sessionId` (plus
/// occasional booking fields), never a counterpart id or avatar URL.
class _Counterpart {
  const _Counterpart({required this.name, this.avatarUrl});
  final String name;
  final String? avatarUrl;
}

_Counterpart? _counterpartFor(
  String? sessionId,
  Map<String, Session> sessionsById,
  String? myUserId,
) {
  if (sessionId == null || myUserId == null) return null;
  final session = sessionsById[sessionId];
  if (session == null) return null;
  return session.aspirantId == myUserId
      ? _Counterpart(name: session.mentorName, avatarUrl: session.mentorAvatarUrl)
      : _Counterpart(name: session.aspirantName, avatarUrl: session.aspirantAvatarUrl);
}

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
                : Builder(
                    builder: (context) {
                      final groups = _groupNotifications(items);
                      return ListView.builder(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        itemCount: groups.length,
                        itemBuilder: (_, i) =>
                            _NotificationGroupTile(items: groups[i]),
                      );
                    },
                  ),
          ),
        ),
      ),
    );
  }
}

(IconData, Color) _iconFor(String type) {
  switch (type) {
    case 'SESSION_REQUEST':
      return (Icons.forum_rounded, AppColors.info);
    case 'SESSION_ACCEPTED':
      return (Icons.check_circle_rounded, AppColors.primary);
    case 'SESSION_REJECTED':
      return (Icons.cancel_rounded, AppColors.error);
    case 'SESSION_CANCELLED':
      return (Icons.event_busy_rounded, AppColors.error);
    case 'SESSION_RESCHEDULED':
      return (Icons.event_repeat_rounded, AppColors.info);
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

Future<void> _openNotification(
  BuildContext context,
  WidgetRef ref,
  AppNotification notification,
) async {
  if (!notification.isRead) {
    await ref.read(notificationsApiProvider).markRead(notification.id);
    ref.invalidate(notificationsListProvider);
    ref.invalidate(unreadCountProvider);
  }
  if (notification.sessionId == null || !context.mounted) return;
  // `/chats` and `/chats/room` are StatefulShellBranch routes (the Sessions
  // tab) — they must be reached with `go` (switch to the tab), never `push`,
  // which stacks a shell location on the root navigator and renders a blank
  // screen while wedging the tab bar. Mirrors
  // push_service._handleDeepLinkData's `router.go`.
  if (notification.type == 'MESSAGE') {
    context.go('/chats/room', extra: {'sessionId': notification.sessionId});
  } else {
    context.go('/chats');
  }
}

/// Renders one row of the notifications list: a singleton group looks
/// exactly like the old flat list; a grouped call thread (>1 item sharing a
/// session) adds an unread-aware header, a chevron to expand, and the older
/// events listed underneath when expanded. Tapping the header always
/// navigates (same as a single notification always did) — the chevron is
/// the only way to expand without leaving the screen.
class _NotificationGroupTile extends ConsumerStatefulWidget {
  const _NotificationGroupTile({required this.items});
  final List<AppNotification> items;

  @override
  ConsumerState<_NotificationGroupTile> createState() =>
      _NotificationGroupTileState();
}

class _NotificationGroupTileState
    extends ConsumerState<_NotificationGroupTile> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final items = widget.items;
    final head = items.first;
    final hasUnread = items.any((n) => !n.isRead);
    final sessionsById = {
      for (final s in ref.watch(sessionsListProvider).value ?? const <Session>[])
        s.id: s,
    };
    final myUserId = ref.watch(authControllerProvider).user?.id;
    final counterpart = _counterpartFor(head.sessionId, sessionsById, myUserId);
    final (icon, color) = _iconFor(head.type);

    Future<void> markGroupRead() async {
      final unreadIds = items.where((n) => !n.isRead).map((n) => n.id);
      if (unreadIds.isEmpty) return;
      final api = ref.read(notificationsApiProvider);
      for (final id in unreadIds) {
        await api.markRead(id);
      }
      ref.invalidate(notificationsListProvider);
      ref.invalidate(unreadCountProvider);
    }

    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      color: hasUnread ? AppColors.primaryLight : AppColors.surface,
      onTap: () async {
        await markGroupRead();
        if (context.mounted) await _openNotification(context, ref, head);
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (counterpart != null)
                AppAvatar(
                  name: counterpart.name,
                  avatarUrl: counterpart.avatarUrl,
                  size: 38,
                )
              else
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
                    Text(
                      head.title,
                      style: const TextStyle(
                        fontWeight: AppFont.bold,
                        fontSize: AppFont.sm,
                      ),
                    ),
                    if (head.body != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          head.body!,
                          style: const TextStyle(
                            fontSize: AppFont.xs,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                    const SizedBox(height: 4),
                    Text(
                      _timeAgo(head.createdAt),
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
              if (hasUnread)
                Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.only(top: 4, left: 4),
                  decoration: const BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                  ),
                ),
              if (items.length > 1)
                Padding(
                  padding: const EdgeInsets.only(left: 4),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => setState(() => _expanded = !_expanded),
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: Icon(
                        _expanded
                            ? Icons.expand_less_rounded
                            : Icons.expand_more_rounded,
                        size: 20,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.sm, left: 46),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: items
                    .skip(1)
                    .map((n) => _NotificationSubRow(notification: n))
                    .toList(),
              ),
            ),
        ],
      ),
    );
  }
}

/// One older event inside an expanded call-thread group — a compact,
/// individually tappable line rather than a full card, since the header
/// above it already carries the avatar and latest status.
class _NotificationSubRow extends ConsumerWidget {
  const _NotificationSubRow({required this.notification});
  final AppNotification notification;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final (icon, color) = _iconFor(notification.type);
    return InkWell(
      onTap: () => _openNotification(context, ref, notification),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Text(
                notification.title,
                style: TextStyle(
                  fontSize: AppFont.xs,
                  fontWeight: notification.isRead
                      ? FontWeight.normal
                      : AppFont.bold,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Text(
              _timeAgo(notification.createdAt),
              style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
            ),
            if (!notification.isRead)
              Container(
                width: 6,
                height: 6,
                margin: const EdgeInsets.only(left: 6),
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
