import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';
import 'mentor_list_screen.dart' show startChatWithMentor;

/// Generic conversation starters — deliberately not mentor-specific (no
/// backend concept of per-mentor suggested questions exists), just enough
/// to unblock someone staring at a blank message box.
const _sampleQuestions = [
  'What made you choose this college?',
  'What do you wish you knew before joining?',
  'What\'s campus life really like day-to-day?',
  'How did you prepare for admissions?',
];

/// Shows the "Ready to chat?" confirmation before actually creating a
/// session — matches the Figma flow, which never lets a chat start with
/// zero intent behind it. Confirming calls the same [startChatWithMentor]
/// used everywhere else, so session-creation/recovery logic isn't duplicated.
Future<void> showPreChatConfirmSheet(
  BuildContext context,
  WidgetRef ref, {
  required String mentorId,
  required String mentorName,
  String? mentorAvatarUrl,
}) async {
  final result = await showModalBottomSheet<_PreChatResult>(
    context: context,
    backgroundColor: AppColors.surface,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
    ),
    builder: (_) => _PreChatConfirmSheet(
      mentorName: mentorName,
      mentorAvatarUrl: mentorAvatarUrl,
    ),
  );

  if (result == null || !context.mounted) return;
  await startChatWithMentor(context, ref, mentorId, draft: result.draft);
}

/// How the sheet was dismissed — [draft] is a tapped sample question (or
/// null for the plain "Start Chat" button).
class _PreChatResult {
  const _PreChatResult({this.draft});
  final String? draft;
}

class _PreChatConfirmSheet extends StatelessWidget {
  const _PreChatConfirmSheet({required this.mentorName, this.mentorAvatarUrl});
  final String mentorName;
  final String? mentorAvatarUrl;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.sm,
        AppSpacing.lg,
        MediaQuery.of(context).viewInsets.bottom + AppSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 36,
            height: 4,
            margin: const EdgeInsets.only(bottom: AppSpacing.lg),
            decoration: BoxDecoration(
              color: AppColors.border,
              borderRadius: BorderRadius.circular(AppRadius.full),
            ),
          ),
          AppAvatar(name: mentorName, size: 56, avatarUrl: mentorAvatarUrl),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Ready for $mentorName?',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: AppFont.lg,
              fontWeight: AppFont.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          const Text(
            'Ask anything about their college, courses, or journey so far. '
            'Tap a question to start with it typed for you.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: AppFont.sm, color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.lg),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Need ideas? Try asking:',
              style: TextStyle(
                fontSize: AppFont.sm,
                fontWeight: AppFont.semibold,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final q in _sampleQuestions)
                InkWell(
                  onTap: () =>
                      Navigator.of(context).pop(_PreChatResult(draft: q)),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: Text(
                      q,
                      style: const TextStyle(
                          fontSize: AppFont.xs, color: AppColors.primaryDark),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () =>
                  Navigator.of(context).pop(const _PreChatResult()),
              child: const Text('Start Chat'),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Maybe later',
                style: TextStyle(color: AppColors.textMuted)),
          ),
        ],
      ),
    );
  }
}
