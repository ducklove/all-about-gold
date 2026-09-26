import json
import threading
import unittest
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from scripts.serve import Handler, ROOT


class Upstream(BaseHTTPRequestHandler):
    calls = []
    tokens = []

    def do_GET(self):
        self.calls.append(self.path)
        self.tokens.append(self.headers.get("X-Admin-Token"))
        self.send_response(200)
        self.end_headers()
        self.wfile.write(json.dumps({'provider': 'finance-pi', 'history': {}}).encode())

    def log_message(self, *args):
        pass


class ProxyTests(unittest.TestCase):
    def test_fixed_upstream_and_private_paths(self):
        upstream = ThreadingHTTPServer(('127.0.0.1', 0), Upstream)
        proxy = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
        for server in (upstream, proxy):
            threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f'http://127.0.0.1:{proxy.server_port}'
        try:
            with patch.dict('os.environ', {'FINANCE_PI_BASE_URL': f'http://127.0.0.1:{upstream.server_port}', 'FINANCE_PI_ADMIN_TOKEN': 'test-token'}):
                with urlopen(base+'/api/gold?url=http://untrusted.invalid') as response:
                    self.assertEqual(json.load(response)['provider'], 'finance-pi')
                self.assertEqual(Upstream.calls[-1], '/api/research/gold')
                self.assertEqual(Upstream.tokens[-1], 'test-token')
                with self.assertRaises(HTTPError) as head_error:
                    urlopen(Request(base+'/scripts/serve.py', method='HEAD'))
                self.assertEqual(head_error.exception.code, 404)
                with self.assertRaises(HTTPError) as error:
                    urlopen(base+'/scripts/serve.py')
                self.assertEqual(error.exception.code, 404)
            with patch.dict('os.environ', {'FINANCE_PI_BASE_URL': 'http://127.0.0.1:1'}):
                with self.assertRaises(HTTPError) as error:
                    urlopen(base+'/api/gold')
                self.assertEqual(error.exception.code, 503)
        finally:
            for server in (upstream, proxy):
                server.shutdown()
                server.server_close()
