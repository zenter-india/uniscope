import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope_mobile/core/theme/app_theme.dart';
import 'package:uniscope_mobile/features/wallet/low_balance_sheet.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    final l = FontLoader('Manrope');
    for (final w in ['Regular','Medium','SemiBold','Bold','ExtraBold']) {
      l.addFont(rootBundle.load('assets/fonts/Manrope-$w.ttf'));
    }
    await l.load();
  });
  for (final s in const [Size(360, 640), Size(320, 568)]) {
    for (final reserved in [0, 10]) {
      testWidgets('low-balance sheet fits (no overflow) at $s, reserved=$reserved', (t) async {
        t.view.physicalSize = s; t.view.devicePixelRatio = 1.0; addTearDown(t.view.reset);
        await t.pumpWidget(MaterialApp(theme: buildAppTheme(), home: Builder(builder: (c) => Scaffold(body: TextButton(onPressed: () => showLowBalanceSheet(c, balanceUniminutes: 3, reservedUniminutes: reserved), child: const Text('go'))))));
        await t.tap(find.text('go')); await t.pumpAndSettle();
      });
    }
  }
}
