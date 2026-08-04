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

    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(alert: true, badge: true, sound: true);

    final token = await messaging.getToken();
    if (token != null) await _upload(token);

    messaging.onTokenRefresh.listen(_upload);

    // Deep-link on every path a push can reach the user through: tapped
    // while backgrounded, tapped from a cold start (terminated), or
    // received while the app is already open. Without this, a push arrives
    // but nothing happens with it — which is exactly why "mentor accepted"
    // never got either party onto the call screen (see CallScreen's
    // _WaitingView: it only clears once BOTH sides' clients confirm they
    // joined, so if the aspirant never learns the mentor accepted, they
    // never open the call and the mentor's own screen just rings forever).
    FirebaseMessaging.onMessageOpenedApp.listen(_handleDeepLink);
    FirebaseMessaging.onMessage.listen(_handleDeepLink);
    final initialMessage = await messaging.getInitialMessage();
    if (initialMessage != null) _handleDeepLink(initialMessage);
  }

  void _handleDeepLink(RemoteMessage message) {
    final sessionId = message.data['sessionId'];
    if (sessionId == null) return;

    final isAudioCallAccept = message.data['type'] == 'SESSION_ACCEPTED' &&
        message.data['sessionType'] == 'AUDIO_CALL';
    if (!isAudioCallAccept) return;

    final context = rootNavigatorKey.currentContext;
    if (context == null) return;
    GoRouter.of(context).push('/call/$sessionId');
  }

  Future<void> _upload(String token) async {
    try {
      await _ref
          .read(usersApiProvider)
          .storePushToken(token, Platform.isIOS ? 'ios' : 'android');
    } catch (_) {
      // Best-effort — a failed upload just means this device won't get
      // pushes until the next successful registration; never block the app.
    }
  }
}

final pushServiceProvider = Provider<PushService>((ref) => PushService(ref));
