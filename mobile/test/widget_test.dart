// Smoke test — verifies the app boots without crashing.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:uniscope/app/app.dart';

void main() {
  testWidgets('app boots without crashing', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: UniscopeApp()));
  });
}
