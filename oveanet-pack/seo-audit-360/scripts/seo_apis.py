#!/usr/bin/env python3
"""
SEO APIs — Google free API client for live SEO data.

Connects to:
- PageSpeed Insights API v5 (lab scores + audits)
- Chrome UX Report (CrUX) API (field CWV data)
- Rich Results Test API (schema validation)

Requires: GOOGLE_API_KEY environment variable (free, no OAuth).
Get one at: https://console.cloud.google.com/apis/credentials

Author: Laurent Rochetta
License: MIT
"""

import argparse
import json
import os
import sys
from typing import Optional

try:
    import requests
except ImportError:
    print("Error: requests required. Install: pip install requests", file=sys.stderr)
    sys.exit(1)


API_KEY = os.environ.get("GOOGLE_API_KEY", "")

PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
CRUX_ENDPOINT = "https://chromeuxreport.googleapis.com/v1/records:queryRecord"
RICH_RESULTS_ENDPOINT = "https://searchconsole.googleapis.com/v1/urlTestingTools/mobileFriendlyTest:run"


# ── PageSpeed Insights ─────────────────────────────────────────────

def run_pagespeed(url: str, strategy: str = "mobile", categories: Optional[list] = None) -> dict:
    """
    Run PageSpeed Insights audit.

    Args:
        url: URL to audit
        strategy: "mobile" or "desktop"
        categories: List of categories (PERFORMANCE, ACCESSIBILITY, BEST_PRACTICES, SEO)

    Returns:
        Structured result with scores, audits, and opportunities
    """
    if not API_KEY:
        return {"error": "GOOGLE_API_KEY not set. Get one at https://console.cloud.google.com/apis/credentials"}

    if categories is None:
        categories = ["PERFORMANCE", "ACCESSIBILITY", "BEST_PRACTICES", "SEO"]

    params = {
        "url": url,
        "key": API_KEY,
        "strategy": strategy,
    }
    for cat in categories:
        params.setdefault("category", [])
        if isinstance(params["category"], list):
            params["category"].append(cat)

    # requests needs category as repeated param
    param_str = f"url={url}&key={API_KEY}&strategy={strategy}"
    for cat in categories:
        param_str += f"&category={cat}"

    try:
        response = requests.get(f"{PSI_ENDPOINT}?{param_str}", timeout=120)
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as e:
        return {"error": f"PSI API request failed: {e}"}

    # Extract scores
    result = {
        "url": url,
        "strategy": strategy,
        "scores": {},
        "cwv": {},
        "failing_audits": [],
        "opportunities": [],
    }

    # Category scores
    categories_data = data.get("lighthouseResult", {}).get("categories", {})
    for cat_id, cat_data in categories_data.items():
        score = cat_data.get("score", 0)
        result["scores"][cat_id] = round(score * 100)

    # Core Web Vitals from Lighthouse
    audits = data.get("lighthouseResult", {}).get("audits", {})

    cwv_metrics = {
        "largest-contentful-paint": "LCP",
        "interaction-to-next-paint": "INP",
        "cumulative-layout-shift": "CLS",
        "first-contentful-paint": "FCP",
        "total-blocking-time": "TBT",
        "speed-index": "SI",
    }

    for audit_id, label in cwv_metrics.items():
        if audit_id in audits:
            audit = audits[audit_id]
            result["cwv"][label] = {
                "value": audit.get("numericValue"),
                "display": audit.get("displayValue", ""),
                "score": round(audit.get("score", 0) * 100),
            }

    # Failing audits (score < 1.0)
    for audit_id, audit in audits.items():
        score = audit.get("score")
        if score is not None and score < 0.9 and audit.get("title"):
            severity = "critical" if score < 0.5 else "warning"
            result["failing_audits"].append({
                "id": audit_id,
                "title": audit.get("title", ""),
                "description": audit.get("description", "")[:200],
                "score": round(score * 100),
                "severity": severity,
                "display_value": audit.get("displayValue", ""),
            })

    # Sort failures by score (worst first)
    result["failing_audits"].sort(key=lambda x: x["score"])

    # Opportunities (have savings)
    for audit_id, audit in audits.items():
        details = audit.get("details", {})
        if details.get("type") == "opportunity" and details.get("overallSavingsMs", 0) > 0:
            result["opportunities"].append({
                "id": audit_id,
                "title": audit.get("title", ""),
                "savings_ms": details.get("overallSavingsMs", 0),
                "savings_bytes": details.get("overallSavingsBytes", 0),
            })

    result["opportunities"].sort(key=lambda x: x["savings_ms"], reverse=True)

    # Field data (CrUX from PSI response)
    loading_exp = data.get("loadingExperience", {})
    if loading_exp.get("metrics"):
        result["field_data"] = {}
        for metric_id, metric_data in loading_exp["metrics"].items():
            result["field_data"][metric_id] = {
                "percentile": metric_data.get("percentile"),
                "category": metric_data.get("category"),
            }

    return result


