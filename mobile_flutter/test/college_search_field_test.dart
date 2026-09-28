import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope_mobile/core/network/universities_api.dart';
import 'package:uniscope_mobile/features/auth/college_search_field.dart';

class _FakeUniversitiesApi extends UniversitiesApi {
  _FakeUniversitiesApi() : super(Dio());

  @override
  Future<List<University>> search(
    String query, {
    String? stream,
    String? level,
  }) async => [
    for (var i = 0; i < 8; i++)
      University(
        id: 'u$i',
        name: 'Test Medical College $i',
        slug: 'test-$i',
        state: 'Karnataka',
        city: 'Mangalore',
        establishedYear: 2000,
        website: null,
        description: null,
      ),
  ];
}

/// Regression test for the mentor-wizard College step: the field sits low on
/// the page with almost nothing below it, so at the instant it gains focus
/// the scroll view has no scrollable distance at all (no keyboard yet, no
/// results yet). The results list and the keyboard only make the page
/// scrollable a moment later — the field must still end up scrolled up
/// near the top, with its results visible above the keyboard.
void main() {
  testWidgets(
    'college search field scrolls up once results load, even when little '
    'content sits below it and the keyboard opens after focus',
    (tester) async {
      tester.view.physicalSize = const Size(400, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            universitiesApiProvider.overrideWithValue(_FakeUniversitiesApi()),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Stands in for the header + stream/degree chip groups
                    // above the College field on the mentor step.
                    const SizedBox(height: 400),
                    CollegeSearchField(
                      initialText: '',
                      stream: 'Medical',
                      onPick: (_, __, ___) {},
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final fieldFinder = find.byType(TextFormField);
      final topBefore = tester.getTopLeft(fieldFinder).dy;
      expect(topBefore, greaterThan(350)); // really is low on the page

      // Focus the field, THEN the keyboard slides up (as on a real device).
      await tester.tap(fieldFinder);
      await tester.pump();
      tester.view.viewInsets = const FakeViewPadding(bottom: 300);
      addTearDown(tester.view.resetViewInsets);
      // Debounce (250ms) + fake API + list render + scroll animation.
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pumpAndSettle();

      expect(find.text('Test Medical College 0, Mangalore, Karnataka'),
          findsOneWidget);
      final topAfter = tester.getTopLeft(fieldFinder).dy;
      // With the keyboard up only 500px are visible; the field must have
      // scrolled well up from ~416, not stayed where it was.
      expect(topAfter, lessThan(200));
    },
  );
}
