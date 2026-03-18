"""
Tests for seo_fetch.py — SSRF protection, URL handling, error cases.

Author: Laurent Rochetta
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from seo_fetch import is_safe_url, fetch_page


class TestSSRFProtection:
    """Test SSRF prevention blocks private/loopback/reserved IPs."""

    def test_blocks_localhost(self):
        assert is_safe_url("http://127.0.0.1/admin") is False

    def test_blocks_private_10(self):
        assert is_safe_url("http://10.0.0.1/secret") is False

    def test_blocks_private_192(self):
        assert is_safe_url("http://192.168.1.1/") is False

    def test_blocks_private_172(self):
        assert is_safe_url("http://172.16.0.1/") is False

    def test_allows_public_ip(self):
        assert is_safe_url("https://93.184.216.34/") is True

    def test_allows_public_domain(self):
        assert is_safe_url("https://example.com/") is True

    def test_blocks_empty_hostname(self):
        assert is_safe_url("http:///nohost") is False

    def test_blocks_zero_ip(self):
        assert is_safe_url("http://0.0.0.0/") is False


class TestFetchPage:
    """Test fetch_page function behavior."""

    def test_normalizes_url_without_scheme(self):
        result = fetch_page("example.com", timeout=5)
        assert result["url"] == "example.com"
        # Should have attempted https://example.com

    def test_blocks_invalid_scheme(self):
        result = fetch_page("ftp://example.com/file")
        assert result["error"] is not None
        assert "Invalid URL scheme" in result["error"]

    def test_blocks_ssrf(self):
        result = fetch_page("http://127.0.0.1/admin")
        assert result["error"] is not None
        assert "Blocked" in result["error"]

    def test_result_structure(self):
        """Verify the result dict has all expected keys."""
        result = fetch_page("https://example.com", timeout=5)
        expected_keys = {"url", "final_url", "status_code", "content", "headers",
                         "redirect_chain", "content_length", "response_time_ms", "error"}
        assert expected_keys == set(result.keys())

    def test_timeout_returns_error(self):
        # Use a non-routable IP to force timeout
        result = fetch_page("http://192.0.2.1/", timeout=1)
        assert result["error"] is not None
