import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/mentors_api.dart';
import '../../core/theme/app_theme.dart';
import '../mentors/mentor_list_screen.dart' show MentorCard;

/// Shown after an aspirant cancels a call request — rather than just
/// dropping them back on an empty list, offer a couple of other mentors
/// they could try instead. Cheap retention win, and matches how the
/// AstroTalk reference flow handles "Leave waitlist?".
Future<void> showCancelDeflectionSheet(
  BuildContext context,
  WidgetRef ref, {
  required String excludeMentorId,
}) async {
  if (!context.mounted) return;
  await showModalBottomSheet<void>(
    context: context,
    backgroundColor: AppColors.surface,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
    ),
    builder: (_) => _CancelDeflectionSheet(excludeMentorId: excludeMentorId),
  );
}

class _CancelDeflectionSheet extends ConsumerWidget {
  const _CancelDeflectionSheet({required this.excludeMentorId});
  final String excludeMentorId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Request cancelled',
              style: TextStyle(
                fontSize: AppFont.lg,
                fontWeight: AppFont.extraBold,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Try another mentor instead?',
              style: TextStyle(
                fontSize: AppFont.sm,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            FutureBuilder<List<Mentor>>(
              future: ref.read(mentorsApiProvider).list(),
              builder: (context, snapshot) {
                if (!snapshot.hasData) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
                    child: Center(
                      child: CircularProgressIndicator(
                        color: AppColors.primary,
                      ),
                    ),
                  );
                }
                final alternatives =
                    snapshot.data!
                        .where((m) => m.id != excludeMentorId)
                        .toList()
                      ..sort((a, b) {
                        if (a.isAvailable == b.isAvailable) return 0;
                        return a.isAvailable ? -1 : 1;
                      });
                final shown = alternatives.take(3).toList();
                if (shown.isEmpty) return const SizedBox.shrink();
                return Column(
                  children: [
                    for (final mentor in shown) MentorCard(mentor: mentor),
                  ],
                );
              },
            ),
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Not now'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