# ── CrUX API ───────────────────────────────────────────────────────

def run_crux(url: str, form_factor: str = "PHONE") -> dict:
    """
    Query Chrome UX Report for real-world performance data.

    Args:
        url: URL or origin to query
        form_factor: PHONE, DESKTOP, or ALL_FORM_FACTORS

    Returns:
        Field CWV data at 75th percentile
    """
    if not API_KEY:
        return {"error": "GOOGLE_API_KEY not set"}

    # Try URL-level first, fall back to origin
    from urllib.parse import urlparse
    parsed = urlparse(url)
    origin = f"{parsed.scheme}://{parsed.netloc}"

    payload = {
        "url": url,
        "formFactor": form_factor,
    }

    try:
        response = requests.post(
            f"{CRUX_ENDPOINT}?key={API_KEY}",
            json=payload,
            timeout=30,
        )

        if response.status_code == 404:
            # No URL-level data, try origin
            payload = {"origin": origin, "formFactor": form_factor}
            response = requests.post(
                f"{CRUX_ENDPOINT}?key={API_KEY}",
                json=payload,
                timeout=30,
            )

        if response.status_code == 404:
            return {"error": f"No CrUX data available for {url} (not enough traffic)"}

        response.raise_for_status()
        data = response.json()
    except requests.RequestException as e:
        return {"error": f"CrUX API request failed: {e}"}

    result = {
        "url": url,
        "form_factor": form_factor,
        "metrics": {},
        "collection_period": {},
    }

    # Extract metrics
    metrics = data.get("record", {}).get("metrics", {})

    metric_map = {
        "largest_contentful_paint": "LCP",
        "interaction_to_next_paint": "INP",
        "cumulative_layout_shift": "CLS",
        "first_contentful_paint": "FCP",
        "experimental_time_to_first_byte": "TTFB",
    }

    for api_name, label in metric_map.items():
        if api_name in metrics:
            m = metrics[api_name]
            p75 = m.get("percentiles", {}).get("p75")
            histogram = m.get("histogram", [])

            # Calculate good/needs-improvement/poor distribution
            distribution = {}
            for bucket in histogram:
                density = bucket.get("density", 0)
                if bucket.get("end"):
                    distribution["good"] = distribution.get("good", 0) + density
                elif "start" in bucket and "end" not in bucket:
                    distribution["poor"] = density
                else:
                    distribution["needs_improvement"] = density

            result["metrics"][label] = {
                "p75": p75,
                "distribution": distribution,
            }

    # Collection period
    period = data.get("record", {}).get("collectionPeriod", {})
    result["collection_period"] = {
        "first_date": period.get("firstDate", {}),
        "last_date": period.get("lastDate", {}),
    }

    return result


# ── Rich Results Test ──────────────────────────────────────────────

def run_rich_results_test(url: str) -> dict:
    """
    Check if a URL is eligible for rich results.

    Note: This uses the URL Testing Tools API (Mobile-Friendly Test)
    which also returns rich results information. The dedicated Rich Results
    Test API requires OAuth2, so we use this free alternative.

    Args:
        url: URL to test

    Returns:
        Mobile-friendly status and detected structured data
    """
    if not API_KEY:
        return {"error": "GOOGLE_API_KEY not set"}

    payload = {"url": url}

    try:
        response = requests.post(
            f"{RICH_RESULTS_ENDPOINT}?key={API_KEY}",
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as e:
        return {"error": f"URL Testing API request failed: {e}"}

    result = {
        "url": url,
        "mobile_friendly": data.get("mobileFriendliness") == "MOBILE_FRIENDLY",
        "issues": [],
    }

    for issue in data.get("mobileFriendlyIssues", []):
        result["issues"].append({
            "rule": issue.get("rule", ""),
        })

    return result


# ── Unified Runner ─────────────────────────────────────────────────

def run_all(url: str) -> dict:
    """Run all available API checks and merge results."""
    print(f"Running PageSpeed Insights (mobile)...", file=sys.stderr)
    psi_mobile = run_pagespeed(url, strategy="mobile")

    print(f"Running PageSpeed Insights (desktop)...", file=sys.stderr)
    psi_desktop = run_pagespeed(url, strategy="desktop")

    print(f"Running CrUX API...", file=sys.stderr)
    crux = run_crux(url)

    print(f"Running Mobile-Friendly Test...", file=sys.stderr)
    rich = run_rich_results_test(url)

    return {
        "url": url,
        "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "pagespeed": {
            "mobile": psi_mobile,
            "desktop": psi_desktop,
        },
        "crux": crux,
        "mobile_friendly": rich,
    }


