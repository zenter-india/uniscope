import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/college_wishlist_api.dart';
import '../../core/network/universities_api.dart';
import '../../core/network/university_reviews_api.dart';
import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart' show UserRole;
import '../../widgets/app_widgets.dart';
import '../auth/auth_background.dart' show authBrandTeal, authBrandNavy, authBrandBlue;
import '../mentors/mentor_list_screen.dart';

final universityDetailProvider =
    FutureProvider.autoDispose.family<University, String>(
  (ref, slug) => ref.watch(universitiesApiProvider).getBySlug(slug),
);

String _typeLabel(String type) {
  switch (type) {
    case 'GOVERNMENT':
      return 'Government';
    case 'PRIVATE':
      return 'Private';
    case 'DEEMED':
      return 'Deemed';
    case 'CENTRAL':
      return 'Central';
    default:
      return type;
  }
}

/// Restyled to match the provided reference: full-bleed hero image (a
/// gradient placeholder for now — swap to Image.network(uni.imageUrl) once
/// the backend/admin support uploading real photos, which doesn't exist
/// yet), 3 tabs (Overview / Reviews / Mentors — the old Q&A/Students/
/// Alumni tabs are dropped since they were unbuilt placeholders anyway),
/// and a persistent "See mentors from this college" CTA.
class UniversityDetailScreen extends ConsumerStatefulWidget {
  const UniversityDetailScreen({
    super.key,
    required this.universitySlug,
    required this.universityName,
  });

  final String universitySlug;
  final String universityName;

  @override
  ConsumerState<UniversityDetailScreen> createState() => _UniversityDetailScreenState();
}

class _UniversityDetailScreenState extends ConsumerState<UniversityDetailScreen> {
  static const _tabs = <(String, String)>[
    ('overview', 'Overview'),
    ('reviews', 'Reviews'),
    ('mentors', 'Mentors'),
  ];

  String _active = 'overview';

  @override
  Widget build(BuildContext context) {
    final detailAsync = ref.watch(universityDetailProvider(widget.universitySlug));

    return Scaffold(
      backgroundColor: AppColors.background,
      body: detailAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.primary)),
        error: (err, _) => SafeArea(
          child: EmptyState(
            icon: Icons.wifi_off_rounded,
            title: 'Could not load this college',
            message: 'Check your connection and try again.',
            actionLabel: 'Retry',
            onAction: () => ref.invalidate(universityDetailProvider(widget.universitySlug)),
          ),
        ),
        data: (uni) => Column(
          children: [
            _Hero(university: uni),
            Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md, vertical: AppSpacing.sm),
              child: _TabBar(
                tabs: _tabs,
                active: _active,
                onSelect: (id) => setState(() => _active = id),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                child: _buildContent(context, uni),
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md, 0, AppSpacing.md, AppSpacing.md),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: authBrandTeal,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.md),
                      ),
                    ),
                    onPressed: () => setState(() => _active = 'mentors'),
                    icon: const Icon(Icons.people_alt_rounded, size: 20),
                    label: const Text(
                      'See mentors from this college',
                      style: TextStyle(fontWeight: AppFont.bold),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, University uni) {
    switch (_active) {
      case 'reviews':
        return _ReviewsTab(university: uni);
      case 'mentors':
        return _MentorsTab(university: uni);
      default:
        return _OverviewTab(university: uni);
    }
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.university});
  final University university;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 300,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (university.imageUrl != null)
            Image.network(
              university.imageUrl!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const _HeroPlaceholder(),
              loadingBuilder: (context, child, progress) =>
                  progress == null ? child : const _HeroPlaceholder(),
            )
          else
            const _HeroPlaceholder(),
          // Bottom gradient so overlaid text stays legible regardless of
          // the eventual photo's brightness.
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.transparent, Colors.black.withValues(alpha: 0.75)],
                stops: const [0.4, 1.0],
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Row(
                children: [
                  _CircleIconButton(
                    icon: Icons.arrow_back_rounded,
                    onTap: () => Navigator.of(context).maybePop(),
                  ),
                  const Spacer(),
                  Consumer(
                    builder: (context, ref, _) {
                      final savedIds = ref.watch(savedCollegeIdsProvider).value;
                      final saved = savedIds?.contains(university.id) ?? false;
                      return _CircleIconButton(
                        icon: saved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                        iconColor: saved ? AppColors.error : Colors.white,
                        onTap: () => ref
                            .read(savedCollegeIdsProvider.notifier)
                            .toggle(university.id),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
          Positioned(
            left: AppSpacing.md,
            right: AppSpacing.md,
            bottom: AppSpacing.md,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  university.name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: AppFont.xxl,
                    fontWeight: AppFont.extraBold,
                    height: 1.15,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Row(
                  children: [
                    const Icon(Icons.location_on_rounded, size: 15, color: Colors.white70),
                    const SizedBox(width: 3),
                    Expanded(
                      child: Text(
                        '${university.city}, ${university.state}',
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white70, fontSize: AppFont.sm),
                      ),
                    ),
                  ],
                ),
                if (university.rating != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.star_rounded, size: 18, color: Color(0xFFF5A524)),
                      const SizedBox(width: 3),
                      Text(
                        university.rating!.toStringAsFixed(1),
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: AppFont.bold,
                            fontSize: AppFont.sm),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '(${university.reviewCount} reviews)',
                        style: const TextStyle(color: Colors.white70, fontSize: AppFont.sm),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Gradient placeholder shown when a university has no uploaded cover
/// photo yet, or while one is loading / failed to load.
class _HeroPlaceholder extends StatelessWidget {
  const _HeroPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [authBrandTeal, authBrandNavy],
        ),
      ),
      child: Center(
        child: Icon(Icons.account_balance_rounded,
            size: 72, color: Colors.white.withValues(alpha: 0.25)),
      ),
    );
  }
}

class _CircleIconButton extends StatelessWidget {
  const _CircleIconButton({
    required this.icon,
    required this.onTap,
    this.iconColor = Colors.white,
  });

  final IconData icon;
  final Color iconColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withValues(alpha: 0.25),
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Icon(icon, size: 20, color: iconColor),
        ),
      ),
    );
  }
}

