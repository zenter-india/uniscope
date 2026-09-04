import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/admin/admin_dashboard_screen.dart';
import '../features/auth/aspirant_onboarding_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/mentor_onboarding_screen.dart';
import '../features/auth/otp_screen.dart';
import '../features/auth/profile_setup_screen.dart';
import '../features/auth/role_selection_screen.dart';
import '../features/auth/splash_screen.dart';
import '../features/auth/welcome_screen.dart';
import '../features/calls/call_screen.dart';
import '../features/common/placeholder_screen.dart';
import '../features/common/web_page_screen.dart';
import '../features/home/home_screen.dart';
import '../features/home/mentor_home_screen.dart';
import '../features/home/mentor_landing_screen.dart';
import '../features/mentors/mentor_detail_screen.dart';
import '../features/mentors/mentor_list_screen.dart';
import '../features/mentors/saved_mentors_screen.dart';
import '../features/notifications/notifications_screen.dart';
import '../features/profile/avatar_customizer_screen.dart';
import '../features/profile/blocked_users_screen.dart';
import '../features/profile/edit_profile_screen.dart';
import '../features/profile/profile_home_screen.dart';
import '../features/profile/settings_screen.dart';
import '../features/sessions/session_chat_screen.dart';
import '../features/sessions/session_list_screen.dart';
import '../features/sessions/support_chat_screen.dart';
import '../features/shell/main_shell.dart';
import '../features/universities/review_breakdown_screen.dart';
import '../features/universities/saved_colleges_screen.dart';
import '../features/universities/university_detail_screen.dart';
import '../features/universities/university_list_screen.dart';
import '../features/verification/verification_screen.dart';
import '../features/wallet/wallet_screen.dart';
import '../state/auth_controller.dart';

/// Lets code with no BuildContext (the FCM push handlers in
/// core/push/push_service.dart, which fire from a background isolate or
/// before any screen has built) navigate anyway — e.g. deep-linking straight
/// into '/call/:sessionId' when a "mentor accepted" push arrives.
final rootNavigatorKey = GlobalKey<NavigatorState>();

const _preAuthRoutes = {'/welcome', '/login', '/otp', '/legal'};

// Role-selection through the role-specific wizard. While AuthState.
// needsOnboarding is true, redirect keeps a user inside this set instead of
// letting them fall through to Home mid-signup (see AuthState docs).
const _onboardingRoutes = {
  '/role-selection',
  '/profile-setup',
  '/aspirant-onboarding',
  '/mentor-onboarding',
};

// Order must exactly match the StatefulShellRoute branch order below.
const _aspirantTabs = <TabItem>[
  TabItem('Home', Icons.home_outlined, Icons.home_rounded),
  TabItem('Discover', Icons.explore_outlined, Icons.explore_rounded),
  TabItem('Mentors', Icons.people_alt_outlined, Icons.people_alt_rounded),
  TabItem('Sessions', Icons.forum_outlined, Icons.forum_rounded),
  TabItem('Wallet', Icons.account_balance_wallet_outlined,
      Icons.account_balance_wallet_rounded),
  TabItem('Profile', Icons.person_outline_rounded, Icons.person_rounded),
];

const _mentorTabs = <TabItem>[
  TabItem('Home', Icons.home_outlined, Icons.home_rounded),
  TabItem('Discover', Icons.explore_outlined, Icons.explore_rounded),
  TabItem('Sessions', Icons.calendar_today_outlined, Icons.calendar_today_rounded),
  TabItem('Dashboard', Icons.dashboard_outlined, Icons.dashboard_rounded),
  TabItem('Profile', Icons.person_outline_rounded, Icons.person_rounded),
];

List<StatefulShellBranch> _buildAspirantBranches() => [
      StatefulShellBranch(
        routes: [GoRoute(path: '/home', builder: (_, __) => const HomeScreen())],
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
                    universitySlug: a['universitySlug'] as String? ?? '',
                    universityName: a['universityName'] as String? ?? '',
                  );
                },
              ),
              GoRoute(path: 'saved', builder: (_, __) => const SavedCollegesScreen()),
              GoRoute(
                path: 'reviews',
                builder: (_, state) {
                  final a = state.extra as Map<String, dynamic>? ?? const {};
                  return ReviewBreakdownScreen(
                    universityId: a['universityId'] as String? ?? '',
                    universityName: a['universityName'] as String? ?? '',
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
            path: '/mentors',
            builder: (_, __) => const MentorListScreen(),
            routes: [
              // Must precede ':id' — go_router matches in order, and the
              // wildcard would otherwise capture "saved" as a mentor id.
              GoRoute(
                path: 'saved',
                builder: (_, __) => const SavedMentorsScreen(),
              ),
              GoRoute(
                path: ':id',
                builder: (_, state) =>
                    MentorDetailScreen(mentorId: state.pathParameters['id']!),
              ),
            ],
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
                  return SessionChatScreen(sessionId: a['sessionId'] as String? ?? '');
                },
              ),
              GoRoute(path: 'support', builder: (_, __) => const SupportChatScreen()),
            ],
          ),
        ],
      ),
      StatefulShellBranch(
        routes: [
          GoRoute(path: '/wallet', builder: (_, __) => const WalletScreen()),
        ],
      ),
      StatefulShellBranch(routes: [_profileRoute]),
    ];

