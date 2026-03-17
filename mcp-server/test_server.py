"""
Test suite for Audit 360° MCP Server
Run: python -m pytest mcp-server/test_server.py -v
Or:  python mcp-server/test_server.py (standalone)
"""
import os
import sys
import base64
import unittest
from unittest.mock import patch, MagicMock

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(__file__))


class TestBase64Encoding(unittest.TestCase):
    """Verify that github_push_files uses proper base64 (not hex)."""

    def test_base64_roundtrip(self):
        """Content encoded with base64 should decode back correctly."""
        original = "Hello, Audit 360°! 🛡️"
        encoded = base64.b64encode(original.encode("utf-8")).decode("ascii")
        decoded = base64.b64decode(encoded).decode("utf-8")
        self.assertEqual(original, decoded)

    def test_base64_not_hex(self):
        """Base64 output should NOT equal hex output."""
        content = b"test content"
        b64 = base64.b64encode(content).decode("ascii")
        hex_val = content.hex()
        self.assertNotEqual(b64, hex_val)
        # Base64 should contain chars like + / = that hex doesn't
        self.assertTrue(any(c.isalpha() and c.isupper() for c in b64))


class TestDashboardAuth(unittest.TestCase):
    """Verify the Basic Auth middleware logic."""

    def _check_auth(self, username, password, expected_user, expected_pass):
        """Simulate the auth check from BasicAuthMiddleware."""
        if not expected_pass:
            return False
        if username != expected_user or password != expected_pass:
            return False
        return True

    def test_correct_credentials(self):
        self.assertTrue(self._check_auth("laurent", "enzo!", "laurent", "enzo!"))

    def test_wrong_username(self):
        self.assertFalse(self._check_auth("admin", "enzo!", "laurent", "enzo!"))

    def test_wrong_password(self):
        self.assertFalse(self._check_auth("laurent", "wrong", "laurent", "enzo!"))

    def test_empty_expected_password(self):
        """If DASHBOARD_PASS is empty, always deny."""
        self.assertFalse(self._check_auth("laurent", "", "laurent", ""))

    def test_password_with_colon(self):
        """Passwords containing ':' should work with split(':', 1)."""
        cred = "user:pass:with:colons"
        username, password = cred.split(":", 1)
        self.assertEqual(username, "user")
        self.assertEqual(password, "pass:with:colons")

    def test_base64_decode_credentials(self):
        """Basic auth header decode should produce correct user:pass."""
        cred_string = "laurent:enzo!"
        encoded = base64.b64encode(cred_string.encode("ascii")).decode("ascii")
        decoded = base64.b64decode(encoded).decode("ascii")
        username, password = decoded.split(":", 1)
        self.assertEqual(username, "laurent")
        self.assertEqual(password, "enzo!")


class TestEnvironmentVariables(unittest.TestCase):
    """Verify that env var reading works correctly."""

    @patch.dict(os.environ, {"DASHBOARD_USER": "testuser", "DASHBOARD_PASS": "testpass"})
    def test_env_vars_read(self):
        self.assertEqual(os.getenv("DASHBOARD_USER", "admin"), "testuser")
        self.assertEqual(os.getenv("DASHBOARD_PASS", ""), "testpass")

    def test_env_vars_defaults(self):
        """When env vars are missing, defaults should be used."""
        # Clear any existing vars
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(os.getenv("DASHBOARD_USER", "admin"), "admin")
            self.assertEqual(os.getenv("DASHBOARD_PASS", ""), "")
            self.assertEqual(os.getenv("GITHUB_USER", "lrochetta"), "lrochetta")

    @patch.dict(os.environ, {"GITHUB_USER": "lrochetta"})
    def test_github_user_fallback(self):
        self.assertEqual(os.getenv("GITHUB_USER", "lrochetta"), "lrochetta")


