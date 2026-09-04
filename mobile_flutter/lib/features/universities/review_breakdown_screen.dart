import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/university_reviews_api.dart';
import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart' show UserRole;
import '../../widgets/app_widgets.dart';
import 'review_choices.dart';
import 'review_widgets.dart';
import 'university_review_screen.dart';

/// Full review breakdown for one university — the screen the summary
/// card's "See full review breakdown" arrow pushes into. Every number here
/// comes from the same real aggregate (GET .../reviews/summary) or the
/// actual review list — no fabricated categories or distributions.
class ReviewBreakdownScreen extends ConsumerWidget {
  const ReviewBreakdownScreen({
    super.key,
    required this.universityId,
    required this.universityName,
  });

  final String universityId;
  final String universityName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summaryAsync = ref.watch(
      universityReviewSummaryProvider(universityId),
    );
    final reviewsAsync = ref.watch(universityReviewsListProvider(universityId));
    final hasReviewedAsync = ref.watch(
      hasReviewedUniversityProvider(universityId),
    );
    final myProfile = ref.watch(myProfileProvider).asData?.value;
    // A mentor's verification ties them to exactly one college — they can
    // only review that one, not any college they're merely browsing.
    final canReview =
        myProfile?.role == UserRole.mentor &&
        myProfile?.verificationStatus == 'VERIFIED' &&
        myProfile?.universityId == universityId;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text(universityName)),
      body: SafeArea(
        child: summaryAsync.when(
          loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.primary),
          ),
          error: (err, _) => const EmptyState(
            icon: Icons.wifi_off_rounded,
            title: 'Could not load reviews',
            message: 'Pull to refresh to try again.',
          ),
          data: (summary) => RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async {
              ref.invalidate(universityReviewSummaryProvider(universityId));
              ref.invalidate(universityReviewsListProvider(universityId));
            },
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Center(
                  child: Column(
                    children: [
                      ReviewScoreRing(value: summary.overallAverage, size: 96),
                      const SizedBox(height: AppSpacing.sm),
                      if (summary.overallAverage != null)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            for (var i = 1; i <= 5; i++)
                              Icon(
                                i <= summary.overallAverage!.round()
                                    ? Icons.star_rounded
                                    : Icons.star_border_rounded,
                                size: 20,
                                color: AppColors.warning,
                              ),
                          ],
                        ),
                      const SizedBox(height: 4),
                      Text(
                        '${summary.reviewCount} verified review${summary.reviewCount == 1 ? '' : 's'} from students & alumni',
                        style: const TextStyle(
                          fontSize: AppFont.sm,
                          color: AppColors.textMuted,
                        ),
                      ),
                      if (summary.recommendPercent != null) ...[
                        const SizedBox(height: AppSpacing.sm),
                        RecommendPill(percent: summary.recommendPercent!),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                if (summary.academics != null ||
                    summary.campusLife != null ||
                    summary.workload != null ||
                    summary.careerValue != null) ...[
                  const Text(
                    'Rated by Category',
                    style: TextStyle(
                      fontSize: AppFont.md,
                      fontWeight: AppFont.extraBold,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  AppCard(
                    child: Column(
                      children: [
                        CategoryRatingBar(
                          label: 'Academics',
                          value: summary.academics,
                          subtitle:
                              'Teaching quality, curriculum & practical exposure',
                        ),
                        CategoryRatingBar(
                          label: 'Campus Life',
                          value: summary.campusLife,
                          subtitle: 'How healthy and supportive the environment is',
                        ),
                        CategoryRatingBar(
                          label: 'Workload',
                          value: summary.workload,
                          subtitle: 'How manageable the schedule and duty hours are',
                        ),
                        CategoryRatingBar(
                          label: 'Career Value',
                          value: summary.careerValue,
                          subtitle: 'How well it prepares you for the career ahead',
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ],
                Builder(
                  builder: (context) {
                    final dists = [
                      for (final spec in kReviewChoices)
                        (
                          spec,
                          summary.choiceDistributions[spec.field] ??
                              const <String, int>{},
                        ),
                    ].where((e) => e.$2.values.any((n) => n > 0)).toList();
                    if (dists.isEmpty) return const SizedBox.shrink();
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Student Experience Breakdown',
                          style: TextStyle(
                            fontSize: AppFont.md,
                            fontWeight: AppFont.extraBold,
                          ),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Tap any card for the full split',
                          style: TextStyle(
                            fontSize: AppFont.xs,
                            color: AppColors.textMuted,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        for (final (spec, dist) in dists)
                          ChoiceDistributionCard(
                            spec: spec,
                            distribution: dist,
                          ),
                        const SizedBox(height: AppSpacing.lg),
                      ],
                    );
                  },
                ),
                if (summary.tagCounts.isNotEmpty) ...[
                  const Text(
                    'Student Highlights',
                    style: TextStyle(
                      fontSize: AppFont.md,
                      fontWeight: AppFont.extraBold,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xs,
                    children: [
                      for (final entry in summary.tagCounts.entries)
                        ReviewTagChip(tag: entry.key, count: entry.value),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ],
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'From the Reviews',
                      style: TextStyle(
                        fontSize: AppFont.md,
                        fontWeight: AppFont.extraBold,
                      ),
                    ),
                    if (canReview)
                      TextButton.icon(
                        onPressed: () => openUniversityReview(
                          context,
                          ref,
                          universityId: universityId,
                          universityName: universityName,
                        ),
                        icon: const Icon(Icons.edit_rounded, size: 16),
                        label: Text(
                          hasReviewedAsync.value == true
                              ? 'Edit your review'
                              : 'Write a review',
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                reviewsAsync.when(
                  loading: () =>
                      const Column(children: [SkeletonCard(), SkeletonCard()]),
                  error: (err, _) => const EmptyState(
                    icon: Icons.wifi_off_rounded,
                    title: 'Could not load reviews',
                    message: 'Pull to refresh to try again.',
                  ),
                  data: (reviews) => reviews.isEmpty
                      ? const EmptyState(
                          icon: Icons.rate_review_rounded,
                          title: 'No reviews yet',
                          message:
                              'Waiting for a verified mentor from this college to write one.',
                        )
                      : Column(
                          children: [
                            for (final review in reviews) ...[
                              ReviewCard(review: review),
                              const SizedBox(height: AppSpacing.md),
                            ],
                          ],
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
