import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
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
    for (var i = 0; i < 3; i++)
      University(
        id: 'u$i',
        name: 'Test College $i',
        slug: 'test-$i',
        state: 'Karnataka',
        city: 'Mangalore',
        establishedYear: 2000,
        website: null,
        description: null,
      ),
  ];
}

/// On web/desktop a pointer-down outside the text field unfocuses it, and the
/// field closes its list 150ms after losing focus. A person's click (down ->
/// up) lasts longer than that, so the list used to vanish before the click
/// finished and "Not listed here" never fired. Regression test: hold the
/// press well past 150ms and expect the field to switch to manual entry.
void main() {
  testWidgets(
    '"Not listed here" still works when the press is held longer than the '
    'list-close delay',
    (tester) async {
      debugDefaultTargetPlatformOverride = TargetPlatform.windows;
      tester.view.physicalSize = const Size(400, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      String? lastText = 'unset';
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            universitiesApiProvider.overrideWithValue(_FakeUniversitiesApi()),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: CollegeSearchField(
                  initialText: '',
                  stream: 'Engineering',
                  onPick: (_, text, __) => lastText = text,
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byType(TextFormField));
      await tester.pumpAndSettle();
      expect(find.text('Not listed here'), findsOneWidget);

      // A human-speed click: down, wait 400ms, up.
      final gesture = await tester.startGesture(
        tester.getCenter(find.text('Not listed here')),
      );
      await tester.pump(const Duration(milliseconds: 400));
      await gesture.up();
      await tester.pumpAndSettle();

      // Manual-entry mode: the hint changes and "Back to search" appears.
      expect(find.text('Back to search'), findsOneWidget);
      expect(lastText, '');
      // Must be reset inside the body: the framework checks it before tearDown.
      debugDefaultTargetPlatformOverride = null;
    },
  );
}
