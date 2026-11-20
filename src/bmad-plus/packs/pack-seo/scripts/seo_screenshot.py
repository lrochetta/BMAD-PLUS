#!/usr/bin/env python3
"""
SEO Screenshot — Viewport screenshot capture for visual SEO analysis.

Features:
- Mobile and desktop viewport presets
- Above-the-fold element detection
- Full-page capture option
- PNG output with configurable quality
- SSRF protection shared with seo_fetch.py: the target is validated once and
  Chromium is pinned to that address, so the browser reaches the audited host
  and nothing else

Network policy. Chromium resolves names itself, so validating the URL is not
enough: a DNS-rebinding answer, a redirect or any subresource could take it
to an internal address. The browser is therefore confined by three guards:

1. Resolver pinning: --host-resolver-rules maps the audited host to the
   address seo_fetch validated and makes every other name unresolvable.
2. Proxy trap: every request except those for the audited host goes to a
   proxy whose name cannot resolve, so it fails even when it names an IP
   literal, loopback included (the bypass list drops Chromium's implicit
   loopback bypass).
3. Interception: each request and WebSocket the page opens is checked
   before it leaves; anything outside the audited host is aborted.

Playwright routes only the first URL of a redirect chain, so the hops of a
redirect (of the page or of a subresource) are held by guards 1 and 2, each
of which holds on its own. Every request a guard stops, redirect hops
included, is reported in ``blocked_requests``.

Third-party subresources (CDN images, fonts, analytics, embeds) are blocked,
not validated one by one: the resolver rules are fixed at launch, so a host
discovered while rendering could not be pinned, and a capture that contacted
it would send the auditor's IP address to parties nobody chose. The
screenshot shows the page as its own host serves it. A redirect to another
host fails the capture; capture the final URL instead. Service workers are
blocked and WebRTC may not open UDP sockets of its own.

Requires: playwright >= 1.48 (pip install playwright && playwright install chromium)

Author: Laurent Rochetta
License: MIT
"""

import argparse
import ipaddress
import re
import sys
from urllib.parse import urlparse

import seo_fetch

# The proxy that non-audited requests are sent to. ".invalid" never resolves
# (RFC 6761) and the resolver rules refuse every name but the audited host.
TRAP_PROXY = "http://blocked.invalid:9"
LOCAL_SCHEMES = frozenset({"about", "blob", "data"})
NETWORK_SCHEMES = frozenset({"http", "https", "ws", "wss"})
_HOSTNAME = re.compile(r"[a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.?")
_MAX_REPORTED = 50

VIEWPORTS = {
    "mobile": {"width": 375, "height": 812, "device_scale_factor": 3, "is_mobile": True},
    "tablet": {"width": 768, "height": 1024, "device_scale_factor": 2, "is_mobile": True},
    "desktop": {"width": 1440, "height": 900, "device_scale_factor": 1, "is_mobile": False},
    "desktop-hd": {"width": 1920, "height": 1080, "device_scale_factor": 1, "is_mobile": False},
}


class CaptureError(RuntimeError):
    """The page could not be loaded under the network policy."""


def pin_target(url: str) -> "tuple[str, str, str]":
    """Validate a URL with seo_fetch's rules and return ``(url, host, address)``.

    ``host`` is the name as Chromium will send it (lowercase ASCII, IDNA
    encoded, no brackets) and ``address`` the public address it is pinned to.
    Raises seo_fetch.UnsafeURLError on anything seo_fetch would refuse, and on
    a host that cannot be written safely into a resolver rule.
    """
    if not urlparse(url).scheme:
        url = f"https://{url}"
    hostname, address = seo_fetch.resolve_target(url)
    try:
        host = hostname.encode("idna").decode("ascii").lower()
    except UnicodeError:
        raise seo_fetch.UnsafeURLError(f"host name cannot be encoded: {hostname}") from None
    try:
        ipaddress.ip_address(host)
    except ValueError:
        if not _HOSTNAME.fullmatch(host):
            raise seo_fetch.UnsafeURLError(f"unsupported host name: {hostname}") from None
    return url, host, address


