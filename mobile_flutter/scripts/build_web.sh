#!/usr/bin/env bash
# Builds the Flutter web bundle and cache-busts main.dart.js in
# flutter_bootstrap.js by content hash. Without this, Chrome's HTTP disk
# cache can silently keep serving a stale main.dart.js after a rebuild —
# flutter build web doesn't content-hash that filename itself, and the
# no_cache_server.py Cache-Control headers only stop caching for requests
# made AFTER the server restarts, not for entries the browser already has.
set -euo pipefail
cd "$(dirname "$0")/.."

flutter build web --dart-define=API_URL="${API_URL:-http://localhost:3001/api/v1}"

cd build/web
HASH=$(shasum -a 256 main.dart.js | cut -c1-12)
sed -i '' "s/\"mainJsPath\":\"main.dart.js\"/\"mainJsPath\":\"main.dart.js?v=$HASH\"/" flutter_bootstrap.js
echo "Cache-busted main.dart.js -> ?v=$HASH"
