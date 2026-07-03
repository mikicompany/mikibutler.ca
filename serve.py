"""Local dev server: serves the static site and lets admin.html save
data.json directly (POST /save-data). Run: python serve.py
Localhost only — the save endpoint never exists on the live site.
"""
import http.server
import json

PORT = 8321


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/save-data':
            self.send_response(404)
            self.end_headers()
            return
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        try:
            json.loads(body)
        except ValueError:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'invalid json')
            return
        with open('data.json', 'wb') as f:
            f.write(body)
            if not body.endswith(b'\n'):
                f.write(b'\n')
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(b'saved')

    def end_headers(self):
        # never cache during development
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    print(f'Serving on http://localhost:{PORT} (admin save enabled)')
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
