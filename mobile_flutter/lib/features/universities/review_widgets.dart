import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/university_reviews_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';
import '../profile/profile_options.dart';

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
class CategoryRatingBar extends StatelessWidget {
  const CategoryRatingBar({
    super.key,
    required this.label,
    required this.value,
  });
  final String label;
  final double? value;

  @override
  Widget build(BuildContext context) {
    final v = value;
    if (v == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
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
          if ((review.pros != null && review.pros!.trim().isNotEmpty) ||
              (review.cons != null && review.cons!.trim().isNotEmpty)) ...[
            const SizedBox(height: AppSpacing.sm),
            if (review.pros != null && review.pros!.trim().isNotEmpty)
              _ProsConsLine(
                icon: Icons.thumb_up_rounded,
                color: AppColors.primary,
                text: review.pros!,
              ),
            if (review.cons != null && review.cons!.trim().isNotEmpty)
              _ProsConsLine(
                icon: Icons.thumb_down_rounded,
                color: const Color(0xFFE08E45),
                text: review.cons!,
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

class _ProsConsLine extends StatelessWidget {
  const _ProsConsLine({
    required this.icon,
    required this.color,
    required this.text,
  });
  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                fontSize: AppFont.sm,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bottom sheet for writing a review — overall rating is the only required
/// field; the 4 category ratings, "would you recommend", and tags are all
/// optional so the form stays quick, but collecting them is what makes the
/// summary card's category bars / recommend % / tag counts real instead of
/// empty for every future review.
class WriteReviewSheet extends ConsumerStatefulWidget {
  const WriteReviewSheet({
    super.key,
    required this.universityId,
    this.existingReview,
  });
  final String universityId;

  /// When set, the sheet opens pre-filled with this review's values and
  /// submits via update instead of create — same form either way, since
  /// the fields are identical, just a different verb at the end.
  final UniversityReview? existingReview;

  @override
  ConsumerState<WriteReviewSheet> createState() => _WriteReviewSheetState();
}

class _WriteReviewSheetState extends ConsumerState<WriteReviewSheet> {
  late int _overallRating;
  int? _academicsRating;
  int? _campusLifeRating;
  int? _workloadRating;
  int? _careerValueRating;
  bool? _wouldRecommend;
  final Set<String> _tags = {};
  late final _bodyController = TextEditingController(
    text: widget.existingReview?.body ?? '',
  );
  late final _prosController = TextEditingController(
    text: widget.existingReview?.pros ?? '',
  );
  late final _consController = TextEditingController(
    text: widget.existingReview?.cons ?? '',
  );
  bool _submitting = false;
  String? _error;

  bool get _isEditing => widget.existingReview != null;

  @override
  void initState() {
    super.initState();
    final existing = widget.existingReview;
    _overallRating = existing?.overallRating ?? 5;
    _academicsRating = existing?.clinicalExposureRating;
    _campusLifeRating = existing?.campusLifeRating;
    _workloadRating = existing?.workloadRating;
    _careerValueRating = existing?.placementsRating;
    _wouldRecommend = existing?.wouldRecommend;
    if (existing != null) _tags.addAll(existing.tags);
  }

  @override
  void dispose() {
    _bodyController.dispose();
    _prosController.dispose();
    _consController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final api = ref.read(universityReviewsApiProvider);
      if (_isEditing) {
        await api.update(
          widget.universityId,
          overallRating: _overallRating,
          clinicalExposureRating: _academicsRating,
          campusLifeRating: _campusLifeRating,
          workloadRating: _workloadRating,
          placementsRating: _careerValueRating,
          wouldRecommend: _wouldRecommend,
          tags: _tags.toList(),
          body: _bodyController.text.trim(),
          pros: _prosController.text.trim(),
          cons: _consController.text.trim(),
        );
      } else {
        await api.create(
          widget.universityId,
          overallRating: _overallRating,
          clinicalExposureRating: _academicsRating,
          campusLifeRating: _campusLifeRating,
          workloadRating: _workloadRating,
          placementsRating: _careerValueRating,
          wouldRecommend: _wouldRecommend,
          tags: _tags.toList(),
          body: _bodyController.text.trim(),
          pros: _prosController.text.trim(),
          cons: _consController.text.trim(),
        );
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      setState(() {
        _submitting = false;
        _error = e.toString();
      });
    }
  }

  Widget _starRow(String label, int? value, ValueChanged<int> onChanged) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        children: [
          SizedBox(
            width: 100,
            child: Text(label, style: const TextStyle(fontSize: AppFont.sm)),
          ),
          for (var i = 1; i <= 5; i++)
            IconButton(
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
              onPressed: () => onChanged(i),
              icon: Icon(
                value != null && i <= value
                    ? Icons.star_rounded
                    : Icons.star_border_rounded,
                color: AppColors.warning,
                size: 22,
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.lg + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(AppRadius.full),
                ),
              ),
            ),
            Text(
              _isEditing ? 'Edit your review' : 'Write a review',
              style: const TextStyle(
                fontSize: AppFont.lg,
                fontWeight: AppFont.extraBold,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 1; i <= 5; i++)
                  IconButton(
                    onPressed: () => setState(() => _overallRating = i),
                    icon: Icon(
                      i <= _overallRating
                          ? Icons.star_rounded
                          : Icons.star_border_rounded,
                      color: AppColors.warning,
                      size: 32,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            const Text(
              'Rate by category (optional)',
              style: TextStyle(fontSize: AppFont.sm, fontWeight: AppFont.bold),
            ),
            const SizedBox(height: AppSpacing.xs),
            _starRow(
              'Academics',
              _academicsRating,
              (v) => setState(() => _academicsRating = v),
            ),
            _starRow(
              'Campus Life',
              _campusLifeRating,
              (v) => setState(() => _campusLifeRating = v),
            ),
            _starRow(
              'Workload',
              _workloadRating,
              (v) => setState(() => _workloadRating = v),
            ),
            _starRow(
              'Career Value',
              _careerValueRating,
              (v) => setState(() => _careerValueRating = v),
            ),
            const SizedBox(height: AppSpacing.sm),
            const Text(
              'Would you recommend this college?',
              style: TextStyle(fontSize: AppFont.sm, fontWeight: AppFont.bold),
            ),
            const SizedBox(height: AppSpacing.xs),
            Row(
              children: [
                ChoiceChip(
                  label: const Text('Yes'),
                  selected: _wouldRecommend == true,
                  onSelected: (_) => setState(() => _wouldRecommend = true),
                ),
                const SizedBox(width: AppSpacing.sm),
                ChoiceChip(
                  label: const Text('No'),
                  selected: _wouldRecommend == false,
                  onSelected: (_) => setState(() => _wouldRecommend = false),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            const Text(
              'Highlights (optional)',
              style: TextStyle(fontSize: AppFont.sm, fontWeight: AppFont.bold),
            ),
            const SizedBox(height: AppSpacing.xs),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                for (final tag in kReviewTags)
                  FilterChip(
                    label: Text(tag),
                    selected: _tags.contains(tag),
                    onSelected: (v) => setState(() {
                      if (v) {
                        _tags.add(tag);
                      } else {
                        _tags.remove(tag);
                      }
                    }),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _bodyController,
              maxLines: 4,
              maxLength: 3000,
              decoration: const InputDecoration(
                hintText:
                    'Share your experience — academics, faculty, campus life...',
                border: OutlineInputBorder(),
              ),
            ),
            TextField(
              controller: _prosController,
              maxLength: 1000,
              decoration: const InputDecoration(
                labelText: 'Pros (optional) — e.g. "Great faculty"',
                border: OutlineInputBorder(),
              ),
            ),
            TextField(
              controller: _consController,
              maxLength: 1000,
              decoration: const InputDecoration(
                labelText: 'Cons (optional) — e.g. "Crowded labs"',
                border: OutlineInputBorder(),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                _error!,
                style: const TextStyle(
                  fontSize: AppFont.xs,
                  color: AppColors.error,
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(_isEditing ? 'Save changes' : 'Post review'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
