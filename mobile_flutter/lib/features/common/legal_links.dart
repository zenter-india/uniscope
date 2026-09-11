import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// The four legal / policy documents, rendered natively in-app from a
/// bundled JSON asset (`legal_content.dart` / `LegalPageScreen`) via the
/// `/legal` route — no webview, no network round-trip, works offline and
/// on every platform. Content is a one-time extraction from the live pages
/// at uniscope.in/{terms,privacy,...}; re-run
/// `scripts/extract_legal_content.py` against that site's source whenever
/// the policies change. Kept in one place so the asset paths and titles
/// can't drift across the screens that link them (Settings, Help Centre,
/// the wallet top-up sheet, Login).
enum LegalPage {
  terms('Terms & Conditions', 'assets/legal/terms.json'),
  privacy('Privacy Policy', 'assets/legal/privacy.json'),
  communityGuidelines(
    'Community Guidelines',
    'assets/legal/community_guidelines.json',
  ),
  refund('Refund & Cancellation Policy', 'assets/legal/refund.json');

  const LegalPage(this.title, this.assetPath);

  final String title;
  final String assetPath;
}

/// Opens [page] as a native in-app screen ([LegalPageScreen] via the
/// `/legal` route).
void openLegalPage(BuildContext context, LegalPage page) {
  context.push(
    '/legal',
    extra: {'title': page.title, 'assetPath': page.assetPath},
  );
}
