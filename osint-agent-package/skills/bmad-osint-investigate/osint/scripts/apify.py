#!/usr/bin/env python3
"""Apify API — universal actor runner + LinkedIn/Instagram shortcuts.

Replaces: apify.sh, run-actor.sh, run_actor.js
Stdlib only, zero dependencies.

Usage:
  python apify.py run <actor_id> '<json_input>' [--output file] [--format csv|json]
  python apify.py linkedin <profile_url>
  python apify.py instagram <username>
  python apify.py results <run_id>
  python apify.py status <run_id>
  python apify.py store-search <query>
"""

import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _http import api_post, api_get, get_key, get_workspace

BASE = "https://api.apify.com/v2"
USER_AGENT = "osint-skill/3.2-python"


def init():
    workspace, _, _ = get_workspace()
    token = os.environ.get("APIFY_TOKEN") or os.environ.get("APIFY_API_TOKEN")
    if not token:
        fallback = os.path.join(workspace, "scripts", "apify-api-token.txt")
        if os.path.isfile(fallback):
            with open(fallback) as f:
                token = f.readline().strip()
    if not token:
        print("ERROR: No Apify token found.", file=sys.stderr)
        print("Set APIFY_API_TOKEN env var, or put token in scripts/apify-api-token.txt", file=sys.stderr)
        print("Get one at: https://console.apify.com/account/integrations", file=sys.stderr)
        sys.exit(1)
    return token


def start_actor(token, actor_id, input_json):
    """Start an Apify actor and return (run_id, dataset_id)."""
    api_actor = actor_id.replace("/", "~")
    url = f"{BASE}/acts/{api_actor}/runs?token={token}"
    try:
        input_data = json.loads(input_json) if isinstance(input_json, str) else input_json
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)
    data = api_post(url, input_data)
    if not data:
        sys.exit(1)
    run_data = data.get("data", data)
    return run_data.get("id"), run_data.get("defaultDatasetId")


def poll_until_complete(token, run_id, timeout=600, interval=5):
    """Poll actor run until complete. Returns final status."""
    url = f"{BASE}/actor-runs/{run_id}?token={token}"
    start_time = time.time()
    last_status = None

    while True:
        data = api_get(url)
        if not data:
            print("ERROR: Failed to get run status", file=sys.stderr)
            sys.exit(1)
        status = data.get("data", data).get("status", "UNKNOWN")
        if status != last_status:
            print(f"Status: {status}")
            last_status = status
        if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
            return status
        elapsed = time.time() - start_time
        if elapsed > timeout:
            print(f"WARNING: Timeout after {timeout}s, actor still running")
            return "TIMED-OUT"
        time.sleep(interval)


def download_results(token, dataset_id, output_path=None, fmt="json"):
    """Download actor results. If no output_path, display top 5."""
    url = f"{BASE}/datasets/{dataset_id}/items?token={token}&format=json"
    data = api_get(url)
    if not data:
        return
    items = data if isinstance(data, list) else [data]

    if output_path:
        if fmt == "json":
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(items, f, indent=2, ensure_ascii=False)
        else:
            # CSV
            if items:
                fields = list(items[0].keys())
                lines = [",".join(fields)]
                for row in items:
                    vals = []
                    for k in fields:
                        v = row.get(k, "")
                        if isinstance(v, str) and len(v) > 200:
                            v = v[:200] + "..."
                        elif isinstance(v, (list, dict)):
                            v = json.dumps(v, ensure_ascii=False)
                        if v is None:
                            v = ""
                        v = str(v)
                        if "," in v or '"' in v or "\n" in v:
                            v = f'"{v.replace(chr(34), chr(34)+chr(34))}"'
                        vals.append(v)
                    lines.append(",".join(vals))
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write("\n".join(lines))
        print(f"Saved to: {output_path}")
        print(f"Records: {len(items)}")
    else:
        # Display top 5
        total = len(items)
        if total == 0:
            print("\nNo results found.")
            return
        print(f"\n{'='*60}")
        print(f"TOP 5 RESULTS (of {total} total)")
        print("=" * 60)
        for i, item in enumerate(items[:5]):
            print(f"\n--- Result {i+1} ---")
            for key, value in item.items():
                display = value
                if isinstance(value, str) and len(value) > 100:
                    display = value[:100] + "..."
                elif isinstance(value, (list, dict)):
                    s = json.dumps(value, ensure_ascii=False)
                    display = s[:100] + "..." if len(s) > 100 else s
                print(f"  {key}: {display}")
        print(f"\n{'='*60}")
        if total > 5:
            print(f"Showing 5 of {total} results.")
        print(f"Full data: https://console.apify.com/storage/datasets/{dataset_id}")


