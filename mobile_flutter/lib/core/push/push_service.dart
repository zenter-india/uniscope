import 'dart:convert';
import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/calls/call_overlay.dart'
    show CallOverlayController, CallPresence;
import '../../router/app_router.dart';
import '../network/sessions_api.dart' show sessionsApiProvider;
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

/// Accept/Decline action ids on a `SESSION_REQUEST` notification — the
/// mentor's side only (an aspirant never gets a `SESSION_REQUEST`). Both use
/// `showsUserInterface: true`: a real "decline without ever opening the app"
/// would need the plugin's background isolate to reach the backend, but that
/// isolate's `FlutterEngine` (see `ActionBroadcastReceiver.java` in the
/// installed `flutter_local_notifications` package) is created with no
/// plugin registration at all, so `flutter_secure_storage` — the only place
/// the access token lives — would silently fail to read it there. Both
/// actions foreground the app instead (same proven mechanism the iOS "End
/// Call" ongoing-call action below already uses) and do their real work
/// immediately in `onDidReceiveNotificationResponse`, rather than just
/// landing on a screen for the mentor to act on manually.
const _acceptActionId = 'accept';
const _declineActionId = 'decline';

/// A single "Join" action on a `SESSION_STARTING` notification — this fires
/// for an already-accepted/confirmed call whose time has arrived (or that
/// just went live), so there's nothing left to accept, just join. Kept
/// deliberately separate from `_acceptActionId`/`_declineActionId`: an
/// instant SESSION_REQUEST is the one case that genuinely accepts-and-joins
/// in a single step; a scheduled request never does that in one tap (it
/// still needs a confirmed slot first, see `_handleAcceptAction` below) — a
/// "Join" affordance belongs on the later "starting now" notification, not
/// folded into the original request's Accept button.
const _joinActionId = 'join';

