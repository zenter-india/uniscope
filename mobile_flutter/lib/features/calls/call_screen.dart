import 'dart:async';

import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/sessions_api.dart';
import '../../core/network/wallet_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';

/// Hand-rolled native channels — see MainActivity.kt for why these bypass
/// the permission_handler plugin. `uniscope/call` drives the Android
/// foreground service that keeps the call alive when backgrounded (see
/// CallForegroundService.kt) and the keep-screen-awake flag.
const _permissionsChannel = MethodChannel('uniscope/permissions');
const _callChannel = MethodChannel('uniscope/call');

/// A session in any of these is over — no token to issue, no join to
/// confirm. Reaching CallScreen with one of these means the call already
/// ended (a late push, a no-show sweep, the other party never joined).
const _terminalStatuses = {
  SessionStatus.completed,
  SessionStatus.rejected,
  SessionStatus.cancelled,
  SessionStatus.expired,
  SessionStatus.failed,
};

enum _Phase {
  requestingPermission,
  permissionDenied,
  connecting,
  waiting,
  active,
  ended,
  error,
}

/// Full lifecycle audio-call screen: mic permission -> join Agora channel ->
/// wait for the other party's dual-confirm (see SessionsService.confirmJoined)
/// -> live call with a slot timer and a +5min continue prompt at cutoff ->
/// ended summary. One screen, one state machine — matches how short-lived
/// and linear this flow actually is; splitting it into separate routes would
/// just mean threading the same session/engine state across screens.
class CallScreen extends ConsumerStatefulWidget {
  const CallScreen({super.key, required this.sessionId});
  final String sessionId;

