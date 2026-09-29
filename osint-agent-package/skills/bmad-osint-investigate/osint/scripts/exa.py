#!/usr/bin/env python3
"""Exa AI — semantic search, company research, people search, crawl. Stdlib only."""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _http import api_post, get_key, truncate

BASE = "https://api.exa.ai"


def init():
    return get_key("EXA_API_KEY", help_url="https://dashboard.exa.ai")


def search(api_key, query, category=None, max_chars=500, icon="🔗"):
    """Exa semantic search."""
    payload = {
        "query": query,
        "type": "auto",
        "numResults": 10,
        "contents": {"text": {"maxCharacters": max_chars}},
    }
    if category:
        payload["category"] = category
    data = api_post(f"{BASE}/search", payload,
                     headers={"x-api-key": api_key})
    if not data:
        return
    for r in data.get("results", [])[:10]:
        print(f'{icon} {r.get("title", "")}')
        print(f'   {r.get("url", "")}')
        txt = truncate(r.get("text", ""), max_chars)
        if txt:
            print(f"   {txt}")
        print()


def crawl(api_key, url):
    """Crawl a URL and extract content."""
    data = api_post(f"{BASE}/contents",
                     {"urls": [url], "text": {"maxCharacters": 5000}},
                     headers={"x-api-key": api_key})
    if not data:
        return
    for r in data.get("results", []):
        print(f'📄 {r.get("title", "")}')
        print(f'   {r.get("url", "")}')
        print(r.get("text", "")[:3000])


def main():
    if len(sys.argv) < 3:
        print("Usage: exa.py search|company|people|crawl|deep <query>")
        sys.exit(1)
    api_key = init()
    cmd = sys.argv[1]
    query = " ".join(sys.argv[2:])
    if cmd == "search":
        search(api_key, query)
    elif cmd == "company":
        search(api_key, f"{query} company information about",
               category="company", max_chars=1000, icon="🏢")
    elif cmd == "people":
        search(api_key, query, category="personal site", icon="👤")
    elif cmd == "crawl":
        crawl(api_key, query)
    elif cmd == "deep":
        print("🔬 Exa Deep Research — use MCP or dashboard")
        print("   MCP: https://mcp.exa.ai/mcp?tools=deep_researcher_start,deep_researcher_check")
    else:
        print(f"Unknown: {cmd} (use search|company|people|crawl|deep)", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
