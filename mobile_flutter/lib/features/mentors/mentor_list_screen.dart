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

final mentorsListProvider = FutureProvider.autoDispose<List<Mentor>>(
  (ref) => ref.watch(mentorsApiProvider).list(),
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
  /// Client-side filters over the already-loaded list — same approach as
  /// the Colleges tab. `GET /mentors` returns the full set, so filtering
  /// here means no extra request per keystroke / toggle.
  String _query = '';
  String? _stream;
  // Whether the aspirant has explicitly touched the Stream pill (including
  // picking "Any"). Until then, Stream defaults to — and actively filters
  // by — their own profile.stream from onboarding, same deferred-default
  // pattern as the Colleges tab's Stream pill.
  bool _streamTouched = false;
  String? _degree;
  String? _specialization;
  String? _language;
  bool _availableOnly = false;
  bool _topRated = false;

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
  Widget build(BuildContext context) {
    final mentorsAsync = ref.watch(mentorsListProvider);
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

    // Degree cascades from Stream (mirrors the Colleges tab); Specialization
    // only ever applies to a non-MBBS Medical degree, matching the mentor
    // onboarding wizard's own _needsSpecialization rule.
    final degreeOptions = effectiveStream != null
        ? degreesForStream(effectiveStream)
        : const <String>[];
    final degree = degreeOptions.contains(_degree) ? _degree : null;
    final showSpecialization =
        effectiveStream == 'Medical' && degree != null && degree != 'MBBS';
    final specialization = showSpecialization ? _specialization : null;

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
                    label: 'Available now',
                    active: _availableOnly,
                    onTap: () =>
                        setState(() => _availableOnly = !_availableOnly),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  _MentorFilterChip(
                    label: '4★ and up',
                    active: _topRated,
                    onTap: () => setState(() => _topRated = !_topRated),
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
                      onPick: (v) => setState(() {
                        _stream = v;
                        _streamTouched = true;
                        // Degree/Specialization are stream-scoped — drop
                        // them now rather than leaving a stale selection
                        // from the previous stream.
                        _degree = null;
                        _specialization = null;
                      }),
                    ),
                  ),
                  if (degreeOptions.isNotEmpty) ...[
                    const SizedBox(width: AppSpacing.xs),
                    _MentorFilterChip(
                      label: degree ?? 'Degree',
                      active: degree != null,
                      dropdown: true,
                      onTap: () => _pickOne(
                        title: 'Degree',
                        options: degreeOptions,
                        selected: degree,
                        onPick: (v) => setState(() {
                          _degree = v;
                          _specialization = null;
                        }),
                      ),
                    ),
                  ],
                  if (showSpecialization) ...[
                    const SizedBox(width: AppSpacing.xs),
                    _MentorFilterChip(
                      label: specialization ?? 'Specialization',
                      active: specialization != null,
                      dropdown: true,
                      onTap: () => _pickOne(
                        title: 'Specialization',
                        options: kMedicalSpecializations,
                        selected: specialization,
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
                  const SizedBox(width: AppSpacing.md),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Expanded(
              child: RefreshIndicator(
                color: AppColors.primary,
                onRefresh: () => ref.refresh(mentorsListProvider.future),
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
                        onAction: () => ref.invalidate(mentorsListProvider),
                      ),
                    ],
                  ),
                  data: (mentors) {
                    if (mentors.isEmpty) {
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
                    final filtered = mentors.where((m) {
                      if (query.isNotEmpty &&
                          !m.displayName.toLowerCase().contains(query)) {
                        return false;
                      }
                      if (_availableOnly && !m.isAvailable) return false;
                      if (_topRated && (m.rating ?? 0) < 4.0) return false;
                      if (effectiveStream != null &&
                          m.stream != effectiveStream) {
                        return false;
                      }
                      if (degree != null && m.qualification != degree) {
                        return false;
                      }
                      if (specialization != null &&
                          m.specialization != specialization) {
                        return false;
                      }
                      if (_language != null &&
                          !m.languages.contains(_language)) {
                        return false;
                      }
                      return true;
                    }).toList();
                    if (filtered.isEmpty) {
                      return ListView(
                        children: const [
                          SizedBox(height: 120),
                          EmptyState(
                            icon: Icons.search_off_rounded,
                            title: 'No mentors found',
                            message: 'Try clearing a filter or search.',
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
  final VoidCallback onTap;
  final bool dropdown;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? AppColors.primary : AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadius.full),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.full),
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
