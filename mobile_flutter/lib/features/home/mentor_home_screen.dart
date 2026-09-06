import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/mentors_api.dart';

/// Live "Today's Overview" figures for the mentor Home tab
/// (MentorLandingScreen) — today's session count / minutes consulted,
/// today's / weekly / monthly earnings, lifetime totals, rating, and the
/// most recent completed sessions. Real data from
/// `GET /mentors/me/dashboard-stats`.
final mentorDashboardStatsProvider =
    FutureProvider.autoDispose<MentorDashboardStats>((ref) {
      return ref.watch(mentorsApiProvider).getDashboardStats();
    });
