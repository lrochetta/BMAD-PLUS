---
name: bmad-osint-investigate
description: "Run the full OSINT investigation pipeline on a person or company. From a name or handle to a scored dossier with psychoprofile, career map, and confidence grades. Google dorks, French registries, enrichment databases, 55+ Apify actors, 7 search APIs."
---

# OSINT Investigation Skill

This skill executes a systematic OSINT intelligence gathering pipeline on an individual or company.

## Activation Instructions

<investigation-activation CRITICAL="TRUE">

### Step 1: Load the Full Pipeline
1. READ the complete OSINT pipeline file at: `{skill-dir}/osint/SKILL.md`
2. READ the enrichment databases reference: `{skill-dir}/osint/references/enrichment-databases-fr.md`
3. FOLLOW every phase precisely as documented

### Step 2: Get Target Information
Ask the user for:
- **Target name** or handle/URL
- **Type**: Personne physique or Personne morale
- **Context** (optional): company, city, industry, any known details
- **Scope**: Full investigation (Phase 0→6) or specific phase only
- **Budget limit**: Default ≤$0.50, ask for permission above that

### Step 3: Execute the Pipeline
Follow ALL phases from the OSINT pipeline:

**Phase 0**: Tooling Self-Check
- Run `python {skill-dir}/osint/scripts/diagnose.py`
- Report available tools to user

**Phase 1**: Seed Collection (API search)
- Run parallel search across all available engines
- Use `python {skill-dir}/osint/scripts/volley.py search "Name" "context"`
- Merge results with `python {skill-dir}/osint/scripts/volley.py merge <outdir>`

**Phase 1.3**: Google Dorks (FREE — always do this)
- Search for documents: `"Name" filetype:pdf`, `filetype:pptx`, `filetype:doc`
- Search for phone: `"Name" ("06" OR "07" OR "+33 6" OR "+33 7")`
- Search for CV: `"Name" (CV OR resume OR curriculum)`
- Search for statuts: `"Name" "demeurant" site:pappers.fr`
- Search for presentations: `"Name" filetype:pptx OR filetype:ppt`
- Use the browser tool to run these Google searches directly
- Refer to `{skill-dir}/osint/references/enrichment-databases-fr.md` for all dork templates

**Phase 1.5**: Internal Intelligence
- Check Telegram history, email, vault contacts BEFORE going external

**Phase 1.7**: French Business Registries (FREE — always do this for FR targets)
- **Pappers.fr** → SIREN/SIRET, dirigeants, statuts PDF (contain personal addresses!)
- **Societe.com** → Company fiches, dirigeants, CA
- **Datalegal.fr** → ALL companies where person is a dirigeant
- **BODACC** → Official announcements (creation, modification, radiation)
- **INPI** → Trademarks and patents filed by the person
- Scrape these pages with: `python {skill-dir}/osint/scripts/jina.py read <url>`

**Phase 2**: Platform Extraction
- Extract data from LinkedIn, Instagram, Facebook, TikTok, YouTube
- Use `python {skill-dir}/osint/scripts/apify.py linkedin <url>` or `instagram <handle>`
- Use `python {skill-dir}/osint/scripts/apify.py run <actor_id> '<json>'` for 55+ Apify actors
- Refer to `{skill-dir}/osint/references/platforms.md` for platform-specific guide
- Refer to `{skill-dir}/osint/references/tools.md` for full actor catalog

**Phase 2.5**: Contact Enrichment (for phone numbers and emails)
- **RocketReach** (rocketreach.co) — Search for target, check visible data (partial phone/email)
- **ContactOut** (contactout.com) — Check if profile exists with data preview
- **Kaspr** (kaspr.io) — Best for French mobile numbers via LinkedIn
- **Apollo.io** — 50 free credits/month, great for B2B enrichment
- **Hunter.io** — Email patterns for companies
- Use browser tool to visit these sites and extract visible information
- Refer to `{skill-dir}/osint/references/enrichment-databases-fr.md` for full list

