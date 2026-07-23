#!/usr/bin/env python3
"""Static file server for build/web that disables HTTP caching and falls
back to index.html for unknown paths (go_router uses path-based routing,
so a direct load of e.g. /mentors/saved must still serve the SPA shell).

Plain `python -m http.server` sends no Cache-Control header, so Chrome's
heuristic cache can silently serve a stale main.dart.js after a rebuild —
`flutter build web` doesn't content-hash that filename, so the browser has
no way to tell the file changed without an explicit no-store directive.
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class SpaHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def translate_path(self, path):
        clean_path = path.split("?", 1)[0].split("#", 1)[0]
        fs_path = super().translate_path(clean_path)
        if clean_path != "/" and not os.path.exists(fs_path):
            return super().translate_path("/")
        return fs_path


http.server.test(HandlerClass=SpaHandler, port=PORT, bind="127.0.0.1")
