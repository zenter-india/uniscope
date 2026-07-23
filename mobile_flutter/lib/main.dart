import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/push/push_service.dart';
import 'core/theme/app_theme.dart';
import 'router/app_router.dart';
import 'state/auth_controller.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (!kIsWeb) {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  }
  runApp(const ProviderScope(child: UniscopeApp()));
}

class UniscopeApp extends ConsumerStatefulWidget {
  const UniscopeApp({super.key});

  @override
  ConsumerState<UniscopeApp> createState() => _UniscopeAppState();
}

class _UniscopeAppState extends ConsumerState<UniscopeApp> {
  @override
  void initState() {
    super.initState();
    // Register (or refresh) the device's push token whenever the user
    // becomes authenticated — covers both a fresh login and app relaunch
    // with an already-hydrated session.
    ref.listenManual(authControllerProvider, (previous, next) {
      if (next.isAuthenticated && next.isHydrated) {
        ref.read(pushServiceProvider).initializeAndRegister();
      }
    }, fireImmediately: true);
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Uniscope',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      routerConfig: router,
    );
  }
}
