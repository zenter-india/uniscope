import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/auth_api.dart';
import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/primary_button.dart';

/// Port of RN `auth/RoleSelectionScreen.tsx`.
class RoleSelectionScreen extends ConsumerStatefulWidget {
  const RoleSelectionScreen({super.key});

  @override
  ConsumerState<RoleSelectionScreen> createState() =>
      _RoleSelectionScreenState();
}

class _RoleOption {
  const _RoleOption(this.role, this.icon, this.title, this.description);
  final UserRole role;
  final String icon;
  final String title;
  final String description;
}

const _roles = <_RoleOption>[
  _RoleOption(
    UserRole.aspirant,
    '🎓',
    'Aspirant',
    'Find the right college and get guidance from real mentors.',
  ),
  _RoleOption(
    UserRole.mentor,
    '🧑‍⚕️',
    'Mentor',
    "Share your story. Shape someone's future.",
  ),
];

class _RoleSelectionScreenState extends ConsumerState<RoleSelectionScreen> {
  UserRole? _selected;
  bool _loading = false;
  String _error = '';

  Future<void> _continue() async {
    final selected = _selected;
    if (selected == null || _loading) return;
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final current = ref.read(authControllerProvider).user;
      if (current != null && current.role != selected) {
        final updated = await ref.read(usersApiProvider).updateRole(selected);
        ref
            .read(authControllerProvider.notifier)
            .setUser(current.copyWith(role: updated.role));

        // The access token still carries the pre-update role claim — every
        // role-gated route (e.g. POST /verification, MENTOR-only) would 403
        // until a fresh token is issued, so refresh immediately rather than
        // waiting for the interceptor's on-401 refresh (a role mismatch is a
        // 403, which that interceptor doesn't handle).
        final auth = ref.read(authControllerProvider);
        final refreshToken = auth.refreshToken;
        if (refreshToken != null && refreshToken.isNotEmpty) {
          final refreshed =
              await ref.read(authApiProvider).refreshTokens(refreshToken);
          ref
              .read(authControllerProvider.notifier)
              .setTokens(refreshed.accessToken, refreshed.refreshToken);
        }
      }
      if (!mounted) return;
      // Both roles pick their public display name first (ProfileSetupScreen)
      // before their role-specific wizard — same screen, same anonymity
      // messaging, for both. ProfileSetupScreen._finish() routes onward to
      // '/aspirant-onboarding' or '/mentor-onboarding' based on the saved role.
      context.go('/profile-setup');
    } catch (_) {
      setState(() => _error = 'Failed to save your role. Please try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(title: const Text('Your Role')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.xl, AppSpacing.xl, AppSpacing.xl, AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Who are you?',
                style: TextStyle(
                  fontSize: AppFont.xxl,
                  fontWeight: AppFont.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              const Text(
                'This helps us show you the right content. You can update this later.',
                style: TextStyle(
                  fontSize: AppFont.md,
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              Expanded(
                child: ListView.separated(
                  itemCount: _roles.length,
                  separatorBuilder: (_, __) =>
                      const SizedBox(height: AppSpacing.md),
                  itemBuilder: (_, i) {
                    final role = _roles[i];
                    final selected = _selected == role.role;
                    return _RoleCard(
                      option: role,
                      selected: selected,
                      onTap: _loading
                          ? null
                          : () => setState(() {
                                _selected = role.role;
                                _error = '';
                              }),
                    );
                  },
                ),
              ),
              if (_error.isNotEmpty) ...[
                Center(
                  child: Text(_error,
                      style: const TextStyle(
                          fontSize: AppFont.sm, color: AppColors.error)),
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
              PrimaryButton(
                label: 'Continue',
                enabled: _selected != null,
                loading: _loading,
                onPressed: _continue,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  const _RoleCard({
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final _RoleOption option;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: selected ? AppColors.primaryLight : AppColors.surface,
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.border,
            width: 1.5,
          ),
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              alignment: Alignment.center,
              child: Text(option.icon, style: const TextStyle(fontSize: 22)),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    option.title,
                    style: TextStyle(
                      fontSize: AppFont.md,
                      fontWeight: AppFont.semibold,
                      color: selected
                          ? AppColors.primaryDark
                          : AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    option.description,
                    style: const TextStyle(
                      fontSize: AppFont.sm,
                      color: AppColors.textSecondary,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: selected ? AppColors.primary : AppColors.border,
                  width: 2,
                ),
              ),
              alignment: Alignment.center,
              child: selected
                  ? Container(
                      width: 10,
                      height: 10,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.primary,
                      ),
                    )
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}
