import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/university_reviews_api.dart';
import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart' show UserRole;
import '../../widgets/app_widgets.dart';
import 'review_widgets.dart';

/// The review-summary content itself — score ring, recommend %, category
/// bars, top tags, and a "See full review breakdown" footer — with no
/// AppCard wrapper of its own, so a caller that already has its own card
/// (e.g. UniversityCard, which puts the college's name/location above this)
/// can embed it directly instead of nesting two cards. [ReviewSummaryCard]
/// below is the standalone version for anywhere else.
///
/// Every number is a real aggregate from GET /universities/:id/reviews/
/// summary. `fallbackRating`/`fallbackReviewCount` come from the University
/// object already in hand (list/detail responses already attach
/// {rating, reviewCount}), so something renders instantly while the richer
/// per-category summary loads in behind it.
class ReviewSummaryBody extends ConsumerWidget {
  const ReviewSummaryBody({
    super.key,
    required this.universityId,
    required this.fallbackRating,
    required this.fallbackReviewCount,
  });

  final String universityId;
  final double? fallbackRating;
  final int fallbackReviewCount;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summaryAsync = ref.watch(
      universityReviewSummaryProvider(universityId),
    );
    final summary = summaryAsync.value;
    final reviewCount = summary?.reviewCount ?? fallbackReviewCount;

    if (reviewCount == 0) {
      // Only a verified mentor reviewing their own college can ever act on
      // "be the first to review" — aspirants are prospective, not yet
      // attending, so they structurally can't write one (see
      // ReviewBreakdownScreen's canReview). Inviting them to anyway is a
      // dead end, so the copy only promises what the viewer can actually do.
      final myProfile = ref.watch(myProfileProvider).asData?.value;
      final canReview =
          myProfile?.role == UserRole.mentor &&
          myProfile?.verificationStatus == 'VERIFIED' &&
          myProfile?.universityId == universityId;
      return Row(
        children: [
          const Icon(
            Icons.rate_review_outlined,
            color: AppColors.textMuted,
            size: 22,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              canReview
                  ? 'No reviews yet — be the first to review'
                  : 'No reviews yet',
              style: const TextStyle(
                fontSize: AppFont.sm,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
        ],
      );
    }

    final overall = summary?.overallAverage ?? fallbackRating;
    final categories = <(String, double?)>[
      ('Academics', summary?.academics),
      ('Campus Life', summary?.campusLife),
      ('Workload', summary?.workload),
      ('Career Value', summary?.careerValue),
    ].where((c) => c.$2 != null).toList();

    final topTags = (summary?.tagCounts.entries.toList() ?? [])
      ..sort((a, b) => b.value.compareTo(a.value));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ReviewScoreRing(value: overall),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (summary?.recommendPercent != null)
                    RecommendPill(percent: summary!.recommendPercent!),
                  const SizedBox(height: 6),
                  Text(
                    'Based on $reviewCount verified review${reviewCount == 1 ? '' : 's'}',
                    style: const TextStyle(
                      fontSize: AppFont.xs,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        if (categories.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          for (final (label, value) in categories)
            CategoryRatingBar(label: label, value: value),
        ],
        if (topTags.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final entry in topTags.take(4))
                ReviewTagChip(tag: entry.key, count: entry.value),
            ],
          ),
        ],
        const SizedBox(height: AppSpacing.sm),
        const Divider(height: 1, color: AppColors.border),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'See full review breakdown',
                    style: TextStyle(
                      fontSize: AppFont.sm,
                      fontWeight: AppFont.bold,
                    ),
                  ),
                  Text(
                    '$reviewCount verified review${reviewCount == 1 ? '' : 's'}',
                    style: const TextStyle(
                      fontSize: AppFont.xs,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              width: 34,
              height: 34,
              decoration: const BoxDecoration(
                gradient: AppGradients.brand,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.arrow_forward_rounded,
                color: Colors.white,
                size: 18,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// Standalone card version of [ReviewSummaryBody] — its own AppCard, whole
/// thing tappable into the full review breakdown.
class ReviewSummaryCard extends StatelessWidget {
  const ReviewSummaryCard({
    super.key,
    required this.universityId,
    required this.fallbackRating,
    required this.fallbackReviewCount,
    required this.onTap,
  });

  final String universityId;
  final double? fallbackRating;
  final int fallbackReviewCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      child: ReviewSummaryBody(
        universityId: universityId,
        fallbackRating: fallbackRating,
        fallbackReviewCount: fallbackReviewCount,
      ),
    );
  }
}
