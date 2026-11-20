"""
Tests for the OSINT HTTP helper (osint/scripts/_http.py): HTTPS only, on the
first request and on every redirect, with certificate verification kept.

The servers listen on loopback and trust comes from a throwaway CA handed to
OpenSSL through SSL_CERT_FILE, so no test touches the Internet.

Author: Laurent Rochetta
"""

import os
import ssl
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

SCRIPTS = os.path.join(
    os.path.dirname(__file__), "..", "..",
    "osint-agent-package", "skills", "bmad-osint-investigate", "osint", "scripts",
)
sys.path.insert(0, os.path.abspath(SCRIPTS))

import _http  # noqa: E402
from _http import InsecureURLError, api_get, api_post, https_request  # noqa: E402


class _Recorder(BaseHTTPRequestHandler):
    """Record each request and answer from the server's route table (default: 200 JSON)."""

    def _answer(self):
        length = int(self.headers.get("Content-Length") or 0)
        self.server.requests.append({
            "method": self.command,
            "path": self.path,
            "body": self.rfile.read(length).decode() if length else None,
            "headers": dict(self.headers),
        })
        status, headers = self.server.routes.get(self.path, (200, {}))
        body = b'{"ok": true}'
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        for name, value in headers.items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    do_GET = do_POST = do_HEAD = _answer  # noqa: N815 (http.server naming)

    def log_message(self, *args):
        pass


def _serve(context=None):
    server = ThreadingHTTPServer(("127.0.0.1", 0), _Recorder)
    if context is not None:
        server.socket = context.wrap_socket(server.socket, server_side=True)
    server.daemon_threads = True
    server.requests = []
    server.routes = {}
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


@pytest.fixture
def plain_server():
    """A plain-HTTP listener; a request reaching it means the helper spoke cleartext."""
    server = _serve()
    yield server
    server.shutdown()
    server.server_close()


@pytest.fixture
def authority():
    return pytest.importorskip("trustme").CA()


@pytest.fixture
def tls_server(authority, tmp_path, monkeypatch):
    """HTTPS listener on 127.0.0.1 whose certificate names only ``localhost``.

    The throwaway CA is the only trust anchor: SSL_CERT_FILE is what
    ssl.create_default_context() loads, and SSL_CERT_DIR is pointed at an
    empty directory so no system CA can vouch for the test certificate.
    """
    context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    authority.issue_cert("localhost").configure_cert(context)
    server = _serve(context)
    bundle = tmp_path / "ca.pem"
    authority.cert_pem.write_to_path(str(bundle))
    monkeypatch.setenv("SSL_CERT_FILE", str(bundle))
    monkeypatch.setenv("SSL_CERT_DIR", str(tmp_path))
    server.base = f"https://localhost:{server.server_address[1]}"
    yield server
    server.shutdown()
    server.server_close()


class TestSchemes:
    def test_plain_http_is_refused_before_connecting(self, plain_server):
        port = plain_server.server_address[1]
        with pytest.raises(InsecureURLError, match="https"):
            https_request("GET", f"http://127.0.0.1:{port}/", headers={"Authorization": "Bearer k"})
        assert plain_server.requests == []

    @pytest.mark.parametrize("url", [
        "HTTP://127.0.0.1/", "ftp://example.com/", "file:///etc/passwd",
        "//example.com/path", "example.com/path", "ws://example.com/", "",
    ])
    def test_every_other_scheme_is_refused(self, url, monkeypatch):
        monkeypatch.setattr(_http.http.client, "HTTPSConnection", _no_connection)
        with pytest.raises(InsecureURLError, match="https"):
            https_request("GET", url)

    @pytest.mark.parametrize("url", [
        "https://user:secret@example.com/", "https://user@example.com/", "https://:pw@example.com/",
    ])
    def test_credentials_in_url_are_refused(self, url, monkeypatch):
        monkeypatch.setattr(_http.http.client, "HTTPSConnection", _no_connection)
        with pytest.raises(InsecureURLError, match="credentials"):
            https_request("GET", url)

    @pytest.mark.parametrize("url", ["https:///path", "https://example.com:99999/"])
    def test_missing_host_or_invalid_port_is_refused(self, url, monkeypatch):
        monkeypatch.setattr(_http.http.client, "HTTPSConnection", _no_connection)
        with pytest.raises(InsecureURLError):
            https_request("GET", url)

    def test_api_wrappers_refuse_plain_http(self, plain_server):
        port = plain_server.server_address[1]
        with pytest.raises(InsecureURLError):
            api_get(f"http://127.0.0.1:{port}/v1")
        with pytest.raises(InsecureURLError):
            api_post(f"http://127.0.0.1:{port}/v1", {"query": "subject"})
        assert plain_server.requests == []


def _no_connection(*args, **kwargs):
    raise AssertionError("a refused URL must not open a connection")


