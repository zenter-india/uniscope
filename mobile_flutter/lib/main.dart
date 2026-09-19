import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import 'core/build_info.dart' show kGitSha, kSentryDsn;
import 'core/network/university_reviews_api.dart' show hasReviewedUniversityProvider;
import 'core/network/users_api.dart' show myProfileProvider;
import 'core/push/push_service.dart';
import 'core/theme/app_theme.dart';
import 'features/calls/call_overlay.dart';
import 'router/app_router.dart';
import 'state/auth_controller.dart';

void main() async {
  // Error tracking (2026-09-19) — `SentryFlutter.init` internally does its
  // own `WidgetsFlutterBinding.ensureInitialized()` + zone setup, so it
  // wraps everything else rather than being called after. Completely
  // inert when kSentryDsn is empty (the default for any build that
  // doesn't pass --dart-define=SENTRY_DSN=... — see build_info.dart) —
  // falls straight through to the plain `_main()` call every build used
  // before this was added.
  if (kSentryDsn.isEmpty) {
    await _main();
    return;
  }
  await SentryFlutter.init((options) {
    options.dsn = kSentryDsn;
    // Error capture only, no performance tracing — matches the backend's
    // own instrument.ts choice (tracesSampleRate: 0) to keep this a small,
    // low-risk addition rather than turning on APM this app doesn't need.
    options.tracesSampleRate = 0;
    options.release = 'uniscope-mobile@$kGitSha';
  }, appRunner: _main);
}

Future<void> _main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Flutter's stock release-mode ErrorWidget renders a plain, unlabelled
  // grey box whenever any widget's build() throws — by design, to avoid
  // leaking a stack trace to a real user. That's exactly what made the
  // 2026-09-08 call-overlay "both parties hit a blank screen on connect"
  // bug silent and undiagnosable at the time (debug mode's red error
  // screen would have shown the real exception immediately, but the
  // report only ever came from a real release build). Overriding it here
  // means a future build-time crash anywhere in the app — not just calls —
  // shows what actually broke instead of nothing.
  if (kReleaseMode) {
    // The message alone ("Null check operator used on a null value") isn't
    // enough to find the throw site — the same message fires from dozens of
    // call sites across the app. Appending the first ~15 stack frames (the
    // ones inside this app's own lib/, not the Flutter framework's internal
    // build machinery) turns "something null-checked somewhere" into an
    // exact file:line the next time this fires on a real device.
    ErrorWidget.builder = (FlutterErrorDetails details) {
      final frames = details.stack
          .toString()
          .split('\n')
          .where((l) => l.contains('package:uniscope_mobile/'))
          .take(15)
          .join('\n');
      return Material(
        color: const Color(0xFFB00020),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: SingleChildScrollView(
              child: SelectableText(
                'Something went wrong:\n${details.exceptionAsString()}'
                '${frames.isEmpty ? '' : '\n\n$frames'}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontFamily: 'monospace',
                ),
              ),
            ),
          ),
        ),
      );
    };
  }
  if (!kIsWeb) {
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    } catch (_) {
      // No native Firebase config on this platform yet (e.g. iOS has no
      // GoogleService-Info.plist) — push notifications just won't work,
      // but the rest of the app must not be blocked by this.
    }
  }
  runApp(const ProviderScope(child: UniscopeApp()));
}

class UniscopeApp extends ConsumerStatefulWidget {
  const UniscopeApp({super.key});

  @override
  ConsumerState<UniscopeApp> createState() => _UniscopeAppState();
}

class _UniscopeAppState extends ConsumerState<UniscopeApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Keep the device's push-token binding in lockstep with the signed-in
    // account:
    //  - becomes authenticated (fresh login, account switch, relaunch with
    //    a hydrated session) → (re)upload the token so the server's single
    //    PushToken row for this device points at the current user;
    //  - authenticated → logged out → unbind it, using the *previous*
    //    state's still-valid access token, so a logged-out phone stops
    //    receiving that user's notifications.
    // Without the re-upload on switch, notifications leaked to whoever was
    // signed in when the app last launched.
    ref.listenManual(authControllerProvider, (previous, next) {
      if (next.isAuthenticated && next.isHydrated) {
        ref.read(pushServiceProvider).initializeAndRegister();
      } else if (previous != null &&
          previous.isAuthenticated &&
          !next.isAuthenticated &&
          (previous.accessToken ?? '').isNotEmpty) {
        ref
            .read(pushServiceProvider)
            .unregister(accessToken: previous.accessToken!);
      }
    }, fireImmediately: true);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// A screen that gates on server-side profile state (the mentor
  /// college-review requirement, `isMentorAvailable`'s 24h auto-expiry) only
  /// ever shows what `myProfileProvider` had cached the last time it was
  /// watched. If a mentor writes their review — or the availability window
  /// simply expires — while the app sits backgrounded rather than force-
  /// quit, nothing rebuilds that cache: `FutureProvider.autoDispose` only
  /// refetches when its last watcher unmounts and re-mounts, which doesn't
  /// happen for a screen the bottom-nav shell keeps alive. Reported live: a
  /// mentor who'd genuinely already reviewed their college (confirmed
  /// server-side) kept seeing "review your college" and a locked
  /// call-booking toggle for two days. Force a refetch on every app resume
  /// (the same pattern `ChatThreadView` already uses for its own message
  /// staleness) so this — and the availability-expiry case — self-heals the
  /// moment the user comes back to the app, not only on a cold relaunch.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        ref.read(authControllerProvider).isAuthenticated) {
      ref.invalidate(myProfileProvider);
      ref.invalidate(hasReviewedUniversityProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Uniscope',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      routerConfig: router,
      // Some OEM skins (Samsung OneUI in particular) apply more aggressive
      // system font-scale/bold-text settings than stock Android, which can
      // overlap or misalign this app's fixed-height layouts. Clamp instead
      // of ignoring entirely, so accessibility scaling still applies within
      // a range the UI was actually designed for.
      builder: (context, child) => MediaQuery.withClampedTextScaling(
        minScaleFactor: 0.9,
        maxScaleFactor: 1.2,
        // Hosts the audio call above every screen so it can be minimized to
        // a floating bar while the user browses other tabs (see
        // CallOverlayHost / CallOverlayController) — restored 2026-09-14
        // after the 2026-09-08 revert; see call_overlay.dart's doc comment
        // and CLAUDE.md for the blank-screen history and what changed.
        child: CallOverlayHost(child: child!),
      ),
    );
  }
}
