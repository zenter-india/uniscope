import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../calls/call_overlay.dart';
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
import 'call_time_windows.dart';
import 'cancel_deflection_sheet.dart';
import 'rate_mentor_sheet.dart';
import 'session_status.dart';

final sessionsListProvider = FutureProvider.autoDispose<List<Session>>(
  (ref) => ref.watch(sessionsApiProvider).list(),
);

/// Cost of the shortest bookable call slot, in Uniminutes — mirrors
/// SessionChatScreen's own `_minCallSlotUniminutes` (derived via
/// slotUniminutes(), not kCallSlotMinutes.first directly — slot prices
/// aren't 1 Uniminute-per-minute anymore, see wallet_api.dart) so the
/// Sessions-row call icon and the in-chat "Request a call" action refuse a
/// booking at the exact same balance instead of one letting the sheet open
/// only to fail at submit.
final _minCallSlotUniminutes = slotUniminutes(kCallSlotMinutes.first);

bool _isActiveStatus(SessionStatus status) =>
    status == SessionStatus.pending ||
    status == SessionStatus.accepted ||
    status == SessionStatus.ringing ||
    status == SessionStatus.inProgress;

/// The single session a grouped mentor row should show actions for, picked
/// from that student's active sessions by urgency: a call awaiting the
/// mentor's decision → a live call to join → an open chat → nothing. Returns
/// null when there's nothing actionable (the row falls back to a history
/// chevron). Everything not picked stays reachable via the row's history.
Session? _pickPrimaryAction(List<Session> active) {
  bool isCall(Session s) => s.type == 'AUDIO_CALL';
  Session? lastWhere(bool Function(Session) test) {
    final hits = active.where(test);
    return hits.isEmpty ? null : hits.last;
  }

  return lastWhere((s) => isCall(s) && s.status == SessionStatus.pending) ??
      lastWhere(
        (s) =>
            isCall(s) &&
            (s.status == SessionStatus.accepted ||
                s.status == SessionStatus.ringing ||
                s.status == SessionStatus.inProgress),
      ) ??
      lastWhere((s) => s.type == 'CHAT');
}

/// Groups currently-actionable sessions (pending/accepted/ringing/in
/// progress) with the same counterpart into a single list entry, so a
/// Aspirant-side grouping: collapses EVERY session with the same mentor into
/// one group — active or not — so the Sessions tab shows a single row per
/// mentor relationship instead of one row per historical chat/call. Per
/// explicit product decision: a student doesn't need a scrolling list of
/// every past session with the same mentor here; the full history for that
/// relationship now lives inside that mentor's own chat screen (see
/// SessionChatScreen's history action), reachable with one tap from the row
/// this produces.
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

