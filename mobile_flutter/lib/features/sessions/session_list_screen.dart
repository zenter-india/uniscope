import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/reviews_api.dart';
import '../../core/network/sessions_api.dart';
import '../../core/network/wallet_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import '../mentors/mentor_list_screen.dart' show startChatWithMentor;
import '../wallet/low_balance_sheet.dart';
import '../wallet/wallet_screen.dart' show walletBalanceProvider;
import 'call_request_sheet.dart';
import 'cancel_deflection_sheet.dart';

final sessionsListProvider = FutureProvider.autoDispose<List<Session>>(
  (ref) => ref.watch(sessionsApiProvider).list(),
);

/// Shortest bookable call slot, in Uniminutes — mirrors SessionChatScreen's
/// own `_minCallSlotUniminutes` so the Sessions-row call icon and the
/// in-chat "Request a call" action refuse a booking at the exact same
/// balance instead of one letting the sheet open only to fail at submit.
final _minCallSlotUniminutes = kCallSlotMinutes.first;

/// Dot colour for a mentor row's status subtitle — session state only.
Color _statusDotColor(SessionStatus status) {
  switch (status) {
    case SessionStatus.pending:
    case SessionStatus.ringing:
      return AppColors.warning;
    case SessionStatus.accepted:
    case SessionStatus.inProgress:
      return AppColors.primary;
    case SessionStatus.completed:
      return AppColors.textMuted;
    case SessionStatus.rejected:
    case SessionStatus.failed:
      return AppColors.error;
    case SessionStatus.cancelled:
    case SessionStatus.expired:
      return AppColors.textMuted;
  }
}

bool _isActiveStatus(SessionStatus status) =>
    status == SessionStatus.pending ||
    status == SessionStatus.accepted ||
    status == SessionStatus.ringing ||
    status == SessionStatus.inProgress;

/// Groups currently-actionable sessions (pending/accepted/ringing/in
/// progress) with the same counterpart into a single list entry, so a
/// mentor with both an open chat and an open call request from the same
/// person shows as one card with two action rows instead of two separate
/// cards. Completed/cancelled/rejected/expired sessions are left as their
/// own single-item entries — they're a record of a past event, not a
/// current state to merge.
///
/// Used for the mentor's own Sessions tab — a mentor manages many distinct
/// students and genuinely needs each one's individual request visible, so
/// this deliberately does NOT collapse historical sessions the way
/// [_groupAllSessionsByCounterpart] does for the aspirant side below.
List<List<Session>> _groupActiveSessions(
  List<Session> sessions,
  String? myUserId,
) {
  final result = <List<Session>>[];
  final activeGroupIndex = <String, int>{};

  for (final session in sessions) {
    if (!_isActiveStatus(session.status)) {
      result.add([session]);
      continue;
    }
    final counterpartId = session.mentorId == myUserId
        ? session.aspirantId
        : session.mentorId;
    final existingIndex = activeGroupIndex[counterpartId];
    if (existingIndex != null) {
      result[existingIndex].add(session);
    } else {
      activeGroupIndex[counterpartId] = result.length;
      result.add([session]);
    }
  }
  return result;
}

/// Aspirant-side grouping: unlike [_groupActiveSessions], this collapses
/// EVERY session with the same mentor into one group — active or not — so
/// the Sessions tab shows a single row per mentor relationship instead of
/// one row per historical chat/call. Per explicit product decision: a
/// student doesn't need a scrolling list of every past session with the
/// same mentor here; the full history for that relationship now lives
/// inside that mentor's own chat screen (see SessionChatScreen's history
/// action), reachable with one tap from the row this produces.
List<List<Session>> _groupAllSessionsByCounterpart(List<Session> sessions) {
  final result = <List<Session>>[];
  final groupIndex = <String, int>{};
  for (final session in sessions) {
    final existingIndex = groupIndex[session.mentorId];
    if (existingIndex != null) {
      result[existingIndex].add(session);
    } else {
      groupIndex[session.mentorId] = result.length;
      result.add([session]);
    }
  }
  return result;
}

