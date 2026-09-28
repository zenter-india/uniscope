import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope_mobile/core/network/wallet_api.dart';
import 'package:uniscope_mobile/core/theme/app_theme.dart';
import 'package:uniscope_mobile/features/wallet/wallet_screen.dart';

/// The app's own font, so text wraps as it does on a real phone — the test
/// harness's default is a wide blocky font that wraps far more.
Future<void> _loadManrope() async {
  final loader = FontLoader('Manrope');
  for (final weight in ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']) {
    loader.addFont(rootBundle.load('assets/fonts/Manrope-$weight.ttf'));
  }
  await loader.load();
}

Future<void> _openTopUpSheet(WidgetTester tester, Size logicalSize) async {
  tester.view.physicalSize = logicalSize;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        walletBalanceProvider.overrideWith(
          (ref) async => const Wallet(id: 'w1', balanceMinor: 880000),
        ),
        walletLedgerProvider.overrideWith((ref) async => const <LedgerEntry>[]),
      ],
      child: MaterialApp(
        theme: buildAppTheme(),
        home: const Scaffold(body: WalletScreen()),
      ),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('Top Up'));
  await tester.pumpAndSettle();
}

/// Every part of the sheet must be reachable on this screen size — the last
/// package and the refund link are what a too-tall, non-scrolling sheet
/// silently clips off the bottom.
Future<void> _expectSheetReachable(WidgetTester tester, Size size) async {
  for (final label in ['Insider Pass', 'Refund & Cancellation Policy']) {
    await tester.ensureVisible(find.text(label));
    await tester.pumpAndSettle();
    final rect = tester.getRect(find.text(label));
    expect(rect.top, greaterThanOrEqualTo(0), reason: '"$label" above screen');
    expect(
      rect.bottom,
      lessThanOrEqualTo(size.height),
      reason: '"$label" is cut off below the screen',
    );
  }
}

/// The Razorpay (Android) top-up sheet has to fit on every real phone size: a
/// non-scrolling sheet is capped at 9/16 of the screen height, and the package
/// names + taglines make it far taller than that, silently clipping the last
/// pack and the refund link in release builds. (iOS uses StoreKit, which needs
/// the store to load products, so it isn't covered here.)
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(_loadManrope);

  // Logical sizes of real devices.
  const phones = {
    'iPhone SE (375x667)': Size(375, 667),
    'iPhone 15 (393x852)': Size(393, 852),
    'small Android (360x640)': Size(360, 640),
    'Android (360x800)': Size(360, 800),
    'Pixel (412x915)': Size(412, 915),
  };

  for (final MapEntry(key: name, value: size) in phones.entries) {
    testWidgets('Android top-up sheet fits and is fully reachable — $name', (tester) async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      try {
        await _openTopUpSheet(tester, size);
        for (final price in ['₹250', '₹400', '₹750', '₹1000']) {
          expect(find.text(price), findsOneWidget, reason: '$price missing');
        }
        await _expectSheetReachable(tester, size);
        for (final price in ['₹325', '₹520', '₹975', '₹1300']) {
          expect(find.text(price), findsNothing, reason: '$price on Android');
        }
      } finally {
        debugDefaultTargetPlatformOverride = null;
      }
    });

  }
}
