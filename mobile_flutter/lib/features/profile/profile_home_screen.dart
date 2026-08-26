import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/college_wishlist_api.dart';
import '../../core/network/users_api.dart';
import '../../core/network/wishlist_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';

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
      appBar: AppBar(
        leading: Padding(
          padding: const EdgeInsets.all(12),
          child: Image.asset(
            'assets/logo/uniscope_icon.png',
            fit: BoxFit.contain,
          ),
        ),
        title: const Text('Profile'),
      ),
      body: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            children: [
              AppCard(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  children: [
                    Stack(
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
                                child: Icon(Icons.edit_rounded,
                                    size: 14, color: Colors.white),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
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
                        StatusChip(label: roleLabel, color: AppColors.primary),
                        if (isMentor) ...[
                          const SizedBox(width: AppSpacing.xs),
                          StatusChip(label: statusLabel, color: statusColor),
                        ],
                      ],
                    ),
                    if (isMentor && !isVerified) ...[
                      const SizedBox(height: AppSpacing.md),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: () => context.go('/profile/verification'),
                          icon: const Icon(Icons.verified_rounded, size: 18),
                          label: const Text('Get Verified'),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (isMentor) ...[
                const SizedBox(height: AppSpacing.md),
                const MentorAvailabilityCard(),
              ] else ...[
                const SizedBox(height: AppSpacing.md),
                AppCard(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                  child: Row(
                    children: [
                      _Stat(value: '$savedColleges', label: 'Saved Colleges'),
                      const _StatDivider(),
                      _Stat(value: '$savedMentors', label: 'Saved Mentors'),
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
                      label: 'Edit Profile',
                      onTap: () => context.go('/profile/edit'),
                    ),
                    if (isMentor)
                      _MenuRow(
                        icon: Icons.verified_user_rounded,
                        label: 'Verification',
                        onTap: () => context.go('/profile/verification'),
                      ),
                    // Mentors already have Wallet as the top-level "Earnings"
                    // tab — this row is aspirant-only, since the Mentors tab
                    // took over that slot in the aspirant bottom nav.
                    if (user?.role != UserRole.mentor)
                      _MenuRow(
                        icon: Icons.account_balance_wallet_rounded,
                        label: 'Wallet',
                        onTap: () => context.push('/wallet'),
                      ),
                    _MenuRow(
                      icon: Icons.settings_rounded,
                      label: 'Settings',
                      onTap: () => context.go('/profile/settings'),
                      isLast: true,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              AppCard(
                padding: EdgeInsets.zero,
                onTap: () => ref.read(authControllerProvider.notifier).logout(),
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
    final isAvailable = profileAsync.asData?.value.isMentorAvailable ?? false;
    final isVerified =
        profileAsync.asData?.value.verificationStatus == 'VERIFIED';

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
              if (_saving)
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else if (isVerified)
                Switch(
                  value: isAvailable,
                  activeThumbColor: AppColors.primary,
                  onChanged: _toggle,
                )
              else
                // A disabled Switch swallows taps silently. Wrap it so an
                // unverified mentor tapping it lands on the verification
                // screen instead of hitting a dead control — matches
                // UsersService.updateProfile's backend gate.
                GestureDetector(
                  onTap: () => context.go('/profile/verification'),
                  child: AbsorbPointer(
                    child: Switch(value: false, onChanged: (_) {}),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            isVerified
                ? 'Students can always message you. This only controls whether '
                    'they can book a paid call. It switches itself off after 24 '
                    'hours so your profile never promises a call you forgot about.'
                : 'Students can already find and message you. Verify your '
                    'identity to start accepting paid calls and earning too.',
            style: const TextStyle(
              fontSize: AppFont.xs,
              color: AppColors.textSecondary,
            ),
          ),
          if (!isVerified) ...[
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
          ],
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
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
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool isLast;

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
              decoration: const BoxDecoration(
                color: AppColors.primaryLight,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 17, color: AppColors.primary),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: AppFont.md,
                  fontWeight: AppFont.medium,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              size: 22,
              color: AppColors.textMuted,
            ),
          ],
        ),
      ),
    );
  }
}
