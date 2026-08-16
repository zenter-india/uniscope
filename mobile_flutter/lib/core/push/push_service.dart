import 'dart:io';

import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../router/app_router.dart';
import '../network/dio_client.dart';
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

      // TEMP DIAGNOSTIC — remove after push registration is confirmed working.
      debugPrint('[push] FCM initialization started');
      final token = await messaging.getToken();
      debugPrint(
        token != null
            ? '[push] FCM token obtained'
            : '[push] FCM token was null',
      );
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

    final isAudioCallAccept =
        message.data['type'] == 'SESSION_ACCEPTED' &&
        message.data['sessionType'] == 'AUDIO_CALL';
    if (!isAudioCallAccept) return;

    final context = rootNavigatorKey.currentContext;
    if (context == null) return;
    GoRouter.of(context).push('/call/$sessionId');
  }

  Future<void> _upload(String token) async {
    // TEMP DIAGNOSTIC — remove after push registration is confirmed working.
    debugPrint(
      '[push] Push-token upload started ($kApiBaseUrl/users/me/push-token)',
    );
    try {
      await _ref
          .read(usersApiProvider)
          .storePushToken(token, Platform.isIOS ? 'ios' : 'android');
      // TEMP DIAGNOSTIC — remove after push registration is confirmed working.
      debugPrint('[push] Push-token upload succeeded');
    } catch (e) {
      // TEMP DIAGNOSTIC — logs safely (no token/headers/secrets), then falls
      // through to the same silent-swallow behavior as before: a failed
      // upload just means this device won't get pushes until the next
      // successful registration; never block the app.
      if (e is DioException) {
        debugPrint(
          '[push] Push-token upload FAILED — DioException: '
          'type=${e.type} statusCode=${e.response?.statusCode} message=${e.message}',
        );
      } else {
        debugPrint('[push] Push-token upload FAILED — ${e.runtimeType}: $e');
      }
    }
  }
}

final pushServiceProvider = Provider<PushService>((ref) => PushService(ref));
