import 'package:flutter/material.dart';

import '../../core/network/university_reviews_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';
import 'review_choices.dart';

/// Tags that read as a downside — colored like a caution, not a highlight,
/// wherever a tag chip is shown. Everything else in kReviewTags is positive.
const _kNegativeReviewTags = {'Heavy workload', 'Stipend delayed'};

/// Score-to-color scale shared by every progress bar / ring in the review
/// summary UI, so "4.4" always reads the same shade of green wherever it
/// appears.
Color reviewScoreColor(double value) {
  if (value >= 4.0) return AppColors.success;
  if (value >= 3.0) return const Color(0xFF8BC34A); // lime — "generally fine"
  if (value >= 2.0) return AppColors.warning;
  return AppColors.error;
}

class ReviewTagChip extends StatelessWidget {
  const ReviewTagChip({super.key, required this.tag, this.count});
  final String tag;
  final int? count;

  @override
  Widget build(BuildContext context) {
    final negative = _kNegativeReviewTags.contains(tag);
    final color = negative ? AppColors.error : AppColors.primary;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 6,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppRadius.full),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        count != null ? '$tag · $count' : tag,
        style: TextStyle(
          fontSize: AppFont.xs,
          fontWeight: AppFont.semibold,
          color: color,
        ),
      ),
    );
  }
}

/// One "Rated by Category" row — a labeled progress bar, skipped entirely
/// (not rendered as a zero) when nobody has answered that category yet.
/// [subtitle] is an optional one-line descriptor shown under the bar (used
/// on the full breakdown screen, omitted in the compact summary card).
class CategoryRatingBar extends StatelessWidget {
  const CategoryRatingBar({
    super.key,
    required this.label,
    required this.value,
    this.subtitle,
  });
  final String label;
  final double? value;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final v = value;
    if (v == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SizedBox(
                width: 92,
                child: Text(
                  label,
                  style: const TextStyle(
                    fontSize: AppFont.sm,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.full),
                  child: LinearProgressIndicator(
                    value: (v / 5).clamp(0, 1),
                    minHeight: 8,
                    backgroundColor: AppColors.border,
                    valueColor: AlwaysStoppedAnimation(reviewScoreColor(v)),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              SizedBox(
                width: 32,
                child: Text(
                  v.toStringAsFixed(1),
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                    fontSize: AppFont.sm,
                    fontWeight: AppFont.bold,
                  ),
                ),
              ),
            ],
          ),
          if (subtitle != null && subtitle!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 92, top: 3),
              child: Text(
                subtitle!,
                style: const TextStyle(
                  fontSize: AppFont.xs,
                  color: AppColors.textMuted,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Circular score ring — brand-gradient stroke over the raw overall average,
/// e.g. "4.3 / 5.0". Null shows a dash rather than a misleading 0.
class ReviewScoreRing extends StatelessWidget {
  const ReviewScoreRing({super.key, required this.value, this.size = 76});
  final double? value;
  final double size;

  @override
  Widget build(BuildContext context) {
    final v = value;
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          SizedBox(
            width: size,
            height: size,
            child: CircularProgressIndicator(
              value: v == null ? 0 : (v / 5).clamp(0, 1),
              strokeWidth: size * 0.09,
              backgroundColor: AppColors.border,
              valueColor: AlwaysStoppedAnimation(
                v == null ? AppColors.border : reviewScoreColor(v),
              ),
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                v?.toStringAsFixed(1) ?? '—',
                style: TextStyle(
                  fontSize: size * 0.28,
                  fontWeight: AppFont.extraBold,
                  color: AppColors.textPrimary,
                ),
              ),
              Text(
                '/ 5.0',
                style: TextStyle(
                  fontSize: size * 0.13,
                  color: AppColors.textMuted,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class RecommendPill extends StatelessWidget {
  const RecommendPill({super.key, required this.percent});
  final int percent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 6,
      ),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadius.full),
      ),
      child: Text(
        '👍 $percent% would recommend',
        style: const TextStyle(
          fontSize: AppFont.xs,
          fontWeight: AppFont.bold,
          color: AppColors.success,
        ),
      ),
    );
  }
}

/// A single review, its author shown only as a role — never a name or
/// handle — per the app's anonymity model.
class ReviewCard extends StatelessWidget {
  const ReviewCard({super.key, required this.review});
  final UniversityReview review;

  String get _dateLabel {
    final d = DateTime.tryParse(review.createdAt);
    if (d == null) return '';
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${months[d.month - 1]} ${d.day}, ${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              StatusChip(
                label: review.authorIsMentor ? 'Mentor' : 'Student',
                color: review.authorIsMentor
                    ? AppColors.accent
                    : AppColors.primary,
              ),
              const Spacer(),
              Row(
                children: [
                  for (var i = 1; i <= 5; i++)
                    Icon(
                      i <= review.overallRating
                          ? Icons.star_rounded
                          : Icons.star_border_rounded,
                      size: 16,
                      color: AppColors.warning,
                    ),
                ],
              ),
            ],
          ),
          if (_dateLabel.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              _dateLabel,
              style: const TextStyle(
                fontSize: AppFont.xs,
                color: AppColors.textMuted,
              ),
            ),
          ],
          if (review.body != null && review.body!.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              review.body!,
              style: const TextStyle(
                fontSize: AppFont.sm,
                color: AppColors.textPrimary,
                height: 1.4,
              ),
            ),
          ],
          if (review.tags.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [for (final t in review.tags) ReviewTagChip(tag: t)],
            ),
          ],
        ],
      ),
    );
  }
}

