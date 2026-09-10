import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/college_wishlist_api.dart';
import '../../core/network/university_reviews_api.dart'
    show hasReviewedUniversityProvider;
import '../../core/network/users_api.dart';
import '../../core/network/wishlist_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import '../universities/university_review_screen.dart'
    show CollegeReviewPromptBanner, openUniversityReview;

(String, Color) _verificationPresentation(String? status) {
  switch (status) {
    case 'VERIFIED':
      return ('Verified', AppColors.verified);
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      return ('Pending review', AppColors.info);
    case 'REJECTED':
      return ('Resubmit needed', AppColors.error);
    default:
      return ('Unverified', AppColors.warning);
  }
}

class ProfileHomeScreen extends ConsumerWidget {
  const ProfileHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final myProfileAsync = ref.watch(myProfileProvider);
    final displayName = (user?.displayName.isNotEmpty ?? false)
        ? user!.displayName
        : 'Student';
    final isMentor = user?.role == UserRole.mentor;
    final roleLabel = isMentor ? 'Mentor' : 'Aspirant';
    final savedColleges = ref.watch(savedCollegeIdsProvider).value?.length ?? 0;
    final savedMentors = ref.watch(savedMentorIdsProvider).value?.length ?? 0;
    // Verification proves a mentor's college identity to aspirants booking
    // them — aspirants aren't vetted for anything, so this whole section
    // (status chip + Get Verified prompt) only applies to mentors.
    final verificationStatus = myProfileAsync.asData?.value.verificationStatus;
    final (statusLabel, statusColor) = _verificationPresentation(
      verificationStatus,
    );
    final isVerified = verificationStatus == 'VERIFIED';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: GradientAppBar(
        // Student (aspirant) profile drops the logo chip per explicit
        // request — mentor keeps it, matching the rest of the mentor-side
        // screens that still show it in the app bar.
        leading: isMentor
            ? Padding(
                padding: const EdgeInsets.all(10),
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                  ),
                  child: Image.asset(
                    'assets/logo/uniscope_icon.png',
                    fit: BoxFit.contain,
                  ),
                ),
              )
            : null,
        title: const Text('Profile'),
      ),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Pinned above the scroll — always reachable for editing without
            // having to scroll back up to it.
            Padding(
              padding: const EdgeInsets.only(
                top: AppSpacing.md,
                bottom: AppSpacing.sm,
              ),
              child: Center(
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    AppAvatar(
                      name: displayName,
                      size: 72,
                      avatarUrl: myProfileAsync.asData?.value.avatarUrl,
                    ),
                    Positioned(
                      bottom: -2,
                      right: -2,
                      child: Material(
                        color: AppColors.primary,
                        shape: const CircleBorder(),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: () => context.push('/profile/avatar'),
                          child: const Padding(
                            padding: EdgeInsets.all(6),
                            child: Icon(
                              Icons.edit_rounded,
                              size: 14,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  0,
                  AppSpacing.md,
                  AppSpacing.md,
                ),
                child: Column(
                  children: [
                    AppCard(
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      child: Column(
                        children: [
                          Text(
                            displayName,
                            style: const TextStyle(
                              fontSize: AppFont.xl,
                              fontWeight: AppFont.extraBold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              StatusChip(
                                label: roleLabel,
                                color: AppColors.primary,
                              ),
                              if (isMentor) ...[
                                const SizedBox(width: AppSpacing.xs),
                                StatusChip(
                                  label: statusLabel,
                                  color: statusColor,
                                ),
                              ],
                            ],
                          ),
                          if (myProfileAsync.asData?.value.uniqueId !=
                              null) ...[
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              'ID: ${myProfileAsync.asData!.value.uniqueId}',
                              style: const TextStyle(
                                fontSize: AppFont.xs,
                                color: AppColors.textSecondary,
                                fontWeight: AppFont.medium,
                              ),
                            ),
                          ],
                          if (isMentor &&
                              (myProfileAsync.asData?.value.gender ?? '')
                                  .isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              myProfileAsync.asData!.value.gender!,
                              style: const TextStyle(
                                fontSize: AppFont.xs,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                          if (isMentor && !isVerified) ...[
                            const SizedBox(height: AppSpacing.md),
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton.icon(
                                onPressed: () =>
                                    context.go('/profile/verification'),
                                icon: const Icon(
                                  Icons.verified_rounded,
                                  size: 18,
                                ),
                                label: const Text('Get Verified'),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (isMentor) ...[
                      const SizedBox(height: AppSpacing.md),
                      const CollegeReviewPromptBanner(),
                      const MentorAvailabilityCard(),
                    ] else ...[
                      const SizedBox(height: AppSpacing.md),
                      AppCard(
                        padding: const EdgeInsets.symmetric(
                          vertical: AppSpacing.sm,
                        ),
                        child: Row(
                          children: [
                            _Stat(
                              value: '$savedColleges',
                              label: 'Saved Colleges',
                              onTap: () => context.push('/colleges/saved'),
                            ),
                            const _StatDivider(),
                            _Stat(
                              value: '$savedMentors',
                              label: 'Saved Mentors',
                              onTap: () => context.push('/mentors/saved'),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.md),
                    AppCard(
                      padding: EdgeInsets.zero,
                      child: Column(
                        children: [
                          _MenuRow(
                            icon: Icons.edit_rounded,
                            label: 'Profile Details',
                            onTap: () => context.go('/profile/edit'),
                          ),
                          if (isMentor)
                            _MenuRow(
                              icon: Icons.verified_user_rounded,
                              label: 'Verification',
                              onTap: () => context.go('/profile/verification'),
                            ),
                          if (isMentor)
                            _MenuRow(
                              icon: Icons.star_rounded,
                              label: 'Your Reviews',
                              onTap: () => context.push('/profile/reviews'),
                            ),
                          // Only a VERIFIED mentor has a real, id-checked
                          // universityId (see VerificationService.review's
                          // link) — that's also exactly the same eligibility
                          // the backend enforces for posting a review of it
                          // (see UniversityReviewsService.create). The row
                          // always shows for a mentor now (2026-09-07, per
                          // request) rather than disappearing until eligible
                          // — a locked row with a lock glyph explains why
                          // instead of the feature looking simply missing;
                          // tapping it early routes to Verification instead
                          // of a form that would just 403.
                          if (isMentor)
                            Builder(
                              builder: (context) {
                                final universityId =
                                    myProfileAsync.asData?.value.universityId;
                                final canReview = isVerified &&
                                    universityId != null;
                                // A review is write-once — once posted the row
                                // reads "Reviewed" and does nothing.
                                final alreadyReviewed = canReview &&
                                    (ref
                                            .watch(
                                              hasReviewedUniversityProvider(
                                                universityId,
                                              ),
                                            )
                                            .asData
                                            ?.value ??
                                        false);
                                return _MenuRow(
                                  icon: Icons.rate_review_rounded,
                                  label: alreadyReviewed
                                      ? 'College Review'
                                      : 'Rate Your College',
                                  locked: !canReview || alreadyReviewed,
                                  subtitle: alreadyReviewed
                                      ? "You've reviewed your college"
                                      : canReview
                                      ? null
                                      : !isVerified
                                      ? 'Verify your account first'
                                      : 'No college linked to your account yet',
                                  onTap: alreadyReviewed
                                      ? () => ScaffoldMessenger.of(
                                          context,
                                        ).showSnackBar(
                                          const SnackBar(
                                            content: Text(
                                              "You've already reviewed your "
                                              "college — a review can't be "
                                              'changed once submitted.',
                                            ),
                                          ),
                                        )
                                      : canReview
                                      ? () => openUniversityReview(
                                          context,
                                          ref,
                                          universityId: universityId,
                                          universityName: myProfileAsync
                                                  .asData
                                                  ?.value
                                                  .universityName ??
                                              'Your college',
                                          asMentorOwnCollege: true,
                                        )
                                      : !isVerified
                                      ? () =>
                                          context.go('/profile/verification')
                                      : () => ScaffoldMessenger.of(
                                          context,
                                        ).showSnackBar(
                                          const SnackBar(
                                            content: Text(
                                              'No college is linked to your account — message support to get this fixed.',
                                            ),
                                          ),
                                        ),
                                );
                              },
                            ),
                          // Mentors already have Wallet as the top-level
                          // "Earnings" tab — this row is aspirant-only, since
                          // the Mentors tab took over that slot in the
                          // aspirant bottom nav.
                          if (user?.role != UserRole.mentor)
                            _MenuRow(
                              icon: Icons.account_balance_wallet_rounded,
                              label: 'Wallet',
                              onTap: () => context.go('/wallet'),
                            ),
                          _MenuRow(
                            icon: Icons.settings_rounded,
                            label: 'Settings',
                            onTap: () => context.go('/profile/settings'),
                          ),
                          // Same support chat the Sessions tab's "Need
                          // help?" banner opens (SupportChatScreen, lazily
                          // provisioned per user) — just a second entry
                          // point, not a separate support system. Available
                          // to both roles.
                          _MenuRow(
                            icon: Icons.support_agent_rounded,
                            label: 'Need Help?',
                            onTap: () => context.push('/help'),
                            isLast: true,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppCard(
                      padding: EdgeInsets.zero,
                      onTap: () =>
                          ref.read(authControllerProvider.notifier).logout(),
                      child: const Padding(
                        padding: EdgeInsets.all(AppSpacing.md),
                        child: Row(
                          children: [
                            Icon(
                              Icons.logout_rounded,
                              size: 20,
                              color: AppColors.error,
                            ),
                            SizedBox(width: AppSpacing.md),
                            Text(
                              'Log Out',
                              style: TextStyle(
                                fontSize: AppFont.md,
                                color: AppColors.error,
                                fontWeight: AppFont.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Self-service opt-in/out of appearing in GET /mentors — no admin or DB
/// script needed. Shown for MENTOR-role users regardless of verification
/// status, but a note clarifies they won't actually be discoverable until
/// verified (see MentorsService eligibility filter).
/// Shared between the Profile screen and the Mentor Dashboard — same
/// toggle, same state, wherever it's placed.
class MentorAvailabilityCard extends ConsumerStatefulWidget {
  const MentorAvailabilityCard({super.key});

  @override
  ConsumerState<MentorAvailabilityCard> createState() =>
      _MentorAvailabilityCardState();
}

class _MentorAvailabilityCardState
    extends ConsumerState<MentorAvailabilityCard> {
  bool _saving = false;

  Future<void> _toggle(bool value) async {
    setState(() => _saving = true);
    try {
      await ref.read(usersApiProvider).updateProfile(isMentorAvailable: value);
      ref.invalidate(myProfileProvider);
    } catch (e) {
      if (!mounted) return;
      final message = e is DioException
          ? ((e.response?.data as Map<String, dynamic>?)?['message']
                    as String? ??
                e.message ??
                '$e')
          : '$e';
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(myProfileProvider);
    // valueOrNull (not asData?.value) so a background refresh — every
    // `ref.invalidate(myProfileProvider)` this screen fires — doesn't
    // momentarily blank the profile out and make a verified mentor's switch
    // fall through to the "not verified" branch (that bug sent a tap on the
    // toggle straight to the verification screen).
    final profile = profileAsync.hasValue ? profileAsync.value : null;
    final firstLoad = profile == null;
    final isAvailable = profile?.isMentorAvailable ?? false;
    final isVerified = profile?.verificationStatus == 'VERIFIED';

    // Mentors verified under the college-review requirement can't switch on
    // call bookings until they've posted a review of their own college
    // (mirrors UsersService.updateProfile's gate). Only relevant once
    // verified and a college is linked.
    final needsCollegeReview =
        (profile?.mustReviewCollege ?? false) && profile?.universityId != null;
    final hasReviewedCollege = needsCollegeReview
        ? (ref
                  .watch(hasReviewedUniversityProvider(profile!.universityId!))
                  .asData
                  ?.value ??
              false)
        : true;
    final reviewGateOpen =
        isVerified && needsCollegeReview && !hasReviewedCollege;

    Future<void> openReview() => openUniversityReview(
      context,
      ref,
      universityId: profile!.universityId!,
      universityName: profile.universityName ?? 'Your college',
      asMentorOwnCollege: true,
    ).then((_) => ref.invalidate(myProfileProvider));

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Accepting call bookings',
                  style: TextStyle(
                    fontWeight: AppFont.bold,
                    fontSize: AppFont.md,
                  ),
                ),
              ),
              if (_saving || firstLoad)
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                // Real switch for a verified mentor with no open gate; a
                // plainly-disabled one when unverified. When the college-
                // review gate is open, tapping opens the review flow
                // instead of toggling — the "Verify now" / "Review your
                // college" link below is otherwise the only route, so a
                // stray tap on the control can't yank the mentor off this
                // screen.
                Switch(
                  value: isVerified && isAvailable,
                  activeThumbColor: AppColors.primary,
                  onChanged: !isVerified
                      ? null
                      : reviewGateOpen
                      ? (_) => openReview()
                      : _toggle,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            !isVerified
                ? 'Students can already find and message you. Verify your '
                      'identity to start accepting paid calls and earning too.'
                : reviewGateOpen
                ? 'Students can always message you. Add a review of your '
                      'college to unlock paid call bookings — it takes a minute '
                      'and helps future applicants.'
                : 'Students can always message you. This only controls whether '
                      'they can book a paid call. It switches itself off after 24 '
                      'hours so your profile never promises a call you forgot about.',
            style: const TextStyle(
              fontSize: AppFont.xs,
              color: AppColors.textSecondary,
            ),
          ),
          if (!firstLoad && !isVerified) ...[
            const SizedBox(height: AppSpacing.xs),
            GestureDetector(
              onTap: () => context.go('/profile/verification'),
              child: const Text(
                'Verify Now',
                style: TextStyle(
                  fontSize: AppFont.xs,
                  fontWeight: AppFont.bold,
                  color: AppColors.primary,
                ),
              ),
            ),
          ] else if (!firstLoad && reviewGateOpen) ...[
            const SizedBox(height: AppSpacing.xs),
            GestureDetector(
              onTap: openReview,
              child: const Text(
                'Review your college',
                style: TextStyle(
                  fontSize: AppFont.xs,
                  fontWeight: AppFont.bold,
                  color: AppColors.primary,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label, this.onTap});
  final String value;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
          child: Column(
            children: [
              Text(
                value,
                style: const TextStyle(
                  fontSize: AppFont.xl,
                  fontWeight: AppFont.extraBold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                style: const TextStyle(
                  fontSize: AppFont.xs,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatDivider extends StatelessWidget {
  const _StatDivider();

  @override
  Widget build(BuildContext context) {
    return Container(width: 1, height: 36, color: AppColors.border);
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({
    required this.icon,
    required this.label,
    required this.onTap,
    this.isLast = false,
    this.subtitle,
    this.locked = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool isLast;

  /// Shown under the label — e.g. "Verify your account first" while [locked].
  final String? subtitle;

  /// Renders the row dimmed with a lock glyph instead of the usual chevron.
  /// The row still handles [onTap] — a locked row explains why rather than
  /// disappearing, so the feature isn't invisible before it unlocks.
  final bool locked;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 14,
        ),
        decoration: BoxDecoration(
          border: isLast
              ? null
              : const Border(bottom: BorderSide(color: AppColors.border)),
        ),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: locked
                    ? AppColors.textMuted.withValues(alpha: 0.12)
                    : AppColors.primaryLight,
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: 17,
                color: locked ? AppColors.textMuted : AppColors.primary,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: AppFont.md,
                      fontWeight: AppFont.medium,
                      color: locked
                          ? AppColors.textMuted
                          : AppColors.textPrimary,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 1),
                    Text(
                      subtitle!,
                      style: const TextStyle(
                        fontSize: AppFont.xs,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Icon(
              locked ? Icons.lock_outline_rounded : Icons.chevron_right_rounded,
              size: locked ? 18 : 22,
              color: AppColors.textMuted,
            ),
          ],
        ),
      ),
    );
  }
}
