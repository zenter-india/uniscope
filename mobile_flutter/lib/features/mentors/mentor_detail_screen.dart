import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/mentors_api.dart';
import '../../core/network/reviews_api.dart';
import '../../core/network/wishlist_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';

final mentorDetailProvider =
    FutureProvider.autoDispose.family<Mentor, String>(
  (ref, mentorId) => ref.watch(mentorsApiProvider).getById(mentorId),
);

final mentorReviewsListProvider =
    FutureProvider.autoDispose.family<List<MentorReview>, String>(
  (ref, mentorId) => ref.watch(reviewsApiProvider).listForMentor(mentorId),
);

/// Read-only mentor profile — stats, bio, expertise tags, university, and
/// reviews. Reviews are written from the post-session flow in
/// SessionListScreen, not from here; this screen only displays them.
class MentorDetailScreen extends ConsumerWidget {
  const MentorDetailScreen({super.key, required this.mentorId});
  final String mentorId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mentorAsync = ref.watch(mentorDetailProvider(mentorId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Mentor profile'),
        actions: [
          mentorAsync.maybeWhen(
            data: (mentor) => _SaveButton(mentorId: mentor.id),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: mentorAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.primary)),
        error: (err, _) => EmptyState(
          icon: Icons.wifi_off_rounded,
          title: 'Could not load this mentor',
          message: 'Check your connection and try again.',
          actionLabel: 'Retry',
          onAction: () => ref.invalidate(mentorDetailProvider(mentorId)),
        ),
        data: (mentor) => SingleChildScrollView(
          child: Column(
            children: [
              _Hero(mentor: mentor),
              _ExpertiseSection(mentor: mentor),
              _ReviewsSection(mentorId: mentorId),
            ],
          ),
        ),
      ),
    );
  }
}

class _SaveButton extends ConsumerWidget {
  const _SaveButton({required this.mentorId});
  final String mentorId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final savedIdsAsync = ref.watch(savedMentorIdsProvider);
    final isSaved = savedIdsAsync.value?.contains(mentorId) ?? false;

    return IconButton(
      onPressed: () =>
          ref.read(savedMentorIdsProvider.notifier).toggle(mentorId),
      icon: Icon(
        isSaved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
        color: isSaved ? AppColors.error : AppColors.textInverse,
      ),
      tooltip: 'Save mentor',
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.mentor});
  final Mentor mentor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        children: [
          AppAvatar(name: mentor.displayName, size: 72),
          const SizedBox(height: AppSpacing.sm),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(
                child: Text(
                  mentor.displayName,
                  textAlign: TextAlign.center,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: AppFont.xl,
                    fontWeight: AppFont.extraBold,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              const Icon(Icons.verified_rounded,
                  size: 20, color: AppColors.verified),
            ],
          ),
          if (mentor.university != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                mentor.university!.name,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: AppFont.sm,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          const SizedBox(height: AppSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _HeroStat(
                value: mentor.rating != null
                    ? '${mentor.rating!.toStringAsFixed(1)} ★'
                    : '—',
                label: '${mentor.reviewCount} reviews',
              ),
              const SizedBox(width: AppSpacing.xl),
              const _HeroStat(value: 'Free', label: 'Chat'),
              const SizedBox(width: AppSpacing.xl),
              const _HeroStat(value: '₹10/min', label: 'Call'),
            ],
          ),
          if (mentor.bio != null && mentor.bio!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              mentor.bio!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: AppFont.sm,
                color: AppColors.textPrimary,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            fontSize: AppFont.lg,
            fontWeight: AppFont.extraBold,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(label,
            style: const TextStyle(
                fontSize: AppFont.xs, color: AppColors.textSecondary)),
      ],
    );
  }
}

class _ExpertiseSection extends StatelessWidget {
  const _ExpertiseSection({required this.mentor});
  final Mentor mentor;

  @override
  Widget build(BuildContext context) {
    if ((mentor.specialty == null || mentor.specialty!.isEmpty) &&
        mentor.languages.isEmpty) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'Can help with'),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (mentor.specialty != null && mentor.specialty!.isNotEmpty)
                StatusChip(label: mentor.specialty!, color: AppColors.primary),
              for (final language in mentor.languages)
                StatusChip(label: language, color: AppColors.info),
            ],
          ),
        ],
      ),
    );
  }
}

class _ReviewsSection extends ConsumerWidget {
  const _ReviewsSection({required this.mentorId});
  final String mentorId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviewsAsync = ref.watch(mentorReviewsListProvider(mentorId));

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'Reviews'),
          const SizedBox(height: AppSpacing.sm),
          reviewsAsync.when(
            loading: () => const Column(children: [SkeletonCard(), SkeletonCard()]),
            error: (err, _) => const EmptyState(
              icon: Icons.wifi_off_rounded,
              title: 'Could not load reviews',
              message: 'Pull to refresh to try again.',
            ),
            data: (reviews) => reviews.isEmpty
                ? const EmptyState(
                    icon: Icons.star_rounded,
                    title: 'No reviews yet',
                    message: 'Reviews appear here after aspirants complete a session.',
                  )
                : Column(
                    children: [
                      for (final review in reviews) _ReviewTile(review: review),
                    ],
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

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              for (var i = 0; i < 5; i++)
                Icon(
                  i < review.rating ? Icons.star_rounded : Icons.star_border_rounded,
                  size: 16,
                  color: AppColors.warning,
                ),
            ],
          ),
          if (review.comment != null && review.comment!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              review.comment!,
              style: const TextStyle(
                fontSize: AppFont.sm,
                color: AppColors.textPrimary,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
