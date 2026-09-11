import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/sessions_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import 'call_time_windows.dart';
import 'cancel_deflection_sheet.dart';
import 'confirm_call_time_sheet.dart';
import 'session_list_screen.dart' show sessionsListProvider;
import 'session_status.dart';

/// Surfaces any audio-call session that needs attention right now — request
/// pending mentor acceptance, mentor decision needed, or ready to join.
/// This is what actually closes the "stuck on ringing" failure mode:
/// previously both sides only reached /call/:id by separately remembering
/// to open Messages and tap in, which is why real-world calls never
/// connected.
///
/// Chat sessions never appear here — chat opens instantly with no waiting
/// period, so there's nothing to keep surfaced.
///
/// Scoped to exactly one relationship — pass [mentorId] on the aspirant
/// side (that student's own chat with this mentor) or [aspirantId] on the
/// mentor side (that mentor's own chat with this student). It renders
/// inline inside `SessionChatScreen`, never as a cross-app floating banner
/// (per product decision, 2026-09-11: both roles now see their pending/live
/// call the same way — inside the relevant chat, not on a global dock).
/// Passing neither param — no longer used anywhere, kept only so an empty
/// state degrades gracefully instead of throwing — would show every active
/// session across every counterpart.
class ActiveSessionDock extends ConsumerWidget {
  const ActiveSessionDock({super.key, this.mentorId, this.aspirantId});
  final String? mentorId;
  final String? aspirantId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionsAsync = ref.watch(sessionsListProvider);
    final myUserId = ref.watch(authControllerProvider).user?.id;

    final sessions = sessionsAsync.asData?.value ?? const <Session>[];
    final active = sessions
        .where(
          (s) =>
              s.type == 'AUDIO_CALL' &&
              (mentorId == null || s.mentorId == mentorId) &&
              (aspirantId == null || s.aspirantId == aspirantId) &&
              (s.status == SessionStatus.pending ||
                  s.status == SessionStatus.accepted ||
                  s.status == SessionStatus.ringing ||
                  s.status == SessionStatus.inProgress),
        )
        .toList();

    if (active.isEmpty) return const SizedBox.shrink();

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.primaryLight,
        border: Border(bottom: BorderSide(color: AppColors.border, width: 1)),
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final session in active)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: _DockRow(
                session: session,
                isMentor: session.mentorId == myUserId,
              ),
            ),
        ],
      ),
    );
  }
}

class _DockRow extends ConsumerStatefulWidget {
  const _DockRow({required this.session, required this.isMentor});
  final Session session;
  final bool isMentor;

  @override
  ConsumerState<_DockRow> createState() => _DockRowState();
}

class _DockRowState extends ConsumerState<_DockRow> {
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

  Future<void> _cancelWithDeflection() async {
    setState(() => _busy = true);
    try {
      await ref.read(sessionsApiProvider).cancel(widget.session.id);
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

  // Mirrors _acceptAndMaybeJoin in session_list_screen.dart. Instant → the
  // mentor drops straight into the call. Scheduled → they pick a concrete
  // 30-min slot first, and the call connects at that slot, not now.
  Future<void> _acceptAndJoin() async {
    final session = widget.session;
    final scheduled = session.requestedFor != null;

    DateTime? confirmedFor;
    if (scheduled) {
      confirmedFor = await showConfirmCallTimeSheet(
        context,
        session: session,
        busy: mentorBusyIntervals(
          ref.read(sessionsListProvider).asData?.value ?? const [],
          excludeSessionId: session.id,
        ),
      );
      if (confirmedFor == null || !mounted) return;
    }

    setState(() => _busy = true);
    try {
      final updated = await ref
          .read(sessionsApiProvider)
          .accept(session.id, confirmedFor: confirmedFor);
      ref.invalidate(sessionsListProvider);
      if (!mounted) return;
      if (confirmedFor == null) {
        context.push('/call/${updated.id}');
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Confirmed for ${friendlyCallTime(confirmedFor)}'),
          ),
        );
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

  // The dock only ever surfaces PENDING/ACCEPTED/RINGING/IN_PROGRESS calls, so
  // the `prompt` style (imperative — "join now", not a status noun) always
  // applies here. Everything about how a session state reads lives in
  // sessionStatusView (session_status.dart).
  String get _statusText => sessionStatusView(
    widget.session,
    isMentor: widget.isMentor,
    style: SessionStatusStyle.prompt,
  ).label;

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    final counterpartName = widget.isMentor
        ? session.aspirantName
        : session.mentorName;
    final counterpartAvatarUrl = widget.isMentor
        ? session.aspirantAvatarUrl
        : session.mentorAvatarUrl;
    final canJoin =
        session.status == SessionStatus.accepted ||
        session.status == SessionStatus.ringing ||
        session.status == SessionStatus.inProgress;

    return Row(
      children: [
        AppAvatar(
          name: counterpartName,
          avatarUrl: counterpartAvatarUrl,
          size: 32,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                counterpartName,
                style: const TextStyle(
                  fontSize: AppFont.xs,
                  fontWeight: AppFont.bold,
                ),
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                _statusText,
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textSecondary,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        if (widget.isMentor && session.status == SessionStatus.pending) ...[
          _DockButton(
            label: 'Reject',
            outlined: true,
            onPressed: _busy
                ? null
                : () => _act(ref.read(sessionsApiProvider).reject),
          ),
          const SizedBox(width: 6),
          _DockButton(
            label: session.requestedFor == null ? 'Accept' : 'Confirm a time',
            busy: _busy,
            onPressed: _busy ? null : _acceptAndJoin,
          ),
        ] else if (canJoin) ...[
          Builder(
            builder: (context) {
              final joinableNow = isScheduledCallJoinableNow(
                session.confirmedFor,
                alreadyLive: session.status == SessionStatus.inProgress,
              );
              return _DockButton(
                label: joinableNow
                    ? 'Join'
                    : friendlyCallTime(session.confirmedFor!),
                onPressed: () {
                  if (!joinableNow) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          'This call is scheduled for '
                          '${friendlyCallTime(session.confirmedFor!)}. '
                          'You can join $kCallEarlyJoinWindowMinutes minutes before.',
                        ),
                      ),
                    );
                    return;
                  }
                  context.push('/call/${session.id}');
                },
              );
            },
          ),
        ] else if (!widget.isMentor &&
            session.status == SessionStatus.pending) ...[
          _DockButton(
            label: 'Cancel',
            outlined: true,
            onPressed: _busy ? null : _cancelWithDeflection,
          ),
        ],
      ],
    );
  }
}

class _DockButton extends StatelessWidget {
  const _DockButton({
    required this.label,
    required this.onPressed,
    this.outlined = false,
    this.busy = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool outlined;
  final bool busy;

  static final _style = FilledButton.styleFrom(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
    minimumSize: Size.zero,
    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
    textStyle: const TextStyle(fontSize: AppFont.xs, fontWeight: AppFont.bold),
  );

  static final _outlinedStyle = OutlinedButton.styleFrom(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
    minimumSize: Size.zero,
    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
    textStyle: const TextStyle(
      fontSize: AppFont.xs,
      fontWeight: AppFont.semibold,
    ),
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

    return outlined
        ? OutlinedButton(
            onPressed: onPressed,
            style: _outlinedStyle,
            child: child,
          )
        : FilledButton(onPressed: onPressed, style: _style, child: child);
  }
}