class _TabBar extends StatelessWidget {
  const _TabBar({
    required this.tabs,
    required this.active,
    required this.onSelect,
  });

  final List<(String, String)> tabs;
  final String active;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (final (id, label) in tabs)
          Expanded(
            child: GestureDetector(
              onTap: () => onSelect(id),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: active == id ? authBrandTeal : AppColors.surface,
                  borderRadius: BorderRadius.circular(AppRadius.full),
                  border: Border.all(
                    color: active == id ? authBrandTeal : AppColors.border,
                  ),
                ),
                alignment: Alignment.center,
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: AppFont.sm,
                    fontWeight: AppFont.bold,
                    color: active == id ? Colors.white : AppColors.textSecondary,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _OverviewTab extends ConsumerWidget {
  const _OverviewTab({required this.university});
  final University university;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rows = <(String, String)>[
      ('Type', _typeLabel(university.type)),
      if (university.nirfRank != null) ('NIRF Rank', '#${university.nirfRank}'),
      // Field name is still mbbsSeats in the schema (pre-dates the
      // multi-stream pivot), but the label shown here is stream-neutral —
      // this same count backs seat totals for any institution type now.
      if (university.mbbsSeats != null) ('Seats', '${university.mbbsSeats}'),
      if (university.establishedYear != null)
        ('Established', '${university.establishedYear}'),
    ];

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (university.description != null) ...[
            AppCard(
              child: Text(
                university.description!,
                style: const TextStyle(
                    fontSize: AppFont.sm, color: AppColors.textPrimary, height: 1.5),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          AppCard(
            child: Column(
              children: [
                for (var i = 0; i < rows.length; i++)
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                    decoration: BoxDecoration(
                      border: Border(
                        bottom: BorderSide(
                          color: i == rows.length - 1
                              ? Colors.transparent
                              : AppColors.border,
                        ),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(rows[i].$1,
                            style: const TextStyle(
                                fontSize: AppFont.sm,
                                color: AppColors.textSecondary)),
                        Flexible(
                          child: Text(rows[i].$2,
                              textAlign: TextAlign.right,
                              style: const TextStyle(
                                  fontSize: AppFont.sm,
                                  fontWeight: AppFont.semibold,
                                  color: AppColors.textPrimary)),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          if (university.programs != null && university.programs!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            const Text('Programs offered',
                style: TextStyle(fontSize: AppFont.md, fontWeight: AppFont.bold)),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (final p in university.programs!)
                  StatusChip(label: p.name, color: AppColors.primary),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// A single review, its author shown only as a role — never a name or
/// handle — per the app's anonymity model.
class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.review});
  final UniversityReview review;

  String get _dateLabel {
    final d = DateTime.tryParse(review.createdAt);
    if (d == null) return '';
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
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
                color: review.authorIsMentor ? authBrandBlue : AppColors.primary,
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
                      color: const Color(0xFFF5A524),
                    ),
                ],
              ),
            ],
          ),
          if (_dateLabel.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(_dateLabel,
                style: const TextStyle(fontSize: AppFont.xs, color: AppColors.textMuted)),
          ],
          if (review.body != null && review.body!.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(review.body!,
                style: const TextStyle(
                    fontSize: AppFont.sm, color: AppColors.textPrimary, height: 1.4)),
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
        ],
      ),
    );
  }
}

class _ProsConsLine extends StatelessWidget {
  const _ProsConsLine({required this.icon, required this.color, required this.text});
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
            child: Text(text,
                style: const TextStyle(fontSize: AppFont.sm, color: AppColors.textPrimary)),
          ),
        ],
      ),
    );
  }
}

