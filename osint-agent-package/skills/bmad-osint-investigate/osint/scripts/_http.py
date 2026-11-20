"""Shared HTTP utilities for OSINT scripts — stdlib only, zero dependencies.

Every request goes over verified HTTPS: the providers receive API keys and
investigation queries, so a plain-text or unverified hop is never acceptable.
"""

import http.client
import json
import os
import ssl
import sys
from urllib.parse import urljoin, urlparse

MAX_REDIRECTS = 5
_REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})


class InsecureURLError(ValueError):
    """A URL the helper refuses to contact (not HTTPS, credentials, no host)."""


def _check_https_url(url):
    """Return ``(host, port, target)`` for an acceptable URL, or raise InsecureURLError.

    Only ``https://`` with a host is accepted: no plain HTTP, no other scheme
    and no implicit one. Credentials in the URL are refused, since they would
    travel outside the headers the caller controls.
    """
    parsed = urlparse(url)
    if parsed.scheme.lower() != "https":
        raise InsecureURLError(f"only https:// URLs are allowed, got {parsed.scheme or '(none)'}://")
    if parsed.username is not None or parsed.password is not None:
        raise InsecureURLError("credentials in URL are not allowed")
    if not parsed.hostname:
        raise InsecureURLError("URL has no host")
    try:
        port = parsed.port or 443
    except ValueError:
        raise InsecureURLError("URL has an invalid port") from None
    target = parsed.path or "/"
    if parsed.query:
        target += "?" + parsed.query
    return parsed.hostname, port, target


def https_request(method, url, headers=None, body=None, timeout=120):
    """Make a verified HTTPS request and return (status, headers, body_str).

    Refuses anything but ``https://`` with InsecureURLError, verifies the
    certificate and host name against the system trust store (TLS 1.2 or
    later), and follows at most MAX_REDIRECTS redirects that stay on the same
    host and port: a redirect to plain HTTP, another scheme or another host is
    refused rather than handing the API key and query to a recipient the
    caller did not name.
    """
    hdrs = {"User-Agent": "osint-skill/3.2-python"}
    if headers:
        hdrs.update(headers)
    context = ssl.create_default_context()
    context.minimum_version = ssl.TLSVersion.TLSv1_2

    host, port, target = _check_https_url(url)
    for _ in range(MAX_REDIRECTS + 1):
        conn = http.client.HTTPSConnection(host, port, timeout=timeout, context=context)
        try:
            conn.request(method, target, body=body, headers=hdrs)
            resp = conn.getresponse()
            data = resp.read().decode("utf-8", errors="replace")
        finally:
            conn.close()

        location = resp.getheader("Location")
        if resp.status not in _REDIRECT_STATUSES or not location:
            return resp.status, dict(resp.getheaders()), data
        url = urljoin(url, location)
        next_host, next_port, target = _check_https_url(url)
        if (next_host.lower(), next_port) != (host.lower(), port):
            raise InsecureURLError(f"redirect leaves {host}:{port} for {next_host}:{next_port}")
        # As browsers do: 301, 302 and 303 continue a POST as a bodiless GET;
        # 307 and 308 repeat the request unchanged.
        if resp.status in (301, 302, 303) and method not in ("GET", "HEAD"):
            method, body = "GET", None
            hdrs = {k: v for k, v in hdrs.items() if k.lower() != "content-type"}
    raise InsecureURLError(f"too many redirects (max {MAX_REDIRECTS})")


def api_post(url, payload, headers=None, timeout=120):
    """POST JSON payload and return parsed JSON response."""
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    body = json.dumps(payload) if isinstance(payload, dict) else payload
    status, _, data = https_request("POST", url, headers=hdrs, body=body, timeout=timeout)
    if status >= 400:
        print(f"ERROR: HTTP {status}: {data[:300]}", file=sys.stderr)
        return None
    try:
        return json.loads(data)
    except json.JSONDecodeError:
        print(f"ERROR: Invalid JSON response: {data[:300]}", file=sys.stderr)
        return None


def api_get(url, headers=None, timeout=120):
    """GET request and return parsed JSON response."""
    status, _, data = https_request("GET", url, headers=headers, timeout=timeout)
    if status >= 400:
        print(f"ERROR: HTTP {status}: {data[:300]}", file=sys.stderr)
        return None
    try:
        return json.loads(data)
    except json.JSONDecodeError:
        # Return raw text if not JSON
        return {"raw": data[:5000]}


def get_key(env_var, file_fallback=None, required=True, help_url=""):
    """Load API key from environment or fallback file."""
    val = os.environ.get(env_var, "")
    if val:
        return val
    if file_fallback and os.path.isfile(file_fallback):
        with open(file_fallback, "r") as f:
            return f.readline().strip()
    if required:
        print(f"ERROR: {env_var} not set.", file=sys.stderr)
        if help_url:
            print(f"Get one at: {help_url}", file=sys.stderr)
        sys.exit(1)
    return ""


def get_workspace():
    """Get workspace root (2 levels up from scripts dir)."""
    scripts_dir = os.path.dirname(os.path.abspath(__file__))
    skill_dir = os.path.dirname(scripts_dir)
    workspace = os.path.dirname(os.path.dirname(skill_dir))
    return workspace, skill_dir, scripts_dir


def truncate(text, max_len=200):
    """Truncate text with ellipsis."""
    if not text:
        return ""
    return text[:max_len] + "..." if len(text) > max_len else text
