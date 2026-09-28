import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope_mobile/core/network/mentors_api.dart';
import 'package:uniscope_mobile/core/network/universities_api.dart';
import 'package:uniscope_mobile/features/home/mentor_home_screen.dart';
import 'package:uniscope_mobile/features/home/mentor_landing_screen.dart';
import 'package:uniscope_mobile/features/mentors/mentor_reviews_screen.dart';
import 'package:uniscope_mobile/features/notifications/notifications_screen.dart';
import 'package:uniscope_mobile/widgets/app_widgets.dart';

const _stats = MentorDashboardStats(
  todaysSessionsCount: 0,
  minutesConsultedToday: 0,
  todaysEarningsMinor: 0,
  weeklyEarningsMinor: 0,
  monthlyEarningsMinor: 0,
  totalSessionsCount: 0,
  totalMinutesConsulted: 0,
  rating: null,
  reviewCount: 0,
  recentSessions: [],
);

/// The mentor Home's "Today's Overview" grid: the two tiles in each row must
/// always be the same height. A plain Row centres its children, so a tile
/// whose label wrapped to a second line ("Minutes Consulted" beside
/// "Today's Sessions") was taller than its neighbour — the right column
/// looked bigger than the left (real device screenshot).
///
/// Whether a label wraps depends on the screen width and font, and the test
/// harness's font isn't the app's, so instead of trusting one hand-picked
/// width this sweeps a wide range of them: in the buggy layout at least some
/// widths put a wrapping label on one side only.
void main() {
  testWidgets('stat tiles in a row are always the same height', (tester) async {
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          mentorDashboardStatsProvider.overrideWith((ref) async => _stats),
          myMentorReviewsProvider.overrideWith((ref) async => const []),
          topCollegesForMentorProvider.overrideWith(
            (ref) async => const <University>[],
          ),
          unreadCountProvider.overrideWith((ref) async => 0),
        ],
        child: const MaterialApp(home: Scaffold(body: MentorLandingScreen())),
      ),
    );

    const pairs = [
      ("Today's Sessions", 'Minutes Consulted'),
      ("Today's Earnings", 'Weekly Earnings'),
      ('Average Rating', 'Sessions Completed'),
    ];

    Size tileSize(String label) => tester.getSize(
      find
          .ancestor(of: find.text(label), matching: find.byType(AppCard))
          .first,
    );

    final mismatches = <String>[];
    for (var width = 300.0; width <= 480.0; width += 4) {
      tester.view.physicalSize = Size(width, 900);
      await tester.pumpAndSettle();
      for (final (left, right) in pairs) {
        final l = tileSize(left).height;
        final r = tileSize(right).height;
        if ((l - r).abs() > 0.5) {
          mismatches.add('w=$width "$left"=$l vs "$right"=$r');
        }
      }
    }

    expect(
      mismatches,
      isEmpty,
      reason: 'tiles in a row differ in height at ${mismatches.length} '
          'width/row combinations, e.g. ${mismatches.take(3).join('; ')}',
    );
  });
}
