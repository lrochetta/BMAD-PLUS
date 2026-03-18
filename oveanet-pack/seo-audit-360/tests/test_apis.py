"""
Tests for seo_apis.py — API response parsing and error handling.

Author: Laurent Rochetta
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

# Temporarily unset API key for error tests
original_key = os.environ.get("GOOGLE_API_KEY", "")


class TestAPIKeyMissing:
    """Test behavior when GOOGLE_API_KEY is not set."""

    def setup_method(self):
        os.environ.pop("GOOGLE_API_KEY", None)
        # Reimport to pick up empty key
        import importlib
        import seo_apis
        importlib.reload(seo_apis)
        self.seo_apis = seo_apis

    def teardown_method(self):
        if original_key:
            os.environ["GOOGLE_API_KEY"] = original_key

    def test_pagespeed_without_key(self):
        # Force the module to use an empty key
        self.seo_apis.API_KEY = ""
        result = self.seo_apis.run_pagespeed("https://example.com")
        assert result.get("error") is not None
        assert "GOOGLE_API_KEY" in result["error"]

    def test_crux_without_key(self):
        self.seo_apis.API_KEY = ""
        result = self.seo_apis.run_crux("https://example.com")
        assert result.get("error") is not None

    def test_rich_results_without_key(self):
        self.seo_apis.API_KEY = ""
        result = self.seo_apis.run_rich_results_test("https://example.com")
        assert result.get("error") is not None


class TestResultStructure:
    """Test that API functions return expected structures."""

    def setup_method(self):
        import importlib
        import seo_apis
        importlib.reload(seo_apis)
        self.seo_apis = seo_apis

    def test_pagespeed_result_keys(self):
        self.seo_apis.API_KEY = ""
        result = self.seo_apis.run_pagespeed("https://example.com")
        # Even on error, should have expected structure
        assert "error" in result

    def test_crux_result_keys(self):
        self.seo_apis.API_KEY = ""
        result = self.seo_apis.run_crux("https://example.com")
        assert "error" in result

    def test_run_all_structure(self):
        self.seo_apis.API_KEY = ""
        result = self.seo_apis.run_all("https://example.com")
        assert "pagespeed" in result
        assert "crux" in result
        assert "mobile_friendly" in result
        assert "url" in result
        assert "timestamp" in result
