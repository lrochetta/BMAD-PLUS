#!/usr/bin/env python3
"""Perplexity API — search + sonar + deep research. Stdlib only."""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _http import api_post, get_key, truncate

API_KEY = None


def init():
    global API_KEY
    API_KEY = get_key("PERPLEXITY_API_KEY", help_url="https://perplexity.ai/settings/api")


def search(query):
    """Search API — ranked web results."""
    data = api_post("https://api.perplexity.ai/search",
                     {"query": [query]},
                     headers={"Authorization": f"Bearer {API_KEY}"})
    if not data:
        return
    if "results" in data:
        for r in data["results"][:10]:
            print(f'🔗 {r.get("title", "")}')
            print(f'   {r.get("url", "")}')
            print(f'   {truncate(r.get("snippet", ""), 200)}')
            print()
    elif "error" in data:
        print(f'ERROR: {json.dumps(data["error"])}', file=sys.stderr)
    else:
        print(json.dumps(data, indent=2)[:2000])


def sonar(query):
    """Sonar API — AI answer with citations."""
    data = api_post("https://api.perplexity.ai/chat/completions",
                     {"model": "sonar",
                      "messages": [{"role": "user", "content": query}]},
                     headers={"Authorization": f"Bearer {API_KEY}"})
    if not data:
        return
    if "choices" in data:
        msg = data["choices"][0]["message"]
        print(msg.get("content", ""))
        cits = data.get("citations", msg.get("citations", []))
        if cits:
            print("\n--- Sources ---")
            for i, c in enumerate(cits[:10], 1):
                print(f"{i}. {c if isinstance(c, str) else c.get('url', c)}")
    elif "error" in data:
        print(f'ERROR: {json.dumps(data["error"])}', file=sys.stderr)
    else:
        print(json.dumps(data, indent=2)[:2000])


def deep(query):
    """Deep Research via sonar-deep-research."""
    data = api_post("https://api.perplexity.ai/chat/completions",
                     {"model": "sonar-deep-research",
                      "messages": [{"role": "user", "content": query}]},
                     headers={"Authorization": f"Bearer {API_KEY}"},
                     timeout=300)
    if not data:
        return
    if "choices" in data:
        msg = data["choices"][0]["message"]
        print(msg.get("content", ""))
        cits = data.get("citations", msg.get("citations", []))
        if cits:
            print("\n--- Sources ---")
            for i, c in enumerate(cits[:15], 1):
                print(f"{i}. {c if isinstance(c, str) else c.get('url', c)}")
    elif "error" in data:
        print(f'ERROR: {json.dumps(data["error"])}', file=sys.stderr)
    else:
        print(json.dumps(data, indent=2)[:2000])


def main():
    if len(sys.argv) < 3:
        print("Usage: perplexity.py search|sonar|deep <query>")
        sys.exit(1)
    init()
    cmd = sys.argv[1]
    query = " ".join(sys.argv[2:])
    if cmd == "search":
        search(query)
    elif cmd == "sonar":
        sonar(query)
    elif cmd == "deep":
        deep(query)
    else:
        print(f"Unknown command: {cmd} (use search|sonar|deep)", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
