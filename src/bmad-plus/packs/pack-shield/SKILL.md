# Shield GRC Pack — SKILL

> **Pack:** Shield (GRC Audit)
> **Version:** 1.0.0
> **Created by:** Laurent Rochetta — https://github.com/lrochetta/BMAD-PLUS

## Overview

Shield transforms BMAD+ into a comprehensive GRC (Governance, Risk & Compliance) assistant. It serves as an intelligent orchestrator for 38 compliance agents across 7 categories, covering 25+ regulatory frameworks. Route requests to the appropriate specialist agent, combine insights for cross-framework analysis, and provide consolidated compliance reports.

## Capabilities

### Data Privacy (5 frameworks)
- **GDPR** (EU/EEA/UK) — General Data Protection Regulation
- **CCPA/CPRA** (California) — Consumer Privacy Act
- **LGPD** (Brazil) — Lei Geral de Protecao de Dados
- **DPDPA** (India) — Digital Personal Data Protection Act
- **ISO 27701** (International) — Privacy Information Management

### Cybersecurity (6 frameworks)
- **ISO 27001** — Information Security Management
- **NIST CSF 2.0** — Cybersecurity Framework
- **NIST 800-53 Rev. 5** — Federal Security Controls
- **CIS Controls v8** — Critical Security Controls
- **NIS2 Directive** — EU Cybersecurity
- **ISM** — Australian Information Security Manual

### Industry Compliance (6 frameworks)
- **SOC 2 Type I/II** — Service Organization Controls
- **PCI DSS v4.0** — Payment Card Industry
- **HIPAA** — Healthcare Privacy & Security
- **SWIFT CSP** — Banking Security
- **DORA** — EU Digital Operational Resilience
- **FedRAMP** — Federal Cloud Authorization

### Defense & Export Control (4 frameworks)
- **CMMC 2.0** — Cybersecurity Maturity Model Certification
- **ITAR** — International Traffic in Arms
- **EAR** — Export Administration Regulations
- **TSA** — Transportation Security Directives

### AI Governance (3 frameworks)
- **EU AI Act 2024/1689** — AI Regulation
- **ISO 42001:2023** — AI Management System
- **NIST AI RMF 1.0** — AI Risk Management

### Accessibility & ESG (3 frameworks)
- **WCAG 2.2** — Web Content Accessibility
- **Section 508** — US Federal Accessibility
- **CSRD** — Corporate Sustainability Reporting

### GDPR & AI Act Workflows (11 workflow agents)
- DPIA, Breach Response, Legitimate Interest Assessment
- Privacy Notice/Policy/Cookie Generators
- AI Act Classifier, Roles, FRIA, Incident Reporting

## Activation

To use Shield, include this pack in your BMAD+ installation:

```bash
npx bmad-plus install --pack shield
```

Then invoke the orchestrator from any conversation:

> "Shield, audit my app for GDPR compliance"
> "Shield, gap analysis ISO 27001 vs NIST CSF"
> "Shield, generate SOC 2 evidence checklist"

## Architecture

- `shield-orchestrator.md` — Intelligent routing entry point
- `categories/` — Framework-specific agent prompts
- `references/` — 85 regulatory reference files
- `shared/` — Cross-framework mapper, gap analysis & audit templates

## Attribution

Based on Claude Skills for GRC by Hemant Naik — MIT License.
GDPR and EU AI Act workflow agents enriched with insights from Lawve.ai.
Adapted for BMAD+ by Laurent Rochetta.
