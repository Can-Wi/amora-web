#!/usr/bin/env python3
"""
Local dev server for the AMORA web client.

Serves the static SPA AND reverse-proxies REST/media calls to the public API so
the browser sees everything same-origin (the production API only allows CORS
from *.aetern.de). WebSockets are NOT proxied — the client connects straight to
wss://api.aetern.de (Django Channels does not enforce Origin).

    python3 dev-proxy.py [port] [upstream]   # default 3200, https://api.aetern.de

This file is for local development only; it is excluded from the Docker image.
"""
import os
import sys
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

UPSTREAM = os.environ.get("AMORA_UPSTREAM", "https://api.aetern.de")
ROOT = os.path.dirname(os.path.abspath(__file__))
PROXY_PREFIXES = ("/api/", "/media/", "/healthz", "/admin/", "/console/")
HOP_BY_HOP = {"connection", "keep-alive", "transfer-encoding", "te", "trailer",
              "upgrade", "proxy-authorization", "proxy-authenticate", "content-encoding"}

MIME = {
    ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
    ".ico": "image/x-icon", ".woff2": "font/woff2",
}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):  # quieter logs
        pass

    def _is_proxy(self):
        return self.path.startswith(PROXY_PREFIXES)

    def _proxy(self):
        url = UPSTREAM + self.path
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        req = urllib.request.Request(url, data=body, method=self.command)
        for k, v in self.headers.items():
            if k.lower() in ("host", "content-length", "connection", "accept-encoding"):
                continue
            req.add_header(k, v)
        req.add_header("Accept-Encoding", "identity")
        try:
            resp = urllib.request.urlopen(req, timeout=30)
            status, headers, data = resp.status, resp.headers, resp.read()
        except urllib.error.HTTPError as e:
            status, headers, data = e.code, e.headers, e.read()
        except Exception as e:  # noqa
            self.send_error(502, f"Upstream error: {e}")
            return
        self.send_response(status)
        sent_ct = False
        for k, v in headers.items():
            if k.lower() in HOP_BY_HOP:
                continue
            if k.lower() == "content-type":
                sent_ct = True
            self.send_header(k, v)
        if not sent_ct:
            self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _static(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        if path == "/":
            path = "/index.html"
        fs = os.path.normpath(os.path.join(ROOT, path.lstrip("/")))
        if not fs.startswith(ROOT) or not os.path.isfile(fs):
            fs = os.path.join(ROOT, "index.html")  # SPA fallback
        with open(fs, "rb") as f:
            data = f.read()
        ext = os.path.splitext(fs)[1]
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(ext, "application/octet-stream"))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self._proxy() if self._is_proxy() else self._static()

    do_POST = do_PATCH = do_PUT = do_DELETE = lambda self: self._proxy()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3200
    if len(sys.argv) > 2:
        UPSTREAM = sys.argv[2].rstrip("/")
    print(f"AMORA dev server on http://localhost:{port}  (REST → {UPSTREAM})")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
