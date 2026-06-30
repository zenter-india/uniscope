/// Typed route paths — screens never hardcode path strings.
class Routes {
  Routes._();

  static const splash = '/splash';

  // Auth
  static const welcome = '/welcome';
  static const login = '/login';
  static const otp = '/otp';
  static const roleSelection = '/role';
  static const profileSetup = '/profile-setup';

  // Main (authenticated)
  static const home = '/home';

  // Admin
  static const adminDashboard = '/admin';

  /// Routes that belong to the unauthenticated/onboarding auth flow.
  static const authRoutes = <String>{
    splash,
    welcome,
    login,
    otp,
    roleSelection,
    profileSetup,
  };

  /// Routes a new user may sit on while finishing onboarding (post-OTP).
  static const onboardingRoutes = <String>{roleSelection, profileSetup};
}

/// Arguments passed from Login → OTP (via go_router `extra`).
class OtpArgs {
  const OtpArgs({required this.phone, required this.serviceId});

  final String phone;
  final String serviceId;
}
