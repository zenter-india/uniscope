import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/sessions_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import 'cancel_deflection_sheet.dart';
import 'session_list_screen.dart' show sessionsListProvider;

/// Persistent band above the bottom nav, visible on every tab, surfacing
/// any audio-call session that needs attention right now — request pending
/// mentor acceptance, mentor decision needed, or ready to join. This is
/// what actually closes the "stuck on ringing" failure mode: previously
/// both sides only reached /call/:id by separately remembering to open
/// Messages and tap in, which is why real-world calls never connected.
///
/// Chat sessions never appear here — chat opens instantly with no waiting
/// period, so there's nothing to keep surfaced.
class ActiveSessionDock extends ConsumerWidget {
  const ActiveSessionDock({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionsAsync = ref.watch(sessionsListProvider);
    final myUserId = ref.watch(authControllerProvider).user?.id;

    final sessions = sessionsAsync.asData?.value ?? const <Session>[];
    final active = sessions
        .where(
          (s) =>
              s.type == 'AUDIO_CALL' &&
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

  // Mirrors _acceptAndMaybeJoin in session_list_screen.dart — a mentor
  // accepting from the dock is already in the app right now, so send them
  // straight into the call instead of making them find "Join Call" again.
  Future<void> _acceptAndJoin() async {
    setState(() => _busy = true);
    try {
      final updated = await ref
          .read(sessionsApiProvider)
          .accept(widget.session.id);
      ref.invalidate(sessionsListProvider);
      if (!mounted) return;
      context.push('/call/${updated.id}');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String get _statusText {
    final session = widget.session;
    if (widget.isMentor) {
      switch (session.status) {
        case SessionStatus.pending:
          return 'New call request';
        case SessionStatus.accepted:
          return 'Accepted — ready to call';
        case SessionStatus.ringing:
        case SessionStatus.inProgress:
          return 'Call in progress';
        default:
          return session.status.wire;
      }
    }
    switch (session.status) {
      case SessionStatus.pending:
        return 'Waiting for mentor to accept';
      case SessionStatus.accepted:
        return 'Mentor is ready — join now';
      case SessionStatus.ringing:
        return 'Call connecting…';
      case SessionStatus.inProgress:
        return 'Call in progress';
      default:
        return session.status.wire;
    }
  }

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
            label: 'Accept',
            busy: _busy,
            onPressed: _busy ? null : _acceptAndJoin,
          ),
        ] else if (canJoin) ...[
          _DockButton(
            label: 'Join',
            onPressed: () => context.push('/call/${session.id}'),
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
