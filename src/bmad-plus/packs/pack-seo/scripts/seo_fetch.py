#!/usr/bin/env python3
"""
SEO Fetch — Secure HTTP page fetcher for SEO analysis.

Features:
- SSRF protection (blocks private/loopback/reserved IPs, re-checked on every
  redirect hop, connection pinned to the validated address)
- Multi-UA support (standard, Googlebot, GPTBot, ClaudeBot)
- Redirect chain tracking
- Cookie handling
- Configurable timeout

Author: Laurent Rochetta
License: MIT
"""

import argparse
import ipaddress
import json
import os
import socket
import sys
import time
from urllib.parse import urljoin, urlparse

try:
    import requests
    from requests.adapters import DEFAULT_POOLBLOCK, HTTPAdapter
    from urllib3 import PoolManager
except ImportError:
    print("Error: requests library required. Install: pip install requests", file=sys.stderr)
    sys.exit(1)


# ── User-Agent Presets ──────────────────────────────────────────────

USER_AGENTS = {
    "default": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 BMADSEOEngine/2.0"
    ),
    "googlebot": (
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    ),
    "gptbot": (
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; "
        "+https://openai.com/gptbot)"
    ),
    "claudebot": (
        "Mozilla/5.0 (compatible; ClaudeBot/1.0; +https://www.anthropic.com/claudebot)"
    ),
    "mobile": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    ),
}

DEFAULT_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Cache-Control": "no-cache",
}


# ── Security: SSRF Prevention ──────────────────────────────────────

ALLOWED_SCHEMES = frozenset({"http", "https"})

# RFC 6052 well-known NAT64 prefix: the last 32 bits are the IPv4 host the
# translator will reach, so the address is only as safe as that IPv4 host.
_NAT64_PREFIX = ipaddress.ip_network("64:ff9b::/96")


class UnsafeURLError(requests.exceptions.InvalidURL):
    """A URL, or the address it resolves to, must never be fetched."""


def _ip_is_blocked(ip: "ipaddress._BaseAddress") -> bool:
    """Return True if an IP falls in any range that must never be reached.

    Anything that is not globally routable is refused: private, loopback,
    link-local (cloud metadata at 169.254.169.254), carrier-grade NAT
    (100.64.0.0/10, e.g. Alibaba metadata at 100.100.100.200), documentation
    and benchmarking ranges, multicast and reserved space. IPv6 forms that
    embed an IPv4 destination are judged by that destination.
    """
    if ip.version == 6:
        embedded = ip.ipv4_mapped
        if embedded is None and ip in _NAT64_PREFIX:
            embedded = ipaddress.IPv4Address(int(ip) & 0xFFFFFFFF)
        if embedded is not None:
            return _ip_is_blocked(embedded)
        if ip.is_site_local:
            return True
    return bool(
        not ip.is_global
        or ip.is_private
        or ip.is_loopback
        or ip.is_reserved
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_unspecified
    )