def isolation_options(host: str, address: str) -> dict:
    """Chromium launch options that confine the browser to ``host`` at ``address``."""
    pinned = f"[{address}]" if ":" in address else address
    rule_host = f"[{host}]" if ":" in host else host
    return {
        "args": [
            f"--host-resolver-rules=MAP {rule_host} {pinned}, MAP * ~NOTFOUND",
            "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
            "--webrtc-ip-handling-policy=disable_non_proxied_udp",
            "--dns-prefetch-disable",
            # The last matching bypass rule wins: "<-loopback>" first drops
            # Chromium's implicit loopback bypass without overriding the host.
            f"--proxy-server={TRAP_PROXY}",
            f"--proxy-bypass-list=<-loopback>;{rule_host}",
        ],
    }


class RequestGuard:
    """Let through the requests of one host; abort and record all others."""

    def __init__(self, host: str):
        self.host = host
        self.blocked: "list[str]" = []

    def allows(self, url: str) -> bool:
        parsed = urlparse(url)
        if parsed.scheme in LOCAL_SCHEMES:
            return True
        return parsed.scheme in NETWORK_SCHEMES and parsed.hostname == self.host

    def _refuse(self, url: str) -> None:
        if url not in self.blocked and len(self.blocked) < _MAX_REPORTED:
            self.blocked.append(url)

    def on_request(self, route) -> None:
        url = route.request.url
        if self.allows(url):
            route.continue_()
        else:
            self._refuse(url)
            route.abort("blockedbyclient")

    def on_request_failed(self, request) -> None:
        # A redirect hop off the host never reaches on_request: the resolver
        # rules or the trap proxy stop it, and it fails here instead.
        if not self.allows(request.url):
            self._refuse(request.url)

    def on_websocket(self, ws) -> None:
        # A route that is not connected to the server stays a local mock:
        # nothing leaves the browser. It is not closed, because Playwright
        # runs this handler on its event loop, where the synchronous close()
        # would wait for itself forever.
        if self.allows(ws.url):
            ws.connect_to_server()
        else:
            self._refuse(ws.url)


def capture_screenshot(
    url: str,
    output: str = "screenshot.png",
    viewport: str = "desktop",
    full_page: bool = False,
    wait_ms: int = 2000,
):
    """
    Capture a viewport screenshot of a URL using Playwright.

    Args:
        url: URL to capture
        output: Output file path (.png)
        viewport: Viewport preset (mobile, tablet, desktop, desktop-hd)
        full_page: Capture full page scroll or just viewport
        wait_ms: Wait time after page load (ms)

    Raises seo_fetch.UnsafeURLError before any browser starts when the URL
    breaks seo_fetch's rules, and CaptureError when the page cannot load
    under the network policy (see the module docstring).
    """
    url, host, address = pin_target(url)
    try:
        from playwright.sync_api import Error as PlaywrightError
        from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "Error: playwright required.\n"
            "Install: pip install playwright && playwright install chromium",
            file=sys.stderr,
        )
        sys.exit(1)

    vp = VIEWPORTS.get(viewport, VIEWPORTS["desktop"])

    guard = RequestGuard(host)

    # Leaving the block stops the Playwright driver, which ends the browser
    # on every path, errors included.
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, **isolation_options(host, address))
        context = browser.new_context(
            service_workers="block",
            accept_downloads=False,
            viewport={"width": vp["width"], "height": vp["height"]},
            device_scale_factor=vp["device_scale_factor"],
            is_mobile=vp["is_mobile"],
            user_agent=(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                "AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"
                if vp["is_mobile"]
                else "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 BMADSEOEngine/2.0"
            ),
        )

        if not hasattr(context, "route_web_socket"):
            raise CaptureError("Playwright 1.48 or later is required to guard WebSockets")
        context.route("**/*", guard.on_request)
        context.route_web_socket("**/*", guard.on_websocket)
        context.on("requestfailed", guard.on_request_failed)
        page = context.new_page()

        try:
            try:
                page.goto(url, wait_until="networkidle", timeout=30000)
            except PlaywrightTimeoutError:
                # Fallback: wait for load event instead
                page.goto(url, wait_until="load", timeout=30000)
        except PlaywrightError as e:
            raise CaptureError(
                f"{url} did not load under the network policy (a redirect to another host"
                f" or a non-public address is refused): {e.message.splitlines()[0]}"
            ) from None

        # Wait for dynamic content
        page.wait_for_timeout(wait_ms)

        # Capture screenshot
        page.screenshot(path=output, full_page=full_page)

        # Gather above-the-fold metrics
        metrics = page.evaluate("""() => {
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            // Find CTAs above the fold
            const ctas = [];
            const buttons = document.querySelectorAll('a, button, [role="button"]');
            buttons.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.top < viewportHeight && rect.bottom > 0) {
                    const text = el.textContent.trim().substring(0, 50);
                    if (text && (
                        /sign.?up|get.?start|try|buy|contact|demo|free|download|subscribe/i.test(text)
                    )) {
                        ctas.push({
                            text: text,
                            tag: el.tagName,
                            top: Math.round(rect.top),
                            visible: rect.width > 0 && rect.height > 0,
                        });
                    }
                }
            });

            // Find hero/LCP candidate
            const images = document.querySelectorAll('img');
            let largestImage = null;
            let largestArea = 0;
            images.forEach(img => {
                const rect = img.getBoundingClientRect();
                const area = rect.width * rect.height;
                if (area > largestArea && rect.top < viewportHeight) {
                    largestArea = area;
                    largestImage = {
                        src: img.src.substring(0, 100),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        top: Math.round(rect.top),
                    };
                }
            });

            // Check for horizontal scroll
            const hasHorizontalScroll = document.documentElement.scrollWidth > viewportWidth;

            // Font size check
            const body = document.body;
            const bodyFontSize = body ? parseFloat(getComputedStyle(body).fontSize) : 16;

            return {
                viewportWidth,
                viewportHeight,
                ctas_above_fold: ctas.length,
                cta_details: ctas.slice(0, 5),
                largest_image_above_fold: largestImage,
                has_horizontal_scroll: hasHorizontalScroll,
                body_font_size_px: bodyFontSize,
                dom_element_count: document.querySelectorAll('*').length,
            };
        }""")

        browser.close()

    metrics["blocked_requests"] = guard.blocked
    return metrics


