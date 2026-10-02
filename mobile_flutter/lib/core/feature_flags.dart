/// Temporary kill-switches, flipped off while the Agora native-SDK crash
/// (see the "iOS published to App Store, call still not connecting"
/// investigation in CLAUDE.md -- a confirmed, deterministic EXC_BAD_ACCESS
/// inside AgoraRtcWrapper, same signature across builds 24/25) is worked on.
/// These are plain compile-time constants, not a remote config, so
/// re-enabling needs a new release build either way.
///
/// Booking a NEW call is blocked (kCallsEnabled); an already-accepted/
/// confirmed call already in flight is deliberately left untouched -- this
/// only stops new bookings from being created while the fix is in
/// progress, per the explicit scope agreed when these flags were added.
///
/// kCallsEnabled TEMPORARILY flipped back to `true` (2026-10-03, on
/// `fix/wallet-audit-and-agora-ios-crash` only) specifically to real-device
/// test the engine-teardown-sequencing fix in call_screen.dart (see
/// _releaseEngine / the "Agora support's reply" note in CLAUDE.md) -- this
/// is a *different* fix from the agora_rtc_engine version upgrade the
/// comment above used to describe, and is itself unverified on a device
/// yet. Flip back to `false` if the crash still reproduces with this build;
/// leave `true` (and merge/push this file) only once a real call has been
/// confirmed connecting cleanly on a real iPhone. kWalletTopupEnabled is
/// left untouched here -- unrelated to this fix, not part of this test.
library;

const bool kCallsEnabled = true;
const bool kWalletTopupEnabled = false;

/// Shown in place of the real action wherever either flag above is false.
/// Same copy for both calls and wallet top-ups, per explicit request.
const String kFeatureDisabledMessage =
    'Call options will be enabled soon. Thank you for your patience.';
