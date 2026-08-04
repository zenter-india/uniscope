import 'dart:async';

import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/sessions_api.dart';
import '../../core/network/wallet_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';

/// Hand-rolled native channel — see MainActivity.kt for why this bypasses
/// the permission_handler plugin.
const _permissionsChannel = MethodChannel('uniscope/permissions');

enum _Phase { requestingPermission, permissionDenied, connecting, waiting, active, ended, error }

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

  bool get _isAspirant =>
      _session != null && ref.read(authControllerProvider).user?.id == _session!.aspirantId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _tickTimer?.cancel();
    _noAnswerTimer?.cancel();
    _engine?.leaveChannel();
    _engine?.release();
    super.dispose();
  }

  Future<void> _start() async {
    final granted =
        await _permissionsChannel.invokeMethod<bool>('requestMicrophone') ?? false;
    if (!granted) {
      if (!mounted) return;
      setState(() => _phase = _Phase.permissionDenied);
      return;
    }

    try {
      final api = ref.read(sessionsApiProvider);
      final session = await api.findById(widget.sessionId);
      if (session.type != 'AUDIO_CALL') {
        throw Exception('Not an audio call session');
      }
      setState(() {
        _session = session;
        _phase = _Phase.connecting;
      });

      final creds = await api.getCallToken(widget.sessionId);
      // Agora's native join has a documented-but-unconfirmed hang risk on
      // some Android builds (see CLAUDE.md's Agora native-call note) — an
      // uncaught native-layer stall here would otherwise leave this screen
      // spinning on _Phase.connecting forever with no error, which looks
      // identical to the "stuck ringing" symptom from the other party's
      // side. A bounded timeout turns a silent hang into a visible error.
      await _joinAgoraChannel(creds).timeout(
        const Duration(seconds: 20),
        onTimeout: () => throw Exception(
          'Could not connect to the call — check your connection and try again.',
        ),
      );

      final confirmed = await api.confirmJoined(widget.sessionId);
      if (!mounted) return;
      setState(() => _session = confirmed);
      _applySessionUpdate(confirmed);

      _pollTimer = Timer.periodic(const Duration(seconds: 2), (_) => _poll());
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _phase = _Phase.error;
        _errorMessage = e.toString();
      });
    }
  }

  Future<void> _joinAgoraChannel(CallCredentials creds) async {
    final engine = createAgoraRtcEngine();
    await engine.initialize(RtcEngineContext(appId: creds.appId));
    await engine.enableAudio();
    await engine.setDefaultAudioRouteToSpeakerphone(true);
    engine.registerEventHandler(
      RtcEngineEventHandler(
        onUserJoined: (connection, remoteUid, elapsed) {
          if (mounted) setState(() => _remoteJoinedChannel = true);
        },
        onUserOffline: (connection, remoteUid, reason) {
          if (mounted) setState(() => _remoteJoinedChannel = false);
        },
      ),
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
      final updated = await ref.read(sessionsApiProvider).findById(widget.sessionId);
      if (!mounted) return;
      setState(() => _session = updated);
      _applySessionUpdate(updated);
    } catch (_) {
      // transient network hiccup — next poll tick will retry.
    }
  }

  void _applySessionUpdate(Session session) {
    const terminal = {
      SessionStatus.completed,
      SessionStatus.rejected,
      SessionStatus.cancelled,
      SessionStatus.expired,
      SessionStatus.failed,
    };
    if (terminal.contains(session.status)) {
      _endLocally();
      return;
    }

    if (session.status == SessionStatus.inProgress) {
      _noAnswerTimer?.cancel();
      _noAnswerTimer = null;
      if (_phase != _Phase.active) {
        setState(() => _phase = _Phase.active);
        _tickTimer ??= Timer.periodic(const Duration(seconds: 1), (_) => _tick());
      }
      _checkSlotCutoff(session);
    } else {
      setState(() => _phase = _Phase.waiting);
      // A push failing to deliver (stale token, device offline, permission
      // denied) is exactly the "stuck ringing forever" failure mode the
      // deep-link fix targets on the happy path — this is the fallback for
      // when it still doesn't reach the other party. Only ever started
      // once per call (not per poll tick).
      _noAnswerTimer ??= Timer(const Duration(seconds: 45), _noAnswer);
    }
  }

  void _noAnswer() {
    if (!mounted || _phase != _Phase.waiting) return;
    _endCall(reason: 'NO_ANSWER');
  }

  void _tick() {
    final startedAt = _session?.startedAt;
    if (startedAt == null || !mounted) return;
    setState(() => _elapsed = DateTime.now().toUtc().difference(DateTime.parse(startedAt).toUtc()));
  }

  void _checkSlotCutoff(Session session) {
    final slotSeconds = session.billedMinutes * 60;
    final startedAt = session.startedAt;
    if (startedAt == null || slotSeconds <= 0) return;

    final elapsed = DateTime.now().toUtc().difference(DateTime.parse(startedAt).toUtc());
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
      if (_isAspirant && graceElapsed > const Duration(seconds: 20) && _phase == _Phase.active) {
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
        final updated = await ref.read(sessionsApiProvider).extendCall(widget.sessionId);
        if (!mounted) return;
        setState(() => _session = updated);
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Could not extend call: $e')));
        _endCall(reason: 'SLOT_EXPIRED');
      }
    } else {
      _endCall(reason: 'SLOT_EXPIRED');
    }
  }

  Future<void> _endCall({String reason = 'NORMAL'}) async {
    try {
      await ref.read(sessionsApiProvider).endCall(widget.sessionId, endReason: reason);
    } catch (_) {
      // Other party may have already ended it — fall through to local end.
    }
    _endLocally();
  }

  void _endLocally() {
    _pollTimer?.cancel();
    _tickTimer?.cancel();
    _engine?.leaveChannel();
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
      canPop: _phase == _Phase.ended || _phase == _Phase.error || _phase == _Phase.permissionDenied,
      child: Scaffold(
        backgroundColor: AppColors.primaryDark,
        body: SafeArea(child: _buildBody(context)),
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
        return _WaitingView(remoteJoined: _remoteJoinedChannel, onEnd: () => _endCall());
      case _Phase.active:
        return _ActiveCallView(
          elapsed: _fmt(_elapsed),
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
        return _EndedView(session: _session, onDone: () => context.go('/chats'));
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
            Text(title,
                style: const TextStyle(
                    color: Colors.white, fontSize: AppFont.lg, fontWeight: AppFont.bold)),
            const SizedBox(height: AppSpacing.sm),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70, fontSize: AppFont.sm)),
            const SizedBox(height: AppSpacing.xl),
            ...actions,
          ],
        ),
      ),
    );
  }
}