final hasReviewedProvider = FutureProvider.autoDispose.family<bool, String>(
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
    final isMentorAccount =
        ref.watch(authControllerProvider).user?.role == UserRole.mentor;

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
                      : isMentorAccount
                      ? Builder(
                          builder: (context) {
                            final groups = _groupActiveSessions(
                              sessions,
                              myUserId,
                            );
                            return ListView.builder(
                              padding: const EdgeInsets.all(AppSpacing.md),
                              itemCount: groups.length,
                              itemBuilder: (_, i) {
                                final group = groups[i];
                                final isMentor =
                                    group.first.mentorId == myUserId;
                                return group.length > 1
                                    ? _MergedSessionCard(
                                        sessions: group,
                                        isMentor: isMentor,
                                      )
                                    : _SessionCard(
                                        session: group.first,
                                        isMentor: isMentor,
                                      );
                              },
                            );
                          },
                        )
                      : _AspirantSessions(sessions: sessions),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Aspirant Sessions body: one row per mentor relationship, in a single
/// hairline-divided card (see [_AspirantMentorRow]). Mentors with a live or
/// pending session float to the top; the rest follow by recency. History
/// within a relationship lives inside that mentor's chat screen.
class _AspirantSessions extends StatelessWidget {
  const _AspirantSessions({required this.sessions});
  final List<Session> sessions;

  @override
  Widget build(BuildContext context) {
    final groups = _groupAllSessionsByCounterpart(sessions);

    String latestReq(List<Session> g) => g
        .map((s) => s.requestedAt)
        .reduce((a, b) => a.compareTo(b) >= 0 ? a : b);

    groups.sort((a, b) {
      final aActive = a.any((s) => _isActiveStatus(s.status));
      final bActive = b.any((s) => _isActiveStatus(s.status));
      if (aActive != bActive) return aActive ? -1 : 1;
      return latestReq(b).compareTo(latestReq(a));
    });

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.xl,
      ),
      children: [
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: AppColors.border),
            boxShadow: AppShadows.card,
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              for (var i = 0; i < groups.length; i++) ...[
                if (i > 0)
                  const Divider(
                    height: 1,
                    thickness: 1,
                    color: AppColors.border,
                  ),
                _AspirantMentorRow(sessions: groups[i]),
              ],
            ],
          ),
        ),
      ],
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
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        0,
      ),
      child: AppCard(
        onTap: onTap,
        gradient: AppGradients.brand,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 14,
        ),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.16),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.support_agent_rounded,
                color: Colors.white,
                size: 19,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Need help?',
                    style: TextStyle(
                      fontSize: AppFont.sm,
                      fontWeight: AppFont.bold,
                      color: Colors.white,
                    ),
                  ),
                  SizedBox(height: 1),
                  Text(
                    'Chat with the Uniscope support team',
                    style: TextStyle(
                      fontSize: AppFont.xs,
                      color: Colors.white70,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: Colors.white70,
              size: 22,
            ),
          ],
        ),
      ),
    );
  }
}

/// A single actionable/completed session, shown as its own card.
class _SessionCard extends StatelessWidget {
  const _SessionCard({required this.session, required this.isMentor});
  final Session session;
  final bool isMentor;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SessionHeader(session: session, isMentor: isMentor),
          const SizedBox(height: AppSpacing.md),
          _SessionActions(session: session, isMentor: isMentor),
        ],
      ),
    );
  }
}

/// A mentor with both an open chat and an open call request from the same
/// person — one card, avatar/name and every action (Join Call, Open Chat,
/// Accept/Reject/Cancel) all on the single header row.
class _MergedSessionCard extends StatelessWidget {
  const _MergedSessionCard({required this.sessions, required this.isMentor});
  final List<Session> sessions;
  final bool isMentor;

  @override
  Widget build(BuildContext context) {
    final first = sessions.first;
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          AppAvatar(
            name: isMentor ? first.aspirantName : first.mentorName,
            avatarUrl: isMentor
                ? first.aspirantAvatarUrl
                : first.mentorAvatarUrl,
            size: 40,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              isMentor ? first.aspirantName : first.mentorName,
              style: const TextStyle(
                fontWeight: AppFont.bold,
                fontSize: AppFont.md,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          for (final session in sessions) ...[
            const SizedBox(width: AppSpacing.xs),
            _SessionActions(
              session: session,
              isMentor: isMentor,
              dense: true,
              showLabel: false,
            ),
          ],
        ],
      ),
    );
  }
}

