import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope_mobile/core/network/auth_api.dart';
import 'package:uniscope_mobile/core/network/users_api.dart';
import 'package:uniscope_mobile/main.dart';
import 'package:uniscope_mobile/state/auth_controller.dart';

/// Fakes stand in for the live backend so we can exercise the real widgets,
/// navigation, validation, auth state, and routing.
class _FakeAuthApi extends AuthApi {
  _FakeAuthApi() : super(Dio());
  @override
  Future<String> requestOtp(String phone) async => 'req_test';
  @override
  Future<VerifyOtpResult> verifyOtp(String requestId, String otp) async =>
      VerifyOtpResult(
        accessToken: 'access',
        refreshToken: 'refresh',
        user: const AuthUser(
          id: 'u1',
          role: UserRole.prospectiveStudent,
          displayName: 'Test User',
        ),
        isNewUser: false,
      );
  @override
  Future<void> logout() async {}
}

UserProfile _profile([String name = 'Test User']) => UserProfile(
      id: 'u1',
      role: UserRole.prospectiveStudent,
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
  Future<UserProfile> updateProfile({String? displayName, String? bio}) async =>
      _profile(displayName ?? 'Test User');
}

Widget _app() => ProviderScope(
      overrides: [
        authApiProvider.overrideWithValue(_FakeAuthApi()),
        usersApiProvider.overrideWithValue(_FakeUsersApi()),
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

    await tester.tap(find.text('Get Started'));
    await tester.pumpAndSettle();
    expect(find.text('Enter your mobile number'), findsOneWidget);

    // Button disabled until 10 digits entered.
    await tester.enterText(find.byType(TextField), '9876543210');
    await tester.pump();
    await tester.tap(find.text('Send OTP'));
    await tester.pumpAndSettle();
    expect(find.text('Enter the code'), findsOneWidget);
  });

  testWidgets('full journey: phone → OTP → authenticated → Home tabs',
      (tester) async {
    await _bootToWelcome(tester);

    await tester.tap(find.text('Get Started'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '9876543210');
    await tester.pump();
    await tester.tap(find.text('Send OTP'));
    await tester.pumpAndSettle();

    // Enter the 6-digit code → triggers verify → authenticates.
    await tester.enterText(find.byType(TextField), '472913');
    await tester.pumpAndSettle();

    // We must have left the OTP screen once authenticated.
    expect(find.text('Enter the code'), findsNothing);

    // Existing-user onboarding may land on profile setup first.
    if (find.text('Set up your profile').evaluate().isNotEmpty) {
      await tester.ensureVisible(find.text('Finish Setup'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Finish Setup'));
      await tester.pumpAndSettle();
    }

    // Authenticated main app.
    expect(find.text('Good evening'), findsOneWidget);

    // Switch to the Colleges tab via the bottom bar.
    await tester.tap(find.text('Colleges').last);
    await tester.pumpAndSettle();
    // A university that only appears on the Colleges list screen.
    expect(find.text('Kasturba Medical College'), findsOneWidget);
  });
}
