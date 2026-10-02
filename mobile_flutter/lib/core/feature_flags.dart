/// Small, deliberately short-lived switches for temporarily disabling a
/// feature without ripping out its code — flip back to `true` and the
/// feature works exactly as it did before.
library;

import 'package:flutter/material.dart';

import 'theme/app_theme.dart';

/// Audio calls are temporarily off on both Android and iOS (2026-10-02) —
/// real connectivity issues are still being root-caused on both platforms
/// (see the "iOS call-path review" / Agora investigation notes in
/// CLAUDE.md). Booking **or joining** a call reliably fails or goes silent,
/// so instead of shipping a broken call flow, both [showCallRequestSheet]
/// and [CallOverlayController.open] show a "coming back soon" notice
/// instead of starting/opening the call.
///
/// Deliberately scoped to calls only — chat and browsing mentors/colleges
/// are completely unaffected. Flip this back to `true` once calls are
/// confirmed working end-to-end on a real device.
const bool kCallBookingEnabled = false;

/// Wallet top-up is temporarily off too (2026-10-02, per explicit
/// instruction alongside the calls pause) — the balance a top-up buys is
/// Uniminutes, which today can only be spent on a call, so selling more of
/// it while calls are down isn't useful to a user. Chat stays free and
/// unaffected regardless. Flip back to `true` once calls (and therefore
/// top-up) are both confirmed working again.
const bool kWalletTopupEnabled = false;

/// Shown in place of the call-request sheet, or in place of opening the call
/// overlay (Join, auto-navigate on accept, a tapped push notification, a
/// `/call/:id` deep link), while [kCallBookingEnabled] is off.
class CallsPausedDialog extends StatelessWidget {
  const CallsPausedDialog({super.key});

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      icon: Container(
        width: 52,
        height: 52,
        decoration: const BoxDecoration(color: AppColors.primaryLight, shape: BoxShape.circle),
        alignment: Alignment.center,
        child: const Icon(Icons.phone_in_talk_rounded, color: AppColors.primary, size: 26),
      ),
      title: const Text('Calls are paused right now'),
      content: const Text(
        "We're fixing an issue with audio calls on both Android and iOS, so "
        'calls — including joining one already booked — are paused for now. '
        "Chat with mentors still works exactly as usual — we'll turn calls "
        'back on as soon as it’s fixed.',
        textAlign: TextAlign.center,
      ),
      actionsAlignment: MainAxisAlignment.center,
      actions: [
        FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Got it')),
      ],
    );
  }
}

/// Shown once the user has seen the full package list and picks one to pay
/// for, while [kWalletTopupEnabled] is off. Deliberately soft and generic —
/// it names no reason, so it doesn't disclose the real cause (see
/// feature_flags.dart's own doc comment on [kWalletTopupEnabled]).
class WalletTopupPausedDialog extends StatelessWidget {
  const WalletTopupPausedDialog({super.key});

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
      title: const Text('Recharge unavailable right now'),
      content: const Text(
        "We're unable to process a recharge at the moment. Please try "
        'again a little later — thanks for your patience!',
        textAlign: TextAlign.center,
      ),
      actionsAlignment: MainAxisAlignment.center,
      actions: [
        FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Got it')),
      ],
    );
  }
}