List<StatefulShellBranch> _buildMentorBranches() => [
      StatefulShellBranch(
        routes: [
          GoRoute(path: '/home', builder: (_, __) => const MentorLandingScreen()),
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
                    universitySlug: a['universitySlug'] as String? ?? '',
                    universityName: a['universityName'] as String? ?? '',
                  );
                },
              ),
              GoRoute(path: 'saved', builder: (_, __) => const SavedCollegesScreen()),
              GoRoute(
                path: 'reviews',
                builder: (_, state) {
                  final a = state.extra as Map<String, dynamic>? ?? const {};
                  return ReviewBreakdownScreen(
                    universityId: a['universityId'] as String? ?? '',
                    universityName: a['universityName'] as String? ?? '',
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
            path: '/chats',
            builder: (_, __) => const SessionListScreen(),
            routes: [
              GoRoute(
                path: 'room',
                builder: (_, state) {
                  final a = state.extra as Map<String, dynamic>? ?? const {};
                  return SessionChatScreen(sessionId: a['sessionId'] as String? ?? '');
                },
              ),
              GoRoute(path: 'support', builder: (_, __) => const SupportChatScreen()),
            ],
          ),
        ],
      ),
      StatefulShellBranch(
        routes: [
          GoRoute(
            path: '/dashboard',
            builder: (_, __) => const MentorDashboardScreen(),
            // Wallet is no longer its own bottom-nav tab for mentors (see
            // the Dashboard's wallet card) — pushed from there instead,
            // nested here rather than top-level to avoid colliding with
            // the aspirant-only top-level '/wallet' route below.
            routes: [
              GoRoute(path: 'wallet', builder: (_, __) => const WalletScreen()),
            ],
          ),
        ],
      ),
      StatefulShellBranch(routes: [_profileRoute]),
    ];

final _aspirantBranches = _buildAspirantBranches();
final _mentorBranches = _buildMentorBranches();

final _profileRoute = GoRoute(
  path: '/profile',
  builder: (_, __) => const ProfileHomeScreen(),
  routes: [
    GoRoute(path: 'verification', builder: (_, __) => const VerificationScreen()),
    GoRoute(path: 'edit', builder: (_, __) => const EditProfileScreen()),
    GoRoute(path: 'avatar', builder: (_, __) => const AvatarCustomizerScreen()),
    GoRoute(path: 'settings', builder: (_, __) => const SettingsScreen()),
    GoRoute(path: 'blocked-users', builder: (_, __) => const BlockedUsersScreen()),
  ],
);

/// Port of RN `RootNavigator` gating, expressed as a go_router redirect:
///  - not hydrated  → splash
///  - admin user    → /admin
///  - authenticated → main tabs (onboarding routes still reachable)
///  - anonymous     → auth flow
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.onDispose(refresh.dispose);
  ref.listen(authControllerProvider, (_, __) => refresh.value++);

  // Aspirant and Mentor have genuinely different bottom-nav tab sets (see
  // Figma) — rebuilding the whole GoRouter (not just re-running redirect)
  // when role changes is the only clean way to swap StatefulShellRoute's
  // branches, since that list can't be mutated after construction.
  final role = ref.watch(authControllerProvider.select((s) => s.user?.role));
  final isMentor = role == UserRole.mentor;

  return GoRouter(
    navigatorKey: rootNavigatorKey,
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
        if (auth.needsOnboarding) {
          return _onboardingRoutes.contains(loc) ? null : '/role-selection';
        }
        if (loc == '/' ||
            loc.startsWith('/admin') ||
            _preAuthRoutes.contains(loc) ||
            _onboardingRoutes.contains(loc)) {
          return '/home';
        }
        return null;
      }

      // Anonymous: only the pre-auth screens are allowed.
      if (_preAuthRoutes.contains(loc)) return null;
      return '/welcome';
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const UniscopeSplashScreen()),

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
        path: '/legal',
        builder: (_, state) {
          final args = state.extra as Map<String, dynamic>? ?? const {};
          return WebPageScreen(
            title: args['title'] as String? ?? 'Uniscope',
            url: args['url'] as String? ?? 'https://uniscope.in/privacy',
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
      GoRoute(
        path: '/aspirant-onboarding',
        builder: (_, __) => const AspirantOnboardingScreen(),
      ),
      GoRoute(
        path: '/mentor-onboarding',
        builder: (_, __) => const MentorOnboardingScreen(),
      ),

      // ─── Audio call (full-screen, outside the bottom-nav shell) ──
      GoRoute(
        path: '/call/:sessionId',
        builder: (_, state) => CallScreen(sessionId: state.pathParameters['sessionId']!),
      ),

      // ─── Notifications (pushed from the bell icon anywhere) ──────
      GoRoute(
        path: '/notifications',
        builder: (_, __) => const NotificationsScreen(),
      ),

      // Wallet needs no top-level standalone route for either role anymore:
      // aspirants reach it via their own "Wallet" bottom-nav tab, and
      // mentors via the Dashboard's wallet card at the nested
      // '/dashboard/wallet' path — see the branch lists below.

      // ─── Main tabs (StatefulShellRoute keeps the bottom bar) ─────
      // Branch order must exactly match the tab list passed to MainShell.
      // Aspirant: Home | Discover | Mentors | Sessions | Wallet | Profile
      // Mentor:   Home | Discover | Sessions | Dashboard | Profile
      // Fully separate branch lists (rather than one shared list with
      // conditionals) since the two roles' tab orders and screen counts
      // diverge too much to share cleanly.
      StatefulShellRoute.indexedStack(
        builder: (_, __, shell) => MainShell(
          navigationShell: shell,
          tabs: isMentor ? _mentorTabs : _aspirantTabs,
        ),
        branches: isMentor ? _mentorBranches : _aspirantBranches,
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
