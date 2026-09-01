import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/college_wishlist_api.dart';
import '../../core/network/universities_api.dart';
import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';
import '../profile/profile_options.dart';
import 'review_summary_card.dart';

// 'All' plus the same academic-field picklist mentors/aspirants use, so
// Discover can narrow a mixed-stream list down to e.g. "just Engineering".
const _streamFilters = ['All', ...kStreamOptions];
// Every college today is UG-only (see University.levels doc comment) —
// selecting 'PG' correctly returns zero results rather than showing
// anything invented, until real PG data is imported.
const _levelFilters = ['All', 'UG', 'PG'];
// 'All' plus every state the onboarding state picker offers, so Discover can
// narrow to any state — not just the aspirant's own (see the quick "my
// state" toggle pill below for that shortcut).
const _stateFilters = ['All', ...kIndianStates];
// Unlike the other three pills, this one's options come from the loaded
// colleges themselves (see _specializationOptions below), not a fixed
// picklist — real specialization strings carry their accrediting degree as
// a prefix ("MD - Anaesthesiology" vs "DNB- Anaesthesiology" vs "DNB-
// General Medicine"), which the mentor wizard's plain kMedicalSpecializations
// list ("Anaesthesiology") doesn't match at all. Building the options from
// the real data guarantees every option actually filters something, at the
// cost of a longer, less tidy list. Only meaningful for Medical (see
// University.specializations doc comment — every other stream's colleges
// have none), so the pill only appears when the Stream filter is Medical.
List<String> _specializationOptions(List<University> universities) {
  final values = <String>{
    for (final u in universities)
      if (u.stream == 'Medical') ...u.specializations,
  }.toList()..sort();
  return ['All', ...values];
}

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

class UniversityListScreen extends ConsumerStatefulWidget {
  const UniversityListScreen({super.key});

  @override
  ConsumerState<UniversityListScreen> createState() =>
      _UniversityListScreenState();
}

class _UniversityListScreenState extends ConsumerState<UniversityListScreen> {
  String _query = '';
  String _levelFilter = 'All';
  // null until the aspirant explicitly picks a stream from the sheet —
  // until then, the pill defaults to the profile's own stream (whatever
  // was chosen during onboarding), same deferred-until-touched pattern as
  // _explicitStateFilter below. 'All' is itself a valid explicit choice
  // (clears back to unfiltered), so this can't just be a plain String.
  String? _explicitStreamFilter;
  String _specializationFilter = 'All';
  // null until the aspirant explicitly picks a state from the sheet —
  // until then, the pill defers to the ambient collegeStateFilterProvider
  // toggle (Home's "Colleges in <state>" quick action) so the two controls
  // stay merged into one pill instead of fighting each other.
  String? _explicitStateFilter;

