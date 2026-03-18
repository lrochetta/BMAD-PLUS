#!/usr/bin/env python3
"""
SEO Fetch — Secure HTTP page fetcher for SEO analysis.

Features:
- SSRF protection (blocks private/loopback/reserved IPs)
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
import socket
import sys
from typing import Optional
from urllib.parse import urlparse

try:
    import requests
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

def is_safe_url(url: str) -> bool:
    """Block requests to private, loopback, and reserved IP addresses."""
    parsed = urlparse(url)
    hostname = parsed.hostname

    if not hostname:
        return False

    try:
        resolved_ip = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(resolved_ip)
        if ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local:
            return False
    except (socket.gaierror, ValueError):
        pass  # DNS failure handled by requests

    return True


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

    if parsed.scheme not in ("http", "https"):
        result["error"] = f"Invalid URL scheme: {parsed.scheme}"
        return result

    # SSRF check
    if not is_safe_url(url):
        resolved = "unknown"
        try:
            resolved = socket.gethostbyname(parsed.hostname)
        except Exception:
            pass
        result["error"] = f"Blocked: URL resolves to private/internal IP ({resolved})"
        return result

    try:
        session = requests.Session()
        session.max_redirects = max_redirects

        headers = dict(DEFAULT_HEADERS)
        ua_string = USER_AGENTS.get(user_agent, user_agent)
        headers["User-Agent"] = ua_string

        import time
        start = time.monotonic()

        response = session.get(
            url,
            headers=headers,
            timeout=timeout,
            allow_redirects=follow_redirects,
        )

        elapsed_ms = round((time.monotonic() - start) * 1000)

        result["final_url"] = response.url
        result["status_code"] = response.status_code
        result["content"] = response.text
        result["headers"] = dict(response.headers)
        result["content_length"] = len(response.content)
        result["response_time_ms"] = elapsed_ms

        if response.history:
            result["redirect_chain"] = [
                {"url": r.url, "status": r.status_code}
                for r in response.history
            ]

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
    print(f"\n--- Fetch Summary ---", file=sys.stderr)
    print(f"Final URL: {result['final_url']}", file=sys.stderr)
    print(f"Status: {result['status_code']}", file=sys.stderr)
    print(f"Size: {result['content_length']:,} bytes", file=sys.stderr)
    print(f"Time: {result['response_time_ms']}ms", file=sys.stderr)
    if result["redirect_chain"]:
        chain = " → ".join(r["url"] for r in result["redirect_chain"])
        print(f"Redirects: {chain}", file=sys.stderr)


if __name__ == "__main__":
    main()
