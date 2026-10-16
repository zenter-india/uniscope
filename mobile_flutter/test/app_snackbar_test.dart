import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope_mobile/widgets/app_widgets.dart';

/// Regression for Sentry UNISCOPE-MOBILE-4: showing a second snackbar within
/// 4 seconds of the first used to make the first one's timer remove its
/// overlay entry a second time — a null-check crash inside Flutter's overlay.
void main() {
  testWidgets('two snackbars in a row do not crash when the first times out', (
    tester,
  ) async {
    late BuildContext ctx;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            ctx = context;
            return const Scaffold();
          },
        ),
      ),
    );

    showAppSnackBar(ctx, 'first');
    await tester.pump(const Duration(seconds: 1));
    showAppSnackBar(ctx, 'second');
    await tester.pump();
    expect(find.text('first'), findsNothing);
    expect(find.text('second'), findsOneWidget);

    // Past the first snackbar's 4s timer and the second's.
    await tester.pump(const Duration(seconds: 5));
    expect(tester.takeException(), isNull);
    expect(find.text('second'), findsNothing);
  });

  testWidgets('a single snackbar dismisses itself after 4 seconds', (
    tester,
  ) async {
    late BuildContext ctx;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            ctx = context;
            return const Scaffold();
          },
        ),
      ),
    );
    showAppSnackBar(ctx, 'hello');
    await tester.pump();
    expect(find.text('hello'), findsOneWidget);
    await tester.pump(const Duration(seconds: 4));
    expect(find.text('hello'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