  @override
  ConsumerState<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends ConsumerState<CallScreen> {
  _Phase _phase = _Phase.requestingPermission;
  String? _errorMessage;
  Session? _session;
  RtcEngine? _engine;
  Timer? _pollTimer;
  Timer? _tickTimer;
  Duration _elapsed = Duration.zero;
  bool _muted = false;
  bool _speakerOn = true;
  bool _remoteJoinedChannel = false;
  bool _extendDialogShowing = false;
  DateTime? _slotExpiredAt;
  Timer? _noAnswerTimer;
  // TEMP DIAGNOSTIC — remove once real-device call testing is confirmed
  // working. Tracks the last status we logged so _poll doesn't spam a line
  // every 2s; only transitions are logged.
  SessionStatus? _lastLoggedStatus;

  bool get _isAspirant =>
      _session != null &&
      ref.read(authControllerProvider).user?.id == _session!.aspirantId;

  /// The other party — a mentor's name/avatar when the aspirant is looking,
  /// and vice versa. Falls back to a generic label before the session loads.
  String get _peerName {
    final s = _session;
    if (s == null) return 'Connecting';
    return _isAspirant ? s.mentorName : s.aspirantName;
  }

  String? get _peerAvatarUrl {
    final s = _session;
    if (s == null) return null;
    return _isAspirant ? s.mentorAvatarUrl : s.aspirantAvatarUrl;
  }

  /// Time left in the booked slot, or null when it can't be computed yet.
  /// Negative once the slot has run out (the "continue?" prompt fires then).
  Duration? get _slotRemaining {
    final s = _session;
    final startedAt = s?.startedAt;
    if (s == null || startedAt == null) return null;
    final slotSeconds =
        (s.billedMinutes > 0 ? s.billedMinutes : (s.callSlotMinutes ?? 0)) * 60;
    if (slotSeconds <= 0) return null;
    return Duration(seconds: slotSeconds) -
        DateTime.now().toUtc().difference(DateTime.parse(startedAt).toUtc());
  }

  bool _callServiceRunning = false;

  @override
  void initState() {
    super.initState();
    // The notification's "End call" action routes back through MainActivity,
    // which calls this method on the channel.
    _callChannel.setMethodCallHandler((call) async {
      if (call.method == 'endCall' && mounted && _phase == _Phase.active) {
        _endCall();
      }
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _tickTimer?.cancel();
    _noAnswerTimer?.cancel();
    _engine?.leaveChannel();
    _engine?.release();
    _stopCallService();
    _callChannel.setMethodCallHandler(null);
    super.dispose();
  }

  /// Foreground service keeps Agora's audio + the call timer alive while the
  /// app is backgrounded, and shows the ongoing-call notification. No-op on
  /// web (native-only) and if already started.
  Future<void> _startCallService() async {
    if (kIsWeb || _callServiceRunning) return;
    final startedAt = _session?.startedAt;
    _callServiceRunning = true;
    try {
      await _callChannel.invokeMethod('startCallService', {
        'peer': _peerName,
        'startedAtMillis': startedAt != null
            ? DateTime.parse(startedAt).millisecondsSinceEpoch
            : DateTime.now().millisecondsSinceEpoch,
      });
      await _callChannel.invokeMethod('keepScreenOn', true);
    } catch (_) {
      // Native side missing (web, or an old build) — the call still works,
      // it just won't survive backgrounding.
    }
  }

  Future<void> _stopCallService() async {
    if (kIsWeb || !_callServiceRunning) return;
    _callServiceRunning = false;
    try {
      await _callChannel.invokeMethod('keepScreenOn', false);
      await _callChannel.invokeMethod('stopCallService');
    } catch (_) {}
  }

  Future<void> _start() async {
    // TEMP DIAGNOSTIC — remove once real-device call testing is confirmed
    // working. sessionId is an opaque id, never a secret/PII.
    debugPrint('[call] CallScreen started sessionId=${widget.sessionId}');

    final granted =
        await _permissionsChannel.invokeMethod<bool>('requestMicrophone') ??
        false;
    debugPrint('[call] microphone permission granted=$granted');
    if (!granted) {
      if (!mounted) return;
      setState(() => _phase = _Phase.permissionDenied);
      return;
    }

    // Best-effort — needed on Android 13+ for the ongoing-call notification
    // to be visible. Never blocks the call.
    try {
      await _permissionsChannel.invokeMethod('requestNotifications');
    } catch (_) {}

    try {
      final api = ref.read(sessionsApiProvider);
      final session = await api.findById(widget.sessionId);
      debugPrint(
        '[call] session fetched sessionId=${widget.sessionId} '
        'type=${session.type} status=${session.status.wire}',
      );
      if (session.type != 'AUDIO_CALL') {
        throw Exception('Not an audio call session');
      }

      // The call may already be over by the time this screen opens — a
      // stale "mentor accepted" push tapped late, or the other party never
      // joined and the no-show sweep / no-answer timeout already closed it.
      // Show the ended summary rather than letting getCallToken 409 into a
      // scary "Could not connect".
      if (_terminalStatuses.contains(session.status)) {
        if (!mounted) return;
        setState(() {
          _session = session;
          _phase = _Phase.ended;
        });
        return;
      }

      setState(() {
        _session = session;
        _phase = _Phase.connecting;
      });

      final creds = await api.getCallToken(widget.sessionId);
      debugPrint(
        '[call] token acquired sessionId=${widget.sessionId} '
        'channel=${creds.channelName} uid=${creds.uid}',
      );
      // Agora's native join has a documented-but-unconfirmed hang risk on
      // some Android builds (see CLAUDE.md's Agora native-call note) — an
      // uncaught native-layer stall here would otherwise leave this screen
      // spinning on _Phase.connecting forever with no error, which looks
      // identical to the "stuck ringing" symptom from the other party's
      // side. A bounded timeout turns a silent hang into a visible error.
      await _joinAgoraChannel(creds).timeout(
        const Duration(seconds: 20),
        onTimeout: () {
          debugPrint(
            '[call] Agora join TIMED OUT after 20s sessionId=${widget.sessionId}',
          );
          throw Exception(
            'Could not connect to the call — check your connection and try again.',
          );
        },
      );
      debugPrint('[call] Agora join completed sessionId=${widget.sessionId}');

      final confirmed = await api.confirmJoined(widget.sessionId);
      debugPrint(
        '[call] confirmJoined sent — server status=${confirmed.status.wire} '
        'sessionId=${widget.sessionId}',
      );
      if (!mounted) return;
      setState(() => _session = confirmed);
      _applySessionUpdate(confirmed);

      _pollTimer = Timer.periodic(const Duration(seconds: 2), (_) => _poll());
    } catch (e) {
      debugPrint('[call] _start FAILED sessionId=${widget.sessionId} — $e');
      if (!mounted) return;
      setState(() {
        _phase = _Phase.error;
        _errorMessage = e.toString();
      });
    }
  }

  Future<void> _joinAgoraChannel(CallCredentials creds) async {
    debugPrint('[call] Agora engine initializing channel=${creds.channelName}');
    final engine = createAgoraRtcEngine();
    await engine.initialize(RtcEngineContext(appId: creds.appId));
    // TEMP DIAGNOSTIC — pinpointing exactly which awaited Agora call hangs on
    // iOS (never confirmed working on this platform before — see CLAUDE.md
    // "Android Agora native-call crash", which this print trail is extending
    // to iOS). Live iOS log showed the join sequence hanging for the full
    // 20s timeout with none of these prints appearing after "initializing" —
    // narrowing which single call it is, rather than the whole sequence.
    debugPrint(
      '[call] Agora engine.initialize() completed channel=${creds.channelName}',
    );
    await engine.enableAudio();
    debugPrint(
      '[call] Agora enableAudio() completed channel=${creds.channelName}',
    );
    await engine.setDefaultAudioRouteToSpeakerphone(true);
    debugPrint(
      '[call] Agora setDefaultAudioRouteToSpeakerphone() completed channel=${creds.channelName}',
    );
    engine.registerEventHandler(
      RtcEngineEventHandler(
        onUserJoined: (connection, remoteUid, elapsed) {
          debugPrint(
            '[call] Agora onUserJoined channel=${creds.channelName} remoteUid=$remoteUid',
          );
          if (mounted) setState(() => _remoteJoinedChannel = true);
        },
        onUserOffline: (connection, remoteUid, reason) {
          debugPrint(
            '[call] Agora onUserOffline channel=${creds.channelName} remoteUid=$remoteUid reason=$reason',
          );
          if (mounted) setState(() => _remoteJoinedChannel = false);
        },
        onError: (err, msg) {
          debugPrint(
            '[call] Agora onError channel=${creds.channelName} err=$err msg=$msg',
          );
        },
      ),
    );
    debugPrint(
      '[call] Agora joinChannelWithUserAccount channel=${creds.channelName} uid=${creds.uid}',
    );
    await engine.joinChannelWithUserAccount(
      token: creds.token,
      channelId: creds.channelName,
      userAccount: creds.uid,
      options: const ChannelMediaOptions(
        channelProfile: ChannelProfileType.channelProfileCommunication,
        clientRoleType: ClientRoleType.clientRoleBroadcaster,
      ),
    );
    _engine = engine;
  }

  Future<void> _poll() async {
    if (!mounted || _phase == _Phase.ended) return;
    try {
      final updated = await ref
          .read(sessionsApiProvider)
          .findById(widget.sessionId);
      if (!mounted) return;
      setState(() => _session = updated);
      _applySessionUpdate(updated);
    } catch (_) {
      // transient network hiccup — next poll tick will retry.
    }
  }

  void _applySessionUpdate(Session session) {
    // TEMP DIAGNOSTIC — remove once real-device call testing is confirmed
    // working. Only logs on an actual status transition, not every poll tick.
    if (session.status != _lastLoggedStatus) {
      debugPrint(
        '[call] status changed ${_lastLoggedStatus?.wire ?? '(none)'} -> '
        '${session.status.wire} sessionId=${widget.sessionId}',
      );
      _lastLoggedStatus = session.status;
    }

    if (_terminalStatuses.contains(session.status)) {
      debugPrint(
        '[call] terminal status=${session.status.wire} endReason=${session.endReason} '
        'sessionId=${widget.sessionId}',
      );
      _endLocally();
      return;
    }

    if (session.status == SessionStatus.inProgress) {
      _noAnswerTimer?.cancel();
      _noAnswerTimer = null;
      if (_phase != _Phase.active) {
        _startCallService();
        setState(() => _phase = _Phase.active);
        _tickTimer ??= Timer.periodic(
          const Duration(seconds: 1),
          (_) => _tick(),
        );
      }
      _checkSlotCutoff(session);
    } else {
      setState(() => _phase = _Phase.waiting);
      // A push failing to deliver (stale token, device offline, permission
      // denied) is exactly the "stuck ringing forever" failure mode the
      // deep-link fix targets on the happy path — this is the fallback for
      // when it still doesn't reach the other party. Only ever started
      // once per call (not per poll tick). 90s, not 45 — the other party
      // realistically needs time to notice the notification, unlock, and
      // tap Join; the backend no-show sweep (half the slot) is the real
      // backstop, this just avoids an indefinite ring if that's far off.
      _noAnswerTimer ??= Timer(const Duration(seconds: 90), _noAnswer);
    }
  }

  void _noAnswer() {
    if (!mounted || _phase != _Phase.waiting) return;
    debugPrint('[call] no-answer timeout (90s) sessionId=${widget.sessionId}');
    _endCall(reason: 'NO_ANSWER');
  }

  void _tick() {
    final startedAt = _session?.startedAt;
    if (startedAt == null || !mounted) return;
    setState(
      () => _elapsed = DateTime.now().toUtc().difference(
        DateTime.parse(startedAt).toUtc(),
      ),
    );
  }

  void _checkSlotCutoff(Session session) {
    final slotSeconds = session.billedMinutes * 60;
    final startedAt = session.startedAt;
    if (startedAt == null || slotSeconds <= 0) return;

    final elapsed = DateTime.now().toUtc().difference(
      DateTime.parse(startedAt).toUtc(),
    );
    final remaining = Duration(seconds: slotSeconds) - elapsed;

    if (remaining.isNegative) {
      _slotExpiredAt ??= DateTime.now();
      if (_isAspirant && !_extendDialogShowing) {
        _extendDialogShowing = true;
        _showExtendDialog();
      }
      // Hard cutoff: if the aspirant hasn't responded within 20s of slot
      // expiry, end the call automatically — see product decision on
      // "hard cut off with a popup to continue".
      final graceElapsed = DateTime.now().difference(_slotExpiredAt!);
      if (_isAspirant &&
          graceElapsed > const Duration(seconds: 20) &&
          _phase == _Phase.active) {
        _endCall(reason: 'SLOT_EXPIRED');
      }
    } else {
      _slotExpiredAt = null;
    }
  }

  Future<void> _showExtendDialog() async {
    if (!mounted) return;
    final continue_ = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Time\'s up'),
        content: Text(
          'Your slot has ended. Continue for another 5 minutes? '
          '${uniminutesLabel(slotUniminutes(5))} will be deducted.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('End Call'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
    _extendDialogShowing = false;
    _slotExpiredAt = null;

    if (!mounted) return;
    if (continue_ == true) {
      try {
        final updated = await ref
            .read(sessionsApiProvider)
            .extendCall(widget.sessionId);
        if (!mounted) return;
        setState(() => _session = updated);
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Could not extend call: $e')));
        _endCall(reason: 'SLOT_EXPIRED');
      }
    } else {
      _endCall(reason: 'SLOT_EXPIRED');
    }
  }

  Future<void> _endCall({String reason = 'NORMAL'}) async {
    debugPrint(
      '[call] endCall requested reason=$reason sessionId=${widget.sessionId}',
    );
    try {
      await ref
          .read(sessionsApiProvider)
          .endCall(widget.sessionId, endReason: reason);
    } catch (e) {
      // Other party may have already ended it — fall through to local end.
      debugPrint(
        '[call] endCall API call failed (other party may have already ended it) — $e '
        'sessionId=${widget.sessionId}',
      );
    }
    _endLocally();
  }

  void _endLocally() {
    debugPrint('[call] ending locally sessionId=${widget.sessionId}');
    _pollTimer?.cancel();
    _tickTimer?.cancel();
    _engine?.leaveChannel();
    _stopCallService();
    if (mounted) setState(() => _phase = _Phase.ended);
  }

  String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop:
          _phase == _Phase.ended ||
          _phase == _Phase.error ||
          _phase == _Phase.permissionDenied,
      child: Scaffold(
        backgroundColor: AppColors.primaryDark,
        body: DecoratedBox(
          // A soft glow high on the screen (behind the avatar) over a
          // top-to-bottom dark-green fade — gives the call surface some
          // depth instead of a flat fill.
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF0C5B46), Color(0xFF063C33)],
            ),
          ),
          child: DecoratedBox(
            decoration: const BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(0, -0.55),
                radius: 0.9,
                colors: [Color(0x66239E75), Color(0x00239E75)],
              ),
            ),
            child: SafeArea(child: _buildBody(context)),
          ),
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    switch (_phase) {
      case _Phase.requestingPermission:
      case _Phase.connecting:
        return const Center(
          child: CircularProgressIndicator(color: Colors.white),
        );
      case _Phase.permissionDenied:
        return _MessageScreen(
          icon: '🎙️',
          title: 'Microphone access needed',
          message: 'Uniscope needs microphone access to make audio calls.',
          actions: [
            FilledButton(
              onPressed: () async {
                await _permissionsChannel.invokeMethod('openAppSettings');
              },
              child: const Text('Open Settings'),
            ),
            TextButton(
              onPressed: () => context.pop(),
              style: TextButton.styleFrom(foregroundColor: Colors.white70),
              child: const Text('Go Back'),
            ),
          ],
        );
      case _Phase.error:
        return _MessageScreen(
          icon: '⚠️',
          title: 'Could not connect',
          message: _errorMessage ?? 'Something went wrong.',
          actions: [
            TextButton(
              onPressed: () => context.pop(),
              style: TextButton.styleFrom(foregroundColor: Colors.white70),
              child: const Text('Go Back'),
            ),
          ],
        );
      case _Phase.waiting:
        return _WaitingView(
          peerName: _peerName,
          peerAvatarUrl: _peerAvatarUrl,
          slotMinutes: _session?.callSlotMinutes,
          remoteJoined: _remoteJoinedChannel,
          onEnd: () => _endCall(),
        );
      case _Phase.active:
        return _ActiveCallView(
          peerName: _peerName,
          peerAvatarUrl: _peerAvatarUrl,
          elapsed: _fmt(_elapsed),
          remaining: _slotRemaining,
          muted: _muted,
          speakerOn: _speakerOn,
          onToggleMute: () async {
            final next = !_muted;
            await _engine?.muteLocalAudioStream(next);
            setState(() => _muted = next);
          },
          onToggleSpeaker: () async {
            final next = !_speakerOn;
            await _engine?.setEnableSpeakerphone(next);
            setState(() => _speakerOn = next);
          },
          onEnd: () => _endCall(),
        );
      case _Phase.ended:
        return _EndedView(
          session: _session,
          peerName: _peerName,
          onDone: () => context.go('/chats'),
        );
    }
  }
}

