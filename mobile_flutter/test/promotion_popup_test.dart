import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope_mobile/core/network/promotions_api.dart';
import 'package:uniscope_mobile/core/theme/app_theme.dart';
import 'package:uniscope_mobile/features/promotions/promotion_popup.dart';

PendingPromotion _promo({
  String? body = 'A little thank-you.',
  String? linkUrl,
  String? linkLabel,
  int creditedMinor = 0,
}) => PendingPromotion(
  id: 'p1',
  title: '10 free Uniminutes',
  body: body,
  linkUrl: linkUrl,
  linkLabel: linkLabel,
  creditedMinor: creditedMinor,
);

Future<void> _show(
  WidgetTester t,
  PendingPromotion p, {
  bool isMentor = false,
  void Function(Uri)? onOpenLink,
}) async {
  await t.pumpWidget(
    MaterialApp(
      theme: buildAppTheme(),
      home: Scaffold(
        body: PromotionDialog(
          promotion: p,
          isMentor: isMentor,
          onOpenLink: onOpenLink,
        ),
      ),
    ),
  );
}

void main() {
  group('PendingPromotion', () {
    test('parses the server response', () {
      final p = PendingPromotion.fromJson({
        'id': 'p1',
        'title': 'Hello',
        'body': ' Hi there ',
        'linkUrl': 'https://uniscope.in/offer',
        'linkLabel': 'Claim',
        'creditedMinor': 10000,
        'createdAt': '2026-11-16T00:00:00.000Z',
      });
      expect(p.title, 'Hello');
      expect(p.body, 'Hi there');
      expect(p.linkLabel, 'Claim');
      expect(p.creditedMinor, 10000);
      expect(p.safeLink, Uri.parse('https://uniscope.in/offer'));
    });

    test('treats blank text and missing fields as absent', () {
      final p = PendingPromotion.fromJson({
        'id': 'p1',
        'title': 'Hello',
        'body': '  ',
        'linkUrl': null,
      });
      expect(p.body, isNull);
      expect(p.linkUrl, isNull);
      expect(p.safeLink, isNull);
      expect(p.creditedMinor, 0);
    });

    test('only an https link is ever openable', () {
      for (final bad in [
        'http://uniscope.in',
        'javascript:alert(1)',
        'tel:+911234567890',
        'file:///etc/passwd',
        'intent://scan/#Intent;scheme=zxing;end',
        'uniscope.in/offer',
        'https://',
      ]) {
        expect(
          PendingPromotion(id: 'p', title: 't', linkUrl: bad).safeLink,
          isNull,
          reason: bad,
        );
      }
    });
  });

  group('promotionCreditLine', () {
    test('students read Uniminutes', () {
      expect(
        promotionCreditLine(10000, isMentor: false),
        '10 Uniminutes added to your wallet.',
      );
      expect(
        promotionCreditLine(1000, isMentor: false),
        '1 Uniminute added to your wallet.',
      );
    });

    test('mentors read rupees', () {
      expect(
        promotionCreditLine(20000, isMentor: true),
        '₹200 has been added to your wallet.',
      );
      expect(
        promotionCreditLine(12550, isMentor: true),
        '₹125.50 has been added to your wallet.',
      );
    });

    test('says nothing when nothing was credited', () {
      expect(promotionCreditLine(0, isMentor: false), isNull);
      expect(promotionCreditLine(0, isMentor: true), isNull);
      // Less than one Uniminute is not worth announcing.
      expect(promotionCreditLine(500, isMentor: false), isNull);
    });
  });

  group('PromotionDialog', () {
    testWidgets('shows the title, message and a Got it button', (t) async {
      await _show(t, _promo());
      expect(find.text('10 free Uniminutes'), findsOneWidget);
      expect(find.text('A little thank-you.'), findsOneWidget);
      expect(find.text('Got it'), findsOneWidget);
      expect(find.text('Not now'), findsNothing);
    });

    testWidgets('shows the credit line for the right role', (t) async {
      await _show(t, _promo(creditedMinor: 10000));
      expect(find.text('10 Uniminutes added to your wallet.'), findsOneWidget);

      await _show(t, _promo(creditedMinor: 20000), isMentor: true);
      expect(find.text('₹200 has been added to your wallet.'), findsOneWidget);
    });

    testWidgets('a link adds a button that opens it, with Not now beside it', (
      t,
    ) async {
      Uri? opened;
      await _show(
        t,
        _promo(linkUrl: 'https://uniscope.in/offer', linkLabel: 'Claim offer'),
        onOpenLink: (u) => opened = u,
      );
      expect(find.text('Claim offer'), findsOneWidget);
      expect(find.text('Not now'), findsOneWidget);
      expect(find.text('Got it'), findsNothing);

      await t.tap(find.text('Claim offer'));
      await t.pumpAndSettle();
      expect(opened, Uri.parse('https://uniscope.in/offer'));
    });

    testWidgets('defaults the button label to Open', (t) async {
      await _show(t, _promo(linkUrl: 'https://uniscope.in/offer'));
      expect(find.text('Open'), findsOneWidget);
    });

    testWidgets('never shows a button for a link that is not https', (t) async {
      await _show(t, _promo(linkUrl: 'http://uniscope.in/offer'));
      expect(find.text('Open'), findsNothing);
      expect(find.text('Got it'), findsOneWidget);
    });

    testWidgets('fits a small phone with a long message', (t) async {
      t.view.physicalSize = const Size(320, 568);
      t.view.devicePixelRatio = 1.0;
      addTearDown(t.view.reset);
      await _show(
        t,
        _promo(
          body: List.filled(40, 'A long promotional message.').join(' '),
          linkUrl: 'https://uniscope.in/offer',
          creditedMinor: 10000,
        ),
      );
      expect(noLayoutException(t), isTrue);
    });
  });
}

/// True when pumping the dialog raised no layout exception.
bool noLayoutException(WidgetTester t) => t.takeException() == null;
