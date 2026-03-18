# Google Analytics 4 Extension — BMAD+ SEO Engine

> Author: Laurent Rochetta | BMAD+ SEO Engine v2.1

## Overview

This extension connects to Google Analytics 4 (GA4) Data API for organic traffic analysis. Uses the same OAuth2 credentials as the Search Console extension.

## Setup Guide

### Prerequisites
- Google Cloud project with **GA4 Data API** enabled
- OAuth2 credentials (same `credentials.json` as GSC extension)
- GA4 property ID (find in GA4 Admin > Property Settings)

### First Run
```bash
python ga4_client.py --setup --property 123456789
```

## Commands

```bash
# Organic traffic overview
python ga4_client.py --organic https://example.com --property 123456789 --days 30

# Top organic landing pages
python ga4_client.py --landing https://example.com --property 123456789 --days 30

# Conversions from organic
python ga4_client.py --conversions https://example.com --property 123456789 --days 30

# Full export
python ga4_client.py --all https://example.com --property 123456789 --json > ga4-data.json
```

## Output Examples

### Organic Traffic
```
Organic Traffic (30 days):
  Sessions:       12,450
  Users:           8,230
  New Users:       6,120
  Engagement Rate: 72.3%
  Avg Duration:    2m 45s
  Bounce Rate:     36.1%
```

### Top Landing Pages
```
Top Organic Landing Pages:
  1. /blog/ai-development    — 2,340 sessions, 78% engagement
  2. /                        — 1,850 sessions, 65% engagement
  3. /features               — 1,120 sessions, 82% engagement
```

## Integration with SEO Engine

When installed, the SEO Engine can:
- Correlate crawled pages with actual organic traffic
- Identify high-traffic pages that need SEO optimization
- Track organic conversion attribution
- Detect pages with high impressions but low engagement (content quality issues)

## Dependencies

Same Google Auth libraries as GSC extension:
```
google-auth>=2.0.0
google-auth-oauthlib>=1.0.0
google-analytics-data>=0.18.0
```

## Security Notes

- Uses same `credentials.json` and `token.json` as GSC extension
- GA4 property ID is not sensitive but should be stored per-project
- Add credentials to `.gitignore`
