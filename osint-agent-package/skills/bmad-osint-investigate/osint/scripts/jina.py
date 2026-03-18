#!/usr/bin/env python3
"""Jina AI — read URLs, search, deep search. Stdlib only."""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _http import https_request, get_key, get_workspace


def init():
    workspace, _, _ = get_workspace()
    return get_key("JINA_API_KEY",
                   file_fallback=os.path.join(workspace, "scripts", "jina-api-key.txt"),
                   help_url="https://jina.ai/api-key")


def read_url(token, url):
    """URL → clean markdown."""
    status, _, data = https_request("GET", f"https://r.jina.ai/{url}",
                                     headers={"Authorization": f"Bearer {token}",
                                              "Accept": "application/json"})
    print(data[:5000])


def search(token, query):
    """Web search → markdown results."""
    from urllib.parse import quote
    status, _, data = https_request("GET", f"https://s.jina.ai/{quote(query)}",
                                     headers={"Authorization": f"Bearer {token}",
                                              "Accept": "application/json"})
    print(data[:5000])


def deepsearch(token, query):
    """Deep research with AI reasoning."""
    import json as j
    status, _, data = https_request("POST", "https://deepsearch.jina.ai",
                                     headers={"Authorization": f"Bearer {token}",
                                              "Content-Type": "application/json",
                                              "Accept": "application/json"},
                                     body=j.dumps({"query": query}),
                                     timeout=300)
    print(data[:5000])


def main():
    if len(sys.argv) < 3:
        print("Usage: jina.py read|search|deepsearch <arg>")
        print()
        print("  read <url>       - any URL → clean markdown")
        print("  search <query>   - web search → markdown (10 results)")
        print("  deepsearch <q>   - deep research with AI reasoning")
        sys.exit(1)
    token = init()
    cmd = sys.argv[1]
    arg = " ".join(sys.argv[2:])
    if cmd == "read":
        read_url(token, arg)
    elif cmd == "search":
        search(token, arg)
    elif cmd == "deepsearch":
        deepsearch(token, arg)
    else:
        print(f"Unknown: {cmd} (use read|search|deepsearch)", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
