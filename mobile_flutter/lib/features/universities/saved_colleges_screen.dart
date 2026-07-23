import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/college_wishlist_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';
import 'university_list_screen.dart';

class SavedCollegesScreen extends ConsumerWidget {
  const SavedCollegesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final savedAsync = ref.watch(savedCollegesListProvider);
    final savedIds = ref.watch(savedCollegeIdsProvider).value;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Saved Colleges')),
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () => ref.refresh(savedCollegesListProvider.future),
          child: savedAsync.when(
            loading: () => ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: const [SkeletonCard(), SkeletonCard()],
            ),
            error: (err, _) => ListView(
              children: [
                EmptyState(
                  icon: Icons.wifi_off_rounded,
                  title: 'Could not load saved colleges',
                  message: 'Check your connection and pull to refresh.',
                  actionLabel: 'Retry',
                  onAction: () => ref.invalidate(savedCollegesListProvider),
                ),
              ],
            ),
            data: (fetched) {
              // Filter by the live saved-id set so unsaving (heart tap)
              // removes a card immediately, without waiting on a refetch.
              final universities = savedIds == null
                  ? fetched
                  : fetched.where((u) => savedIds.contains(u.id)).toList();

              return universities.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        EmptyState(
                          icon: Icons.favorite_border_rounded,
                          title: 'No saved colleges yet',
                          message:
                              'Tap the heart on a college to save it for later.',
                        ),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      itemCount: universities.length,
                      itemBuilder: (_, i) => UniversityCard(
                        university: universities[i],
                        onTap: () => context.push(
                          '/colleges/detail',
                          extra: {
                            'universitySlug': universities[i].slug,
                            'universityName': universities[i].name,
                          },
                        ),
                      ),
                    );
            },
          ),
        ),
      ),
    );
  }
}