/// Mentor-side grouping (2026-09-07, per explicit follow-up request —
/// supersedes the earlier "mentors deliberately unaffected" decision below,
/// which only ever collapsed a student's *active* sessions and left every
/// past chat/call with a repeat student as its own separate card, reading as
/// a wall of near-duplicate rows for anyone with a few sessions). Mirrors
/// [_groupAllSessionsByCounterpart] exactly, just keyed by the student
/// (`aspirantId`) instead of the mentor — every session with the same
/// student collapses into one group, active or not.
List<List<Session>> _groupAllSessionsByStudent(List<Session> sessions) {
  final result = <List<Session>>[];
  final groupIndex = <String, int>{};
  for (final session in sessions) {
    final existingIndex = groupIndex[session.aspirantId];
    if (existingIndex != null) {
      result[existingIndex].add(session);
    } else {
      groupIndex[session.aspirantId] = result.length;
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
    final isMentorAccount =
        ref.watch(authControllerProvider).user?.role == UserRole.mentor;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: GradientAppBar(
        title: const Text('Sessions'),
        actions: const [NotificationBell(color: Colors.white)],
      ),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _SupportChatEntry(onTap: () => context.push('/help')),
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
                      ? _MentorSessions(sessions: sessions)
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

/// Mentor Sessions body: one row per student relationship, same shape as
/// [_AspirantSessions] on the other side (see [_groupAllSessionsByStudent]).
/// Students with a live/pending session float to the top; the rest follow by
/// recency.
class _MentorSessions extends StatelessWidget {
  const _MentorSessions({required this.sessions});
  final List<Session> sessions;

  @override
  Widget build(BuildContext context) {
    final groups = _groupAllSessionsByStudent(sessions);

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
                _MentorStudentRow(sessions: groups[i]),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// One student relationship on the mentor's Sessions tab — avatar, name, a
/// status subtitle, and whatever action(s) the *currently active* session(s)
/// with this student need (Accept/Reject/Join/Open Chat, reusing
/// `_SessionActions` dense mode exactly as `_MergedSessionCard` did). With no
/// active session, the row just opens the "History with {student}" sheet
/// (`showMentorSessionHistory`, `isMentor: true`) — a repeat student's past
/// chats/calls no longer pile up as separate cards on this tab.
class _MentorStudentRow extends StatelessWidget {
  const _MentorStudentRow({required this.sessions});
  final List<Session> sessions;

  @override
  Widget build(BuildContext context) {
    final first = sessions.first;
    final latest = sessions.reduce(
      (a, b) => a.requestedAt.compareTo(b.requestedAt) >= 0 ? a : b,
    );
    final activeSessions =
        sessions.where((s) => _isActiveStatus(s.status)).toList()
          ..sort((a, b) => a.requestedAt.compareTo(b.requestedAt));
    // Surface actions for ONE session, not every active one — a student with
    // several open chats/calls used to render a wall of buttons. A call that
    // needs a decision (or a join) wins over a chat; the rest stay reachable
    // by tapping the row (→ history).
    final primaryAction = _pickPrimaryAction(activeSessions);
    final aspirantName = first.aspirantName;
    final showDot =
        latest.type == 'AUDIO_CALL' || _isActiveStatus(latest.status);
    final statusView = sessionStatusView(
      latest,
      isMentor: true,
      style: SessionStatusStyle.compact,
    );

    void openHistory() => showMentorSessionHistory(
      context,
      mentorId: first.aspirantId,
      mentorName: aspirantName,
      sessions: sessions,
      isMentor: true,
    );

    return Material(
      color: AppColors.surface,
      child: InkWell(
        onTap: openHistory,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: 10,
          ),
          child: Row(
            children: [
              AppAvatar(
                name: aspirantName,
                avatarUrl: first.aspirantAvatarUrl,
                size: 46,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      aspirantName,
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
                              color: statusView.color,
                            ),
                          ),
                          const SizedBox(width: 6),
                        ],
                        Flexible(
                          child: Text(
                            statusView.label,
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
              if (primaryAction == null)
                _RowIconButton(
                  icon: Icons.chevron_right_rounded,
                  tooltip: 'View history',
                  onTap: openHistory,
                )
              else
                _SessionActions(
                  session: primaryAction,
                  isMentor: true,
                  dense: true,
                  showLabel: false,
                ),
            ],
          ),
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
    String mentorName,
    List<String> mentorWindows,
  ) async {
    final wallet = await ref.read(walletBalanceProvider.future);
    if (!context.mounted) return;
    if (wallet.availableUniminutes < _minCallSlotUniminutes) {
      await showLowBalanceSheet(
        context,
        balanceUniminutes: wallet.availableUniminutes,
        reservedUniminutes: wallet.reservedUniminutes,
      );
      return;
    }
    if (!context.mounted) return;
    await showCallRequestSheet(
      context,
      ref,
      mentorId: mentorId,
      mentorName: mentorName,
      mentorWindows: mentorWindows,
    );
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
    final statusView = sessionStatusView(
      latest,
      isMentor: false,
      style: SessionStatusStyle.compact,
    );

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
                              color: statusView.color,
                            ),
                          ),
                          const SizedBox(width: 6),
                        ],
                        Flexible(
                          child: Text(
                            statusView.label,
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
                // Tappable only when the mentor is actually bookable —
                // greyed + disabled otherwise (a request would just 409
                // server-side).
                onTap: first.mentorIsAvailable
                    ? () => _requestCall(
                        context,
                        ref,
                        mentorId,
                        mentorName,
                        first.mentorAvailableDays,
                      )
                    : null,
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

  /// null → the button renders disabled (greyed, not tappable).
  final VoidCallback? onTap;
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
/// Past *calls* with one counterpart, newest first. Originally
/// aspirant-only (viewing history with a mentor, from `SessionChatScreen`'s
/// history action); generalized 2026-09-07 with an `isMentor` flag so the
/// mentor Sessions tab's per-student row (`_MentorStudentRow`) can reuse the
/// exact same sheet for "history with this student" instead of duplicating
/// it — the name stays `showMentorSessionHistory` (about the mentor's own
/// history, not who's viewing it) so the existing aspirant call site needs
/// no change.
///
/// CHAT sessions are excluded (2026-09-08, per request): a chat is one
/// continuous thread you're already looking at, so a "chat session" card
/// with an "Open Chat" button here is redundant. This sheet is a record of
/// calls only.
Future<void> showMentorSessionHistory(
  BuildContext context, {
  required String mentorId,
  required String mentorName,
  required List<Session> sessions,
  bool isMentor = false,
}) {
  final sorted =
      sessions.where((s) => s.type == 'AUDIO_CALL').toList()
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
            child: sorted.isEmpty
                ? const EmptyState(
                    icon: Icons.call_rounded,
                    title: 'No calls yet',
                    message:
                        'Past audio calls with this person will show up here.',
                  )
                : ListView.builder(
                    controller: scrollController,
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                    ),
                    itemCount: sorted.length,
                    itemBuilder: (_, i) =>
                        _SessionCard(session: sorted[i], isMentor: isMentor),
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
    try {
      final updated = await api.accept(widget.session.id);
      ref.invalidate(sessionsListProvider);
      if (!mounted) return;
      if (updated.type == 'AUDIO_CALL') {
        CallOverlayController.instance.open(updated.id);
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    final api = ref.read(sessionsApiProvider);
    final isCall = session.type == 'AUDIO_CALL';
    final statusView = sessionStatusView(session, isMentor: widget.isMentor);
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
                StatusChip(label: statusView.label, color: statusView.color),
            ],
          ),
          if (isCall && session.requestedFor != null) ...[
            SizedBox(height: widget.dense ? 2 : AppSpacing.xs),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.schedule_rounded,
                  size: 12,
                  color: AppColors.textMuted,
                ),
                const SizedBox(width: 4),
                Flexible(
                  child: Text(
                    session.requestedForAlt != null
                        ? 'Requested for ${friendlyCallTime(session.requestedFor!)} '
                              'or ${friendlyCallTime(session.requestedForAlt!)}'
                        : 'Requested for ${friendlyCallTime(session.requestedFor!)}',
                    style: const TextStyle(
                      fontSize: AppFont.xs,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ] else if (isCall &&
              widget.isMentor &&
              session.status == SessionStatus.pending) ...[
            // Instant request (no requestedFor). The mentor needs to know
            // Accept isn't a "confirm for later" — it drops straight into
            // the call.
            SizedBox(height: widget.dense ? 2 : AppSpacing.xs),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.bolt_rounded,
                  size: 12,
                  color: AppColors.primary,
                ),
                const SizedBox(width: 4),
                const Flexible(
                  child: Text(
                    'Instant request — Accept connects the call now. '
                    'Make sure you can talk.',
                    style: TextStyle(
                      fontSize: AppFont.xs,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ],
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
                label: isCall && session.requestedFor == null
                    ? 'Accept & join'
                    : 'Accept',
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
                      label: statusView.label,
                      color: statusView.color,
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
                      onPressed: () =>
                          CallOverlayController.instance.open(session.id),
                    )
                  : Expanded(
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.primary,
                        ),
                        onPressed: () =>
                            CallOverlayController.instance.open(session.id),
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
      builder: (_) => RateMentorSheet(sessionId: session.id),
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
