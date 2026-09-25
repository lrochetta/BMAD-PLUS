"""Shared HTTP utilities for OSINT scripts — stdlib only, zero dependencies."""

import http.client
import json
import os
import ssl
import sys
from urllib.parse import urlparse, urlencode, quote


def https_request(method, url, headers=None, body=None, timeout=120):
    """Make an HTTPS request and return (status, headers, body_str).
    
    Handles both http and https URLs.
    """
    parsed = urlparse(url)
    scheme = parsed.scheme or "https"
    host = parsed.hostname
    port = parsed.port or (443 if scheme == "https" else 80)
    path = parsed.path or "/"
    if parsed.query:
        path += "?" + parsed.query

    if scheme == "https":
        ctx = ssl.create_default_context()
        conn = http.client.HTTPSConnection(host, port, timeout=timeout, context=ctx)
    else:
        conn = http.client.HTTPConnection(host, port, timeout=timeout)

    hdrs = {"User-Agent": "osint-skill/3.2-python"}
    if headers:
        hdrs.update(headers)

    conn.request(method, path, body=body, headers=hdrs)
    resp = conn.getresponse()
    data = resp.read().decode("utf-8", errors="replace")
    status = resp.status
    resp_headers = dict(resp.getheaders())
    conn.close()
    return status, resp_headers, data


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
