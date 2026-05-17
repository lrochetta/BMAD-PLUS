# 📊 Pack Shield — Agent Detail Sheet
## Full inventory of the 41 agents with capabilities, triggers, and source mapping

---

## 🔐 Category 1: Information Security

### 1. ISO 27001 — ISMS Expert
- **Coverage**: ISO 27001:2022 (93 controls, 4 themes) + ISO 27001:2013 (114 controls, 14 domains)
- **Capabilities**:
  - Structured gap analyses against mandatory clauses (4–10) and all Annex A controls
  - Complete, audit-ready policy documents with document control blocks and clause-to-control mappings
  - Risk registers using likelihood × impact methodology
  - Statement of Applicability (SoA) templates covering all 93 controls
  - 2013 → 2022 transition guidance (11 new controls mapping)
- **Triggers**: ISO 27001, ISMS, Annex A, Statement of Applicability, SoA, gap analysis, risk register, certification readiness, internal audit
- **Source**: `ISO 27001 - Claude Skill/iso27001.skill`

### 2. SOC 2 — Trust Services Advisor
- **Coverage**: AICPA 2017 Trust Services Criteria (TSC) with 2022 Revised Points of Focus
- **TSC Scope**: Security (CC1–CC9), Availability (A1), Confidentiality (C1), Processing Integrity (PI1), Privacy (P1–P8)
- **Capabilities**:
  - Gap analyses with 🔴/🟡/🟢 status ratings and remediation roadmaps
  - All 12 core SOC 2 policies drafting
  - Auditor-ready control documentation (Control ID, TSC criterion, type, owner, frequency, evidence, test procedure)
  - Evidence checklists with sampling guidance for Type 1 vs Type 2 audits
  - Vendor risk management (tiering, 32-question questionnaire, SOC 2 report review, CUEC tracking)
  - Adapts tone: plain-language vs technical AICPA-coded output
- **Triggers**: SOC 2, Trust Services Criteria, TSC, CC6, Type 1, Type 2, AICPA, audit readiness, control statement, evidence

### 3. NIST CSF 2.0 — Cybersecurity Framework Expert
- **Coverage**: CSF 2.0 (Feb 2024) + CSF 1.1 (April 2018)
- **Functions**: Govern, Identify, Protect, Detect, Respond, Recover (6 functions)
- **Capabilities**:
  - Gap assessments across all 6 functions, categories, and subcategories
  - Organisational Profiles (Current and Target)
  - Implementation Tiers (1–4) assessment
  - 30/60/90-day phased implementation roadmaps
  - Cross-mapping to NIST SP 800-53, ISO 27001:2022, CIS Controls v8
  - CSF 1.1 → 2.0 migration guidance
- **Triggers**: NIST CSF, CSF 2.0, Govern function, cybersecurity profile, implementation tiers, CSF gap assessment

### 4. CIS Controls v8 — Cyber Hygiene
- **Coverage**: All 18 CIS Controls and 153 safeguards (May 2021)
- **IG Framework**: IG1 (56 safeguards), IG2 (130), IG3 (153)
- **Capabilities**:
  - Determines correct Implementation Group
  - Gap assessments across all 18 controls with IG assignment
  - Safeguard-level implementation guidance with tool recommendations
  - IG1 12-week quick-start programme
  - Cross-mapping to NIST CSF 2.0, ISO 27001:2022, CMMC 2.0, SOC 2, PCI DSS v4.0
  - Industry-specific guidance (healthcare, finance, government, education)
- **Triggers**: CIS Controls, CIS Top 18, CIS v8, Implementation Group, IG1/IG2/IG3

### 5. NIST SP 800-53 — Federal Security Controls
- **Coverage**: NIST SP 800-53 Rev 5, all 20 control families
- **Capabilities**:
  - Control family gap assessments
  - System security plan documentation
  - Control baselines (Low/Moderate/High)
  - Cross-mapping to FedRAMP, CMMC, ISO 27001
- **Triggers**: NIST 800-53, security controls, control family, federal systems, FedRAMP baseline

---

## 🇪🇺 Category 2: European Regulations

### 6. GDPR — Data Protection Expert
- **Coverage**: Full EU GDPR + UK GDPR (DPA 2018) differences
- **Capabilities**:
  - Code/API/DB/architecture audit for GDPR violations (🔴/🟡/🟢 findings with article citations)
  - Draft Privacy Notices (Art. 13/14), DPAs (Art. 28), DPIAs (Art. 35), Cookie Banners
  - Data flow reviews across 6 dimensions (what, why, where, who, how long, how protected)
  - Lawful basis analysis, data subject rights (Arts. 15–22), international transfers (Arts. 44–49)
  - Breach response (Arts. 32–34), special category data (Arts. 9–10)
