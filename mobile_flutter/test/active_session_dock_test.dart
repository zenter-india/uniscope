import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope_mobile/core/network/sessions_api.dart';
import 'package:uniscope_mobile/core/theme/app_theme.dart';
import 'package:uniscope_mobile/features/sessions/active_session_dock.dart';
import 'package:uniscope_mobile/features/sessions/session_list_screen.dart'
    show sessionsListProvider;
import 'package:uniscope_mobile/state/auth_controller.dart';

class _FakeAuth extends AuthController {
  @override
  AuthState build() => const AuthState(
    user: AuthUser(id: 'asp', role: UserRole.aspirant, displayName: 'A'),
  );
}

Session _confirmed(String mentorName) => Session.fromJson({
  'id': 's1',
  'aspirantId': 'asp',
  'mentorId': 'men',
  'mentorName': mentorName,
  'type': 'AUDIO_CALL',
  'status': 'ACCEPTED',
  'ratePerMinuteMinor': 1000,
  'requestedAt': DateTime.now().toIso8601String(),
  'callSlotMinutes': 10,
  // Far enough ahead that Join shows the long "Wed, 12 Sep, 4:30 PM" label.
  'confirmedFor': DateTime.now().add(const Duration(days: 2)).toIso8601String(),
});

/// The confirmed-booking dock row carries name/status + Cancel + a Join chip
/// (which becomes the scheduled time until the join window opens) in one row —
/// on a narrow phone with a long mentor name it must not overflow.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    final l = FontLoader('Manrope');
    for (final w in ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']) {
      l.addFont(rootBundle.load('assets/fonts/Manrope-$w.ttf'));
    }
    await l.load();
  });

  for (final w in const [320.0, 360.0, 412.0]) {
    testWidgets('confirmed-call dock row fits at ${w.toInt()}px', (t) async {
      t.view.physicalSize = Size(w, 800);
      t.view.devicePixelRatio = 1.0;
      addTearDown(t.view.reset);
      await t.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_FakeAuth.new),
            sessionsListProvider.overrideWith(
              (ref) async => [_confirmed('Dr. Bartholomew Krishnamurthy-Iyer')],
            ),
          ],
          child: MaterialApp(
            theme: buildAppTheme(),
            home: const Scaffold(body: ActiveSessionDock()),
          ),
        ),
      );
      await t.pumpAndSettle();
      expect(find.text('Cancel'), findsOneWidget);
    });
  }
}
