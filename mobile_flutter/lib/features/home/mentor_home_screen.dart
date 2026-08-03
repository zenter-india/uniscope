import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/mentors_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';
import '../profile/profile_home_screen.dart' show MentorAvailabilityCard;

final mentorDashboardStatsProvider =
    FutureProvider.autoDispose<MentorDashboardStats>((ref) {
      return ref.watch(mentorsApiProvider).getDashboardStats();
    });

/// Mentor's Dashboard tab — earnings summary + activity analytics, distinct
/// from the lighter Home landing tab. Matches the reference design: a
/// gradient earnings card with an inline Withdraw shortcut, a 2x2 stat grid,
/// and a recent-sessions list.
///
/// One honest substitution from the reference: it shows a "Response rate"
/// tile, which isn't a metric this app tracks anywhere (no accept/decline
/// timing is recorded) — rather than fabricate a number, that tile shows
/// Reviews count instead, which is real.
class MentorDashboardScreen extends ConsumerWidget {
  const MentorDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(mentorDashboardStatsProvider);

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
        onRefresh: () async => ref.invalidate(mentorDashboardStatsProvider),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              statsAsync.when(
                loading: () => const SkeletonCard(),
                error: (_, __) => const SizedBox.shrink(),
                data: (stats) => _EarningsCard(stats: stats),
              ),
              const SizedBox(height: AppSpacing.md),
              const MentorAvailabilityCard(),
              const SizedBox(height: AppSpacing.md),
              statsAsync.when(
                loading: () =>
                    const Column(children: [SkeletonCard(), SkeletonCard()]),
                error: (_, __) => const SizedBox.shrink(),
                data: (stats) => Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _StatTile(
                            value: '${stats.totalSessionsCount}',
                            label: 'Total sessions',
                            icon: Icons.forum_rounded,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: _StatTile(
                            value: stats.rating?.toStringAsFixed(1) ?? '—',
                            label: 'Avg rating',
                            icon: Icons.star_rounded,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        Expanded(
                          child: _StatTile(
                            value: '${stats.reviewCount}',
                            label: 'Reviews',
                            icon: Icons.rate_review_rounded,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: _StatTile(
                            value: '${stats.totalMinutesConsulted}',
                            label: 'Minutes',
                            icon: Icons.timer_outlined,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              SectionHeader(
                title: 'Recent sessions',
                onSeeAll: () => context.go('/chats'),
              ),
              const SizedBox(height: AppSpacing.sm),
              statsAsync.when(
                loading: () => const SkeletonCard(),
                error: (_, __) => const SizedBox.shrink(),
                data: (stats) => stats.recentSessions.isEmpty
                    ? const EmptyState(
                        icon: Icons.event_busy_rounded,
                        title: 'No sessions yet',
                        message: 'Completed sessions will show up here.',
                      )
                    : Column(
                        children: stats.recentSessions
                            .map((s) => _RecentSessionCard(session: s))
                            .toList(),
                      ),
              ),
              const SizedBox(height: AppSpacing.xl),
            ],
          ),
        ),
      ),
    );
  }
}

class _EarningsCard extends StatelessWidget {
  const _EarningsCard({required this.stats});
  final MentorDashboardStats stats;

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
                "This month's earnings",
                style: TextStyle(color: Colors.white70, fontSize: AppFont.sm),
              ),
              const Spacer(),
              Icon(
                Icons.currency_rupee_rounded,
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
                '₹${stats.monthlyEarningsRupees.toStringAsFixed(0)}',
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
                onPressed: () => context.go('/wallet'),
                icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                label: const Text('Withdraw'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.value,
    required this.label,
    required this.icon,
  });
  final String value;
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
              color: AppColors.primaryLight,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 18, color: AppColors.primary),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: AppFont.lg,
                    fontWeight: AppFont.extraBold,
                  ),
                ),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: AppFont.xs,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RecentSessionCard extends StatelessWidget {
  const _RecentSessionCard({required this.session});
  final MentorDashboardRecentSession session;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      onTap: () => context.push(
        '/chats/room',
        extra: {'sessionId': session.id},
      ),
      child: Row(
        children: [
          AppAvatar(name: session.aspirantDisplayName, size: 40),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  session.aspirantDisplayName,
                  style: const TextStyle(
                    fontSize: AppFont.md,
                    fontWeight: AppFont.bold,
                  ),
                ),
                Row(
                  children: [
                    const Icon(
                      Icons.access_time_rounded,
                      size: 12,
                      color: AppColors.textSecondary,
                    ),
                    const SizedBox(width: 2),
                    Text(
                      '${session.billedMinutes} min',
                      style: const TextStyle(
                        fontSize: AppFont.xs,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Text(
            '+₹${session.earnedRupees.toStringAsFixed(0)}',
            style: const TextStyle(
              fontSize: AppFont.md,
              fontWeight: AppFont.bold,
              color: AppColors.success,
            ),
          ),
          const Icon(
            Icons.chevron_right_rounded,
            size: 18,
            color: AppColors.textMuted,
          ),
        ],
      ),
    );
  }
}
