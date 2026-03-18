#!/usr/bin/env python3
"""
SEO Report — Professional HTML audit report generator.

Features:
- Single-file HTML with inline CSS (no external deps)
- SVG radar chart for score visualization
- Color-coded issue cards (Critical/High/Medium/Low)
- Quick Wins section
- Print-friendly (@media print)
- Responsive (mobile-readable)

Author: Laurent Rochetta
License: MIT
"""

import argparse
import json
import math
import os
import sys
from datetime import datetime


def generate_radar_svg(scores: dict, size: int = 300) -> str:
    """Generate an SVG radar chart for the 7 score categories."""
    categories = list(scores.keys())
    values = list(scores.values())
    n = len(categories)

    if n == 0:
        return ""

    cx, cy = size // 2, size // 2
    radius = size // 2 - 40

    # Short labels for display
    short_labels = {
        "technical": "Tech",
        "content_eeat": "E-E-A-T",
        "on_page": "On-Page",
        "schema": "Schema",
        "performance": "Perf",
        "ai_readiness": "AI/GEO",
        "images": "Images",
    }

    def point(angle_deg, r):
        angle_rad = math.radians(angle_deg - 90)
        x = cx + r * math.cos(angle_rad)
        y = cy + r * math.sin(angle_rad)
        return x, y

    svg_parts = [f'<svg viewBox="0 0 {size} {size}" xmlns="http://www.w3.org/2000/svg" style="max-width:{size}px;margin:auto;display:block;">']

    # Background circles
    for pct in [25, 50, 75, 100]:
        r = radius * pct / 100
        svg_parts.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#e2e8f0" stroke-width="1" opacity="0.5"/>')

    # Axis lines + labels
    for i in range(n):
        angle = (360 / n) * i
        x1, y1 = point(angle, 0)
        x2, y2 = point(angle, radius)
        svg_parts.append(f'<line x1="{cx}" y1="{cy}" x2="{x2}" y2="{y2}" stroke="#e2e8f0" stroke-width="1"/>')

        lx, ly = point(angle, radius + 20)
        label = short_labels.get(categories[i], categories[i][:6])
        svg_parts.append(f'<text x="{lx}" y="{ly}" text-anchor="middle" font-size="11" fill="#64748b" font-family="Inter,sans-serif">{label}</text>')

    # Data polygon
    data_points = []
    for i in range(n):
        angle = (360 / n) * i
        r = radius * min(values[i], 100) / 100
        x, y = point(angle, r)
        data_points.append(f"{x},{y}")

    poly = " ".join(data_points)
    svg_parts.append(f'<polygon points="{poly}" fill="rgba(59,130,246,0.2)" stroke="#3b82f6" stroke-width="2"/>')

    # Data points
    for i in range(n):
        angle = (360 / n) * i
        r = radius * min(values[i], 100) / 100
        x, y = point(angle, r)
        color = "#22c55e" if values[i] >= 80 else "#f59e0b" if values[i] >= 50 else "#ef4444"
        svg_parts.append(f'<circle cx="{x}" cy="{y}" r="4" fill="{color}" stroke="white" stroke-width="2"/>')

    svg_parts.append('</svg>')
    return "\n".join(svg_parts)


def severity_color(severity: str) -> str:
    """Get color for severity level."""
    return {
        "critical": "#ef4444",
        "high": "#f97316",
        "medium": "#f59e0b",
        "low": "#22c55e",
    }.get(severity, "#64748b")


def severity_icon(severity: str) -> str:
    return {
        "critical": "🔴",
        "high": "🟠",
        "medium": "🟡",
        "low": "🟢",
    }.get(severity, "⚪")


def score_color(score: int) -> str:
    if score >= 90:
        return "#22c55e"
    elif score >= 70:
        return "#84cc16"
    elif score >= 50:
        return "#f59e0b"
    else:
        return "#ef4444"


