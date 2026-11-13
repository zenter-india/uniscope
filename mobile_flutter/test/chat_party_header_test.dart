import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope_mobile/core/theme/app_theme.dart';
import 'package:uniscope_mobile/features/sessions/chat_party_header.dart';

Widget _host(Widget header) => MaterialApp(
  theme: buildAppTheme(),
  home: Scaffold(appBar: AppBar(title: header)),
);

/// UNI-37: in a chat, the aspirant can tap the mentor's name/avatar to open
/// the mentor's profile; where no handler is given it stays a plain label.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    final l = FontLoader('Manrope');
    for (final w in ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']) {
      l.addFont(rootBundle.load('assets/fonts/Manrope-$w.ttf'));
    }
    await l.load();
  });

  testWidgets('shows the name and @uniqueId', (t) async {
    await t.pumpWidget(
      _host(const ChatPartyHeader(name: 'Dr. Meera', uniqueId: 'M1124000012')),
    );
    expect(find.text('Dr. Meera'), findsOneWidget);
    expect(find.text('@M1124000012'), findsOneWidget);
  });

  testWidgets('tapping the name opens the profile when a handler is given', (
    t,
  ) async {
    var opened = 0;
    await t.pumpWidget(
      _host(ChatPartyHeader(name: 'Dr. Meera', onTap: () => opened++)),
    );
    await t.tap(find.text('Dr. Meera'));
    expect(opened, 1);
  });

  testWidgets('is a plain label with no handler (mentor side of a chat)', (
    t,
  ) async {
    await t.pumpWidget(_host(const ChatPartyHeader(name: 'Asha Student')));
    expect(
      find.descendant(
        of: find.byType(ChatPartyHeader),
        matching: find.byType(InkWell),
      ),
      findsNothing,
    );
  });
}
