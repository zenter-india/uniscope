import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';

/// Port of RN `admin/AdminDashboardScreen.tsx`.
class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  static const _stats = <(String, String, bool)>[
    ('Pending Verifications', '24', true),
    ('Open Reports', '7', true),
    ('Total Users', '1,240', false),
    ('Universities', '312', false),
  ];

  static const _actions = <(String, String, String, int?)>[
    ('🛡️', 'Verification Queue', '/admin/verification-queue', 24),
    ('⚠️', 'Moderation Queue', '/admin/moderation-queue', 7),
    ('👥', 'User Management', '/admin/users', null),
    ('🏥', 'Universities', '/admin/universities', null),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Admin Dashboard',
                            style: TextStyle(
                              fontSize: AppFont.xxl,
                              fontWeight: AppFont.bold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          SizedBox(height: AppSpacing.xs),
                          Text(
                            'Uniscope Operations',
                            style: TextStyle(
                              fontSize: AppFont.md,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'Log out',
                      onPressed: () =>
                          ref.read(authControllerProvider.notifier).logout(),
                      icon: const Icon(Icons.logout, color: AppColors.error),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                child: Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    for (final (label, value, urgent) in _stats)
                      SizedBox(
                        width: (MediaQuery.of(context).size.width -
                                AppSpacing.md * 2 -
                                AppSpacing.sm) /
                            2,
                        child: _StatCard(
                            label: label, value: value, urgent: urgent),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Container(
                decoration: const BoxDecoration(
                  color: AppColors.surface,
                  border: Border(
                    top: BorderSide(color: AppColors.border),
                    bottom: BorderSide(color: AppColors.border),
                  ),
                ),
                child: Column(
                  children: [
                    for (final (icon, label, route, badge) in _actions)
                      _ActionRow(
                        icon: icon,
                        label: label,
                        badge: badge,
                        onTap: () => context.go(route),
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

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.urgent,
  });

  final String label;
  final String value;
  final bool urgent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: urgent ? const Color(0xFFFFFBEB) : AppColors.surface,
        border: Border.all(
            color: urgent ? AppColors.warning : AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: AppFont.xxl,
              fontWeight: AppFont.bold,
              color: urgent ? AppColors.warning : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(label,
              style: const TextStyle(
                  fontSize: AppFont.sm, color: AppColors.textSecondary)),
        ],
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.label,
    required this.badge,
    required this.onTap,
  });

  final String icon;
  final String label;
  final int? badge;
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
              width: 28,
              child: Text(icon,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 20)),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(label,
                  style: const TextStyle(
                      fontSize: AppFont.md,
                      color: AppColors.textPrimary,
                      fontWeight: AppFont.medium)),
            ),
            if (badge != null)
              Container(
                constraints: const BoxConstraints(minWidth: 22),
                height: 22,
                padding: const EdgeInsets.symmetric(horizontal: 4),
                decoration: const BoxDecoration(
                  color: AppColors.error,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text('$badge',
                    style: const TextStyle(
                        color: AppColors.textInverse,
                        fontSize: AppFont.xs,
                        fontWeight: AppFont.bold)),
              ),
            const SizedBox(width: AppSpacing.md),
            const Text('›',
                style: TextStyle(fontSize: 20, color: AppColors.textMuted)),
          ],
        ),
      ),
    );
  }
}
