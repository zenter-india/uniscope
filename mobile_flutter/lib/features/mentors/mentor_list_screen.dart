import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/mentors_api.dart';
import '../../core/network/sessions_api.dart';
import '../../core/network/users_api.dart';
import '../../core/network/wishlist_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import '../profile/profile_options.dart';
import '../sessions/session_list_screen.dart' show sessionsListProvider;

/// Server-side discovery filters for the Mentors tab. Keyed as a record so
/// changing any one filter (Stream / Degree / Specialization / Language)
/// naturally produces a fresh cache entry and a fresh `GET /mentors` call —
/// the query narrows server-side instead of downloading every mentor and
/// filtering the list in Flutter.
typedef MentorListFilters = ({
  String? stream,
  String? qualification,
  String? specialization,
  String? language,
});

/// Unfiltered — for callers like the Home tab's "Top Mentors" strip that
/// just want the plain discovery list, no active filters.
const kNoMentorFilters = (
  stream: null,
  qualification: null,
  specialization: null,
  language: null,
);

final mentorsListProvider = FutureProvider.autoDispose
    .family<List<Mentor>, MentorListFilters>(
      (ref, filters) => ref
          .watch(mentorsApiProvider)
          .list(
            stream: filters.stream,
            qualification: filters.qualification,
            specialization: filters.specialization,
            language: filters.language,
          ),
    );

final mentorsByUniversityProvider = FutureProvider.autoDispose
    .family<List<Mentor>, String>(
      (ref, universityId) =>
          ref.watch(mentorsApiProvider).list(universityId: universityId),
    );

/// Statuses a session can be in while still "live" — mirrors the backend's
/// ACTIVE_STATUSES in SessionsService, used to find an already-outstanding
/// chat with a mentor after a 409 on create().
const _activeStatuses = {
  SessionStatus.pending,
  SessionStatus.accepted,
  SessionStatus.ringing,
  SessionStatus.inProgress,
};

/// The two states of the call-availability filter pill. Wording matches the
/// per-card CallAvailabilityChip — never "online/offline".
const _kAvailForCalls = 'Available for calls';
const _kChatOnly = 'Chat only';

/// Minimum-rating filter choices, highest first. The pill stores the label;
/// the leading digit is the numeric floor a mentor's rating must clear.
const _kRatingOptions = ['4★ & up', '3★ & up', '2★ & up', '1★ & up'];

/// Opens a free chat with [mentorId] and navigates into it. Shared by the
/// mentor card and the mentor profile screen. If an active chat with this
/// mentor already exists the backend 409s, and we reuse that session
/// instead of surfacing an error.
Future<void> startChatWithMentor(
  BuildContext context,
  WidgetRef ref,
  String mentorId, {
  String? draft,
}) async {
  final api = ref.read(sessionsApiProvider);
  try {
    Session session;
    try {
      session = await api.create(mentorId, SessionKind.chat);
    } on DioException catch (e) {
      // 409 = "you already have an active session with this mentor" —
      // recoverable by finding that session. Anything else is a real
      // error and must not be masked by a confusing "no element" below.
      if (e.response?.statusCode != 409) rethrow;

      final existing = await api.list();
      final match = existing.where(
        (s) =>
            s.mentorId == mentorId &&
            s.type == 'CHAT' &&
            _activeStatuses.contains(s.status),
      );
      if (match.isEmpty) rethrow;
      session = match.first;
    }
    // The Messages tab's session list lives in a bottom-nav branch that
    // StatefulShellRoute keeps alive in the background (IndexedStack) rather
    // than rebuilding — its FutureProvider.autoDispose never re-fires just
    // from switching tabs, so a chat started here wouldn't appear there
    // without an explicit invalidate.
    ref.invalidate(sessionsListProvider);
    if (!context.mounted) return;
    context.push(
      '/chats/room',
      extra: {
        'sessionId': session.id,
        if (draft != null && draft.trim().isNotEmpty) 'draft': draft,
      },
    );
  } catch (e) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text('Could not start chat: $e')));
  }
}

/// Mentor discovery backed by `GET /mentors`. Tapping a mentor goes straight
/// into a free chat with them — no pricing or slot picker up front. A call
/// can be requested from inside the chat screen instead (see
/// SessionChatScreen's "Request a call" action).
class MentorListScreen extends ConsumerStatefulWidget {
  const MentorListScreen({super.key});

  @override
  ConsumerState<MentorListScreen> createState() => _MentorListScreenState();
}

