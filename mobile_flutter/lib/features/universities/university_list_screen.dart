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
// 'All' plus every state the onboarding state picker offers, so Discover can
// narrow to any state — not just the aspirant's own (see the quick "my
// state" toggle pill below for that shortcut).
const _stateFilters = ['All', ...kIndianStates];

// The Degree and Specialization pills cascade the same way the web
// enrollment forms do (see web/components/AspirantForm.tsx):
//
//  Stream ─▶ Degree options are `degreesForStream(stream)`
//  Degree ─▶ Specialization options come from GET /universities/curated for
//           that stream+degree (real per-college data), or, for Medical's
//           degrees with no curated dataset, the flat kMedicalSpecializations
//           list. A stream+degree with neither (e.g. Engineering + Doctorate)
//           hides the Specialization pill rather than offering a dead filter.
//
// Degree also narrows the college list itself: the flat `browse=true`
// catalogue only knows a college's `stream`/`state`/`levels`, so a
// postgrad degree like MD/MS or B.Tech is expressed by intersecting with
// the curated college-id set for that stream+degree.

/// Specialization options for a stream+degree, given the curated colleges
/// already loaded for it (empty/absent while still loading, or when the
/// combination has no curated dataset — the caller falls back to
/// [kMedicalSpecializations] for Medical, or hides the pill).
List<String> _specializationOptionsFor(List<CuratedCollege> curated) {
  final values = <String>{for (final c in curated) ...c.specializations}.toList()
    ..sort();
  return ['All', ...values];
}

/// A stream's icon + colour + light tint — the "duotone thumbnail" look on
/// a college card, and the tint a filter pill takes on once that stream is
/// picked. One hue per stream, tuned to sit together rather than clash.
class _StreamVisual {
  const _StreamVisual(this.icon, this.color, this.tint);
  final IconData icon;
  final Color color;
  final Color tint;
}

const _defaultStreamVisual = _StreamVisual(
  Icons.account_balance_rounded,
  AppColors.primary,
  AppColors.primaryLight,
);

const _streamVisuals = <String, _StreamVisual>{
  'Medical': _StreamVisual(
    Icons.medical_services_rounded,
    Color(0xFF0B8F6A),
    Color(0xFFE3F4EE),
  ),
  'Dental': _StreamVisual(
    Icons.health_and_safety_rounded,
    Color(0xFF7A63D4),
    Color(0xFFECE8FA),
  ),
  'Engineering': _StreamVisual(
    Icons.engineering_rounded,
    Color(0xFFE08A2B),
    Color(0xFFFBEEDB),
  ),
  'Commerce & Business': _StreamVisual(
    Icons.business_center_rounded,
    Color(0xFF3C79D4),
    Color(0xFFE5EEFB),
  ),
  'Law': _StreamVisual(
    Icons.gavel_rounded,
    Color(0xFFD8566F),
    Color(0xFFFBE6EB),
  ),
  'Arts & Humanities': _StreamVisual(
    Icons.palette_rounded,
    Color(0xFF12A5A0),
    Color(0xFFDFF3F2),
  ),
  'Design': _StreamVisual(
    Icons.brush_rounded,
    Color(0xFF5B5FC7),
    Color(0xFFE7E8FB),
  ),
  'Others': _StreamVisual(
    Icons.account_balance_rounded,
    Color(0xFF59636E),
    Color(0xFFEEF1F0),
  ),
};

_StreamVisual _visualFor(String? stream) =>
    _streamVisuals[stream] ?? _defaultStreamVisual;

