#!/usr/bin/env python3
"""
Google Search Console Client — OAuth2 API client for organic search data.

Features:
- OAuth2 flow with credential persistence
- Query performance data (queries, pages, devices, countries)
- Index coverage status
- Sitemap submissions

Author: Laurent Rochetta
License: MIT
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta

SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), "credentials.json")
TOKEN_FILE = os.path.join(os.path.dirname(__file__), "token.json")


def get_service():
    """Authenticate and return a Search Console service object."""
    try:
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
        from google.auth.transport.requests import Request
    except ImportError:
        print(
            "Error: Missing dependencies. Install:\n"
            "  pip install google-auth google-auth-oauthlib google-api-python-client",
            file=sys.stderr,
        )
        sys.exit(1)

    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDENTIALS_FILE):
                print(
                    f"Error: {CREDENTIALS_FILE} not found.\n"
                    "Download OAuth2 credentials from Google Cloud Console.\n"
                    "See EXTENSION.md for setup guide.",
                    file=sys.stderr,
                )
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())

    return build("searchconsole", "v1", credentials=creds)


def list_sites(service):
    """List all verified Search Console properties."""
    result = service.sites().list().execute()
    sites = result.get("siteEntry", [])
    return [{"url": s["siteUrl"], "level": s["permissionLevel"]} for s in sites]


def query_performance(service, site_url: str, days: int = 28, dimensions: list = None, row_limit: int = 25):
    """Query Search Analytics for organic performance data."""
    if dimensions is None:
        dimensions = ["query"]

    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=days)

    body = {
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
        "dimensions": dimensions,
        "rowLimit": row_limit,
        "dataState": "all",
    }

    result = service.searchanalytics().query(siteUrl=site_url, body=body).execute()
    rows = result.get("rows", [])

    return [{
        "keys": row["keys"],
        "clicks": row["clicks"],
        "impressions": row["impressions"],
        "ctr": round(row["ctr"] * 100, 1),
        "position": round(row["position"], 1),
    } for row in rows]


def get_sitemaps(service, site_url: str):
    """Get sitemap submission status."""
    result = service.sitemaps().list(siteUrl=site_url).execute()
    sitemaps = result.get("sitemap", [])
    return [{
        "path": s["path"],
        "type": s.get("type", ""),
        "submitted": s.get("lastSubmitted", ""),
        "warnings": s.get("warnings", 0),
        "errors": s.get("errors", 0),
    } for s in sitemaps]


# ── CLI ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Google Search Console Client (BMAD+ SEO Engine)"
    )
    parser.add_argument("site", nargs="?", help="Site URL (e.g. https://example.com)")
    parser.add_argument("--setup", action="store_true", help="Run OAuth2 setup flow")
    parser.add_argument("--sites", action="store_true", help="List verified sites")
    parser.add_argument("--queries", action="store_true", help="Top queries")
    parser.add_argument("--pages", action="store_true", help="Top pages")
    parser.add_argument("--sitemaps", action="store_true", help="Sitemap status")
    parser.add_argument("--all", action="store_true", help="All data")
    parser.add_argument("--days", type=int, default=28, help="Days lookback (default: 28)")
    parser.add_argument("--limit", type=int, default=25, help="Max rows (default: 25)")
    parser.add_argument("--json", "-j", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    service = get_service()

    if args.setup:
        print("✅ OAuth2 setup complete. Token saved.")
        return

    if args.sites:
        sites = list_sites(service)
        if args.json:
            print(json.dumps(sites, indent=2))
        else:
            print("\nVerified Sites:")
            for s in sites:
                print(f"  {s['url']} ({s['level']})")
        return

    if not args.site:
        parser.print_help()
        return

    if args.queries or args.all:
        data = query_performance(service, args.site, args.days, ["query"], args.limit)
        if args.json:
            print(json.dumps({"queries": data}, indent=2))
        else:
            print(f"\nTop Queries ({args.days} days):")
            for i, row in enumerate(data, 1):
                q = row["keys"][0]
                print(f"  {i:2}. \"{q[:50]}\" — Pos: {row['position']}, "
                      f"Clicks: {row['clicks']:,}, CTR: {row['ctr']}%, Imp: {row['impressions']:,}")

    if args.pages or args.all:
        data = query_performance(service, args.site, args.days, ["page"], args.limit)
        if args.json:
            print(json.dumps({"pages": data}, indent=2))
        else:
            print(f"\nTop Pages ({args.days} days):")
            for i, row in enumerate(data, 1):
                page = row["keys"][0]
                print(f"  {i:2}. {page[:60]} — Clicks: {row['clicks']:,}, CTR: {row['ctr']}%")

    if args.sitemaps or args.all:
        data = get_sitemaps(service, args.site)
        if args.json:
            print(json.dumps({"sitemaps": data}, indent=2))
        else:
            print(f"\nSitemaps:")
            for s in data:
                status = "✅" if s["errors"] == 0 else "❌"
                print(f"  {status} {s['path']} (type: {s['type']}, errors: {s['errors']})")


if __name__ == "__main__":
    main()
