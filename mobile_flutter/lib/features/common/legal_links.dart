import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

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

/// Opens [page]. On native, an in-app webview ([WebPageScreen] via the
/// `/legal` route). On Flutter web, `webview_flutter` has no implementation
/// — so the `/legal` screen would only show a "not previewable on web"
/// placeholder — and we open the real page in a new browser tab instead.
Future<void> openLegalPage(BuildContext context, LegalPage page) async {
  if (kIsWeb) {
    await launchUrl(Uri.parse(page.url), webOnlyWindowName: '_blank');
    return;
  }
  context.push('/legal', extra: {'title': page.title, 'url': page.url});
}