/// Whether the college list is currently narrowed to the aspirant's own
/// state. Lives outside the screen so Home's `Colleges in <state>` card can
/// switch it on before navigating to the Discover tab. The chip stays
/// visible while it's active, so this never silently filters the list.
///
/// State — not GPS distance — is the right lens here: most government
/// seats are state-quota and tied to domicile, so a college 40km away
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
  // 'All', or a degree from `degreesForStream(effectiveStream)`. Reset to
  // 'All' whenever the effective stream changes (see _syncCascade), since a
  // degree name is only meaningful within its stream.
  String _degreeFilter = 'All';
  // 'All', or a specialization from the current stream+degree's option list.
  // Reset to 'All' whenever the stream or degree changes.
  String _specializationFilter = 'All';
  // The effective stream the Degree/Specialization filters were last aligned
  // to — lets _syncCascade notice a stream change (whether from the pill or
  // from the profile-derived default) and clear the now-stale child filters.
  String? _cascadeStream;
  // null until the aspirant explicitly picks a stream from the sheet —
  // until then, the pill defaults to the profile's own stream (whatever
  // was chosen during onboarding), same deferred-until-touched pattern as
  // _explicitStateFilter below. 'All' is itself a valid explicit choice
  // (clears back to unfiltered), so this can't just be a plain String.
  String? _explicitStreamFilter;
  // null until the aspirant explicitly picks a state from the sheet —
  // until then, the pill defers to the ambient collegeStateFilterProvider
  // toggle (Home's "Colleges in <state>" quick action) so the two controls
  // stay merged into one pill instead of fighting each other.
  String? _explicitStateFilter;

  /// Bottom sheet used by the State/Stream/Degree/Specialization pills —
  /// single-select, closes itself on tap. Height-capped and internally
  /// scrollable so a long list (all 37 states, a stream's full
  /// specialization catalogue) is fully reachable instead of overflowing
  /// off the bottom of the sheet. [searchable] adds a filter box for the
  /// long lists.
  Future<void> _pickOption({
    required String title,
    required List<String> options,
    required String selected,
    required ValueChanged<String> onSelected,
    bool searchable = false,
  }) {
    return showModalBottomSheet(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) {
        var query = '';
        return StatefulBuilder(
          builder: (sheetContext, setSheetState) {
            final visible = query.isEmpty
                ? options
                : options
                      .where(
                        (o) => o.toLowerCase().contains(query.toLowerCase()),
                      )
                      .toList();
            return SafeArea(
              child: Padding(
                padding: EdgeInsets.only(
                  bottom: MediaQuery.of(sheetContext).viewInsets.bottom,
                ),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: MediaQuery.of(sheetContext).size.height * 0.75,
                  ),
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
                      if (searchable)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.lg,
                            0,
                            AppSpacing.lg,
                            AppSpacing.sm,
                          ),
                          child: TextField(
                            decoration: const InputDecoration(
                              isDense: true,
                              prefixIcon: Icon(Icons.search_rounded, size: 20),
                              hintText: 'Search…',
                            ),
                            onChanged: (t) => setSheetState(() => query = t),
                          ),
                        ),
                      Flexible(
                        child: visible.isEmpty
                            ? const Padding(
                                padding: EdgeInsets.all(AppSpacing.lg),
                                child: Text(
                                  'No matches',
                                  style: TextStyle(color: AppColors.textMuted),
                                ),
                              )
                            : ListView.builder(
                                shrinkWrap: true,
                                itemCount: visible.length,
                                itemBuilder: (_, i) => ListTile(
                                  title: Text(visible[i]),
                                  trailing: visible[i] == selected
                                      ? const Icon(
                                          Icons.check_rounded,
                                          color: AppColors.primary,
                                        )
                                      : null,
                                  onTap: () {
                                    onSelected(visible[i]);
                                    Navigator.of(sheetContext).pop();
                                  },
                                ),
                              ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  /// Clears the Degree/Specialization filters when the effective stream has
  /// changed out from under them (whether via the Stream pill or the
  /// profile-derived default resolving late). Called from build() — a
  /// post-frame setState keeps it out of the current build pass.
  void _syncCascade(String effectiveStream) {
    if (_cascadeStream == effectiveStream) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() {
        _cascadeStream = effectiveStream;
        _degreeFilter = 'All';
        _specializationFilter = 'All';
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final universitiesAsync = ref.watch(universitiesListProvider);
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
    _syncCascade(effectiveStream);

    final streamPicked = effectiveStream != 'All';
    final degreeOptions = streamPicked
        ? ['All', ...degreesForStream(effectiveStream)]
        : const ['All'];
    // Keep the pill honest if a stale value survived a race with _syncCascade.
    final degreeFilter = degreeOptions.contains(_degreeFilter)
        ? _degreeFilter
        : 'All';

    // The curated dataset backing the Degree/Specialization filters for the
    // current stream+degree, if that combination has one (see
    // curatedDegreeKey). Loaded lazily and cached per stream+degree.
    final curatedKey = curatedDegreeKey(effectiveStream, degreeFilter);
    final curatedAsync = curatedKey == null
        ? null
        : ref.watch(
            curatedCollegesProvider((
              stream: effectiveStream,
              degree: curatedKey,
            )),
          );
    final curatedColleges = curatedAsync?.asData?.value ?? const <CuratedCollege>[];
    // college id → its curated specializations, for the specialization filter.
    final curatedById = {for (final c in curatedColleges) c.id: c};

    // Specialization options: real per-college data when curated, else the
    // flat medical list. Medical's MBBS (undergrad) has no curated key and
    // no specialization concept (matches web "Hide Specialization for
    // MBBS") — options stays just ['All'] and the pill hides.
    final List<String> specializationOptions;
    if (curatedKey != null) {
      specializationOptions = _specializationOptionsFor(curatedColleges);
    } else if (effectiveStream == 'Medical' &&
        degreeFilter != 'All' &&
        degreeFilter != 'MBBS') {
      specializationOptions = ['All', ...kMedicalSpecializations];
    } else {
      specializationOptions = const ['All'];
    }
    final specializationFilter = specializationOptions.contains(
          _specializationFilter,
        )
        ? _specializationFilter
        : 'All';
    final showSpecializationPill =
        streamPicked && degreeFilter != 'All' && specializationOptions.length > 1;
    final curatedLoading = curatedAsync?.isLoading ?? false;

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
                        searchable: true,
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
                      activeColor: _visualFor(effectiveStream).color,
                      activeTint: _visualFor(effectiveStream).tint,
                      trailing: Icons.keyboard_arrow_down_rounded,
                      onTap: () => _pickOption(
                        title: 'Stream',
                        options: _streamFilters,
                        selected: effectiveStream,
                        onSelected: (v) => setState(() {
                          _explicitStreamFilter = v;
                          // Child filters are stream-scoped — drop them now
                          // rather than waiting for _syncCascade's next frame.
                          _cascadeStream = v;
                          _degreeFilter = 'All';
                          _specializationFilter = 'All';
                        }),
                      ),
                    ),
                  ),
                  // Degree options cascade from the picked stream, matching
                  // the web enrollment forms (degreesForStream) — no stream,
                  // no Degree pill.
                  if (streamPicked)
                    Padding(
                      padding: const EdgeInsets.only(right: AppSpacing.sm),
                      child: _FilterPill(
                        icon: Icons.school_rounded,
                        label: degreeFilter == 'All' ? 'Degree' : degreeFilter,
                        active: degreeFilter != 'All',
                        trailing: Icons.keyboard_arrow_down_rounded,
                        onTap: () => _pickOption(
                          title: 'Degree',
                          options: degreeOptions,
                          selected: degreeFilter,
                          onSelected: (v) => setState(() {
                            _degreeFilter = v;
                            _specializationFilter = 'All';
                          }),
                        ),
                      ),
                    ),
                  // Specialization cascades from the picked degree — options
                  // come from that stream+degree's curated per-college data
                  // (or Medical's flat list). Hidden when the combination
                  // has no specialization data to offer.
                  if (showSpecializationPill)
                    Padding(
                      padding: const EdgeInsets.only(right: AppSpacing.sm),
                      child: _FilterPill(
                        icon: Icons.workspace_premium_rounded,
                        label: specializationFilter == 'All'
                            ? 'Specialization'
                            : specializationFilter,
                        active: specializationFilter != 'All',
                        trailing: Icons.keyboard_arrow_down_rounded,
                        onTap: () => _pickOption(
                          title: 'Specialization',
                          options: specializationOptions,
                          searchable: true,
                          selected: specializationFilter,
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
                    // A curated Degree filter narrows the list to the
                    // colleges that dataset returns — but only once it's
                    // loaded, so we don't briefly show a wrong (unfiltered)
                    // list. Show skeletons while that request is in flight.
                    if (curatedLoading &&
                        (degreeFilter != 'All' ||
                            specializationFilter != 'All')) {
                      return ListView(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        children: const [
                          SkeletonCard(),
                          SkeletonCard(),
                          SkeletonCard(),
                        ],
                      );
                    }
                    final curatedIds = curatedById.keys.toSet();

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

                      final bool matchesDegree;
                      if (degreeFilter == 'All') {
                        matchesDegree = true;
                      } else if (curatedKey != null) {
                        matchesDegree = curatedIds.contains(u.id);
                      } else if (effectiveStream == 'Medical' &&
                          degreeFilter == 'MBBS') {
                        // The degree label is "MBBS" but University.levels
                        // still tags undergrad colleges "UG".
                        matchesDegree = u.levels.contains('UG');
                      } else {
                        // Non-curated non-Medical degree (Doctorate/Others,
                        // generic UG/PG) — the flat catalogue can't tell
                        // these apart, so stream+state is as far as we
                        // narrow. Better than hiding every college.
                        matchesDegree = true;
                      }

                      final bool matchesSpecialization;
                      if (specializationFilter == 'All') {
                        matchesSpecialization = true;
                      } else if (curatedKey != null) {
                        matchesSpecialization =
                            curatedById[u.id]?.specializations.contains(
                              specializationFilter,
                            ) ??
                            false;
                      } else if (effectiveStream == 'Medical') {
                        matchesSpecialization = u.specializations.contains(
                          specializationFilter,
                        );
                      } else {
                        matchesSpecialization = true;
                      }

                      return matchesQuery &&
                          matchesStream &&
                          matchesState &&
                          matchesDegree &&
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

                    return Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.md,
                            AppSpacing.xs,
                            AppSpacing.md,
                            AppSpacing.sm,
                          ),
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: Text.rich(
                              TextSpan(
                                style: const TextStyle(
                                  fontSize: AppFont.xs,
                                  color: AppColors.textSecondary,
                                ),
                                children: [
                                  TextSpan(
                                    text: '${filtered.length}',
                                    style: const TextStyle(
                                      fontWeight: AppFont.bold,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                  TextSpan(
                                    text: filtered.length == 1
                                        ? ' college found'
                                        : ' colleges found',
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: ListView.builder(
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
                          ),
                        ),
                      ],
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
    final visual = _visualFor(university.stream);

    return AppCard(
      onTap: onTap,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Stream-tinted "thumbnail" — a colour + icon per stream
              // (see _StreamVisual) instead of one generic grey building
              // icon, so a scanned list reads by field at a glance.
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: visual.tint,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                alignment: Alignment.center,
                child: Icon(visual.icon, size: 20, color: visual.color),
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
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        if (university.stream != null) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 1,
                            ),
                            decoration: BoxDecoration(
                              color: visual.tint,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              university.stream!.toUpperCase(),
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: AppFont.extraBold,
                                letterSpacing: 0.3,
                                color: visual.color,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          const Text(
                            '·',
                            style: TextStyle(color: AppColors.textMuted),
                          ),
                          const SizedBox(width: 6),
                        ],
                        Flexible(
                          child: Text(
                            university.state,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: AppFont.xs,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              _CollegeSaveButton(universityId: university.id),
            ],
          ),
          // The review summary (average rating + breakdown) only appears
          // once real reviews exist — mentor-authored today. No "no reviews
          // yet" placeholder, and no divider eating space when there's
          // nothing to show.
          if (university.reviewCount > 0) ...[
            const SizedBox(height: AppSpacing.md),
            const Divider(height: 1, color: AppColors.border),
            const SizedBox(height: AppSpacing.sm),
            // Its own tap target, nested inside the card's own
            // (detail-screen) tap target — tapping the review summary goes
            // straight to the full breakdown instead of the college's
            // Overview tab.
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
/// (the state pill) or a sheet trigger (Stream / Degree / Specialization,
/// `trailing` set to a chevron). Active state uses the same filled-primary
/// look either way,
/// so a glance at the bar tells you what's currently narrowing the list.
class _FilterPill extends StatelessWidget {
  const _FilterPill({
    this.icon,
    required this.label,
    required this.active,
    required this.onTap,
    this.trailing,
    this.activeColor = AppColors.primary,
    this.activeTint = AppColors.primaryLight,
  });

  final IconData? icon;
  final String label;
  final bool active;
  final VoidCallback onTap;
  final IconData? trailing;

  /// Colour the pill takes on once it's active — defaults to brand green,
  /// overridden by the Stream pill with that stream's own colour (see
  /// [_visualFor]) so picking "Engineering" tints the pill amber, etc.
  final Color activeColor;
  final Color activeTint;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? activeTint : AppColors.surface,
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
              color: active ? activeTint : AppColors.border,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(
                  icon,
                  size: 14,
                  color: active ? activeColor : AppColors.primary,
                ),
                const SizedBox(width: 4),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: AppFont.sm,
                  fontWeight: AppFont.semibold,
                  color: active ? activeColor : AppColors.textSecondary,
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: 2),
                Icon(
                  trailing,
                  size: 16,
                  color: active ? activeColor : AppColors.textMuted,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
