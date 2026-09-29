#!/usr/bin/env python3
"""
SEO Parse — HTML parser for SEO element extraction.

Extracts: title, meta tags, canonicals, headings, images, links (internal/external),
schema (JSON-LD), Open Graph, Twitter Cards, hreflang, word count, text/code ratio.

Author: Laurent Rochetta
License: MIT
"""

import argparse
import json
import os
import re
import sys
from typing import Optional
from urllib.parse import urljoin, urlparse

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("Error: beautifulsoup4 required. Install: pip install beautifulsoup4", file=sys.stderr)
    sys.exit(1)

# Use lxml if available for speed, fallback to html.parser
try:
    import lxml  # noqa: F401
    HTML_PARSER = "lxml"
except ImportError:
    HTML_PARSER = "html.parser"


def parse_html(html: str, base_url: Optional[str] = None) -> dict:
    """
    Parse HTML and extract all SEO-relevant elements.

    Args:
        html: Raw HTML content
        base_url: Base URL for resolving relative links

    Returns:
        Comprehensive dictionary of SEO data
    """
    soup = BeautifulSoup(html, HTML_PARSER)

    result = {
        "title": None,
        "title_length": 0,
        "meta_description": None,
        "meta_description_length": 0,
        "meta_robots": None,
        "meta_viewport": None,
        "canonical": None,
        "headings": {"h1": [], "h2": [], "h3": [], "h4": []},
        "images": [],
        "links": {"internal": [], "external": [], "broken_candidates": []},
        "schema_blocks": [],
        "open_graph": {},
        "twitter_card": {},
        "hreflang": [],
        "word_count": 0,
        "html_size_bytes": len(html.encode("utf-8")),
        "text_ratio": 0.0,
        "has_lang_attr": False,
        "lang": None,
        "scripts_count": 0,
        "stylesheets_count": 0,
        "dom_depth_estimate": 0,
        "security_headers_hints": {},
    }

    # ── Title ──
    title_tag = soup.find("title")
    if title_tag:
        result["title"] = title_tag.get_text(strip=True)
        result["title_length"] = len(result["title"])

    # ── Meta Tags ──
    for meta in soup.find_all("meta"):
        name = (meta.get("name") or "").lower()
        property_attr = (meta.get("property") or "").lower()
        content = meta.get("content", "")

        if name == "description":
            result["meta_description"] = content
            result["meta_description_length"] = len(content)
        elif name == "robots":
            result["meta_robots"] = content
        elif name == "viewport":
            result["meta_viewport"] = content

        # Open Graph
        if property_attr.startswith("og:"):
            result["open_graph"][property_attr] = content

        # Twitter Card
        if name.startswith("twitter:"):
            result["twitter_card"][name] = content

    # ── Language ──
    html_tag = soup.find("html")
    if html_tag and html_tag.get("lang"):
        result["has_lang_attr"] = True
        result["lang"] = html_tag.get("lang")

    # ── Canonical ──
    canonical = soup.find("link", rel="canonical")
    if canonical:
        result["canonical"] = canonical.get("href")

    # ── Hreflang ──
    for link in soup.find_all("link", rel="alternate"):
        hreflang = link.get("hreflang")
        if hreflang:
            result["hreflang"].append({
                "lang": hreflang,
                "href": link.get("href"),
            })

    # ── Headings ──
    for level in ["h1", "h2", "h3", "h4"]:
        for tag in soup.find_all(level):
            text = tag.get_text(strip=True)
            if text:
                result["headings"][level].append(text)

    # ── Images ──
    for img in soup.find_all("img"):
        src = img.get("src", "")
        if base_url and src:
            src = urljoin(base_url, src)

        has_alt = img.get("alt") is not None
        alt_text = img.get("alt", "")
        has_dimensions = bool(img.get("width") and img.get("height"))

        result["images"].append({
            "src": src,
            "alt": alt_text,
            "has_alt": has_alt,
            "alt_empty": has_alt and alt_text.strip() == "",
            "width": img.get("width"),
            "height": img.get("height"),
            "has_dimensions": has_dimensions,
            "loading": img.get("loading"),
            "srcset": img.get("srcset") is not None,
        })

    # ── Links ──
    if base_url:
        base_domain = urlparse(base_url).netloc

        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            if not href or href.startswith("#") or href.startswith("javascript:"):
                continue

            full_url = urljoin(base_url, href)
            parsed = urlparse(full_url)

            link_data = {
                "href": full_url,
                "text": a.get_text(strip=True)[:100],
                "rel": a.get("rel", []),
                "is_nofollow": "nofollow" in (a.get("rel") or []),
                "target": a.get("target"),
            }

            if parsed.netloc == base_domain:
                result["links"]["internal"].append(link_data)
            else:
                result["links"]["external"].append(link_data)

    # ── Schema (JSON-LD) ──
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            schema_data = json.loads(script.string)
            if isinstance(schema_data, dict):
                result["schema_blocks"].append({
                    "type": schema_data.get("@type", "unknown"),
                    "data": schema_data,
                })
            elif isinstance(schema_data, list):
                for item in schema_data:
                    if isinstance(item, dict):
                        result["schema_blocks"].append({
                            "type": item.get("@type", "unknown"),
                            "data": item,
                        })
        except (json.JSONDecodeError, TypeError):
            result["schema_blocks"].append({"type": "PARSE_ERROR", "data": None})

    # ── Resource Counts ──
    result["scripts_count"] = len(soup.find_all("script"))
    result["stylesheets_count"] = len(soup.find_all("link", rel="stylesheet"))

    # ── Word Count & Text Ratio ──
    text_soup = BeautifulSoup(html, HTML_PARSER)
    for element in text_soup(["script", "style", "nav", "footer", "header", "noscript"]):
        element.decompose()

    visible_text = text_soup.get_text(separator=" ", strip=True)
    words = re.findall(r"\b\w+\b", visible_text)
    result["word_count"] = len(words)

    text_bytes = len(visible_text.encode("utf-8"))
    if result["html_size_bytes"] > 0:
        result["text_ratio"] = round(text_bytes / result["html_size_bytes"], 3)

    return result


