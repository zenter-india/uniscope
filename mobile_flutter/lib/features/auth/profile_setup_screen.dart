import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/primary_button.dart';

/// Port of RN `auth/ProfileSetupScreen.tsx`.
class ProfileSetupScreen extends ConsumerStatefulWidget {
  const ProfileSetupScreen({super.key});

  @override
  ConsumerState<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends ConsumerState<ProfileSetupScreen> {
  final _controller = TextEditingController();
  String _displayName = '';
  bool _loading = false;
  String _error = '';

  bool get _isValid => _displayName.trim().length >= 2;

  @override
  void initState() {
    super.initState();
    final name = ref.read(authControllerProvider).user?.displayName ?? '';
    _controller.text = name;
    _displayName = name;
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    if (!_isValid || _loading) return;
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final updated = await ref
          .read(usersApiProvider)
          .updateProfile(displayName: _displayName.trim());
      final auth = ref.read(authControllerProvider);
      if (auth.accessToken != null && auth.refreshToken != null) {
        ref.read(authControllerProvider.notifier).setAuth(
              auth.accessToken!,
              auth.refreshToken!,
              updated.toAuthUser(),
            );
      }
      if (!mounted) return;
      if (updated.role == UserRole.aspirant) {
        context.go('/aspirant-onboarding');
      } else {
        context.go('/mentor-onboarding');
      }
    } catch (_) {
      setState(() {
        _error = 'Failed to save profile. Please try again.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(title: const Text('Profile')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.xl, AppSpacing.xl, AppSpacing.xl, AppSpacing.xxl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Set up your profile',
                style: TextStyle(
                  fontSize: AppFont.xxl,
                  fontWeight: AppFont.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              const Text(
                'This is your display name — it keeps you anonymous. '
                'We never show your real name to anyone.',
                style: TextStyle(
                  fontSize: AppFont.md,
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              const Text(
                'Display name *',
                style: TextStyle(
                  fontSize: AppFont.sm,
                  fontWeight: AppFont.semibold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              TextField(
                controller: _controller,
                autofocus: true,
                enabled: !_loading,
                maxLength: 60,
                onChanged: (t) => setState(() {
                  _displayName = t;
                  if (_error.isNotEmpty) _error = '';
                }),
                style: const TextStyle(
                    fontSize: AppFont.md, color: AppColors.textPrimary),
                decoration: InputDecoration(
                  counterText: '',
                  filled: true,
                  fillColor: AppColors.background,
                  hintText: 'e.g. MedStudent_Chennai',
                  hintStyle: const TextStyle(color: AppColors.textMuted),
                  contentPadding: const EdgeInsets.all(AppSpacing.md),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    borderSide: BorderSide(
                      color: _error.isNotEmpty
                          ? AppColors.error
                          : AppColors.border,
                      width: 1.5,
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    borderSide: BorderSide(
                      color: _error.isNotEmpty
                          ? AppColors.error
                          : AppColors.primary,
                      width: 1.5,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              const Text(
                'This is your public pseudonym — not your real name.',
                style: TextStyle(fontSize: AppFont.xs, color: AppColors.textMuted),
              ),
              if (_error.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                Center(
                  child: Text(_error,
                      style: const TextStyle(
                          fontSize: AppFont.sm, color: AppColors.error)),
                ),
              ],
              const SizedBox(height: AppSpacing.xl),
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('🔒', style: TextStyle(fontSize: 16)),
                    SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        'Your real identity is never shared publicly.',
                        style: TextStyle(
                          fontSize: AppFont.sm,
                          color: AppColors.primaryDark,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              PrimaryButton(
                // "Finish Setup" was misleading here — for aspirants (the
                // only role that actually reaches this screen; mentors go
                // straight to their own wizard from RoleSelectionScreen)
                // this is step 0 of 5, with the mandatory profile wizard
                // and the avatar step still ahead. "Finish" belongs on the
                // wizard's actual last step (see AspirantOnboardingScreen).
                label: 'Continue',
                enabled: _isValid,
                loading: _loading,
                onPressed: _finish,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
