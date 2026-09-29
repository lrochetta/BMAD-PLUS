#!/usr/bin/env python3
"""Bright Data MCP wrapper — scrape, search, search-geo, search-yandex. Stdlib only.

Uses mcp-client.py for MCP JSON-RPC calls.
"""

import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _http import get_key, get_workspace


def init():
    workspace, _, _ = get_workspace()
    return get_key("BRIGHTDATA_MCP_URL",
                   file_fallback=os.path.join(workspace, "scripts", "brightdata-mcp-url.txt"),
                   help_url="https://brightdata.com/products/web-scraper/mcp")


def mcp_call(mcp_url, tool_name, arguments):
    """Call MCP tool via mcp-client.py."""
    scripts_dir = os.path.dirname(os.path.abspath(__file__))
    mcp_client = os.path.join(scripts_dir, "mcp-client.py")
    args_json = json.dumps(arguments)
    result = subprocess.run(
        [sys.executable, mcp_client, mcp_url, tool_name, args_json],
        capture_output=True, text=True, timeout=120
    )
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    return result.returncode


def list_tools(mcp_url):
    """List available MCP tools."""
    scripts_dir = os.path.dirname(os.path.abspath(__file__))
    mcp_client = os.path.join(scripts_dir, "mcp-client.py")
    result = subprocess.run(
        [sys.executable, mcp_client, mcp_url, "--list-tools"],
        capture_output=True, text=True, timeout=30
    )
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)


def main():
    if len(sys.argv) < 2:
        print("Usage: brightdata.py {tools|scrape|scrape-batch|search|search-geo|search-yandex} <args>")
        print()
        print("  tools                     - list available MCP tools")
        print("  scrape <url>              - any URL → markdown (bypasses CAPTCHA)")
        print("  scrape-batch <url1> <url2> - batch scrape up to 10 URLs")
        print("  search <query>            - Google search via Bright Data")
        print("  search-geo <cc> <query>   - geo-targeted search")
        print("  search-yandex <query>     - Yandex search")
        sys.exit(1)

    mcp_url = init()
    cmd = sys.argv[1]

    if cmd == "tools":
        list_tools(mcp_url)
    elif cmd == "scrape":
        url = sys.argv[2] if len(sys.argv) > 2 else ""
        if not url:
            print("Usage: brightdata.py scrape <url>", file=sys.stderr)
            sys.exit(1)
        mcp_call(mcp_url, "scrape_as_markdown", {"url": url})
    elif cmd == "scrape-batch":
        urls = sys.argv[2:]
        if not urls:
            print("Usage: brightdata.py scrape-batch <url1> <url2>...", file=sys.stderr)
            sys.exit(1)
        mcp_call(mcp_url, "scrape_as_markdown_batch", {"urls": urls})
    elif cmd == "search":
        query = " ".join(sys.argv[2:])
        mcp_call(mcp_url, "web_data_search_engine", {"query": query})
    elif cmd == "search-geo":
        if len(sys.argv) < 4:
            print("Usage: brightdata.py search-geo <country_code> <query>", file=sys.stderr)
            sys.exit(1)
        geo = sys.argv[2]
        query = " ".join(sys.argv[3:])
        mcp_call(mcp_url, "web_data_search_engine", {"query": query, "country": geo})
    elif cmd == "search-yandex":
        query = " ".join(sys.argv[2:])
        mcp_call(mcp_url, "web_data_search_engine", {"query": query, "engine": "yandex"})
    else:
        print(f"Unknown: {cmd}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
