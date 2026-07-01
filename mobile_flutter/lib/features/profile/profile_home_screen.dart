import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';

/// Port of RN `profile/ProfileHomeScreen.tsx`.
class ProfileHomeScreen extends ConsumerWidget {
  const ProfileHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final displayName =
        (user?.displayName.isNotEmpty ?? false) ? user!.displayName : 'MedStudent_Chennai';

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          child: Column(
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.xl),
                decoration: const BoxDecoration(
                  color: AppColors.surface,
                  border: Border(bottom: BorderSide(color: AppColors.border)),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.border, width: 2),
                      ),
                      alignment: Alignment.center,
                      child: const Text('👤', style: TextStyle(fontSize: 32)),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      displayName,
                      style: const TextStyle(
                        fontSize: AppFont.xl,
                        fontWeight: AppFont.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.sm, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            border: Border.all(color: const Color(0xFFF59E0B)),
                            borderRadius: BorderRadius.circular(AppRadius.full),
                          ),
                          child: const Text(
                            'Unverified',
                            style: TextStyle(
                              fontSize: AppFont.xs,
                              color: Color(0xFF92400E),
                              fontWeight: AppFont.medium,
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        const Text(
                          'Prospective Student',
                          style: TextStyle(
                              fontSize: AppFont.sm,
                              color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    GestureDetector(
                      onTap: () => context.go('/profile/verification'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(AppRadius.full),
                        ),
                        child: const Text(
                          'Get Verified →',
                          style: TextStyle(
                            color: AppColors.textInverse,
                            fontWeight: AppFont.semibold,
                            fontSize: AppFont.sm,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                margin: const EdgeInsets.only(top: AppSpacing.sm),
                decoration: const BoxDecoration(
                  color: AppColors.surface,
                  border: Border(
                    top: BorderSide(color: AppColors.border),
                    bottom: BorderSide(color: AppColors.border),
                  ),
                ),
                child: Row(
                  children: const [
                    _Stat(value: '3', label: 'Questions'),
                    _Stat(value: '0', label: 'Answers'),
                    _Stat(value: '0', label: 'Reviews'),
                  ],
                ),
              ),
              Container(
                margin: const EdgeInsets.only(top: AppSpacing.sm),
                decoration: const BoxDecoration(
                  color: AppColors.surface,
                  border: Border(
                    top: BorderSide(color: AppColors.border),
                    bottom: BorderSide(color: AppColors.border),
                  ),
                ),
                child: Column(
                  children: [
                    _MenuRow(
                      icon: '✏️',
                      label: 'Edit Profile',
                      onTap: () => context.go('/profile/edit'),
                    ),
                    _MenuRow(
                      icon: '🛡️',
                      label: 'Verification',
                      onTap: () => context.go('/profile/verification'),
                    ),
                    _MenuRow(
                      icon: '⚙️',
                      label: 'Settings',
                      onTap: () => context.go('/profile/settings'),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: InkWell(
                  onTap: () =>
                      ref.read(authControllerProvider.notifier).logout(),
                  child: Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: Row(
                      children: const [
                        Text('↩', style: TextStyle(fontSize: 18)),
                        SizedBox(width: AppSpacing.md),
                        Text(
                          'Log Out',
                          style: TextStyle(
                            fontSize: AppFont.md,
                            color: AppColors.error,
                            fontWeight: AppFont.medium,
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
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          children: [
            Text(value,
                style: const TextStyle(
                    fontSize: AppFont.xl,
                    fontWeight: AppFont.bold,
                    color: AppColors.textPrimary)),
            const SizedBox(height: AppSpacing.xs),
            Text(label,
                style: const TextStyle(
                    fontSize: AppFont.xs, color: AppColors.textSecondary)),
          ],
        ),
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final String icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.border)),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 24,
              child: Text(icon,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 18)),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(label,
                  style: const TextStyle(
                      fontSize: AppFont.md, color: AppColors.textPrimary)),
            ),
            const Text('›',
                style: TextStyle(fontSize: 20, color: AppColors.textMuted)),
          ],
        ),
      ),
    );
  }
}