# ── CLI ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="SEO Parse — HTML parser for SEO analysis (BMAD+ SEO Engine)"
    )
    parser.add_argument("file", nargs="?", help="HTML file to parse")
    parser.add_argument("--url", "-u", help="Base URL for resolving relative links")
    parser.add_argument("--json", "-j", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    if args.file:
        real_path = os.path.realpath(args.file)
        if not os.path.isfile(real_path):
            print(f"Error: File not found: {args.file}", file=sys.stderr)
            sys.exit(1)
        with open(real_path, "r", encoding="utf-8") as f:
            html = f.read()
    else:
        html = sys.stdin.read()

    result = parse_html(html, args.url)

    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print(f"Title: {result['title']} ({result['title_length']} chars)")
        print(f"Meta Description: {result['meta_description'][:80] + '...' if result['meta_description'] and len(result['meta_description']) > 80 else result['meta_description']}")
        print(f"Canonical: {result['canonical']}")
        print(f"Language: {result['lang']}")
        print(f"H1: {len(result['headings']['h1'])} | H2: {len(result['headings']['h2'])} | H3: {len(result['headings']['h3'])}")
        print(f"Images: {len(result['images'])} (missing alt: {sum(1 for i in result['images'] if not i['has_alt'])})")
        print(f"Internal Links: {len(result['links']['internal'])} | External: {len(result['links']['external'])}")
        print(f"Schema Blocks: {len(result['schema_blocks'])} ({', '.join(s['type'] for s in result['schema_blocks'])})")
        print(f"Word Count: {result['word_count']:,}")
        print(f"Text/HTML Ratio: {result['text_ratio']:.1%}")
        print(f"Scripts: {result['scripts_count']} | Stylesheets: {result['stylesheets_count']}")


if __name__ == "__main__":
    main()
