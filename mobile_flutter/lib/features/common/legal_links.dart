import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// The four legal / policy documents, hosted on the marketing site and
/// opened in-app through the `/legal` route ([WebPageScreen]). Kept in one
/// place so the URLs and titles can't drift across the screens that link
/// them (Settings, Help Centre, the wallet top-up sheet, Login).
enum LegalPage {
  terms('Terms & Conditions', 'https://uniscope.in/terms'),
  privacy('Privacy Policy', 'https://uniscope.in/privacy'),
  communityGuidelines(
    'Community Guidelines',
    'https://uniscope.in/community-guidelines',
  ),
  refund('Refund & Cancellation Policy', 'https://uniscope.in/refund');

  const LegalPage(this.title, this.url);

  final String title;
  final String url;
}

/// Opens [page] in the in-app webview.
void openLegalPage(BuildContext context, LegalPage page) {
  context.push('/legal', extra: {'title': page.title, 'url': page.url});
}
