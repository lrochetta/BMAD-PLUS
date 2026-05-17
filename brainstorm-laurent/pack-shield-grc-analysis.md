# 🛡️ Pack Shield (Audit GRC) — Brainstorm Laurent

> **Date :** 2026-05-17
> **Auteur :** Laurent Rochetta / Forge (BMAD+)
> **Source :** [Sushegaad/Claude-Skills-Governance-Risk-and-Compliance](https://github.com/Sushegaad/Claude-Skills-Governance-Risk-and-Compliance)
> **Commit SHA :** `9dc17ada525ef2c3c89833e53ac574ce2f0d0fd8` (main)
> **Licence upstream :** MIT (Hemant Naik, 2026) — ✅ libre d'adapter, modifier, redistribuer

---

## 1. Analyse du Projet Source

### 1.1 Vue d'ensemble

Le projet est une collection de **26 "Claude Skills"** (.skill files) couvrant le domaine GRC (Governance, Risk & Compliance). Chaque skill est un fichier `.skill` contenant un `SKILL.md` structuré — un prompt système expert complet pour un framework de conformité spécifique.

**Benchmark :** 96% (avec skills) vs 82% (sans skills) sur 125 cas de test (625 assertions totales).

### 1.2 Inventaire complet des 26 Skills

| # | Skill | Fichier `.skill` | Taille | Domaine |
|---|-------|-------------------|--------|---------|
| 1 | **ISO 27001** | `iso27001.skill` | 12KB | Sécurité Info |
| 2 | **SOC 2** | `soc2.skill` | 23KB | Audit/Trust |
| 3 | **FedRAMP** | `fedramp.skill` | 26KB | Cloud Gov US |
| 4 | **GDPR** | `gdpr-compliance.skill` | 13KB | Privacy EU |
| 5 | **HIPAA** | `hipaa-compliance.skill` | 27KB | Santé US |
| 6 | **NIST CSF** | `NIST Cybersecurity.skill` | 17KB | Cyber Framework |
| 7 | **PCI DSS** | `PCI-Compliance.skill` | 23KB | Paiement |
| 8 | **TSA Compliance** | `TSA-Compliance.skill` | 23KB | Transport US |
| 9 | **ISO 42001** | `ISO-42001.skill` | 22KB | AI Management |
| 10 | **ISO 27701** | `iso27701.skill` | 21KB | Privacy ISMS |
| 11 | **DORA** | `dora.skill` | 33KB | Résilience Finance EU |
| 12 | **DPDPA** | `dpdpa.skill` | 42KB | Privacy Inde |
| 13 | **CMMC 2.0** | `cmmc.skill` | 15KB | Cyber Defense US |
| 14 | **NIST AI RMF** | `nist-ai-rmf.skill` | 14KB | AI Risk |
| 15 | **SWIFT CSP** | `swift-csp.skill` | 16KB | Banking |
| 16 | **ISM** | `ism.skill` | 12KB | Sécurité Australie |
| 17 | **NIS2** | `nis2.skill` | 9KB | Cyber EU |
| 18 | **CCPA/CPRA** | `ccpa.skill` | 11KB | Privacy Californie |
| 19 | **ITAR** | `itar.skill` | 14KB | Export Arms US |
| 20 | **LGPD** | `lgpd.skill` | 19KB | Privacy Brésil |
| 21 | **CSRD** | `csrd.skill` | 23KB | ESG/Durabilité EU |
| 22 | **CIS Controls** | `cis-controls.skill` | 20KB | Cyber Hygiene |
| 23 | **EAR** | `ear.skill` | 22KB | Export Control US |
| 24 | **NIST 800-53** | `nist-800-53.skill` | 22KB | Federal Security |
| 25 | **Section 508** | `section-508.skill` | 10KB | Accessibilité US |
| 26 | **WCAG** | `wcag.skill` | 18KB | Accessibilité Web |

**Total contenu utile : ~500KB+ de prompts experts structurés**

### 1.3 Structure d'un `.skill` file

Chaque fichier `.skill` contient un `SKILL.md` avec :
- **Identity/Role** — Persona expert (ex: "Senior GDPR Compliance Advisor")
- **Knowledge Base** — Connaissances spécifiques (articles, clauses, contrôles)
- **Decision Trees** — Arbres de décision structurés
- **Output Templates** — Templates de sortie (policies, gap analysis, risk registers)
- **Trigger Phrases** — Mots-clés d'activation automatique
- **Progressive Disclosure** — Chargement conditionnel de sous-modules

### 1.4 Éléments annexes

- **READMEs individuels** — 1 README par skill (~10-16KB chacun) avec use cases, exemples, FAQ
- **grc-workspace/** — Résultats d'évaluation (125 tests, with/without skill comparison)
- **plugins/** et **tests/** — Infrastructure de test
- **`.claude-plugin/marketplace.json`** — Métadonnées pour le Claude Code Marketplace

### 1.5 Format interne d'un SKILL.md (post-extraction ZIP)

Chaque `.skill` est un **fichier ZIP** renommé contenant un dossier avec un `SKILL.md` et parfois un sous-dossier `references/`. Voici la structure type extraite du GDPR skill (9 474 octets) :

```markdown
---
name: gdpr-compliance
description: >
  Expert GDPR compliance assistant covering all four core workflows...
---

# GDPR Compliance Skill

You are a GDPR compliance expert combining deep legal knowledge...

## Core Principles
- Always cite articles...
- Dual audience...

## Workflow 1: Code & System Audit
### Step 1 — Identify Personal Data
### Step 2 — Assess Lawful Basis
### Step 3 — Data Minimisation & Purpose Limitation
### Step 4 — Security & Technical Measures
### Step 5 — Retention & Deletion
### Step 6 — Third Parties & Transfers
### Audit Output Format (with severity table)

## Workflow 2: Document Drafting
## Workflow 3: Compliance Q&A
## Workflow 4: Data Flow & PII Review
## Escalation & Caveats
```

**Observations clés :**
- YAML frontmatter avec `name` et `description` (+ trigger patterns)
- Structure en **workflows numérotés** avec steps
- **Output templates** intégrés (tableaux markdown pour rapports)
- **Article citations** systématiques (Art. 4, Art. 6, Art. 32...)
- **Disclaimer légal** standardisé en fin de fichier

### 1.6 Tailles réelles des SKILL.md extraits

| Skill | Taille SKILL.md | Complexité |
|-------|----------------|------------|
| **DPDPA** | 26 877 octets | ⬛⬛⬛⬛⬛ Très détaillé |
| **DORA** | 26 007 octets | ⬛⬛⬛⬛⬛ |
| **TSA** | 21 608 octets | ⬛⬛⬛⬛ |
| **CIS Controls** | 16 651 octets | ⬛⬛⬛⬛ |
| **WCAG** | 16 671 octets | ⬛⬛⬛⬛ |
| **ISO 27701** | 16 585 octets | ⬛⬛⬛⬛ |
| **ISO 42001** | 14 688 octets | ⬛⬛⬛ |
| **PCI DSS** | 13 672 octets | ⬛⬛⬛ |
| **LGPD** | 13 314 octets | ⬛⬛⬛ |
| **CSRD** | 13 320 octets | ⬛⬛⬛ |
| **FedRAMP** | 12 971 octets | ⬛⬛⬛ |
| **EAR** | 12 908 octets | ⬛⬛⬛ |
| **NIST 800-53** | 12 849 octets | ⬛⬛⬛ |
| **NIST CSF** | 12 426 octets | ⬛⬛⬛ |
| **Section 508** | 11 334 octets | ⬛⬛⬛ |
| **SOC 2** | 10 805 octets | ⬛⬛ |
| **ITAR** | 10 204 octets | ⬛⬛ |
| **GDPR** | 9 474 octets | ⬛⬛ |
| **SWIFT CSP** | 9 085 octets | ⬛⬛ |
| **ISM** | 7 967 octets | ⬛⬛ |
| **ISO 27001** | 7 975 octets | ⬛⬛ |
| **CCPA** | 7 749 octets | ⬛⬛ |
| **HIPAA** | 7 745 octets | ⬛⬛ |
| **CMMC** | 7 577 octets | ⬛⬛ |
| **EU AI Act** | 7 004 octets | ⬛⬛ |
| **NIST AI RMF** | 6 912 octets | ⬛⬛ |
| **NIS2** | 5 592 octets | ⬛ Compact |

**Total SKILL.md : ~326 KB de contenu expert structuré**

---

## 1B. Analyse Complémentaire : Écosystème Lawve.ai

> **Source :** [lawve.ai/fr/guides/best-ai-skills-gdpr](https://lawve.ai/fr/guides/best-ai-skills-gdpr) + [EU AI Act](https://lawve.ai/fr/guides/best-ai-skills-eu-ai-act)
> **Nature :** Plateforme de référence pour les skills IA juridiques (marketplace)
> **Licence :** Skills propriétaires — NON intégrables directement, mais **architecture et concepts à s'inspirer**

### 1B.1 Skills GDPR Lawve.ai (7 skills spécialisés)

Ces skills sont **complémentaires** au GDPR skill de Sushegaad. Ils couvrent des **sous-tâches spécifiques** que notre agent GDPR devrait aussi intégrer comme workflows :

| # | Skill Lawve.ai | Auteur | Spécialité | Articles RGPD | Notre Mapping |
|---|---------------|--------|------------|---------------|---------------|
| 1 | **DPIA Sentinel** | Oliver Schmidt-Prietz | Analyses d'Impact (AIPD) | Art. 35, WP 248 | → Workflow dans `gdpr-agent.md` |
| 2 | **Breach Sentinel** | Oliver Schmidt-Prietz | Notification violation 72h | Art. 33-34, WP 250 | → Workflow dans `gdpr-agent.md` |
| 3 | **Legitimate Interest** | Oliver Schmidt-Prietz | Évaluation intérêt légitime (LIA) | Art. 6(1)(f) | → Workflow dans `gdpr-agent.md` |
| 4 | **Privacy Compliance Advisor** | Anthropic | Conseil conformité global | Art. 25, 28, 30, 37-39 | → Couvert par orchestrateur |
| 5 | **Privacy Notice Generator** | Oliver Schmidt-Prietz | Générateur avis de confidentialité | Art. 13-14 | → Workflow dans `gdpr-agent.md` |
| 6 | **Privacy Policy Generator** | Malik Taiar | Politique de confidentialité | Art. 12-14 | → Workflow dans `gdpr-agent.md` |
| 7 | **Cookie Policy Generator** | Malik Taiar | Politique cookies ePrivacy + RGPD | Directive 2002/58/CE | → Workflow dédié ou sub-agent |

**💡 Action :** Enrichir notre agent GDPR avec les workflows AIPD, Breach Response, LIA, et Privacy Notice que Lawve.ai sépare en skills distincts mais que nous intégrerons comme workflows dans un seul agent plus complet.

### 1B.2 Skills EU AI Act Lawve.ai (8 skills spécialisés)

Le skill EU AI Act de Sushegaad (7 KB) est **minimaliste**. Lawve.ai propose 8 skills plus avancés couvrant le cycle complet de conformité au Règlement IA :

| # | Skill Lawve.ai | Auteur | Spécialité | Articles clés |
|---|---------------|--------|------------|---------------|
| 1 | **System Classifier** | Oliver Schmidt-Prietz | Classification risque IA | Art. 6, Annexe III |
| 2 | **Role Determination** | Oliver Schmidt-Prietz | Rôle organisationnel (fournisseur/déployeur) | Art. 3 |
| 3 | **Obligations Mapper** | Oliver Schmidt-Prietz | Cartographie des obligations | Art. 9-15, 17, 72 |
| 4 | **Quick Assessment (Triage)** | Oliver Schmidt-Prietz | Filtrage rapide applicabilité | Art. 2 |
| 5 | **High-Risk Implementation Readiness** | Werner Plutat | Préparation systèmes haut risque | Art. 9-15 |
| 6 | **FRIA** (Fundamental Rights Impact) | Werner Plutat | Analyse impact droits fondamentaux | Art. 27 |
| 7 | **GPAI Code of Practice** | Werner Plutat | Conformité modèles GPAI | Art. 51-56 |
| 8 | **Serious Incident Reporting** | Werner Plutat | Signalement incidents graves | Art. 73 |

**💡 Action :** Notre `eu-ai-act-agent.md` doit intégrer ces 8 workflows comme sous-sections (classification → rôles → obligations → assessment → FRIA → GPAI → incidents). Le skill original de Sushegaad sera enrichi avec la structure de Lawve.ai.

### 1B.3 Skills Lawve.ai Transversaux (à considérer pour v2)

| Skill | Catégorie | Pertinence pour Pack Shield |
|-------|-----------|----------------------------|
| **Cross Regulatory Impact Analyzer** | Compliance | 🔴 Très pertinent — analyse les interactions multi-réglementaires (GDPR+AI Act+NIS2+DORA) |
| **Vendor Due Diligence** | Compliance | 🟡 Utile pour SOC 2, ISO 27001 |
| **AI Governance Reviewer** | Compliance | 🟡 Complémentaire à AI Governance category |
| **Source Locked Verification** | Research | 🟢 Utile pour audits rigoureux |
| **Red Team Verifier** | Research | 🟢 Vérification contradictoire |

### 1B.4 Contexte Réglementaire (enrichissement des agents)

Informations clés extraites de Lawve.ai à intégrer dans les agents :

**RGPD :**
- Amendes cumulées > 4,5 milliards EUR fin 2024
- Plus grosse sanction : 1,2 milliard EUR (Meta, mai 2023)
- CNIL : fiches pratiques IA publiées 2024
- CEPD : avis spécifique IA en cours
- ICO : boîte à outils IA complète

**EU AI Act (Règlement 2024/1689) :**
- 4 phases déploiement : Feb 2025 → Août 2027
- Sanctions max : 35M EUR ou 7% CA mondial
- 180 articles, 13 chapitres, 13 annexes
- 6000-7000 fournisseurs IA haut risque dans l'UE
- Seuil GPAI risque systémique : 10^25 FLOPs

---

## 2. Architecture Proposée pour BMAD+ Pack Shield

### 2.1 Concept : Orchestrateur + Sous-Agents Thématiques

```
pack-shield/
├── shield-orchestrator.md          # 🎯 Agent principal — routing intelligent
├── categories/
│   ├── data-privacy/               # 🔐 Protection des données
│   │   ├── gdpr-agent.md
│   │   ├── ccpa-agent.md
│   │   ├── lgpd-agent.md
│   │   ├── dpdpa-agent.md
│   │   └── iso27701-agent.md
│   ├── cybersecurity/              # 🛡️ Sécurité informatique
│   │   ├── iso27001-agent.md
│   │   ├── nist-csf-agent.md
│   │   ├── nist-800-53-agent.md
│   │   ├── cis-controls-agent.md
│   │   ├── nis2-agent.md
│   │   └── ism-agent.md
│   ├── industry-compliance/        # 🏢 Conformité sectorielle
│   │   ├── soc2-agent.md
│   │   ├── pci-dss-agent.md
│   │   ├── hipaa-agent.md
│   │   ├── swift-csp-agent.md
│   │   ├── dora-agent.md
│   │   └── fedramp-agent.md
│   ├── defense-export/             # 🔒 Défense & Export
│   │   ├── cmmc-agent.md
│   │   ├── itar-agent.md
│   │   ├── ear-agent.md
│   │   └── tsa-agent.md
│   ├── ai-governance/              # 🤖 Gouvernance IA
│   │   ├── eu-ai-act-agent.md
│   │   ├── iso42001-agent.md
│   │   └── nist-ai-rmf-agent.md
│   └── accessibility-esg/          # ♿ Accessibilité & ESG
│       ├── wcag-agent.md
│       ├── section508-agent.md
│       └── csrd-agent.md
├── shared/
│   ├── cross-framework-mapper.md   # Mapping inter-frameworks
│   ├── gap-analysis-template.md    # Template d'analyse d'écart
│   └── audit-report-template.md    # Template de rapport d'audit
└── README.md                       # Documentation du pack
```

### 2.2 Rôle de l'Orchestrateur Shield

L'agent `shield-orchestrator.md` agit comme **point d'entrée unique** :

1. **Détection automatique** du framework via les trigger phrases
2. **Routing intelligent** vers le sous-agent spécialisé
3. **Multi-framework** — Peut activer plusieurs agents pour des analyses croisées
4. **Synthèse** — Consolide les résultats de plusieurs sous-agents
5. **Menu interactif** — Propose les catégories disponibles à l'utilisateur

```
Utilisateur: "J'ai besoin d'un audit GDPR et ISO 27001 pour mon SaaS"
                    ↓
        Shield Orchestrator
            ↓           ↓
    gdpr-agent      iso27001-agent
            ↓           ↓
    cross-framework-mapper (GDPR ↔ ISO 27001 mapping)
                    ↓
        Rapport consolidé
```

### 2.3 Transformation .skill → BMAD+ Agent

| Élément Source (.skill) | Destination BMAD+ |
|------------------------|-------------------|
| `SKILL.md` identity/role | Section `## Persona` de l'agent |
| Knowledge base | Section `## Knowledge Base` (inlined) |
| Decision trees | Section `## Decision Protocol` |
| Output templates | Section `## Output Templates` |
| Trigger phrases | `role-triggers.yaml` + orchestrator routing |
| Progressive disclosure | `## Advanced Modules` avec activation conditionnelle |

### 2.4 Groupes dans le Menu d'Installation

L'installeur CLI proposerait les sous-catégories comme checkboxes :

```
🛡️  Pack Shield — Audit GRC (26 agents)
│
├── 🔐 Protection des données (5 agents)
│   GDPR, CCPA, LGPD, DPDPA, ISO 27701
│
├── 🛡️ Cybersécurité (6 agents)
│   ISO 27001, NIST CSF, NIST 800-53, CIS Controls, NIS2, ISM
│
├── 🏢 Conformité sectorielle (6 agents)
│   SOC 2, PCI DSS, HIPAA, SWIFT CSP, DORA, FedRAMP
│
├── 🔒 Défense & Export (4 agents)
│   CMMC 2.0, ITAR, EAR, TSA
│
├── 🤖 Gouvernance IA (3 agents)
│   EU AI Act, ISO 42001, NIST AI RMF
│
└── ♿ Accessibilité & ESG (3 agents)
    WCAG, Section 508, CSRD
```

L'utilisateur peut installer **tout le pack** ou **sélectionner par catégorie**.

---

## 3. Processus de Conversion & Mise à Jour

### 3.1 Script de Conversion Initiale

```bash
# Pseudo-algorithme
for each .skill file in upstream:
  1. Extraire le SKILL.md du fichier .skill
  2. Transformer la structure en format BMAD+ agent
  3. Ajouter les métadonnées BMAD+ (version, catégorie, upstream ref)
  4. Générer le README i18n pour le menu d'install
  5. Enregistrer dans pack-shield/categories/<category>/
```

### 3.2 Processus de Mise à Jour (Upstream Sync)

```yaml
# upstream-sync.yaml — à stocker dans pack-shield/
upstream:
  repo: "Sushegaad/Claude-Skills-Governance-Risk-and-Compliance"
  branch: "main"
  baseline_sha: "9dc17ada525ef2c3c89833e53ac574ce2f0d0fd8"
  last_sync: "2026-05-17"

sync_process:
  1. Cloner le repo upstream dans un dossier temporaire
  2. Comparer les SHA des fichiers .skill avec la baseline
  3. Pour chaque fichier modifié :
     a. Extraire le diff du SKILL.md
     b. Appliquer les changements au fichier agent BMAD+ correspondant
     c. Préserver les customisations BMAD+ (métadonnées, i18n, templates)
  4. Vérifier les nouveaux skills ajoutés upstream
  5. Mettre à jour upstream_sync.yaml avec le nouveau SHA
  6. Générer un changelog des modifications

mapping:
  # upstream .skill → BMAD+ agent path
  "GDPR - Claude Skill/gdpr-compliance.skill": "categories/data-privacy/gdpr-agent.md"
  "ISO 27001 - Claude Skill/iso27001.skill": "categories/cybersecurity/iso27001-agent.md"
  # ... (26 mappings)
```

### 3.3 Commande CLI dédiée

```bash
# Futur : bmad-plus update:shield
# Vérifie les mises à jour upstream et propose un merge
npx bmad-plus shield:sync
```

---

## 4. Exemples Post-Installation (pour le CLI Guide)

### 4.1 Exemples par catégorie (i18n-ready)

```javascript
// i18n.js additions pour Pack Shield
guide_shield_title: '🛡️ Pack Shield — GRC Audit',
guide_shield_desc: 'Expert compliance guidance across 26 regulatory frameworks',

// Exemples
guide_example_shield_gdpr: '💬 "Audit my SaaS for GDPR compliance"',
guide_example_shield_soc2: '💬 "Generate SOC 2 Type 2 evidence checklist"',
guide_example_shield_hipaa: '💬 "Review our healthcare app for HIPAA requirements"',
guide_example_shield_ai: '💬 "Assess our AI model against EU AI Act"',
guide_example_shield_multi: '💬 "Cross-map ISO 27001 controls to NIST CSF"',
guide_example_shield_gap: '💬 "Run a gap analysis against PCI DSS v4.0"',
```

### 4.2 Descriptions multilingues (exemple FR)

```javascript
shield_cat_privacy: '🔐 Protection des données — GDPR, CCPA, LGPD, DPDPA, ISO 27701',
shield_cat_cyber: '🛡️ Cybersécurité — ISO 27001, NIST CSF, NIST 800-53, CIS, NIS2, ISM',
shield_cat_industry: '🏢 Conformité sectorielle — SOC 2, PCI DSS, HIPAA, SWIFT, DORA, FedRAMP',
shield_cat_defense: '🔒 Défense & Export — CMMC 2.0, ITAR, EAR, TSA',
shield_cat_ai: '🤖 Gouvernance IA — EU AI Act, ISO 42001, NIST AI RMF',
shield_cat_a11y: '♿ Accessibilité & ESG — WCAG, Section 508, CSRD',
```

---

## 5. Décisions d'Architecture

### 5.1 Questions ouvertes

| # | Question | Recommandation |
|---|----------|----------------|
| 1 | Installer les 26 agents d'un coup ou par catégorie ? | **Par catégorie** — plus modulaire, moins de bruit |
| 2 | Garder le format `.skill` ou convertir en `.md` ? | **Convertir en `.md`** — cohérent avec le format BMAD+ agents |
| 3 | Intégrer les benchmarks/evals ? | **Non** — trop volumineux (workspace de test), inutile en production |
| 4 | Attribution de l'upstream ? | **Oui** — MIT exige le copyright notice. Ajout dans chaque agent header |
| 5 | Agent orchestrateur dans le core ou dans le pack ? | **Dans le pack** — le pack est auto-suffisant |
| 6 | Shared templates (gap analysis, report) ? | **Oui** — économise la duplication et assure la cohérence |

### 5.2 Avantages de cette architecture

1. **Modulaire** — Chaque agent est indépendant et peut être mis à jour séparément
2. **Upstream-sync** — Le mapping explicite permet des mises à jour automatiques
3. **CLI-native** — S'intègre parfaitement dans le flow d'installation existant
4. **Scalable** — Nouveaux frameworks = nouveau fichier dans la bonne catégorie
5. **Multi-LLM** — Format `.md` fonctionne avec n'importe quel LLM, pas seulement Claude

---

## 6. Roadmap d'Implémentation

| Phase | Tâche | Effort | Priorité |
|-------|-------|--------|----------|
| **P1** | Convertir les 26 .skill → .md agents BMAD+ | 4-6h | 🔴 HIGH |
| **P2** | Créer le shield-orchestrator.md | 2h | 🔴 HIGH |
| **P3** | Créer les shared templates (gap, audit, mapper) | 2h | 🟡 MED |
| **P4** | Intégrer dans le CLI installer (catégories + descriptions) | 3h | 🟡 MED |
| **P5** | i18n pour les 10 langues (descriptions + exemples) | 1-2h | 🟡 MED |
| **P6** | Créer le upstream-sync process + script | 2h | 🟢 LOW |
| **P7** | Tests unitaires pour le pack | 1h | 🟢 LOW |
| **P8** | Documentation complète du pack | 1h | 🟢 LOW |

**Effort total estimé : 16-20h**

---

## 7. Crédits & Attribution

```markdown
# Attribution Notice (à inclure dans chaque agent)
#
# Based on Claude Skills for GRC by Hemant Naik (Sushegaad)
# Original: https://github.com/Sushegaad/Claude-Skills-Governance-Risk-and-Compliance
# License: MIT
# Adapted for BMAD+ by Laurent Rochetta
# Upstream baseline: SHA 9dc17ada525ef2c3c89833e53ac574ce2f0d0fd8
```

---

## 8. Fichiers de Référence

| Fichier | Localisation | Usage |
|---------|-------------|-------|
| Ce document | `brainstorm-laurent/pack-shield-grc-analysis.md` | Document de brainstorm principal |
| Source upstream | `github.com/Sushegaad/Claude-Skills-GRC` | Repo original (MIT) |
| Pack Shield futur | `src/bmad-plus/pack-shield/` | Destination dans BMAD+ |
| Module.yaml | `src/bmad-plus/module.yaml` | À mettre à jour avec le nouveau pack |
| i18n.js | `tools/cli/i18n.js` | Descriptions multilingues du pack |
