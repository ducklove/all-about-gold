"""Serve the UI and proxy only the fixed finance-pi gold snapshot endpoint."""
import argparse
import json
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        self._serve(send_body=True)

    def do_HEAD(self):
        self._serve(send_body=False)

    def _serve(self, send_body):
        path = urlparse(self.path).path
        if path == '/api/gold':
            self._gold_snapshot(send_body)
            return
        if path not in ('/', '/index.html') and not path.startswith('/static/'):
            self.send_error(404)
            return
        resolved = Path(self.translate_path(path)).resolve()
        if path.startswith('/static/') and not resolved.is_relative_to(ROOT / 'static'):
            self.send_error(404)
            return
        if resolved.is_dir() and path != '/':
            self.send_error(404)
            return
        if send_body:
            super().do_GET()
        else:
            super().do_HEAD()

    def _gold_snapshot(self, send_body):
        base = os.environ.get('FINANCE_PI_BASE_URL', 'http://127.0.0.1:8401').rstrip('/')
        headers = {'Accept': 'application/json'}
        token = os.environ.get('FINANCE_PI_ADMIN_TOKEN')
        if token:
            headers['X-Admin-Token'] = token
        try:
            request = Request(base + '/api/research/gold', headers=headers)
            with urlopen(request, timeout=20) as response:
                body = response.read(8_000_001)
            if len(body) > 8_000_000:
                raise ValueError('Oversized snapshot')
            payload = json.loads(body)
            if not isinstance(payload, dict) or payload.get('provider') != 'finance-pi':
                raise ValueError('Unexpected provider')
            status = 200
        except (HTTPError, URLError, TimeoutError, ValueError, OSError):
            body = json.dumps({
                'error': 'finance-pi 연결 또는 데이터 준비 상태를 확인하세요.'
            }, ensure_ascii=False).encode()
            status = 503
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if send_body:
            self.wfile.write(body)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--host', default='0.0.0.0')
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), partial(Handler, directory=str(ROOT)))
    print(f'All About Gold: http://{args.host}:{args.port}; data via finance-pi', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
