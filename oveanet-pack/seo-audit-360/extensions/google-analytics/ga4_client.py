#!/usr/bin/env python3
"""
Google Analytics 4 Client — GA4 Data API client for organic traffic analysis.

Features:
- Organic traffic metrics (sessions, users, engagement)
- Landing page performance
- Conversion attribution
- Custom date ranges

Author: Laurent Rochetta
License: MIT
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta

SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"]
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), "..", "google-search-console", "credentials.json")
TOKEN_FILE = os.path.join(os.path.dirname(__file__), "..", "google-search-console", "token.json")


def get_client(property_id: str):
    """Authenticate and return a GA4 BetaAnalyticsData client."""
    try:
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from google.auth.transport.requests import Request
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.analytics.data_v1beta.types import (
            DateRange, Dimension, Metric, RunReportRequest, FilterExpression,
            Filter,
        )
    except ImportError:
        print(
            "Error: Missing dependencies. Install:\n"
            "  pip install google-auth google-auth-oauthlib google-analytics-data",
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
                print(f"Error: credentials.json not found. See EXTENSION.md for setup.", file=sys.stderr)
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())

    return BetaAnalyticsDataClient(credentials=creds), property_id


def run_organic_report(client, property_id: str, days: int = 30) -> dict:
    """Get organic traffic overview."""
    from google.analytics.data_v1beta.types import (
        DateRange, Metric, RunReportRequest, FilterExpression, Filter,
    )

    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=days)

    request = RunReportRequest(
        property=f"properties/{property_id}",
        date_ranges=[DateRange(start_date=start_date.isoformat(), end_date=end_date.isoformat())],
        metrics=[
            Metric(name="sessions"),
            Metric(name="totalUsers"),
            Metric(name="newUsers"),
            Metric(name="engagementRate"),
            Metric(name="averageSessionDuration"),
            Metric(name="bounceRate"),
        ],
        dimension_filter=FilterExpression(
            filter=Filter(
                field_name="sessionDefaultChannelGroup",
                string_filter=Filter.StringFilter(value="Organic Search"),
            )
        ),
    )

    response = client.run_report(request)

    if not response.rows:
        return {"error": "No organic data available for this period"}

    row = response.rows[0]
    return {
        "sessions": int(row.metric_values[0].value),
        "users": int(row.metric_values[1].value),
        "new_users": int(row.metric_values[2].value),
        "engagement_rate": round(float(row.metric_values[3].value) * 100, 1),
        "avg_duration_seconds": round(float(row.metric_values[4].value)),
        "bounce_rate": round(float(row.metric_values[5].value) * 100, 1),
    }


def run_landing_page_report(client, property_id: str, days: int = 30, limit: int = 20) -> list:
    """Get top organic landing pages."""
    from google.analytics.data_v1beta.types import (
        DateRange, Dimension, Metric, RunReportRequest, FilterExpression, Filter,
        OrderBy,
    )

    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=days)

    request = RunReportRequest(
        property=f"properties/{property_id}",
        date_ranges=[DateRange(start_date=start_date.isoformat(), end_date=end_date.isoformat())],
        dimensions=[Dimension(name="landingPage")],
        metrics=[
            Metric(name="sessions"),
            Metric(name="engagementRate"),
            Metric(name="averageSessionDuration"),
        ],
        dimension_filter=FilterExpression(
            filter=Filter(
                field_name="sessionDefaultChannelGroup",
                string_filter=Filter.StringFilter(value="Organic Search"),
            )
        ),
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
        limit=limit,
    )

    response = client.run_report(request)

    return [{
        "page": row.dimension_values[0].value,
        "sessions": int(row.metric_values[0].value),
        "engagement_rate": round(float(row.metric_values[1].value) * 100, 1),
        "avg_duration": round(float(row.metric_values[2].value)),
    } for row in response.rows]


# ── CLI ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Google Analytics 4 Client (BMAD+ SEO Engine)"
    )
    parser.add_argument("--property", "-p", required=True, help="GA4 Property ID")
    parser.add_argument("--organic", action="store_true", help="Organic traffic overview")
    parser.add_argument("--landing", action="store_true", help="Top landing pages")
    parser.add_argument("--all", action="store_true", help="All reports")
    parser.add_argument("--days", type=int, default=30, help="Days lookback (default: 30)")
    parser.add_argument("--limit", type=int, default=20, help="Max rows (default: 20)")
    parser.add_argument("--json", "-j", action="store_true", help="Output as JSON")
    parser.add_argument("--setup", action="store_true", help="Run OAuth2 setup")

    args = parser.parse_args()

    client, property_id = get_client(args.property)

    if args.setup:
        print("✅ OAuth2 setup complete for GA4.")
        return

    if args.organic or args.all:
        data = run_organic_report(client, property_id, args.days)
        if args.json:
            print(json.dumps({"organic": data}, indent=2))
        else:
            print(f"\nOrganic Traffic ({args.days} days):")
            if "error" in data:
                print(f"  {data['error']}")
            else:
                mins = data["avg_duration_seconds"] // 60
                secs = data["avg_duration_seconds"] % 60
                print(f"  Sessions:       {data['sessions']:,}")
                print(f"  Users:          {data['users']:,}")
                print(f"  New Users:      {data['new_users']:,}")
                print(f"  Engagement:     {data['engagement_rate']}%")
                print(f"  Avg Duration:   {mins}m {secs}s")
                print(f"  Bounce Rate:    {data['bounce_rate']}%")

    if args.landing or args.all:
        pages = run_landing_page_report(client, property_id, args.days, args.limit)
        if args.json:
            print(json.dumps({"landing_pages": pages}, indent=2))
        else:
            print(f"\nTop Organic Landing Pages:")
            for i, p in enumerate(pages, 1):
                print(f"  {i:2}. {p['page'][:55]} — {p['sessions']:,} sessions, {p['engagement_rate']}% engagement")


if __name__ == "__main__":
    main()
