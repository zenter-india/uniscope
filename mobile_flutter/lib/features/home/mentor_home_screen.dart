import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/mentors_api.dart';
import '../../core/network/notifications_api.dart';
import '../../core/network/payouts_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';
import '../profile/profile_home_screen.dart' show MentorAvailabilityCard;
import '../wallet/wallet_screen.dart' show walletBalanceProvider, mentorPayoutsProvider;

final mentorDashboardStatsProvider =
    FutureProvider.autoDispose<MentorDashboardStats>((ref) {
      return ref.watch(mentorsApiProvider).getDashboardStats();
    });

/// Latest few notifications, reused as the Dashboard's "Recent activity"
/// feed — this is the same real data the Notifications screen shows, not a
/// separate concept, just truncated to the first page here.
final mentorRecentActivityProvider =
    FutureProvider.autoDispose<List<AppNotification>>((ref) {
      return ref.watch(notificationsApiProvider).list();
    });

const _recentActivityLimit = 5;
const _payoutRequestsLimit = 5;

/// Mentor's Dashboard tab — wallet summary, payout requests, and recent
/// activity. Deliberately no vanity stat grid (total sessions/rating/
/// reviews/minutes were removed — the client wanted this screen focused on
/// money and what's actually happening, not a scoreboard) and no earnings
/// figure (that lived on the old "Earnings" tab, which this screen's wallet
/// card now replaces — see the Discover-tab change in app_router.dart for
/// the other half of that swap).
class MentorDashboardScreen extends ConsumerWidget {
  const MentorDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final walletAsync = ref.watch(walletBalanceProvider);
    final payoutsAsync = ref.watch(mentorPayoutsProvider);
    final activityAsync = ref.watch(mentorRecentActivityProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Mentor Dashboard'),
        actions: const [
          NotificationBell(),
          SizedBox(width: AppSpacing.sm),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          ref.invalidate(walletBalanceProvider);
          ref.invalidate(mentorPayoutsProvider);
          ref.invalidate(mentorRecentActivityProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              walletAsync.when(
                loading: () => const SkeletonCard(),
                error: (_, __) => const SizedBox.shrink(),
                data: (wallet) => _WalletCard(balanceRupees: wallet.balanceRupees),
              ),
              const SizedBox(height: AppSpacing.md),
              const MentorAvailabilityCard(),
              const SizedBox(height: AppSpacing.lg),

              SectionHeader(
                title: 'Recent activity',
                onSeeAll: () => context.push('/notifications'),
              ),
              const SizedBox(height: AppSpacing.sm),
              activityAsync.when(
                loading: () => const SkeletonCard(),
                error: (_, __) => const SizedBox.shrink(),
                data: (items) {
                  final recent = items.take(_recentActivityLimit).toList();
                  return recent.isEmpty
                      ? const EmptyState(
                          icon: Icons.notifications_none_rounded,
                          title: 'No activity yet',
                          message: 'Requests, messages, and updates will show up here.',
                        )
                      : Column(
                          children: recent
                              .map((n) => _RecentActivityCard(notification: n))
                              .toList(),
                        );
                },
              ),
              const SizedBox(height: AppSpacing.lg),

              SectionHeader(
                title: 'Payout requests',
                onSeeAll: () => context.push('/dashboard/wallet'),
              ),
              const SizedBox(height: AppSpacing.sm),
              payoutsAsync.when(
                loading: () => const SkeletonCard(),
                error: (_, __) => const SizedBox.shrink(),
                data: (payouts) {
                  final recent = payouts.take(_payoutRequestsLimit).toList();
                  return recent.isEmpty
                      ? const EmptyState(
                          icon: Icons.account_balance_wallet_outlined,
                          title: 'No payout requests yet',
                          message: 'Request a payout from your wallet once you\'re above the minimum.',
                        )
                      : Column(
                          children: recent
                              .map((p) => _PayoutRequestCard(payout: p))
                              .toList(),
                        );
                },
              ),
              const SizedBox(height: AppSpacing.xl),
            ],
          ),
        ),
      ),
    );
  }
}

class _WalletCard extends StatelessWidget {
  const _WalletCard({required this.balanceRupees});
  final double balanceRupees;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        gradient: AppGradients.brand,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.raised,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'Wallet balance',
                style: TextStyle(color: Colors.white70, fontSize: AppFont.sm),
              ),
              const Spacer(),
              Icon(
                Icons.account_balance_wallet_rounded,
                color: Colors.white.withValues(alpha: 0.5),
                size: 20,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                '₹${balanceRupees.toStringAsFixed(0)}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: AppFont.display,
                  fontWeight: AppFont.extraBold,
                ),
              ),
              const Spacer(),
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: AppColors.primaryDark,
                ),
                onPressed: () => context.push('/dashboard/wallet'),
                icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                label: const Text('View wallet'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RecentActivityCard extends StatelessWidget {
  const _RecentActivityCard({required this.notification});
  final AppNotification notification;

  (IconData, Color) get _iconFor {
    switch (notification.type) {
      case 'SESSION_REQUEST':
        return (Icons.calendar_today_rounded, AppColors.primary);
      case 'SESSION_ACCEPTED':
        return (Icons.check_circle_rounded, AppColors.success);
      case 'SESSION_REJECTED':
        return (Icons.cancel_rounded, AppColors.error);
      case 'SESSION_ENDED':
        return (Icons.call_end_rounded, AppColors.textSecondary);
      case 'MESSAGE':
        return (Icons.chat_bubble_rounded, AppColors.info);
      case 'REVIEW':
        return (Icons.star_rounded, AppColors.warning);
      case 'VERIFICATION':
        return (Icons.verified_user_rounded, AppColors.primary);
      default:
        return (Icons.notifications_rounded, AppColors.textMuted);
    }
  }

  String get _timeAgo {
    final dt = DateTime.tryParse(notification.createdAt);
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  @override
  Widget build(BuildContext context) {
    final (icon, color) = _iconFor;

    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      color: notification.isRead ? AppColors.surface : AppColors.primaryLight,
      onTap: notification.sessionId != null
          ? () => context.push(
                '/chats/room',
                extra: {'sessionId': notification.sessionId},
              )
          : null,
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
            child: Icon(icon, size: 16, color: color),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  notification.title,
                  style: const TextStyle(fontWeight: AppFont.bold, fontSize: AppFont.sm),
                ),
                if (notification.body != null)
                  Text(
                    notification.body!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: AppFont.xs, color: AppColors.textSecondary),
                  ),
              ],
            ),
          ),
          Text(
            _timeAgo,
            style: const TextStyle(fontSize: AppFont.xs, color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}

class _PayoutRequestCard extends StatelessWidget {
  const _PayoutRequestCard({required this.payout});
  final PayoutRequest payout;

  Color get _statusColor {
    switch (payout.status) {
      case 'COMPLETED':
        return AppColors.success;
      case 'FAILED':
        return AppColors.error;
      default:
        return AppColors.warning;
    }
  }

  String get _statusLabel {
    if (payout.isOverdue) return '${payout.status} (overdue)';
    return payout.status;
  }

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      onTap: () => context.push('/dashboard/wallet'),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '₹${payout.amountRupees.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontWeight: AppFont.extraBold,
                    fontSize: AppFont.sm,
                  ),
                ),
                if (payout.bankReference != null)
                  Text(
                    'Ref: ${payout.bankReference}',
                    style: const TextStyle(
                      fontSize: AppFont.xs,
                      color: AppColors.textSecondary,
                    ),
                  ),
              ],
            ),
          ),
          StatusChip(label: _statusLabel, color: _statusColor),
        ],
      ),
    );
  }
}