/// Sentence-case status for a single row's subtitle — a lighter-weight
/// twin of `_SessionActionsState._statusLabel` (that one also needs
/// `isMentor`/dual endReason phrasing for a card's own action area; a
/// one-line summary row just needs something short and true).
String _lastActivityLabel(Session session) {
  switch (session.status) {
    case SessionStatus.pending:
      return session.type == 'AUDIO_CALL' ? 'Call requested' : 'Chat started';
    case SessionStatus.accepted:
      return 'Ready — accepted';
    case SessionStatus.ringing:
      return 'Call connecting…';
    case SessionStatus.inProgress:
      return session.type == 'AUDIO_CALL' ? 'Call in progress' : 'Chatting';
    case SessionStatus.completed:
      return session.type == 'AUDIO_CALL' ? 'Call completed' : 'Chat';
    case SessionStatus.rejected:
      return 'Declined';
    case SessionStatus.cancelled:
      return 'Cancelled';
    case SessionStatus.expired:
      return 'Expired';
    case SessionStatus.failed:
      return 'No answer';
  }
}

/// One row per mentor relationship, aspirant Sessions tab only (see
/// `_groupAllSessionsByCounterpart`'s doc comment for why this consolidates
/// every session with that mentor instead of listing each one).
///
/// Deliberately a flat, single-line list tile — WhatsApp-style — not a card
/// with stacked action rows: name + one status subtitle, then a call icon
/// and a chat icon at the trailing edge. No per-session Join/Cancel/history
/// piles up here anymore — that all lives inside the mentor's own chat
/// screen now (SessionChatScreen: the history action + the scoped
/// ActiveSessionDock for a live/pending call). Tapping the avatar opens the
/// mentor's profile (`/mentors/:id`); tapping anywhere else on the row, or
/// the chat icon, opens the chat thread; the call icon opens the
/// "Request a call" sheet (balance-gated, same as in-chat).
class _AspirantMentorRow extends ConsumerWidget {
  const _AspirantMentorRow({required this.sessions});
  final List<Session> sessions;

