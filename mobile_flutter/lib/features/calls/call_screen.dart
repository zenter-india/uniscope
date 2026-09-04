import 'dart:async';

import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/reports_api.dart';
import '../../core/network/sessions_api.dart';
import '../../core/network/wallet_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import '../reports/report_sheet.dart';
import '../sessions/rate_mentor_sheet.dart';

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
  // Live call-quality signals from the Agora engine (see _joinAgoraChannel's
  // event handler). _reconnecting flips true on a dropped connection and
  // back on rejoin; _peerMuted mirrors the other party's mic; _weakSignal
  // is set from onNetworkQuality.
  bool _reconnecting = false;
  bool _peerMuted = false;
  bool _weakSignal = false;
  bool _connectHapticDone = false;
  // Set from Agora's onAudioVolumeIndication — true while the other party's
  // mic level is above a small floor, so the avatar can show a "speaking"
  // glow (the main "is this call actually live" signal).
  bool _peerSpeaking = false;
  // Agora AudioRoute int (see onAudioRoutingChanged). 4 = loudspeaker, the
  // default we set on join. _btSeen latches once a Bluetooth route has been
  // reported, so the picker can offer it.
  int _audioRoute = 4;
  bool _btSeen = false;
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
      await _callChannel.invokeMethod('setProximityScreenOff', true);
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
      await _callChannel.invokeMethod('setProximityScreenOff', false);
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
    // Drives the "speaking" glow on the peer avatar. 250ms is responsive
    // without being jittery; reportVad isn't needed (we only look at level).
    await engine.enableAudioVolumeIndication(
      interval: 250,
      smooth: 3,
      reportVad: false,
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
        onUserMuteAudio: (connection, remoteUid, muted) {
          if (mounted) setState(() => _peerMuted = muted);
        },
        onAudioVolumeIndication:
            (connection, speakers, speakerNumber, totalVolume) {
          // uid 0 = the local mic; anything else is the remote party.
          final peerLoud = speakers.any(
            (s) => (s.uid ?? 0) != 0 && (s.volume ?? 0) > 20,
          );
          if (mounted && peerLoud != _peerSpeaking) {
            setState(() => _peerSpeaking = peerLoud);
          }
        },
        onConnectionStateChanged: (connection, state, reason) {
          debugPrint('[call] Agora connState=$state reason=$reason');
          if (!mounted) return;
          setState(() {
            _reconnecting =
                state == ConnectionStateType.connectionStateReconnecting ||
                state == ConnectionStateType.connectionStateConnecting;
          });
        },
        onRejoinChannelSuccess: (connection, elapsed) {
          if (mounted) setState(() => _reconnecting = false);
        },
        onAudioRoutingChanged: (routing) {
          if (!mounted) return;
          setState(() {
            _audioRoute = routing;
            if (routing == 5 || routing == 10) _btSeen = true;
            _speakerOn = routing == 3 || routing == 4;
          });
        },
        onNetworkQuality: (connection, remoteUid, txQuality, rxQuality) {
          // rxQuality is the more useful "how well am I hearing them" number.
          final bad = {
            QualityType.qualityPoor,
            QualityType.qualityBad,
            QualityType.qualityVbad,
            QualityType.qualityDown,
          };
          final weak = bad.contains(rxQuality) || bad.contains(txQuality);
          if (mounted && weak != _weakSignal) {
            setState(() => _weakSignal = weak);
          }
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
        if (!_connectHapticDone) {
          _connectHapticDone = true;
          HapticFeedback.mediumImpact();
        }
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

  (IconData, String) _routeGlyph() {
    switch (_audioRoute) {
      case 0:
      case 2:
        return (Icons.headset_rounded, 'Headset');
      case 1:
        return (Icons.hearing_rounded, 'Earpiece');
      case 5:
      case 10:
        return (Icons.bluetooth_audio_rounded, 'Bluetooth');
      default:
        return (Icons.volume_up_rounded, 'Speaker');
    }
  }

  Future<void> _pickAudioRoute() async {
    HapticFeedback.selectionClick();
    Future<void> set(bool speaker) async {
      Navigator.of(context).pop();
      await _engine?.setEnableSpeakerphone(speaker);
      if (mounted) setState(() => _speakerOn = speaker);
    }

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.volume_up_rounded),
              title: const Text('Speaker'),
              trailing: (_audioRoute == 3 || _audioRoute == 4)
                  ? const Icon(Icons.check_rounded, color: AppColors.primary)
                  : null,
              onTap: () => set(true),
            ),
            ListTile(
              leading: const Icon(Icons.hearing_rounded),
              title: const Text('Earpiece'),
              trailing: _audioRoute == 1
                  ? const Icon(Icons.check_rounded, color: AppColors.primary)
                  : null,
              onTap: () => set(false),
            ),
            if (_btSeen)
              ListTile(
                leading: const Icon(Icons.bluetooth_audio_rounded),
                title: const Text('Bluetooth'),
                trailing: (_audioRoute == 5 || _audioRoute == 10)
                    ? const Icon(Icons.check_rounded, color: AppColors.primary)
                    : null,
                // Agora routes to a connected BT headset once the
                // loudspeaker is off.
                onTap: () => set(false),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _endCall({String reason = 'NORMAL'}) async {
    HapticFeedback.heavyImpact();
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
        return _ConnectingView(
          peerName: _session == null ? null : _peerName,
          peerAvatarUrl: _peerAvatarUrl,
          status: 'Starting call…',
        );
      case _Phase.connecting:
        return _ConnectingView(
          peerName: _peerName,
          peerAvatarUrl: _peerAvatarUrl,
          status: 'Connecting…',
        );
      case _Phase.permissionDenied:
        return _MessageScreen(
          glyph: Icons.mic_off_rounded,
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
          glyph: Icons.wifi_off_rounded,
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
          reconnecting: _reconnecting,
          weakSignal: _weakSignal,
          peerMuted: _peerMuted,
          peerSpeaking: _peerSpeaking && !_peerMuted && !_reconnecting,
          routeIcon: _routeGlyph().$1,
          routeLabel: _routeGlyph().$2,
          onToggleMute: () async {
            HapticFeedback.selectionClick();
            final next = !_muted;
            await _engine?.muteLocalAudioStream(next);
            setState(() => _muted = next);
          },
          onPickRoute: _pickAudioRoute,
          onEnd: () => _endCall(),
        );
      case _Phase.ended:
        final s = _session;
        final completed = s?.status == SessionStatus.completed;
        return _EndedView(
          session: s,
          peerName: _peerName,
          // Aspirant rates the mentor after a real (completed) call.
          onRate: (completed && _isAspirant && s != null)
              ? () => showRateMentorSheet(context, sessionId: s.id)
              : null,
          // Either party can report the other.
          onReport: s == null
              ? null
              : () => showReportSheet(
                    context,
                    ref,
                    targetType: ReportTargetType.user,
                    targetId: _isAspirant ? s.mentorId : s.aspirantId,
                    targetLabel: _peerName,
                  ),
          onDone: () => context.go('/chats'),
        );
    }
  }
}