class _ReviewsTab extends ConsumerWidget {
  const _ReviewsTab({required this.university});
  final University university;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviewsAsync = ref.watch(universityReviewsListProvider(university.id));
    final hasReviewedAsync = ref.watch(hasReviewedUniversityProvider(university.id));
    final myProfile = ref.watch(myProfileProvider).asData?.value;
    // Only verified mentors can post — the backend enforces this too, but
    // showing the button to everyone else just leads to a 403 after they've
    // already filled out the whole form. "Verified students and alumni"
    // means mentors here: aspirants are prospective, not yet attending.
    final canReview = myProfile?.role == UserRole.mentor &&
        myProfile?.verificationStatus == 'VERIFIED';

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (hasReviewedAsync.value == false && canReview)
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () async {
                  final posted = await showModalBottomSheet<bool>(
                    context: context,
                    backgroundColor: AppColors.surface,
                    isScrollControlled: true,
                    shape: const RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
                    ),
                    builder: (_) => _WriteReviewSheet(universityId: university.id),
                  );
                  if (posted == true) {
                    ref.invalidate(universityReviewsListProvider(university.id));
                    ref.invalidate(hasReviewedUniversityProvider(university.id));
                    ref.invalidate(universityDetailProvider(university.slug));
                  }
                },
                icon: const Icon(Icons.edit_rounded, size: 18),
                label: const Text('Write a review'),
              ),
            ),
          if (hasReviewedAsync.value == true)
            const Padding(
              padding: EdgeInsets.only(bottom: AppSpacing.sm),
              child: Text(
                'You\'ve already reviewed this college.',
                style: TextStyle(fontSize: AppFont.sm, color: AppColors.textSecondary),
              ),
            ),
          const SizedBox(height: AppSpacing.md),
          reviewsAsync.when(
            loading: () => const Column(children: [SkeletonCard(), SkeletonCard()]),
            error: (err, _) => const EmptyState(
              icon: Icons.wifi_off_rounded,
              title: 'Could not load reviews',
              message: 'Pull to refresh to try again.',
            ),
            data: (reviews) {
              if (reviews.isEmpty) {
                return const EmptyState(
                  icon: Icons.rate_review_rounded,
                  title: 'No reviews yet',
                  message: 'Be the first verified student or mentor to review.',
                );
              }
              return Column(
                children: [
                  for (final review in reviews) ...[
                    _ReviewCard(review: review),
                    const SizedBox(height: AppSpacing.md),
                  ],
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _MentorsTab extends ConsumerWidget {
  const _MentorsTab({required this.university});
  final University university;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mentorsAsync = ref.watch(mentorsByUniversityProvider(university.id));

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: mentorsAsync.when(
        loading: () => const Column(children: [SkeletonCard(), SkeletonCard()]),
        error: (err, _) => const EmptyState(
          icon: Icons.wifi_off_rounded,
          title: 'Could not load mentors',
          message: 'Pull to refresh to try again.',
        ),
        data: (mentors) => mentors.isEmpty
            ? const EmptyState(
                icon: Icons.people_alt_rounded,
                title: 'No mentors yet',
                message: 'Verified mentors from this college will appear here.',
              )
            : Column(
                children: [for (final m in mentors) MentorCard(mentor: m)],
              ),
      ),
    );
  }
}

class _WriteReviewSheet extends ConsumerStatefulWidget {
  const _WriteReviewSheet({required this.universityId});
  final String universityId;

  @override
  ConsumerState<_WriteReviewSheet> createState() => _WriteReviewSheetState();
}

class _WriteReviewSheetState extends ConsumerState<_WriteReviewSheet> {
  int _overallRating = 5;
  final _bodyController = TextEditingController();
  final _prosController = TextEditingController();
  final _consController = TextEditingController();
  bool _submitting = false;
  String? _error;

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
      await ref.read(universityReviewsApiProvider).create(
            widget.universityId,
            overallRating: _overallRating,
            body: _bodyController.text.trim(),
            pros: _prosController.text.trim(),
            cons: _consController.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      setState(() {
        _submitting = false;
        _error = e.toString();
      });
    }
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
            const Text('Write a review',
                style: TextStyle(
                    fontSize: AppFont.lg, fontWeight: AppFont.extraBold)),
            const SizedBox(height: AppSpacing.md),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 1; i <= 5; i++)
                  IconButton(
                    onPressed: () => setState(() => _overallRating = i),
                    icon: Icon(
                      i <= _overallRating ? Icons.star_rounded : Icons.star_border_rounded,
                      color: AppColors.warning,
                      size: 32,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _bodyController,
              maxLines: 4,
              maxLength: 3000,
              decoration: const InputDecoration(
                hintText: 'Share your experience — academics, faculty, campus life...',
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
              Text(_error!,
                  style: const TextStyle(fontSize: AppFont.xs, color: AppColors.error)),
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
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Post review'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