class _MessageScreen extends StatelessWidget {
  const _MessageScreen({
    required this.icon,
    required this.title,
    required this.message,
    required this.actions,
  });

  final String icon;
  final String title;
  final String message;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(icon, style: const TextStyle(fontSize: 48)),
            const SizedBox(height: AppSpacing.md),
            Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: AppFont.lg,
                fontWeight: AppFont.bold,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: AppFont.sm,
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            ...actions,
          ],
        ),
      ),
    );
  }
}

/// Shared avatar + name + status block, centred, for the call screen's dark
/// background. `solid: true` gives the avatar a full-tone fill + white
/// initials so it reads on the green.
class _CallPeerHeader extends StatelessWidget {
  const _CallPeerHeader({
    required this.name,
    required this.avatarUrl,
    required this.status,
    this.pulsing = false,
  });

  final String name;
  final String? avatarUrl;
  final String status;
  final bool pulsing;

  @override
  Widget build(BuildContext context) {
    Widget avatar = Container(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 30,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: AppAvatar(
        name: name,
        avatarUrl: avatarUrl,
        size: 104,
        solid: true,
      ),
    );
    if (pulsing) {
      avatar = Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
        ),
        child: avatar,
      );
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        avatar,
        const SizedBox(height: AppSpacing.md),
        Text(
          name,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white,
            fontSize: AppFont.lg,
            fontWeight: AppFont.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          status,
          style: const TextStyle(color: Colors.white70, fontSize: AppFont.sm),
        ),
      ],
    );
  }
}

