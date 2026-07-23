import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/mentors_api.dart';
import '../../core/network/sessions_api.dart';
import '../../core/network/wishlist_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';

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

/// Mentor discovery backed by `GET /mentors`. Tapping a mentor goes straight
/// into a free chat with them — no pricing or slot picker up front. A call
/// can be requested from inside the chat screen instead (see
/// SessionChatScreen's "Request a call" action).
class MentorListScreen extends ConsumerWidget {
  const MentorListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mentorsAsync = ref.watch(mentorsListProvider);

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
            data: (mentors) => mentors.isEmpty
                ? ListView(
                    children: const [
                      SizedBox(height: 120),
                      EmptyState(
                        icon: Icons.people_alt_rounded,
                        title: 'No mentors yet',
                        message:
                            'Verified mentors will appear here as they join.',
                      ),
                    ],
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    itemCount: mentors.length,
                    itemBuilder: (_, i) => MentorCard(mentor: mentors[i]),
                  ),
          ),
        ),
      ),
    );
  }
}

/// Flat per-minute rate for AUDIO_CALL sessions — matches the backend's
/// MENTOR_RATE_PER_MINUTE_MINOR (₹10/min, same for every mentor), which is
/// independent of the mentor's own listed CHAT rate.
const int _kCallRatePerMinuteMinor = 1000;

class MentorCard extends ConsumerWidget {
  const MentorCard({super.key, required this.mentor});
  final Mentor mentor;

  /// Straight into a free chat — no pricing, no kind picker. If one's
  /// already outstanding with this mentor, reuse it instead of erroring.
  Future<void> _startChat(BuildContext context, WidgetRef ref) async {
    final api = ref.read(sessionsApiProvider);
    try {
      Session session;
      try {
        session = await api.create(mentor.id, SessionKind.chat);
      } on DioException catch (e) {
        // 409 = "you already have an active session with this mentor" —
        // recoverable by finding that session. Anything else is a real
        // error and must not be masked by a confusing "no element" below.
        if (e.response?.statusCode != 409) rethrow;

        final existing = await api.list();
        final match = existing.where(
          (s) => s.mentorId == mentor.id &&
              s.type == 'CHAT' &&
              _activeStatuses.contains(s.status),
        );
        if (match.isEmpty) rethrow;
        session = match.first;
      }
      if (!context.mounted) return;
      context.push('/chats/room', extra: {'sessionId': session.id});
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Could not start chat: $e')));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      onTap: () => _startChat(context, ref),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => context.push('/mentors/${mentor.id}'),
            child: AppAvatar(name: mentor.displayName, size: 52),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => context.push('/mentors/${mentor.id}'),
                  child: Row(
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
                      const Icon(Icons.verified_rounded,
                          size: 16, color: AppColors.verified),
                      const SizedBox(width: 4),
                      const Icon(Icons.chevron_right_rounded,
                          size: 16, color: AppColors.textMuted),
                    ],
                  ),
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
                if (mentor.rating != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Row(
                      children: [
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
                    ),
                  ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const StatusChip(
                      label: 'Free chat',
                      color: AppColors.primary,
                    ),
                    const SizedBox(width: 6),
                    StatusChip(
                      label: '₹${_kCallRatePerMinuteMinor ~/ 100}/min call',
                      color: AppColors.info,
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          _SaveButton(mentorId: mentor.id),
          const SizedBox(width: AppSpacing.xs),
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
              gradient: AppGradients.brand,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.add_rounded,
                color: Colors.white, size: 22),
          ),
        ],
      ),
    );
  }
}

class _SaveButton extends ConsumerWidget {
  const _SaveButton({required this.mentorId});
  final String mentorId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final savedIdsAsync = ref.watch(savedMentorIdsProvider);
    final isSaved = savedIdsAsync.value?.contains(mentorId) ?? false;

    return IconButton(
      onPressed: () =>
          ref.read(savedMentorIdsProvider.notifier).toggle(mentorId),
      icon: Icon(
        isSaved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
        color: isSaved ? AppColors.error : AppColors.textMuted,
      ),
      visualDensity: VisualDensity.compact,
    );
  }
}

