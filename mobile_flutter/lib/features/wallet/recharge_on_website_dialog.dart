import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';

/// Where Android users recharge: the Android app does not take payments yet
/// (see `kWalletTopupEnabledAndroid`), so a recharge is done on the website.
///
/// The link goes straight to the website's wallet page, where the person logs
/// in with their registered mobile number — not to the home page. The message
/// shows this same address, and tapping it (or "Open website") opens it.
const String kRechargeWebsiteUrl = 'https://www.uniscope.in/wallet';

/// What an Android user sees when they try to recharge: where to do it
/// instead. The wording is fixed by the product (UNI-66) — change it only on
/// request, including the missing full stop. (By request, the address inside it
/// is the wallet page, [kRechargeWebsiteUrl], not just the site's home page.)
const String kRechargeWebsiteMessageBefore =
    'To recharge your wallet, visit our official website: ';
const String kRechargeWebsiteMessageAfter =
    ' and login from your registered mobile number';

Future<bool> _launchExternal(Uri url) => launchUrl(url, mode: LaunchMode.externalApplication);

/// Shown in place of the Razorpay checkout on Android, once the person has
/// picked a pack to pay for. The address inside the message is tappable, and
/// there is an "Open website" button too, since a link inside a sentence is a
/// small thing to hit on a phone.
class WalletRechargeOnWebsiteDialog extends StatefulWidget {
  const WalletRechargeOnWebsiteDialog({super.key, this.launcher = _launchExternal});

  /// Opens an address outside the app. Replaceable so a test can see which
  /// address a tap really opens.
  final Future<bool> Function(Uri url) launcher;

  @override
  State<WalletRechargeOnWebsiteDialog> createState() => _WalletRechargeOnWebsiteDialogState();
}

class _WalletRechargeOnWebsiteDialogState extends State<WalletRechargeOnWebsiteDialog> {
  late final TapGestureRecognizer _openWebsite = TapGestureRecognizer()..onTap = _open;

  @override
  void dispose() {
    _openWebsite.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    try {
      final ok = await widget.launcher(Uri.parse(kRechargeWebsiteUrl));
      if (!ok && mounted) {
        showAppSnackBar(context, 'Open $kRechargeWebsiteUrl in your browser');
      }
    } catch (_) {
      if (mounted) {
        showAppSnackBar(context, 'Open $kRechargeWebsiteUrl in your browser');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      icon: Container(
        width: 52,
        height: 52,
        decoration: const BoxDecoration(color: AppColors.primaryLight, shape: BoxShape.circle),
        alignment: Alignment.center,
        child: const Icon(Icons.account_balance_wallet_rounded, color: AppColors.primary, size: 26),
      ),
      content: Text.rich(
        TextSpan(
          children: [
            const TextSpan(text: kRechargeWebsiteMessageBefore),
            TextSpan(
              text: kRechargeWebsiteUrl,
              recognizer: _openWebsite,
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w700,
                decoration: TextDecoration.underline,
              ),
            ),
            const TextSpan(text: kRechargeWebsiteMessageAfter),
          ],
        ),
        textAlign: TextAlign.center,
      ),
      actionsAlignment: MainAxisAlignment.center,
      actionsOverflowButtonSpacing: 8,
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Got it')),
        FilledButton(onPressed: _open, child: const Text('Open website')),
      ],
    );
  }
}
