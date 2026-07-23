import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/college_wishlist_api.dart';
import '../../core/network/universities_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';

const _typeFilters = ['All', 'GOVERNMENT', 'PRIVATE', 'DEEMED', 'CENTRAL'];

String _typeLabel(String type) {
  switch (type) {
    case 'GOVERNMENT':
      return 'Government';
    case 'PRIVATE':
      return 'Private';
    case 'DEEMED':
      return 'Deemed';
    case 'CENTRAL':
      return 'Central';
    default:
      return type;
  }
}

class UniversityListScreen extends ConsumerStatefulWidget {
  const UniversityListScreen({super.key});

  @override
  ConsumerState<UniversityListScreen> createState() => _UniversityListScreenState();
}

class _UniversityListScreenState extends ConsumerState<UniversityListScreen> {
  String _query = '';
  String _typeFilter = 'All';

  @override
  Widget build(BuildContext context) {
    final universitiesAsync = ref.watch(universitiesListProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Colleges'),
        actions: [
          IconButton(
            onPressed: () => context.push('/colleges/saved'),
            icon: const Icon(Icons.favorite_rounded, color: AppColors.error),
            tooltip: 'Saved colleges',
          ),
        ],
      ),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md, vertical: AppSpacing.sm),
              child: TextField(
                onChanged: (t) => setState(() => _query = t),
                decoration: const InputDecoration(
                  isDense: true,
                  prefixIcon: Icon(Icons.search_rounded, size: 20),
                  hintText: 'Search universities...',
                ),
              ),
            ),
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                children: [
                  for (final f in _typeFilters)
                    Padding(
                      padding: const EdgeInsets.only(right: AppSpacing.sm),
                      child: ChoiceChip(
                        label: Text(_typeLabel(f)),
                        selected: _typeFilter == f,
                        onSelected: (_) => setState(() => _typeFilter = f),
                        selectedColor: AppColors.primary,
                        labelStyle: TextStyle(
                          fontSize: AppFont.sm,
                          fontWeight: AppFont.semibold,
                          color: _typeFilter == f
                              ? AppColors.textInverse
                              : AppColors.textSecondary,
                        ),
                        backgroundColor: AppColors.surface,
                        side: BorderSide(
                          color: _typeFilter == f
                              ? AppColors.primary
                              : AppColors.border,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Expanded(
              child: RefreshIndicator(
                color: AppColors.primary,
                onRefresh: () => ref.refresh(universitiesListProvider.future),
                child: universitiesAsync.when(
                  loading: () => ListView(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    children: const [SkeletonCard(), SkeletonCard(), SkeletonCard()],
                  ),
                  error: (err, _) => ListView(
                    children: [
                      EmptyState(
                        icon: Icons.wifi_off_rounded,
                        title: 'Could not load colleges',
                        message: 'Check your connection and pull to refresh.',
                        actionLabel: 'Retry',
                        onAction: () => ref.invalidate(universitiesListProvider),
                      ),
                    ],
                  ),
                  data: (universities) {
                    final filtered = universities.where((u) {
                      final matchesQuery =
                          u.name.toLowerCase().contains(_query.toLowerCase());
                      final matchesType =
                          _typeFilter == 'All' || u.type == _typeFilter;
                      return matchesQuery && matchesType;
                    }).toList();

                    if (filtered.isEmpty) {
                      return ListView(
                        children: const [
                          SizedBox(height: 80),
                          EmptyState(
                            icon: Icons.school_rounded,
                            title: 'No colleges found',
                            message: 'Try a different search or filter.',
                          ),
                        ],
                      );
                    }

                    return ListView.builder(
                      padding: const EdgeInsets.fromLTRB(
                          AppSpacing.md, 0, AppSpacing.md, AppSpacing.xl),
                      itemCount: filtered.length,
                      itemBuilder: (_, i) => UniversityCard(
                        university: filtered[i],
                        onTap: () => context.push(
                          '/colleges/detail',
                          extra: {
                            'universitySlug': filtered[i].slug,
                            'universityName': filtered[i].name,
                          },
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class UniversityCard extends ConsumerWidget {
  const UniversityCard({super.key, required this.university, required this.onTap});

  final University university;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isGov = university.type == 'GOVERNMENT' || university.type == 'CENTRAL';
    return AppCard(
      onTap: onTap,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primaryLight,
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            alignment: Alignment.center,
            child: Text(
              university.nirfRank != null ? '#${university.nirfRank}' : '—',
              style: const TextStyle(
                fontSize: AppFont.sm,
                fontWeight: AppFont.extraBold,
                color: AppColors.primary,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  university.name,
                  style: const TextStyle(
                    fontSize: AppFont.md,
                    fontWeight: AppFont.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    university.state,
                    if (university.mbbsSeats != null) '${university.mbbsSeats} seats',
                  ].join(' · '),
                  style: const TextStyle(
                    fontSize: AppFont.xs,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          StatusChip(
            label: _typeLabel(university.type),
            color: isGov ? AppColors.primary : AppColors.info,
          ),
          _CollegeSaveButton(universityId: university.id),
        ],
      ),
    );
  }
}

class _CollegeSaveButton extends ConsumerWidget {
  const _CollegeSaveButton({required this.universityId});
  final String universityId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final savedIdsAsync = ref.watch(savedCollegeIdsProvider);
    final isSaved = savedIdsAsync.value?.contains(universityId) ?? false;

    return IconButton(
      onPressed: () =>
          ref.read(savedCollegeIdsProvider.notifier).toggle(universityId),
      icon: Icon(
        isSaved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
        color: isSaved ? AppColors.error : AppColors.textMuted,
      ),
      visualDensity: VisualDensity.compact,
    );
  }
}