def run_actor(token, actor_id, input_json, output=None, fmt="json", timeout=600):
    """Full pipeline: start → poll → download."""
    print(f"Starting actor: {actor_id}")
    run_id, dataset_id = start_actor(token, actor_id, input_json)
    print(f"Run ID: {run_id}")
    print(f"Dataset ID: {dataset_id}")
    status = poll_until_complete(token, run_id, timeout=timeout)
    if status != "SUCCEEDED":
        print(f"ERROR: Actor run {status}", file=sys.stderr)
        print(f"Details: https://console.apify.com/actors/runs/{run_id}", file=sys.stderr)
        sys.exit(1)
    download_results(token, dataset_id, output, fmt)


def get_results(token, run_id):
    """Get results from a completed run."""
    data = api_get(f"{BASE}/actor-runs/{run_id}/dataset/items?token={token}")
    if data:
        print(json.dumps(data, indent=2, ensure_ascii=False)[:5000])


def get_status(token, run_id):
    """Check run status."""
    data = api_get(f"{BASE}/actor-runs/{run_id}?token={token}")
    if data:
        print(json.dumps(data, indent=2, ensure_ascii=False)[:2000])


def store_search(token, query):
    """Search the Apify actor store."""
    from urllib.parse import quote
    data = api_get(f"{BASE}/store?token={token}&limit=10&search={quote(query)}")
    if data:
        items = data.get("data", {}).get("items", data if isinstance(data, list) else [])
        for item in items[:10]:
            print(f'📦 {item.get("title", item.get("name", ""))}')
            print(f'   ID: {item.get("id", item.get("actorId", ""))}')
            desc = item.get("description", "")[:150]
            if desc:
                print(f"   {desc}")
            print()


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    token = init()
    cmd = sys.argv[1]

    if cmd == "run":
        if len(sys.argv) < 4:
            print("Usage: apify.py run <actor_id> '<json_input>' [--output file] [--format csv|json]")
            sys.exit(1)
        actor_id = sys.argv[2]
        input_json = sys.argv[3]
        # Parse optional args
        output = None
        fmt = "json"
        i = 4
        while i < len(sys.argv):
            if sys.argv[i] == "--output" and i + 1 < len(sys.argv):
                output = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--format" and i + 1 < len(sys.argv):
                fmt = sys.argv[i + 1]
                i += 2
            else:
                i += 1
        run_actor(token, actor_id, input_json, output, fmt)

    elif cmd == "linkedin":
        url = sys.argv[2] if len(sys.argv) > 2 else ""
        if not url:
            print("Usage: apify.py linkedin <profile_url>", file=sys.stderr)
            sys.exit(1)
        run_actor(token, "supreme_coder/linkedin-profile-scraper",
                  json.dumps({"urls": [{"url": url}]}))

    elif cmd == "instagram":
        username = sys.argv[2] if len(sys.argv) > 2 else ""
        if not username:
            print("Usage: apify.py instagram <username>", file=sys.stderr)
            sys.exit(1)
        run_actor(token, "apify/instagram-profile-scraper",
                  json.dumps({"usernames": [username]}))

    elif cmd == "results":
        run_id = sys.argv[2] if len(sys.argv) > 2 else ""
        if not run_id:
            print("Usage: apify.py results <run_id>", file=sys.stderr)
            sys.exit(1)
        get_results(token, run_id)

    elif cmd == "status":
        run_id = sys.argv[2] if len(sys.argv) > 2 else ""
        if not run_id:
            print("Usage: apify.py status <run_id>", file=sys.stderr)
            sys.exit(1)
        get_status(token, run_id)

    elif cmd == "store-search":
        query = " ".join(sys.argv[2:])
        if not query:
            print("Usage: apify.py store-search <query>", file=sys.stderr)
            sys.exit(1)
        store_search(token, query)

    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
