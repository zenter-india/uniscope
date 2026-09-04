import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/mentors_api.dart' show MentorDashboardRecentSession;
import '../../core/network/reviews_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import '../mentors/mentor_reviews_screen.dart' show myMentorReviewsProvider;
import '../universities/university_review_screen.dart'
    show CollegeReviewPromptBanner;
import 'mentor_home_screen.dart' show mentorDashboardStatsProvider;

/// Mentor's Home tab — kept as the original rich overview (greeting,
/// Today's Overview stats, Recent Sessions, Reviews, support banner), per
/// explicit request to revert Home specifically after the Dashboard tab was
/// introduced alongside it. Yes, this overlaps with Dashboard's content —
/// that's intentional, not an oversight.
class MentorLandingScreen extends ConsumerWidget {
  const MentorLandingScreen({super.key});

  String get _greeting {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final displayName = ref.watch(authControllerProvider).user?.displayName;
    final firstName = displayName?.split(' ').first;
    final statsAsync = ref.watch(mentorDashboardStatsProvider);
    final reviewsAsync = ref.watch(myMentorReviewsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          ref.invalidate(mentorDashboardStatsProvider);
          ref.invalidate(myMentorReviewsProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                decoration: const BoxDecoration(gradient: AppGradients.hero),
                child: SafeArea(
                  bottom: false,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.md,
                          AppSpacing.md,
                          AppSpacing.md,
                          0,
                        ),
                        child: Row(
                          children: [
                            Image.asset(
                              'assets/logo/uniscope_icon.png',
                              width: 22,
                              height: 22,
                              fit: BoxFit.contain,
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Text(
                              'Uniscope',
                              style: TextStyle(
                                fontSize: AppFont.sm,
                                fontWeight: AppFont.bold,
                                color: AppColors.textPrimary.withValues(
                                  alpha: 0.75,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.md,
                          AppSpacing.sm,
                          AppSpacing.md,
                          AppSpacing.lg,
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    firstName == null
                                        ? _greeting
                                        : '$_greeting, $firstName!',
                                    style: const TextStyle(
                                      fontSize: AppFont.xl,
                                      fontWeight: AppFont.extraBold,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  const Text(
                                    "Here's an overview of your mentoring activity",
                                    style: TextStyle(
                                      fontSize: AppFont.sm,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const NotificationBell(),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const CollegeReviewPromptBanner(),
                    const Text(
                      "Today's Overview",
                      style: TextStyle(
                        fontSize: AppFont.lg,
                        fontWeight: AppFont.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    statsAsync.when(
                      loading: () => const Column(
                        children: [SkeletonCard(), SkeletonCard()],
                      ),
                      error: (_, __) => const SizedBox.shrink(),
                      data: (stats) => Column(
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: _StatTile(
                                  value: '${stats.todaysSessionsCount}',
                                  label: "Today's Sessions",
                                  icon: Icons.calendar_today_rounded,
                                  color: AppColors.primary,
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: _StatTile(
                                  value: '${stats.minutesConsultedToday} min',
                                  label: 'Minutes Consulted',
                                  icon: Icons.timer_outlined,
                                  color: AppColors.primary,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Row(
                            children: [
                              Expanded(
                                child: _StatTile(
                                  value:
                                      '₹${stats.weeklyEarningsRupees.toStringAsFixed(0)}',
                                  label: 'Weekly Earnings',
                                  icon: Icons.account_balance_wallet_rounded,
                                  color: AppColors.warning,
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: _StatTile(
                                  value:
                                      stats.rating?.toStringAsFixed(1) ?? '—',
                                  label: 'Average Rating',
                                  icon: Icons.star_rounded,
                                  color: AppColors.warning,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    SectionHeader(
                      title: 'Recent Sessions',
                      onSeeAll: () => context.go('/chats'),
                    ),
                    const SizedBox(height: AppSpacing.md),
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
                    const SizedBox(height: AppSpacing.lg),
                    SectionHeader(
                      title: 'Reviews',
                      onSeeAll: () => context.push('/profile/reviews'),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    reviewsAsync.when(
                      loading: () => const SkeletonCard(),
                      error: (_, __) => const SizedBox.shrink(),
                      data: (reviews) => reviews.isEmpty
                          ? const EmptyState(
                              icon: Icons.star_outline_rounded,
                              title: 'No reviews yet',
                              message:
                                  'Reviews from aspirants will appear here.',
                            )
                          : Column(
                              children: reviews
                                  .take(3)
                                  .map((r) => _ReviewCard(review: r))
                                  .toList(),
                            ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppCard(
                      onTap: () => context.push('/chats/support'),
                      child: const Row(
                        children: [
                          Icon(
                            Icons.chat_bubble_outline_rounded,
                            color: AppColors.primary,
                          ),
                          SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Need Help?',
                                  style: TextStyle(
                                    fontSize: AppFont.md,
                                    fontWeight: AppFont.bold,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                Text(
                                  'Chat with our support team anytime.',
                                  style: TextStyle(
                                    fontSize: AppFont.xs,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.value,
    required this.label,
    required this.icon,
    required this.color,
  });

  final String value;
  final String label;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: AppFont.lg,
                    fontWeight: AppFont.extraBold,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
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
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: Icon(icon, size: 16, color: color),
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
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '₹${session.earnedRupees.toStringAsFixed(0)}',
                style: const TextStyle(
                  fontSize: AppFont.md,
                  fontWeight: AppFont.bold,
                  color: AppColors.success,
                ),
              ),
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
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.review});

  final MentorReview review;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: List.generate(5, (i) {
              return Icon(
                i < review.rating
                    ? Icons.star_rounded
                    : Icons.star_border_rounded,
                size: 16,
                color: AppColors.warning,
              );
            }),
          ),
          if (review.comment != null && review.comment!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              review.comment!,
              style: const TextStyle(
                fontSize: AppFont.sm,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
