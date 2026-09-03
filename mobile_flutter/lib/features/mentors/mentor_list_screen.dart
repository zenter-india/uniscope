import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/mentors_api.dart';
import '../../core/network/sessions_api.dart';
import '../../core/network/wishlist_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import '../sessions/session_list_screen.dart' show sessionsListProvider;

final mentorsListProvider = FutureProvider.autoDispose<List<Mentor>>(
  (ref) => ref.watch(mentorsApiProvider).list(),
);

final mentorsByUniversityProvider =
    FutureProvider.autoDispose.family<List<Mentor>, String>(
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
  String mentorId,
) async {
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
        (s) => s.mentorId == mentorId &&
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
    context.push('/chats/room', extra: {'sessionId': session.id});
  } catch (e) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text('Could not start chat: $e')));
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
  /// Client-side name filter over the already-loaded list — same approach
  /// as the Colleges tab. `GET /mentors` returns the full set (no name
  /// query param), so no extra request per keystroke.
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final mentorsAsync = ref.watch(mentorsListProvider);
    final query = _query.trim().toLowerCase();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Mentors'),
        // Saved sits before Wallet so Wallet keeps its established
        // far-right position — deliberately not relocated.
        actions: [
          IconButton(
            onPressed: () => context.push('/mentors/saved'),
            icon: const Icon(Icons.favorite_rounded, color: AppColors.error),
            tooltip: 'Saved mentors',
          ),
          IconButton(
            onPressed: () => context.push('/wallet'),
            icon: const Icon(Icons.account_balance_wallet_rounded,
                color: AppColors.primary),
            tooltip: 'Wallet',
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
                    final filtered = query.isEmpty
                        ? mentors
                        : mentors
                            .where((m) =>
                                m.displayName.toLowerCase().contains(query))
                            .toList();
                    if (filtered.isEmpty) {
                      return ListView(
                        children: [
                          const SizedBox(height: 120),
                          EmptyState(
                            icon: Icons.search_off_rounded,
                            title: 'No mentors found',
                            message: 'No mentor matches "${_query.trim()}".',
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
              name: mentor.displayName, size: 52, avatarUrl: mentor.avatarUrl),
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
                      const Icon(Icons.verified_rounded,
                          size: 16, color: AppColors.verified),
                      const SizedBox(width: 4),
                    ],
                    const Icon(Icons.chevron_right_rounded,
                        size: 16, color: AppColors.textMuted),
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
                          isAvailable: mentor.isAvailable, compact: true),
                      if (mentor.rating != null) ...[
                        const SizedBox(width: 6),
                        const Icon(Icons.star_rounded,
                            size: 14, color: AppColors.warning),
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

