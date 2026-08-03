import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Roles mirror the backend enum.
enum UserRole {
  aspirant('ASPIRANT'),
  mentor('MENTOR'),
  admin('ADMIN');

  const UserRole(this.wire);

  /// The exact string exchanged with the API.
  final String wire;

  static UserRole fromWire(String value) {
    return UserRole.values.firstWhere(
      (r) => r.wire == value,
      orElse: () => UserRole.aspirant,
    );
  }
}

class AuthUser {
  const AuthUser({
    required this.id,
    required this.role,
    required this.displayName,
  });

  final String id;
  final UserRole role;
  final String displayName;

  AuthUser copyWith({String? id, UserRole? role, String? displayName}) {
    return AuthUser(
      id: id ?? this.id,
      role: role ?? this.role,
      displayName: displayName ?? this.displayName,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'role': role.wire,
        'displayName': displayName,
      };

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        id: json['id'] as String,
        role: UserRole.fromWire(json['role'] as String),
        displayName: (json['displayName'] as String?) ?? '',
      );
}

class AuthState {
  const AuthState({
    this.accessToken,
    this.refreshToken,
    this.user,
    this.isAuthenticated = false,
    this.isHydrated = false,
    this.needsOnboarding = false,
  });

  final String? accessToken;
  final String? refreshToken;
  final AuthUser? user;
  final bool isAuthenticated;
  final bool isHydrated;

  /// True from the moment a brand-new user verifies OTP until they complete
  /// (or explicitly skip) the role-selection → profile-setup → onboarding
  /// wizard chain. The router's redirect is the single source of truth for
  /// where this sends someone — screens no longer race it with their own
  /// context.go calls (see app_router.dart), which is what let earlier
  /// signups fall through to Home mid-onboarding as bare pseudonyms.
  final bool needsOnboarding;

  bool get isAdmin => user?.role == UserRole.admin;

  AuthState copyWith({
    String? accessToken,
    String? refreshToken,
    AuthUser? user,
    bool? isAuthenticated,
    bool? isHydrated,
    bool? needsOnboarding,
  }) {
    return AuthState(
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      user: user ?? this.user,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isHydrated: isHydrated ?? this.isHydrated,
      needsOnboarding: needsOnboarding ?? this.needsOnboarding,
    );
  }

  AuthState cleared() => AuthState(isHydrated: isHydrated);
}

/// Port of the Zustand `useAuthStore` persist store.
/// Tokens + user are persisted to secure storage and rehydrated on launch.
class AuthController extends Notifier<AuthState> {
  static const _key = 'auth-storage';

  FlutterSecureStorage get _storage => ref.read(secureStorageProvider);

  @override
  AuthState build() {
    _hydrate();
    return const AuthState();
  }

  Future<void> _hydrate() async {
    try {
      final raw = await _storage.read(key: _key);
      if (raw != null) {
        final data = jsonDecode(raw) as Map<String, dynamic>;
        final userJson = data['user'] as Map<String, dynamic>?;
        state = state.copyWith(
          accessToken: data['accessToken'] as String?,
          refreshToken: data['refreshToken'] as String?,
          user: userJson != null ? AuthUser.fromJson(userJson) : null,
          isAuthenticated: (data['isAuthenticated'] as bool?) ?? false,
          needsOnboarding: (data['needsOnboarding'] as bool?) ?? false,
        );
      }
    } catch (_) {
      // Corrupt payload — start clean.
    } finally {
      state = state.copyWith(isHydrated: true);
    }
  }

  Future<void> _persist() async {
    try {
      final payload = jsonEncode({
        'accessToken': state.accessToken,
        'refreshToken': state.refreshToken,
        'user': state.user?.toJson(),
        'isAuthenticated': state.isAuthenticated,
        'needsOnboarding': state.needsOnboarding,
      });
      await _storage.write(key: _key, value: payload);
    } catch (_) {
      // Keychain/secure-storage may be unavailable (e.g. unsigned desktop
      // builds). Auth still works for the session; it just won't persist.
    }
  }

  void setTokens(String accessToken, String refreshToken) {
    state = state.copyWith(accessToken: accessToken, refreshToken: refreshToken);
    _persist();
  }

  void setUser(AuthUser user) {
    state = state.copyWith(user: user);
    _persist();
  }

  void setAuth(
    String accessToken,
    String refreshToken,
    AuthUser user, {
    bool? needsOnboarding,
  }) {
    state = state.copyWith(
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: user,
      isAuthenticated: true,
      needsOnboarding: needsOnboarding ?? state.needsOnboarding,
    );
    _persist();
  }

  /// Called once a new user completes (or explicitly skips) the onboarding
  /// chain, so the router stops redirecting them back into it.
  void clearNeedsOnboarding() {
    state = state.copyWith(needsOnboarding: false);
    _persist();
  }

  void logout() {
    state = state.cleared();
    _persist();
  }
}

final secureStorageProvider = Provider<FlutterSecureStorage>(
  (ref) => const FlutterSecureStorage(),
);

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);
