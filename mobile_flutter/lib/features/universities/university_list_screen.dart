import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/college_wishlist_api.dart';
import '../../core/network/universities_api.dart';
import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';
import '../profile/profile_options.dart';

const _typeFilters = ['All', 'GOVERNMENT', 'PRIVATE', 'DEEMED', 'CENTRAL'];
// 'All' plus the same academic-field picklist mentors/aspirants use, so
// Discover can narrow a mixed-stream list down to e.g. "just Engineering".
const _streamFilters = ['All', ...kStreamOptions];

/// Whether the college list is currently narrowed to the aspirant's own
/// state. Lives outside the screen so Home's `Colleges in <state>` card can
/// switch it on before navigating to the Discover tab. The chip stays
/// visible while it's active, so this never silently filters the list.
///
/// State — not GPS distance — is the right lens here: 85% of government
/// MBBS seats are state-quota and tied to domicile, so a college 40km away
/// across a state border is far less relevant than one 400km away in-state.
class CollegeStateFilterNotifier extends Notifier<bool> {
  @override
  bool build() => false;

  void set(bool value) => state = value;
}

final collegeStateFilterProvider =
    NotifierProvider<CollegeStateFilterNotifier, bool>(
  CollegeStateFilterNotifier.new,
);

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
  String _streamFilter = 'All';

  /// Bottom sheet used by both the Type and Stream pills — single-select
  /// list of the given options, closes itself on tap.
  Future<void> _pickOption({
    required String title,
    required List<String> options,
    required String Function(String) optionLabel,
    required String selected,
    required ValueChanged<String> onSelected,
  }) {
    return showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.sm),
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: AppFont.lg,
                  fontWeight: AppFont.bold,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            for (final option in options)
              ListTile(
                title: Text(optionLabel(option)),
                trailing: option == selected
                    ? const Icon(Icons.check_rounded, color: AppColors.primary)
                    : null,
                onTap: () {
                  onSelected(option);
                  Navigator.of(sheetContext).pop();
                },
              ),
            const SizedBox(height: AppSpacing.sm),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final universitiesAsync = ref.watch(universitiesListProvider);
    final myState = ref.watch(myProfileProvider).asData?.value.state;
    final stateOnly = ref.watch(collegeStateFilterProvider);

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
                  // Only offered once we actually know the aspirant's
                  // state — otherwise the chip would be a dead control.
                  if (myState != null && myState.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(right: AppSpacing.sm),
                      child: _FilterPill(
                        icon: Icons.place_rounded,
                        label: myState,
                        active: stateOnly,
                        onTap: () => ref
                            .read(collegeStateFilterProvider.notifier)
                            .set(!stateOnly),
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.only(right: AppSpacing.sm),
                    child: _FilterPill(
                      label: _typeFilter == 'All'
                          ? 'Type'
                          : _typeLabel(_typeFilter),
                      active: _typeFilter != 'All',
                      trailing: Icons.keyboard_arrow_down_rounded,
                      onTap: () => _pickOption(
                        title: 'College type',
                        options: _typeFilters,
                        optionLabel: _typeLabel,
                        selected: _typeFilter,
                        onSelected: (v) => setState(() => _typeFilter = v),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(right: AppSpacing.sm),
                    child: _FilterPill(
                      label: _streamFilter == 'All' ? 'Stream' : _streamFilter,
                      active: _streamFilter != 'All',
                      trailing: Icons.keyboard_arrow_down_rounded,
                      onTap: () => _pickOption(
                        title: 'Stream / field',
                        options: _streamFilters,
                        optionLabel: (v) => v,
                        selected: _streamFilter,
                        onSelected: (v) => setState(() => _streamFilter = v),
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
                      final matchesStream = _streamFilter == 'All' ||
                          u.stream == _streamFilter;
                      final matchesState = !stateOnly ||
                          myState == null ||
                          u.state.toLowerCase() == myState.toLowerCase();
                      return matchesQuery &&
                          matchesType &&
                          matchesStream &&
                          matchesState;
                    }).toList();

                    if (filtered.isEmpty) {
                      return ListView(
                        children: [
                          const SizedBox(height: 80),
                          EmptyState(
                            icon: Icons.school_rounded,
                            title: 'No colleges found',
                            message: stateOnly && myState != null
                                ? 'No colleges listed in $myState yet. Turn off the $myState filter to see all colleges.'
                                : 'Try a different search or filter.',
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
                    if (university.stream != null) university.stream!,
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

/// One filter control in the Discover top bar — either a plain toggle
/// (the state pill) or a sheet trigger (Type/Stream, `trailing` set to a
/// chevron). Active state uses the same filled-primary look either way,
/// so a glance at the bar tells you what's currently narrowing the list.
class _FilterPill extends StatelessWidget {
  const _FilterPill({
    this.icon,
    required this.label,
    required this.active,
    required this.onTap,
    this.trailing,
  });

  final IconData? icon;
  final String label;
  final bool active;
  final VoidCallback onTap;
  final IconData? trailing;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? AppColors.primary : AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadius.full),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.full),
        child: Container(
          padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm, vertical: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.full),
            border: Border.all(
              color: active ? AppColors.primary : AppColors.border,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon,
                    size: 14,
                    color:
                        active ? AppColors.textInverse : AppColors.primary),
                const SizedBox(width: 4),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: AppFont.sm,
                  fontWeight: AppFont.semibold,
                  color: active ? AppColors.textInverse : AppColors.textSecondary,
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: 2),
                Icon(trailing,
                    size: 16,
                    color: active
                        ? AppColors.textInverse
                        : AppColors.textMuted),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
