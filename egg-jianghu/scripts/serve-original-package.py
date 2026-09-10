from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import mimetypes
import zipfile

archive = zipfile.ZipFile(Path(__file__).resolve().parents[3] / '诸天刷宝录' / '.nw')

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        name = unquote(urlsplit(self.path).path).lstrip('/') or 'index.html'
        try:
            body = archive.read(name)
        except KeyError:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', mimetypes.guess_type(name)[0] or 'application/octet-stream')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass

print('Original package server: http://127.0.0.1:4175', flush=True)
HTTPServer(('127.0.0.1', 4175), Handler).serve_forever()