/// Bottom padding under the control row — clears the gesture nav pill
/// without the arbitrary `xxl` the layout used before.
const double _kCallBottomPad = 36;

class _MessageScreen extends StatelessWidget {
  const _MessageScreen({
    required this.glyph,
    required this.title,
    required this.message,
    required this.actions,
  });

  final IconData glyph;
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
            _GlyphBadge(icon: glyph),
            const SizedBox(height: AppSpacing.lg),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: AppFont.xl,
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
                height: 1.4,
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            for (var i = 0; i < actions.length; i++) ...[
              if (i > 0) const SizedBox(height: AppSpacing.sm),
              SizedBox(width: double.infinity, child: actions[i]),
            ],
          ],
        ),
      ),
    );
  }
}

/// A round translucent icon badge — the shared "hero" mark for the
/// message, connecting, and ended states so they feel like one screen.
class _GlyphBadge extends StatelessWidget {
  const _GlyphBadge({required this.icon});
  final IconData icon;
  static const double size = 76;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withValues(alpha: 0.12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
      ),
      alignment: Alignment.center,
      child: Icon(icon, color: Colors.white, size: size * 0.42),
    );
  }
}

/// The shared call layout: a centred peer block sitting in the upper
/// third, an optional status pill above it, and a control row pinned to
/// the bottom. Every live phase (connecting / ringing / active) uses this
/// so the avatar never jumps between states.
class _CallStage extends StatelessWidget {
  const _CallStage({
    required this.peerName,
    required this.peerAvatarUrl,
    required this.status,
    required this.controls,
    this.topPill,
    this.pulsing = false,
    this.speaking = false,
  });

