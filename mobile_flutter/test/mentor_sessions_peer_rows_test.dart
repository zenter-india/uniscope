import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope_mobile/core/network/sessions_api.dart';
import 'package:uniscope_mobile/core/network/users_api.dart';
import 'package:uniscope_mobile/core/theme/app_theme.dart';
import 'package:uniscope_mobile/features/notifications/notifications_screen.dart'
    show unreadCountProvider;
import 'package:uniscope_mobile/features/sessions/session_list_screen.dart';
import 'package:uniscope_mobile/state/auth_controller.dart';

class _FakeAuth extends AuthController {
  @override
  AuthState build() => const AuthState(
    user: AuthUser(id: 'me', role: UserRole.mentor, displayName: 'Me'),
  );
}

Session _chat({
  required String id,
  required String aspirantId,
  required String mentorId,
  required String aspirantName,
  required String mentorName,
}) => Session.fromJson({
  'id': id,
  'aspirantId': aspirantId,
  'mentorId': mentorId,
  'aspirantName': aspirantName,
  'mentorName': mentorName,
  'type': 'CHAT',
  'status': 'ACCEPTED',
  'ratePerMinuteMinor': 0,
  'requestedAt': DateTime.now().toIso8601String(),
});

/// On a mentor's Sessions tab, a chat they started with ANOTHER mentor (they
/// hold the "aspirant" seat of that session) must show the other mentor — not
/// themselves as a "student" — with chat only (no Call icon).
/// A student reaching out to them still shows as a student, as before.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    final l = FontLoader('Manrope');
    for (final w in ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']) {
      l.addFont(rootBundle.load('assets/fonts/Manrope-$w.ttf'));
    }
    await l.load();
  });

  testWidgets('mentor Sessions shows peer chats under the other mentor', (
    t,
  ) async {
    t.view.physicalSize = const Size(412, 900);
    t.view.devicePixelRatio = 1.0;
    addTearDown(t.view.reset);

    await t.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_FakeAuth.new),
          sessionsListProvider.overrideWith(
            (ref) async => [
              // I messaged another mentor.
              _chat(
                id: 's1',
                aspirantId: 'me',
                mentorId: 'men',
                aspirantName: 'Me',
                mentorName: 'Dr. Meera',
              ),
              // A student messaged me.
              _chat(
                id: 's2',
                aspirantId: 'stu',
                mentorId: 'me',
                aspirantName: 'Asha Student',
                mentorName: 'Me',
              ),
            ],
          ),
          unreadCountProvider.overrideWith((ref) async => 0),
          // Never resolves: the app-bar calls switch simply stays hidden.
          myProfileProvider.overrideWith(
            (ref) => Completer<UserProfile>().future,
          ),
        ],
        child: MaterialApp(
          theme: buildAppTheme(),
          home: const SessionListScreen(),
        ),
      ),
    );
    await t.pumpAndSettle();

    // Both people are listed, and the mentor never sees their own name as a
    // "student" row.
    expect(find.text('Dr. Meera'), findsOneWidget);
    expect(find.text('Asha Student'), findsOneWidget);
    expect(find.text('Me'), findsNothing);

    // Chat only: no call icon anywhere on a mentor's Sessions tab here, and
    // each row has its chat button.
    expect(find.byIcon(Icons.call_outlined), findsNothing);
    expect(find.byIcon(Icons.chat_bubble_rounded), findsWidgets);
  });
}
