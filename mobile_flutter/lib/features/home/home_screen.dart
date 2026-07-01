import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';

/// Port of RN `home/HomeScreen.tsx`.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  static const _quickActions = <(String, String, String)>[
    ('Colleges', 'assets/icons/hospital-alt.png', '/colleges'),
    ('Mentors', 'assets/icons/man.png', '/mentors'),
    ('Chats', 'assets/icons/chat.png', '/chats'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Good evening',
                      style: TextStyle(
                        fontSize: AppFont.xl,
                        fontWeight: AppFont.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    SizedBox(height: AppSpacing.xs),
                    Text(
                      'What are you looking for today?',
                      style: TextStyle(
                        fontSize: AppFont.sm,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                child: Row(
                  children: [
                    for (var i = 0; i < _quickActions.length; i++) ...[
                      if (i > 0) const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: _QuickCard(
                          label: _quickActions[i].$1,
                          icon: _quickActions[i].$2,
                          onTap: () => context.go(_quickActions[i].$3),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              _Section(
                title: 'Top Colleges',
                onSeeAll: () => context.go('/colleges'),
                cards: const [
                  _InfoCard(
                    label: 'AIIMS New Delhi',
                    sub: 'Government · Rank #1 · 107 seats',
                  ),
                  _InfoCard(
                    label: 'CMC Vellore',
                    sub: 'Private · Rank #2 · 100 seats',
                  ),
                  _InfoCard(
                    label: 'JIPMER Puducherry',
                    sub: 'Government · Rank #3 · 150 seats',
                  ),
                ],
              ),
              _Section(
                title: 'Top Mentors',
                onSeeAll: () => context.go('/mentors'),
                cards: const [
                  _InfoCard(
                    label: 'MBBS Final Year · AIIMS Delhi',
                    sub: '₹8/min · 4.8 ★ · 512 sessions',
                  ),
                  _InfoCard(
                    label: 'MD Radiology · CMC Vellore',
                    sub: '₹12/min · 4.7 ★ · 203 sessions',
                  ),
                ],
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
  });

  final String label;
  final String icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            Image.asset(icon,
                width: 24,
                height: 24,
                color: AppColors.primary,
                colorBlendMode: BlendMode.srcIn),
            const SizedBox(height: AppSpacing.xs),
            Text(
              label,
              style: const TextStyle(
                fontSize: AppFont.xs,
                fontWeight: AppFont.medium,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.onSeeAll,
    required this.cards,
  });

  final String title;
  final VoidCallback onSeeAll;
  final List<Widget> cards;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, 0, AppSpacing.md, AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: AppFont.lg,
                  fontWeight: AppFont.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              GestureDetector(
                onTap: onSeeAll,
                child: const Text(
                  'See all',
                  style: TextStyle(
                    fontSize: AppFont.sm,
                    color: AppColors.primary,
                    fontWeight: AppFont.medium,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          ...cards,
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.label, required this.sub});

  final String label;
  final String sub;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: AppFont.md,
              fontWeight: AppFont.medium,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            sub,
            style: const TextStyle(
              fontSize: AppFont.sm,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
