# Intake file formats

Validator: `tools/build/intake-contract.js` (shipped with BMAD+; run by `bmad-plus intake
check` and by the BMAD+ build on every declared intake). Unknown fields are refused.

## 1. Intake (`intake.yaml`, shipped by the pack)

```yaml
schema_version: 1
id: shop-brief              # lowercase slug, unique per pack
pack: shop                  # the pack id that declares `intake:` in the registry
title: Shop brief
language: user              # ask in the user's language, or a tag such as fr or en-GB
max_per_message: 4          # 1..20, default 6
sections:
  - id: offer
    title: What is sold
    questions:
      - id: product_kind
        ask: What does the shop sell, one line?
        kind: text
        must_have: true
        feeds: [brief.md#offer]
        risk_if_unknown: Every page is written for a product nobody described.
      - id: price_band
        ask: Where do prices sit?
        kind: choice
        choices: [budget, mid, premium]
        default: mid
        feeds: [brief.md#offer]
      - id: launch_in_days
        ask: In how many days must it go live?
        kind: number
        min: 1
        max: 365
      - id: has_stock
        ask: Is there stock to ship today?
        kind: boolean
        default: true
      - id: markets
        ask: Which countries are served?
        kind: list
        must_have: true
        risk_if_unknown: Taxes, currencies and legal pages cannot be chosen.
```

- `kind`: `text`, `choice` (needs at least two distinct `choices`), `number` (optional `min`,
  `max`), `boolean`, `list` (of texts).
- `must_have: true` requires `risk_if_unknown` and forbids `default`: the user answers it or
  marks it unknown. A question that is not must-have may carry a `default`, valid for its kind.
- `feeds` names the artifact anchors the answer fills (`file#anchor`); informative.
- Question ids are `snake_case` and unique across the whole file; section ids are slugs.

## 2. Answers (`.json`, written by `bmad-plus intake record`)

```json
{
  "schemaVersion": 1,
  "intake": "shop-brief",
  "answers": {
    "product_kind": { "value": "Hand-poured soy candles", "status": "answered" },
    "price_band": { "value": "mid", "status": "defaulted" },
    "markets": { "status": "unknown", "risk": "Taxes, currencies and legal pages cannot be chosen." }
  }
}
```

- Statuses: `answered` (the user said it), `defaulted` (the proposed default stood), `unknown`
  (the user does not know; `risk` copies the question's `risk_if_unknown`). Nothing else.
- A key must be a question id of the intake; a value must fit the question's kind and bounds;
  a `defaulted` value equals the question's default. A question not yet asked has no entry.

## 3. Brief (`.md`, written by `bmad-plus intake render`)

```markdown
# Shop brief
<!-- owned by bmad-plus intake shop-brief; written by bmad-plus intake render, do not edit -->

Intake `shop-brief` of pack `shop` — 1 answered, 1 defaulted, 1 unknown, 2 not asked yet. Not ready: a must-have is open.

## What is sold

### product_kind (must-have)

What does the shop sell, one line?

Answer:
    Hand-poured soy candles
Feeds: brief.md#offer

### price_band

Where do prices sit?

Answer (proposed default, not confirmed by the user):
    mid
Feeds: brief.md#offer

...

## Open questions

- markets (must-have): unknown — risk: Taxes, currencies and legal pages cannot be chosen.
- launch_in_days: not asked yet
```

The first paragraph states readiness; a pack reads "Ready." before it starts. The second
line is the ownership marker: `render` overwrites an existing file only when it starts with
the marker of the same intake. Values are printed as a block indented by four spaces, one
line per list item and per line of a multi-line text, so a value never opens a heading or a
list of its own. Text and list values may hold line breaks and tabs; any other control
character is refused.
