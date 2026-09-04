import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/wallet_api.dart';
import '../../core/theme/app_theme.dart';

/// Shown instead of the call-slot picker when the aspirant's balance can't
/// cover even the shortest (6-min) call slot. Chat itself is always free —
/// this only ever gates the call-request action, never chatting itself.
Future<void> showLowBalanceSheet(
  BuildContext context, {
  required int balanceUniminutes,
}) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
    ),
    builder: (sheetContext) => Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, AppSpacing.xl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: const BoxDecoration(
              color: AppColors.warning,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: const Icon(Icons.account_balance_wallet_rounded,
                color: Colors.white, size: 28),
          ),
          const SizedBox(height: AppSpacing.md),
          const Text(
            'Not enough Uniminutes',
            style: TextStyle(
              fontSize: AppFont.lg,
              fontWeight: AppFont.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'You have ${uniminutesLabel(balanceUniminutes)}. The shortest call slot needs 6 — recharge to book one.',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: AppFont.sm, color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () {
                Navigator.of(sheetContext).pop();
                context.go('/wallet');
              },
              child: const Text('Recharge Uniminutes'),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          TextButton(
            onPressed: () => Navigator.of(sheetContext).pop(),
            child: const Text('Not now', style: TextStyle(color: AppColors.textMuted)),
          ),
        ],
      ),
    ),
  );
}