def generate_html_report(audit_data: dict) -> str:
    """Generate a complete HTML report from audit JSON data."""

    domain = audit_data.get("domain", "Unknown")
    timestamp = audit_data.get("timestamp", datetime.now().isoformat())
    total_score = audit_data.get("score", {}).get("total", 0)
    categories = audit_data.get("score", {}).get("categories", {})
    issues = audit_data.get("issues", [])
    pages = audit_data.get("pages", [])

    # Generate radar chart
    radar_svg = generate_radar_svg(categories) if categories else ""

    # Sort issues by severity
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    sorted_issues = sorted(issues, key=lambda x: severity_order.get(x.get("severity", "low"), 4))

    # Count by severity
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for issue in issues:
        sev = issue.get("severity", "low")
        counts[sev] = counts.get(sev, 0) + 1

    # Quick wins
    quick_wins = [i for i in issues if i.get("quick_win", False)][:5]

    # Build issue cards HTML
    issue_cards = ""
    for issue in sorted_issues:
        sev = issue.get("severity", "low")
        fix_html = ""
        if issue.get("fix"):
            fix_html = f'<div class="fix-block"><strong>Fix:</strong><pre><code>{issue["fix"]}</code></pre></div>'

        issue_cards += f'''
        <div class="issue-card" style="border-left: 4px solid {severity_color(sev)}">
            <div class="issue-header">
                <span class="severity-badge" style="background:{severity_color(sev)}">{sev.upper()}</span>
                <span class="issue-category">{issue.get("category", "")}</span>
            </div>
            <h4>{issue.get("title", "")}</h4>
            <p>{issue.get("description", "")}</p>
            {fix_html}
        </div>'''

    # Quick wins HTML
    qw_html = ""
    if quick_wins:
        qw_items = ""
        for qw in quick_wins:
            qw_items += f'<li>{severity_icon(qw.get("severity", ""))} {qw.get("title", "")}</li>'
        qw_html = f'<div class="quick-wins"><h3>⚡ Quick Wins</h3><ul>{qw_items}</ul></div>'

    # Category scores table
    cat_rows = ""
    for cat, score in categories.items():
        cat_name = cat.replace("_", " ").title()
        cat_rows += f'''
        <tr>
            <td>{cat_name}</td>
            <td>
                <div class="score-bar-bg">
                    <div class="score-bar" style="width:{score}%;background:{score_color(score)}"></div>
                </div>
            </td>
            <td style="color:{score_color(score)};font-weight:700">{score}</td>
        </tr>'''

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SEO Audit Report — {domain}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Inter', -apple-system, sans-serif;
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
        }}
        .container {{ max-width: 900px; margin: 0 auto; padding: 2rem; }}

        /* Header */
        .header {{
            background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
            color: white;
            padding: 3rem 2rem;
            border-radius: 16px;
            margin-bottom: 2rem;
            text-align: center;
        }}
        .header h1 {{ font-size: 2rem; margin-bottom: 0.5rem; }}
        .header .domain {{ font-size: 1.2rem; opacity: 0.8; }}
        .header .date {{ font-size: 0.85rem; opacity: 0.6; margin-top: 0.5rem; }}

        /* Score circle */
        .score-hero {{
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 3rem;
            margin: 2rem 0;
            flex-wrap: wrap;
        }}
        .score-circle {{
            width: 150px;
            height: 150px;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border: 6px solid {score_color(total_score)};
            background: white;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08);
        }}
        .score-number {{ font-size: 3rem; font-weight: 700; color: {score_color(total_score)}; }}
        .score-label {{ font-size: 0.75rem; text-transform: uppercase; color: #64748b; letter-spacing: 1px; }}

        /* Summary cards */
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
            margin-bottom: 2rem;
        }}
        .summary-card {{
            background: white;
            border-radius: 12px;
            padding: 1.2rem;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }}
        .summary-card .count {{ font-size: 2rem; font-weight: 700; }}
        .summary-card .label {{ font-size: 0.8rem; color: #64748b; }}

        /* Sections */
        .section {{ background: white; border-radius: 12px; padding: 2rem; margin-bottom: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }}
        .section h2 {{ margin-bottom: 1rem; font-size: 1.3rem; }}
        .section h3 {{ margin-bottom: 0.8rem; font-size: 1.1rem; }}

        /* Score bars */
        table {{ width: 100%; border-collapse: collapse; }}
        td {{ padding: 0.6rem 0; }}
        .score-bar-bg {{ width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin: 0 1rem; }}
        .score-bar {{ height: 100%; border-radius: 4px; transition: width 0.5s ease; }}

        /* Issue cards */
        .issue-card {{
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 0.8rem;
        }}
        .issue-header {{ display: flex; gap: 0.5rem; margin-bottom: 0.3rem; align-items: center; }}
        .severity-badge {{ color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; }}
        .issue-category {{ font-size: 0.8rem; color: #64748b; }}
        .issue-card h4 {{ margin-bottom: 0.3rem; }}
        .issue-card p {{ color: #475569; font-size: 0.9rem; }}
        .fix-block {{ background: #f1f5f9; border-radius: 6px; padding: 0.8rem; margin-top: 0.5rem; }}
        .fix-block pre {{ overflow-x: auto; font-size: 0.8rem; }}

        /* Quick wins */
        .quick-wins {{ background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }}
        .quick-wins ul {{ list-style: none; padding: 0; }}
        .quick-wins li {{ padding: 0.3rem 0; }}

        /* Footer */
        .footer {{ text-align: center; color: #94a3b8; font-size: 0.8rem; padding: 2rem 0; }}

        /* Print */
        @media print {{
            body {{ background: white; }}
            .container {{ max-width: 100%; padding: 0; }}
            .header {{ break-after: avoid; }}
            .section {{ break-inside: avoid; box-shadow: none; border: 1px solid #e2e8f0; }}
        }}

        /* Mobile */
        @media (max-width: 640px) {{
            .summary-grid {{ grid-template-columns: repeat(2, 1fr); }}
            .score-hero {{ flex-direction: column; gap: 1.5rem; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>SEO Audit Report</h1>
            <div class="domain">{domain}</div>
            <div class="date">{timestamp[:10]}</div>
        </div>

        <div class="score-hero">
            <div class="score-circle">
                <div class="score-number">{total_score}</div>
                <div class="score-label">SEO Score</div>
            </div>
            <div>
                {radar_svg}
            </div>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                <div class="count" style="color:#ef4444">{counts["critical"]}</div>
                <div class="label">Critical</div>
            </div>
            <div class="summary-card">
                <div class="count" style="color:#f97316">{counts["high"]}</div>
                <div class="label">High</div>
            </div>
            <div class="summary-card">
                <div class="count" style="color:#f59e0b">{counts["medium"]}</div>
                <div class="label">Medium</div>
            </div>
            <div class="summary-card">
                <div class="count" style="color:#22c55e">{counts["low"]}</div>
                <div class="label">Low</div>
            </div>
        </div>

        {qw_html}

        <div class="section">
            <h2>📊 Category Scores</h2>
            <table>{cat_rows}</table>
        </div>

        <div class="section">
            <h2>🔍 Issues ({len(issues)})</h2>
            {issue_cards}
        </div>

        <div class="footer">
            Generated by BMAD+ SEO Engine v2.1 — By Laurent Rochetta
        </div>
    </div>
</body>
</html>'''

    return html


# ── CLI ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="SEO Report — HTML audit report generator (BMAD+ SEO Engine)"
    )
    parser.add_argument("input", help="Audit JSON file")
    parser.add_argument("--output", "-o", default="seo-report.html", help="Output HTML file")

    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(f"Error: File not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    with open(args.input, "r", encoding="utf-8") as f:
        audit_data = json.load(f)

    html = generate_html_report(audit_data)

    with open(args.output, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"✅ Report generated: {args.output}", file=sys.stderr)
    print(f"   Domain: {audit_data.get('domain', 'Unknown')}")
    print(f"   Score: {audit_data.get('score', {}).get('total', 0)}/100")
    print(f"   Issues: {len(audit_data.get('issues', []))}")


if __name__ == "__main__":
    main()
