import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope_mobile/features/auth/onboarding_widgets.dart';

void main() {
  Future<void> openSheet(WidgetTester tester, {String? bypassExample}) async {
    tester.view.physicalSize = const Size(400, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: bypassExample == null
                ? OnboardingSearchableField(
                    value: null,
                    hint: 'Select specialization',
                    options: const ['Cardiology', 'Paediatrics'],
                    onChanged: (_) {},
                  )
                : OnboardingSearchableField(
                    value: null,
                    hint: 'Select specialization',
                    options: const ['Cardiology', 'Paediatrics'],
                    bypassExample: bypassExample,
                    onChanged: (_) {},
                  ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Select specialization'));
    await tester.pumpAndSettle();
  }

  testWidgets(
    'the specialization picker shows its own "different form" example and the '
    '"Not listed here" option',
    (tester) async {
      await openSheet(tester, bypassExample: kSpecializationBypassExample);

      expect(find.text('Try searching in a different form'), findsOneWidget);
      expect(
        find.text(
          'e.g. search "MD - Social & Preventive Medicine / Community Medicine" '
          'instead of "MD-PSM"',
        ),
        findsOneWidget,
      );
      expect(find.text('Not listed here'), findsOneWidget);
      // The old generic wording is gone from this picker.
      expect(find.text(kGenericBypassExample), findsNothing);
    },
  );

  testWidgets('a picker that does not pass an example keeps the generic one', (
    tester,
  ) async {
    await openSheet(tester);

    expect(find.text(kGenericBypassExample), findsOneWidget);
    expect(find.text(kSpecializationBypassExample), findsNothing);
  });
}
