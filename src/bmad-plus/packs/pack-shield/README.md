# 🛡️ Pack Shield — GRC Compliance Agents

> **38 expert compliance agents** + 1 orchestrator covering Data Privacy, Cybersecurity, Industry Compliance, Defense & Export, AI Governance, Accessibility & ESG, and GDPR/AI Act Workflows.

## Overview

Pack Shield transforms BMAD+ into a comprehensive GRC (Governance, Risk & Compliance) assistant. Each agent is an expert system prompt for a specific regulatory framework, providing structured compliance guidance including gap analysis, policy drafting, control mapping, and audit support.

**Key Features:**
- 🧠 **Shield Orchestrator** — Intelligent routing to the right compliance agent
- 🔄 **Cross-Framework Mapping** — Identify control overlaps between frameworks
- 📊 **Standardized Templates** — Gap analysis and audit reports
- 🌍 **Multi-LLM Compatible** — Standard `.md` format works with any LLM
- 📦 **Modular Installation** — Install by category or individual agent
- 📁 **85 Reference Files** — Deep regulatory knowledge from upstream sources

## Categories

### 🔐 Data Privacy (5 agents)
| Agent | Framework | Jurisdiction |
|-------|-----------|-------------|
| `gdpr-agent` | GDPR (EU) 2016/679 | EU/EEA/UK |
| `ccpa-agent` | CCPA / CPRA | California |
| `lgpd-agent` | LGPD | Brazil |
| `dpdpa-agent` | DPDPA 2023 | India |
| `iso27701-agent` | ISO 27701 PIMS | International |

### 🛡️ Cybersecurity (6 agents)
| Agent | Framework | Jurisdiction |
|-------|-----------|-------------|
| `iso27001-agent` | ISO 27001:2022 | International |
| `nist-csf-agent` | NIST CSF 2.0 | US/Global |
| `nist-800-53-agent` | NIST 800-53 Rev. 5 | US Federal |
| `cis-controls-agent` | CIS Controls v8 | International |
| `nis2-agent` | NIS2 Directive | EU |
| `ism-agent` | ISM | Australia |

### 🏢 Industry Compliance (6 agents)
| Agent | Framework | Jurisdiction |
|-------|-----------|-------------|
| `soc2-agent` | SOC 2 Type I/II | US/Global |
| `pci-dss-agent` | PCI DSS v4.0 | International |
| `hipaa-agent` | HIPAA | US Healthcare |
| `swift-csp-agent` | SWIFT CSP | Intl. Banking |
| `dora-agent` | DORA | EU Financial |
| `fedramp-agent` | FedRAMP | US Federal |

### 🔒 Defense & Export (4 agents)
| Agent | Framework | Jurisdiction |
|-------|-----------|-------------|
| `cmmc-agent` | CMMC 2.0 | US Defense |
| `itar-agent` | ITAR | US Arms Export |
| `ear-agent` | EAR | US Commerce |
| `tsa-agent` | TSA Directives | US Transport |

### 🤖 AI Governance (3 agents)
| Agent | Framework | Jurisdiction |
|-------|-----------|-------------|
| `eu-ai-act-agent` | EU AI Act 2024/1689 | EU |
| `iso42001-agent` | ISO 42001:2023 | International |
| `nist-ai-rmf-agent` | NIST AI RMF 1.0 | US/Global |

### ♿ Accessibility & ESG (3 agents)
| Agent | Framework | Jurisdiction |
|-------|-----------|-------------|
| `wcag-agent` | WCAG 2.2 | International |
| `section508-agent` | Section 508 | US Federal |
| `csrd-agent` | CSRD | EU |

### 📋 GDPR & AI Act Workflows (11 agents)
| Agent | Workflow | Focus |
|-------|---------|-------|
| `dpia-sentinel` | DPIA Impact Assessment | Art. 35 GDPR — AI-specific considerations |
| `breach-sentinel` | Breach 72h Response | Art. 33/34 — Severity classification, notifications |
| `legitimate-interest` | LIA Three-Part Test | Art. 6(1)(f) — Purpose, necessity, balancing |
| `privacy-advisor` | Program Assessment | Overall GDPR posture evaluation |
| `privacy-notice-gen` | Privacy Notice Generator | Art. 13/14 mandatory elements |
| `privacy-policy-gen` | Privacy Policy Generator | Full site/app policies |
| `cookie-policy-gen` | Cookie Policy Generator | ePrivacy + GDPR, CNIL guidance |
| `ai-act-classifier` | AI System Classifier | Risk classification (forbidden/high/limited/minimal) |
| `ai-act-roles` | Role Determination | Provider/deployer/importer obligations mapping |
| `ai-act-fria` | FRIA Assessment | Art. 27 — Fundamental Rights Impact |
| `ai-act-incidents` | Incident Reporting | Art. 73 — Serious incident workflow |

## Shared Resources
- `shared/cross-framework-mapper.md` — Control mapping between frameworks
- `shared/gap-analysis-template.md` — Standardized gap analysis format
- `shared/audit-report-template.md` — Compliance audit report format

## Reference Files
- `references/` — 85 regulatory reference files extracted from upstream skills
- Organized by framework (gdpr-compliance, iso27001, soc2, etc.)
- Contains templates, control mappings, article references, and compliance programs

## Attribution

Based on [Claude Skills for GRC](https://github.com/Sushegaad/Claude-Skills-Governance-Risk-and-Compliance) by Hemant Naik — MIT License.

GDPR and EU AI Act workflow agents enriched with architectural insights from [Lawve.ai](https://lawve.ai) professional skills catalog.

Adapted for BMAD+ by [Laurent Rochetta](https://github.com/lrochetta/BMAD-PLUS).

## Upstream Sync

See `upstream-sync.yaml` for the complete skill-to-agent mapping and sync configuration.

```bash
# Future: check for upstream updates
npx bmad-plus shield:sync
```
