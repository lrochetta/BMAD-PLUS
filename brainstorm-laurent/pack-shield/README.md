# 🛡️ Pack Shield — Brainstorm & Architecture
## BMAD+ Governance, Risk & Compliance (GRC) Pack

> **Author**: Laurent Rochetta — github.com/lrochetta/BMAD-PLUS
> **Date**: 2026-05-17
> **Status**: Brainstorm / Pre-implementation
> **Source repo**: [Sushegaad/Claude-Skills-GRC](https://github.com/Sushegaad/Claude-Skills-Governance-Risk-and-Compliance) (MIT License, 439⭐, 116 commits)
> **Source version**: Latest as of 2026-05-17 (main branch)
> **Supplementary sources**: [Lawve AI GDPR Skills](https://lawve.ai/fr/guides/best-ai-skills-gdpr), [Lawve AI EU AI Act Skills](https://lawve.ai/fr/guides/best-ai-skills-eu-ai-act)

---

## 📋 Table of Contents

1. [Source Analysis](#source-analysis)
2. [Complete Agent Inventory](#complete-agent-inventory)
3. [Category Architecture](#category-architecture)
4. [Conversion Strategy](#conversion-strategy)
5. [Update Process](#update-process)
6. [Integration with BMAD+](#integration-with-bmad)
7. [Roadmap](#roadmap)

---

## 1. Source Analysis

### Sushegaad GRC Skills Repository

| Metric | Value |
|--------|-------|
| Stars | 439 |
| Forks | 93 |
| License | MIT |
| Total Skills | 26 |
| Format | `.skill` archives containing `SKILL.md` + reference materials |
| Benchmark | 96% accuracy (with skills) vs 82% (without) across 625 assertions |
| Coverage | 25+ regulatory frameworks worldwide |
| Last Update | Active (116 commits) |

**Architecture**: Each skill is a `.skill` file (ZIP archive) containing:
- `SKILL.md` — Primary instruction file (loaded into context on trigger)
- Reference files — Loaded on-demand for sub-topics ("progressive disclosure")
- Trigger phrases — Automatic activation based on conversation context

**Key Insight**: Skills are **prompt-engineering packages**, not code. They're essentially expert-level system prompts with structured reference knowledge. This maps perfectly to BMAD+ agent `.md` format.

### Lawve AI Skills (Supplementary)

| Source | Focus | Skills | Key Value |
|--------|-------|--------|-----------|
| Lawve GDPR | Data Protection | 7 | DPIA, breach response, privacy notices, LIA, cookies |
| Lawve EU AI Act | AI Regulation | 8 | System classification, FRIA, GPAI compliance, incident reporting |

**Key Insight**: Lawve skills are **more specialized and workflow-oriented** than the GRC repo. They focus on actionable compliance procedures (e.g., "72h breach notification workflow") rather than broad framework knowledge. Both approaches are complementary.

---

## 2. Complete Agent Inventory

### 2.1 — From Sushegaad GRC (26 agents)

| # | Agent ID | Framework | Region | File |
|---|----------|-----------|--------|------|
| 1 | `iso-27001` | ISO 27001 — Information Security | 🌍 Global | `iso27001.skill` |
| 2 | `soc-2` | SOC 2 — Trust Services | 🇺🇸 US | `soc2.skill` |
| 3 | `fedramp` | FedRAMP — Federal Cloud Auth | 🇺🇸 US | `fedramp.skill` |
| 4 | `gdpr` | GDPR — General Data Protection | 🇪🇺 EU | `gdpr-compliance.skill` |
| 5 | `hipaa` | HIPAA — Health Info Privacy | 🇺🇸 US | `hipaa-compliance.skill` |
| 6 | `nist-csf` | NIST CSF 2.0 — Cyber Framework | 🌍 Global | `NIST Cybersecurity.skill` |
| 7 | `pci-dss` | PCI DSS v4.0.1 — Payment Security | 🌍 Global | `PCI-Compliance.skill` |
| 8 | `tsa-cyber` | TSA Cybersecurity — Transport Security | 🇺🇸 US | `TSA-Compliance.skill` |
| 9 | `iso-42001` | ISO 42001 — AI Management System | 🌍 Global | `ISO-42001.skill` |
| 10 | `iso-27701` | ISO 27701 — Privacy Information Mgmt | 🌍 Global | `iso27701.skill` |
| 11 | `dora` | DORA — Digital Operational Resilience | 🇪🇺 EU | `dora.skill` |
| 12 | `dpdpa` | DPDPA — Digital Personal Data Protection | 🇮🇳 India | `dpdpa.skill` |
| 13 | `cmmc` | CMMC 2.0 — Cyber Maturity Model | 🇺🇸 US | `cmmc.skill` |
| 14 | `nist-ai-rmf` | NIST AI RMF 1.0 — AI Risk Mgmt | 🌍 Global | `nist-ai-rmf.skill` |
| 15 | `swift-csp` | SWIFT CSP — Customer Security | 🌍 Global | `swift-csp.skill` |
| 16 | `ism` | ISM — Australian Info Security | 🇦🇺 Australia | `ism.skill` |
| 17 | `nis2` | NIS2 — Network & Info Security | 🇪🇺 EU | `nis2.skill` |
| 18 | `ccpa` | CCPA/CPRA — California Privacy | 🇺🇸 US | `ccpa.skill` |
| 19 | `itar` | ITAR — Arms Export Controls | 🇺🇸 US | `itar.skill` |
| 20 | `lgpd` | LGPD — Brazil Data Protection | 🇧🇷 Brazil | `lgpd.skill` |
| 21 | `csrd` | CSRD — EU Sustainability Reporting | 🇪🇺 EU | `csrd.skill` |
| 22 | `cis-controls` | CIS Controls v8 — Cyber Hygiene | 🌍 Global | `cis-controls.skill` |
| 23 | `ear` | EAR — Export Admin Regulations | 🇺🇸 US | `ear.skill` |
| 24 | `nist-800-53` | NIST SP 800-53 — Federal Security | 🇺🇸 US | `nist-800-53.skill` |
| 25 | `section-508` | Section 508 — US Federal Accessibility | 🇺🇸 US | `section-508.skill` |
| 26 | `wcag` | WCAG — Web Accessibility Guidelines | 🌍 Global | `wcag.skill` |

### 2.2 — From Lawve AI (15 supplementary skills)

#### GDPR Workflow Skills (7)

| # | Agent ID | Skill | Author | Focus |
|---|----------|-------|--------|-------|
| 27 | `dpia-sentinel` | DPIA Sentinel | Oliver Schmidt-Prietz | Art. 35 — Impact assessments with AI-specific considerations |
| 28 | `breach-sentinel` | GDPR Breach Sentinel | Oliver Schmidt-Prietz | Art. 33/34 — 72h breach notification workflow |
| 29 | `legitimate-interest` | Legitimate Interest Assessment | Oliver Schmidt-Prietz | Art. 6(1)(f) — 3-part LIA test |
| 30 | `privacy-advisor` | Privacy Compliance Advisor | Anthropic | General GDPR program assessment |
| 31 | `privacy-notice` | Privacy Notice Generator | Oliver Schmidt-Prietz | Art. 13/14 — Compliant notices with AI disclosure |
| 32 | `privacy-policy` | Privacy Policy Generator | Malik Taiar | Full privacy policies for sites/apps |
| 33 | `cookie-policy` | Cookie Policy Generator | Malik Taiar | ePrivacy + GDPR cookie compliance |

#### EU AI Act Workflow Skills (8)

| # | Agent ID | Skill | Author | Focus |
|---|----------|-------|--------|-------|
| 34 | `ai-act-classifier` | System Classifier | Oliver Schmidt-Prietz | Risk classification (forbidden/high/limited/minimal) |
| 35 | `ai-act-roles` | Role Determination | Oliver Schmidt-Prietz | Provider/deployer/importer/distributor mapping |
| 36 | `ai-act-obligations` | Obligations Mapper | Oliver Schmidt-Prietz | Full obligation register per role × risk level |
| 37 | `ai-act-triage` | Quick Assessment | Oliver Schmidt-Prietz | Fast portfolio screening |
| 38 | `ai-act-readiness` | High-Risk Implementation | Werner Plutat | Art. 9-15 readiness assessment |
| 39 | `ai-act-fria` | FRIA | Werner Plutat | Art. 27 Fundamental Rights Impact Assessment |
| 40 | `ai-act-gpai` | GPAI Code of Practice | Werner Plutat | Art. 51-56 general-purpose AI compliance |
| 41 | `ai-act-incidents` | Serious Incident Reporting | Werner Plutat | Art. 73 incident reporting |

**Total: 41 potential agents**

---

## 3. Category Architecture

### Proposed Modular Installation Categories

```
Pack Shield — Governance, Risk & Compliance
│
├── 🔐 Category 1: Information Security (5 agents)
│   ├── iso-27001        — ISO 27001 ISMS Expert
│   ├── soc-2            — SOC 2 Trust Services Advisor
│   ├── nist-csf         — NIST CSF 2.0 Framework Expert
│   ├── cis-controls     — CIS Controls v8 Cyber Hygiene
│   └── nist-800-53      — NIST SP 800-53 Federal Security
│
├── 🇪🇺 Category 2: European Regulations (7 agents)
│   ├── gdpr             — GDPR Compliance Expert
│   ├── dora             — DORA Financial Resilience
│   ├── nis2             — NIS2 Cybersecurity Directive
│   ├── csrd             — CSRD Sustainability Reporting
│   ├── ai-act-classifier — EU AI Act System Classifier
│   ├── ai-act-fria      — FRIA Impact Assessment
│   └── ai-act-gpai      — GPAI Compliance
│
├── 🇺🇸 Category 3: US Federal & State (8 agents)
│   ├── fedramp          — FedRAMP Cloud Authorization
│   ├── hipaa            — HIPAA Health Privacy
│   ├── cmmc             — CMMC 2.0 Defense Contractors
│   ├── ccpa             — CCPA/CPRA California Privacy
│   ├── tsa-cyber        — TSA Transport Cybersecurity
│   ├── itar             — ITAR Arms Export Controls
│   ├── ear              — EAR Dual-Use Export Controls
│   └── section-508      — Section 508 Accessibility
│
├── 🌏 Category 4: International Privacy (5 agents)
│   ├── iso-27701        — ISO 27701 Privacy Information Mgmt
│   ├── dpdpa            — India DPDPA
│   ├── lgpd             — Brazil LGPD
│   ├── iso-42001        — ISO 42001 AI Management
│   └── nist-ai-rmf      — NIST AI Risk Management
│
├── 💳 Category 5: Industry-Specific (3 agents)
│   ├── pci-dss          — PCI DSS Payment Security
│   ├── swift-csp        — SWIFT Financial Messaging
│   └── ism              — Australian ISM
│
├── ♿ Category 6: Accessibility (2 agents)
│   ├── wcag             — WCAG Web Accessibility
│   └── section-508      — (cross-ref from US Federal)
│
└── 📋 Category 7: GDPR & AI Act Workflows (11 agents)
    ├── dpia-sentinel     — DPIA Impact Assessment
    ├── breach-sentinel   — Breach 72h Response
    ├── legitimate-interest — LIA 3-Part Test
    ├── privacy-advisor   — GDPR Program Assessment
    ├── privacy-notice    — Privacy Notice Generator
    ├── privacy-policy    — Privacy Policy Generator
    ├── cookie-policy     — Cookie Policy Generator
    ├── ai-act-roles      — AI Act Role Mapping
    ├── ai-act-obligations — AI Act Obligations Register
    ├── ai-act-triage     — AI Act Quick Assessment
    └── ai-act-incidents  — AI Act Incident Reporting
```

### Orchestrator Agent: `shield-commander`

A meta-agent that:
1. **Triages** user queries to the correct specialist agent(s)
2. **Cross-references** frameworks (e.g., "GDPR + NIS2 overlap for this scenario")
3. **Produces composite audits** spanning multiple frameworks
4. **Tracks compliance status** across installed agents

---

## 4. Conversion Strategy

### From Claude `.skill` to BMAD+ `.md`

| Aspect | Claude `.skill` | BMAD+ `.md` |
|--------|----------------|--------------|
| Format | ZIP archive containing SKILL.md + refs | Single `.md` agent file |
| Activation | Auto-trigger on keyword match | Explicit agent activation via BMAD menu |
| Context | Progressive disclosure (load refs on demand) | Full agent prompt (entire file in context) |
| LLM Lock-in | Claude-specific | LLM-agnostic (any model) |
| Metadata | None | YAML frontmatter (version, source, category) |

### Conversion Template

```markdown
---
# BMAD+ Agent Metadata
id: "shield-{framework-id}"
name: "{Framework Name} Compliance Expert"
pack: "shield"
category: "{category-name}"
version: "1.0.0"
source: "Sushegaad/Claude-Skills-GRC"
source_version: "{commit hash at conversion time}"
source_license: "MIT"
adapted_by: "Laurent Rochetta"
adapted_date: "2026-05-17"
triggers:
  - "{keyword1}"
  - "{keyword2}"
---

# 🛡️ {Framework Name} — Compliance Expert

## Identity
You are a {Framework Name} compliance expert agent within BMAD+.
{Adapted role description from SKILL.md}

## Capabilities
{Structured list from original "What it does" section}

## Knowledge Base
{Regulatory reference material, version info, article citations}

## Output Formats
{Standard templates: gap analysis, policy draft, risk register, etc.}

## Activation Triggers
{Keyword list for the orchestrator}

## Limitations & Disclaimers
{Legal disclaimer — not legal advice, professional review required}
```

### Key Adaptation Principles

1. **Remove Claude-specific syntax** — No `<skill>` tags, no Claude plugin format
2. **Add BMAD+ metadata** — YAML frontmatter with version tracking
3. **Preserve all knowledge** — Every article citation, every template, every checklist
4. **Add cross-references** — Link to related BMAD+ agents (e.g., GDPR ↔ DPIA Sentinel)
5. **Standardize output** — Consistent formatting across all agents (📊 gap analysis, 📝 policy, ⚠️ findings)

---

## 5. Update Process

### Tracking Upstream Changes

```
upstream/
├── sushegaad-grc/          # Git subtree or submodule
│   ├── .git-upstream-hash  # Last synced commit
│   └── ...skills
├── lawve-gdpr/             # Documented skill versions
│   └── .version-manifest
└── SYNC-LOG.md             # Human-readable sync history
```

### Update Workflow

1. **Check upstream** — `git log --oneline upstream/main..HEAD` or compare commit hashes
2. **Diff extraction** — Extract changed `.skill` files, diff SKILL.md contents
3. **Delta conversion** — Apply changes to BMAD+ `.md` agents
4. **Version bump** — Update agent `source_version` in frontmatter
5. **Test** — Run agent through standard compliance scenario
6. **Document** — Update SYNC-LOG.md with changes

### Automated Tracking (Future)

```yaml
# upstream-watch.yaml (GitHub Action)
name: Track GRC Upstream
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly
jobs:
  check-upstream:
    steps:
      - name: Compare commits
        run: |
          LATEST=$(curl -s https://api.github.com/repos/Sushegaad/Claude-Skills-GRC/commits/main | jq -r .sha)
          CURRENT=$(cat .git-upstream-hash)
          if [ "$LATEST" != "$CURRENT" ]; then
            # Create issue with diff summary
          fi
```

---

## 6. Integration with BMAD+

### File Structure

```
src/bmad-plus/packs/pack-shield/
├── README.md                    # Pack documentation
├── shield-commander.md          # Orchestrator agent
├── agents/
│   ├── info-security/
│   │   ├── iso-27001.md
│   │   ├── soc-2.md
│   │   ├── nist-csf.md
│   │   ├── cis-controls.md
│   │   └── nist-800-53.md
│   ├── european-regulations/
│   │   ├── gdpr.md
│   │   ├── dora.md
│   │   ├── nis2.md
│   │   ├── csrd.md
│   │   ├── ai-act-classifier.md
│   │   ├── ai-act-fria.md
│   │   └── ai-act-gpai.md
│   ├── us-federal/
│   │   ├── fedramp.md
│   │   ├── hipaa.md
│   │   ├── cmmc.md
│   │   ├── ccpa.md
│   │   ├── tsa-cyber.md
│   │   ├── itar.md
│   │   ├── ear.md
│   │   └── section-508.md
│   ├── international-privacy/
│   │   ├── iso-27701.md
│   │   ├── dpdpa.md
│   │   ├── lgpd.md
│   │   ├── iso-42001.md
│   │   └── nist-ai-rmf.md
│   ├── industry/
│   │   ├── pci-dss.md
│   │   ├── swift-csp.md
│   │   └── ism.md
│   ├── accessibility/
│   │   └── wcag.md
│   └── workflows/
│       ├── dpia-sentinel.md
│       ├── breach-sentinel.md
│       ├── legitimate-interest.md
│       ├── privacy-advisor.md
│       ├── privacy-notice.md
│       ├── privacy-policy.md
│       ├── cookie-policy.md
│       ├── ai-act-roles.md
│       ├── ai-act-obligations.md
│       ├── ai-act-triage.md
│       └── ai-act-incidents.md
├── data/
│   ├── framework-matrix.yaml   # Cross-reference mappings
│   └── triggers.yaml           # All trigger phrases
└── upstream/
    ├── SYNC-LOG.md
    └── .git-upstream-hash
```

### module.yaml Integration

```yaml
shield:
  name: "Shield — GRC Compliance"
  icon: "🛡️"
  description: "41 compliance agents covering 25+ frameworks (ISO, NIST, GDPR, HIPAA, SOC 2, PCI DSS, EU AI Act...)"
  required: false
  packDir: pack-shield
  categories:
    - id: info-security
      name: "Information Security"
      icon: "🔐"
      agents: [iso-27001, soc-2, nist-csf, cis-controls, nist-800-53]
    - id: european-regulations
      name: "European Regulations"
      icon: "🇪🇺"
      agents: [gdpr, dora, nis2, csrd, ai-act-classifier, ai-act-fria, ai-act-gpai]
    - id: us-federal
      name: "US Federal & State"
      icon: "🇺🇸"
      agents: [fedramp, hipaa, cmmc, ccpa, tsa-cyber, itar, ear, section-508]
    - id: international-privacy
      name: "International Privacy & AI"
      icon: "🌏"
      agents: [iso-27701, dpdpa, lgpd, iso-42001, nist-ai-rmf]
    - id: industry
      name: "Industry-Specific"
      icon: "💳"
      agents: [pci-dss, swift-csp, ism]
    - id: accessibility
      name: "Accessibility"
      icon: "♿"
      agents: [wcag]
    - id: workflows
      name: "GDPR & AI Act Workflows"
      icon: "📋"
      agents: [dpia-sentinel, breach-sentinel, legitimate-interest, privacy-advisor, privacy-notice, privacy-policy, cookie-policy, ai-act-roles, ai-act-obligations, ai-act-triage, ai-act-incidents]
  orchestrator: shield-commander
```

### CLI Install Experience

```
┌  BMAD+ Installer v0.5.0
│
◇  Packs sélectionnés: Core, Shield
│
◆  🛡️ Shield — Catégories de conformité à installer :
│  ◻ 🔐 Sécurité de l'information (5 agents) — ISO 27001, SOC 2, NIST CSF, CIS, NIST 800-53
│  ◻ 🇪🇺 Réglementations européennes (7 agents) — RGPD, DORA, NIS2, CSRD, EU AI Act
│  ◻ 🇺🇸 US Fédéral & État (8 agents) — FedRAMP, HIPAA, CMMC, CCPA, TSA, ITAR, EAR, 508
│  ◻ 🌏 International Privacy & IA (5 agents) — ISO 27701, DPDPA, LGPD, ISO 42001, NIST AI
│  ◻ 💳 Sectoriels (3 agents) — PCI DSS, SWIFT CSP, ISM
│  ◻ ♿ Accessibilité (1 agent) — WCAG
│  ◻ 📋 Workflows RGPD & AI Act (11 agents) — AIPD, Breach, LIA, Privacy, Cookies...
│
│  [Tout sélectionner] [Continuer]
```

---

## 7. Roadmap

### Phase 1 — Foundation (v0.5.0)
- [ ] Clone upstream repo as reference
- [ ] Convert top 10 most-used skills (ISO 27001, GDPR, SOC 2, HIPAA, NIST CSF, PCI DSS, EU AI Act classifier, DPIA, NIS2, CCPA)
- [ ] Build `shield-commander` orchestrator
- [ ] Update `module.yaml` and CLI installer with category selection
- [ ] i18n: descriptive text for 10 languages

### Phase 2 — Full Coverage (v0.6.0)
- [ ] Convert remaining 31 agents
- [ ] Add cross-framework mapping data (`framework-matrix.yaml`)
- [ ] Add workflow agents (breach response, privacy notices, etc.)
- [ ] Implement upstream tracking with SYNC-LOG.md

### Phase 3 — Intelligence (v0.7.0)
- [ ] Shield Commander enhanced: composite multi-framework audits
- [ ] Auto-trigger based on project context (detect `.env`, `docker-compose`, cloud configs)
- [ ] Report generation (PDF-ready compliance reports)
- [ ] Framework overlap detection and deduplication

---

## Attribution & Licensing

| Source | License | Attribution |
|--------|---------|-------------|
| Sushegaad GRC Skills | MIT | Credit in agent frontmatter + README |
| Lawve AI Skills | Public guides (skill concepts) | Documented as inspiration, content rewritten |
| BMAD+ Adaptation | MIT | Laurent Rochetta |

The Lawve AI skills are referenced as **design inspiration and workflow patterns**. The actual agent content is written specifically for BMAD+ based on the regulatory frameworks themselves, not copied from Lawve's proprietary skill files.
