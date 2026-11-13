import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope_mobile/core/network/mentors_api.dart';
import 'package:uniscope_mobile/core/theme/app_theme.dart';
import 'package:uniscope_mobile/features/mentors/mentor_detail_screen.dart';
import 'package:uniscope_mobile/state/auth_controller.dart';

class _FakeAuth extends AuthController {
  _FakeAuth(this._user);
  final AuthUser _user;

  @override
  AuthState build() => AuthState(user: _user);
}

Mentor _mentor({String id = 'men', bool available = true}) => Mentor.fromJson({
  'id': id,
  'displayName': 'Dr. Meera',
  'role': 'MENTOR',
  'pricePerMinuteMinor': 1000,
  'isAvailable': available,
  'isVerified': true,
});

Future<void> _pump(
  WidgetTester t, {
  required AuthUser viewer,
  Mentor? mentor,
}) async {
  t.view.physicalSize = const Size(412, 900);
  t.view.devicePixelRatio = 1.0;
  addTearDown(t.view.reset);
  final shown = mentor ?? _mentor();
  await t.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(() => _FakeAuth(viewer)),
        mentorDetailProvider.overrideWith((ref, id) async => shown),
        mentorReviewsListProvider.overrideWith((ref, id) async => const []),
      ],
      child: MaterialApp(
        theme: buildAppTheme(),
        home: MentorDetailScreen(mentorId: shown.id),
      ),
    ),
  );
  await t.pumpAndSettle();
}

/// A mentor can open another mentor's profile and message them; there is no
/// Call option for mentors. Students keep the real Call.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    final l = FontLoader('Manrope');
    for (final w in ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']) {
      l.addFont(rootBundle.load('assets/fonts/Manrope-$w.ttf'));
    }
    await l.load();
  });

  const mentorViewer = AuthUser(
    id: 'me',
    role: UserRole.mentor,
    displayName: 'Me',
  );

  testWidgets('a mentor viewing another mentor gets Chat and no Call option', (
    t,
  ) async {
    await _pump(t, viewer: mentorViewer);

    expect(find.text('Chat'), findsOneWidget);
    expect(find.text('Call'), findsNothing);
    expect(find.text('Calls off'), findsNothing);
    expect(find.text('Call · soon'), findsNothing);
  });

  testWidgets('a student still sees the real Call button', (t) async {
    await _pump(
      t,
      viewer: const AuthUser(
        id: 'asp',
        role: UserRole.aspirant,
        displayName: 'Student',
      ),
    );

    expect(find.text('Chat'), findsOneWidget);
    expect(find.text('Call'), findsOneWidget);
    expect(find.text('Call · soon'), findsNothing);
  });

  testWidgets('a mentor on their own profile gets no action bar', (t) async {
    await _pump(
      t,
      viewer: mentorViewer,
      mentor: _mentor(id: 'me'),
    );

    expect(find.text('Chat'), findsNothing);
    expect(find.text('Call · soon'), findsNothing);
  });
}
