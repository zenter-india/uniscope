#!/usr/bin/env bash
# One command for a fresh, Play-Console-ready Android release build:
# bumps the version code in pubspec.yaml, then runs build_android_release.sh.
#
# Why this exists: Play Console rejects re-uploading a version code that's
# already been used ANYWHERE in the app (any track — Internal/Closed/
# Production all share one version-code space, not one each). So every
# single upload attempt — even a re-upload of an identical build to a
# different track — needs a new, never-before-used number. Forgetting to
# bump it is the single most common reason an upload gets rejected.
#
# Usage:
#   ./scripts/release_android.sh
#
# What it does:
#   1. Reads the current "X.Y.Z+N" from pubspec.yaml
#   2. Writes back "X.Y.Z+(N+1)"
#   3. Runs build_android_release.sh (which itself bakes in the production
#      API_URL + GIT_SHA + BUILD_TIME and fails loudly if localhost leaks in)
#   4. Prints the exact new version code + where the .aab landed
#
# You do NOT need Claude Code open to run this — it's a plain shell script.
set -euo pipefail
cd "$(dirname "$0")/.."

PUBSPEC="pubspec.yaml"
CURRENT_LINE=$(grep -E '^version:' "$PUBSPEC")
# e.g. "version: 1.0.0+9" -> VERSION_NAME=1.0.0, BUILD_NUMBER=9
VERSION_NAME=$(echo "$CURRENT_LINE" | sed -E 's/^version:[[:space:]]*([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+)/\1/')
BUILD_NUMBER=$(echo "$CURRENT_LINE" | sed -E 's/^version:[[:space:]]*([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+)/\2/')

if [ -z "$VERSION_NAME" ] || [ -z "$BUILD_NUMBER" ]; then
  echo "Could not parse '$CURRENT_LINE' from $PUBSPEC — expected format 'version: X.Y.Z+N'." >&2
  exit 1
fi

NEW_BUILD_NUMBER=$((BUILD_NUMBER + 1))
NEW_LINE="version: ${VERSION_NAME}+${NEW_BUILD_NUMBER}"

# macOS/BSD sed needs the '' after -i; this repo's build machine is macOS.
sed -i '' "s/^version:.*/${NEW_LINE}/" "$PUBSPEC"

echo "Version bumped: ${CURRENT_LINE#version: } -> ${VERSION_NAME}+${NEW_BUILD_NUMBER}"
echo

bash scripts/build_android_release.sh

echo
echo "=========================================="
echo "Ready to upload: build/app/outputs/bundle/release/app-release.aab"
echo "versionCode: ${NEW_BUILD_NUMBER}  (versionName: ${VERSION_NAME})"
echo "=========================================="
echo
echo "Remember to commit the pubspec.yaml bump:"
echo "  git add pubspec.yaml"
echo "  git commit -m \"chore(mobile/android): bump versionCode to ${NEW_BUILD_NUMBER}\""
echo "  git push"
