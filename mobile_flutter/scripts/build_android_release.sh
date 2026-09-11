#!/usr/bin/env bash
# Builds a signed, Play-Store-ready Android App Bundle (.aab) with the
# production API URL and the build-identifier defines always baked in.
#
# Same reasoning as build_ios_release.sh's iOS counterpart: a bare
# `flutter build appbundle --release` with no --dart-define=API_URL falls
# back to kApiBaseUrl's dev default (http://localhost:3001/api/v1, see
# dio_client.dart) — a real device then tries to reach a server running on
# itself, and every network call fails silently, OTP included. Use this
# script instead of calling `flutter build appbundle`/`apk` directly for
# any real device / Play Console build.
set -euo pipefail
cd "$(dirname "$0")/.."

API_URL="${API_URL:-https://uniscope-production.up.railway.app/api/v1}"
GIT_SHA="$(git rev-parse --short HEAD)"
BUILD_TIME="$(date -u +'%Y-%m-%d %H:%M')"

if [ ! -f android/key.properties ]; then
  echo "WARNING: android/key.properties not found — this build will be debug-signed and rejected by Play Console." >&2
fi

echo "Building Android release App Bundle:"
echo "  API_URL    = $API_URL"
echo "  GIT_SHA    = $GIT_SHA"
echo "  BUILD_TIME = $BUILD_TIME"

flutter build appbundle --release \
  --dart-define=API_URL="$API_URL" \
  --dart-define=GIT_SHA="$GIT_SHA" \
  --dart-define=BUILD_TIME="$BUILD_TIME"

AAB=$(find build/app/outputs/bundle/release -maxdepth 1 -name '*.aab' | head -1)
echo
echo "Built: $AAB"
if [ -n "$AAB" ]; then
  TMP=$(mktemp -d)
  unzip -q "$AAB" -d "$TMP" 'base/lib/*/libapp.so' 2>/dev/null || true
  SO=$(find "$TMP" -iname "libapp.so" | head -1)
  if [ -n "$SO" ] && strings "$SO" 2>/dev/null | grep -q "localhost:3001"; then
    rm -rf "$TMP"
    echo "WARNING: localhost:3001 still found in the compiled binary — API_URL may not have taken effect." >&2
    exit 1
  fi
  rm -rf "$TMP"
  echo "Verified: the built binary has no localhost:3001 fallback baked in."
fi
