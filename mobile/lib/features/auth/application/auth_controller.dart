import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/storage/secure_token_storage.dart';
import '../domain/auth_user.dart';
import 'auth_state.dart';

/// Owns the session lifecycle. Replaces the RN Zustand `useAuthStore`:
/// restore-on-launch (was `onRehydrateStorage`), set-session, and sign-out.
///
/// OTP request/verify are added in the data layer pass once the backend
/// contract is confirmed (see `auth_api.dart`).
class AuthController extends Notifier<AuthState> {
  SecureTokenStorage get _storage => ref.read(secureTokenStorageProvider);

  @override
  AuthState build() => const AuthState.unknown();

  /// Cold-start restore: hydrate the session from secure storage.
  /// Call once from app init.
  Future<void> restore() async {
    final accessToken = await _storage.readAccessToken();
    final userJson = await _storage.readUser();

    if (accessToken == null || accessToken.isEmpty || userJson == null) {
      state = const AuthState.unauthenticated();
      return;
    }

    try {
      final user = AuthUser.fromJson(
        jsonDecode(userJson) as Map<String, dynamic>,
      );
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } catch (_) {
      await _storage.clear();
      state = const AuthState.unauthenticated();
    }
  }

  /// Persist a freshly issued session and mark the user authenticated.
  /// [needsOnboarding] is the verify response's `isNewUser` — it keeps the
  /// router in the role/profile-setup routes until [completeOnboarding].
  Future<void> setSession({
    required String accessToken,
    required String refreshToken,
    required AuthUser user,
    bool needsOnboarding = false,
  }) async {
    await _storage.saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
    );
    await _storage.saveUser(jsonEncode(user.toJson()));
    state = AuthState(
      status: AuthStatus.authenticated,
      user: user,
      needsOnboarding: needsOnboarding,
    );
  }

  /// New-user onboarding finished (role + display name set) → router moves to
  /// the main app.
  void completeOnboarding() {
    state = state.copyWith(needsOnboarding: false);
  }

  /// Update the cached user (e.g. after PATCH /users/me role/displayName).
  Future<void> updateUser(AuthUser user) async {
    await _storage.saveUser(jsonEncode(user.toJson()));
    state = state.copyWith(user: user);
  }

  /// Clear the session locally. Used by the Dio interceptor on refresh failure
  /// and by explicit logout.
  Future<void> signOut() async {
    await _storage.clear();
    state = const AuthState.unauthenticated();
  }
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);
