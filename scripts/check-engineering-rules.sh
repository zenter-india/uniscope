#!/usr/bin/env bash
# Enforces a handful of rules from ai/RISK_RULES.md and ai/ENGINEERING_RULES.md
# that are cheap to check mechanically, so they don't rely on a human
# remembering them on every PR. Exits non-zero (failing CI) on any violation.
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0

# --- A6: the vendored Agora AAR + upstream exclusion must both stay in place.
# Removing either re-introduces the iris-rtc/agora-special-full manifest-
# namespace collision that broke Android release builds — see
# android/app/libs/README.md for the full story.
GRADLE_FILE="mobile_flutter/android/app/build.gradle.kts"
if [ -f "$GRADLE_FILE" ]; then
  if ! grep -q 'exclude(group = "io.agora.rtc", module = "iris-rtc")' "$GRADLE_FILE"; then
    echo "FAIL: $GRADLE_FILE no longer excludes the upstream io.agora.rtc:iris-rtc module."
    echo "      This will reintroduce the AGP manifest-namespace collision. See android/app/libs/README.md."
    fail=1
  fi
  if [ ! -f "mobile_flutter/android/app/libs/iris-rtc-patched.aar" ]; then
    echo "FAIL: mobile_flutter/android/app/libs/iris-rtc-patched.aar is missing."
    echo "      The upstream iris-rtc module is excluded above and must be replaced by this vendored copy,"
    echo "      or 'Join Call' crashes with UnsatisfiedLinkError (missing libAgoraRtcWrapper.so)."
    fail=1
  fi
fi

# --- C5: OTP_PROVIDER_TYPE must never be hardcoded to "mock" in a committed
# deploy config — that's a fixed, publicly-known login code (111111) for
# every phone number on whatever's reachable at that config's URL.
for f in render.yaml; do
  if [ -f "$f" ] && grep -A1 'OTP_PROVIDER_TYPE' "$f" | grep -q 'value: mock'; then
    echo "FAIL: $f hardcodes OTP_PROVIDER_TYPE: mock for a deployed service."
    echo "      Per RISK_RULES.md this is CRITICAL — it means anyone who can reach that service"
    echo "      can log in as any phone number with the fixed code 111111. Set it to 'twilio' (or"
    echo "      leave unset with sync: false) and configure the real value in the host's dashboard."
    fail=1
  fi
done

# --- C4: no obviously-hardcoded secrets in tracked source (a coarse net, not
# a replacement for a real secret scanner — catches the easy, common cases).
if git grep -nE '(AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{16,}|-----BEGIN (RSA |EC )?PRIVATE KEY-----)' \
     -- ':!*.md' ':!*.lock' ':!package-lock.json' 2>/dev/null; then
  echo "FAIL: a pattern above looks like a hardcoded secret (AWS key / Stripe-style live key / private key block)."
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "One or more engineering-rule checks failed — see above."
  exit 1
fi

echo "All engineering-rule checks passed."
