import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope/features/auth/application/auth_state.dart';
import 'package:uniscope/features/auth/domain/auth_user.dart';

void main() {
  group('UserRole', () {
    test('maps every backend wire value (incl. MENTOR)', () {
      expect(UserRole.fromWire('PROSPECTIVE_STUDENT'),
          UserRole.prospectiveStudent,);
      expect(UserRole.fromWire('CURRENT_STUDENT'), UserRole.currentStudent);
      expect(UserRole.fromWire('ALUMNI'), UserRole.alumni);
      expect(UserRole.fromWire('MENTOR'), UserRole.mentor);
      expect(UserRole.fromWire('ADMIN'), UserRole.admin);
    });

    test('falls back to prospectiveStudent on unknown value', () {
      expect(UserRole.fromWire('SOMETHING_NEW'), UserRole.prospectiveStudent);
    });
  });

  group('AuthUser', () {
    test('round-trips through JSON', () {
      final user = AuthUser.fromJson({
        'id': 'u1',
        'role': 'MENTOR',
        'displayName': 'Mentor_42',
      });

      expect(user.id, 'u1');
      expect(user.role, UserRole.mentor);
      expect(user.displayName, 'Mentor_42');

      final json = user.toJson();
      expect(json['role'], 'MENTOR');
      expect(AuthUser.fromJson(json).role, UserRole.mentor);
    });
  });

  group('AuthState', () {
    test('isAuthenticated/isAdmin derive from status + role', () {
      const unauthed = AuthState.unauthenticated();
      expect(unauthed.isAuthenticated, isFalse);

      const admin = AuthState(
        status: AuthStatus.authenticated,
        user: AuthUser(
          id: 'a1',
          role: UserRole.admin,
          displayName: 'Admin',
        ),
      );
      expect(admin.isAuthenticated, isTrue);
      expect(admin.isAdmin, isTrue);
    });

    test('copyWith preserves needsOnboarding unless overridden', () {
      const base = AuthState(status: AuthStatus.authenticated, needsOnboarding: true);
      expect(base.copyWith().needsOnboarding, isTrue);
      expect(base.copyWith(needsOnboarding: false).needsOnboarding, isFalse);
    });
  });
}
