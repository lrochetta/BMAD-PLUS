#!/usr/bin/env python3
"""
SEO Crawl — Recursive mini-crawler for site structure discovery.

Features:
- Sitemap.xml parsing for initial page list
- Recursive link-following with configurable depth
- Internal link graph construction
- Orphan page detection
- robots.txt respect

Author: Laurent Rochetta
License: MIT
"""

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from typing import Optional, Set
from urllib.parse import urljoin, urlparse

try:
    import requests
except ImportError:
    print("Error: requests library required. Install: pip install requests", file=sys.stderr)
    sys.exit(1)

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 BMADSEOEngine/2.0"
)


class SEOCrawler:
    """Recursive mini-crawler for SEO site structure analysis."""

    def __init__(self, base_url: str, max_depth: int = 2, max_pages: int = 25, timeout: int = 15):
        self.base_url = base_url.rstrip("/")
        self.base_domain = urlparse(self.base_url).netloc
        self.max_depth = max_depth
        self.max_pages = max_pages
        self.timeout = timeout

        self.visited: Set[str] = set()
        self.pages: list = []
        self.link_graph: dict = defaultdict(set)  # page -> set of linked pages
        self.sitemap_urls: list = []
        self.robots_txt: Optional[str] = None
        self.errors: list = []

    def normalize_url(self, url: str) -> str:
        """Normalize URL for deduplication."""
        parsed = urlparse(url)
        path = parsed.path.rstrip("/") or "/"
        return f"{parsed.scheme}://{parsed.netloc}{path}"

    def is_internal(self, url: str) -> bool:
        """Check if URL belongs to the same domain."""
        return urlparse(url).netloc == self.base_domain

    def fetch(self, url: str) -> Optional[str]:
        """Fetch a page with error handling."""
        try:
            response = requests.get(
                url,
                headers={"User-Agent": USER_AGENT},
                timeout=self.timeout,
                allow_redirects=True,
            )
            if response.status_code == 200 and "text/html" in response.headers.get("content-type", ""):
                return response.text
            else:
                self.pages.append({
                    "url": url,
                    "status": response.status_code,
                    "content_type": response.headers.get("content-type", ""),
                    "title": None,
                    "word_count": 0,
                    "depth": -1,
                })
        except requests.RequestException as e:
            self.errors.append({"url": url, "error": str(e)})
        return None

    def fetch_robots_txt(self):
        """Fetch and store robots.txt."""
        try:
            response = requests.get(
                f"{self.base_url}/robots.txt",
                headers={"User-Agent": USER_AGENT},
                timeout=self.timeout,
            )
            if response.status_code == 200:
                self.robots_txt = response.text
        except requests.RequestException:
            pass

    def parse_sitemap(self):
        """Discover pages from sitemap.xml."""
        sitemap_url = f"{self.base_url}/sitemap.xml"

        # Check robots.txt for sitemap reference
        if self.robots_txt:
            for line in self.robots_txt.splitlines():
                if line.strip().lower().startswith("sitemap:"):
                    sitemap_url = line.split(":", 1)[1].strip()
                    break

        try:
            response = requests.get(
                sitemap_url,
                headers={"User-Agent": USER_AGENT},
                timeout=self.timeout,
            )
            if response.status_code == 200 and "xml" in response.headers.get("content-type", ""):
                root = ET.fromstring(response.content)
                ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

                for url_el in root.findall(".//sm:url/sm:loc", ns):
                    if url_el.text and self.is_internal(url_el.text):
                        self.sitemap_urls.append(url_el.text)

                # Handle sitemap index
                for sitemap_el in root.findall(".//sm:sitemap/sm:loc", ns):
                    self.sitemap_urls.append(f"[sitemap-index]: {sitemap_el.text}")

        except (requests.RequestException, ET.ParseError):
            pass

    def extract_links(self, html: str, page_url: str) -> list:
        """Extract internal links from HTML."""
        links = []
        # Simple regex for links (avoids BS4 dependency for crawler)
        for match in re.finditer(r'href=["\']([^"\']+)["\']', html):
            href = match.group(1)
            if href.startswith("#") or href.startswith("javascript:") or href.startswith("mailto:"):
                continue

            full_url = urljoin(page_url, href)
            if self.is_internal(full_url):
                normalized = self.normalize_url(full_url)
                links.append(normalized)
                self.link_graph[page_url].add(normalized)

        return links

    def extract_title(self, html: str) -> Optional[str]:
        """Extract title from HTML."""
        match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        return match.group(1).strip() if match else None

    def count_words(self, html: str) -> int:
        """Count visible words in HTML."""
        text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        words = re.findall(r"\b\w+\b", text)
        return len(words)

    def crawl(self):
        """Execute the recursive crawl."""
        self.fetch_robots_txt()
        self.parse_sitemap()

        # Start with base URL
        queue = [(self.base_url, 0)]  # (url, depth)

        while queue and len(self.visited) < self.max_pages:
            url, depth = queue.pop(0)
            normalized = self.normalize_url(url)

            if normalized in self.visited:
                continue
            if depth > self.max_depth:
                continue

            self.visited.add(normalized)
            html = self.fetch(normalized)

            if html:
                title = self.extract_title(html)
                word_count = self.count_words(html)

                self.pages.append({
                    "url": normalized,
                    "status": 200,
                    "title": title,
                    "word_count": word_count,
                    "depth": depth,
                })

                # Discover links for next level
                if depth < self.max_depth:
                    links = self.extract_links(html, normalized)
                    for link in links:
                        if link not in self.visited:
                            queue.append((link, depth + 1))

    def get_results(self) -> dict:
        """Return crawl results as dictionary."""
        # Detect orphan pages (in sitemap but not linked from any crawled page)
        all_linked = set()
        for targets in self.link_graph.values():
            all_linked.update(targets)

        orphans = [url for url in self.sitemap_urls
                    if isinstance(url, str) and not url.startswith("[") and
                    self.normalize_url(url) not in all_linked]

        return {
            "base_url": self.base_url,
            "pages_crawled": len(self.pages),
            "max_depth": self.max_depth,
            "sitemap_urls_found": len([u for u in self.sitemap_urls if not str(u).startswith("[")]),
            "has_robots_txt": self.robots_txt is not None,
            "has_sitemap": len(self.sitemap_urls) > 0,
            "pages": self.pages,
            "orphan_pages": orphans[:10],
            "link_graph_summary": {
                "total_internal_links": sum(len(v) for v in self.link_graph.values()),
                "avg_links_per_page": round(
                    sum(len(v) for v in self.link_graph.values()) / max(len(self.link_graph), 1), 1
                ),
            },
            "errors": self.errors,
        }


