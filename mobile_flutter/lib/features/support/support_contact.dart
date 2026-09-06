import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Uniscope support phone number, E.164. Shown as "Call us" in the Help
/// Centre and on the technical-report screen.
const String kSupportPhoneNumber = '+917010441518';

/// Human-readable form for display next to the "Call us" button.
const String kSupportPhoneDisplay = '+91 70104 41518';

/// Same address the web app's Terms/Privacy pages already publish as the
/// contact/grievance email — reused here rather than picking a new one.
const String kSupportEmail = 'support@uniscope.in';

/// Opens the system dialer pre-filled with [kSupportPhoneNumber]. Falls
/// back to a SnackBar with the number if no dialer is available (e.g. a
/// tablet, or web without a tel handler).
Future<void> callSupport(BuildContext context) async {
  final uri = Uri(scheme: 'tel', path: kSupportPhoneNumber);
  final messenger = ScaffoldMessenger.of(context);
  try {
    final ok = await launchUrl(uri);
    if (!ok && context.mounted) {
      messenger.showSnackBar(
        SnackBar(content: Text('Call us at $kSupportPhoneDisplay')),
      );
    }
  } catch (_) {
    if (context.mounted) {
      messenger.showSnackBar(
        SnackBar(content: Text('Call us at $kSupportPhoneDisplay')),
      );
    }
  }
}

/// Opens the system mail client addressed to [kSupportEmail]. Falls back to
/// a SnackBar with the address if no mail client is available.
Future<void> mailSupport(BuildContext context) async {
  final uri = Uri(scheme: 'mailto', path: kSupportEmail);
  final messenger = ScaffoldMessenger.of(context);
  try {
    final ok = await launchUrl(uri);
    if (!ok && context.mounted) {
      messenger.showSnackBar(
        SnackBar(content: Text('Email us at $kSupportEmail')),
      );
    }
  } catch (_) {
    if (context.mounted) {
      messenger.showSnackBar(
        SnackBar(content: Text('Email us at $kSupportEmail')),
      );
    }
  }
}