/// One "Student Experience Breakdown" card (Q5–Q11) — a headline sentence,
/// a stacked severity bar, and an expandable per-option legend. Every % is
/// real: it comes from `summary.choiceDistributions[spec.field]`, a
/// code→count map the backend computes over ACTIVE reviews. A question
/// nobody has answered yet is skipped by the caller, never shown as zeros.
class ChoiceDistributionCard extends StatefulWidget {
  const ChoiceDistributionCard({
    super.key,
    required this.spec,
    required this.distribution,
  });

  final ReviewChoiceSpec spec;
  final Map<String, int> distribution;

  @override
  State<ChoiceDistributionCard> createState() => _ChoiceDistributionCardState();
}

class _ChoiceDistributionCardState extends State<ChoiceDistributionCard> {
  bool _expanded = false;

  int get _total =>
      widget.distribution.values.fold(0, (sum, n) => sum + n);

  int _pct(int count) => _total == 0 ? 0 : ((count / _total) * 100).round();

  @override
  Widget build(BuildContext context) {
    final spec = widget.spec;
    final total = _total;
    final positiveCount = spec.positiveCodes.fold<int>(
      0,
      (sum, code) => sum + (widget.distribution[code] ?? 0),
    );
    final positivePct = total == 0 ? 0 : ((positiveCount / total) * 100).round();

    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      onTap: () => setState(() => _expanded = !_expanded),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  spec.title,
                  style: const TextStyle(
                    fontSize: AppFont.sm,
                    fontWeight: AppFont.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              Icon(
                _expanded
                    ? Icons.expand_less_rounded
                    : Icons.expand_more_rounded,
                size: 20,
                color: AppColors.textMuted,
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '$positivePct% ${spec.positivePhrase}',
            style: const TextStyle(
              fontSize: AppFont.xs,
              fontWeight: AppFont.semibold,
              color: AppColors.primaryDark,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.full),
            child: SizedBox(
              height: 9,
              child: Row(
                children: [
                  for (var i = 0; i < spec.options.length; i++)
                    if ((widget.distribution[spec.options[i].code] ?? 0) > 0)
                      Expanded(
                        flex: widget.distribution[spec.options[i].code]!,
                        child: ColoredBox(
                          color: reviewChoiceSeverityColor(
                            spec.options[i].code,
                            i,
                            spec.options.length,
                          ),
                        ),
                      ),
                ],
              ),
            ),
          ),
          if (_expanded) ...[
            const SizedBox(height: AppSpacing.sm),
            const Divider(height: 1, color: AppColors.border),
            const SizedBox(height: AppSpacing.sm),
            for (var i = 0; i < spec.options.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: reviewChoiceSeverityColor(
                          spec.options[i].code,
                          i,
                          spec.options.length,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        spec.options[i].label,
                        style: const TextStyle(
                          fontSize: AppFont.xs,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                    Text(
                      '${_pct(widget.distribution[spec.options[i].code] ?? 0)}%',
                      style: const TextStyle(
                        fontSize: AppFont.xs,
                        fontWeight: AppFont.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}