  Future<void> _requestCall(
    BuildContext context,
    WidgetRef ref,
    String mentorId,
  ) async {
    final wallet = await ref.read(walletBalanceProvider.future);
    if (!context.mounted) return;
    if (wallet.balanceUniminutes < _minCallSlotUniminutes) {
      await showLowBalanceSheet(
        context,
        balanceUniminutes: wallet.balanceUniminutes,
      );
      return;
    }
    if (!context.mounted) return;
    await showCallRequestSheet(context, ref, mentorId: mentorId);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final first = sessions.first;
    final latest = sessions.reduce(
      (a, b) => a.requestedAt.compareTo(b.requestedAt) >= 0 ? a : b,
    );
    final mentorId = first.mentorId;
    final mentorName = first.mentorName;
    // The dot only earns its place when the status is something other than
    // a plain "Chat" — a call request/outcome, or a live session.
    final showDot =
        latest.type == 'AUDIO_CALL' || _isActiveStatus(latest.status);

    return Material(
      color: AppColors.surface,
      child: InkWell(
        onTap: () => startChatWithMentor(context, ref, mentorId),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: 10,
          ),
          child: Row(
            children: [
              GestureDetector(
                onTap: () => context.push('/mentors/$mentorId'),
                child: AppAvatar(
                  name: mentorName,
                  avatarUrl: first.mentorAvatarUrl,
                  size: 46,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      mentorName,
                      style: const TextStyle(
                        fontWeight: AppFont.bold,
                        fontSize: AppFont.md,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        if (showDot) ...[
                          Container(
                            width: 7,
                            height: 7,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: _statusDotColor(latest.status),
                            ),
                          ),
                          const SizedBox(width: 6),
                        ],
                        Flexible(
                          child: Text(
                            _lastActivityLabel(latest),
                            style: const TextStyle(
                              fontSize: AppFont.xs,
                              color: AppColors.textSecondary,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              // Green only when this mentor can actually be booked for a
              // call right now (verified + "accepting call bookings" on,
              // not stale — the backend's `mentorIsAvailable` runs the same
              // `isCallAvailable()` gate every other surface uses). Greyed
              // otherwise, same glyph — a request would just be rejected
              // server-side.
              _RowIconButton(
                icon: Icons.call_outlined,
                tooltip: first.mentorIsAvailable
                    ? 'Request a call'
                    : 'Not accepting calls right now',
                color: first.mentorIsAvailable
                    ? AppColors.primary
                    : AppColors.textMuted,
                onTap: () => _requestCall(context, ref, mentorId),
              ),
              _RowIconButton(
                icon: Icons.chat_bubble_rounded,
                tooltip: 'Open chat',
                filled: true,
                onTap: () => startChatWithMentor(context, ref, mentorId),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Compact trailing action for an aspirant Sessions row. Outlined by
/// default (the call action); [filled] gives the primary-green disc used
/// for the chat action, so "open the conversation" is the row's clear
/// default move.
class _RowIconButton extends StatelessWidget {
  const _RowIconButton({
    required this.icon,
    required this.onTap,
    this.tooltip,
    this.color = AppColors.primary,
    this.filled = false,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String? tooltip;
  final Color color;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    if (filled) {
      final button = Material(
        color: AppColors.primary,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Icon(icon, size: 18, color: Colors.white),
          ),
        ),
      );
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2),
        child: tooltip != null
            ? Tooltip(message: tooltip!, child: button)
            : button,
      );
    }
    return IconButton(
      onPressed: onTap,
      icon: Icon(icon, size: 21),
      color: color,
      tooltip: tooltip,
      visualDensity: VisualDensity.compact,
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints(minWidth: 38, minHeight: 38),
    );
  }
}

/// Every past chat/call with one mentor, newest first — reuses the same
/// `_SessionCard` rendering (cost, duration, review prompt, everything) the
/// Sessions tab used to show inline for every session; now reached from
/// either the Sessions tab's collapsed mentor row or directly from that
/// mentor's own chat screen (see SessionChatScreen's history action),
/// which is the actual "moved inside the mentor's chat" destination for
/// this history per the product decision behind
/// `_groupAllSessionsByCounterpart`.
Future<void> showMentorSessionHistory(
  BuildContext context, {
  required String mentorId,
  required String mentorName,
  required List<Session> sessions,
}) {
  final sorted = [...sessions]
    ..sort((a, b) => b.requestedAt.compareTo(a.requestedAt));
  return showModalBottomSheet(
    context: context,
    backgroundColor: AppColors.surface,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
    ),
    builder: (_) => DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.sm,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'History with $mentorName',
                    style: const TextStyle(
                      fontSize: AppFont.lg,
                      fontWeight: AppFont.extraBold,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              controller: scrollController,
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              itemCount: sorted.length,
              itemBuilder: (_, i) =>
                  _SessionCard(session: sorted[i], isMentor: false),
            ),
          ),
        ],
      ),
    ),
  );
}

class _SessionHeader extends StatelessWidget {
  const _SessionHeader({required this.session, required this.isMentor});
  final Session session;
  final bool isMentor;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        AppAvatar(
          name: isMentor ? session.aspirantName : session.mentorName,
          avatarUrl: isMentor
              ? session.aspirantAvatarUrl
              : session.mentorAvatarUrl,
          size: 40,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            isMentor ? session.aspirantName : session.mentorName,
            style: const TextStyle(
              fontWeight: AppFont.bold,
              fontSize: AppFont.md,
            ),
          ),
        ),
      ],
    );
  }
}

/// Type label, status chip, action buttons, and review prompt for one
/// session — reused standalone (_SessionCard) and stacked (_MergedSessionCard).
class _SessionActions extends ConsumerStatefulWidget {
  const _SessionActions({
    required this.session,
    required this.isMentor,
    this.dense = false,
    this.showLabel = true,
  });
  final Session session;
  final bool isMentor;

  /// Compact layout used inside a merged card: small icon-only buttons for
  /// Open Chat / Join Call instead of full-width labelled pills, so two
  /// stacked sessions don't blow up the card's height.
  final bool dense;

  /// False when the type/status row is shown elsewhere (e.g. inline in the
  /// card header next to the name) — renders just the action controls.
  final bool showLabel;

  @override
  ConsumerState<_SessionActions> createState() => _SessionActionsState();
}

class _SessionActionsState extends ConsumerState<_SessionActions> {
  bool _busy = false;