class _MentorListScreenState extends ConsumerState<MentorListScreen> {
  /// Name search, the rating toggle and the availability filter stay
  /// client-side over whatever page the server already returned: rating is a
  /// joined/computed value (not a raw column) and call availability is a
  /// time-decayed derived flag (isCallAvailable), so filtering either
  /// server-side would mean replicating logic that's deliberately
  /// centralized elsewhere. Stream, Degree, Specialization and Language are
  /// all plain indexed columns — those go to the server (see
  /// [mentorsListProvider]).
  String _query = '';
  final _searchController = TextEditingController();
  String? _stream;
  // Whether the aspirant has explicitly touched the Stream pill (including
  // picking "Any"). Until then, Stream defaults to — and actively filters
  // by — their own profile.stream from onboarding, same deferred-default
  // pattern as the Colleges tab's Stream pill.
  bool _streamTouched = false;
  String? _qualification;
  String? _specialization;
  String? _language;

  /// Call-availability filter: null = show all, [_kAvailForCalls] = only
  /// mentors accepting call bookings, [_kChatOnly] = only mentors who
  /// aren't. Never framed as "online/offline" — this is the mentor's stated
  /// booking intent, not real-time presence (see CallAvailabilityChip).
  String? _availability;

  /// Minimum-rating filter: null = any rating, otherwise one of
  /// [_kRatingOptions] ('4★ & up' … '1★ & up'). The leading digit is the
  /// floor a mentor's rating must reach.
  String? _rating;
  int? get _minRating => _rating == null ? null : int.tryParse(_rating![0]);

  void _setStream(String? value) {
    setState(() {
      _stream = value;
      _streamTouched = true;
      // A degree/specialization from a different stream no longer applies.
      _qualification = null;
      _specialization = null;
    });
  }

  bool _hasActiveFilters(String? effectiveStream) =>
      _query.isNotEmpty ||
      _availability != null ||
      _rating != null ||
      effectiveStream != null ||
      _qualification != null ||
      _specialization != null ||
      _language != null;

  void _clearFilters() {
    setState(() {
      _query = '';
      _stream = null;
      _streamTouched = true; // "touched + null" reads as an explicit "Any".
      _qualification = null;
      _specialization = null;
      _language = null;
      _availability = null;
      _rating = null;
    });
  }