  /// Bottom sheet used by the Stream/Degree/State pills — single-select
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
                AppSpacing.lg,
                0,
                AppSpacing.lg,
                AppSpacing.sm,
              ),
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
    final specializationOptions = _specializationOptions(
      universitiesAsync.asData?.value ?? const [],
    );
    final myProfile = ref.watch(myProfileProvider).asData?.value;
    final myState = myProfile?.state;
    final stateOnly = ref.watch(collegeStateFilterProvider);
    // Explicit sheet pick wins; otherwise fall back to the ambient "my
    // state" toggle (only meaningful once the profile's state is known).
    final explicit = _explicitStateFilter;
    final effectiveState = explicit != null
        ? (explicit == 'All' ? null : explicit)
        : (stateOnly && myState != null && myState.isNotEmpty ? myState : null);

    // Same deferred-default pattern as state: nothing explicitly picked yet
    // defaults to the stream chosen at signup, as long as it's one of the
    // picklist values this filter actually understands — an older/free-text
    // stream value falls back to unfiltered rather than silently matching
    // nothing.
    final myStream = myProfile?.stream;
    final effectiveStream =
        _explicitStreamFilter ??
        (myStream != null && kStreamOptions.contains(myStream)
            ? myStream
            : 'All');

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
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
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
                  Padding(
                    padding: const EdgeInsets.only(right: AppSpacing.sm),
                    child: _FilterPill(
                      icon: Icons.place_rounded,
                      label: effectiveState ?? 'State',
                      active: effectiveState != null,
                      trailing: Icons.keyboard_arrow_down_rounded,
                      onTap: () => _pickOption(
                        title: 'State',
                        options: _stateFilters,
                        optionLabel: (v) => v,
                        selected: effectiveState ?? 'All',
                        onSelected: (v) {
                          // Picking anything here always wins from now on —
                          // clear the ambient toggle so it can't silently
                          // fight the explicit choice on the next rebuild.
                          ref
                              .read(collegeStateFilterProvider.notifier)
                              .set(false);
                          setState(
                            () => _explicitStateFilter = v == 'All' ? 'All' : v,
                          );
                        },
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(right: AppSpacing.sm),
                    child: _FilterPill(
                      icon: Icons.menu_book_rounded,
                      label: effectiveStream == 'All'
                          ? 'Stream'
                          : effectiveStream,
                      active: effectiveStream != 'All',
                      trailing: Icons.keyboard_arrow_down_rounded,
                      onTap: () => _pickOption(
                        title: 'Stream',
                        options: _streamFilters,
                        optionLabel: (v) => v,
                        selected: effectiveStream,
                        onSelected: (v) =>
                            setState(() => _explicitStreamFilter = v),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(right: AppSpacing.sm),
                    child: _FilterPill(
                      icon: Icons.school_rounded,
                      label: _levelFilter == 'All' ? 'Degree' : _levelFilter,
                      active: _levelFilter != 'All',
                      trailing: Icons.keyboard_arrow_down_rounded,
                      onTap: () => _pickOption(
                        title: 'Degree',
                        options: _levelFilters,
                        optionLabel: (v) => v,
                        selected: _levelFilter,
                        onSelected: (v) => setState(() => _levelFilter = v),
                      ),
                    ),
                  ),
                  // Only Medical colleges have any specialization data (see
                  // University.specializations doc comment) — showing this
                  // pill for every stream would offer a picker that always
                  // returns zero results outside Medical.
                  if (effectiveStream == 'Medical')
                    Padding(
                      padding: const EdgeInsets.only(right: AppSpacing.sm),
                      child: _FilterPill(
                        icon: Icons.local_hospital_rounded,
                        label: _specializationFilter == 'All'
                            ? 'Specialization'
                            : _specializationFilter,
                        active: _specializationFilter != 'All',
                        trailing: Icons.keyboard_arrow_down_rounded,
                        onTap: () => _pickOption(
                          title: 'Specialization',
                          options: specializationOptions,
                          optionLabel: (v) => v,
                          selected: _specializationFilter,
                          onSelected: (v) =>
                              setState(() => _specializationFilter = v),
                        ),
                      ),
                    ),
                  const SizedBox(width: AppSpacing.md),
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
                    children: const [
                      SkeletonCard(),
                      SkeletonCard(),
                      SkeletonCard(),
                    ],
                  ),
                  error: (err, _) => ListView(
                    children: [
                      EmptyState(
                        icon: Icons.wifi_off_rounded,
                        title: 'Could not load colleges',
                        message: 'Check your connection and pull to refresh.',
                        actionLabel: 'Retry',
                        onAction: () =>
                            ref.invalidate(universitiesListProvider),
                      ),
                    ],
                  ),
                  data: (universities) {
                    final filtered = universities.where((u) {
                      final matchesQuery = u.name.toLowerCase().contains(
                        _query.toLowerCase(),
                      );
                      final matchesStream =
                          effectiveStream == 'All' ||
                          u.stream == effectiveStream;
                      final matchesState =
                          effectiveState == null ||
                          u.state.toLowerCase() == effectiveState.toLowerCase();
                      final matchesLevel =
                          _levelFilter == 'All' ||
                          u.levels.contains(_levelFilter);
                      final matchesSpecialization =
                          effectiveStream != 'Medical' ||
                          _specializationFilter == 'All' ||
                          u.specializations.contains(_specializationFilter);
                      return matchesQuery &&
                          matchesStream &&
                          matchesState &&
                          matchesLevel &&
                          matchesSpecialization;
                    }).toList();

                    if (filtered.isEmpty) {
                      return ListView(
                        children: [
                          const SizedBox(height: 80),
                          EmptyState(
                            icon: Icons.school_rounded,
                            title: 'No colleges found',
                            message: effectiveState != null
                                ? 'No colleges listed in $effectiveState yet. Clear the state filter to see all colleges.'
                                : 'Try a different search or filter.',
                          ),
                        ],
                      );
                    }

                    return ListView.builder(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.md,
                        0,
                        AppSpacing.md,
                        AppSpacing.xl,
                      ),
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
  const UniversityCard({
    super.key,
    required this.university,
    required this.onTap,
  });

  final University university;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AppCard(
      onTap: onTap,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                alignment: Alignment.center,
                child: Icon(
                  Icons.account_balance_rounded,
                  size: 20,
                  color: AppColors.textMuted.withValues(alpha: 0.6),
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
                        if (university.mbbsSeats != null)
                          '${university.mbbsSeats} seats',
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
              _CollegeSaveButton(universityId: university.id),
            ],
          ),
          // A college with no reviews yet has nothing to show here — most
          // viewers can't write one either (see ReviewSummaryBody), so an
          // empty "No reviews yet" row on every unreviewed card in a list
          // this long is just noise. It still appears once real reviews
          // exist.
          if (university.reviewCount > 0) ...[
            const SizedBox(height: AppSpacing.md),
            const Divider(height: 1, color: AppColors.border),
            const SizedBox(height: AppSpacing.md),
            // Its own tap target, nested inside the card's own (detail-screen)
            // tap target — tapping the review summary goes straight to the
            // full breakdown instead of the college's Overview tab.
            Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(AppRadius.md),
                onTap: () => context.push(
                  '/colleges/detail/reviews',
                  extra: {
                    'universityId': university.id,
                    'universityName': university.name,
                  },
                ),
                child: ReviewSummaryBody(
                  universityId: university.id,
                  fallbackRating: university.rating,
                  fallbackReviewCount: university.reviewCount,
                ),
              ),
            ),
          ],
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
            horizontal: AppSpacing.sm,
            vertical: 6,
          ),
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
                Icon(
                  icon,
                  size: 14,
                  color: active ? AppColors.textInverse : AppColors.primary,
                ),
                const SizedBox(width: 4),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: AppFont.sm,
                  fontWeight: AppFont.semibold,
                  color: active
                      ? AppColors.textInverse
                      : AppColors.textSecondary,
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: 2),
                Icon(
                  trailing,
                  size: 16,
                  color: active ? AppColors.textInverse : AppColors.textMuted,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
