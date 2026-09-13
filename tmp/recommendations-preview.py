from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass

root = Path(__file__).resolve().parent.parent / 'public'
server = ThreadingHTTPServer(('127.0.0.1', 4089), partial(PreviewHandler, directory=str(root)))
print('QA preview ready on 127.0.0.1:4089; cache disabled.', flush=True)
server.serve_forever()
