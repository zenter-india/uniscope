import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/mentors_api.dart';
import '../../core/network/sessions_api.dart';
import '../../core/theme/app_theme.dart';

final mentorsListProvider = FutureProvider.autoDispose<List<Mentor>>(
  (ref) => ref.watch(mentorsApiProvider).list(),
);

/// Real mentor discovery screen backed by `GET /mentors`. Tapping a mentor
/// books a CHAT session (`POST /sessions`) — the marketplace booking flow,
/// not the old placeholder screen.
class MentorListScreen extends ConsumerWidget {
  const MentorListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mentorsAsync = ref.watch(mentorsListProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Mentors'),
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () => ref.refresh(mentorsListProvider.future),
          child: mentorsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
            error: (err, _) => ListView(
              children: [
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  child: Text('Failed to load mentors: $err',
                      style: const TextStyle(color: AppColors.error)),
                ),
              ],
            ),
            data: (mentors) => mentors.isEmpty
                ? ListView(
                    children: const [
                      Padding(
                        padding: EdgeInsets.all(AppSpacing.xl),
                        child: Text(
                          'No mentors are currently available.',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      ),
                    ],
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    itemCount: mentors.length,
                    itemBuilder: (_, i) => _MentorCard(mentor: mentors[i]),
                  ),
          ),
        ),
      ),
    );
  }
}

class _MentorCard extends ConsumerWidget {
  const _MentorCard({required this.mentor});
  final Mentor mentor;

  Future<void> _book(BuildContext context, WidgetRef ref) async {
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: AppColors.surface,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Start a chat session with ${mentor.displayName}?',
                style: const TextStyle(fontSize: AppFont.lg, fontWeight: AppFont.bold)),
            const SizedBox(height: AppSpacing.sm),
            Text('₹${mentor.pricePerMinuteRupees.toStringAsFixed(2)} / minute',
                style: const TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
                onPressed: () => Navigator.of(sheetContext).pop(true),
                child: const Text('Request Session'),
              ),
            ),
          ],
        ),
      ),
    );

    if (confirmed != true || !context.mounted) return;

    try {
      await ref.read(sessionsApiProvider).create(mentor.id, SessionKind.chat);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Session requested — check the Sessions tab')),
      );
      context.go('/chats');
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Could not book session: $e')));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: const BoxDecoration(
              color: AppColors.primaryLight,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: const Text('👤', style: TextStyle(fontSize: 22)),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(mentor.displayName,
                    style: const TextStyle(
                        fontSize: AppFont.md, fontWeight: AppFont.semibold)),
                if (mentor.university != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(mentor.university!.name,
                        style: const TextStyle(
                            fontSize: AppFont.sm, color: AppColors.textSecondary)),
                  ),
                if (mentor.specialty != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(mentor.specialty!,
                        style: const TextStyle(
                            fontSize: AppFont.xs, color: AppColors.textMuted)),
                  ),
                const SizedBox(height: AppSpacing.sm),
                Text('₹${mentor.pricePerMinuteRupees.toStringAsFixed(2)}/min',
                    style: const TextStyle(
                        fontSize: AppFont.sm,
                        fontWeight: AppFont.semibold,
                        color: AppColors.primary)),
              ],
            ),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () => _book(context, ref),
            child: const Text('Chat'),
          ),
        ],
      ),
    );
  }
}
