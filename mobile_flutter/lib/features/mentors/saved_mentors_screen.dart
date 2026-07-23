import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/wishlist_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';
import 'mentor_list_screen.dart';

class SavedMentorsScreen extends ConsumerWidget {
  const SavedMentorsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final savedAsync = ref.watch(savedMentorsListProvider);
    final savedIds = ref.watch(savedMentorIdsProvider).value;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Saved Mentors')),
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () => ref.refresh(savedMentorsListProvider.future),
          child: savedAsync.when(
            loading: () => ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: const [SkeletonCard(), SkeletonCard()],
            ),
            error: (err, _) => ListView(
              children: [
                EmptyState(
                  icon: Icons.wifi_off_rounded,
                  title: 'Could not load saved mentors',
                  message: 'Check your connection and pull to refresh.',
                  actionLabel: 'Retry',
                  onAction: () => ref.invalidate(savedMentorsListProvider),
                ),
              ],
            ),
            data: (fetched) {
              // Filter by the live saved-id set so unsaving (heart tap)
              // removes a card immediately, without waiting on a refetch.
              final mentors = savedIds == null
                  ? fetched
                  : fetched.where((m) => savedIds.contains(m.id)).toList();

              return mentors.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        EmptyState(
                          icon: Icons.favorite_border_rounded,
                          title: 'No saved mentors yet',
                          message:
                              'Tap the heart on a mentor to save them for later.',
                        ),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      itemCount: mentors.length,
                      itemBuilder: (_, i) => MentorCard(mentor: mentors[i]),
                    );
            },
          ),
        ),
      ),
    );
  }
}