class _WaitingView extends StatelessWidget {
  const _WaitingView({
    required this.peerName,
    required this.peerAvatarUrl,
    required this.slotMinutes,
    required this.remoteJoined,
    required this.onEnd,
  });
  final String peerName;
  final String? peerAvatarUrl;
  final int? slotMinutes;
  final bool remoteJoined;
  final VoidCallback onEnd;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const SizedBox(height: AppSpacing.lg),
        if (slotMinutes != null)
          _CallChip(label: 'Audio call · $slotMinutes min'),
        const Spacer(),
        _CallPeerHeader(
          name: peerName,
          avatarUrl: peerAvatarUrl,
          status: remoteJoined ? 'Connecting…' : 'Ringing…',
          pulsing: true,
        ),
        const Spacer(),
        _EndCallButton(onPressed: onEnd),
        const SizedBox(height: AppSpacing.xxl),
      ],
    );
  }
}

class _ActiveCallView extends StatelessWidget {
  const _ActiveCallView({
    required this.peerName,
    required this.peerAvatarUrl,
    required this.elapsed,
    required this.remaining,
    required this.muted,
    required this.speakerOn,
    required this.onToggleMute,
    required this.onToggleSpeaker,
    required this.onEnd,
  });

  final String peerName;
  final String? peerAvatarUrl;
  final String elapsed;
  final Duration? remaining;
  final bool muted;
  final bool speakerOn;
  final VoidCallback onToggleMute;
  final VoidCallback onToggleSpeaker;
  final VoidCallback onEnd;

