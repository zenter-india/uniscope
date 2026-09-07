import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';
import 'call_screen.dart';

/// Keeps a live call running while the user browses the rest of the app.
///
/// The call's real state — the Agora engine, the billing poll, the slot
/// timers — still lives inside [CallScreen]. What makes "minimize" work is
/// that [CallOverlayHost] keeps that one `CallScreen` element **mounted**
/// (just `Offstage`) instead of it being a route that gets disposed on
/// navigation. This controller only tracks "is a call up, and is it
/// expanded".
class CallOverlayController extends ChangeNotifier {
  CallOverlayController._();
  static final CallOverlayController instance = CallOverlayController._();

  String? _sessionId;
  bool _expanded = true;

  String? get sessionId => _sessionId;
  bool get isActive => _sessionId != null;
  bool get expanded => _expanded;

  /// Open (or re-focus) the call screen for [sessionId]. Idempotent — a
  /// second call for the same session just re-expands it.
  void open(String sessionId) {
    if (_sessionId == sessionId) {
      if (!_expanded) {
        _expanded = true;
        notifyListeners();
      }
      return;
    }
    _sessionId = sessionId;
    _expanded = true;
    notifyListeners();
  }

  /// Shrink to the floating bar — the call keeps running.
  void minimize() {
    if (_sessionId != null && _expanded) {
      _expanded = false;
      notifyListeners();
    }
  }

  void expand() {
    if (_sessionId != null && !_expanded) {
      _expanded = true;
      notifyListeners();
    }
  }

  /// The call is over (or was never established) — tear the overlay down.
  void close() {
    if (_sessionId == null) return;
    _sessionId = null;
    _expanded = true;
    CallPresence.instance.clear();
    notifyListeners();
  }
}

/// A one-way mirror of just the bits the minimized bar shows. [CallScreen]
/// pushes into this; the bar listens. Kept deliberately tiny.
class CallPresence extends ChangeNotifier {
  CallPresence._();
  static final CallPresence instance = CallPresence._();

  String peerName = '';
  String? peerAvatarUrl;

  /// "1:23" once live, "Ringing…" / "Connecting…" before.
  String status = '';
  bool muted = false;

  /// The other party's mic is picked up as being live right now.
  bool active = false;

  /// Wired up by the mounted CallScreen so the bar's buttons act on the
  /// real engine. Null while no call screen is alive.
  VoidCallback? onToggleMute;
  VoidCallback? onEnd;

  void publish({
    required String peerName,
    required String? peerAvatarUrl,
    required String status,
    required bool muted,
    required bool active,
  }) {
    this.peerName = peerName;
    this.peerAvatarUrl = peerAvatarUrl;
    this.status = status;
    this.muted = muted;
    this.active = active;
    notifyListeners();
  }

  void clear() {
    peerName = '';
    peerAvatarUrl = null;
    status = '';
    muted = false;
    active = false;
    onToggleMute = null;
    onEnd = null;
    notifyListeners();
  }
}

/// Wraps the whole app. Renders the app, and — while a call is up — the
/// full [CallScreen] over it (hidden behind `Offstage` when minimized) plus
/// the floating bar.
class CallOverlayHost extends StatefulWidget {
  const CallOverlayHost({super.key, required this.child});
  final Widget child;

  @override
  State<CallOverlayHost> createState() => _CallOverlayHostState();
}

class _CallOverlayHostState extends State<CallOverlayHost> {
  // Pins the CallScreen element across this host's rebuilds so its State
  // (engine, timers) is never re-created on minimize/expand.
  final _callKey = GlobalKey();
  final _controller = CallOverlayController.instance;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onChange);
  }

  @override
  void dispose() {
    _controller.removeListener(_onChange);
    super.dispose();
  }

  void _onChange() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final id = _controller.sessionId;
    final expanded = _controller.expanded;

    return Stack(
      children: [
        widget.child,
        if (id != null)
          Positioned.fill(
            child: Offstage(
              offstage: !expanded,
              // Pause the pulse/ring animations while minimized; the
              // billing/slot Timers are plain Timers and keep running.
              child: TickerMode(
                enabled: expanded,
                child: Navigator(
                  key: _callKey,
                  onGenerateRoute: (_) => MaterialPageRoute<void>(
                    builder: (_) => CallScreen(sessionId: id, inOverlay: true),
                  ),
                ),
              ),
            ),
          ),
        if (id != null && !expanded)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: SafeArea(top: false, child: const _MiniCallBar()),
          ),
      ],
    );
  }
}

class _MiniCallBar extends StatelessWidget {
  const _MiniCallBar();

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: CallPresence.instance,
      builder: (context, _) {
        final p = CallPresence.instance;
        return Padding(
          padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              onTap: CallOverlayController.instance.expand,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0C5B46), Color(0xFF08463A)],
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x55000000),
                      blurRadius: 16,
                      offset: Offset(0, 6),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    AppAvatar(
                      avatarUrl: p.peerAvatarUrl,
                      name: p.peerName.isEmpty ? 'Call' : p.peerName,
                      size: 32,
                      solid: true,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            p.peerName.isEmpty ? 'On a call' : p.peerName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: AppFont.sm,
                              fontWeight: AppFont.bold,
                            ),
                          ),
                          Text(
                            p.status.isEmpty ? 'Tap to return' : p.status,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.7),
                              fontSize: 11,
                              fontFeatures: const [
                                FontFeature.tabularFigures(),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    _BarButton(
                      icon: p.muted ? Icons.mic_off_rounded : Icons.mic_rounded,
                      onTap: p.onToggleMute,
                      active: p.muted,
                    ),
                    const SizedBox(width: 6),
                    _BarButton(
                      icon: Icons.call_end_rounded,
                      onTap: p.onEnd,
                      danger: true,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _BarButton extends StatelessWidget {
  const _BarButton({
    required this.icon,
    this.onTap,
    this.active = false,
    this.danger = false,
  });
  final IconData icon;
  final VoidCallback? onTap;
  final bool active;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final bg = danger
        ? AppColors.error
        : (active ? Colors.white : Colors.white.withValues(alpha: 0.14));
    final fg = danger
        ? Colors.white
        : (active ? const Color(0xFF08463A) : Colors.white);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
        child: Icon(icon, size: 17, color: fg),
      ),
    );
  }
}
