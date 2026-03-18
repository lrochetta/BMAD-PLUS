#!/usr/bin/env python3
"""
SEO Screenshot — Viewport screenshot capture for visual SEO analysis.

Features:
- Mobile and desktop viewport presets
- Above-the-fold element detection
- Full-page capture option
- PNG output with configurable quality

Requires: playwright (pip install playwright && playwright install chromium)

Author: Laurent Rochetta
License: MIT
"""

import argparse
import sys


VIEWPORTS = {
    "mobile": {"width": 375, "height": 812, "device_scale_factor": 3, "is_mobile": True},
    "tablet": {"width": 768, "height": 1024, "device_scale_factor": 2, "is_mobile": True},
    "desktop": {"width": 1440, "height": 900, "device_scale_factor": 1, "is_mobile": False},
    "desktop-hd": {"width": 1920, "height": 1080, "device_scale_factor": 1, "is_mobile": False},
}


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
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "Error: playwright required.\n"
            "Install: pip install playwright && playwright install chromium",
            file=sys.stderr,
        )
        sys.exit(1)

    vp = VIEWPORTS.get(viewport, VIEWPORTS["desktop"])

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
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

        page = context.new_page()

        try:
            page.goto(url, wait_until="networkidle", timeout=30000)
        except Exception:
            # Fallback: wait for load event instead
            page.goto(url, wait_until="load", timeout=30000)

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

    metrics = capture_screenshot(
        url=args.url,
        output=args.output,
        viewport=args.viewport,
        full_page=args.full,
        wait_ms=args.wait,
    )

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


if __name__ == "__main__":
    main()