**Phase 3**: Cross-Reference & Confidence Scoring
- Build fact table, cross-check key facts, resolve contradictions
- Assign confidence grades: A (3+ sources), B (2 sources), C (1 source), D (unverified)

**Phase 4**: Psychoprofile
- Build MBTI/Big Five analysis from content
- Refer to `{skill-dir}/osint/references/psychoprofile.md` for methodology
- Refer to `{skill-dir}/osint/references/content-extraction.md` for YouTube/podcast/blog extraction

**Phase 5**: Completeness Evaluation
- 9 mandatory checks + Depth Score 1-10
- Gap analysis and stopping criteria

**Phase 6**: Dossier Output
- For **personnes physiques**: Save to `{project-root}/recherches/personnes-physiques/<nom-prenom>.md`
- For **personnes morales**: Save to `{project-root}/recherches/personnes-morales/<nom-societe>.md`

### Step 4: Research Escalation
Always escalate from cheap to expensive:
- **Level 0** (FREE): Google dorks, Pappers, Societe.com, BODACC, INPI, Datalegal
- **Level 0.5** (FREE): RocketReach (5/mois), Kaspr (gratuit), Apollo (50/mois), ContactOut
- **Level 1** (~$0.01): Perplexity Sonar, Tavily, Exa, Jina search
- **Level 2** (~$0.01): Jina read, Parallel extract
- **Level 3** (~$0.01-0.10): Apify scrapers, Bright Data
- **Level 4** (~$0.05-0.50): Perplexity Deep, Exa Deep, Jina Deep

### Available Scripts (Python — stdlib only, zero dependencies)
All scripts in `{skill-dir}/osint/scripts/`, run with `python <script>`:

| Script | Usage |
|--------|-------|
| `diagnose.py` | Self-check of all available tools and API keys |
| `perplexity.py` | `search <q>`, `sonar <q>`, `deep <q>` |
| `tavily.py` | `search <q>`, `extract <url>`, `deep <q>` |
| `exa.py` | `search <q>`, `company <name>`, `people <name>`, `crawl <url>` |
| `jina.py` | `read <url>`, `search <query>`, `deepsearch <q>` |
| `parallel.py` | `search <q>`, `extract <url>`, `task <q>` |
| `apify.py` | `run <actor> <json>`, `linkedin <url>`, `instagram <handle>`, `results`, `store-search` |
| `brightdata.py` | `scrape <url>`, `search <q>`, `search-yandex <q>` |
| `volley.py` | `search "Name" "context"` (parallel) / `merge <outdir>` (dedup) |
| `mcp-client.py` | Lightweight MCP client for Bright Data |

### References
| File | Content |
|------|---------|
| `enrichment-databases-fr.md` | 🇫🇷 French registries, enrichment tools, Google dork templates |
| `platforms.md` | Social media extraction guides |
| `tools.md` | 55+ Apify actor catalog |
| `psychoprofile.md` | MBTI/Big Five methodology |
| `content-extraction.md` | YouTube/podcast/blog extraction |

### Environment Variables Required
```
JINA_API_KEY        — Jina reader/search (recommended first)
APIFY_API_TOKEN     — Apify scraping (55+ actors)
PERPLEXITY_API_KEY  — Perplexity Sonar
TAVILY_API_KEY      — Tavily search
EXA_API_KEY         — Exa AI
PARALLEL_API_KEY    — Parallel AI
BRIGHTDATA_MCP_URL  — Bright Data MCP
```

</investigation-activation>

## Rules
- ALWAYS run diagnose.py first to know what tools are available
- ALWAYS run Google dorks and French registries (Pappers, Societe.com) — they are FREE
- ALWAYS check enrichment databases (RocketReach, ContactOut) for phone numbers
- Spend ≤$0.50 without asking — ASK user permission above that
- Assign confidence grades to EVERY fact (A/B/C/D)
- Never fabricate data — only report verified findings
- Escalate from free→paid, fast→deep
- Save dossiers to `{project-root}/recherches/personnes-physiques/` or `personnes-morales/`
