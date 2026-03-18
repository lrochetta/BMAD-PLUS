"""
Tests for seo_crawl.py — URL normalization, link extraction, depth limiting.

Author: Laurent Rochetta
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from seo_crawl import SEOCrawler


class TestURLNormalization:
    """Test URL normalization for deduplication."""

    def setup_method(self):
        self.crawler = SEOCrawler("https://example.com", max_depth=2, max_pages=25)

    def test_strips_trailing_slash(self):
        assert self.crawler.normalize_url("https://example.com/page/") == "https://example.com/page"

    def test_preserves_root(self):
        assert self.crawler.normalize_url("https://example.com/") == "https://example.com/"

    def test_normalizes_scheme(self):
        result = self.crawler.normalize_url("https://example.com/page")
        assert result.startswith("https://")

    def test_deduplicates(self):
        url1 = self.crawler.normalize_url("https://example.com/page/")
        url2 = self.crawler.normalize_url("https://example.com/page")
        assert url1 == url2


class TestInternalDetection:
    def setup_method(self):
        self.crawler = SEOCrawler("https://example.com", max_depth=2, max_pages=25)

    def test_internal_url(self):
        assert self.crawler.is_internal("https://example.com/about") is True

    def test_external_url(self):
        assert self.crawler.is_internal("https://other.com/page") is False

    def test_subdomain_is_external(self):
        assert self.crawler.is_internal("https://blog.example.com/post") is False


class TestLinkExtraction:
    def setup_method(self):
        self.crawler = SEOCrawler("https://example.com", max_depth=2, max_pages=25)

    def test_extracts_internal_links(self):
        html = '''
        <a href="/about">About</a>
        <a href="https://example.com/contact">Contact</a>
        '''
        links = self.crawler.extract_links(html, "https://example.com/")
        assert len(links) == 2

    def test_ignores_external_links(self):
        html = '<a href="https://other.com/page">External</a>'
        links = self.crawler.extract_links(html, "https://example.com/")
        assert len(links) == 0

    def test_ignores_anchors(self):
        html = '<a href="#section">Anchor</a>'
        links = self.crawler.extract_links(html, "https://example.com/")
        assert len(links) == 0

    def test_ignores_javascript(self):
        html = '<a href="javascript:void(0)">JS Link</a>'
        links = self.crawler.extract_links(html, "https://example.com/")
        assert len(links) == 0

    def test_ignores_mailto(self):
        html = '<a href="mailto:test@example.com">Email</a>'
        links = self.crawler.extract_links(html, "https://example.com/")
        assert len(links) == 0


class TestTitleExtraction:
    def setup_method(self):
        self.crawler = SEOCrawler("https://example.com")

    def test_extracts_title(self):
        html = "<html><head><title>Test Page</title></head><body></body></html>"
        assert self.crawler.extract_title(html) == "Test Page"

    def test_missing_title(self):
        html = "<html><body></body></html>"
        assert self.crawler.extract_title(html) is None


class TestWordCount:
    def setup_method(self):
        self.crawler = SEOCrawler("https://example.com")

    def test_counts_visible_words(self):
        html = "<html><body><p>This is a test with seven words.</p></body></html>"
        assert self.crawler.count_words(html) == 7

    def test_excludes_script_content(self):
        html = '<html><body><p>Visible</p><script>var hidden = true;</script></body></html>'
        count = self.crawler.count_words(html)
        assert count == 1  # Only "Visible"


class TestCrawlerConfig:
    def test_max_pages_respected(self):
        crawler = SEOCrawler("https://example.com", max_pages=5)
        assert crawler.max_pages == 5

    def test_max_depth_respected(self):
        crawler = SEOCrawler("https://example.com", max_depth=1)
        assert crawler.max_depth == 1

    def test_base_domain_extracted(self):
        crawler = SEOCrawler("https://www.example.com/page")
        assert crawler.base_domain == "www.example.com"
