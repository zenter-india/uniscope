import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/theme/app_theme.dart';
import '../features/admin/admin_dashboard_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/otp_screen.dart';
import '../features/auth/profile_setup_screen.dart';
import '../features/auth/role_selection_screen.dart';
import '../features/auth/welcome_screen.dart';
import '../features/common/placeholder_screen.dart';
import '../features/home/home_screen.dart';
import '../features/mentors/mentor_list_screen.dart';
import '../features/profile/profile_home_screen.dart';
import '../features/sessions/session_chat_screen.dart';
import '../features/sessions/session_list_screen.dart';
import '../features/shell/main_shell.dart';
import '../features/universities/university_detail_screen.dart';
import '../features/universities/university_list_screen.dart';
import '../features/verification/verification_screen.dart';
import '../features/wallet/wallet_screen.dart';
import '../state/auth_controller.dart';

const _preAuthRoutes = {'/welcome', '/login', '/otp'};

/// Port of RN `RootNavigator` gating, expressed as a go_router redirect:
///  - not hydrated  → splash
///  - admin user    → /admin
///  - authenticated → main tabs (onboarding routes still reachable)
///  - anonymous     → auth flow
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.onDispose(refresh.dispose);
  ref.listen(authControllerProvider, (_, __) => refresh.value++);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final loc = state.matchedLocation;

      if (!auth.isHydrated) {
        return loc == '/' ? null : '/';
      }

      if (auth.isAdmin) {
        return loc.startsWith('/admin') ? null : '/admin';
      }

      if (auth.isAuthenticated) {
        if (loc == '/' || loc.startsWith('/admin') || _preAuthRoutes.contains(loc)) {
          return '/home';
        }
        return null;
      }

      // Anonymous: only the pre-auth screens are allowed.
      if (_preAuthRoutes.contains(loc)) return null;
      return '/welcome';
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const _SplashScreen()),

      // ─── Auth flow ──────────────────────────────────────────────
      GoRoute(path: '/welcome', builder: (_, __) => const WelcomeScreen()),
      GoRoute(
        path: '/login',
        builder: (_, __) => const LoginScreen(),
      ),
      GoRoute(
        path: '/otp',
        builder: (_, state) {
          final args = state.extra as Map<String, dynamic>? ?? const {};
          return OtpScreen(
            phone: args['phone'] as String? ?? '',
            serviceId: args['serviceId'] as String? ?? '',
          );
        },
      ),
      GoRoute(
        path: '/role-selection',
        builder: (_, __) => const RoleSelectionScreen(),
      ),
      GoRoute(
        path: '/profile-setup',
        builder: (_, __) => const ProfileSetupScreen(),
      ),

      // ─── Main tabs (StatefulShellRoute keeps the bottom bar) ─────
      StatefulShellRoute.indexedStack(
        builder: (_, __, shell) => MainShell(navigationShell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/colleges',
                builder: (_, __) => const UniversityListScreen(),
                routes: [
                  GoRoute(
                    path: 'detail',
                    builder: (_, state) {
                      final a = state.extra as Map<String, dynamic>? ?? const {};
                      return UniversityDetailScreen(
                        universityId: a['universityId'] as String? ?? '',
                        universityName: a['universityName'] as String? ?? '',
                      );
                    },
                  ),
                  GoRoute(
                    path: 'reviews',
                    builder: (_, __) => const PlaceholderScreen(title: 'Reviews'),
                  ),
                  GoRoute(
                    path: 'questions',
                    builder: (_, __) => const PlaceholderScreen(title: 'Q&A'),
                  ),
                  GoRoute(
                    path: 'students',
                    builder: (_, __) =>
                        const PlaceholderScreen(title: 'Verified Students'),
                  ),
                  GoRoute(
                    path: 'alumni',
                    builder: (_, __) => const PlaceholderScreen(title: 'Alumni'),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/mentors',
                builder: (_, __) => const MentorListScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/chats',
                builder: (_, __) => const SessionListScreen(),
                routes: [
                  GoRoute(
                    path: 'room',
                    builder: (_, state) {
                      final a = state.extra as Map<String, dynamic>? ?? const {};
                      return SessionChatScreen(
                        sessionId: a['sessionId'] as String? ?? '',
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                builder: (_, __) => const ProfileHomeScreen(),
                routes: [
                  GoRoute(
                    path: 'wallet',
                    builder: (_, __) => const WalletScreen(),
                  ),
                  GoRoute(
                    path: 'verification',
                    builder: (_, __) => const VerificationScreen(),
                  ),
                  GoRoute(
                    path: 'edit',
                    builder: (_, __) =>
                        const PlaceholderScreen(title: 'Edit Profile'),
                  ),
                  GoRoute(
                    path: 'settings',
                    builder: (_, __) => const PlaceholderScreen(title: 'Settings'),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),

      // ─── Admin ──────────────────────────────────────────────────
      GoRoute(
        path: '/admin',
        builder: (_, __) => const AdminDashboardScreen(),
        routes: [
          GoRoute(
            path: 'verification-queue',
            builder: (_, __) =>
                const PlaceholderScreen(title: 'Verification Queue'),
          ),
          GoRoute(
            path: 'moderation-queue',
            builder: (_, __) =>
                const PlaceholderScreen(title: 'Moderation Queue'),
          ),
          GoRoute(
            path: 'users',
            builder: (_, __) => const PlaceholderScreen(title: 'User Management'),
          ),
          GoRoute(
            path: 'universities',
            builder: (_, __) =>
                const PlaceholderScreen(title: 'University Management'),
          ),
        ],
      ),
    ],
  );
});

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: AppColors.surface,
      body: Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      ),
    );
  }
}
