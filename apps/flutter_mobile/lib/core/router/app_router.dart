import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/splash_screen.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/project/project_detail_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/settings/settings_screen.dart';
import '../../features/feedback/feedback_screen.dart';
import '../../features/help/help_screen.dart';
import '../../features/help/help_walkthroughs_screen.dart';
import '../../features/help/help_videos_screen.dart';
import '../../features/help/help_documents_screen.dart';
import '../../features/legal/datenschutz_screen.dart';
import '../../features/legal/impressum_screen.dart';
import '../../features/notifications/notifications_screen.dart';
import '../widgets/app_shell.dart';

// Auth state change notifier for GoRouter refresh
class _AuthChangeNotifier extends ChangeNotifier {
  _AuthChangeNotifier(Ref ref) {
    ref.listen<AuthState>(authProvider, (_, __) => notifyListeners());
  }
}

final _authChangeNotifierProvider = Provider<_AuthChangeNotifier>((ref) {
  return _AuthChangeNotifier(ref);
});

final appRouterProvider = Provider<GoRouter>((ref) {
  final authNotifier = ref.watch(_authChangeNotifierProvider);

  return GoRouter(
    initialLocation: '/splash',
    debugLogDiagnostics: false,
    refreshListenable: authNotifier,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final loc = state.matchedLocation;
      if (loc == '/splash') return null; // always allow splash
      if (auth.loading) return null;
      final isLoggedIn = auth.userId != null;
      final isLoginRoute = loc == '/login';

      if (!isLoggedIn && !isLoginRoute) return '/login';
      if (isLoggedIn && isLoginRoute) return '/';
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const DashboardScreen(),
          ),
          GoRoute(
            path: '/profile',
            builder: (context, state) => const ProfileScreen(),
          ),
          GoRoute(
            path: '/notifications',
            builder: (context, state) => const NotificationsScreen(),
          ),
          GoRoute(
            path: '/settings',
            builder: (context, state) => const SettingsScreen(),
          ),
          GoRoute(
            path: '/feedback',
            builder: (context, state) => const FeedbackScreen(),
          ),
          GoRoute(
            path: '/help',
            builder: (context, state) => const HelpScreen(),
          ),
          GoRoute(
            path: '/help/erste-schritte',
            builder: (context, state) => const HelpWalkthroughsScreen(),
          ),
          GoRoute(
            path: '/help/video-tutorials',
            builder: (context, state) => const HelpVideosScreen(),
          ),
          GoRoute(
            path: '/help/dokumentation',
            builder: (context, state) => const HelpDocumentsScreen(),
          ),
          GoRoute(
            path: '/datenschutz',
            builder: (context, state) => const DatenschutzScreen(),
          ),
          GoRoute(
            path: '/impressum',
            builder: (context, state) => const ImpressumScreen(),
          ),
        ],
      ),
      // Project detail — all sub-pages are embedded inside ProjectDetailScreen
      // via a drawer-based navigation. No sub-routes needed.
      GoRoute(
        path: '/project/:projectId',
        builder: (context, state) {
          final projectId = state.pathParameters['projectId']!;
          return ProjectDetailScreen(projectId: projectId);
        },
      ),
    ],
  );
});