  Future<void> _pickOne({
    required String title,
    required List<String> options,
    required String? selected,
    required ValueChanged<String?> onPick,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(sheetContext).size.height * 0.7,
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
                  ),
                ),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    for (final o in ['Any', ...options])
                      ListTile(
                        title: Text(o),
                        trailing:
                            (o == 'Any' ? selected == null : o == selected)
                            ? const Icon(
                                Icons.check_rounded,
                                color: AppColors.primary,
                              )
                            : null,
                        onTap: () {
                          onPick(o == 'Any' ? null : o);
                          Navigator.of(sheetContext).pop();
                        },
                      ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = _query.trim().toLowerCase();

    // Same deferred-default pattern as the Colleges tab's Stream pill:
    // nothing explicitly picked yet defaults to — and actively filters by
    // — the stream chosen at signup, as long as it's a value this filter
    // understands. Item 2 of the "filter mentors by profile stream" ask.
    final myStream = ref.watch(myProfileProvider).asData?.value.stream;
    final effectiveStream = _streamTouched
        ? _stream
        : (myStream != null && kStreamOptions.contains(myStream)
              ? myStream
              : null);

    // Degree only makes sense once a stream is picked; Specialization only
    // exists (today) for Medical mentors past the base MBBS degree — same
    // rule the mentor onboarding wizard itself uses to decide whether to
    // collect one.
    final degreeOptions = degreesForStream(effectiveStream);
    final showSpecialization =
        effectiveStream == 'Medical' &&
        _qualification != null &&
        _qualification != 'MBBS';

    final filters = (
      stream: effectiveStream,
      qualification: effectiveStream != null ? _qualification : null,
      specialization: showSpecialization ? _specialization : null,
      language: _language,
    );
    final mentorsAsync = ref.watch(mentorsListProvider(filters));
    final hasActiveFilters = _hasActiveFilters(effectiveStream);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Mentors'),
        actions: [
          IconButton(
            onPressed: () => context.push('/mentors/saved'),
            icon: const Icon(Icons.favorite_rounded, color: AppColors.error),
            tooltip: 'Saved mentors',
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
                controller: _searchController,
                onChanged: (t) => setState(() => _query = t),
                textInputAction: TextInputAction.search,
                decoration: const InputDecoration(
                  isDense: true,
                  prefixIcon: Icon(Icons.search_rounded, size: 20),
                  hintText: 'Search mentors by name...',
                ),
              ),
            ),
            SizedBox(
              height: 38,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                children: [
                  _MentorFilterChip(
                    label: _availability ?? 'Availability',
                    active: _availability != null,
                    dropdown: true,
                    onTap: () => _pickOne(
                      title: 'Availability',
                      options: const [_kAvailForCalls, _kChatOnly],
                      selected: _availability,
                      onPick: (v) => setState(() => _availability = v),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  _MentorFilterChip(
                    label: _rating ?? 'Rating',
                    active: _rating != null,
                    dropdown: true,
                    onTap: () => _pickOne(
                      title: 'Minimum rating',
                      options: _kRatingOptions,
                      selected: _rating,
                      onPick: (v) => setState(() => _rating = v),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  _MentorFilterChip(
                    label: effectiveStream ?? 'Stream',
                    active: effectiveStream != null,
                    dropdown: true,
                    onTap: () => _pickOne(
                      title: 'Field of study',
                      options: kStreamOptions,
                      selected: effectiveStream,
                      onPick: _setStream,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  _MentorFilterChip(
                    label: _qualification ?? 'Degree',
                    active: _qualification != null,
                    dropdown: true,
                    onTap: effectiveStream == null
                        ? null
                        : () => _pickOne(
                            title: 'Degree',
                            options: degreeOptions,
                            selected: _qualification,
                            onPick: (v) => setState(() {
                              _qualification = v;
                              _specialization = null;
                            }),
                          ),
                  ),
                  if (showSpecialization) ...[
                    const SizedBox(width: AppSpacing.xs),
                    _MentorFilterChip(
                      label: _specialization ?? 'Specialization',
                      active: _specialization != null,
                      dropdown: true,
                      onTap: () => _pickOne(
                        title: 'Specialization',
                        options: kMedicalSpecializations,
                        selected: _specialization,
                        onPick: (v) => setState(() => _specialization = v),
                      ),
                    ),
                  ],
                  const SizedBox(width: AppSpacing.xs),
                  _MentorFilterChip(
                    label: _language ?? 'Language',
                    active: _language != null,
                    dropdown: true,
                    onTap: () => _pickOne(
                      title: 'Speaks',
                      options: kLanguageOptions,
                      selected: _language,
                      onPick: (v) => setState(() => _language = v),
                    ),
                  ),
                  if (hasActiveFilters) ...[
                    const SizedBox(width: AppSpacing.sm),
                    Center(
                      child: TextButton(
                        onPressed: () {
                          _searchController.clear();
                          _clearFilters();
                        },
                        child: const Text('Clear filters'),
                      ),
                    ),
                  ],
                  const SizedBox(width: AppSpacing.md),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Expanded(
              child: RefreshIndicator(
                color: AppColors.primary,
                onRefresh: () =>
                    ref.refresh(mentorsListProvider(filters).future),
                child: mentorsAsync.when(
                  loading: () => ListView(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    children: const [
                      SkeletonCard(),
                      SkeletonCard(),
                      SkeletonCard(),
                      SkeletonCard(),
                    ],
                  ),
                  error: (err, _) => ListView(
                    children: [
                      EmptyState(
                        icon: Icons.wifi_off_rounded,
                        title: 'Could not load mentors',
                        message: 'Check your connection and pull to refresh.',
                        actionLabel: 'Retry',
                        onAction: () =>
                            ref.invalidate(mentorsListProvider(filters)),
                      ),
                    ],
                  ),
                  data: (mentors) {
                    if (mentors.isEmpty && !hasActiveFilters) {
                      return ListView(
                        children: const [
                          SizedBox(height: 120),
                          EmptyState(
                            icon: Icons.people_alt_rounded,
                            title: 'No mentors yet',
                            message:
                                'Verified mentors will appear here as they join.',
                          ),
                        ],
                      );
                    }
                    // Stream/Degree/Specialization/Language are already
                    // applied server-side (see mentorsListProvider); name
                    // search, the rating toggle and the availability filter
                    // are the only filtering still done here, over whatever
                    // page the server returned — see the field doc comment
                    // above for why those stay client-side.
                    final filtered = mentors.where((m) {
                      if (query.isNotEmpty &&
                          !m.displayName.toLowerCase().contains(query)) {
                        return false;
                      }
                      if (_availability == _kAvailForCalls && !m.isAvailable) {
                        return false;
                      }
                      if (_availability == _kChatOnly && m.isAvailable) {
                        return false;
                      }
                      final minRating = _minRating;
                      if (minRating != null && (m.rating ?? 0) < minRating) {
                        return false;
                      }
                      return true;
                    }).toList();
                    if (filtered.isEmpty) {
                      return ListView(
                        children: [
                          const SizedBox(height: 120),
                          EmptyState(
                            icon: Icons.search_off_rounded,
                            title: 'No mentors found',
                            message: hasActiveFilters
                                ? 'No mentors match these filters — try clearing one.'
                                : 'Try a different search.',
                            actionLabel: hasActiveFilters
                                ? 'Clear filters'
                                : null,
                            onAction: hasActiveFilters
                                ? () {
                                    _searchController.clear();
                                    _clearFilters();
                                  }
                                : null,
                          ),
                        ],
                      );
                    }
                    return ListView.builder(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      itemCount: filtered.length,
                      itemBuilder: (_, i) => MentorCard(mentor: filtered[i]),
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

class MentorCard extends ConsumerWidget {
  const MentorCard({super.key, required this.mentor});
  final Mentor mentor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isMentor =
        ref.watch(authControllerProvider).user?.role == UserRole.mentor;

    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      // The whole card always opens the mentor's profile — it used to open
      // a chat unless you tapped precisely on the avatar/name, which meant
      // the same tap looked like it did different things depending on where
      // on the card you landed. Starting a chat is still one tap away, from
      // the profile screen's action bar.
      onTap: () => context.push('/mentors/${mentor.id}'),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          AppAvatar(
            name: mentor.displayName,
            size: 52,
            avatarUrl: mentor.avatarUrl,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        mentor.displayName,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: AppFont.md,
                          fontWeight: AppFont.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    if (mentor.isVerified) ...[
                      const Icon(
                        Icons.verified_rounded,
                        size: 16,
                        color: AppColors.verified,
                      ),
                      const SizedBox(width: 4),
                    ],
                    const Icon(
                      Icons.chevron_right_rounded,
                      size: 16,
                      color: AppColors.textMuted,
                    ),
                  ],
                ),
                if (mentor.university != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      mentor.university!.name,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: AppFont.xs,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Row(
                    children: [
                      CallAvailabilityChip(
                        isAvailable: mentor.isAvailable,
                        compact: true,
                      ),
                      if (mentor.rating != null) ...[
                        const SizedBox(width: 6),
                        const Icon(
                          Icons.star_rounded,
                          size: 14,
                          color: AppColors.warning,
                        ),
                        const SizedBox(width: 2),
                        Text(
                          '${mentor.rating!.toStringAsFixed(1)} (${mentor.reviewCount})',
                          style: const TextStyle(
                            fontSize: AppFont.xs,
                            fontWeight: AppFont.semibold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          // Aspirant-only: POST/DELETE /wishlist are @Roles(ASPIRANT), so a
          // mentor tapping this would just get a 403.
          if (!isMentor) _SaveMentorButton(mentorId: mentor.id),
        ],
      ),
    );
  }
}

/// One pill in the Mentors filter row — a plain toggle, or a sheet trigger
/// (`dropdown: true` adds a chevron). Filled-primary when active.
class _MentorFilterChip extends StatelessWidget {
  const _MentorFilterChip({
    required this.label,
    required this.active,
    required this.onTap,
    this.dropdown = false,
  });

  final String label;
  final bool active;
  final VoidCallback? onTap;
  final bool dropdown;

  @override
  Widget build(BuildContext context) {
    final disabled = onTap == null;
    return Material(
      color: active ? AppColors.primary : AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadius.full),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.full),
        child: Opacity(
          opacity: disabled ? 0.45 : 1,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.full),
              border: Border.all(
                color: active ? AppColors.primary : AppColors.border,
              ),
            ),
            alignment: Alignment.center,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
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
                if (dropdown)
                  Icon(
                    Icons.keyboard_arrow_down_rounded,
                    size: 16,
                    color: active ? AppColors.textInverse : AppColors.textMuted,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Heart toggle that saves/unsaves a mentor. Optimistic — the shared
/// savedMentorIdsProvider flips immediately and reverts itself if the request
/// fails, so the icon never lags behind the tap.
class _SaveMentorButton extends ConsumerWidget {
  const _SaveMentorButton({required this.mentorId});
  final String mentorId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final saved =
        ref.watch(savedMentorIdsProvider).value?.contains(mentorId) ?? false;

    return IconButton(
      onPressed: () =>
          ref.read(savedMentorIdsProvider.notifier).toggle(mentorId),
      icon: Icon(
        saved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
        color: saved ? AppColors.error : AppColors.textMuted,
      ),
      tooltip: saved ? 'Remove from saved' : 'Save mentor',
    );
  }
}
