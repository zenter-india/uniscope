import 'dart:convert';
import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
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
  // `notifications` module), and when the app is backgrounded/terminated
  // Android draws the system-tray notification itself from the payload's
  // `notification` block — no local work is needed here.
}

/// The default Android notification channel — session updates, messages,
/// reminders. `importance: high` is what lets a foreground notification show
/// as a heads-up banner rather than only landing silently in the shade.
const _androidChannel = AndroidNotificationChannel(
  'uniscope_default',
  'Uniscope',
  description: 'Session updates, messages and reminders.',
  importance: Importance.high,
);

/// A separate, louder channel for call-related pushes (a call request, a
/// mentor accepting, "your call is starting"). `Importance.max` +
/// `AudioAttributesUsage.notificationRingtone` make it ring on the ringtone
/// stream and pop a heads-up even when the phone is on vibrate for normal
/// notifications. A distinct channel id is required: Android freezes a
/// channel's sound/importance at creation, so the only way to add a ring to
/// devices that already installed an older build is a new channel.
const _androidCallChannel = AndroidNotificationChannel(
  'uniscope_calls',
  'Calls',
  description: 'Incoming call requests and call reminders.',
  importance: Importance.max,
  playSound: true,
  enableVibration: true,
  audioAttributesUsage: AudioAttributesUsage.notificationRingtone,
);

/// Notification `type`s (from the FCM data payload) that are about a call and
/// should ring rather than ding.
bool _isCallType(Object? type) =>
    type == 'SESSION_REQUEST' ||
    type == 'SESSION_ACCEPTED' ||
    type == 'SESSION_STARTING';

/// Wires up FCM: requests permission, uploads the device token to
/// `POST /users/me/push-token` once a user is authenticated, refreshes it
/// if FCM rotates the token later, and — the part this file gained in
/// 2026-09 — renders a real system notification for pushes that arrive
/// while the app is in the FOREGROUND. Android only shows the tray
/// notification by itself when the app is backgrounded/terminated; in the
/// foreground the message is delivered straight to `onMessage` in Dart, so
/// without this the user would only ever see it in the in-app list.
///
/// Web is skipped — FCM web push needs a VAPID key + service worker setup
/// that hasn't been done for this project, and this app's only real target
/// for push is the native mobile builds.
class PushService {
  PushService(this._ref);

  final Ref _ref;
  final _localNotifications = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  /// Called from `main.dart` on *every* transition into an authenticated
  /// state — a fresh login, an account switch, or an app relaunch with a
  /// hydrated session. The one-time listener/permission setup happens once
  /// ([_setupOnce]); the **token upload runs every time**, so the server's
  /// single `PushToken` row for this device is always re-bound to whoever
  /// is currently signed in.
  ///
  /// Before this split the whole method was guarded by `_initialized`, so
  /// switching accounts without killing the app left the device's push
  /// token registered to the *previous* user — every notification for that
  /// user then landed on this device (now showing someone else), and
  /// notifications for the current user went nowhere.
  Future<void> initializeAndRegister() async {
    if (kIsWeb) return;
    try {
      await _setupOnce();
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _upload(token);
    } catch (_) {
      // No Firebase app available on this run — push just won't work.
    }
  }

  /// Permission, local-notification plugin, and the FCM listeners — all of
  /// which must be wired exactly once per process.
  Future<void> _setupOnce() async {
    if (_initialized) return;
    _initialized = true;

    await _initLocalNotifications();

    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(alert: true, badge: true, sound: true);

    messaging.onTokenRefresh.listen(_upload);

    // Foreground push → draw a heads-up notification (Android won't do it
    // for us here) AND run the deep-link handler, so e.g. "mentor
    // accepted" still pulls the aspirant onto the call screen even if
    // they had the app open on another tab.
    FirebaseMessaging.onMessage.listen((message) {
      _showLocalNotification(message);
      _handleDeepLink(message);
    });

    // Deep-link on the paths a push reaches the user through while it's
    // NOT foreground: tapped while backgrounded, or tapped from a cold
    // start (terminated).
    FirebaseMessaging.onMessageOpenedApp.listen(_handleDeepLink);
    final initialMessage = await messaging.getInitialMessage();
    if (initialMessage != null) _handleDeepLink(initialMessage);
  }

