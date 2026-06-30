import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/main_shell.dart';
import '../../features/admin/presentation/admin_dashboard_screen.dart';
import '../../features/auth/application/auth_controller.dart';
import '../../features/auth/application/auth_state.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/otp_screen.dart';
import '../../features/auth/presentation/profile_setup_screen.dart';
import '../../features/auth/presentation/role_selection_screen.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/auth/presentation/welcome_screen.dart';
import 'routes.dart';

/// Builds the app router. The `redirect` reproduces the RN `RootNavigator`
/// auth gate (splash while hydrating → auth flow → onboarding → admin/main),
/// and `refreshListenable` re-evaluates it whenever auth state changes — the
/// faithful analogue of the RN store-driven root re-render.
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.listen(authControllerProvider, (_, __) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: Routes.splash,
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final loc = state.matchedLocation;

      // 1. Still restoring tokens from secure storage → stay on splash.
      if (auth.status == AuthStatus.unknown) {
        return loc == Routes.splash ? null : Routes.splash;
      }

      final isAuthRoute = Routes.authRoutes.contains(loc);
      final isOnboardingRoute = Routes.onboardingRoutes.contains(loc);
      final isAdminRoute = loc.startsWith(Routes.adminDashboard);

      // 2. Unauthenticated → auth flow (never sit on splash once hydrated).
      if (!auth.isAuthenticated) {
        if (loc == Routes.splash) return Routes.welcome;
        return isAuthRoute ? null : Routes.welcome;
      }

      // 3. Authenticated new user finishing onboarding → role/profile only.
      if (auth.needsOnboarding) {
        return isOnboardingRoute ? null : Routes.roleSelection;
      }

      // 4. Authenticated admin → admin tree.
      if (auth.isAdmin) {
        return isAdminRoute ? null : Routes.adminDashboard;
      }

      // 5. Authenticated normal user → main app; bounce off auth/admin routes.
      if (isAuthRoute || isAdminRoute) return Routes.home;
      return null;
    },
    routes: [
      GoRoute(
        path: Routes.splash,
        builder: (_, __) => const SplashScreen(),
      ),
      GoRoute(
        path: Routes.welcome,
        builder: (_, __) => const WelcomeScreen(),
      ),
      GoRoute(
        path: Routes.login,
        builder: (_, __) => const LoginScreen(),
      ),
      GoRoute(
        path: Routes.otp,
        builder: (_, state) {
          final args = state.extra;
          // Guard against a direct hit without args (e.g. deep link).
          if (args is! OtpArgs) return const LoginScreen();
          return OtpScreen(args: args);
        },
      ),
      GoRoute(
        path: Routes.roleSelection,
        builder: (_, __) => const RoleSelectionScreen(),
      ),
      GoRoute(
        path: Routes.profileSetup,
        builder: (_, __) => const ProfileSetupScreen(),
      ),
      GoRoute(
        path: Routes.home,
        builder: (_, __) => const MainShell(),
      ),
      GoRoute(
        path: Routes.adminDashboard,
        builder: (_, __) => const AdminDashboardScreen(),
      ),
    ],
  );
});