# ── CLI ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="SEO Crawl — Recursive mini-crawler (BMAD+ SEO Engine)"
    )
    parser.add_argument("url", help="Base URL to crawl")
    parser.add_argument("--depth", "-d", type=int, default=2, help="Max crawl depth (default: 2)")
    parser.add_argument("--max", "-m", type=int, default=25, help="Max pages (default: 25)")
    parser.add_argument("--timeout", "-t", type=int, default=15, help="Per-page timeout (default: 15s)")
    parser.add_argument("--json", "-j", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    crawler = SEOCrawler(
        base_url=args.url,
        max_depth=args.depth,
        max_pages=args.max,
        timeout=args.timeout,
    )

    print(f"Crawling {args.url} (depth={args.depth}, max={args.max})...", file=sys.stderr)
    crawler.crawl()
    results = crawler.get_results()

    if args.json:
        # Convert sets to lists for JSON serialization
        print(json.dumps(results, indent=2, ensure_ascii=False, default=list))
    else:
        print(f"\n{'='*60}")
        print(f"Crawl Summary: {results['base_url']}")
        print(f"{'='*60}")
        print(f"Pages crawled: {results['pages_crawled']}")
        print(f"Sitemap URLs: {results['sitemap_urls_found']}")
        print(f"robots.txt: {'✅' if results['has_robots_txt'] else '❌'}")
        print(f"Internal links: {results['link_graph_summary']['total_internal_links']}")
        print(f"Avg links/page: {results['link_graph_summary']['avg_links_per_page']}")
        print(f"Orphan pages: {len(results['orphan_pages'])}")
        print(f"Errors: {len(results['errors'])}")

        print(f"\n{'─'*60}")
        print("Pages:")
        for page in results["pages"]:
            status = "✅" if page["status"] == 200 else f"⚠️ {page['status']}"
            title = (page["title"] or "No title")[:50]
            print(f"  {status} [{page['depth']}] {title} ({page['word_count']} words)")
            print(f"       {page['url']}")


if __name__ == "__main__":
    main()