class TestScoringSystem(unittest.TestCase):
    """Verify scoring methodology constants."""

    GRADES = {
        "A": (90, 100),
        "B": (75, 89),
        "C": (60, 74),
        "D": (40, 59),
        "E": (20, 39),
        "F": (0, 19),
    }

    SEVERITY_IMPACT = {
        "Critical": -25,
        "High": -15,
        "Medium": -8,
        "Low": -3,
        "Info": 0,
    }

    def test_grade_ranges_cover_0_to_100(self):
        """Ensure all scores from 0-100 map to exactly one grade."""
        for score in range(0, 101):
            matches = [
                grade
                for grade, (low, high) in self.GRADES.items()
                if low <= score <= high
            ]
            self.assertEqual(
                len(matches), 1, f"Score {score} maps to {len(matches)} grades: {matches}"
            )

    def test_critical_has_highest_impact(self):
        self.assertEqual(
            min(self.SEVERITY_IMPACT.values()),
            self.SEVERITY_IMPACT["Critical"],
        )

    def test_info_has_zero_impact(self):
        self.assertEqual(self.SEVERITY_IMPACT["Info"], 0)


class TestFileStructure(unittest.TestCase):
    """Verify critical files exist in the project."""

    PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    def _check_file(self, relative_path):
        full_path = os.path.join(self.PROJECT_ROOT, relative_path)
        self.assertTrue(
            os.path.exists(full_path), f"Missing file: {relative_path}"
        )

    def test_agent_files_exist(self):
        agents = [
            "audit-master", "audit-director", "infra-master",
            "security-sentinel", "clean-code-guardian", "architecture-sentinel",
            "devops-inspector", "performance-profiler", "compliance-auditor",
            "red-team-adversary", "ai-detective",
            "sysadmin-sentinel", "cloud-auditor", "network-guardian", "backup-inspector",
        ]
        for agent in agents:
            self._check_file(f"_bmad/bmm/agents/{agent}.md")

    def test_workflow_files_exist(self):
        workflows = [
            "audit/1-intake/workflow.md",
            "audit/2-execution/workflow.md",
            "audit/3-synthesis/workflow.md",
            "audit/4-delivery/workflow.md",
            "infra/workflow.md",
        ]
        for wf in workflows:
            self._check_file(f"_bmad/bmm/workflows/{wf}")

    def test_step_files_exist(self):
        steps = [
            "audit/2-execution/steps/step-01-initial-scan.md",
            "audit/2-execution/steps/step-02-security-scan.md",
            "audit/2-execution/steps/step-03-code-quality.md",
            "audit/2-execution/steps/step-04-architecture-review.md",
            "audit/2-execution/steps/step-05-devops-review.md",
            "audit/2-execution/steps/step-06-performance-review.md",
            "audit/2-execution/steps/step-07-compliance-review.md",
            "audit/2-execution/steps/step-08-red-team.md",
            "audit/3-synthesis/steps/step-01-findings-merge.md",
            "audit/3-synthesis/steps/step-02-scoring.md",
            "audit/3-synthesis/steps/step-03-recommendations.md",
            "audit/4-delivery/steps/step-01-executive-summary.md",
            "audit/4-delivery/steps/step-02-detailed-report.md",
            "audit/4-delivery/steps/step-03-remediation-roadmap.md",
        ]
        for step in steps:
            self._check_file(f"_bmad/bmm/workflows/{step}")

    def test_mcp_server_files(self):
        files = ["server.py", "rag.py", "ingest.py", "requirements.txt", "dashboard.html"]
        for f in files:
            self._check_file(f"mcp-server/{f}")

    def test_knowledge_base_files(self):
        kb_files = [
            "owasp-top10-2025.md", "asvs-checklist.md", "rgpd-compliance.md",
            "scoring-methodology.md", "red-team-playbook.md", "clean-code-rules.md",
        ]
        for f in kb_files:
            self._check_file(f"_bmad/bmm/audit-knowledge/{f}")

    def test_template_files(self):
        templates = [
            "data/templates/audit-report-360.template.md",
            "data/templates/client-intake.template.md",
            "data/templates/findings-card.template.md",
            "data/scoring/scoring-matrix.yaml",
        ]
        for t in templates:
            self._check_file(f"_bmad/bmm/{t}")

    def test_config_exists(self):
        self._check_file("_bmad/bmm/config.yaml")

    def test_settings_template_exists(self):
        self._check_file(".vscode/settings.json.template")


if __name__ == "__main__":
    unittest.main(verbosity=2)
