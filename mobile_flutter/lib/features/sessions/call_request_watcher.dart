import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/sessions_api.dart';
import '../../state/auth_controller.dart';
import 'session_list_screen.dart' show sessionsListProvider;

/// Invisible widget mounted in the shell. Two jobs, both standing in for a
/// real incoming-call push (FCM isn't set up — `google-services.json` is
/// still a placeholder, so no device registers a token):
///
///  - A **mentor** with the app open polls the sessions list every 10s so a
///    brand-new call request surfaces on its own (the "New call request"
///    dock banner would otherwise only appear on a manual refresh).
///  - An **aspirant** who has an outstanding request polls every 4s and is
///    navigated straight into `/call/:id` the moment the mentor accepts —
///    no "Join Call" tap, no waiting for a push that never comes.
///
/// Polling stops when there's nothing to watch (aspirant with no
/// outstanding call, or a mentor who backgrounds the app), so the
/// steady-state cost is nothing.
class CallRequestWatcher extends ConsumerStatefulWidget {
  const CallRequestWatcher({super.key});

  @override
  ConsumerState<CallRequestWatcher> createState() => _CallRequestWatcherState();
}

class _CallRequestWatcherState extends ConsumerState<CallRequestWatcher>
    with WidgetsBindingObserver {
  Timer? _poll;
  Duration? _pollEvery;
  final _navigatedFor = <String>{};
  bool _foreground = true;

  static const _outstanding = {
    SessionStatus.pending,
    SessionStatus.accepted,
    SessionStatus.ringing,
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _poll?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final fg = state == AppLifecycleState.resumed;
    if (fg != _foreground && mounted) setState(() => _foreground = fg);
  }

  /// Restart the poll timer only when the interval actually changes.
  void _setPoll(Duration? every) {
    if (every == _pollEvery) return;
    _pollEvery = every;
    _poll?.cancel();
    _poll = every == null
        ? null
        : Timer.periodic(every, (_) => ref.invalidate(sessionsListProvider));
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final myId = auth.user?.id;
    final role = auth.user?.role;
    final isAspirant = role == UserRole.aspirant;
    final isMentor = role == UserRole.mentor;
    final sessions =
        ref.watch(sessionsListProvider).asData?.value ?? const <Session>[];

    final mine = sessions
        .where(
          (s) =>
              s.type == 'AUDIO_CALL' &&
              _outstanding.contains(s.status) &&
              (s.aspirantId == myId || s.mentorId == myId),
        )
        .toList();

    // Fast poll while a call is in flight; a slow mentor heartbeat so a new
    // request appears without a manual refresh; nothing otherwise.
    if (!_foreground || myId == null) {
      _setPoll(null);
    } else if (mine.isNotEmpty) {
      _setPoll(const Duration(seconds: 4));
    } else if (isMentor) {
      _setPoll(const Duration(seconds: 10));
    } else {
      _setPoll(null);
    }

    if (isAspirant) {
      for (final s in mine) {
        // Mentor accepted and this client hasn't already been sent in.
        if (s.status == SessionStatus.accepted &&
            s.aspirantJoinedAt == null &&
            _navigatedFor.add(s.id)) {
          final id = s.id;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) context.push('/call/$id');
          });
        }
      }
    }

    return const SizedBox.shrink();
  }
}