  /// "4:48 left" while there's time; "0:12 over" once the slot has run out.
  /// Amber under a minute, red under 20s or overrun.
  (String, Color)? _remainingLabel() {
    final r = remaining;
    if (r == null) return null;
    final secs = r.inSeconds;
    if (secs <= 0) {
      final over = (-secs);
      return ('${over ~/ 60}:${(over % 60).toString().padLeft(2, '0')} over',
          const Color(0xFFF0997B));
    }
    final label = '${secs ~/ 60}:${(secs % 60).toString().padLeft(2, '0')} left';
    if (secs <= 20) return (label, const Color(0xFFF0997B));
    if (secs <= 60) return (label, const Color(0xFFFAC775));
    return (label, Colors.white.withValues(alpha: 0.85));
  }

  @override
  Widget build(BuildContext context) {
    final rem = _remainingLabel();
    return Column(
      children: [
        const SizedBox(height: AppSpacing.lg),
        if (rem != null)
          Text(
            rem.$1,
            style: TextStyle(
              color: rem.$2,
              fontSize: AppFont.sm,
              fontWeight: AppFont.semibold,
            ),
          ),
        const Spacer(),
        _CallPeerHeader(
          name: peerName,
          avatarUrl: peerAvatarUrl,
          status: elapsed,
        ),
        const Spacer(),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _CallControl(
                icon: muted ? Icons.mic_off_rounded : Icons.mic_rounded,
                label: muted ? 'Unmute' : 'Mute',
                active: muted,
                onPressed: onToggleMute,
              ),
              _EndCallButton(onPressed: onEnd),
              _CallControl(
                icon: speakerOn
                    ? Icons.volume_up_rounded
                    : Icons.hearing_rounded,
                label: speakerOn ? 'Speaker' : 'Earpiece',
                active: speakerOn,
                onPressed: onToggleSpeaker,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xxl),
      ],
    );
  }
}

