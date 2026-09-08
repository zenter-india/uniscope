import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/university_reviews_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';
import 'review_choices.dart';
import 'review_widgets.dart';

/// Full review breakdown for one university — the screen the summary
/// card's "See full review breakdown" arrow pushes into. Aggregate view
/// only (category bars, per-question experience breakdown, student
/// highlights) — every number comes from the real GET .../reviews/summary
/// aggregate. The individual review cards live on the detail screen's
/// Reviews tab, not here.
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
              ],
            ),
          ),
        ),
      ),
    );
  }
}
