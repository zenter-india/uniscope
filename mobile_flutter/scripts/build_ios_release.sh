#!/usr/bin/env bash
# Builds a signed, App-Store-ready iOS .ipa with the production API URL and
# the build-identifier defines always baked in.
#
# Exists because a plain `flutter build ipa --release` with no --dart-define
# flags silently falls back to kApiBaseUrl's dev default
# (http://localhost:3001/api/v1, see dio_client.dart) — a real device then
# tries to reach a server running on itself, and every single network call
# (OTP included) fails with no useful error. This happened for real on
# 2026-09-12: a build shipped without API_URL, OTP failed on-device, and the
# mistake wasn't caught until the user actually tried logging in. Use this
# script instead of calling `flutter build ipa` directly for any real
# device / TestFlight / App Store build.
set -euo pipefail
cd "$(dirname "$0")/.."

API_URL="${API_URL:-https://uniscope-production.up.railway.app/api/v1}"
GIT_SHA="$(git rev-parse --short HEAD)"
BUILD_TIME="$(date -u +'%Y-%m-%d %H:%M')"

echo "Building iOS release IPA:"
echo "  API_URL    = $API_URL"
echo "  GIT_SHA    = $GIT_SHA"
echo "  BUILD_TIME = $BUILD_TIME"

flutter build ipa --release \
  --dart-define=API_URL="$API_URL" \
  --dart-define=GIT_SHA="$GIT_SHA" \
  --dart-define=BUILD_TIME="$BUILD_TIME"

IPA=$(find build/ios/ipa -maxdepth 1 -name '*.ipa' | head -1)
echo
echo "Built: $IPA"
if [ -n "$IPA" ]; then
  APP_BIN=$(find build/ios/archive/Runner.xcarchive -maxdepth 4 -path '*/Frameworks/App.framework/App' | head -1)
  if [ -n "$APP_BIN" ] && strings "$APP_BIN" 2>/dev/null | grep -q "localhost:3001"; then
    echo "WARNING: localhost:3001 still found in the compiled binary — API_URL may not have taken effect." >&2
    exit 1
  fi
  echo "Verified: the built binary has no localhost:3001 fallback baked in."
fi
