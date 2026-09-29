# GDPR & OSINT — governance for the investigate skill

This pack performs OSINT on named individuals, including psychoprofiling. That is
personal-data processing (GDPR + analogous laws such as UK GDPR, LGPD, CCPA/CPRA).
BMAD+ **keeps** this capability and **governs** it — the Phase −1 lawful-basis gate
in `SKILL.md` makes lawful use explicit and auditable rather than removing the pack.
(Decision: keep + govern, 2026-07-02.)

## Why this matters
- Profiling and evaluating personal aspects is regulated (GDPR Art. 4(4), Art. 22, Recital 71).
- Inferring personality, health, political/religious views, or sexual orientation is
  **special-category** processing (Art. 9) — a higher bar than ordinary personal data.
- "Publicly available" ≠ "no rules apply." Scraping public profiles is still processing;
  you still need a lawful basis and must respect purpose limitation and data-subject rights.

## The gate, in one line
No lawful basis + specific purpose recorded (`assets/lawful-basis-record.md`) → no
named-person profiling. Non-personal research (company/product/market, public entities)
is unaffected.

## Legitimate interest (the common basis)
When relying on Art. 6(1)(f), complete the 3-part LIA in the record:
1. **Purpose** — a real, specific legitimate interest (due diligence, fraud/security, journalism).
2. **Necessity** — OSINT is necessary and proportionate; no less-intrusive route.
3. **Balancing** — the person's rights/freedoms do not override; consider their reasonable
   expectations, the sensitivity of the data, and any special-category inference (which
   usually tips the balance and requires an Art. 9 condition instead).

## Special-category / psychoprofile
Only build the psychoprofile (MBTI/Big Five, etc.) with a valid **Art. 9(2)** condition
(typically explicit consent, or data manifestly made public by the subject). Otherwise
keep the factual dossier and skip the personality inference.

## Data-subject rights & retention
- Define a **retention period**; delete when the purpose is met.
- Provide a **DSAR/erasure** path (access, rectification, erasure, objection).
- Consider **transparency** (Art. 14) or a documented exemption.

## Prohibited / out of scope
- No profiling without a recorded basis + purpose.
- No use for unlawful discrimination, harassment, stalking, or unauthorized surveillance.
- No special-category inference without an Art. 9 condition.

## Related BMAD+ assets
- `SKILL.md` → Phase −1 gate.
- `assets/lawful-basis-record.md` → gate record + ROPA entry.
- Shield (GRC) pack → `gdpr-agent`, `legitimate-interest`, `dpia-sentinel`, `privacy-notice-gen`
  for DPIA, LIA, ROPA, and privacy-notice generation at scale.
