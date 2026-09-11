import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/network/university_reviews_api.dart' show hasReviewedUniversityProvider;
import 'core/network/users_api.dart' show myProfileProvider;
import 'core/push/push_service.dart';
import 'core/theme/app_theme.dart';
import 'router/app_router.dart';
import 'state/auth_controller.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
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
        child: child!,
      ),
    );
  }
}
