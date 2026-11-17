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

  // While kWalletTopupEnabledAndroid is off (see feature_flags.dart), the full
  // sheet still opens and shows every package — only picking one to actually
  // pay is blocked. Instead of "coming soon", the person is told to recharge on
  // the website (UNI-66), in exactly the product's wording.
  const rechargeMessage =
      'To recharge your wallet, visit our official website: https://www.uniscope.in '
      'and login from your registered mobile number';

  Finder rechargeMessageText() => find.byWidgetPredicate(
    (w) => w is RichText && w.text.toPlainText() == rechargeMessage,
  );

  testWidgets('tapping a package tells an Android user to recharge on the website, not "soon"', (
    tester,
  ) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    try {
      await _openTopUpSheet(tester, const Size(393, 852));
      expect(find.text('₹250'), findsOneWidget);
      await tester.tap(find.text('₹250'));
      await tester.pumpAndSettle();

      final dialog = find.byType(AlertDialog);
      expect(dialog, findsOneWidget);
      expect(
        find.descendant(of: dialog, matching: rechargeMessageText()),
        findsOneWidget,
        reason: 'the message must be exactly the product wording',
      );

      // No "available soon" wording anywhere in the dialog.
      final allText = tester
          .widgetList<RichText>(find.descendant(of: dialog, matching: find.byType(RichText)))
          .map((r) => r.text.toPlainText().toLowerCase())
          .join(' | ');
      expect(allText, isNot(contains('soon')));
      expect(allText, isNot(contains('isn’t available')));
      expect(allText, isNot(contains('working on it')));

      // The address inside the message is a real, tappable link...
      final message = tester.widget<RichText>(rechargeMessageText());
      var linkIsTappable = false;
      (message.text as TextSpan).visitChildren((span) {
        if (span is TextSpan && span.text == 'https://www.uniscope.in' && span.recognizer != null) {
          linkIsTappable = true;
        }
        return true;
      });
      expect(linkIsTappable, isTrue, reason: 'the website address should open the browser');

      // ...and there is a plain button for it too, plus a way to dismiss.
      expect(find.widgetWithText(FilledButton, 'Open website'), findsOneWidget);
      expect(find.widgetWithText(TextButton, 'Got it'), findsOneWidget);
    } finally {
      debugDefaultTargetPlatformOverride = null;
    }
  });

  testWidgets('"Got it" closes the website message', (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    try {
      await _openTopUpSheet(tester, const Size(393, 852));
      await tester.tap(find.text('₹250'));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);

      await tester.tap(find.widgetWithText(TextButton, 'Got it'));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsNothing);
    } finally {
      debugDefaultTargetPlatformOverride = null;
    }
  });

  for (final MapEntry(key: name, value: size) in phones.entries) {
    testWidgets('the website message fits on screen — $name', (tester) async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      try {
        await _openTopUpSheet(tester, size);
        await tester.ensureVisible(find.text('₹250'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('₹250'));
        await tester.pumpAndSettle();

        final dialog = tester.getRect(find.byType(AlertDialog));
        expect(dialog.left, greaterThanOrEqualTo(0));
        expect(dialog.right, lessThanOrEqualTo(size.width));
        expect(dialog.top, greaterThanOrEqualTo(0));
        expect(dialog.bottom, lessThanOrEqualTo(size.height));
        final text = tester.getRect(rechargeMessageText());
        expect(text.right, lessThanOrEqualTo(size.width), reason: 'message clipped at the side');
        expect(tester.takeException(), isNull, reason: 'no overflow / layout error');
      } finally {
        debugDefaultTargetPlatformOverride = null;
      }
    });
  }
}
