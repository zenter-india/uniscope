import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/mentors_api.dart';
import '../../core/network/universities_api.dart';
import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import '../auth/auth_background.dart' show authBrandTeal;
import '../mentors/mentor_list_screen.dart';
import '../universities/university_list_screen.dart'
    show collegeStateFilterProvider;

/// How deep the sheet's top wave dips at the left/right edges (it peaks
/// back up to 0 at the horizontal center) — shared between the clipper
/// and the sheet's top padding so content never sits under the curve.
const double _sheetCurveHeight = 28;

/// A smooth arc across the sheet's entire top edge — replaces a rounded
/// rectangle (curved only at the two corners, flat in between) with one
/// continuous wave, so the "pulled up over the canopy" look reads as a
/// single curve rather than a straight cut with rounded ends.
class _CurvedTopClipper extends CustomClipper<Path> {
  const _CurvedTopClipper();

  @override
  Path getClip(Size size) {
    return Path()
      ..moveTo(0, _sheetCurveHeight)
      ..quadraticBezierTo(size.width / 2, 0, size.width, _sheetCurveHeight)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
  }

  @override
  bool shouldReclip(covariant _CurvedTopClipper oldClipper) => false;
}

/// Soft emerald halo traced along the exact same wave path as
/// [_CurvedTopClipper], painted underneath the sheet, right at the seam
/// where the solid navy canopy meets the white sheet below — the color
/// change alone is already a hard, obvious edge now (navy vs white), so
/// this is a finishing glow at that boundary rather than the load-bearing
/// zone-marker it was when header and sheet used to be the same flat color.
class _WaveGlowPainter extends CustomPainter {
  const _WaveGlowPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, _sheetCurveHeight)
      ..quadraticBezierTo(size.width / 2, 0, size.width, _sheetCurveHeight);
    final paint = Paint()
      ..color = AppColors.primary.withValues(alpha: 0.18)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 10
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 16);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _WaveGlowPainter oldDelegate) => false;
}

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  String get _greeting {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final displayName = ref.watch(authControllerProvider).user?.displayName;
    final firstName = displayName?.split(' ').first;
    final universitiesAsync = ref.watch(universitiesListProvider);
    final mentorsAsync = ref.watch(mentorsListProvider);
    final myState = ref.watch(myProfileProvider).asData?.value.state;
    final myAvatarUrl = ref.watch(myProfileProvider).asData?.value.avatarUrl;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: RefreshIndicator(
        color: authBrandTeal,
        onRefresh: () async {
          ref.invalidate(universitiesListProvider);
          ref.invalidate(mentorsListProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ─── Canopy ─────────────────────────────────────────────
              // Solid navy block (AppGradients.canopy) — the client-approved
              // "Option B" direction: a real navy color block up top,
              // pulled from the actual logo pixels, rather than the earlier
              // light teal-tinted wash that read as "light and dull".
              Container(
                width: double.infinity,
                decoration: const BoxDecoration(gradient: AppGradients.canopy),
                padding: EdgeInsets.only(
                  top: MediaQuery.of(context).padding.top,
                  // Tightened from AppSpacing.md + AppRadius.xl — that much
                  // empty space put the wave curve so far below the search
                  // bar it didn't read as connected to it.
                  bottom: AppSpacing.lg,
                ),
                child: Stack(
                  children: [
                    // The decorative building illustration that used to sit
                    // here was drawn in navy/teal for the old light "sky
                    // wash" background — on the solid navy canopy (Option B)
                    // it would render essentially invisible against its own
                    // background color. Removed rather than recolored:
                    // Option B's approved direction is a clean navy block,
                    // no illustration.
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.md,
                            AppSpacing.md,
                            AppSpacing.md,
                            0,
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Flexible(
                                child: Row(
                                  children: [
                                    Image.asset(
                                      'assets/logo/uniscope_icon.png',
                                      width: 44,
                                      height: 44,
                                      fit: BoxFit.contain,
                                    ),
                                    const SizedBox(width: AppSpacing.xs),
                                    Flexible(
                                      child: Text(
                                        'Uniscope',
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          fontSize: AppFont.display,
                                          fontWeight: AppFont.extraBold,
                                          color: AppColors.textInverse,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: AppSpacing.sm),
                                    // Moved here from the greeting row —
                                    // top-left, next to the wordmark,
                                    // instead of top-right. White on the
                                    // navy canopy now, not textPrimary.
                                    const NotificationBell(
                                      color: AppColors.textInverse,
                                    ),
                                  ],
                                ),
                              ),
                              if (displayName != null)
                                Material(
                                  color: Colors.transparent,
                                  shape: const CircleBorder(),
                                  child: InkWell(
                                    customBorder: const CircleBorder(),
                                    onTap: () => context.go('/profile'),
                                    child: Container(
                                      padding: const EdgeInsets.all(2),
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        // Translucent white, not
                                        // AppColors.border — that's a light
                                        // grey, invisible against navy.
                                        border: Border.all(
                                          color: AppColors.textInverse
                                              .withValues(alpha: 0.4),
                                          width: 2,
                                        ),
                                      ),
                                      child: AppAvatar(
                                        name: displayName,
                                        size: 40,
                                        solid: true,
                                        avatarUrl: myAvatarUrl,
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.md,
                            AppSpacing.sm,
                            AppSpacing.md,
                            AppSpacing.md,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text.rich(
                                TextSpan(
                                  text: firstName == null
                                      ? _greeting
                                      : '$_greeting, ',
                                  style: const TextStyle(
                                    fontSize: AppFont.xl,
                                    fontWeight: AppFont.extraBold,
                                    color: AppColors.textInverse,
                                  ),
                                  children: firstName == null
                                      ? null
                                      : [
                                          TextSpan(
                                            text: firstName,
                                            // mintAccent, not primary —
                                            // plain emerald primary only
                                            // measures ~3:1 on the navy
                                            // canopy; mintAccent clears
                                            // 9.5:1 (checked, not guessed).
                                            style: const TextStyle(
                                              color: AppColors.mintAccent,
                                            ),
                                          ),
                                        ],
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'What are you looking for today?',
                                style: TextStyle(
                                  fontSize: AppFont.sm,
                                  color: AppColors.textInverse.withValues(
                                    alpha: 0.75,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md,
                          ),
                          child: GestureDetector(
                            onTap: () => context.go('/colleges'),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.md,
                                vertical: 14,
                              ),
                              decoration: BoxDecoration(
                                // Translucent white on the navy canopy,
                                // not a solid opaque surface — reads as
                                // "part of the header", the sheet below
                                // is where opaque white cards start.
                                color: AppColors.textInverse.withValues(
                                  alpha: 0.14,
                                ),
                                border: Border.all(
                                  color: AppColors.textInverse.withValues(
                                    alpha: 0.2,
                                  ),
                                ),
                                borderRadius: BorderRadius.circular(
                                  AppRadius.full,
                                ),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.search_rounded,
                                    size: 20,
                                    color: AppColors.mintAccent,
                                  ),
                                  const SizedBox(width: AppSpacing.sm),
                                  Expanded(
                                    child: Text(
                                      'Search colleges, courses, or mentors...',
                                      style: TextStyle(
                                        fontSize: AppFont.sm,
                                        color: AppColors.textInverse.withValues(
                                          alpha: 0.75,
                                        ),
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // ─── Sheet: opaque, pulled up over the canopy's foot ─────
              // A wave clip (not just corner radii) so the whole top edge
              // arcs smoothly instead of a rounded-corners-with-a-straight-
              // middle look.
              Transform.translate(
                offset: const Offset(0, -_sheetCurveHeight),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: MediaQuery.of(context).size.height * 0.62,
                  ),
                  // PhysicalShape's own elevation shadow turned out too
                  // faint to actually read as a boundary (Material's
                  // built-in shadow projects mostly down/outward from the
                  // shape, not up into the canopy area above the curve
                  // where it's needed) — a manually-painted glow tracing
                  // the exact same curve, stacked underneath, is guaranteed
                  // visible instead of depending on that shadow model.
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: CustomPaint(painter: const _WaveGlowPainter()),
                      ),
                      PhysicalShape(
                        clipper: const _CurvedTopClipper(),
                        color: AppColors.background,
                        elevation: 0,
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.md,
                            AppSpacing.lg + _sheetCurveHeight,
                            AppSpacing.md,
                            AppSpacing.xl,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Quick actions',
                                style: TextStyle(
                                  fontSize: AppFont.md,
                                  fontWeight: AppFont.bold,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(height: AppSpacing.sm),
                              Row(
                                children: [
                                  Expanded(
                                    // State, not GPS: 85% of government MBBS seats
                                    // are state-quota, so the aspirant's own state
                                    // is the filter that actually affects where
                                    // they can get in. Falls back to the plain
                                    // list until onboarding has captured a state.
                                    child: _QuickCard(
                                      label: myState ?? 'All Colleges',
                                      sub: myState != null
                                          ? 'In your state'
                                          : 'Browse every college',
                                      icon: Icons.place_outlined,
                                      onTap: () {
                                        ref
                                            .read(
                                              collegeStateFilterProvider
                                                  .notifier,
                                            )
                                            .set(myState != null);
                                        context.go('/colleges');
                                      },
                                    ),
                                  ),
                                  const SizedBox(width: AppSpacing.sm),
                                  Expanded(
                                    child: _QuickCard(
                                      label: 'Find Mentors',
                                      sub: 'Expert Guidance',
                                      icon: Icons.school_rounded,
                                      accentColor: AppColors.textPrimary,
                                      onTap: () => context.go('/mentors'),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: AppSpacing.sm),
                              Row(
                                children: [
                                  Expanded(
                                    child: _QuickCard(
                                      label: 'Saved Mentors',
                                      sub: 'Your shortlist',
                                      icon: Icons.favorite_border_rounded,
                                      accentColor: AppColors.error,
                                      onTap: () =>
                                          context.push('/mentors/saved'),
                                    ),
                                  ),
                                  const SizedBox(width: AppSpacing.sm),
                                  Expanded(
                                    child: _QuickCard(
                                      label: 'Saved Colleges',
                                      sub: 'Favorites',
                                      icon: Icons.bookmark_outline_rounded,
                                      accentColor: AppColors.textPrimary,
                                      onTap: () =>
                                          context.push('/colleges/saved'),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: AppSpacing.lg),
                              SectionHeader(
                                title: 'Top Mentors',
                                accentColor: authBrandTeal,
                                onSeeAll: () => context.go('/mentors'),
                              ),
                              const SizedBox(height: AppSpacing.md),
                              mentorsAsync.when(
                                loading: () => const SizedBox(
                                  height: 150,
                                  child: Row(
                                    children: [
                                      Expanded(child: SkeletonCard()),
                                      SizedBox(width: AppSpacing.sm),
                                      Expanded(child: SkeletonCard()),
                                    ],
                                  ),
                                ),
                                error: (_, __) => const SizedBox.shrink(),
                                data: (mentors) => SizedBox(
                                  height: 150,
                                  child: ListView.separated(
                                    scrollDirection: Axis.horizontal,
                                    itemCount: mentors.take(8).length,
                                    separatorBuilder: (_, __) =>
                                        const SizedBox(width: AppSpacing.sm),
                                    itemBuilder: (_, i) => _MentorTeaser(
                                      mentor: mentors[i],
                                      onTap: () => context.go('/mentors'),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: AppSpacing.lg),
                              SectionHeader(
                                title: 'Keep Exploring',
                                accentColor: authBrandTeal,
                                onSeeAll: () => context.go('/colleges'),
                              ),
                              const SizedBox(height: AppSpacing.md),
                              universitiesAsync.when(
                                loading: () => const Column(
                                  children: [SkeletonCard(), SkeletonCard()],
                                ),
                                error: (_, __) => const SizedBox.shrink(),
                                data: (universities) => Column(
                                  children: universities.take(3).map((u) {
                                    return _CollegeCard(
                                      name: u.name,
                                      sub: [
                                        // Was a binary Government/Private ternary that
                                        // mislabelled CENTRAL colleges (e.g. NIFT
                                        // Delhi) and DEEMED ones as "Private".
                                        switch (u.type) {
                                          'GOVERNMENT' => 'Government',
                                          'CENTRAL' => 'Central',
                                          'DEEMED' => 'Deemed',
                                          _ => 'Private',
                                        },
                                        if (u.mbbsSeats != null)
                                          '${u.mbbsSeats} seats',
                                      ].join(' · '),
                                      onTap: () => context.push(
                                        '/colleges/detail',
                                        extra: {
                                          'universitySlug': u.slug,
                                          'universityName': u.name,
                                        },
                                      ),
                                    );
                                  }).toList(),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickCard extends StatelessWidget {
  const _QuickCard({
    required this.label,
    required this.icon,
    required this.onTap,
    this.sub,
    this.accentColor = authBrandTeal,
  });

  final String label;
  final String? sub;
  final IconData icon;
  final VoidCallback onTap;

  /// Each card gets its own accent instead of a uniform teal tint — matches
  /// the reference's mix of colors per icon rather than one repeated hue.
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 18, color: accentColor),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: AppFont.xs,
                    fontWeight: AppFont.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                if (sub != null)
                  Text(
                    sub!,
                    style: const TextStyle(
                      fontSize: 10,
                      color: AppColors.textSecondary,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CollegeCard extends StatelessWidget {
  const _CollegeCard({
    required this.name,
    required this.sub,
    required this.onTap,
  });

  final String name;
  final String sub;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: authBrandTeal.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: Icon(
              Icons.account_balance_rounded,
              size: 20,
              color: authBrandTeal,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: AppFont.md,
                    fontWeight: AppFont.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  sub,
                  style: const TextStyle(
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
            size: 22,
          ),
        ],
      ),
    );
  }
}

/// Fixed-width tile for the Home screen's horizontally-scrolling Top
/// Mentors row — content-heavy Row layout from before only worked full-
/// width, so this is a distinct vertical layout rather than a resize of
/// that one.
class _MentorTeaser extends StatelessWidget {
  const _MentorTeaser({required this.mentor, required this.onTap});

  final Mentor mentor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 132,
      child: AppCard(
        onTap: onTap,
        padding: const EdgeInsets.all(AppSpacing.sm),
        // Centered rather than top-aligned: the card's height is set by
        // the row's shared SizedBox, not by this content, so a top-aligned
        // Column left visible empty space beneath the shortest cards.
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            AppAvatar(
              name: mentor.displayName,
              size: 60,
              avatarUrl: mentor.avatarUrl,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              mentor.displayName,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: AppFont.xs,
                fontWeight: AppFont.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 3),
            if (mentor.rating != null)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.star_rounded,
                    size: 13,
                    color: AppColors.warning,
                  ),
                  const SizedBox(width: 2),
                  Text(
                    mentor.rating!.toStringAsFixed(1),
                    style: const TextStyle(
                      fontSize: AppFont.xs,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              )
            else
              Text(
                mentor.university?.name ?? 'Mentor',
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: AppFont.xs,
                  color: AppColors.textSecondary,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
