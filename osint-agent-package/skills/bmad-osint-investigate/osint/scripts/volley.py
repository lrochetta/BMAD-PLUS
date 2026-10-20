#!/usr/bin/env python3
"""OSINT First Volley + Merge — parallel search across all engines, then deduplicate.

Replaces: first-volley.sh + merge-volley.sh
Uses concurrent.futures for parallel execution (stdlib).

Usage:
  python volley.py search "Full Name" ["context keywords"]
  python volley.py merge /tmp/osint-<timestamp>
"""

import concurrent.futures
import json
import os
import re
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _http import get_workspace


def run_script(scripts_dir, script_name, cmd, query, output_file):
    """Run a Python OSINT script and save output to file."""
    script_path = os.path.join(scripts_dir, script_name)
    if not os.path.isfile(script_path):
        return
    try:
        result = subprocess.run(
            [sys.executable, script_path, cmd, query],
            capture_output=True, text=True, timeout=60,
            env=os.environ.copy()
        )
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(result.stdout or "")
        if result.stderr:
            print(f"  ⚠️  {script_name}: {result.stderr[:200]}", file=sys.stderr)
    except subprocess.TimeoutExpired:
        print(f"  ⏱️  {script_name}: timeout", file=sys.stderr)
    except Exception as e:
        print(f"  ❌ {script_name}: {e}", file=sys.stderr)


def first_volley(name, context=""):
    """Launch parallel searches across all available engines."""
    workspace, skill_dir, scripts_dir = get_workspace()
    query = f"{name} {context}".strip()
    timestamp = int(time.time())
    outdir = os.path.join(os.environ.get("TEMP", "/tmp"), f"osint-{timestamp}")
    os.makedirs(outdir, exist_ok=True)

    print(f"🔍 First Volley: {query}")
    print(f"   Output: {outdir}")
    print()

    # Build list of searches to run
    searches = []

    # Jina — general + social
    if os.environ.get("JINA_API_KEY") or os.path.isfile(
            os.path.join(workspace, "scripts", "jina-api-key.txt")):
        searches.append(("jina.py", "search", query,
                          os.path.join(outdir, "jina-general.json")))
        searches.append(("jina.py", "search",
                          f"{name} instagram linkedin facebook telegram",
                          os.path.join(outdir, "jina-social.json")))

    # Parallel — general + social
    if os.environ.get("PARALLEL_API_KEY") or os.path.isfile(
            os.path.join(workspace, "scripts", "parallel-api-key.txt")):
        searches.append(("parallel.py", "search", query,
                          os.path.join(outdir, "parallel-general.json")))
        searches.append(("parallel.py", "search",
                          f"{name} instagram linkedin telegram facebook profile",
                          os.path.join(outdir, "parallel-social.json")))

    # Tavily
    if os.environ.get("TAVILY_API_KEY"):
        searches.append(("tavily.py", "search", query,
                          os.path.join(outdir, "tavily-general.json")))

    # Exa
    if os.environ.get("EXA_API_KEY"):
        searches.append(("exa.py", "people", name,
                          os.path.join(outdir, "exa-people.json")))

    # Perplexity
    if os.environ.get("PERPLEXITY_API_KEY"):
        searches.append(("perplexity.py", "sonar", query,
                          os.path.join(outdir, "perplexity-sonar.json")))

    if not searches:
        print("❌ No API keys found. Set at least one search API key.")
        print("   Run: python diagnose.py")
        sys.exit(1)

    print(f"Launching {len(searches)} parallel searches...")

    # Execute in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = []
        for script, cmd, q, outfile in searches:
            print(f"  → {script} {cmd}")
            futures.append(executor.submit(run_script, scripts_dir, script, cmd, q, outfile))
        concurrent.futures.wait(futures, timeout=90)

    print()
    print(f"✅ All searches complete. Results in {outdir}")

    # List result files
    for f in os.listdir(outdir):
        fpath = os.path.join(outdir, f)
        size = os.path.getsize(fpath)
        print(f"  {f} ({size:,} bytes)")
    print()
    print(f"Run: python volley.py merge {outdir}")
    return outdir


def merge_volley(outdir):
    """Merge and deduplicate first-volley results."""
    if not os.path.isdir(outdir):
        print(f"Error: {outdir} not found")
        sys.exit(1)

    print(f"=== MERGE: {outdir} ===")
    print()

    # Extract all URLs from result files
    all_urls = set()
    for fname in os.listdir(outdir):
        fpath = os.path.join(outdir, fname)
        if not os.path.isfile(fpath):
            continue
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()
            urls = re.findall(r'https?://[^\s"\'<>]+', content)
            all_urls.update(urls)
        except Exception:
            continue

    if not all_urls:
        print("⚠️  No URLs found in results.")
        sys.exit(0)

    print(f"📊 Total unique URLs: {len(all_urls)}")
    print()

    # Group by platform
    platforms = {
        "🔗 LinkedIn": lambda u: "linkedin.com" in u.lower(),
        "📸 Instagram": lambda u: "instagram.com" in u.lower(),
        "📘 Facebook": lambda u: "facebook.com" in u.lower(),
        "✈️ Telegram": lambda u: "t.me" in u.lower(),
        "🐦 Twitter/X": lambda u: "twitter.com" in u.lower() or "x.com" in u.lower(),
        "📺 VK": lambda u: "vk.com" in u.lower(),
    }

    categorized = set()
    for label, matcher in platforms.items():
        matches = [u for u in all_urls if matcher(u)]
        print(f"{label}:")
        if matches:
            for u in list(matches)[:10]:
                print(f"  {u}")
            categorized.update(matches)
        else:
            print("  (none)")
        print()

    # Other
    other = [u for u in all_urls if u not in categorized]
    print("📰 Media/Other:")
    for u in other[:20]:
        print(f"  {u}")
    print()

    # Save merged
    merged_file = os.path.join(outdir, "merged-urls.txt")
    with open(merged_file, "w", encoding="utf-8") as f:
        f.write("\n".join(sorted(all_urls)))
    print(f"✅ Saved to {merged_file}")
    print("=== END MERGE ===")


def main():
    if len(sys.argv) < 3:
        print("Usage:")
        print('  python volley.py search "Full Name" ["context"]')
        print("  python volley.py merge /tmp/osint-<timestamp>")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "search":
        name = sys.argv[2]
        context = sys.argv[3] if len(sys.argv) > 3 else ""
        first_volley(name, context)
    elif cmd == "merge":
        merge_volley(sys.argv[2])
    else:
        print(f"Unknown: {cmd} (use search|merge)", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
