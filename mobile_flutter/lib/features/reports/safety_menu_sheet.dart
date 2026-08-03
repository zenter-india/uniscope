import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/blocks_api.dart';
import '../../core/network/reports_api.dart';
import '../../core/theme/app_theme.dart';
import 'report_sheet.dart';

/// "Report" / "Block" action sheet for a user — opened from the mentor
/// detail screen and the session chat screen. Blocking prevents either
/// party from starting a new session with the other going forward (see
/// SessionsService.create); it doesn't touch history already in Stream Chat.
Future<void> showSafetyMenuSheet(
  BuildContext context,
  WidgetRef ref, {
  required String userId,
  required String userLabel,
}) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
    ),
    builder: (sheetContext) => _SafetyMenuContent(userId: userId, userLabel: userLabel),
  );
}

class _SafetyMenuContent extends ConsumerWidget {
  const _SafetyMenuContent({required this.userId, required this.userLabel});

  final String userId;
  final String userLabel;

  Future<void> _confirmBlock(BuildContext context, WidgetRef ref, bool isBlocked) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(isBlocked ? 'Unblock $userLabel?' : 'Block $userLabel?'),
        content: Text(
          isBlocked
              ? 'You\'ll be able to start new chats or calls with them again.'
              : 'They won\'t be able to start a new chat or call with you, and you won\'t be able to start one with them. Existing conversations stay as they are.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: isBlocked
                ? null
                : FilledButton.styleFrom(backgroundColor: AppColors.error),
            child: Text(isBlocked ? 'Unblock' : 'Block'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    final notifier = ref.read(blockedUserIdsProvider.notifier);
    if (isBlocked) {
      await notifier.unblock(userId);
    } else {
      await notifier.block(userId);
    }

    if (!context.mounted) return;
    Navigator.of(context).pop();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(isBlocked ? 'Unblocked $userLabel' : 'Blocked $userLabel')),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final blockedIds = ref.watch(blockedUserIdsProvider).value ?? const <String>{};
    final isBlocked = blockedIds.contains(userId);

    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.flag_outlined, color: AppColors.textSecondary),
            title: const Text('Report'),
            onTap: () {
              Navigator.of(context).pop();
              showReportSheet(
                context,
                ref,
                targetType: ReportTargetType.user,
                targetId: userId,
                targetLabel: userLabel,
              );
            },
          ),
          ListTile(
            leading: Icon(
              isBlocked ? Icons.block_flipped : Icons.block_outlined,
              color: AppColors.error,
            ),
            title: Text(
              isBlocked ? 'Unblock $userLabel' : 'Block $userLabel',
              style: const TextStyle(color: AppColors.error),
            ),
            onTap: () => _confirmBlock(context, ref, isBlocked),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
      ),
    );
  }
}
