#!/usr/bin/env python3
"""OSINT Toolkit Diagnostic — checks available API keys, CLI tools, and capabilities."""

import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _http import get_workspace


def check_key(env_var, file_path=None):
    """Check if API key is available via env or file."""
    if os.environ.get(env_var):
        return True, f"(env)"
    if file_path and os.path.isfile(file_path):
        return True, f"(file: {os.path.basename(file_path)})"
    return False, ""


def main():
    workspace, skill_dir, scripts_dir = get_workspace()

    print("=== OSINT TOOLKIT DIAGNOSTIC ===")
    print()

    # 1. API Tokens
    print("📡 API Tokens:")
    keys = [
        ("APIFY_API_TOKEN", os.path.join(workspace, "scripts", "apify-api-token.txt"),
         "https://console.apify.com/account/integrations"),
        ("JINA_API_KEY", os.path.join(workspace, "scripts", "jina-api-key.txt"),
         "https://jina.ai/api-key"),
        ("PERPLEXITY_API_KEY", None, "https://perplexity.ai/settings/api"),
        ("PARALLEL_API_KEY", os.path.join(workspace, "scripts", "parallel-api-key.txt"),
         "https://platform.parallel.ai"),
        ("EXA_API_KEY", None, "https://dashboard.exa.ai"),
        ("TAVILY_API_KEY", None, "https://app.tavily.com/home"),
        ("BRIGHTDATA_MCP_URL", os.path.join(workspace, "scripts", "brightdata-mcp-url.txt"),
         "https://brightdata.com/products/web-scraper/mcp"),
    ]
    for env_var, file_path, url in keys:
        found, source = check_key(env_var, file_path)
        if found:
            print(f"  ✅ {env_var} {source}")
        else:
            print(f"  ❌ {env_var} — get one at {url}")
    print()

    # 2. CLI Tools
    print("🔧 CLI Tools:")
    tools = [
        ("python3", "python"),
        ("node", None),
        ("jq", None),
        ("curl", None),
        ("git", None),
    ]
    for tool_name, alt_name in tools:
        path = shutil.which(tool_name) or (shutil.which(alt_name) if alt_name else None)
        if path:
            print(f"  ✅ {tool_name}")
        else:
            print(f"  ❌ {tool_name}")

    # Check run_actor.js
    run_actor_js = os.path.join(scripts_dir, "run_actor.js")
    if os.path.isfile(run_actor_js):
        print(f"  ✅ run_actor.js (embedded, 55+ actors)")
    else:
        print(f"  ❌ run_actor.js (missing)")

    # Check Python scripts
    py_scripts = ["perplexity.py", "tavily.py", "exa.py", "jina.py",
                  "parallel.py", "apify.py", "brightdata.py", "volley.py"]
    for script in py_scripts:
        path = os.path.join(scripts_dir, script)
        if os.path.isfile(path):
            print(f"  ✅ {script}")
        else:
            print(f"  ⚠️  {script} (not found)")
    print()

    # 3. Internal Intelligence
    print("📱 Internal Intelligence:")
    tg_path = os.path.join(workspace, "skills", "telegram", "scripts", "tg.py")
    if os.path.isfile(tg_path):
        print("  ✅ tg.py (Telegram history/search)")
    else:
        print("  ❌ tg.py (no Telegram access)")

    himalaya = shutil.which("himalaya")
    himalaya_local = os.path.expanduser("~/.local/bin/himalaya")
    if himalaya or os.path.isfile(himalaya_local):
        print("  ✅ himalaya (email search)")
    else:
        print("  ❌ himalaya (no email access)")

    vault_crm = os.path.join(workspace, "vault", "crm")
    if os.path.isdir(vault_crm):
        count = sum(1 for f in os.listdir(vault_crm) if f.endswith(".md"))
        print(f"  ✅ vault/crm ({count} cards)")
    else:
        print("  ❌ vault/crm (no CRM vault)")
    print()

    # 4. Capability Summary
    print("📊 Capabilities:")
    apify_ok = check_key("APIFY_API_TOKEN", os.path.join(workspace, "scripts", "apify-api-token.txt"))[0]
    bright_ok = check_key("BRIGHTDATA_MCP_URL", os.path.join(workspace, "scripts", "brightdata-mcp-url.txt"))[0]
    jina_ok = check_key("JINA_API_KEY", os.path.join(workspace, "scripts", "jina-api-key.txt"))[0]
    perp_ok = check_key("PERPLEXITY_API_KEY")[0]
    tavily_ok = check_key("TAVILY_API_KEY")[0]
    exa_ok = check_key("EXA_API_KEY")[0]
    parallel_ok = check_key("PARALLEL_API_KEY", os.path.join(workspace, "scripts", "parallel-api-key.txt"))[0]

    caps = [
        (apify_ok, "LinkedIn scraping (Apify)"),
        (apify_ok, "Instagram scraping (Apify)"),
        (apify_ok, "TikTok scraping (Apify)"),
        (apify_ok, "YouTube scraping (Apify)"),
        (apify_ok, "Contact enrichment (Apify)"),
        (apify_ok, "Google Maps (Apify)"),
        (bright_ok, "Facebook scraping (Bright Data)"),
        (bright_ok, "CAPTCHA bypass (Bright Data)"),
        (jina_ok, "Deep search (Jina)"),
        (perp_ok, "Quick answers (Perplexity Sonar)"),
        (perp_ok, "Deep research (Perplexity Deep)"),
        (tavily_ok, "Agent search (Tavily)"),
        (exa_ok, "Semantic search (Exa)"),
        (exa_ok, "People/Company search (Exa)"),
        (parallel_ok, "AI search (Parallel)"),
    ]
    for available, name in caps:
        print(f"  {'✅' if available else '❌'} {name}")
    print()
    print("=== END DIAGNOSTIC ===")


if __name__ == "__main__":
    main()