/// iOS has no foreground-service concept, so unlike Android's
/// `CallForegroundService` (an ongoing, non-dismissible notification with a
/// live chronometer and an "End call" action, shown in the notification
/// shade for the whole call) there was nothing at all showing on iOS while
/// a call was active — no reminder it's running, no way to end it except
/// reopening the app. A plain local notification can't replicate the live
/// chronometer (that needs a Live Activity / ActivityKit widget extension,
/// a much bigger native addition), but a static "on call with X, tap to
/// return" notification with a real "End Call" action button covers the
/// actual reported gap. Stable id so re-showing it (shouldn't happen —
/// shown once per call) updates in place rather than stacking duplicates.
const _callOngoingNotificationId = 424242;
const _callOngoingCategoryId = 'uniscope_call_ongoing';
const _endCallActionId = 'END_CALL';

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
      // On iOS, FirebaseMessaging.getToken() needs an APNs token to already
      // be attached — iOS delivers that token to the app asynchronously
      // (via didRegisterForRemoteNotificationsWithDeviceToken) some short
      // time after requestPermission()/registerForRemoteNotifications(),
      // not synchronously. Calling getToken() before that arrives throws,
      // and the outer catch here swallowed it silently — so on iOS this
      // method could run to completion having uploaded nothing, with no
      // visible error, and the device would just never get a push token
      // registered at all. Android has no such handshake and was never
      // affected. Poll briefly for the APNs token first; if it genuinely
      // never arrives (push permission denied, or a real APNs/entitlement
      // misconfiguration), skip getToken() rather than let it throw.
      if (Platform.isIOS) {
        var apnsToken = await FirebaseMessaging.instance.getAPNSToken();
        for (var i = 0; apnsToken == null && i < 10; i++) {
          await Future<void>.delayed(const Duration(milliseconds: 500));
          apnsToken = await FirebaseMessaging.instance.getAPNSToken();
        }
        if (apnsToken == null) return; // no push this run — nothing to upload
      }
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
    // for us here). `fromTap: false` — a *received* push only auto-routes
    // for a live/imminent call (so "mentor accepted" still pulls the
    // aspirant onto the call screen); everything else waits for the user to
    // tap the heads-up.
    FirebaseMessaging.onMessage.listen((message) {
      _showLocalNotification(message);
      _handleDeepLink(message, fromTap: false);
    });

    // A push tapped while the app is backgrounded, or from a cold start
    // (terminated). `fromTap: true` (the default) — route to the related
    // screen, falling back to the in-app Notifications list.
    FirebaseMessaging.onMessageOpenedApp.listen((m) => _handleDeepLink(m));
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
      InitializationSettings(
        android: const AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          notificationCategories: [
            DarwinNotificationCategory(
              _callOngoingCategoryId,
              actions: [
                DarwinNotificationAction.plain(
                  _endCallActionId,
                  'End Call',
                  options: {
                    DarwinNotificationActionOption.destructive,
                    DarwinNotificationActionOption.foreground,
                  },
                ),
              ],
            ),
          ],
        ),
      ),
      onDidReceiveNotificationResponse: (response) {
        // The ongoing-call notification's "End Call" action (iOS) — routes
        // through the same CallPresence hook the minimized mini-bar's own
        // End button already uses, so it works identically whether the app
        // was foregrounded, backgrounded, or just got foregrounded by this
        // very action tap (the `foreground` option above guarantees that).
        if (response.actionId == _endCallActionId) {
          CallPresence.instance.onEnd?.call();
          return;
        }
        final payload = response.payload;
        if (payload == null || payload.isEmpty) return;
        try {
          final data = (jsonDecode(payload) as Map).cast<String, dynamic>();
          if (response.actionId == _acceptActionId) {
            _handleAcceptAction(data);
          } else if (response.actionId == _declineActionId) {
            _handleDeclineAction(data);
          } else if (response.actionId == _joinActionId) {
            final sessionId = data['sessionId'] as String?;
            if (sessionId != null) _navigate('/call/$sessionId');
          } else {
            _handleDeepLinkData(data);
          }
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

  /// iOS-only "on call with X" notification — see the const doc comment
  /// above for why this exists. Android already has the real thing
  /// (`CallForegroundService`); calling this there would just be a second,
  /// redundant notification, so it's a no-op on every other platform.
  Future<void> showCallOngoingNotification({required String peerName}) async {
    if (!Platform.isIOS) return;
    await _localNotifications.show(
      _callOngoingNotificationId,
      'On call with $peerName',
      'Tap to return to the call',
      const NotificationDetails(
        iOS: DarwinNotificationDetails(
          categoryIdentifier: _callOngoingCategoryId,
          presentAlert: true,
          presentBanner: true,
          presentSound: false,
          presentBadge: false,
          interruptionLevel: InterruptionLevel.active,
        ),
      ),
    );
  }

  Future<void> cancelCallOngoingNotification() async {
    if (!Platform.isIOS) return;
    await _localNotifications.cancel(_callOngoingNotificationId);
  }

  void _showLocalNotification(RemoteMessage message) {
    final notification = message.notification;
    // Data-only messages carry nothing to display — they're handled purely
    // by the deep-link path.
    if (notification == null) return;
    if (notification.title == null && notification.body == null) return;

    final type = message.data['type'];
    final isCall = _isCallType(type);
    final channel = isCall ? _androidCallChannel : _androidChannel;
    // A pending request is Accept/Decline-actionable. SESSION_STARTING is
    // a different case — the call is already accepted/confirmed and its
    // time has arrived (or it just went live), so there's nothing left to
    // accept, just a single "Join". SESSION_ACCEPTED stays a plain,
    // action-free alert either way (a scheduled accept only tells the
    // aspirant when to expect SESSION_STARTING later; an instant accept is
    // already handled by the existing auto-navigate-on-receipt below).
    final isActionableRequest = type == 'SESSION_REQUEST';
    final isJoinableNow = type == 'SESSION_STARTING';

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
          category: isCall ? AndroidNotificationCategory.call : null,
          actions: isActionableRequest
              ? const [
                  AndroidNotificationAction(
                    _acceptActionId,
                    'Accept',
                    showsUserInterface: true,
                  ),
                  AndroidNotificationAction(
                    _declineActionId,
                    'Decline',
                    showsUserInterface: true,
                  ),
                ]
              : isJoinableNow
              ? const [
                  AndroidNotificationAction(
                    _joinActionId,
                    'Join',
                    showsUserInterface: true,
                  ),
                ]
              : null,
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

  /// The "Accept" action on a `SESSION_REQUEST` notification — brings the
  /// app forward (`showsUserInterface: true` guarantees this) and finishes
  /// the accept right here rather than just landing on the Sessions tab, so
  /// answering a call from the lock screen doesn't need a second tap once
  /// the app is up. Only an **instant** request goes straight into the call
  /// — a scheduled one still needs the mentor to pick a concrete 30-min slot
  /// (`showConfirmCallTimeSheet`), which can't be done from a bare
  /// notification action, so that case falls back to the same "/chats"
  /// landing a plain tap already gives.
  Future<void> _handleAcceptAction(Map<String, dynamic> data) async {
    final sessionId = data['sessionId'] as String?;
    if (sessionId == null) return;
    if (data['instant'] != 'true') {
      _navigate('/chats');
      return;
    }
    try {
      await _ref.read(sessionsApiProvider).accept(sessionId);
      _navigate('/call/$sessionId');
    } catch (_) {
      // Already accepted/rejected elsewhere (a concurrent tap from inside
      // the app), or a network hiccup — land on Sessions so the mentor sees
      // the request's real current state instead of a silently-failed tap.
      _navigate('/chats');
    }
  }

  /// The "Decline" action — rejects the request immediately, then lands on
  /// Sessions so the mentor sees it's gone from their pending list. Errors
  /// (already resolved elsewhere, a network hiccup) are swallowed rather
  /// than surfaced — there's no guaranteed Scaffold/context to show them in
  /// at the moment the app has just been foregrounded by this exact action.
  Future<void> _handleDeclineAction(Map<String, dynamic> data) async {
    final sessionId = data['sessionId'] as String?;
    if (sessionId == null) return;
    try {
      await _ref.read(sessionsApiProvider).reject(sessionId);
    } catch (_) {
      // Ignored — see doc comment above.
    }
    _navigate('/chats');
  }

  void _handleDeepLink(RemoteMessage message, {bool fromTap = true}) =>
      _handleDeepLinkData(message.data, fromTap: fromTap);

  /// Route a push to the screen it's about. [fromTap] is false when the
  /// push was merely *received* in the foreground — in that case only a
  /// live/imminent call auto-navigates; every other type waits for the
  /// user to tap the heads-up notification (which comes back through here
  /// with [fromTap] true).
  void _handleDeepLinkData(Map<String, dynamic> data, {bool fromTap = true}) {
    final type = data['type'];
    final sessionId = data['sessionId'] as String?;
    // A scheduled AUDIO_CALL accept carries `confirmedFor` but deliberately
    // NOT `sessionType` (see SessionsService.accept's own comment — sending
    // sessionType there would auto-navigate the student straight into the
    // call screen hours early). Checking for `confirmedFor` too is what
    // actually catches that case; sessionType alone only ever matches an
    // instant accept, so a scheduled "Request accepted" tap used to fall
    // through to the generic /notifications catch-all below instead of
    // opening the chat thread as intended. confirmedFor is never present on
    // a CHAT-session accept, so this can't misfire there.
    final isCall =
        data['sessionType'] == 'AUDIO_CALL' || data['confirmedFor'] != null;

    // 1. Live / imminent call — pulls the party onto the call screen even
    //    on a foreground receipt.
    //    - SESSION_STARTING fires only when the call is actually live (a
    //      party joined) or ~2 min out (the sweep), so routing on receipt
    //      is right.
    //    - SESSION_ACCEPTED: an Instant accept → into the call. A scheduled
    //      accept carries `confirmedFor` — routing that into a call would
    //      drag the student in hours early, so only a tap acts on it, and
    //      only to open the chat thread.
    //    - SESSION_RESCHEDULED carries the exact same {sessionId,
    //      confirmedFor} shape as a scheduled SESSION_ACCEPTED (reschedule
    //      only ever applies to a call that already has a confirmedFor, so
    //      it's never null here) — same imminent/not-imminent handling.
    if (sessionId != null && isCall) {
      if (type == 'SESSION_STARTING') {
        _navigate('/call/$sessionId');
        return;
      }
      if (type == 'SESSION_ACCEPTED' || type == 'SESSION_RESCHEDULED') {
        final raw = data['confirmedFor'] as String?;
        final confirmedFor = raw == null ? null : DateTime.tryParse(raw);
        final imminent =
            confirmedFor == null ||
            confirmedFor.difference(DateTime.now()) <
                const Duration(minutes: 2);
        if (imminent) {
          _navigate('/call/$sessionId');
        } else if (fromTap) {
          _navigate('/chats/room', extra: {'sessionId': sessionId});
        }
        return;
      }
    }

    // 2. Everything below only navigates on an explicit tap — a foreground
    //    receipt just leaves the heads-up notification on screen.
    if (!fromTap) return;

    if (type == 'MESSAGE' && sessionId != null) {
      _navigate('/chats/room', extra: {'sessionId': sessionId});
    } else if (type == 'SESSION_REQUEST') {
      _navigate('/chats');
    } else {
      // SESSION_REJECTED / SESSION_ENDED / VERIFICATION / PAYMENT /
      // LOW_BALANCE / SYSTEM / anything unknown → the in-app Notifications
      // list, so a tapped notification always lands somewhere instead of
      // just foregrounding the app wherever it happened to be.
      _navigate('/notifications');
    }
  }

  void _navigate(String target, {Object? extra}) {
    // The call is a minimize-able overlay, not a route — open it directly
    // rather than going through the router's '/call/:id' redirect fallback
    // (same as every other real launch site).
    if (target.startsWith('/call/')) {
      CallOverlayController.instance.open(target.substring('/call/'.length));
      return;
    }
    final context = rootNavigatorKey.currentContext;
    if (context == null) return;
    final router = GoRouter.of(context);
    // /notifications is a top-level route on the root navigator (over the
    // tab shell) — push it. Tab locations (/chats, /chats/room) are
    // switched to with go() so they don't stack a duplicate.
    if (target == '/notifications') {
      router.push(target);
    } else {
      router.go(target, extra: extra);
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
