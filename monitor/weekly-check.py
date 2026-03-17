#!/usr/bin/env python3
"""
BMAD+ Weekly Upstream Monitor
Checks BMAD-METHOD upstream for changes and generates AI-analyzed reports.
Designed to run as a weekly cron job on VPS.

Usage:
    python weekly-check.py              # Full weekly check
    python weekly-check.py --test       # Test notification only
    python weekly-check.py --dry-run    # Analyze without notifying
"""

import os
import sys
import json
import subprocess
import argparse
from datetime import datetime, timezone
from pathlib import Path

# Local imports
from ai_analyzer import analyze_diff_with_ai
from notifier import notify_whatsapp, notify_fallback

# Configuration
CONFIG_FILE = Path(__file__).parent / "config.yaml"
STATE_FILE = Path(__file__).parent / "last-synced.json"
UPSTREAM_REPO = "https://github.com/bmad-code-org/BMAD-METHOD.git"
UPSTREAM_DIR = Path(__file__).parent / ".upstream-cache"


def load_config():
    """Load configuration from config.yaml."""
    try:
        import yaml
        with open(CONFIG_FILE, "r") as f:
            return yaml.safe_load(f)
    except FileNotFoundError:
        print("ERROR: config.yaml not found. Copy config.example.yaml and fill in your values.")
        sys.exit(1)


def load_state():
    """Load last sync state."""
    if STATE_FILE.exists():
        with open(STATE_FILE, "r") as f:
            return json.load(f)
    return {"last_commit": None, "last_check": None, "last_version": None}


def save_state(state):
    """Save sync state."""
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def ensure_upstream_clone():
    """Clone or update the upstream cache."""
    if not UPSTREAM_DIR.exists():
        print(f"Cloning upstream into {UPSTREAM_DIR}...")
        subprocess.run(
            ["git", "clone", "--bare", UPSTREAM_REPO, str(UPSTREAM_DIR)],
            check=True, capture_output=True
        )
    else:
        print("Fetching latest upstream changes...")
        subprocess.run(
            ["git", "fetch", "--all"],
            cwd=str(UPSTREAM_DIR), check=True, capture_output=True
        )


def get_latest_commit():
    """Get the latest commit hash from upstream."""
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=str(UPSTREAM_DIR), capture_output=True, text=True, check=True
    )
    return result.stdout.strip()


def get_commit_log(since_commit):
    """Get commit log since last checked commit."""
    if since_commit:
        cmd = ["git", "log", f"{since_commit}..HEAD", "--oneline", "--no-decorate"]
    else:
        cmd = ["git", "log", "-20", "--oneline", "--no-decorate"]

    result = subprocess.run(
        cmd, cwd=str(UPSTREAM_DIR), capture_output=True, text=True, check=True
    )
    return result.stdout.strip()


def get_diff_stat(since_commit):
    """Get diff statistics since last checked commit."""
    if since_commit:
        cmd = ["git", "diff", "--stat", f"{since_commit}..HEAD"]
    else:
        cmd = ["git", "diff", "--stat", "HEAD~20..HEAD"]

    result = subprocess.run(
        cmd, cwd=str(UPSTREAM_DIR), capture_output=True, text=True, check=True
    )
    return result.stdout.strip()


def get_diff_content(since_commit):
    """Get actual diff content for AI analysis (limited to key files)."""
    key_paths = [
        "src/", "tools/cli/", "package.json", "CHANGELOG.md"
    ]

    diffs = []
    for path in key_paths:
        if since_commit:
            cmd = ["git", "diff", f"{since_commit}..HEAD", "--", path]
        else:
            cmd = ["git", "diff", "HEAD~5..HEAD", "--", path]

        result = subprocess.run(
            cmd, cwd=str(UPSTREAM_DIR), capture_output=True, text=True
        )
        if result.stdout.strip():
            # Limit each diff to 2000 chars to avoid token explosion
            diffs.append(f"--- {path} ---\n{result.stdout[:2000]}")

    return "\n\n".join(diffs)


