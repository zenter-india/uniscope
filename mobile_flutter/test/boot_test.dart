import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope_mobile/main.dart';

void main() {
  // Stub the flutter_secure_storage method channel so hydration resolves
  // (there is no native plugin backend in the test harness).
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      if (call.method == 'read') return null;
      if (call.method == 'readAll') return <String, String>{};
      return null;
    });
  });

  testWidgets('app compiles, boots, and lands on the Welcome screen',
      (tester) async {
    await tester.pumpWidget(const ProviderScope(child: UniscopeApp()));

    // Splash renders first while auth state hydrates.
    expect(find.byType(MaterialApp), findsOneWidget);

    // Let hydration resolve and the router redirect fire.
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }

    // Anonymous user → Welcome screen.
    expect(find.text('Get Started'), findsOneWidget);
    expect(find.text('Uniscope'), findsOneWidget);
  });
}
