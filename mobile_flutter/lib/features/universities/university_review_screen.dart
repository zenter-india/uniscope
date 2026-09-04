import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/university_reviews_api.dart';
import '../../core/network/users_api.dart' show myProfileProvider;
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart' show UserRole;
import '../../widgets/app_widgets.dart';
import '../profile/profile_options.dart' show kReviewTags;
import 'review_choices.dart';

/// Opens the 12-question review screen for [universityId], pre-filled for an
/// edit when the caller already has a review. Returns `true` when a review
/// was posted/updated (the screen itself invalidates the four
/// university-review providers; a caller with extra providers to refresh —
/// e.g. `universityDetailProvider` — does so on a `true` result). Replaces
/// the old `WriteReviewSheet` bottom sheet everywhere.
Future<bool?> openUniversityReview(
  BuildContext context,
  WidgetRef ref, {
  required String universityId,
  required String universityName,
}) async {
  UniversityReview? existing;
  try {
    existing = await ref
        .read(universityReviewsApiProvider)
        .findMine(universityId);
  } catch (_) {
    existing = null;
  }
  if (!context.mounted) return null;
  return context.push<bool>(
    '/college-review',
    extra: {
      'universityId': universityId,
      'universityName': universityName,
      'existingReview': existing,
    },
  );
}

/// The client-confirmed 12-question college review, in Uniscope's own
/// light-green system (structure + wording from the approved mockup, not
/// its dark palette). All 12 answers are required — Submit stays disabled
/// until every one is set; the tag chips and the free-text summary are
/// optional. Reached from "Rate Your College" (Profile), the college detail
/// screen, and the review breakdown screen. Opens pre-filled and submits
/// via `update` when the caller already has a review.
class UniversityReviewScreen extends ConsumerStatefulWidget {
  const UniversityReviewScreen({
    super.key,
    required this.universityId,
    required this.universityName,
    this.existingReview,
  });

  final String universityId;
  final String universityName;
  final UniversityReview? existingReview;

  @override
  ConsumerState<UniversityReviewScreen> createState() =>
      _UniversityReviewScreenState();
}

