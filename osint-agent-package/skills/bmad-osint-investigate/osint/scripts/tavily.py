#!/usr/bin/env python3
"""Tavily API — AI-optimized search for agents. Stdlib only."""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _http import api_post, get_key, truncate


def init():
    return get_key("TAVILY_API_KEY", help_url="https://app.tavily.com/home")


def search(api_key, query, depth="basic"):
    """Tavily search — basic ($0.005) or advanced (deep)."""
    data = api_post("https://api.tavily.com/search", {
        "api_key": api_key,
        "query": query,
        "search_depth": depth,
        "max_results": 10,
        "include_answer": True,
        "include_raw_content": False,
    })
    if not data:
        return
    if data.get("answer"):
        print(f'💡 {data["answer"]}\n')
    for r in data.get("results", [])[:10]:
        print(f'🔗 {r.get("title", "")}')
        print(f'   {r.get("url", "")}')
        print(f'   {truncate(r.get("content", ""), 300 if depth == "advanced" else 200)}')
        score = r.get("score", "")
        if score:
            print(f"   relevance: {score:.2f}")
        print()


def extract(api_key, url):
    """Extract content from a URL."""
    data = api_post("https://api.tavily.com/extract", {
        "api_key": api_key,
        "urls": [url],
    })
    if not data:
        return
    for r in data.get("results", []):
        print(f'📄 {r.get("url", "")}')
        print(r.get("raw_content", r.get("content", ""))[:3000])


def main():
    if len(sys.argv) < 3:
        print("Usage: tavily.py search|extract|deep <query>")
        sys.exit(1)
    api_key = init()
    cmd = sys.argv[1]
    query = " ".join(sys.argv[2:])
    if cmd == "search":
        search(api_key, query, "basic")
    elif cmd == "deep":
        search(api_key, query, "advanced")
    elif cmd == "extract":
        extract(api_key, query)
    else:
        print(f"Unknown: {cmd} (use search|extract|deep)", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
