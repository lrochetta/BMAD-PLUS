# GEO Signals — AI Search Optimization Guide (March 2026)

> Author: Laurent Rochetta | BMAD+ SEO Engine v2.0

## What is GEO?

**Generative Engine Optimization (GEO)** is the discipline of optimizing content for AI-generated answers across Google AI Overviews, ChatGPT, Perplexity, Bing Copilot, and other AI-powered search experiences.

## AI Search Landscape

| Platform | Reach | Key Citation Sources |
|----------|-------|---------------------|
| Google AI Overviews | 1.5B users/month, 200+ countries, 50%+ query coverage | Top-10 ranking pages (92%) |
| Google AI Mode | Full conversational search (May 2025), zero organic links | Citation is the only visibility mechanism |
| ChatGPT Search | 900M weekly active users | Wikipedia (47.9%), Reddit (11.3%) |
| Perplexity | 500M+ monthly queries | Reddit (46.7%), Wikipedia |
| Bing Copilot | Integrated in Edge/Windows | Bing index, authoritative sites |

> AI-referred sessions grew **527%** between January and May 2025 (SparkToro).

---

## The Brand Mention Revolution

**Brand mentions correlate 3× more strongly with AI visibility than backlinks.**
(Ahrefs December 2025 study, 75,000 brands)

| Signal | Correlation with AI Citations |
|--------|-------------------------------|
| YouTube mentions | ~0.737 (strongest) |
| Reddit mentions | High |
| Wikipedia presence | High |
| LinkedIn presence | Moderate |
| Domain Rating (backlinks) | ~0.266 (weak) |

> Only **11%** of domains are cited by both ChatGPT and Google AI Overviews for the same query — platform-specific optimization is essential.

---

## GEO Scoring Criteria

### 1. Citability (25%)

**Optimal passage length: 134–167 words** for AI citation.

| Signal | Strong | Weak |
|--------|--------|------|
| Quotable statements with facts/stats | ✅ | Vague generic statements |
| Self-contained answer blocks | ✅ | Requires surrounding context |
| Direct answer in first 40–60 words | ✅ | Buried conclusions |
| "X is..." / "X refers to..." patterns | ✅ | No definitions |
| Unique data not found elsewhere | ✅ | Commonly available info |

### 2. Structural Readability (20%)

92% of AI Overview citations come from top-10 pages, but 47% come from pages below position 5 — demonstrating different selection logic.

| Signal | Strong | Weak |
|--------|--------|------|
| Clean H1→H2→H3 hierarchy | ✅ | Wall of text |
| Question-based headings | ✅ | Vague headings |
| Short paragraphs (2-4 sentences) | ✅ | Long unbroken paragraphs |
| Tables for comparative data | ✅ | No structured data display |
| Lists for multi-item content | ✅ | Inline lists in sentences |

### 3. Multi-Modal Content (15%)

Content with multi-modal elements sees **156% higher selection rates**.

- Text + relevant images
- Video content (embedded or linked)
- Infographics and charts
- Interactive tools (calculators, assessments)
- Structured data supporting media

### 4. Authority & Brand Signals (20%)

- Author byline with credentials
- Publication and last-updated dates
- Citations to primary sources
- Organization credentials
- Entity presence in Wikipedia, Wikidata
- Active presence on Reddit, YouTube, LinkedIn

### 5. Technical Accessibility (20%)

**AI crawlers do NOT execute JavaScript** — SSR is critical.

- Server-side rendering for core content
- AI crawler access in robots.txt
- llms.txt file presence
- RSL 1.0 licensing terms

---

## AI Crawler Registry

| Crawler | Owner | Purpose | Recommend |
|---------|-------|---------|-----------|
| GPTBot | OpenAI | ChatGPT web search + training | Allow |
| OAI-SearchBot | OpenAI | OpenAI search features | Allow |
| ChatGPT-User | OpenAI | ChatGPT browsing | Allow |
| ClaudeBot | Anthropic | Claude web features | Allow |
| PerplexityBot | Perplexity | Perplexity search | Allow |
| Applebot-Extended | Apple | Apple Intelligence features | Allow |
| Google-Extended | Google | Gemini training (NOT Search) | Optional |
| CCBot | Common Crawl | Open dataset training | Optional/Block |
| Bytespider | ByteDance | TikTok/Douyin AI training | Block |
| anthropic-ai | Anthropic | Claude training | Optional |
| cohere-ai | Cohere | Cohere models | Optional |

---

## llms.txt Standard

File at `/llms.txt` (domain root). Provides structured guidance to AI crawlers.

```
# Site Name
> One-line description

## Main Sections
- [Page Title](url): Description
- [Another Page](url): Description

## Key Facts
- Important fact 1
- Important fact 2
```

Also check for `/llms-full.txt` (expanded version).

---

## RSL 1.0 (Really Simple Licensing)

Machine-readable AI licensing standard (December 2025).
Backed by: Reddit, Yahoo, Medium, Quora, Cloudflare, Akamai, Creative Commons.

Check for RSL implementation and appropriate licensing terms.

---

## Quick Wins for AI Visibility

### Immediate (1 day)
1. Add "What is [topic]?" definition in first 60 words of key pages
2. Create 134–167 word self-contained answer blocks
3. Add question-based H2/H3 headings
4. Include specific statistics with source attribution
5. Add publication and update dates
6. Allow key AI crawlers in robots.txt (GPTBot, ClaudeBot, PerplexityBot)

### Short-term (1 week)
1. Create `/llms.txt` file
2. Add author bios with credentials + Wikipedia/LinkedIn links
3. Implement Person and Organization schema
4. Add comparison tables with structured data
5. Ensure SSR for all critical content

### Strategic (1-3 months)
1. Build Wikipedia presence for brand and key people
2. Create original research or surveys (unique citability)
3. Establish active YouTube channel
4. Build Reddit community presence
5. Implement comprehensive entity linking (sameAs across platforms)
6. Develop unique tools, calculators, or interactive content