- **Triggers**: GDPR, data protection, privacy, personal data, DPIA, lawful basis, consent, RoPA, Schrems II

### 7. DORA — Financial Operational Resilience
- **Coverage**: Regulation (EU) 2022/2554, all 64 articles, 12 adopted RTS/ITS
- **4 Pillars**: ICT risk management (Ch. II), incident management (Ch. III), resilience testing/TLPT (Ch. IV), ICT third-party risk (Ch. V)
- **Capabilities**:
  - Structured gap analyses across all 4 pillars
  - 3-stage incident reporting (initial 4h, intermediate 72h, final 1 month)
  - Art. 30(2) contractual provisions drafting
  - Register of Information per CIR (EU) 2024/2956
  - ICT concentration risk assessment
  - TLPT programme scoping
  - DORA vs NIS2 distinction
- **Triggers**: DORA, digital operational resilience, ICT risk management, Art. 17/18/19/26/28/30

### 8. NIS2 — Network & Information Security
- **Coverage**: Directive (EU) 2022/2555
- **Capabilities**:
  - Entity classification (Essential vs Important)
  - Art. 21 compliance across 10 cybersecurity measures
  - Art. 23 incident reporting workflow (24h → 72h → 1 month)
  - Art. 20 governance obligations
  - ISO 27001 gap analysis vs NIS2
  - DORA lex specialis interaction
  - Penalty calculation (EE: €10M/2%; IE: €7M/1.4%)
- **Triggers**: NIS2, essential entity, important entity, Art. 21/23, NIS2 penalties

### 9. CSRD — Sustainability Reporting
- **Coverage**: EU Directive 2022/2464, ESRS standards
- **Capabilities**:
  - CSRD scope determination across 4 cohorts (FY 2024–2028)
  - Double Materiality Assessment (DMA) step-by-step
  - ESRS disclosures drafting (ESRS 2, E1–E5, S1–S4, G1)
  - Scope 1/2/3 GHG emissions programmes
  - Assurance readiness (limited → reasonable)
  - XBRL/iXBRL digital tagging requirements
  - CSRD vs GRI/TCFD/SASB/CDP comparison
- **Triggers**: CSRD, ESRS, double materiality, ESG reporting, Scope 3

### 10–12. EU AI Act (3 agents)
- **Classifier**: Risk classification, Annex III assessment, Art. 6 exemptions
- **FRIA**: Art. 27 Fundamental Rights Impact Assessment
- **GPAI**: Art. 51-56 general-purpose AI obligations, Code of Practice

---

## 🇺🇸 Category 3: US Federal & State

### 13. FedRAMP — Federal Cloud Authorization
- **Coverage**: FedRAMP Rev 5, NIST 800-53
- **Capabilities**: 75+ item readiness checklist, ATO documentation, cloud architecture guidance (AWS/Azure/GCP GovCloud), ConMon, Rev 4→5 transition, OSCAL

### 14. HIPAA — Health Privacy
- **Coverage**: Privacy Rule, Security Rule, Breach Notification Rule (45 CFR Parts 160/164, HITECH)
- **Capabilities**: 54 Security Rule specifications, 9 templates (NPP, BAA, Auth Forms...), cloud environment guidance, breach 4-factor risk assessment

### 15. CMMC 2.0 — Defense Cybersecurity
- **Coverage**: 32 CFR Part 170 (Dec 2024), NIST SP 800-171/800-172
- **Capabilities**: Level determination, 110-practice gap assessment, SSP drafting, SPRS score calculation, POA&M lifecycle, C3PAO assessment prep

### 16. CCPA/CPRA — California Privacy
- **Coverage**: CCPA + CPRA (Prop 24), all consumer rights
- **Capabilities**: Business applicability determination, rights workflows, ad tech/cookie classification, SPI handling, GDPR-to-CCPA gap analysis

### 17. TSA Cybersecurity — Transport Security
- **Coverage**: SD Pipeline-2021-01G, SD 1580-21-01E, SD 1582-21-01E + 2024 NPRM
- **Note**: Built from publicly available summaries (SSI classified material excluded)

### 18. ITAR — Arms Export Controls
- **Coverage**: 22 CFR Parts 120–130 (DDTC/State Dept)
- **Capabilities**: USML jurisdiction analysis, DDTC registration, export licensing (DSP-5/73/94), TAA/MLA drafting, deemed export rules, VSD process

### 19. EAR — Export Administration Regulations
- **Coverage**: 15 CFR Parts 730–774 (BIS)
- **Capabilities**: ECCN classification, Commerce Country Chart analysis, licence exception selection, restricted party screening, FDPR rules, VSD, 7-element ECP design

### 20. Section 508 — Federal Accessibility
- **Coverage**: US federal ICT accessibility requirements
- **Capabilities**: Conformance assessment, VPAT documentation, remediation planning

