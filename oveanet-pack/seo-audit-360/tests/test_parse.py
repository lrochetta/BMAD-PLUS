"""
Tests for seo_parse.py — HTML parsing and SEO element extraction.

Author: Laurent Rochetta
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from seo_parse import parse_html

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def load_fixture(name: str) -> str:
    with open(os.path.join(FIXTURES_DIR, name), "r", encoding="utf-8") as f:
        return f.read()


class TestTitleParsing:
    def test_extracts_title(self):
        result = parse_html(load_fixture("sample_page.html"))
        assert result["title"] == "SEO Test Page — BMAD+ Fixture"

    def test_title_length(self):
        result = parse_html(load_fixture("sample_page.html"))
        assert result["title_length"] == len("SEO Test Page — BMAD+ Fixture")

    def test_missing_title(self):
        result = parse_html("<html><body><p>No title</p></body></html>")
        assert result["title"] is None
        assert result["title_length"] == 0


class TestMetaTags:
    def test_extracts_description(self):
        result = parse_html(load_fixture("sample_page.html"))
        assert "test page" in result["meta_description"].lower()

    def test_extracts_robots(self):
        result = parse_html(load_fixture("sample_page.html"))
        assert result["meta_robots"] == "index, follow"

    def test_extracts_viewport(self):
        result = parse_html(load_fixture("sample_page.html"))
        assert "width=device-width" in result["meta_viewport"]

    def test_missing_description(self):
        result = parse_html("<html><head><title>T</title></head><body></body></html>")
        assert result["meta_description"] is None


class TestCanonical:
    def test_extracts_canonical(self):
        result = parse_html(load_fixture("sample_page.html"))
        assert result["canonical"] == "https://example.com/test"

    def test_missing_canonical(self):
        result = parse_html("<html><body></body></html>")
        assert result["canonical"] is None


class TestHeadings:
    def test_h1_count(self):
        result = parse_html(load_fixture("sample_page.html"))
        assert len(result["headings"]["h1"]) == 1

    def test_h2_count(self):
        result = parse_html(load_fixture("sample_page.html"))
        assert len(result["headings"]["h2"]) == 2

    def test_h3_count(self):
        result = parse_html(load_fixture("sample_page.html"))
        assert len(result["headings"]["h3"]) == 1

    def test_multiple_h1_detection(self):
        html = "<html><body><h1>First</h1><h1>Second</h1></body></html>"
        result = parse_html(html)
        assert len(result["headings"]["h1"]) == 2


class TestImages:
    def test_image_count(self):
        result = parse_html(load_fixture("sample_page.html"))
        assert len(result["images"]) == 3

    def test_image_with_alt(self):
        result = parse_html(load_fixture("sample_page.html"))
        hero = [i for i in result["images"] if "hero" in i["src"]]
        assert len(hero) == 1
        assert hero[0]["has_alt"] is True
        assert hero[0]["alt"] == "Hero image for testing"

    def test_image_without_alt(self):
        result = parse_html(load_fixture("sample_page.html"))
        no_alt = [i for i in result["images"] if "no-alt" in i["src"]]
        assert len(no_alt) == 1
        assert no_alt[0]["has_alt"] is False

    def test_image_with_empty_alt(self):
        result = parse_html(load_fixture("sample_page.html"))
        empty = [i for i in result["images"] if "empty-alt" in i["src"]]
        assert len(empty) == 1
        assert empty[0]["has_alt"] is True
        assert empty[0]["alt_empty"] is True


class TestLinks:
    def test_internal_links(self):
        result = parse_html(load_fixture("sample_page.html"), base_url="https://example.com")
        assert len(result["links"]["internal"]) >= 2

    def test_external_links(self):
        result = parse_html(load_fixture("sample_page.html"), base_url="https://example.com")
        assert len(result["links"]["external"]) >= 1

    def test_nofollow_detection(self):
        result = parse_html(load_fixture("sample_page.html"), base_url="https://example.com")
        nofollow = [l for l in result["links"]["external"] if l["is_nofollow"]]
        assert len(nofollow) >= 1


class TestSchema:
    def test_schema_block_count(self):
        result = parse_html(load_fixture("sample_page.html"))
        assert len(result["schema_blocks"]) == 2

    def test_schema_types(self):
        result = parse_html(load_fixture("sample_page.html"))
        types = [s["type"] for s in result["schema_blocks"]]
        assert "Organization" in types
        assert "BreadcrumbList" in types

    def test_schema_parse_error(self):
        html = '<html><body><script type="application/ld+json">{invalid json}</script></body></html>'
        result = parse_html(html)
        assert len(result["schema_blocks"]) == 1
        assert result["schema_blocks"][0]["type"] == "PARSE_ERROR"


class TestOpenGraph:
    def test_og_title(self):
        result = parse_html(load_fixture("sample_page.html"))
        assert result["open_graph"].get("og:title") == "SEO Test Page"

    def test_og_type(self):
        result = parse_html(load_fixture("sample_page.html"))
        assert result["open_graph"].get("og:type") == "website"


class TestHreflang:
    def test_hreflang_count(self):
        result = parse_html(load_fixture("sample_page.html"))
        assert len(result["hreflang"]) == 3  # en, fr, x-default

    def test_hreflang_languages(self):
        result = parse_html(load_fixture("sample_page.html"))
        langs = [h["lang"] for h in result["hreflang"]]
        assert "en" in langs
        assert "fr" in langs
        assert "x-default" in langs


class TestContentMetrics:
    def test_word_count_positive(self):
        result = parse_html(load_fixture("sample_page.html"))
        assert result["word_count"] > 30

    def test_text_ratio_range(self):
        result = parse_html(load_fixture("sample_page.html"))
        assert 0 < result["text_ratio"] < 1

    def test_has_lang_attr(self):
        result = parse_html(load_fixture("sample_page.html"))
        assert result["has_lang_attr"] is True
        assert result["lang"] == "en"

    def test_html_size(self):
        html = load_fixture("sample_page.html")
        result = parse_html(html)
        assert result["html_size_bytes"] == len(html.encode("utf-8"))