def get_version_from_package():
    """Extract version from upstream package.json."""
    result = subprocess.run(
        ["git", "show", "HEAD:package.json"],
        cwd=str(UPSTREAM_DIR), capture_output=True, text=True
    )
    if result.returncode == 0:
        pkg = json.loads(result.stdout)
        return pkg.get("version", "unknown")
    return "unknown"


def build_report(state, commits, diff_stat, ai_analysis, version):
    """Build the notification report."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    commit_count = len(commits.strip().split("\n")) if commits.strip() else 0

    report = f"📊 *BMAD+ Weekly Report* — {now}\n\n"
    report += f"🔖 Upstream version: *v{version}*\n"

    if state["last_version"] and state["last_version"] != version:
        report += f"⚡ Version changed: {state['last_version']} → {version}\n"

    report += f"📝 {commit_count} new commit(s)\n\n"

    if ai_analysis:
        report += ai_analysis + "\n\n"

    if commit_count > 0 and commit_count <= 10:
        report += "📋 *Recent commits:*\n"
        for line in commits.strip().split("\n")[:10]:
            report += f"  • {line}\n"

    return report


def run_check(dry_run=False):
    """Run the weekly check."""
    config = load_config()
    state = load_state()

    print(f"[{datetime.now()}] Starting BMAD+ weekly upstream check...")

    # Step 1: Update upstream cache
    ensure_upstream_clone()

    # Step 2: Check for new commits
    latest_commit = get_latest_commit()
    if latest_commit == state.get("last_commit"):
        print("No new changes since last check.")
        return

    # Step 3: Gather change information
    commits = get_commit_log(state.get("last_commit"))
    diff_stat = get_diff_stat(state.get("last_commit"))
    diff_content = get_diff_content(state.get("last_commit"))
    version = get_version_from_package()

    print(f"Found changes! {len(commits.split(chr(10)))} new commits. Version: {version}")

    # Step 4: AI Analysis
    ai_analysis = None
    if config.get("gemini_api_key"):
        print("Running AI analysis...")
        ai_analysis = analyze_diff_with_ai(
            commits, diff_stat, diff_content,
            config["gemini_api_key"],
            state.get("last_version", "unknown")
        )
    else:
        print("No Gemini API key configured, skipping AI analysis.")

    # Step 5: Build report
    report = build_report(state, commits, diff_stat, ai_analysis, version)
    print("\n" + report)

    # Step 6: Send notification
    if not dry_run:
        success = False
        if config.get("whatsapp", {}).get("enabled"):
            success = notify_whatsapp(report, config["whatsapp"])
            if success:
                print("WhatsApp notification sent!")

        if not success and config.get("fallback_email"):
            notify_fallback(report, config["fallback_email"])
            print("Fallback notification sent.")

        # Step 7: Update state
        state["last_commit"] = latest_commit
        state["last_check"] = datetime.now(timezone.utc).isoformat()
        state["last_version"] = version
        save_state(state)
        print("State updated.")
    else:
        print("[DRY RUN] Skipping notification and state update.")


def main():
    parser = argparse.ArgumentParser(description="BMAD+ Weekly Upstream Monitor")
    parser.add_argument("--test", action="store_true", help="Send test notification")
    parser.add_argument("--dry-run", action="store_true", help="Analyze without notifying")
    args = parser.parse_args()

    if args.test:
        config = load_config()
        test_msg = "🧪 *BMAD+ Monitor Test*\n\nThis is a test notification. If you see this, notifications are working! ✅"
        if config.get("whatsapp", {}).get("enabled"):
            notify_whatsapp(test_msg, config["whatsapp"])
            print("Test notification sent via WhatsApp.")
        else:
            print("WhatsApp not configured. Check config.yaml.")
    else:
        run_check(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
