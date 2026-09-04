import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/college_wishlist_api.dart';
import '../../core/network/universities_api.dart';
import '../../core/network/university_reviews_api.dart';
import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart' show UserRole;
import '../../widgets/app_widgets.dart';
import '../auth/auth_background.dart' show authBrandTeal, authBrandNavy;
import '../mentors/mentor_list_screen.dart';
import 'review_summary_card.dart';
import 'review_widgets.dart';
import 'university_review_screen.dart';

final universityDetailProvider = FutureProvider.autoDispose
    .family<University, String>(
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
  ConsumerState<UniversityDetailScreen> createState() =>
      _UniversityDetailScreenState();
}

class _UniversityDetailScreenState
    extends ConsumerState<UniversityDetailScreen> {
  static const _tabs = <(String, String)>[
    ('overview', 'Overview'),
    ('reviews', 'Reviews'),
    ('mentors', 'Mentors'),
  ];

  String _active = 'overview';

  @override
  Widget build(BuildContext context) {
    final detailAsync = ref.watch(
      universityDetailProvider(widget.universitySlug),
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      body: detailAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
        error: (err, _) => SafeArea(
          child: EmptyState(
            icon: Icons.wifi_off_rounded,
            title: 'Could not load this college',
            message: 'Check your connection and try again.',
            actionLabel: 'Retry',
            onAction: () =>
                ref.invalidate(universityDetailProvider(widget.universitySlug)),
          ),
        ),
        data: (uni) => Column(
          children: [
            _Hero(university: uni),
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              child: _TabBar(
                tabs: _tabs,
                active: _active,
                onSelect: (id) => setState(() => _active = id),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(child: _buildContent(context, uni)),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  0,
                  AppSpacing.md,
                  AppSpacing.md,
                ),
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
              errorBuilder: (_, __, ___) =>
                  _HeroPlaceholder(name: university.name),
              loadingBuilder: (context, child, progress) => progress == null
                  ? child
                  : _HeroPlaceholder(name: university.name),
            )
          else
            _HeroPlaceholder(name: university.name),
          // Bottom gradient so overlaid text stays legible regardless of
          // the eventual photo's brightness.
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.transparent,
                  Colors.black.withValues(alpha: 0.75),
                ],
                stops: const [0.4, 1.0],
              ),
            ),
          ),
          Padding(
            // Hugs the true top edge instead of the full device safe-area
            // inset — these are translucent circular buttons floating over
            // the hero photo, not content that needs to clear a notch/status
            // bar, so a small fixed gap reads better than however much
            // MediaQuery.padding.top happens to report (client-requested:
            // was sitting well below the top edge on some devices).
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.md,
              0,
            ),
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
                      icon: saved
                          ? Icons.favorite_rounded
                          : Icons.favorite_border_rounded,
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
                    const Icon(
                      Icons.location_on_rounded,
                      size: 15,
                      color: Colors.white70,
                    ),
                    const SizedBox(width: 3),
                    Expanded(
                      child: Text(
                        [
                          university.city,
                          university.state,
                        ].where((p) => p != null && p.isNotEmpty).join(', '),
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: AppFont.sm,
                        ),
                      ),
                    ),
                  ],
                ),
                if (university.rating != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(
                        Icons.star_rounded,
                        size: 18,
                        color: AppColors.warning,
                      ),
                      const SizedBox(width: 3),
                      Text(
                        university.rating!.toStringAsFixed(1),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: AppFont.bold,
                          fontSize: AppFont.sm,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '(${university.reviewCount} reviews)',
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: AppFont.sm,
                        ),
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
/// Branded stand-in for colleges with no freely-licensed campus photo.
///
/// Most of the ~840 seeded medical colleges have no CC-licensed image on
/// Wikimedia, and using a stock photo of some other campus would misrepresent
/// them. Instead each college gets a deterministic hue derived from its name
/// plus its initials, so the cards look intentional and distinguishable
/// rather than identical — and it costs no storage and no network round-trip,
/// unlike uploading a generated image per college.
class _HeroPlaceholder extends StatelessWidget {
  const _HeroPlaceholder({this.name});

  final String? name;

  /// Initials from the significant words of the college name (skipping the
  /// filler words nearly every Indian medical college shares).
  static String _initials(String value) {
    const skip = {
      'of',
      'and',
      'the',
      'for',
      'institute',
      'institution',
      'college',
      'medical',
      'sciences',
      'science',
      'hospital',
      'research',
      'centre',
      'center',
      'school',
      'university',
      'academy',
    };
    final words = value
        .split(RegExp(r'[\s,&\-]+'))
        .where((w) => w.isNotEmpty && !skip.contains(w.toLowerCase()))
        .toList();
    final source = words.isNotEmpty ? words : value.split(RegExp(r'\s+'));
    return source.take(3).map((w) => w[0].toUpperCase()).join();
  }

  @override
  Widget build(BuildContext context) {
    final label = name;
    if (label == null || label.trim().isEmpty) {
      return Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [authBrandTeal, authBrandNavy],
          ),
        ),
        child: Center(
          child: Icon(
            Icons.account_balance_rounded,
            size: 72,
            color: Colors.white.withValues(alpha: 0.25),
          ),
        ),
      );
    }

    final hue = (label.hashCode.abs() % 360).toDouble();
    final top = HSLColor.fromAHSL(1, hue, 0.42, 0.34).toColor();
    final bottom = HSLColor.fromAHSL(1, (hue + 28) % 360, 0.48, 0.18).toColor();

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [top, bottom],
        ),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned(
            right: -20,
            bottom: -10,
            child: Icon(
              Icons.account_balance_rounded,
              size: 190,
              color: Colors.white.withValues(alpha: 0.07),
            ),
          ),
          Text(
            _initials(label),
            style: TextStyle(
              fontSize: 56,
              fontWeight: AppFont.extraBold,
              letterSpacing: 2,
              color: Colors.white.withValues(alpha: 0.85),
            ),
          ),
        ],
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
                    color: active == id
                        ? Colors.white
                        : AppColors.textSecondary,
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
                  fontSize: AppFont.sm,
                  color: AppColors.textPrimary,
                  height: 1.5,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          AppCard(
            child: Column(
              children: [
                for (var i = 0; i < rows.length; i++)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      vertical: AppSpacing.sm,
                    ),
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
                        Text(
                          rows[i].$1,
                          style: const TextStyle(
                            fontSize: AppFont.sm,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        Flexible(
                          child: Text(
                            rows[i].$2,
                            textAlign: TextAlign.right,
                            style: const TextStyle(
                              fontSize: AppFont.sm,
                              fontWeight: AppFont.semibold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          if (university.programs != null &&
              university.programs!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            const Text(
              'Programs offered',
              style: TextStyle(fontSize: AppFont.md, fontWeight: AppFont.bold),
            ),
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

class _ReviewsTab extends ConsumerWidget {
  const _ReviewsTab({required this.university});
  final University university;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviewsAsync = ref.watch(
      universityReviewsListProvider(university.id),
    );
    final hasReviewedAsync = ref.watch(
      hasReviewedUniversityProvider(university.id),
    );
    final myProfile = ref.watch(myProfileProvider).asData?.value;
    // Only a verified mentor reviewing their OWN linked college can post —
    // the backend enforces both checks too, but showing the button
    // anywhere else just leads to a 403 after they've already filled out
    // the whole form. "Verified students and alumni" means mentors here:
    // aspirants are prospective, not yet attending. A mentor's
    // verification ties them to exactly one college, so they can't review
    // any college they merely browse.
    final canReview =
        myProfile?.role == UserRole.mentor &&
        myProfile?.verificationStatus == 'VERIFIED' &&
        myProfile?.universityId == university.id;

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Nothing to summarize with zero reviews — the list below already
          // shows its own "no reviews" state, so skip this to avoid saying
          // "no reviews yet" twice on the same screen.
          if (university.reviewCount > 0) ...[
            ReviewSummaryCard(
              universityId: university.id,
              fallbackRating: university.rating,
              fallbackReviewCount: university.reviewCount,
              onTap: () => context.push(
                '/colleges/detail/reviews',
                extra: {
                  'universityId': university.id,
                  'universityName': university.name,
                },
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          if (canReview)
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () async {
                  final posted = await openUniversityReview(
                    context,
                    ref,
                    universityId: university.id,
                    universityName: university.name,
                  );
                  if (posted == true) {
                    // The review screen already refreshed the review
                    // providers; the detail response also carries a
                    // {rating, reviewCount}, so refresh that too.
                    ref.invalidate(universityDetailProvider(university.slug));
                  }
                },
                icon: const Icon(Icons.edit_rounded, size: 18),
                label: Text(
                  hasReviewedAsync.value == true
                      ? 'Edit your review'
                      : 'Write a review',
                ),
              ),
            ),
          const SizedBox(height: AppSpacing.md),
          reviewsAsync.when(
            loading: () =>
                const Column(children: [SkeletonCard(), SkeletonCard()]),
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
                  message:
                      'Waiting for a verified mentor from this college to write one.',
                );
              }
              return Column(
                children: [
                  for (final review in reviews) ...[
                    ReviewCard(review: review),
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
