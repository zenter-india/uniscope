/// Small, deliberately short-lived switches for temporarily disabling a
/// feature without ripping out its code — flip back to `true` and the
/// feature works exactly as it did before.
library;

import 'package:flutter/material.dart';

import 'theme/app_theme.dart';

/// Audio calls were temporarily off on both Android and iOS (2026-10-02)
/// while real connectivity issues were root-caused. **Re-enabled
/// 2026-10-03** — the real cause was found and fixed the same day (a
/// stripped runtime symbol in Xcode's Release-archive build, not an Agora
/// SDK bug at all; see "iOS published to App Store, call still not
/// connecting" in CLAUDE.md for the full writeup), and confirmed via a real
/// two-device call connecting cleanly on real iPhones. Android has not yet
/// been retested with this exact fix — the change that mattered
/// (`STRIP_STYLE`) is iOS-only (`project.pbxproj`'s `OTHER_LDFLAGS`), so
/// Android's own call path is unaffected either way, but a real-device
/// confirmation on Android is still outstanding.
///
/// Deliberately scoped to calls only — chat and browsing mentors/colleges
/// are completely unaffected. Flip back to `false` if either platform
/// regresses.
const bool kCallBookingEnabled = true;

/// Wallet top-up, per platform. Both were paused 2026-10-02 alongside the
/// calls pause (the balance a top-up buys can only be spent on a call).
///
/// **iOS re-enabled 2026-10-08, per explicit instruction** — calls work again
/// (see [kCallBookingEnabled]) and the StoreKit top-up path is the one App
/// Review approved. **Android stays paused**: its top-up goes through Razorpay,
/// whose live credentials are still pending, so enabling it would let users
/// start payments against a gateway that isn't live. Flip
/// [kWalletTopupEnabledAndroid] to `true` once Razorpay is live.
const bool kWalletTopupEnabledIOS = true;
const bool kWalletTopupEnabledAndroid = false;

/// Shown once the aspirant has gone through the full "When?"/"How long?"
/// sheet and would otherwise place the request, or in place of opening the
/// call overlay (Join, auto-navigate on accept, a tapped push notification,
/// a `/call/:id` deep link), while [kCallBookingEnabled] is off. Deliberately
/// soft and generic — it names no reason, so it doesn't disclose the real
/// cause (see [kCallBookingEnabled]'s own doc comment).
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
      title: const Text('Calls aren’t available right now'),
      content: const Text(
        "We're working on it, and it'll be back soon — chat with your "
        'mentor still works as usual. Thanks for your patience!',
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
/// for, while a platform's top-up flag is off. Deliberately soft and generic —
/// it names no reason, so it doesn't disclose the real cause (see
/// feature_flags.dart's own doc comment on [kWalletTopupEnabledAndroid]).
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
      title: const Text('Recharge isn’t available right now'),
      content: const Text(
        "We're working on it, and it'll be back soon. Thanks for your "
        'patience!',
        textAlign: TextAlign.center,
      ),
      actionsAlignment: MainAxisAlignment.center,
      actions: [
        FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Got it')),
      ],
    );
  }
}
