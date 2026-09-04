import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../router/app_router.dart';
import '../network/users_api.dart';

/// Must be a top-level (or static) function — the Firebase plugin invokes
/// this in a separate isolate when a push arrives while the app is
/// terminated/backgrounded. Keep it minimal; there's no BuildContext or
/// Riverpod container available here.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // In-app notifications are already durable server-side (see the
  // `notifications` module) — this handler exists only so the OS shows the
  // system tray notification; no local work is needed.
}

/// Wires up FCM: requests permission, uploads the device token to
/// `POST /users/me/push-token` once a user is authenticated, and refreshes
/// it if FCM rotates the token later. Web is skipped — FCM web push needs a
/// VAPID key + service worker setup that hasn't been done for this project,
/// and this app's only real target for push is the native mobile builds.
class PushService {
  PushService(this._ref);

  final Ref _ref;
  bool _initialized = false;

  Future<void> initializeAndRegister() async {
    if (kIsWeb || _initialized) return;
    _initialized = true;

    // Mirrors main.dart's own "must not block the app" handling of a
    // missing Firebase config — this also covers running without
    // Firebase.initializeApp() at all, e.g. in a widget test harness.
    try {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(alert: true, badge: true, sound: true);

      final token = await messaging.getToken();
      if (token != null) await _upload(token);

      messaging.onTokenRefresh.listen(_upload);

      // Deep-link on every path a push can reach the user through: tapped
      // while backgrounded, tapped from a cold start (terminated), or
      // received while the app is already open. Without this, a push
      // arrives but nothing happens with it — which is exactly why "mentor
      // accepted" never got either party onto the call screen (see
      // CallScreen's _WaitingView: it only clears once BOTH sides' clients
      // confirm they joined, so if the aspirant never learns the mentor
      // accepted, they never open the call and the mentor's own screen
      // just rings forever).
      FirebaseMessaging.onMessageOpenedApp.listen(_handleDeepLink);
      FirebaseMessaging.onMessage.listen(_handleDeepLink);
      final initialMessage = await messaging.getInitialMessage();
      if (initialMessage != null) _handleDeepLink(initialMessage);
    } catch (_) {
      // No Firebase app available on this run — push just won't work.
    }
  }

  void _handleDeepLink(RemoteMessage message) {
    final sessionId = message.data['sessionId'];
    if (sessionId == null) return;

    final type = message.data['type'];

    // Where a tapped push should land:
    //  - the aspirant's "mentor accepted an audio call" → straight into the
    //    call (they still need to join; CallScreen handles that).
    //  - the mentor's "new audio call request" → the Sessions tab, where
    //    the request shows with an Accept button (and the global dock).
    //    A CHAT never goes through PENDING, so SESSION_REQUEST is always a
    //    call.
    final String target;
    if (type == 'SESSION_ACCEPTED' &&
        message.data['sessionType'] == 'AUDIO_CALL') {
      target = '/call/$sessionId';
    } else if (type == 'SESSION_REQUEST') {
      target = '/chats';
    } else {
      return;
    }

    final context = rootNavigatorKey.currentContext;
    if (context == null) return;
    final router = GoRouter.of(context);
    // /call/:id is a full-screen route outside the tab shell — stack it.
    // /chats is a tab — switch to it rather than pushing a duplicate.
    if (target.startsWith('/call/')) {
      router.push(target);
    } else {
      router.go(target);
    }
  }

  Future<void> _upload(String token) async {
    try {
      await _ref
          .read(usersApiProvider)
          .storePushToken(token, Platform.isIOS ? 'ios' : 'android');
    } catch (_) {
      // A failed upload just means this device won't get pushes until the
      // next successful registration (token refresh, or next launch);
      // never block the app.
    }
  }
}

final pushServiceProvider = Provider<PushService>((ref) => PushService(ref));