class _UniversityReviewScreenState
    extends ConsumerState<UniversityReviewScreen> {
  // Q1–Q4 sliders, keyed by field name; Q5–Q11 choices, keyed by field name.
  final Map<String, int> _sliders = {};
  final Map<String, String> _choices = {};
  int? _overall; // Q12
  final Set<String> _tags = {};
  final _bodyController = TextEditingController();

  bool _submitting = false;
  String? _error;
  bool _done = false;

  bool get _isEditing => widget.existingReview != null;
  static const int _total = 12;

  @override
  void initState() {
    super.initState();
    final r = widget.existingReview;
    if (r != null) {
      final d = UniversityReviewDraft.fromReview(r);
      _sliders['clinicalExposureRating'] = d.academicExposure;
      _sliders['campusLifeRating'] = d.campusCulture;
      _sliders['workloadRating'] = d.workload;
      _sliders['placementsRating'] = d.futureValue;
      _choices['raggingCulture'] = d.raggingCulture;
      _choices['facultyApproachability'] = d.facultyApproachability;
      _choices['stipendStatus'] = d.stipendStatus;
      _choices['hostelAvailability'] = d.hostelAvailability;
      _choices['hostelSafety'] = d.hostelSafety;
      _choices['wouldRecommend'] = d.wouldRecommend;
      _choices['valueForMoney'] = d.valueForMoney;
      _overall = d.overallRating;
      _tags.addAll(d.tags);
      _bodyController.text = d.body ?? '';
    }
  }

  @override
  void dispose() {
    _bodyController.dispose();
    super.dispose();
  }

  int get _answered =>
      _sliders.length + _choices.length + (_overall != null ? 1 : 0);

  bool get _complete => _answered == _total;

  Future<void> _submit() async {
    if (!_complete) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    final draft = UniversityReviewDraft(
      overallRating: _overall!,
      academicExposure: _sliders['clinicalExposureRating']!,
      campusCulture: _sliders['campusLifeRating']!,
      workload: _sliders['workloadRating']!,
      futureValue: _sliders['placementsRating']!,
      raggingCulture: _choices['raggingCulture']!,
      facultyApproachability: _choices['facultyApproachability']!,
      stipendStatus: _choices['stipendStatus']!,
      hostelAvailability: _choices['hostelAvailability']!,
      hostelSafety: _choices['hostelSafety']!,
      wouldRecommend: _choices['wouldRecommend']!,
      valueForMoney: _choices['valueForMoney']!,
      tags: _tags.toList(),
      body: _bodyController.text,
    );
    try {
      final api = ref.read(universityReviewsApiProvider);
      if (_isEditing) {
        await api.update(widget.universityId, draft);
      } else {
        await api.create(widget.universityId, draft);
      }
      // Refresh every surface that reads this university's reviews.
      ref.invalidate(universityReviewsListProvider(widget.universityId));
      ref.invalidate(hasReviewedUniversityProvider(widget.universityId));
      ref.invalidate(myUniversityReviewProvider(widget.universityId));
      ref.invalidate(universityReviewSummaryProvider(widget.universityId));
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _done = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = _friendlyError(e);
      });
    }
  }

  String _friendlyError(Object e) {
    final s = e.toString();
    // Surface the backend's own message when it sent one (e.g. the
    // "review your own college only" / verification gate).
    final match = RegExp(r'"message":"([^"]+)"').firstMatch(s);
    return match?.group(1) ?? 'Could not submit your review. Please try again.';
  }

  @override
  Widget build(BuildContext context) {
    if (_done) return _SuccessView(universityName: widget.universityName);

    final pct = ((_answered / _total) * 100).round();
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_isEditing ? 'Edit your review' : 'Write a Review'),
            Text(
              widget.universityName,
              style: const TextStyle(
                fontSize: AppFont.xs,
                color: AppColors.textSecondary,
                fontWeight: AppFont.regular,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          _ProgressStrip(answered: _answered, total: _total, pct: pct),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.xl,
              ),
              children: [
                for (var i = 0; i < kReviewSliders.length; i++)
                  _SliderCard(
                    index: i + 1,
                    spec: kReviewSliders[i],
                    value: _sliders[kReviewSliders[i].field],
                    onChanged: (v) => setState(
                      () => _sliders[kReviewSliders[i].field] = v,
                    ),
                  ),
                for (var i = 0; i < kReviewChoices.length; i++)
                  _ChoiceCard(
                    index: i + 5,
                    spec: kReviewChoices[i],
                    selected: _choices[kReviewChoices[i].field],
                    onSelected: (code) => setState(
                      () => _choices[kReviewChoices[i].field] = code,
                    ),
                  ),
                _StarCard(
                  value: _overall,
                  onChanged: (v) => setState(() => _overall = v),
                ),
                _SummaryCard(
                  selectedTags: _tags,
                  onToggleTag: (tag, on) => setState(() {
                    if (on) {
                      _tags.add(tag);
                    } else {
                      _tags.remove(tag);
                    }
                  }),
                  bodyController: _bodyController,
                  onBodyChanged: () => setState(() {}),
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
              ],
            ),
          ),
          _SubmitBar(
            remaining: _total - _answered,
            submitting: _submitting,
            onSubmit: _complete && !_submitting ? _submit : null,
            editing: _isEditing,
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────── progress ───────────────────────────

class _ProgressStrip extends StatelessWidget {
  const _ProgressStrip({
    required this.answered,
    required this.total,
    required this.pct,
  });
  final int answered;
  final int total;
  final int pct;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.md,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '$answered of $total answered',
                style: const TextStyle(
                  fontSize: AppFont.xs,
                  color: AppColors.textSecondary,
                  fontWeight: AppFont.semibold,
                ),
              ),
              Text(
                '$pct% complete',
                style: const TextStyle(
                  fontSize: AppFont.xs,
                  color: AppColors.textMuted,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.full),
            child: LinearProgressIndicator(
              value: total == 0 ? 0 : answered / total,
              minHeight: 5,
              backgroundColor: AppColors.border,
              valueColor: const AlwaysStoppedAnimation(AppColors.primary),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────── shared card shell ──────────────────────

class _QCard extends StatelessWidget {
  const _QCard({
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    required this.child,
    this.answered = false,
  });
  final String eyebrow;
  final String title;
  final String subtitle;
  final Widget child;
  final bool answered;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                eyebrow.toUpperCase(),
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: AppFont.extraBold,
                  letterSpacing: 1,
                  color: AppColors.primary,
                ),
              ),
              const Spacer(),
              if (answered)
                const Icon(
                  Icons.check_circle_rounded,
                  size: 15,
                  color: AppColors.success,
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            title,
            style: const TextStyle(
              fontSize: AppFont.md,
              fontWeight: AppFont.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: const TextStyle(
              fontSize: AppFont.xs,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}

// ─────────────────────────── Q1–Q4 ──────────────────────────────

class _SliderCard extends StatelessWidget {
  const _SliderCard({
    required this.index,
    required this.spec,
    required this.value,
    required this.onChanged,
  });
  final int index;
  final ReviewSliderSpec spec;
  final int? value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return _QCard(
      eyebrow: 'Q$index · Rate 1–5',
      title: spec.title,
      subtitle: spec.subtitle,
      answered: value != null,
      child: Column(
        children: [
          Row(
            children: [
              for (var v = 1; v <= 5; v++)
                Expanded(
                  child: GestureDetector(
                    onTap: () => onChanged(v),
                    child: Container(
                      height: 40,
                      margin: EdgeInsets.only(right: v == 5 ? 0 : 4),
                      decoration: BoxDecoration(
                        color: (value ?? 0) >= v
                            ? AppColors.primary
                            : AppColors.primaryLight,
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '$v',
                        style: TextStyle(
                          fontWeight: AppFont.bold,
                          color: (value ?? 0) >= v
                              ? Colors.white
                              : AppColors.primary,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            value == null
                ? 'Tap a number'
                : '$value/5 — ${spec.captionFor(value!)}',
            style: TextStyle(
              fontSize: AppFont.xs,
              fontWeight: AppFont.bold,
              color: value == null
                  ? AppColors.textMuted
                  : AppColors.primaryDark,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────── Q5–Q11 ─────────────────────────────

class _ChoiceCard extends StatelessWidget {
  const _ChoiceCard({
    required this.index,
    required this.spec,
    required this.selected,
    required this.onSelected,
  });
  final int index;
  final ReviewChoiceSpec spec;
  final String? selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return _QCard(
      eyebrow: 'Q$index · Pick one',
      title: spec.title,
      subtitle: spec.subtitle,
      answered: selected != null,
      child: Column(
        children: [
          for (final opt in spec.options)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: InkWell(
                borderRadius: BorderRadius.circular(AppRadius.md),
                onTap: () => onSelected(opt.code),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 11,
                  ),
                  decoration: BoxDecoration(
                    color: selected == opt.code
                        ? AppColors.primaryLight
                        : AppColors.background,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    border: Border.all(
                      color: selected == opt.code
                          ? AppColors.primary
                          : AppColors.border,
                      width: 1.5,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        selected == opt.code
                            ? Icons.radio_button_checked_rounded
                            : Icons.radio_button_unchecked_rounded,
                        size: 18,
                        color: selected == opt.code
                            ? AppColors.primary
                            : AppColors.textMuted,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(opt.emoji, style: const TextStyle(fontSize: 15)),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          opt.label,
                          style: TextStyle(
                            fontSize: AppFont.sm,
                            fontWeight: selected == opt.code
                                ? AppFont.semibold
                                : AppFont.regular,
                            color: selected == opt.code
                                ? AppColors.textPrimary
                                : AppColors.textSecondary,
                            height: 1.3,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ─────────────────────────── Q12 ────────────────────────────────

class _StarCard extends StatelessWidget {
  const _StarCard({required this.value, required this.onChanged});
  final int? value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return _QCard(
      eyebrow: 'Q12 · Final rating',
      title: 'Overall Experience',
      subtitle:
          "You've reflected on everything — now give this college your final overall verdict.",
      answered: value != null,
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 1; i <= 5; i++)
                IconButton(
                  onPressed: () => onChanged(i),
                  icon: Icon(
                    (value ?? 0) >= i
                        ? Icons.star_rounded
                        : Icons.star_border_rounded,
                    size: 34,
                    color: AppColors.warning,
                  ),
                ),
            ],
          ),
          Text(
            value == null ? 'Tap a star' : kOverallStarLabels[value! - 1],
            style: TextStyle(
              fontSize: AppFont.xs,
              fontWeight: AppFont.bold,
              color: value == null
                  ? AppColors.textMuted
                  : AppColors.primaryDark,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────── optional summary ───────────────────────────

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.selectedTags,
    required this.onToggleTag,
    required this.bodyController,
    required this.onBodyChanged,
  });
  final Set<String> selectedTags;
  final void Function(String tag, bool on) onToggleTag;
  final TextEditingController bodyController;
  final VoidCallback onBodyChanged;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'QUICK EXPERIENCE SUMMARY',
            style: TextStyle(
              fontSize: 10,
              fontWeight: AppFont.extraBold,
              letterSpacing: 1,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Optional · shown anonymously',
            style: TextStyle(
              fontSize: AppFont.xs,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          const Text(
            'Tag your experience',
            style: TextStyle(
              fontSize: AppFont.xs,
              fontWeight: AppFont.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              for (final tag in kReviewTags)
                FilterChip(
                  label: Text(tag),
                  selected: selectedTags.contains(tag),
                  onSelected: (v) => onToggleTag(tag, v),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          const Text(
            'In your own words',
            style: TextStyle(
              fontSize: AppFont.xs,
              fontWeight: AppFont.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          TextField(
            controller: bodyController,
            maxLines: 4,
            maxLength: kReviewSummaryMaxChars,
            inputFormatters: [
              LengthLimitingTextInputFormatter(kReviewSummaryMaxChars),
            ],
            onChanged: (_) => onBodyChanged(),
            decoration: const InputDecoration(
              hintText:
                  'What do you want the next batch to know? The real story...',
              border: OutlineInputBorder(),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────── submit ─────────────────────────────

class _SubmitBar extends StatelessWidget {
  const _SubmitBar({
    required this.remaining,
    required this.submitting,
    required this.onSubmit,
    required this.editing,
  });
  final int remaining;
  final bool submitting;
  final VoidCallback? onSubmit;
  final bool editing;

  @override
  Widget build(BuildContext context) {
    final label = submitting
        ? null
        : remaining > 0
        ? '$remaining question${remaining == 1 ? '' : 's'} remaining'
        : editing
        ? 'Save changes'
        : 'Submit review';
    return Container(
      color: AppColors.surface,
      padding: EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.md + MediaQuery.of(context).padding.bottom,
      ),
      child: SizedBox(
        width: double.infinity,
        child: FilledButton(
          onPressed: onSubmit,
          child: submitting
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Text(label!),
        ),
      ),
    );
  }
}

/// Nudge shown to a mentor who was verified under the college-review
/// requirement and hasn't posted one yet — on the Home and Profile tabs.
/// Renders nothing for anyone else (aspirants, exempt/existing mentors, or
/// a mentor who's already reviewed). Tapping it opens the 12-question form.
class CollegeReviewPromptBanner extends ConsumerWidget {
  const CollegeReviewPromptBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(myProfileProvider).asData?.value;
    if (profile == null ||
        profile.role != UserRole.mentor ||
        !profile.mustReviewCollege ||
        profile.universityId == null) {
      return const SizedBox.shrink();
    }
    final reviewed =
        ref.watch(hasReviewedUniversityProvider(profile.universityId!)).asData
            ?.value ??
        false;
    if (reviewed) return const SizedBox.shrink();

    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      onTap: () => openUniversityReview(
        context,
        ref,
        universityId: profile.universityId!,
        universityName: profile.universityName ?? 'Your college',
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: 14,
      ),
      child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(AppRadius.sm),
              ),
              child: const Icon(
                Icons.rate_review_rounded,
                size: 18,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Review your college',
                    style: TextStyle(
                      fontSize: AppFont.sm,
                      fontWeight: AppFont.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Text(
                    'Required to accept paid call bookings — takes a minute.',
                    style: TextStyle(
                      fontSize: AppFont.xs,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: AppColors.textMuted,
            ),
          ],
        ),
      );
  }
}

class _SuccessView extends StatelessWidget {
  const _SuccessView({required this.universityName});
  final String universityName;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.check_circle_rounded,
                size: 72,
                color: AppColors.primary,
              ),
              const SizedBox(height: AppSpacing.lg),
              const Text(
                'Review submitted',
                style: TextStyle(
                  fontSize: AppFont.xl,
                  fontWeight: AppFont.extraBold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Thanks for the honest take on $universityName — it helps the next batch decide.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: AppFont.sm,
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  child: const Text('Done'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
