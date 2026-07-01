import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../widgets/primary_button.dart';

/// Port of RN `auth/WelcomeScreen.tsx`.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  static const _features = <(String, String)>[
    ('🎓', 'Verified student & alumni insights'),
    ('🏥', 'Honest university reviews'),
    ('💬', 'Anonymous Q&A'),
    ('🔒', 'Your identity stays private'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: Column(
            children: [
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 80,
                      height: 80,
                      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                      decoration: const BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: const Text(
                        'US',
                        style: TextStyle(
                          color: AppColors.textInverse,
                          fontSize: AppFont.xl,
                          fontWeight: AppFont.bold,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    const Text(
                      'Uniscope',
                      style: TextStyle(
                        fontSize: AppFont.display,
                        fontWeight: AppFont.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    const Text(
                      'Real answers from verified medical students and alumni',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: AppFont.md,
                        color: AppColors.textSecondary,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final (icon, label) in _features)
                    Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 28,
                            child: Text(icon,
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontSize: 20)),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: Text(
                              label,
                              style: const TextStyle(
                                fontSize: AppFont.md,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.xl),
              PrimaryButton(
                label: 'Get Started',
                onPressed: () => context.push('/login'),
              ),
              const SizedBox(height: AppSpacing.md),
              const Padding(
                padding: EdgeInsets.only(bottom: AppSpacing.lg),
                child: Text(
                  'By continuing you agree to our Terms of Service and Privacy Policy.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: AppFont.xs,
                    color: AppColors.textMuted,
                    height: 1.5,
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
