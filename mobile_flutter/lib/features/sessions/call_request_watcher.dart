import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/sessions_api.dart';
import '../../state/auth_controller.dart';
import 'session_list_screen.dart' show sessionsListProvider;

/// Invisible widget mounted in the shell. While the current user has an
/// outstanding AUDIO_CALL (request pending / accepted / ringing) it polls
/// the sessions list every few seconds, and — for the aspirant who made the
/// request — navigates straight into `/call/:id` the moment the mentor
/// accepts.
///
/// This is the stand-in for a real incoming-call push: FCM delivery isn't
/// set up for this project yet (`google-services.json` is still a
/// placeholder), so without this the aspirant just gets a snackbar and has
/// to find the Sessions tab and tap "Join Call" before the mentor's client
/// times out. Polling only runs while a call is actually outstanding, so
/// the steady-state cost is nothing.
class CallRequestWatcher extends ConsumerStatefulWidget {
  const CallRequestWatcher({super.key});

  @override
  ConsumerState<CallRequestWatcher> createState() => _CallRequestWatcherState();
}

class _CallRequestWatcherState extends ConsumerState<CallRequestWatcher> {
  Timer? _poll;
  final _navigatedFor = <String>{};

  static const _outstanding = {
    SessionStatus.pending,
    SessionStatus.accepted,
    SessionStatus.ringing,
  };

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final myId = auth.user?.id;
    final isAspirant = auth.user?.role == UserRole.aspirant;
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

    if (mine.isEmpty) {
      _poll?.cancel();
      _poll = null;
    } else {
      _poll ??= Timer.periodic(
        const Duration(seconds: 4),
        (_) => ref.invalidate(sessionsListProvider),
      );
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