  /// Best-effort unbind of this device's push token from the account that's
  /// logging out, so a logged-out phone stops receiving that user's
  /// notifications. The FCM token itself is kept — the next login just
  /// re-uploads it under the new user. [accessToken] is passed explicitly
  /// (captured before the auth state is cleared) so the DELETE still
  /// authenticates.
  Future<void> unregister({required String accessToken}) async {
    if (kIsWeb) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;
      await _ref
          .read(usersApiProvider)
          .deletePushToken(token, accessToken: accessToken);
    } catch (_) {
      // Failed unbind is harmless — the row is reassigned on the next
      // login's re-upload anyway.
    }
  }

  Future<void> _initLocalNotifications() async {
    await _localNotifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
      onDidReceiveNotificationResponse: (response) {
        final payload = response.payload;
        if (payload == null || payload.isEmpty) return;
        try {
          final data = (jsonDecode(payload) as Map).cast<String, dynamic>();
          _handleDeepLinkData(data);
        } catch (_) {
          // Malformed payload — nothing to route to.
        }
      },
    );
    final android = _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    await android?.createNotificationChannel(_androidChannel);
    await android?.createNotificationChannel(_androidCallChannel);
  }

  void _showLocalNotification(RemoteMessage message) {
    final notification = message.notification;
    // Data-only messages carry nothing to display — they're handled purely
    // by the deep-link path.
    if (notification == null) return;
    if (notification.title == null && notification.body == null) return;

    final isCall = _isCallType(message.data['type']);
    final channel = isCall ? _androidCallChannel : _androidChannel;

    _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          channel.id,
          channel.name,
          channelDescription: channel.description,
          importance: isCall ? Importance.max : Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
          playSound: true,
          enableVibration: true,
          // A call rings on the ringtone stream and is tagged as a call so
          // Android ranks it above ordinary notifications and shows it on
          // the lock screen.
          audioAttributesUsage: isCall
              ? AudioAttributesUsage.notificationRingtone
              : AudioAttributesUsage.notification,
          category:
              isCall ? AndroidNotificationCategory.call : null,
        ),
        iOS: DarwinNotificationDetails(
          presentSound: true,
          sound: isCall ? 'default' : null,
          interruptionLevel: isCall
              ? InterruptionLevel.timeSensitive
              : InterruptionLevel.active,
        ),
      ),
      payload: message.data.isEmpty ? null : jsonEncode(message.data),
    );
  }

  void _handleDeepLink(RemoteMessage message) =>
      _handleDeepLinkData(message.data);

  void _handleDeepLinkData(Map<String, dynamic> data) {
    final sessionId = data['sessionId'] as String?;
    if (sessionId == null) return;

    final type = data['type'];

    // Where a push should land:
    //  - SESSION_STARTING (audio call) → straight into the call. This fires
    //    only when the call is actually live/imminent (first party joined,
    //    or the ~2-min-before sweep), so auto-routing on receipt is right.
    //  - SESSION_ACCEPTED (audio call) → into the call ONLY for an Instant
    //    accept. A scheduled accept carries `confirmedFor` (and no
    //    `sessionType`) — routing that into a call would drag the student in
    //    hours early. Belt-and-suspenders: even with `sessionType` set, bail
    //    if `confirmedFor` is more than ~2 min away.
    //  - SESSION_REQUEST (mentor) → the Sessions tab (Accept button + dock).
    final String target;
    if (type == 'SESSION_STARTING' && data['sessionType'] == 'AUDIO_CALL') {
      target = '/call/$sessionId';
    } else if (type == 'SESSION_ACCEPTED' && data['sessionType'] == 'AUDIO_CALL') {
      final confirmedForRaw = data['confirmedFor'] as String?;
      final confirmedFor = confirmedForRaw == null
          ? null
          : DateTime.tryParse(confirmedForRaw);
      final imminent = confirmedFor == null ||
          confirmedFor.difference(DateTime.now()) <
              const Duration(minutes: 2);
      target = imminent ? '/call/$sessionId' : '/chats';
    } else if (type == 'SESSION_REQUEST') {
      target = '/chats';
    } else {
      return;
    }

    final context = rootNavigatorKey.currentContext;
    if (context == null) return;
    final router = GoRouter.of(context);
    // /call/:id is a full-screen route on the root navigator (over the tab
    // shell) — push it. /chats is a tab — switch to it rather than pushing
    // a duplicate.
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
