# 🔄 Cross-Framework Control Mapper

> **Pack:** Shield (GRC Audit) — Shared Templates
> **Purpose:** Map controls between compliance frameworks to identify overlaps and gaps
> **Version:** 1.0.0

---

## How to Use

When performing a multi-framework compliance analysis, use this template to create a unified control mapping. This reveals:
- **Common controls** — implement once, satisfy multiple frameworks
- **Framework-specific requirements** — unique obligations per standard
- **Gap areas** — controls required by one framework but absent from another

---

## Common Framework Pairings

### Privacy Alignment Matrix
| Control Area | GDPR | CCPA/CPRA | LGPD | DPDPA | ISO 27701 |
|-------------|------|-----------|------|-------|-----------|
| Lawful basis | Art. 6 | N/A (no basis concept) | Art. 7 (10 bases) | Sec. 6-7 (2 bases) | Cl. 6.1 |
| Privacy notice | Art. 13-14 | §1798.100 | Art. 9 | Sec. 5 / Rule 3 | A.1.3.3 |
| Consent | Art. 7 | Opt-out model | Art. 8 | Sec. 6 | A.1.3.1 |
| Data subject rights | Art. 15-22 | §1798.100-125 | Art. 17-22 | Sec. 11-14 | A.1.3.5-11 |
| DPO/responsible | Art. 37-39 | N/A | Art. 41 | Sec. 10 (SDF only) | Cl. 5 |
| Breach notification | Art. 33-34 (72h) | §1798.150 (breach only) | Art. 48 (3 days) | Sec. 8 (72h) | A.3.11-12 |
| International transfer | Art. 44-49 | N/A | Art. 33-36 | Sec. 16 (blacklist) | A.1.5.2-5 |
| DPIA | Art. 35 | N/A (risk assessment CPRA) | Art. 38 | Sec. 10 (SDF) | A.1.2.6 |
| Penalties max | €20M / 4% | $7,500/violation | R$50M / 2% | ₹250 crore | N/A (cert) |

### Cybersecurity Triad
| Control Area | ISO 27001 (2022) | NIST CSF 2.0 | CIS Controls v8 |
|-------------|-----------------|-------------|-----------------|
| Risk assessment | Cl. 6.1 | GV.RM | IG1: 1.1 |
| Asset management | A.5.9-5.14 | ID.AM | CIS 1, 2 |
| Access control | A.5.15-5.18, A.8.2-8.5 | PR.AA | CIS 5, 6 |
| Awareness training | Cl. 7.2-7.3 | PR.AT | CIS 14 |
| Incident response | A.5.24-5.28 | RS.MA | CIS 17 |
| Logging/monitoring | A.8.15-8.16 | DE.CM | CIS 8 |
| Vulnerability management | A.8.8 | ID.RA | CIS 7 |
| Data protection | A.8.10-8.12 | PR.DS | CIS 3 |
| Configuration | A.8.9 | PR.PS | CIS 4 |
| Business continuity | A.5.29-5.30 | RC.RP | CIS 11 |

### US Federal Alignment
| Control Area | NIST 800-53 | FedRAMP | CMMC 2.0 |
|-------------|-------------|---------|----------|
| Access Control | AC family | AC (enhanced) | AC domain |
| Audit & Accountability | AU family | AU (enhanced) | AU domain |
| Configuration Management | CM family | CM (enhanced) | CM domain |
| Identification & Auth | IA family | IA (enhanced) | IA domain |
| Incident Response | IR family | IR (enhanced) | IR domain |
| Risk Assessment | RA family | RA (enhanced) | RA domain |
| System & Comms Protection | SC family | SC (enhanced) | SC domain |
| System & Info Integrity | SI family | SI (enhanced) | SI domain |

### AI Governance Triad
| Control Area | EU AI Act | ISO 42001 | NIST AI RMF |
|-------------|-----------|-----------|-------------|
| Risk classification | Art. 6, Annex III | Cl. 6.1 | MAP function |
| Data governance | Art. 10 | A.6.2.4 | MAP 2.3 |
| Transparency | Art. 13 | A.6.2.6 | GOVERN 1.7 |
| Human oversight | Art. 14 | A.6.2.5 | GOVERN 1.3 |
| Accuracy/robustness | Art. 15 | A.6.2.7 | MEASURE 2.x |
| Technical documentation | Art. 11, Annex IV | Cl. 7.5 | GOVERN 1.5 |
| Conformity assessment | Art. 43 | Certification | MANAGE function |
| Incident reporting | Art. 73 | A.6.2.8 | MANAGE 4.x |

---

## Mapping Output Format

When generating a cross-framework mapping, use this structure:

```markdown
## Cross-Framework Compliance Map

### Frameworks Analyzed
[List all frameworks with versions]

### Unified Control Matrix

| # | Control Area | [Framework A] | [Framework B] | [Framework C] | Implementation Status |
|---|-------------|--------------|--------------|--------------|----------------------|
| 1 | [Area] | [Ref] | [Ref] | [Ref] | ✅ / 🟡 / ❌ |

### Common Controls (Implement Once)
[List controls that satisfy 2+ frameworks simultaneously]

### Framework-Specific Requirements
[List unique requirements per framework]

### Recommended Implementation Order
[Priority-ranked list considering overlap maximization]
```

---

## Escalation

> When mapping complex multi-framework environments, recommend engaging a qualified compliance consultant who can validate the mappings against the organization's specific context.