class TestCertificateVerification:
    def test_trusted_certificate_for_the_name_is_accepted(self, tls_server):
        assert api_post(f"{tls_server.base}/v1", {"q": "x"}, headers={"X-Api-Key": "k"}) == {"ok": True}
        [request] = tls_server.requests
        assert (request["method"], request["body"]) == ("POST", '{"q": "x"}')
        assert request["headers"]["X-Api-Key"] == "k"

    def test_untrusted_certificate_is_rejected(self, tls_server, tmp_path, monkeypatch):
        stranger = tmp_path / "other-ca.pem"
        pytest.importorskip("trustme").CA().cert_pem.write_to_path(str(stranger))
        monkeypatch.setenv("SSL_CERT_FILE", str(stranger))
        with pytest.raises(ssl.SSLCertVerificationError):
            https_request("GET", f"{tls_server.base}/")
        assert tls_server.requests == []

    def test_certificate_for_another_name_is_rejected(self, tls_server):
        port = tls_server.server_address[1]
        with pytest.raises(ssl.SSLCertVerificationError):
            https_request("GET", f"https://127.0.0.1:{port}/")
        assert tls_server.requests == []

    def test_legacy_tls_versions_are_not_offered(self, monkeypatch):
        contexts = []

        def capture(host, port, timeout=None, context=None):
            contexts.append(context)
            raise ConnectionRefusedError

        monkeypatch.setattr(_http.http.client, "HTTPSConnection", capture)
        with pytest.raises(ConnectionRefusedError):
            https_request("GET", "https://example.com/")
        [context] = contexts
        assert context.verify_mode == ssl.CERT_REQUIRED and context.check_hostname is True
        assert context.minimum_version >= ssl.TLSVersion.TLSv1_2


class TestRedirects:
    def test_redirect_to_plain_http_is_refused(self, tls_server, plain_server):
        target = f"http://localhost:{plain_server.server_address[1]}/leak"
        tls_server.routes["/start"] = (302, {"Location": target})
        with pytest.raises(InsecureURLError, match="https"):
            https_request("GET", f"{tls_server.base}/start", headers={"Authorization": "Bearer k"})
        assert plain_server.requests == []

    @pytest.mark.parametrize("location", ["ftp://localhost/x", "file:///etc/passwd", "gopher://localhost/"])
    def test_redirect_to_another_scheme_is_refused(self, tls_server, location):
        tls_server.routes["/start"] = (301, {"Location": location})
        with pytest.raises(InsecureURLError, match="https"):
            https_request("GET", f"{tls_server.base}/start")
        assert [r["path"] for r in tls_server.requests] == ["/start"]

    def test_redirect_to_another_host_is_refused(self, tls_server):
        port = tls_server.server_address[1]
        tls_server.routes["/start"] = (307, {"Location": f"https://127.0.0.1:{port}/steal"})
        with pytest.raises(InsecureURLError, match="redirect leaves"):
            https_request("POST", f"{tls_server.base}/start", body="query", headers={"X-Api-Key": "k"})
        assert [r["path"] for r in tls_server.requests] == ["/start"]

    def test_redirect_with_credentials_is_refused(self, tls_server):
        tls_server.routes["/start"] = (302, {"Location": f"https://u:p@{tls_server.base[8:]}/next"})
        with pytest.raises(InsecureURLError, match="credentials"):
            https_request("GET", f"{tls_server.base}/start")
        assert [r["path"] for r in tls_server.requests] == ["/start"]

    def test_same_host_redirect_is_followed(self, tls_server):
        tls_server.routes["/v1/run"] = (308, {"Location": "/v2/run"})
        assert api_post(f"{tls_server.base}/v1/run", {"q": "x"}) == {"ok": True}
        assert [(r["method"], r["path"], r["body"]) for r in tls_server.requests] == [
            ("POST", "/v1/run", '{"q": "x"}'), ("POST", "/v2/run", '{"q": "x"}'),
        ]

    def test_see_other_continues_as_a_bodiless_get(self, tls_server):
        tls_server.routes["/task"] = (303, {"Location": "/task/1"})
        status, _, _ = https_request(
            "POST", f"{tls_server.base}/task", body="{}", headers={"Content-Type": "application/json"}
        )
        assert status == 200
        second = tls_server.requests[1]
        assert (second["method"], second["path"], second["body"]) == ("GET", "/task/1", None)
        assert "Content-Type" not in second["headers"]

    def test_redirect_hops_are_bounded(self, tls_server):
        tls_server.routes["/loop"] = (302, {"Location": "/loop"})
        with pytest.raises(InsecureURLError, match="too many redirects"):
            https_request("GET", f"{tls_server.base}/loop")
        assert len(tls_server.requests) == _http.MAX_REDIRECTS + 1