class _WaitingView extends StatelessWidget {
  const _WaitingView({required this.remoteJoined, required this.onEnd});
  final bool remoteJoined;
  final VoidCallback onEnd;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 96,
          height: 96,
          decoration: const BoxDecoration(color: Colors.white24, shape: BoxShape.circle),
          alignment: Alignment.center,
          child: const Text('👤', style: TextStyle(fontSize: 40)),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(
          remoteJoined ? 'Connecting call…' : 'Calling…',
          style: const TextStyle(color: Colors.white, fontSize: AppFont.xl, fontWeight: AppFont.bold),
        ),
        const SizedBox(height: AppSpacing.sm),
        const Text(
          'Waiting for the other person to join',
          style: TextStyle(color: Colors.white70, fontSize: AppFont.sm),
        ),
        const SizedBox(height: AppSpacing.xxl),
        _EndCallButton(onPressed: onEnd),
      ],
    );
  }
}

class _ActiveCallView extends StatelessWidget {
  const _ActiveCallView({
    required this.elapsed,
    required this.muted,
    required this.speakerOn,
    required this.onToggleMute,
    required this.onToggleSpeaker,
    required this.onEnd,
  });

  final String elapsed;
  final bool muted;
  final bool speakerOn;
  final VoidCallback onToggleMute;
  final VoidCallback onToggleSpeaker;
  final VoidCallback onEnd;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Spacer(),
        Container(
          width: 96,
          height: 96,
          decoration: const BoxDecoration(color: Colors.white24, shape: BoxShape.circle),
          alignment: Alignment.center,
          child: const Text('👤', style: TextStyle(fontSize: 40)),
        ),
        const SizedBox(height: AppSpacing.lg),
        const Text('In call',
            style: TextStyle(color: Colors.white, fontSize: AppFont.xl, fontWeight: AppFont.bold)),
        const SizedBox(height: AppSpacing.sm),
        Text(elapsed, style: const TextStyle(color: Colors.white70, fontSize: AppFont.md)),
        const Spacer(),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _RoundIconButton(
                icon: muted ? Icons.mic_off : Icons.mic,
                active: muted,
                onPressed: onToggleMute,
              ),
              _EndCallButton(onPressed: onEnd),
              _RoundIconButton(
                icon: speakerOn ? Icons.volume_up : Icons.hearing,
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

class _EndedView extends StatelessWidget {
  const _EndedView({required this.session, required this.onDone});
  final Session? session;
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
            const Text('📞', style: TextStyle(fontSize: 48)),
            const SizedBox(height: AppSpacing.md),
            Text(_reasonLabel(session?.endReason),
                style: const TextStyle(
                    color: Colors.white, fontSize: AppFont.xl, fontWeight: AppFont.bold)),
            const SizedBox(height: AppSpacing.lg),
            _SummaryRow(label: 'Duration', value: '$minutes min'),
            const SizedBox(height: AppSpacing.sm),
            _SummaryRow(label: 'Used', value: uniminutesLabel(spent)),
            const SizedBox(height: AppSpacing.xxl),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
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
        Text(value,
            style: const TextStyle(color: Colors.white, fontWeight: AppFont.semibold)),
      ],
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({required this.icon, required this.active, required this.onPressed});
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
        decoration: const BoxDecoration(color: AppColors.error, shape: BoxShape.circle),
        child: const Icon(Icons.call_end, color: Colors.white, size: 28),
      ),
    );
  }
}
