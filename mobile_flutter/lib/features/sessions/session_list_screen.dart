import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/reviews_api.dart';
import '../../core/network/sessions_api.dart';
import '../../core/network/wallet_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';

final sessionsListProvider = FutureProvider.autoDispose<List<Session>>(
  (ref) => ref.watch(sessionsApiProvider).list(),
);

final hasReviewedProvider =
    FutureProvider.autoDispose.family<bool, String>(
  (ref, sessionId) => ref.watch(reviewsApiProvider).hasReviewed(sessionId),
);

/// Sessions tab: every booking the current user is a party to — as aspirant
/// or mentor — with role-appropriate actions (mentor: accept/reject; aspirant:
/// cancel / join call / open chat).
class SessionListScreen extends ConsumerWidget {
  const SessionListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionsAsync = ref.watch(sessionsListProvider);
    final myUserId = ref.watch(authControllerProvider).user?.id;
    final isMentorAccount = ref.watch(authControllerProvider).user?.role == UserRole.mentor;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Sessions'),
        actions: const [NotificationBell()],
      ),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _SupportChatEntry(onTap: () => context.push('/chats/support')),
            Expanded(
              child: RefreshIndicator(
                color: AppColors.primary,
                onRefresh: () => ref.refresh(sessionsListProvider.future),
                child: sessionsAsync.when(
                  loading: () => ListView(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    children: const [SkeletonCard(), SkeletonCard()],
                  ),
                  error: (err, _) => ListView(
                    children: [
                      EmptyState(
                        icon: Icons.wifi_off_rounded,
                        title: 'Could not load sessions',
                        message: 'Check your connection and pull to refresh.',
                        actionLabel: 'Retry',
                        onAction: () => ref.invalidate(sessionsListProvider),
                      ),
                    ],
                  ),
                  data: (sessions) => sessions.isEmpty
                      ? ListView(
                          children: [
                            const SizedBox(height: 80),
                            isMentorAccount
                                ? const EmptyState(
                                    icon: Icons.forum_rounded,
                                    title: 'No sessions yet',
                                    message:
                                        'Sessions will show up here once an aspirant books a chat or call with you.',
                                  )
                                : EmptyState(
                                    icon: Icons.forum_rounded,
                                    title: 'No sessions yet',
                                    message:
                                        'Book a chat or audio call with a mentor to get started.',
                                    actionLabel: 'Find a Mentor',
                                    onAction: () => context.go('/mentors'),
                                  ),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(AppSpacing.md),
                          itemCount: sessions.length,
                          itemBuilder: (_, i) => _SessionCard(
                            session: sessions[i],
                            isMentor: sessions[i].mentorId == myUserId,
                          ),
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SupportChatEntry extends StatelessWidget {
  const _SupportChatEntry({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, AppSpacing.sm, AppSpacing.md, 0),
      child: AppCard(
        onTap: onTap,
        gradient: AppGradients.brand,
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.16),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.support_agent_rounded,
                  color: Colors.white, size: 19),
            ),
            const SizedBox(width: AppSpacing.sm),
            const Expanded(
              child: Text(
                'Need help? Chat with our support team.',
                style: TextStyle(
                  fontSize: AppFont.sm,
                  fontWeight: AppFont.bold,
                  color: Colors.white,
                ),
              ),
            ),
            const Icon(Icons.chevron_right_rounded,
                color: Colors.white70, size: 22),
          ],
        ),
      ),
    );
  }
}

class _SessionCard extends ConsumerStatefulWidget {
  const _SessionCard({required this.session, required this.isMentor});
  final Session session;
  final bool isMentor;

  @override
  ConsumerState<_SessionCard> createState() => _SessionCardState();
}

class _SessionCardState extends ConsumerState<_SessionCard> {
  bool _busy = false;

