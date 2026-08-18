import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope_mobile/core/network/auth_api.dart';
import 'package:uniscope_mobile/core/network/universities_api.dart';
import 'package:uniscope_mobile/core/network/users_api.dart';
import 'package:uniscope_mobile/features/mentors/mentor_list_screen.dart';
import 'package:uniscope_mobile/main.dart';
import 'package:uniscope_mobile/state/auth_controller.dart';

/// Fakes stand in for the live backend so we can exercise the real widgets,
/// navigation, validation, auth state, and routing.
class _FakeAuthApi extends AuthApi {
  _FakeAuthApi() : super(Dio());
  @override
  Future<String> requestOtp(String phone) async => 'req_test';
  @override
  Future<VerifyOtpResult> verifyOtp(
          String serviceId, String phone, String code) async =>
      VerifyOtpResult(
        accessToken: 'access',
        refreshToken: 'refresh',
        user: const AuthUser(
          id: 'u1',
          role: UserRole.aspirant,
          displayName: 'Test User',
        ),
        isNewUser: false,
      );
  @override
  Future<void> logout() async {}
}

UserProfile _profile([String name = 'Test User']) => UserProfile(
      id: 'u1',
      role: UserRole.aspirant,
      displayName: name,
      verificationStatus: 'UNVERIFIED',
      isActive: true,
      createdAt: '',
    );

class _FakeUsersApi extends UsersApi {
  _FakeUsersApi() : super(Dio());
  @override
  Future<UserProfile> getMe() async => _profile();
  @override
  Future<UserProfile> updateRole(UserRole role) async => _profile();
  @override
  Future<UserProfile> updateProfile({
    String? displayName,
    String? bio,
    String? specialty,
    List<String>? languages,
    bool? isMentorAvailable,
    String? gender,
    String? state,
    String? city,
    String? qualification,
    String? stream,
    List<String>? goals,
    String? dateOfBirth,
    String? courseInterested,
    String? preferredLanguage,
    String? preferredMentorshipTiming,
    List<String>? availableDays,
    String? realName,
    int? yearOfStudy,
    int? graduationYear,
  }) async =>
      _profile(displayName ?? 'Test User');
}

Widget _app() => ProviderScope(
      overrides: [
        authApiProvider.overrideWithValue(_FakeAuthApi()),
        usersApiProvider.overrideWithValue(_FakeUsersApi()),
        // The Home screen also fetches universities/mentors — overridden to
        // resolve instantly with no data rather than hitting the real
        // backend, which isn't reachable from a test runner.
        universitiesListProvider.overrideWith((ref) async => const []),
        mentorsListProvider.overrideWith((ref) async => const []),
      ],
      child: const UniscopeApp(),
    );

Future<void> _bootToWelcome(WidgetTester tester) async {
  // Use a tall phone-sized surface so no CTA sits below the fold.
  tester.view.physicalSize = const Size(390, 900);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(_app());
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

/// The Welcome screen is a 4-slide onboarding carousel now, not a single
/// screen — "Skip" (only shown on slide 1) is the direct, slide-count-proof
/// way to reach the login screen from a test.
Future<void> _skipWelcome(WidgetTester tester) async {
  await tester.tap(find.text('Skip'));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    const channel =
        MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      if (call.method == 'read') return null;
      if (call.method == 'readAll') return <String, String>{};
      return null;
    });
  });

  testWidgets('navigation: Welcome → Login → OTP with form validation',
      (tester) async {
    await _bootToWelcome(tester);
    expect(find.text('Uniscope'), findsOneWidget);

    await _skipWelcome(tester);
    expect(find.text('Welcome'), findsOneWidget);
    expect(find.text('Login or create your account'), findsOneWidget);

    // Button disabled until 10 digits entered.
    await tester.enterText(find.byType(TextField), '9876543210');
    await tester.pump();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('Verify your number'), findsOneWidget);
  });

  testWidgets('full journey: phone → OTP → authenticated → Home tabs',
      (tester) async {
    await _bootToWelcome(tester);

    await _skipWelcome(tester);
    await tester.enterText(find.byType(TextField), '9876543210');
    await tester.pump();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    // Enter the 6-digit code → triggers verify → authenticates.
    await tester.enterText(find.byType(TextField), '472913');
    await tester.pumpAndSettle();

    // We must have left the OTP screen once authenticated.
    expect(find.text('Verify your number'), findsNothing);

    // Existing-user onboarding may land on profile setup first.
    if (find.text('Set up your profile').evaluate().isNotEmpty) {
      await tester.ensureVisible(find.text('Finish Setup'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Finish Setup'));
      await tester.pumpAndSettle();
    }

    // Authenticated main app — greeting is time-of-day dependent, so match
    // any of the three rather than pinning to whichever one happens to be
    // correct when this test happens to run.
    expect(
      find.textContaining(RegExp(r'^Good (morning|afternoon|evening), Test$')),
      findsOneWidget,
    );

    // Switch to the Discover tab via the bottom bar — this is the
    // aspirant's college-discovery tab (the bottom-nav label is "Discover",
    // not "Colleges"; the screen itself is UniversityListScreen).
    await tester.tap(find.text('Discover').last);
    await tester.pumpAndSettle();
    // Universities list resolves empty (overridden above) — this is the
    // list screen's own empty state, proving the tab actually switched.
    expect(find.text('No colleges found'), findsOneWidget);
  });
}
