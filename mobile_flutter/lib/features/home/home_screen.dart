import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/mentors_api.dart';
import '../../core/network/sessions_api.dart';
import '../../core/network/universities_api.dart';
import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import '../auth/auth_background.dart' show authBrandTeal;
import '../mentors/mentor_list_screen.dart';
import '../sessions/session_list_screen.dart' show sessionsListProvider;
import '../universities/university_list_screen.dart'
    show collegeStateFilterProvider;

/// Statuses that still need the aspirant's attention — used to surface a
/// mentor in the Home "Pick up where you left off" strip.
const _homeActiveStatuses = {
  SessionStatus.pending,
  SessionStatus.accepted,
  SessionStatus.ringing,
  SessionStatus.inProgress,
};

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
    final sessionsAsync = ref.watch(sessionsListProvider);
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
                                      fontSize: AppFont.xxl,
                                      fontWeight: AppFont.extraBold,
                                      color: Colors.white.withValues(
                                        alpha: 0.95,
                                      ),
                                    ),
                                  ),
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
                                    border: Border.all(
                                      color: Colors.white.withValues(
                                        alpha: 0.85,
                                      ),
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
                                    fontSize: AppFont.lg,
                                    fontWeight: AppFont.extraBold,
                                    color: Colors.white,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'What are you looking for today?',
                                  style: TextStyle(
                                    fontSize: AppFont.xs,
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
                              const Icon(
                                Icons.search_rounded,
                                size: 20,
                                color: authBrandTeal,
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              const Expanded(
                                child: Text(
                                  'Search universities...',
                                  style: TextStyle(
                                    fontSize: AppFont.sm,
                                    color: AppColors.textMuted,
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
                            onTap: () => context.push('/mentors/saved'),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: _QuickCard(
                            label: 'Saved Colleges',
                            sub: 'Favorites',
                            icon: Icons.bookmark_outline_rounded,
                            accentColor: AppColors.textPrimary,
                            onTap: () => context.push('/colleges/saved'),
                          ),
                        ),
                      ],
                    ),
                    // ─── Pick up where you left off ───────────────────
                    // Only renders when there's an open chat or a live/
                    // pending call — otherwise it takes no space.
                    sessionsAsync.maybeWhen(
                      orElse: () => const SizedBox.shrink(),
                      data: (sessions) {
                        final active = _activeByMentor(sessions);
                        if (active.isEmpty) return const SizedBox.shrink();
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SectionHeader(
                              title: 'Pick up where you left off',
                              accentColor: authBrandTeal,
                              onSeeAll: () => context.go('/chats'),
                            ),
                            const SizedBox(height: AppSpacing.md),
                            for (final s in active.take(3))
                              _ActiveSessionRow(session: s),
                            const SizedBox(height: AppSpacing.lg),
                          ],
                        );
                      },
                    ),
                    SectionHeader(
                      title: 'Top mentors for you',
                      accentColor: authBrandTeal,
                      onSeeAll: () => context.go('/mentors'),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    mentorsAsync.when(
                      loading: () => const SizedBox(
                        height: 206,
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
                        height: 206,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: mentors.take(8).length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(width: AppSpacing.sm),
                          itemBuilder: (_, i) =>
                              _MentorSpotlightCard(mentor: mentors[i]),
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

/// Newest still-open session per mentor (chat open, or a live/pending
/// call), newest first — backs the Home "Pick up where you left off" strip.
List<Session> _activeByMentor(List<Session> sessions) {
  final byMentor = <String, Session>{};
  for (final s in sessions) {
    if (!_homeActiveStatuses.contains(s.status)) continue;
    final existing = byMentor[s.mentorId];
    if (existing == null ||
        s.requestedAt.compareTo(existing.requestedAt) > 0) {
      byMentor[s.mentorId] = s;
    }
  }
  return byMentor.values.toList()
    ..sort((a, b) => b.requestedAt.compareTo(a.requestedAt));
}

/// One "Pick up where you left off" row — mentor, a one-line status with a
/// state dot, and a single action (Join a joinable call / View a pending
/// call / Open a chat). Tapping the row opens that mentor's chat thread.
class _ActiveSessionRow extends ConsumerWidget {
  const _ActiveSessionRow({required this.session});
  final Session session;

  (String, Color) _status() {
    final isCall = session.type == 'AUDIO_CALL';
    switch (session.status) {
      case SessionStatus.pending:
        return isCall
            ? ('Call requested', AppColors.warning)
            : ('Chat starting…', AppColors.warning);
      case SessionStatus.ringing:
        return ('Call connecting…', AppColors.warning);
      case SessionStatus.accepted:
        return isCall
            ? ('Ready to join', AppColors.primary)
            : ('Chat is open', AppColors.primary);
      case SessionStatus.inProgress:
        return isCall
            ? ('Call in progress', AppColors.primary)
            : ('Chatting now', AppColors.primary);
      default:
        return ('Active', AppColors.primary);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isCall = session.type == 'AUDIO_CALL';
    final joinable = isCall &&
        (session.status == SessionStatus.accepted ||
            session.status == SessionStatus.ringing ||
            session.status == SessionStatus.inProgress);
    final (label, dotColor) = _status();

    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      onTap: () => startChatWithMentor(context, ref, session.mentorId),
      child: Row(
        children: [
          AppAvatar(
            name: session.mentorName,
            size: 40,
            avatarUrl: session.mentorAvatarUrl,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  session.mentorName,
                  style: const TextStyle(
                    fontSize: AppFont.md,
                    fontWeight: AppFont.bold,
                    color: AppColors.textPrimary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: dotColor,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        label,
                        style: const TextStyle(
                          fontSize: AppFont.xs,
                          color: AppColors.textSecondary,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          _MiniButton(
            label: joinable
                ? 'Join'
                : isCall
                ? 'View'
                : 'Open',
            onTap: () {
              if (joinable) {
                context.push('/call/${session.id}');
              } else if (isCall) {
                startChatWithMentor(context, ref, session.mentorId);
              } else {
                context.push(
                  '/chats/room',
                  extra: {'sessionId': session.id},
                );
              }
            },
          ),
        ],
      ),
    );
  }
}

/// Fixed-width mentor card for the Home "Top mentors for you" rail — a
/// tinted hero with the portrait + a Verified tick, then name, college,
/// rating (or a New tag) and a "Start free chat" action. Tapping the hero
/// opens the mentor's profile; the button starts a free chat.
class _MentorSpotlightCard extends ConsumerWidget {
  const _MentorSpotlightCard({required this.mentor});

  final Mentor mentor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subtitle = mentor.university?.name ?? mentor.stream ?? 'Mentor';

    return SizedBox(
      width: 176,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: AppShadows.card,
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InkWell(
              onTap: () => context.push('/mentors/${mentor.id}'),
              child: Container(
                height: 82,
                color: AppColors.primaryLight,
                child: Stack(
                  alignment: Alignment.bottomCenter,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: AppAvatar(
                        name: mentor.displayName,
                        size: 54,
                        avatarUrl: mentor.avatarUrl,
                      ),
                    ),
                    if (mentor.isVerified)
                      Positioned(
                        top: 8,
                        right: 8,
                        child: Container(
                          padding: const EdgeInsets.all(3),
                          decoration: const BoxDecoration(
                            color: AppColors.surface,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.verified_rounded,
                            size: 13,
                            color: AppColors.verified,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    mentor.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: AppFont.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 6),
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
                          '${mentor.rating!.toStringAsFixed(1)} (${mentor.reviewCount})',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: AppFont.semibold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    )
                  else
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight,
                        borderRadius: BorderRadius.circular(AppRadius.full),
                      ),
                      child: const Text(
                        'NEW',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: AppFont.bold,
                          letterSpacing: 0.4,
                          color: AppColors.primaryDark,
                        ),
                      ),
                    ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: _MiniButton(
                      label: 'Start free chat',
                      onTap: () =>
                          startChatWithMentor(context, ref, mentor.id),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Small tinted action button — used by the Home "Pick up where you left
/// off" rows and the mentor spotlight card.
class _MiniButton extends StatelessWidget {
  const _MiniButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.primaryLight,
      borderRadius: BorderRadius.circular(AppRadius.sm),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: AppFont.xs,
              fontWeight: AppFont.bold,
              color: AppColors.primaryDark,
            ),
          ),
        ),
      ),
    );
  }
}
