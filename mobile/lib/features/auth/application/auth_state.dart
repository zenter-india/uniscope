import '../domain/auth_user.dart';

/// Where the app is in the auth lifecycle. Drives the router redirect/auth-gate
/// (replaces the RN `isAuthenticated` + `isHydrated` flags on the Zustand store).
enum AuthStatus {
  /// Still restoring tokens from secure storage on cold start.
  unknown,
  authenticated,
  unauthenticated,
}

class AuthState {
  const AuthState({
    this.status = AuthStatus.unknown,
    this.user,
    this.needsOnboarding = false,
  });

  final AuthStatus status;
  final AuthUser? user;

  /// True for a freshly-verified new user who must still pick a role + set a
  /// display name (the RN OTP→RoleSelection→ProfileSetup sequence). The router
  /// keeps such a user in the onboarding routes until it clears.
  final bool needsOnboarding;

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get isAdmin => user?.role == UserRole.admin;

  const AuthState.unknown() : this(status: AuthStatus.unknown);
  const AuthState.unauthenticated() : this(status: AuthStatus.unauthenticated);

  AuthState copyWith({
    AuthStatus? status,
    AuthUser? user,
    bool? needsOnboarding,
  }) =>
      AuthState(
        status: status ?? this.status,
        user: user ?? this.user,
        needsOnboarding: needsOnboarding ?? this.needsOnboarding,
      );
}
