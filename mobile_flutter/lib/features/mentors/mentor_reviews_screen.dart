import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/reviews_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';

/// Every review aspirants have left for the currently-signed-in mentor.
/// Distinct from `mentorReviewsListProvider` (mentor_detail_screen), which
/// is keyed by an arbitrary mentor id for the aspirant-facing profile — this
/// one always resolves to "my own reviews" and is the source for both the
/// Home tab's Reviews preview and the full [MentorReviewsScreen].
final myMentorReviewsProvider = FutureProvider.autoDispose<List<MentorReview>>((
  ref,
) async {
  final userId = ref.watch(authControllerProvider).user?.id;
  if (userId == null) return const [];
  return ref.watch(reviewsApiProvider).listForMentor(userId);
});

/// Mentor-only: the full list of reviews about me, with an average-rating
/// summary on top. Reached from the Profile tab and from the Home tab's
/// Reviews "See all". Reviews are written only from the aspirant's
/// post-session flow and stay anonymous by product design — no author name,
/// no reply path.
class MentorReviewsScreen extends ConsumerWidget {
  const MentorReviewsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviewsAsync = ref.watch(myMentorReviewsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Your Reviews')),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () => ref.refresh(myMentorReviewsProvider.future),
        child: reviewsAsync.when(
          loading: () => ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: const [SkeletonCard(), SkeletonCard(), SkeletonCard()],
          ),
          error: (_, __) => ListView(
            children: [
              EmptyState(
                icon: Icons.wifi_off_rounded,
                title: 'Could not load reviews',
                message: 'Check your connection and pull to refresh.',
                actionLabel: 'Retry',
                onAction: () => ref.invalidate(myMentorReviewsProvider),
              ),
            ],
          ),
          data: (reviews) => reviews.isEmpty
              ? ListView(
                  children: const [
                    SizedBox(height: 80),
                    EmptyState(
                      icon: Icons.star_outline_rounded,
                      title: 'No reviews yet',
                      message:
                          'Aspirants can rate you after a completed session. '
                          'Their reviews will show up here.',
                    ),
                  ],
                )
              : ListView(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  children: [
                    _RatingSummary(reviews: reviews),
                    const SizedBox(height: AppSpacing.md),
                    for (final review in reviews)
                      _ReviewTile(review: review),
                  ],
                ),
        ),
      ),
    );
  }
}

class _RatingSummary extends StatelessWidget {
  const _RatingSummary({required this.reviews});
  final List<MentorReview> reviews;

  @override
  Widget build(BuildContext context) {
    final count = reviews.length;
    final average =
        reviews.map((r) => r.rating).reduce((a, b) => a + b) / count;
    final rounded = average.round();

    return AppCard(
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                average.toStringAsFixed(1),
                style: const TextStyle(
                  fontSize: 34,
                  fontWeight: AppFont.extraBold,
                  color: AppColors.textPrimary,
                  height: 1,
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  for (var i = 0; i < 5; i++)
                    Icon(
                      i < rounded
                          ? Icons.star_rounded
                          : Icons.star_border_rounded,
                      size: 16,
                      color: AppColors.warning,
                    ),
                ],
              ),
            ],
          ),
          const SizedBox(width: AppSpacing.lg),
          Expanded(
            child: Text(
              count == 1 ? 'Based on 1 review' : 'Based on $count reviews',
              style: const TextStyle(
                fontSize: AppFont.sm,
                color: AppColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReviewTile extends StatelessWidget {
  const _ReviewTile({required this.review});
  final MentorReview review;

  /// Coarse relative age — reviews are anonymous, so the date is the only
  /// context a reader gets about how current the feedback is. Mirrors
  /// mentor_detail_screen's `_ReviewTile._age`.
  String get _age {
    final created = DateTime.tryParse(review.createdAt);
    if (created == null) return '';
    final days = DateTime.now().difference(created).inDays;
    if (days <= 0) return 'Today';
    if (days == 1) return 'Yesterday';
    if (days < 7) return '$days days ago';
    if (days < 30) {
      final weeks = (days / 7).floor();
      return weeks == 1 ? '1 week ago' : '$weeks weeks ago';
    }
    final months = (days / 30).floor();
    return months <= 1 ? '1 month ago' : '$months months ago';
  }

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: const BoxDecoration(
                  color: AppColors.primaryLight,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.person_rounded,
                  size: 16,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              const Text(
                'Anonymous',
                style: TextStyle(
                  fontSize: AppFont.sm,
                  fontWeight: AppFont.semibold,
                  color: AppColors.textPrimary,
                ),
              ),
              const Spacer(),
              for (var i = 0; i < 5; i++)
                Icon(
                  i < review.rating
                      ? Icons.star_rounded
                      : Icons.star_border_rounded,
                  size: 14,
                  color: AppColors.warning,
                ),
            ],
          ),
          if (review.comment != null && review.comment!.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              review.comment!.trim(),
              style: const TextStyle(
                fontSize: AppFont.sm,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
          ],
          if (_age.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              _age,
              style: const TextStyle(
                fontSize: AppFont.xs,
                color: AppColors.textMuted,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