  final String peerName;
  final String? peerAvatarUrl;
  final String status;
  final Widget? topPill;
  final bool pulsing;
  final bool speaking;
  final List<Widget> controls;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const SizedBox(height: AppSpacing.md),
        SizedBox(height: 34, child: Center(child: topPill)),
        const SizedBox(height: AppSpacing.xl),
        _CallPeerHeader(
          name: peerName,
          avatarUrl: peerAvatarUrl,
          status: status,
          pulsing: pulsing,
          speaking: speaking,
        ),
        const Spacer(),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: controls,
          ),
        ),
        const SizedBox(height: _kCallBottomPad),
      ],
    );
  }
}

/// Shared avatar + name + status block, centred, for the call screen's dark
/// background. `solid: true` gives the avatar a full-tone fill + white
/// initials so it reads on the green. When `pulsing`, an expanding ring
/// radiates from the avatar (skipped under reduce-motion).
class _CallPeerHeader extends StatefulWidget {
  const _CallPeerHeader({
    required this.name,
    required this.avatarUrl,
    required this.status,
    this.pulsing = false,
    this.speaking = false,
  });

  final String name;
  final String? avatarUrl;
  final String status;
  final bool pulsing;

  /// The other party's mic is live right now — the avatar gets a soft
  /// green halo + a barely-there scale-up so a working call never looks
  /// frozen.
  final bool speaking;

  @override
  State<_CallPeerHeader> createState() => _CallPeerHeaderState();
}

class _CallPeerHeaderState extends State<_CallPeerHeader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2200),
  );

  @override
  void didUpdateWidget(_CallPeerHeader old) {
    super.didUpdateWidget(old);
    _syncAnim();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncAnim();
  }

  void _syncAnim() {
    final animate = widget.pulsing &&
        !MediaQuery.of(context).disableAnimations;
    if (animate && !_c.isAnimating) {
      _c.repeat();
    } else if (!animate && _c.isAnimating) {
      _c.stop();
      _c.value = 0;
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    Widget avatar = AnimatedScale(
      scale: widget.speaking ? 1.04 : 1.0,
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: [
            const BoxShadow(
              color: Color(0x59000000),
              blurRadius: 30,
              offset: Offset(0, 12),
            ),
            if (widget.speaking)
              BoxShadow(
                color: const Color(0xFF3BD69B).withValues(alpha: 0.55),
                blurRadius: 26,
                spreadRadius: 3,
              ),
          ],
        ),
        child: AppAvatar(
          name: widget.name,
          avatarUrl: widget.avatarUrl,
          size: 104,
          solid: true,
        ),
      ),
    );
    if (widget.pulsing) {
      avatar = SizedBox(
        width: 148,
        height: 148,
        child: Stack(
          alignment: Alignment.center,
          children: [
            AnimatedBuilder(
              animation: _c,
              builder: (_, __) {
                final t = _c.value;
                return Container(
                  width: 112 + 36 * t,
                  height: 112 + 36 * t,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.22 * (1 - t)),
                      width: 2,
                    ),
                  ),
                );
              },
            ),
            avatar,
          ],
        ),
      );
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        avatar,
        const SizedBox(height: AppSpacing.lg),
        Text(
          widget.name,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white,
            fontSize: AppFont.xxl,
            fontWeight: AppFont.bold,
            letterSpacing: -0.2,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          widget.status,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.72),
            fontSize: AppFont.sm,
            fontWeight: AppFont.medium,
            letterSpacing: 0.2,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}

