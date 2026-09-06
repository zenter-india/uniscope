import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart' show UserRole;
import '../../widgets/app_widgets.dart';

/// Read-only "Profile Details" — users can view what's on file but not edit
/// it (product decision, 2026-09-06, both roles). The one thing still
/// changeable here is the avatar (the pencil badge → /profile/avatar).
/// Onboarding is where profile fields are set; changes after that go through
/// support. Class name kept as `EditProfileScreen` so the `/profile/edit`
/// route and its callers don't need touching.
class EditProfileScreen extends ConsumerWidget {
  const EditProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(myProfileProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Profile Details')),
      body: profileAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
        error: (err, _) => EmptyState(
          icon: Icons.wifi_off_rounded,
          title: 'Could not load your profile',
          message: 'Check your connection and try again.',
          actionLabel: 'Retry',
          onAction: () => ref.invalidate(myProfileProvider),
        ),
        data: (profile) {
          final isMentor = profile.role == UserRole.mentor;

          final rows = <(String, String)>[
            ('Display name', profile.displayName),
            if (profile.uniqueId != null) ('ID', profile.uniqueId!),
            if ((profile.gender ?? '').isNotEmpty) ('Gender', profile.gender!),
            if (isMentor) ...[
              ('Field of study', _orDash(profile.stream)),
              ('Bio', _orDash(profile.bio)),
              (
                'Languages',
                profile.languages.isEmpty ? '—' : profile.languages.join(', '),
              ),
            ] else ...[
              ('Qualification', _orDash(profile.qualification)),
              ('Field of interest', _orDash(profile.stream)),
              ('State', _orDash(profile.state)),
              ('City', _orDash(profile.city)),
            ],
          ];

          return Column(
            children: [
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
                        name: profile.displayName,
                        size: 72,
                        avatarUrl: profile.avatarUrl,
                      ),
                      // Avatar stays editable even though the fields don't.
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
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AppCard(
                        padding: EdgeInsets.zero,
                        child: Column(
                          children: [
                            for (var i = 0; i < rows.length; i++)
                              _DetailRow(
                                label: rows[i].$1,
                                value: rows[i].$2,
                                isLast: i == rows.length - 1,
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const Text(
                        'These details were set during sign-up and can\'t be '
                        'changed here. Your profile photo is the exception — '
                        'tap the pencil above to update it.',
                        style: TextStyle(
                          fontSize: AppFont.xs,
                          color: AppColors.textMuted,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

String _orDash(String? v) => (v ?? '').trim().isEmpty ? '—' : v!.trim();

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    this.isLast = false,
  });

  final String label;
  final String value;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.md,
      ),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : const Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: AppFont.sm,
                fontWeight: AppFont.semibold,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              value,
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
