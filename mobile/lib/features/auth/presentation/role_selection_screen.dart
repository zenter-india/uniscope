import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../profile/data/users_api.dart';
import '../application/auth_controller.dart';
import '../domain/auth_user.dart';

/// New-user role pick (ported from RN `RoleSelectionScreen`).
/// Wired to `PATCH /users/me/role`. Sign-up roles only (not MENTOR/ADMIN).
class RoleSelectionScreen extends ConsumerStatefulWidget {
  const RoleSelectionScreen({super.key});

  @override
  ConsumerState<RoleSelectionScreen> createState() =>
      _RoleSelectionScreenState();
}

class _RoleSelectionScreenState extends ConsumerState<RoleSelectionScreen> {
  static const _options = <(UserRole, String, String)>[
    (
      UserRole.prospectiveStudent,
      'Prospective student',
      'Exploring universities and mentors.',
    ),
    (
      UserRole.currentStudent,
      'Current student',
      'Studying at a medical university.',
    ),
    (UserRole.alumni, 'Alumni', 'Graduated from a medical university.'),
  ];

  UserRole? _selected;
  bool _loading = false;
  String? _error;

  Future<void> _continue() async {
    final role = _selected;
    if (role == null) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final updated = await ref.read(usersApiProvider).updateRole(role);
      await ref.read(authControllerProvider.notifier).updateUser(updated);
      if (!mounted) return;
      context.push(Routes.profileSetup);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Choose your role')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final (role, title, subtitle) in _options) ...[
                _RoleCard(
                  title: title,
                  subtitle: subtitle,
                  selected: _selected == role,
                  onTap: () => setState(() => _selected = role),
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
              if (_error != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              const Spacer(),
              ElevatedButton(
                onPressed: (_selected == null || _loading) ? null : _continue,
                child: _loading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Continue'),
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
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: selected ? AppColors.primaryLight : AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.border,
            width: selected ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: AppFontSize.md,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              subtitle,
              style: const TextStyle(color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