# ── CLI ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="SEO Screenshot — Viewport capture (BMAD+ SEO Engine)"
    )
    parser.add_argument("url", help="URL to capture")
    parser.add_argument("--output", "-o", default="screenshot.png", help="Output file path")
    parser.add_argument(
        "--viewport", "-v",
        choices=list(VIEWPORTS.keys()), default="desktop",
        help="Viewport preset"
    )
    parser.add_argument("--full", action="store_true", help="Capture full page (not just viewport)")
    parser.add_argument("--wait", "-w", type=int, default=2000, help="Wait after load (ms)")
    parser.add_argument("--json", "-j", action="store_true", help="Output metrics as JSON")

    args = parser.parse_args()

    import json

    try:
        metrics = capture_screenshot(
            url=args.url,
            output=args.output,
            viewport=args.viewport,
            full_page=args.full,
            wait_ms=args.wait,
        )
    except seo_fetch.UnsafeURLError as e:
        print(f"Error: Blocked: {e}", file=sys.stderr)
        sys.exit(1)
    except CaptureError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Screenshot saved: {args.output}", file=sys.stderr)

    if args.json:
        print(json.dumps(metrics, indent=2))
    else:
        print(f"\nAbove-the-Fold Analysis ({args.viewport}):")
        print(f"  Viewport: {metrics['viewportWidth']}×{metrics['viewportHeight']}")
        print(f"  CTAs above fold: {metrics['ctas_above_fold']}")
        for cta in metrics.get("cta_details", []):
            print(f"    - \"{cta['text']}\" ({cta['tag']}, top: {cta['top']}px)")
        if metrics.get("largest_image_above_fold"):
            img = metrics["largest_image_above_fold"]
            print(f"  Largest image: {img['width']}×{img['height']} at y={img['top']}px")
        print(f"  Horizontal scroll: {'⚠️ YES' if metrics['has_horizontal_scroll'] else '✅ No'}")
        print(f"  Body font size: {metrics['body_font_size_px']}px {'✅' if metrics['body_font_size_px'] >= 16 else '⚠️ <16px'}")
        print(f"  DOM elements: {metrics['dom_element_count']:,}")
        if metrics["blocked_requests"]:
            print(f"  Blocked requests (not the audited host): {len(metrics['blocked_requests'])}")


if __name__ == "__main__":
    main()
