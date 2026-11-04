#!/usr/bin/env python3
"""Sirve el juego en http://localhost:8000 sin caché (para desarrollo)."""
import http.server, sys

class SinCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
http.server.ThreadingHTTPServer(('', port), SinCache).serve_forever()