  Future<void> _act(Future<Session> Function(String) action) async {
    setState(() => _busy = true);
    try {
      await action(widget.session.id);
      ref.invalidate(sessionsListProvider);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancelWithDeflection(SessionsApi api) async {
    setState(() => _busy = true);
    try {
      await api.cancel(widget.session.id);
      ref.invalidate(sessionsListProvider);
      if (!mounted) return;
      await showCancelDeflectionSheet(
        context,
        ref,
        excludeMentorId: widget.session.mentorId,
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Failed: $e')));
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
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Failed: $e')));
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

  // Sentence-case, plain-language status instead of the raw wire enum
  // (e.g. "PENDING") — a status code isn't self-explanatory at a glance.
  // FAILED is a generic bucket for several distinct no-show outcomes (see
  // SessionsService.sweepCallNoShows) — endReason (+ which side is viewing)
  // picks the specific label so "Failed" never shows up as a mystery to
  // either party, and each side sees their own outcome, not the other's.
  String _statusLabel(SessionStatus status, String? endReason, bool isMentor) {
    if (status == SessionStatus.failed) {
      switch (endReason) {
        case 'ASPIRANT_NO_SHOW':
          return isMentor
              ? 'Aspirant no-show — you were paid'
              : 'No-show — you were charged';
        case 'MENTOR_NO_SHOW':
          return isMentor ? 'You missed it — no charge' : 'Mentor no-show';
        case 'NO_ANSWER':
          return 'No answer';
        default:
          return 'Failed';
      }
    }
    switch (status) {
      case SessionStatus.pending:
        return 'Pending';
      case SessionStatus.accepted:
        return 'Accepted';
      case SessionStatus.ringing:
        return 'Connecting';
      case SessionStatus.inProgress:
        return 'In call';
      case SessionStatus.completed:
        return 'Completed';
      case SessionStatus.rejected:
        return 'Declined';
      case SessionStatus.cancelled:
        return 'Cancelled';
      case SessionStatus.expired:
        return 'Expired';
      case SessionStatus.failed:
        return 'Failed'; // unreachable — handled above
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    final api = ref.read(sessionsApiProvider);
    final isCall = session.type == 'AUDIO_CALL';
    final canOpenChat =
        session.type == 'CHAT' &&
        (session.status == SessionStatus.accepted ||
            session.status == SessionStatus.inProgress ||
            session.status == SessionStatus.completed);
    final canJoinCall =
        isCall &&
        (session.status == SessionStatus.accepted ||
            session.status == SessionStatus.ringing ||
            session.status == SessionStatus.inProgress);
    final canReview =
        !widget.isMentor && session.status == SessionStatus.completed;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.showLabel) ...[
          Row(
            children: [
              Expanded(
                child: Text(
                  isCall && session.callSlotMinutes != null
                      ? 'Audio call · ${uniminutesLabel(slotUniminutes(session.callSlotMinutes!))}'
                      : 'Chat',
                  style: const TextStyle(
                    fontSize: AppFont.xs,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
              // Chat has no approval gate — anyone can message anyone for
              // free, so a PENDING/ACCEPTED chip on a chat row is just
              // noise. Only calls have a real status worth surfacing.
              if (isCall)
                StatusChip(
                  label: _statusLabel(
                    session.status,
                    session.endReason,
                    widget.isMentor,
                  ),
                  color: _statusColor(session.status),
                ),
            ],
          ),
          SizedBox(height: widget.dense ? AppSpacing.xs : AppSpacing.sm),
        ],
        Row(
          mainAxisSize: widget.showLabel ? MainAxisSize.max : MainAxisSize.min,
          mainAxisAlignment: widget.dense
              ? MainAxisAlignment.end
              : MainAxisAlignment.start,
          children: [
            if (widget.isMentor && session.status == SessionStatus.pending) ...[
              _ActionButton(
                label: 'Reject',
                outlined: true,
                dense: widget.dense,
                onPressed: _busy ? null : () => _act(api.reject),
              ),
              const SizedBox(width: AppSpacing.sm),
              _ActionButton(
                label: 'Accept',
                dense: widget.dense,
                busy: _busy,
                onPressed: _busy ? null : () => _acceptAndMaybeJoin(api),
              ),
            ] else if (!widget.isMentor &&
                // Only AUDIO_CALL still has a "withdraw my request" phase —
                // CHAT sessions open immediately and skip PENDING/ACCEPTED
                // entirely, so there's never an outstanding chat request to
                // cancel.
                isCall &&
                (session.status == SessionStatus.pending ||
                    session.status == SessionStatus.accepted)) ...[
              widget.dense
                  ? _TappableStatusChip(
                      label: _statusLabel(
                        session.status,
                        session.endReason,
                        widget.isMentor,
                      ),
                      color: _statusColor(session.status),
                      onTap: _busy ? null : () => _cancelWithDeflection(api),
                    )
                  : _ActionButton(
                      label: 'Cancel',
                      outlined: true,
                      onPressed: _busy
                          ? null
                          : () => _cancelWithDeflection(api),
                    ),
            ],
            if (canOpenChat) ...[
              const SizedBox(width: AppSpacing.sm),
              widget.dense
                  ? _CompactIconAction(
                      icon: Icons.forum_rounded,
                      tooltip: 'Open Chat',
                      onPressed: () => context.push(
                        '/chats/room',
                        extra: {'sessionId': session.id},
                      ),
                    )
                  : Expanded(
                      child: FilledButton.icon(
                        onPressed: () => context.push(
                          '/chats/room',
                          extra: {'sessionId': session.id},
                        ),
                        icon: const Icon(Icons.forum_rounded, size: 17),
                        label: const Text('Open Chat'),
                      ),
                    ),
            ],
            if (canJoinCall) ...[
              const SizedBox(width: AppSpacing.sm),
              widget.dense
                  ? _CompactIconAction(
                      icon: Icons.call_rounded,
                      tooltip: 'Join Call',
                      onPressed: () => context.push('/call/${session.id}'),
                    )
                  : Expanded(
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.primary,
                        ),
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
    );
  }
}

/// Reject/Accept/Cancel — full-width when standalone, content-sized when
/// [dense] (stacked inside a merged card).
class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.onPressed,
    this.outlined = false,
    this.dense = false,
    this.busy = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool outlined;
  final bool dense;
  final bool busy;

  static final _denseOutlinedStyle = OutlinedButton.styleFrom(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    minimumSize: Size.zero,
    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
    textStyle: const TextStyle(
      fontSize: AppFont.xs,
      fontWeight: AppFont.semibold,
    ),
  );

  static final _denseFilledStyle = FilledButton.styleFrom(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    minimumSize: Size.zero,
    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
    textStyle: const TextStyle(fontSize: AppFont.xs, fontWeight: AppFont.bold),
  );

  @override
  Widget build(BuildContext context) {
    final child = busy
        ? const SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: Colors.white,
            ),
          )
        : Text(label);

    final button = outlined
        ? OutlinedButton(
            onPressed: onPressed,
            style: dense ? _denseOutlinedStyle : null,
            child: child,
          )
        : FilledButton(
            onPressed: onPressed,
            style: dense ? _denseFilledStyle : null,
            child: child,
          );

    return dense ? button : Expanded(child: button);
  }
}

/// Icon-only round button used for Open Chat / Join Call inside a merged
/// card, instead of a full-width labelled pill.
class _CompactIconAction extends StatelessWidget {
  const _CompactIconAction({
    required this.icon,
    required this.onPressed,
    this.tooltip,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final button = Material(
      color: AppColors.primary,
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onPressed,
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Icon(icon, size: 17, color: Colors.white),
        ),
      ),
    );
    return tooltip != null ? Tooltip(message: tooltip!, child: button) : button;
  }
}

/// A call's status (PENDING/ACCEPTED/…), doubling as the cancel control in
/// the merged card — tapping it withdraws the request, so a separate
/// "Cancel" button isn't needed alongside it.
class _TappableStatusChip extends StatelessWidget {
  const _TappableStatusChip({
    required this.label,
    required this.color,
    required this.onTap,
  });

  final String label;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Tap to cancel',
      child: Material(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadius.full),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadius.full),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: AppFont.bold,
                    letterSpacing: 0.3,
                    color: color,
                  ),
                ),
                const SizedBox(width: 3),
                Icon(Icons.close_rounded, size: 12, color: color),
              ],
            ),
          ),
        ),
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
                Icon(
                  Icons.check_circle_rounded,
                  size: 15,
                  color: AppColors.primary,
                ),
                SizedBox(width: 4),
                Text(
                  'You reviewed this session',
                  style: TextStyle(
                    fontSize: AppFont.xs,
                    color: AppColors.textSecondary,
                  ),
                ),
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
      await ref
          .read(reviewsApiProvider)
          .create(
            sessionId: widget.sessionId,
            rating: _rating,
            comment: _commentController.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Could not submit review: $e')));
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
          const Text(
            'Rate your mentor',
            style: TextStyle(
              fontSize: AppFont.lg,
              fontWeight: AppFont.extraBold,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (i) {
              final starIndex = i + 1;
              return IconButton(
                onPressed: () => setState(() => _rating = starIndex),
                icon: Icon(
                  starIndex <= _rating
                      ? Icons.star_rounded
                      : Icons.star_outline_rounded,
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
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Submit Review'),
            ),
          ),
        ],
      ),
    );
  }
}
