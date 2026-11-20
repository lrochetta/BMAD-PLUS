#!/usr/bin/env python3
"""Parallel AI — search, extract, task. Stdlib only."""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _http import api_post, https_request, get_key, get_workspace

BASE = "https://api.parallel.ai/v1beta"
BETA_HEADER = "parallel-beta"
BETA_VALUE = "search-extract-2025-10-10"


def init():
    workspace, _, _ = get_workspace()
    return get_key("PARALLEL_API_KEY",
                   file_fallback=os.path.join(workspace, "scripts", "parallel-api-key.txt"),
                   help_url="https://platform.parallel.ai")


def search(token, query):
    """AI-powered web search with LLM-optimized excerpts."""
    data = api_post(f"{BASE}/search", {
        "objective": query,
        "search_queries": [query],
        "max_results": 10,
        "excerpts": {"max_chars_per_result": 5000},
    }, headers={
        "x-api-key": token,
        BETA_HEADER: BETA_VALUE,
    })
    if data:
        print(json.dumps(data, indent=2, ensure_ascii=False)[:5000])


def extract(token, url):
    """URL → clean markdown (JS-heavy, PDF)."""
    data = api_post(f"{BASE}/extract", {
        "url": url,
        "full_content": True,
    }, headers={
        "x-api-key": token,
        BETA_HEADER: BETA_VALUE,
    })
    if data:
        print(json.dumps(data, indent=2, ensure_ascii=False)[:5000])


def task(token, task_text):
    """Complex research task with structured output."""
    data = api_post(f"{BASE}/task", {
        "task": task_text,
    }, headers={
        "x-api-key": token,
    })
    if data:
        print(json.dumps(data, indent=2, ensure_ascii=False)[:5000])


def main():
    if len(sys.argv) < 3:
        print("Usage: parallel.py search|extract|task <arg>")
        print()
        print("  search <query>   - AI-powered web search")
        print("  extract <url>    - URL → clean markdown")
        print("  task <task>       - Complex research task")
        sys.exit(1)
    token = init()
    cmd = sys.argv[1]
    arg = " ".join(sys.argv[2:])
    if cmd == "search":
        search(token, arg)
    elif cmd == "extract":
        extract(token, arg)
    elif cmd == "task":
        task(token, arg)
    else:
        print(f"Unknown: {cmd} (use search|extract|task)", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