/// Pre-join phase — mic permission granted, fetching the token / joining
/// Agora. Shows the peer block so the screen doesn't flash a bare spinner.
class _ConnectingView extends StatelessWidget {
  const _ConnectingView({
    required this.peerName,
    required this.peerAvatarUrl,
    required this.status,
  });
  final String? peerName;
  final String? peerAvatarUrl;
  final String status;

  @override
  Widget build(BuildContext context) {
    return _CallStage(
      peerName: peerName ?? 'Audio call',
      peerAvatarUrl: peerAvatarUrl,
      status: status,
      pulsing: true,
      topPill: const _StatusPill(text: 'Please wait'),
      controls: const [],
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
    return _CallStage(
      peerName: peerName,
      peerAvatarUrl: peerAvatarUrl,
      status: remoteJoined ? 'Connecting…' : 'Ringing…',
      pulsing: true,
      topPill: slotMinutes == null
          ? null
          : _StatusPill(
              icon: Icons.call_rounded,
              text: 'Audio call · $slotMinutes min',
            ),
      controls: [
        _CallControl(
          icon: Icons.call_end_rounded,
          label: 'Cancel',
          onPressed: onEnd,
          danger: true,
          big: true,
        ),
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
    required this.reconnecting,
    required this.weakSignal,
    required this.peerMuted,
    required this.peerSpeaking,
    required this.routeIcon,
    required this.routeLabel,
    required this.onToggleMute,
    required this.onPickRoute,
    required this.onEnd,
  });

  final String peerName;
  final String? peerAvatarUrl;
  final String elapsed;
  final Duration? remaining;
  final bool muted;
  final bool speakerOn;
  final bool reconnecting;
  final bool weakSignal;
  final bool peerMuted;
  final bool peerSpeaking;
  final IconData routeIcon;
  final String routeLabel;
  final VoidCallback onToggleMute;
  final VoidCallback onPickRoute;
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
    final status = peerMuted && !reconnecting
        ? '$elapsed  ·  $peerName is muted'
        : elapsed;

    // One pill above the avatar, by priority: a live connection problem
    // outranks the countdown.
    Widget? pill;
    if (reconnecting) {
      pill = const _StatusPill(
        icon: Icons.sync_rounded,
        text: 'Reconnecting…',
        tone: Color(0xFFFAC775),
      );
    } else if (weakSignal) {
      pill = const _StatusPill(
        icon: Icons.signal_cellular_alt_2_bar_rounded,
        text: 'Weak signal',
        tone: Color(0xFFFAC775),
      );
    } else if (rem != null) {
      pill = _StatusPill(
        icon: Icons.schedule_rounded,
        text: rem.$1,
        tone: rem.$2,
      );
    }

    return _CallStage(
      peerName: peerName,
      peerAvatarUrl: peerAvatarUrl,
      status: status,
      topPill: pill,
      speaking: peerSpeaking,
      controls: [
        _CallControl(
          icon: muted ? Icons.mic_off_rounded : Icons.mic_rounded,
          label: muted ? 'Unmute' : 'Mute',
          active: muted,
          onPressed: onToggleMute,
        ),
        _CallControl(
          icon: Icons.call_end_rounded,
          label: 'End',
          onPressed: onEnd,
          danger: true,
          big: true,
        ),
        _CallControl(
          icon: routeIcon,
          label: routeLabel,
          active: speakerOn,
          onPressed: onPickRoute,
        ),
      ],
    );
  }
}

/// Rounded status pill above the peer header. Neutral by default; pass
/// [tone] for a coloured state (amber signal warning, red countdown).
class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.text, this.icon, this.tone});
  final String text;
  final IconData? icon;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final fg = tone ?? Colors.white.withValues(alpha: 0.8);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.full),
        color: (tone ?? Colors.white).withValues(alpha: tone == null ? 0.10 : 0.16),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: fg),
            const SizedBox(width: 5),
          ],
          Text(
            text,
            style: TextStyle(
              color: fg,
              fontSize: AppFont.xs,
              fontWeight: AppFont.semibold,
              letterSpacing: 0.2,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

/// In-call control: round button with a caption underneath. [big] +
/// [danger] make the end-call button, kept in the same row so all three
/// controls share a baseline instead of the end button floating alone.
class _CallControl extends StatelessWidget {
  const _CallControl({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.active = false,
    this.danger = false,
    this.big = false,
  });
  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final bool active;
  final bool danger;
  final bool big;

  @override
  Widget build(BuildContext context) {
    final size = big ? 66.0 : 58.0;
    final Color bg;
    final Color fg;
    if (danger) {
      bg = AppColors.error;
      fg = Colors.white;
    } else if (active) {
      bg = Colors.white;
      fg = AppColors.primaryDark;
    } else {
      bg = Colors.white.withValues(alpha: 0.14);
      fg = Colors.white;
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        InkWell(
          onTap: onPressed,
          customBorder: const CircleBorder(),
          child: Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              color: bg,
              shape: BoxShape.circle,
              border: (!danger && !active)
                  ? Border.all(color: Colors.white.withValues(alpha: 0.16))
                  : null,
              boxShadow: danger
                  ? [
                      BoxShadow(
                        color: AppColors.error.withValues(alpha: 0.4),
                        blurRadius: 22,
                        offset: const Offset(0, 8),
                      ),
                    ]
                  : null,
            ),
            child: Icon(icon, color: fg, size: big ? 30 : 25),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.72),
            fontSize: AppFont.xs,
            fontWeight: AppFont.medium,
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
    this.onRate,
    this.onReport,
  });
  final Session? session;
  final String peerName;
  final VoidCallback onDone;
  final VoidCallback? onRate;
  final VoidCallback? onReport;

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

    final showSummary = minutes > 0 || spent > 0;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const _GlyphBadge(icon: Icons.call_end_rounded),
            const SizedBox(height: AppSpacing.lg),
            Text(
              _reasonLabel(session?.endReason),
              textAlign: TextAlign.center,
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
            if (showSummary) ...[
              const SizedBox(height: AppSpacing.xl),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                ),
                child: Column(
                  children: [
                    _SummaryRow(label: 'Duration', value: '$minutes min'),
                    const SizedBox(height: AppSpacing.sm),
                    _SummaryRow(
                        label: 'Used', value: uniminutesLabel(spent)),
                  ],
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.xl),
            if (onRate != null)
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.primaryDark,
                  ),
                  onPressed: onRate,
                  icon: const Icon(Icons.star_rounded, size: 18),
                  label: const Text('Rate this call'),
                ),
              ),
            if (onRate != null) const SizedBox(height: AppSpacing.sm),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: onRate != null
                      ? Colors.white24
                      : AppColors.primary,
                ),
                onPressed: onDone,
                child: const Text('Done'),
              ),
            ),
            if (onReport != null) ...[
              const SizedBox(height: AppSpacing.sm),
              TextButton(
                onPressed: onReport,
                style: TextButton.styleFrom(foregroundColor: Colors.white70),
                child: const Text('Report a problem'),
              ),
            ],
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