  Future<void> _act(Future<Session> Function(String) action) async {
    setState(() => _busy = true);
    try {
      await action(widget.session.id);
      ref.invalidate(sessionsListProvider);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// A mentor accepting an audio call is already in the app right now — no
  /// need to wait on a push round-trip to get THEM onto the call screen
  /// (the aspirant still needs the push deep-link in push_service.dart,
  /// since they're not the one who just tapped Accept). Without this, both
  /// sides only reach /call/:sessionId by each separately remembering to
  /// tap "Join Call" later, which is why calls were getting stuck on the
  /// ringing screen for both parties — see CallScreen's dual-confirm join.
  Future<void> _acceptAndMaybeJoin(SessionsApi api) async {
    setState(() => _busy = true);
    // TEMP DIAGNOSTIC — remove once real-device call testing is confirmed
    // working. This is the mentor's own local navigation into the call
    // screen on accept — separate from the aspirant's push deep-link path.
    debugPrint('[session] accept tapped sessionId=${widget.session.id}');
    try {
      final updated = await api.accept(widget.session.id);
      debugPrint(
        '[session] accept succeeded sessionId=${updated.id} type=${updated.type} '
        'status=${updated.status.wire}',
      );
      ref.invalidate(sessionsListProvider);
      if (!mounted) return;
      if (updated.type == 'AUDIO_CALL') {
        debugPrint('[session] navigating mentor to /call/${updated.id}');
        context.push('/call/${updated.id}');
      }
    } catch (e) {
      debugPrint('[session] accept FAILED sessionId=${widget.session.id} — $e');
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Color _statusColor(SessionStatus status) {
    switch (status) {
      case SessionStatus.pending:
        return AppColors.warning;
      case SessionStatus.accepted:
      case SessionStatus.inProgress:
        return AppColors.primary;
      case SessionStatus.completed:
        return AppColors.info;
      case SessionStatus.rejected:
      case SessionStatus.cancelled:
      case SessionStatus.expired:
      case SessionStatus.failed:
        return AppColors.error;
      case SessionStatus.ringing:
        return AppColors.accent;
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    final api = ref.read(sessionsApiProvider);
    final isCall = session.type == 'AUDIO_CALL';
    final canOpenChat = session.type == 'CHAT' &&
        (session.status == SessionStatus.accepted ||
            session.status == SessionStatus.inProgress ||
            session.status == SessionStatus.completed);
    final canJoinCall = isCall &&
        (session.status == SessionStatus.accepted ||
            session.status == SessionStatus.ringing ||
            session.status == SessionStatus.inProgress);
    final canReview =
        !widget.isMentor && session.status == SessionStatus.completed;

    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AppAvatar(
                name: widget.isMentor ? session.aspirantName : session.mentorName,
                avatarUrl: widget.isMentor
                    ? session.aspirantAvatarUrl
                    : session.mentorAvatarUrl,
                size: 40,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.isMentor ? session.aspirantName : session.mentorName,
                      style: const TextStyle(
                          fontWeight: AppFont.bold, fontSize: AppFont.md),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isCall && session.callSlotMinutes != null
                          ? 'Audio call · ${uniminutesLabel(slotUniminutes(session.callSlotMinutes!))}'
                          : 'Chat',
                      style: const TextStyle(
                          fontSize: AppFont.xs,
                          color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              StatusChip(
                label: session.status.wire,
                color: _statusColor(session.status),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              if (widget.isMentor &&
                  session.status == SessionStatus.pending) ...[
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : () => _act(api.reject),
                    child: const Text('Reject'),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: FilledButton(
                    onPressed: _busy ? null : () => _acceptAndMaybeJoin(api),
                    child: _busy
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Accept'),
                  ),
                ),
              ] else if (!widget.isMentor &&
                  // Only AUDIO_CALL still has a "withdraw my request" phase —
                  // CHAT sessions open immediately and skip PENDING/ACCEPTED
                  // entirely, so there's never an outstanding chat request to
                  // cancel.
                  isCall &&
                  (session.status == SessionStatus.pending ||
                      session.status == SessionStatus.accepted)) ...[
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : () => _act(api.cancel),
                    child: const Text('Cancel'),
                  ),
                ),
              ],
              if (canOpenChat) ...[
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => context
                        .push('/chats/room', extra: {'sessionId': session.id}),
                    icon: const Icon(Icons.forum_rounded, size: 17),
                    label: const Text('Open Chat'),
                  ),
                ),
              ],
              if (canJoinCall) ...[
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: FilledButton.icon(
                    style:
                        FilledButton.styleFrom(backgroundColor: AppColors.primary),
                    onPressed: () => context.push('/call/${session.id}'),
                    icon: const Icon(Icons.call_rounded, size: 17),
                    label: const Text('Join Call'),
                  ),
                ),
              ],
            ],
          ),
          if (canReview) _ReviewPrompt(session: session),
        ],
      ),
    );
  }
}

class _ReviewPrompt extends ConsumerWidget {
  const _ReviewPrompt({required this.session});
  final Session session;

  Future<void> _openReviewSheet(BuildContext context, WidgetRef ref) async {
    final submitted = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: AppColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      builder: (_) => _RateMentorSheet(sessionId: session.id),
    );
    if (submitted == true) {
      ref.invalidate(hasReviewedProvider(session.id));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviewedAsync = ref.watch(hasReviewedProvider(session.id));

    return reviewedAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (reviewed) {
        if (reviewed) {
          return const Padding(
            padding: EdgeInsets.only(top: AppSpacing.sm),
            child: Row(
              children: [
                Icon(Icons.check_circle_rounded, size: 15, color: AppColors.primary),
                SizedBox(width: 4),
                Text('You reviewed this session',
                    style: TextStyle(fontSize: AppFont.xs, color: AppColors.textSecondary)),
              ],
            ),
          );
        }
        return Padding(
          padding: const EdgeInsets.only(top: AppSpacing.sm),
          child: SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _openReviewSheet(context, ref),
              icon: const Icon(Icons.star_outline_rounded, size: 17),
              label: const Text('Leave a review'),
            ),
          ),
        );
      },
    );
  }
}

class _RateMentorSheet extends ConsumerStatefulWidget {
  const _RateMentorSheet({required this.sessionId});
  final String sessionId;

  @override
  ConsumerState<_RateMentorSheet> createState() => _RateMentorSheetState();
}

class _RateMentorSheetState extends ConsumerState<_RateMentorSheet> {
  int _rating = 5;
  final _commentController = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await ref.read(reviewsApiProvider).create(
            sessionId: widget.sessionId,
            rating: _rating,
            comment: _commentController.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Could not submit review: $e')));
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Rate your mentor',
              style: TextStyle(fontSize: AppFont.lg, fontWeight: AppFont.extraBold)),
          const SizedBox(height: AppSpacing.lg),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (i) {
              final starIndex = i + 1;
              return IconButton(
                onPressed: () => setState(() => _rating = starIndex),
                icon: Icon(
                  starIndex <= _rating ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: AppColors.warning,
                  size: 34,
                ),
              );
            }),
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: _commentController,
            maxLines: 3,
            maxLength: 500,
            decoration: const InputDecoration(
              hintText: 'Share how the session went (optional)',
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Submit Review'),
            ),
          ),
        ],
      ),
    );
  }
}
