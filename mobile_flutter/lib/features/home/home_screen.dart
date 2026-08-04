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
              // The gradient is scoped to this container (not the whole
              // screen) so the full teal→blue run resolves inside the
              // canopy's own height — stretched screen-wide, the blue
              // stop lands below the fold and only flat teal shows.
              Container(
                width: double.infinity,
                decoration: const BoxDecoration(gradient: AppGradients.canopy),
                padding: EdgeInsets.only(
                  top: MediaQuery.of(context).padding.top,
                  // Trailing space the sheet is pulled up over, so the
                  // rounded corners sit on gradient rather than on itself.
                  bottom: AppSpacing.md + AppRadius.xl,
                ),
                child: Column(
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
                          Row(
                            children: [
                              Image.asset(
                                'assets/logo/uniscope_icon.png',
                                width: 44,
                                height: 44,
                                fit: BoxFit.contain,
                              ),
                              const SizedBox(width: AppSpacing.xs),
                              Text(
                                'Uniscope',
                                style: TextStyle(
                                  fontSize: AppFont.display,
                                  fontWeight: AppFont.extraBold,
                                  color: Colors.white.withValues(alpha: 0.95),
                                ),
                              ),
                            ],
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
                                    border: Border.all(
                                      color: Colors.white.withValues(alpha: 0.85),
                                      width: 2,
                                    ),
                                  ),
                                  child: AppAvatar(
                                      name: displayName,
                                      size: 40,
                                      solid: true,
                                      avatarUrl: myAvatarUrl),
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
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  firstName == null
                                      ? _greeting
                                      : '$_greeting, $firstName',
                                  style: const TextStyle(
                                    fontSize: AppFont.xl,
                                    fontWeight: AppFont.extraBold,
                                    color: Colors.white,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'What are you looking for today?',
                                  style: TextStyle(
                                    fontSize: AppFont.sm,
                                    color: Colors.white.withValues(alpha: 0.82),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const NotificationBell(color: Colors.white),
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
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(AppRadius.full),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.search_rounded,
                                size: 20,
                                color: authBrandTeal,
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              const Text(
                                'Search colleges, courses, or mentors...',
                                style: TextStyle(
                                  fontSize: AppFont.sm,
                                  color: AppColors.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // ─── Sheet: opaque, pulled up over the canopy's foot ─────
              Container(
                width: double.infinity,
                transform: Matrix4.translationValues(0, -AppRadius.xl, 0),
                constraints: BoxConstraints(
                  minHeight: MediaQuery.of(context).size.height * 0.62,
                ),
                decoration: const BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.vertical(
                    top: Radius.circular(AppRadius.xl),
                  ),
                ),
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  AppSpacing.lg,
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
                                  .read(collegeStateFilterProvider.notifier)
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
                            onTap: () => context.push('/mentors/saved'),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: _QuickCard(
                            label: 'Saved Colleges',
                            sub: 'Favorites',
                            icon: Icons.bookmark_outline_rounded,
                            onTap: () => context.push('/colleges/saved'),
                          ),
                        ),
                      ],
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
                              if (u.mbbsSeats != null) '${u.mbbsSeats} seats',
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
                    const SizedBox(height: AppSpacing.lg),
                    SectionHeader(
                      title: 'Top Mentors',
                      accentColor: authBrandTeal,
                      onSeeAll: () => context.go('/mentors'),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    mentorsAsync.when(
                      loading: () => const Column(
                        children: [SkeletonCard(), SkeletonCard()],
                      ),
                      error: (_, __) => const SizedBox.shrink(),
                      data: (mentors) => Column(
                        children: mentors.take(3).map((m) {
                          return _MentorTeaser(
                            mentor: m,
                            onTap: () => context.go('/mentors'),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
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
  });

  final String label;
  final String? sub;
  final IconData icon;
  final VoidCallback onTap;

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
              color: authBrandTeal.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 18, color: authBrandTeal),
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

class _MentorTeaser extends StatelessWidget {
  const _MentorTeaser({required this.mentor, required this.onTap});

  final Mentor mentor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          AppAvatar(
              name: mentor.displayName, size: 44, avatarUrl: mentor.avatarUrl),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  mentor.displayName,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: AppFont.md,
                    fontWeight: AppFont.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    if (mentor.rating != null) ...[
                      const Icon(
                        Icons.star_rounded,
                        size: 14,
                        color: AppColors.warning,
                      ),
                      const SizedBox(width: 2),
                      Text(
                        '${mentor.rating!.toStringAsFixed(1)} · ',
                        style: const TextStyle(
                          fontSize: AppFont.xs,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                    Flexible(
                      child: Text(
                        mentor.university?.name ?? 'Mentor',
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: AppFont.xs,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