# ── CLI ────────────────────────────────────────────────────────────

def print_psi_summary(result: dict, label: str):
    """Print a human-readable PSI summary."""
    if result.get("error"):
        print(f"  Error: {result['error']}")
        return

    scores = result.get("scores", {})
    print(f"\n  {label} Scores:")
    for cat, score in scores.items():
        icon = "🟢" if score >= 90 else "🟡" if score >= 50 else "🔴"
        cat_name = cat.replace("_", " ").replace("-", " ").title()
        print(f"    {icon} {cat_name}: {score}/100")

    cwv = result.get("cwv", {})
    if cwv:
        print(f"\n  Core Web Vitals:")
        for metric, data in cwv.items():
            icon = "🟢" if data["score"] >= 90 else "🟡" if data["score"] >= 50 else "🔴"
            print(f"    {icon} {metric}: {data['display']} ({data['score']}/100)")

    failures = result.get("failing_audits", [])[:5]
    if failures:
        print(f"\n  Top Failing Audits:")
        for audit in failures:
            icon = "🔴" if audit["severity"] == "critical" else "🟠"
            print(f"    {icon} {audit['title']} ({audit['score']}/100)")

    opps = result.get("opportunities", [])[:3]
    if opps:
        print(f"\n  Top Opportunities:")
        for opp in opps:
            print(f"    💡 {opp['title']} (save {opp['savings_ms']}ms)")


def main():
    parser = argparse.ArgumentParser(
        description="SEO APIs — Google free API client (BMAD+ SEO Engine)"
    )
    parser.add_argument("url", nargs="?", help="URL to analyze")
    parser.add_argument("--pagespeed", action="store_true", help="Run PageSpeed Insights")
    parser.add_argument("--crux", action="store_true", help="Run CrUX API")
    parser.add_argument("--richtest", action="store_true", help="Run Rich Results Test")
    parser.add_argument("--all", action="store_true", help="Run all APIs")
    parser.add_argument("--strategy", choices=["mobile", "desktop"], default="mobile",
                        help="PSI strategy (default: mobile)")
    parser.add_argument("--json", "-j", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    if not args.url:
        parser.print_help()
        sys.exit(1)

    if not API_KEY:
        print("⚠️  GOOGLE_API_KEY not set!", file=sys.stderr)
        print("   Get a free key: https://console.cloud.google.com/apis/credentials", file=sys.stderr)
        print("   Enable: PageSpeed Insights API + Chrome UX Report API", file=sys.stderr)
        print("   Set: export GOOGLE_API_KEY=your_key", file=sys.stderr)
        sys.exit(1)

    if args.all:
        result = run_all(args.url)
        if args.json:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(f"\n{'='*60}")
            print(f"SEO API Report: {args.url}")
            print(f"{'='*60}")
            print_psi_summary(result["pagespeed"]["mobile"], "📱 Mobile")
            print_psi_summary(result["pagespeed"]["desktop"], "🖥️  Desktop")

            crux = result["crux"]
            if not crux.get("error"):
                print(f"\n  📊 CrUX Field Data:")
                for metric, data in crux.get("metrics", {}).items():
                    print(f"    {metric}: p75 = {data['p75']}")
            else:
                print(f"\n  📊 CrUX: {crux['error']}")

            mf = result["mobile_friendly"]
            if not mf.get("error"):
                icon = "✅" if mf["mobile_friendly"] else "❌"
                print(f"\n  📱 Mobile-Friendly: {icon}")
            else:
                print(f"\n  📱 Mobile-Friendly: {mf['error']}")

    elif args.pagespeed:
        result = run_pagespeed(args.url, strategy=args.strategy)
        if args.json:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print_psi_summary(result, f"{'📱 Mobile' if args.strategy == 'mobile' else '🖥️  Desktop'}")

    elif args.crux:
        result = run_crux(args.url)
        if args.json:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            if result.get("error"):
                print(f"Error: {result['error']}")
            else:
                print(f"\nCrUX Field Data: {args.url}")
                for metric, data in result.get("metrics", {}).items():
                    print(f"  {metric}: p75 = {data['p75']}")

    elif args.richtest:
        result = run_rich_results_test(args.url)
        if args.json:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            if result.get("error"):
                print(f"Error: {result['error']}")
            else:
                icon = "✅" if result["mobile_friendly"] else "❌"
                print(f"Mobile-Friendly: {icon}")
                if result["issues"]:
                    for issue in result["issues"]:
                        print(f"  ⚠️ {issue['rule']}")

    else:
        # Default: run pagespeed
        result = run_pagespeed(args.url, strategy=args.strategy)
        if args.json:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print_psi_summary(result, f"{'📱 Mobile' if args.strategy == 'mobile' else '🖥️  Desktop'}")


if __name__ == "__main__":
    main()
