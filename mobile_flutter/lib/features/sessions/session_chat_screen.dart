import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/chat_api.dart';
import '../../core/network/sessions_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import '../reports/safety_menu_sheet.dart';
import '../wallet/low_balance_sheet.dart';
import '../wallet/wallet_screen.dart' show walletBalanceProvider;
import 'active_session_dock.dart';
import 'call_request_sheet.dart';
import 'chat_thread_view.dart';
import 'session_list_screen.dart'
    show sessionsListProvider, showMentorSessionHistory;

/// Shortest bookable call slot, in Uniminutes — derived from
/// kCallSlotMinutes (itself mirroring the backend's
/// CreateSessionDto.CALL_SLOT_MINUTES) rather than a separate literal, so
/// this can't drift out of sync the next time the slot sizes change.
/// Below this balance, booking any slot is impossible, so the
/// call-request action is gated here instead of letting the sheet open
/// and fail at submit time.
final _minCallSlotUniminutes = kCallSlotMinutes.first;

/// Chat UI for a CHAT session (Postgres + Supabase Realtime — see
/// ChatThreadView). Chat is free and has no pricing or timing shown
/// anywhere in this screen — the only place a cost ever appears is the
/// "Request a call" sheet, since only calls are billed.
///
/// Polls the session status before connecting and shows a waiting state
/// for anything short of ACCEPTED — defensive: CHAT sessions open
/// immediately today (see SessionsService.create()), so this branch isn't
/// normally reached, but is kept in case that ever changes back to a real
/// accept step.
class SessionChatScreen extends ConsumerStatefulWidget {
  const SessionChatScreen({super.key, required this.sessionId});

  final String sessionId;

  @override
  ConsumerState<SessionChatScreen> createState() => _SessionChatScreenState();
}

class _SessionChatScreenState extends ConsumerState<SessionChatScreen> {
  ChatConnection? _connection;
  Object? _error;
  Session? _session;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    try {
      final session = await ref
          .read(sessionsApiProvider)
          .findById(widget.sessionId);
      if (!mounted) return;
      setState(() => _session = session);

      if (session.status == SessionStatus.accepted) {
        await _connect();
      } else if (_isTerminal(session.status)) {
        setState(() => _error = 'This chat is no longer available.');
      } else {
        _pollTimer ??= Timer.periodic(
          const Duration(seconds: 3),
          (_) => _loadSession(),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    }
  }

  bool _isTerminal(SessionStatus status) => const {
    SessionStatus.rejected,
    SessionStatus.cancelled,
    SessionStatus.expired,
    SessionStatus.failed,
  }.contains(status);

  Future<void> _connect() async {
    _pollTimer?.cancel();
    try {
      final connection = await ref
          .read(chatApiProvider)
          .getMessages(widget.sessionId);

      if (!mounted) return;
      setState(() => _connection = connection);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(title: const Text('Chat')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Text(
              '$_error',
              style: const TextStyle(color: AppColors.error),
            ),
          ),
        ),
      );
    }

    if (_session != null && _session!.status != SessionStatus.accepted) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(title: const Text('Chat')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(color: AppColors.primary),
                const SizedBox(height: AppSpacing.lg),
                const Text(
                  'Waiting for your mentor to accept…',
                  style: TextStyle(
                    fontWeight: AppFont.bold,
                    fontSize: AppFont.md,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                const Text(
                  'You\'ll be able to chat as soon as they do.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: AppFont.sm,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_connection == null) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    final currentUserId = ref.read(authControllerProvider).user!.id;
    final isAspirant = currentUserId == _session!.aspirantId;
    final otherName = isAspirant
        ? _session!.mentorName
        : _session!.aspirantName;
    final otherAvatarUrl = isAspirant
        ? _session!.mentorAvatarUrl
        : _session!.aspirantAvatarUrl;
    final otherUserId = isAspirant ? _session!.mentorId : _session!.aspirantId;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppAvatar(name: otherName, avatarUrl: otherAvatarUrl, size: 32),
            const SizedBox(width: AppSpacing.sm),
            Expanded(child: Text(otherName, overflow: TextOverflow.ellipsis)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.call_rounded, color: AppColors.primary),
            tooltip: 'Request a call',
            onPressed: () async {
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
              await showCallRequestSheet(
                context,
                ref,
                mentorId: _session!.mentorId,
              );
            },
          ),
          // Aspirant-only: the Sessions tab now shows one collapsed row per
          // mentor instead of every past session (see
          // _groupAllSessionsByCounterpart's doc comment) — this is where
          // that history actually lives now, reachable right from the
          // relationship it belongs to instead of a separate tab. A mentor
          // already sees every individual student's history distinctly on
          // their own Sessions tab, so this icon is redundant there.
          if (isAspirant)
            IconButton(
              icon: const Icon(
                Icons.history_rounded,
                color: AppColors.textSecondary,
              ),
              tooltip: 'Session history',
              onPressed: () async {
                final sessions = await ref.read(sessionsListProvider.future);
                final withMentor = sessions
                    .where((s) => s.mentorId == _session!.mentorId)
                    .toList();
                if (!context.mounted) return;
                await showMentorSessionHistory(
                  context,
                  mentorId: _session!.mentorId,
                  mentorName: otherName,
                  sessions: withMentor,
                );
              },
            ),
          IconButton(
            icon: const Icon(
              Icons.more_vert_rounded,
              color: AppColors.textSecondary,
            ),
            tooltip: 'Report or block',
            onPressed: () => showSafetyMenuSheet(
              context,
              ref,
              userId: otherUserId,
              userLabel: 'this user',
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Aspirant-only scoped dock — see ActiveSessionDock's doc comment
          // for why this replaced the old global-everywhere version for
          // students specifically (mentors still get the global one in
          // MainShell).
          if (isAspirant) ActiveSessionDock(mentorId: _session!.mentorId),
          Expanded(
            child: ChatThreadView(
              connection: _connection!,
              currentUserId: currentUserId,
              onSend: (text, clientMessageId) => ref
                  .read(chatApiProvider)
                  .sendMessage(
                    widget.sessionId,
                    text,
                    clientMessageId: clientMessageId,
                  ),
              onRefetch: () =>
                  ref.read(chatApiProvider).getMessages(widget.sessionId),
              onLoadOlder: (before) => ref
                  .read(chatApiProvider)
                  .getMessages(widget.sessionId, before: before),
            ),
          ),
        ],
      ),
    );
  }
}