/// Small outlined pill used above the peer header ("Audio call · 6 min").
class _CallChip extends StatelessWidget {
  const _CallChip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.full),
        border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.7),
          fontSize: AppFont.xs,
        ),
      ),
    );
  }
}

/// In-call control: round button with a caption underneath.
class _CallControl extends StatelessWidget {
  const _CallControl({
    required this.icon,
    required this.label,
    required this.active,
    required this.onPressed,
  });
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _RoundIconButton(icon: icon, active: active, onPressed: onPressed),
        const SizedBox(height: 6),
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.7),
            fontSize: AppFont.xs,
          ),
        ),
      ],
    );
  }
}

class _EndedView extends StatelessWidget {
  const _EndedView({
    required this.session,
    required this.peerName,
    required this.onDone,
  });
  final Session? session;
  final String peerName;
  final VoidCallback onDone;

  String _reasonLabel(String? reason) {
    switch (reason) {
      case 'SLOT_EXPIRED':
        return 'Slot ended';
      case 'CANCELLED':
        return 'Cancelled';
      case 'REJECTED':
        return 'Declined';
      case 'NO_ANSWER':
        return 'No answer';
      default:
        return 'Call ended';
    }
  }

  @override
  Widget build(BuildContext context) {
    final minutes = session?.billedMinutes ?? 0;
    final spent = minorToUniminutes(session?.totalCostMinor ?? 0);

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.14),
              ),
              alignment: Alignment.center,
              child: const Icon(Icons.call_end_rounded,
                  color: Colors.white, size: 32),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              _reasonLabel(session?.endReason),
              style: const TextStyle(
                color: Colors.white,
                fontSize: AppFont.xl,
                fontWeight: AppFont.bold,
              ),
            ),
            if (peerName != 'Connecting') ...[
              const SizedBox(height: 4),
              Text(
                'with $peerName',
                style: const TextStyle(
                    color: Colors.white70, fontSize: AppFont.sm),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            _SummaryRow(label: 'Duration', value: '$minutes min'),
            const SizedBox(height: AppSpacing.sm),
            _SummaryRow(label: 'Used', value: uniminutesLabel(spent)),
            const SizedBox(height: AppSpacing.xxl),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                ),
                onPressed: onDone,
                child: const Text('Done'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70)),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: AppFont.semibold,
          ),
        ),
      ],
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({
    required this.icon,
    required this.active,
    required this.onPressed,
  });
  final IconData icon;
  final bool active;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onPressed,
      customBorder: const CircleBorder(),
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: active ? Colors.white : Colors.white24,
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: active ? AppColors.primaryDark : Colors.white),
      ),
    );
  }
}

class _EndCallButton extends StatelessWidget {
  const _EndCallButton({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onPressed,
      customBorder: const CircleBorder(),
      child: Container(
        width: 64,
        height: 64,
        decoration: const BoxDecoration(
          color: AppColors.error,
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.call_end, color: Colors.white, size: 28),
      ),
    );
  }
}
