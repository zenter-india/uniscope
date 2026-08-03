import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _deleting = false;

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => const _DeleteAccountDialog(),
    );
    if (confirmed != true) return;

    setState(() => _deleting = true);
    try {
      await ref.read(usersApiProvider).deleteMe();
      if (!mounted) return;
      // Explicit confirmation that the deletion actually happened — until
      // this was added, the only visible effect was an ordinary-looking
      // logout, indistinguishable from tapping "Log Out".
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Account deleted'),
          content: const Text(
            'Your account has been deactivated and you\'re now signed out. '
            'Log back in anytime with the same phone number to restore it.',
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('OK'),
            ),
          ],
        ),
      );
      ref.read(authControllerProvider.notifier).logout();
      if (!mounted) return;
      context.go('/welcome');
    } catch (_) {
      if (!mounted) return;
      setState(() => _deleting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not delete your account. Try again.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppCard(
              padding: EdgeInsets.zero,
              child: _SettingsRow(
                icon: Icons.block_outlined,
                label: 'Blocked Users',
                onTap: () => context.push('/profile/blocked-users'),
                isLast: true,
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            const Text(
              'Danger zone',
              style: TextStyle(
                fontSize: AppFont.sm,
                fontWeight: AppFont.bold,
                color: AppColors.textMuted,
                letterSpacing: 0.6,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            AppCard(
              padding: EdgeInsets.zero,
              child: _SettingsRow(
                icon: Icons.delete_outline_rounded,
                label: _deleting ? 'Deleting…' : 'Delete Account',
                iconColor: AppColors.error,
                labelColor: AppColors.error,
                onTap: _deleting ? null : _confirmDelete,
                isLast: true,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Requires typing DELETE before the delete action enables — an extra,
/// deliberate friction step beyond the usual Cancel/Confirm dialog, given
/// how consequential this action is (immediate sign-out, account
/// deactivated). Also tells the user the account can be brought back within
/// 60 days by simply logging in again — see UsersService
/// .findOrCreateByPhoneHash / ACCOUNT_REACTIVATION_WINDOW_DAYS, which
/// reactivates a deletedAt account on its next successful OTP verify but
/// refuses to past that window.
class _DeleteAccountDialog extends StatefulWidget {
  const _DeleteAccountDialog();

  @override
  State<_DeleteAccountDialog> createState() => _DeleteAccountDialogState();
}

class _DeleteAccountDialogState extends State<_DeleteAccountDialog> {
  final _controller = TextEditingController();
  bool _canConfirm = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      final matches = _controller.text.trim() == 'DELETE';
      if (matches != _canConfirm) setState(() => _canConfirm = matches);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Delete your account?'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'By clicking Delete, your account will no longer be visible to '
            'any aspirants and you\'ll be logged out immediately.',
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'You can reactivate by logging in with your mobile number within '
            '60 days. If not, your account will be permanently deleted.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: AppFont.sm),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Type DELETE to confirm',
            style: const TextStyle(fontWeight: AppFont.bold, fontSize: AppFont.sm),
          ),
          const SizedBox(height: AppSpacing.xs),
          TextField(
            controller: _controller,
            autocorrect: false,
            decoration: const InputDecoration(hintText: 'DELETE'),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _canConfirm ? () => Navigator.of(context).pop(true) : null,
          style: FilledButton.styleFrom(backgroundColor: AppColors.error),
          child: const Text('Delete account'),
        ),
      ],
    );
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    required this.icon,
    required this.label,
    required this.onTap,
    this.isLast = false,
    this.iconColor = AppColors.primary,
    this.labelColor = AppColors.textPrimary,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool isLast;
  final Color iconColor;
  final Color labelColor;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 14),
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
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 17, color: iconColor),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: AppFont.md,
                  fontWeight: AppFont.medium,
                  color: labelColor,
                ),
              ),
            ),
            const Icon(Icons.chevron_right_rounded, size: 22, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}
