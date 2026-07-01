import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// Port of RN `verification/VerificationScreen.tsx`.
class VerificationScreen extends StatelessWidget {
  const VerificationScreen({super.key});

  static const _steps = <(int, String)>[
    (1, 'Select document type'),
    (2, 'Upload your document'),
    (3, 'Admin review (up to 48h)'),
    (4, 'Get your verified badge'),
  ];

  static const _unlocks = <String>[
    '✅ Answer questions from prospective students',
    '✅ Write university reviews',
    '✅ Accept chat requests from students',
    '✅ Verified badge on your profile',
  ];

  static const _docs = <String>[
    '🪪 College ID card (current students)',
    '🖥️ Student portal screenshot',
    '🎓 Degree certificate (alumni)',
    '📋 NMC / MCI registration',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Get Verified')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.all(AppSpacing.lg),
              child: Column(
                children: [
                  Text('🛡️', style: TextStyle(fontSize: 48)),
                  SizedBox(height: AppSpacing.sm),
                  Text(
                    'Verify your identity',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: AppFont.xxl,
                      fontWeight: AppFont.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  SizedBox(height: AppSpacing.sm),
                  Text(
                    'Verification is confidential. Your real identity is never shown publicly — only your role and university.',
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
            const SizedBox(height: AppSpacing.md),
            _Card(
              title: 'What you unlock after verification',
              children: [
                for (final item in _unlocks)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.md),
                    child: Text(item,
                        style: const TextStyle(
                            fontSize: AppFont.md,
                            color: AppColors.textPrimary,
                            height: 1.5)),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            _Card(
              title: 'How it works',
              children: [
                for (final (step, title) in _steps)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.md),
                    child: Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: AppColors.primaryLight,
                            shape: BoxShape.circle,
                            border:
                                Border.all(color: AppColors.primary, width: 2),
                          ),
                          alignment: Alignment.center,
                          child: Text('$step',
                              style: const TextStyle(
                                  fontSize: AppFont.sm,
                                  fontWeight: AppFont.bold,
                                  color: AppColors.primary)),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Text(title,
                              style: const TextStyle(
                                  fontSize: AppFont.md,
                                  color: AppColors.textPrimary)),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            _Card(
              title: 'Accepted documents',
              children: [
                for (final doc in _docs)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.sm),
                    child: Text(doc,
                        style: const TextStyle(
                            fontSize: AppFont.md,
                            color: AppColors.textPrimary,
                            height: 1.6)),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
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
                      'Documents are stored securely and reviewed only by verified Uniscope admins. They are never shared publicly or with third parties.',
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
            const SizedBox(height: AppSpacing.md),
            GestureDetector(
              onTap: () {},
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                alignment: Alignment.center,
                child: const Text(
                  'Start Verification',
                  style: TextStyle(
                    color: AppColors.textInverse,
                    fontWeight: AppFont.semibold,
                    fontSize: AppFont.md,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  fontSize: AppFont.md,
                  fontWeight: AppFont.bold,
                  color: AppColors.textPrimary)),
          ...children,
        ],
      ),
    );
  }
}
