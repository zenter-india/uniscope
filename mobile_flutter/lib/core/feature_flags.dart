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

/// Wallet top-up is temporarily off too (2026-10-02, per explicit
/// instruction alongside the calls pause) — the balance a top-up buys is
/// Uniminutes, which today can only be spent on a call, so selling more of
/// it while calls are down isn't useful to a user. Chat stays free and
/// unaffected regardless. Flip back to `true` once calls (and therefore
/// top-up) are both confirmed working again.
const bool kWalletTopupEnabled = false;

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