---

## 🌏 Category 4: International Privacy & AI

### 21. ISO 27701 — Privacy Information Management
- **Coverage**: ISO/IEC 27701:2025 (standalone) + 2019 (extension), 78 Annex A controls
- **Capabilities**: PII controller + processor gap analysis, PIMS policies, privacy risk registers, cross-mapping to GDPR/CCPA/LGPD/PIPEDA/PDPA

### 22. DPDPA — India Data Protection
- **Coverage**: Act 2023 + DPDP Rules 2025, all 44 sections, 23 rules
- **Capabilities**: DPDPA vs GDPR comparison (8 dimensions), consent design, children's data (18+ threshold, DigiLocker), breach notification, SDF obligations

### 23. LGPD — Brazil Data Protection
- **Coverage**: Law 13,709/2018 + ANPD resolutions
- **Capabilities**: 10 legal bases analysis, DPIA/RIPD templates, breach notification (3 working days + 20 days), international transfers, LGPD vs GDPR comparison

### 24. ISO 42001 — AI Management System
- **Coverage**: ISO/IEC 42001:2023, all 38 Annex A controls (A.2–A.10)
- **Capabilities**: AISIA impact assessment, AI risk assessment (bias, drift, hallucination, adversarial), SoA for 38 controls, EU AI Act mapping, ISO 27001 integration

### 25. NIST AI RMF 1.0 — AI Risk Management
- **Coverage**: NIST AI 100-1, all 4 functions (GOVERN/MAP/MEASURE/MANAGE), 19 categories
- **Capabilities**: AI organizational profiles, bias/fairness testing, explainability (SHAP/LIME), adversarial robustness, AI risk registers, ISO 42001 and EU AI Act mapping

---

## 💳 Category 5: Industry-Specific

### 26. PCI DSS v4.0.1 — Payment Security
- **Coverage**: All 12 requirements, 8 SAQ types, v4.0 changes from v3.2.1
- **Capabilities**: CDE scoping, SAQ selection, gap assessments, v3.2.1→v4.0.1 migration, Defined vs Customised Approach

### 27. SWIFT CSP — Financial Messaging Security
- **Coverage**: CSCF v2025, 31 controls (23 mandatory + 8 advisory), 5 architecture types (A1/A2/A3/A4/B)
- **Capabilities**: Architecture determination, KYC-SA attestation, incident response, cross-mapping to ISO 27001/PCI DSS/NIST CSF

### 28. ISM — Australian Information Security
- **Coverage**: All 22 guideline chapters, 6-step risk management cycle, Essential Eight
- **Capabilities**: Control applicability marking, system authorisation pathway, IRAP assessment prep, Essential Eight ML0–ML3 maturity

---

## ♿ Category 6: Accessibility

### 29. WCAG — Web Accessibility
- **Coverage**: WCAG 2.x guidelines
- **Capabilities**: Conformance assessment, remediation guidance, audit reports

---

## 📋 Category 7: GDPR & AI Act Workflows (from Lawve AI inspiration)

### 30. DPIA Sentinel — Impact Assessment Workflow
- **Focus**: Art. 35 GDPR — Structured DPIA with AI-specific considerations
- **Unique value**: CNIL AI guidance integration (training data provenance, explainability limits, feedback loops, training vs inference distinction)

### 31. Breach Sentinel — 72h Response Workflow
- **Focus**: Art. 33/34 — Severity classification, notification determination, compliant document generation
- **Unique value**: AI-specific breach scenarios (model inversion, prompt injection, inference data leakage)

### 32. Legitimate Interest Assessment — LIA Workflow
- **Focus**: Art. 6(1)(f) — 3-part test (purpose, necessity, balancing)
- **Unique value**: AI-specific balancing considerations (training data expectations, model opacity, functional drift)

### 33. Privacy Compliance Advisor — Program Assessment
- **Focus**: General GDPR posture assessment
- **Unique value**: CEPD coordinated enforcement themes tracking

### 34. Privacy Notice Generator
- **Focus**: Art. 13/14 — All mandatory information categories
- **Unique value**: Art. 22 automated decision-making disclosures for AI systems

### 35. Privacy Policy Generator
- **Focus**: Full site/app privacy policies with Art. 12 plain-language requirement
- **Unique value**: CNIL-specific cookie/ePrivacy integration for French market

### 36. Cookie Policy Generator
- **Focus**: ePrivacy Directive + GDPR intersection
- **Unique value**: CNIL lignes directrices cookies compliance, technical inventory format

### 37–41. EU AI Act Workflows (5 agents)
- **Roles**: Role Determination → Obligations Mapper → Quick Assessment → High-Risk Readiness → Incident Reporting
- **Unique value**: Complete lifecycle from portfolio triage to ongoing incident management