def check_url(url: str) -> str:
    """Apply the URL-level rules and return the hostname, without resolving it.

    Fails CLOSED with UnsafeURLError: a scheme outside http/https, embedded
    credentials, a missing host or an invalid port rejects the URL.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise UnsafeURLError(f"scheme not allowed: {parsed.scheme or '(none)'}")
    # "user:pass@" would be sent as an Authorization header and makes
    # "https://trusted.example@evil.example/" style URLs misleading.
    if parsed.username is not None or parsed.password is not None:
        raise UnsafeURLError("credentials in URL are not allowed")
    hostname = parsed.hostname
    if not hostname:
        raise UnsafeURLError("URL has no host")
    try:
        parsed.port
    except ValueError:
        raise UnsafeURLError("URL has an invalid port") from None
    return hostname


def resolve_public_address(hostname: str) -> str:
    """Resolve a hostname and return the public address to connect to.

    Fails CLOSED with UnsafeURLError on a DNS error or when any resolved
    address (IPv4 or IPv6) is not public: every address the name resolves to
    must be public, so the returned one is safe whichever the resolver would
    have preferred.
    """
    try:
        addrinfo = socket.getaddrinfo(hostname, None)
    except (socket.gaierror, UnicodeError):
        raise UnsafeURLError(f"cannot resolve host {hostname}") from None

    addresses = []
    for entry in addrinfo:
        try:
            ip = ipaddress.ip_address(entry[4][0])
        except ValueError:
            raise UnsafeURLError(f"{hostname} resolved to an unparseable address") from None
        if _ip_is_blocked(ip):
            raise UnsafeURLError(f"{hostname} resolves to a private/internal address ({ip})")
        addresses.append(ip)
    if not addresses:
        raise UnsafeURLError(f"cannot resolve host {hostname}")

    # A pinned connection cannot fall back to another address, and IPv6 routes
    # are often missing in containers and CI: prefer IPv4 on dual-stack hosts.
    preferred = next((ip for ip in addresses if ip.version == 4), addresses[0])
    return str(preferred)


def resolve_target(url: str) -> "tuple[str, str]":
    """Validate a URL and return ``(hostname, address)`` to connect to.

    Combines check_url() and resolve_public_address(); see their rules.
    """
    hostname = check_url(url)
    return hostname, resolve_public_address(hostname)


def is_safe_url(url: str) -> bool:
    """Return True when resolve_target() accepts the URL (see its rules)."""
    try:
        resolve_target(url)
    except UnsafeURLError:
        return False
    return True


class _PinnedPoolManager(PoolManager):
    """urllib3 pool manager that only opens pools on validated IP literals.

    Every requests version reaches the network through
    PoolManager.connection_from_host (directly, or via connection_from_url),
    whatever adapter hook it calls first. Validating here, instead of in a
    requests hook that has been renamed across releases, keeps the guard
    closed on old and future requests versions alike.
    """

    def connection_from_host(self, host, port=None, scheme="http", pool_kwargs=None):
        hostname = (host or "").strip("[]")
        if not hostname:
            raise UnsafeURLError("URL has no host")
        address = resolve_public_address(hostname)
        if scheme == "https":
            pool_kwargs = dict(pool_kwargs or {})
            pool_kwargs["server_hostname"] = hostname
            pool_kwargs["assert_hostname"] = hostname
        return super().connection_from_host(
            address, port=port, scheme=scheme, pool_kwargs=pool_kwargs
        )


class PinnedAddressAdapter(HTTPAdapter):
    """Transport adapter that connects to the exact address it validated.

    A plain requests call resolves the host again when urllib3 opens the
    socket, so a hostile DNS server can answer a public address to the SSRF
    check and a private one to the connection (DNS rebinding). This adapter's
    pool manager resolves and validates each host itself, then opens the
    connection pool on that IP literal. The Host header, TLS SNI and the
    certificate hostname check still use the original name, so HTTPS
    verification is unchanged. Proxies are refused: a proxy would resolve the
    name itself and bypass the pinned address.
    """

    def init_poolmanager(self, connections, maxsize, block=DEFAULT_POOLBLOCK, **pool_kwargs):
        super().init_poolmanager(connections, maxsize, block, **pool_kwargs)
        # Rebuild with the exact settings requests chose for this version.
        self.poolmanager = _PinnedPoolManager(
            num_pools=connections, **self.poolmanager.connection_pool_kw
        )

    def proxy_manager_for(self, proxy, **proxy_kwargs):
        raise UnsafeURLError("proxies are not supported by the pinned transport")

    def send(self, request, **kwargs):
        check_url(request.url)
        # urllib3 would derive Host from the pool's IP literal; keep the name.
        if "Host" not in request.headers:
            request.headers["Host"] = urlparse(request.url).netloc.rpartition("@")[2]
        return super().send(request, **kwargs)


def create_session() -> requests.Session:
    """Build a requests session whose every connection is SSRF-checked and pinned.

    Environment proxies and ~/.netrc credentials are ignored: a proxy defeats
    address pinning and netrc would attach credentials to attacker-chosen hosts.
    A custom CA bundle named by REQUESTS_CA_BUNDLE or CURL_CA_BUNDLE (corporate
    TLS inspection) is still honoured, since it does not weaken pinning.
    """
    session = requests.Session()
    session.trust_env = False
    ca_bundle = os.environ.get("REQUESTS_CA_BUNDLE") or os.environ.get("CURL_CA_BUNDLE")
    if ca_bundle:
        session.verify = ca_bundle
    adapter = PinnedAddressAdapter()
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


# ── Core Fetcher ───────────────────────────────────────────────────

def fetch_page(
    url: str,
    timeout: int = 30,
    follow_redirects: bool = True,
    max_redirects: int = 5,
    user_agent: str = "default",
) -> dict:
    """
    Fetch a web page with security checks and detailed response tracking.

    Returns dict with: url, status_code, content, headers, redirect_chain,
    content_length, response_time_ms, error
    """
    result = {
        "url": url,
        "final_url": None,
        "status_code": None,
        "content": None,
        "headers": {},
        "redirect_chain": [],
        "content_length": 0,
        "response_time_ms": 0,
        "error": None,
    }

    # Normalize URL
    parsed = urlparse(url)
    if not parsed.scheme:
        url = f"https://{url}"
        parsed = urlparse(url)

    if parsed.scheme not in ALLOWED_SCHEMES:
        result["error"] = f"Invalid URL scheme: {parsed.scheme}"
        return result

    current_url = url
    try:
        session = create_session()

        headers = dict(DEFAULT_HEADERS)
        ua_string = USER_AGENTS.get(user_agent, user_agent)
        headers["User-Agent"] = ua_string

        start = time.monotonic()

        # Follow redirects manually so every hop goes back through the pinned
        # adapter, which validates the target before connecting. Letting
        # requests follow redirects internally would hide the hop count and
        # the chain; the adapter still guards each connection either way.
        redirect_chain = []
        hops = 0
        response = None

        while True:
            response = session.get(
                current_url,
                headers=headers,
                timeout=timeout,
                allow_redirects=False,
            )

            if not follow_redirects or not response.is_redirect:
                break

            location = response.headers.get("Location")
            if not location:
                break

            next_url = urljoin(current_url, location)
            next_scheme = urlparse(next_url).scheme
            if next_scheme not in ALLOWED_SCHEMES:
                result["error"] = f"Blocked redirect to non-HTTP(S) scheme: {next_scheme}"
                return result

            hops += 1
            if hops > max_redirects:
                result["error"] = f"Too many redirects (max {max_redirects})"
                return result

            redirect_chain.append(
                {"url": current_url, "status": response.status_code}
            )
            response.close()
            current_url = next_url

        elapsed_ms = round((time.monotonic() - start) * 1000)

        result["final_url"] = current_url
        result["status_code"] = response.status_code
        result["content"] = response.text
        result["headers"] = dict(response.headers)
        result["content_length"] = len(response.content)
        result["response_time_ms"] = elapsed_ms
        result["redirect_chain"] = redirect_chain

    except UnsafeURLError as e:
        if current_url == url:
            result["error"] = f"Blocked: {e}"
        else:
            result["error"] = f"Blocked: redirect to private/internal URL ({current_url}): {e}"
    except requests.exceptions.Timeout:
        result["error"] = f"Request timed out after {timeout}s"
    except requests.exceptions.TooManyRedirects:
        result["error"] = f"Too many redirects (max {max_redirects})"
    except requests.exceptions.SSLError as e:
        result["error"] = f"SSL error: {e}"
    except requests.exceptions.ConnectionError as e:
        result["error"] = f"Connection error: {e}"
    except requests.exceptions.RequestException as e:
        result["error"] = f"Request failed: {e}"

    return result


# ── CLI ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="SEO Fetch — Secure HTTP fetcher for SEO analysis (BMAD+ SEO Engine)"
    )
    parser.add_argument("url", help="URL to fetch")
    parser.add_argument("--output", "-o", help="Save HTML to file")
    parser.add_argument("--timeout", "-t", type=int, default=30, help="Timeout in seconds")
    parser.add_argument("--no-redirects", action="store_true", help="Don't follow redirects")
    parser.add_argument(
        "--ua", choices=list(USER_AGENTS.keys()), default="default",
        help="User-Agent preset (default, googlebot, gptbot, claudebot, mobile)"
    )
    parser.add_argument("--json", "-j", action="store_true", help="Output full result as JSON")

    args = parser.parse_args()

    result = fetch_page(
        args.url,
        timeout=args.timeout,
        follow_redirects=not args.no_redirects,
        user_agent=args.ua,
    )

    if result["error"]:
        print(f"Error: {result['error']}", file=sys.stderr)
        sys.exit(1)

    if args.json:
        # Output metadata as JSON (without full HTML content for readability)
        output = {k: v for k, v in result.items() if k != "content"}
        output["content_preview"] = result["content"][:500] if result["content"] else None
        print(json.dumps(output, indent=2))
    elif args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(result["content"])
        print(f"Saved to {args.output}")
    else:
        print(result["content"])

    # Metadata to stderr
    print("\n--- Fetch Summary ---", file=sys.stderr)
    print(f"Final URL: {result['final_url']}", file=sys.stderr)
    print(f"Status: {result['status_code']}", file=sys.stderr)
    print(f"Size: {result['content_length']:,} bytes", file=sys.stderr)
    print(f"Time: {result['response_time_ms']}ms", file=sys.stderr)
    if result["redirect_chain"]:
        chain = " → ".join(r["url"] for r in result["redirect_chain"])
        print(f"Redirects: {chain}", file=sys.stderr)


if __name__ == "__main__":
    main()
