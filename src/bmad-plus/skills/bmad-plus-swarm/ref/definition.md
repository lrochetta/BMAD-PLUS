# Swarm file contracts

Four files, all JSON except the brief template. The runtime refuses an unknown field, a wrong
type or a bound breach; it never guesses. Every path is project-relative with `/` separators.

## 1. Definition

One per swarm, shipped by the pack next to the agent that moderates it. The template path is
relative to the definition file.

```json
{
  "schemaVersion": 1,
  "id": "buyer-panel",
  "kind": "panel",
  "pack": "marketfit",
  "title": "Simulated buyers see the pitch",
  "units": { "source": "profile", "idPrefix": "B" },
  "brief": { "template": "briefs/buyer.md", "context": ["pitch"] },
  "answer": {
    "required": ["id", "buys", "reason_code", "reason"],
    "fields": {
      "buys": { "type": "boolean" },
      "reason_code": { "type": "enum", "values": ["price", "habit", "need", "trust", "other"] },
      "reason": { "type": "string", "max": 600 },
      "price_floor": { "type": "number", "min": 0 }
    }
  },
  "tally": {
    "rate": "buys",
    "groupBy": ["segment", "behaviour"],
    "counts": ["reason_code"],
    "quotes": { "reason": 2 },
    "numbers": ["price_floor"]
  },
  "disclosure": "Simulated units are not people. Read rates as an upper bound and confirm with real ones."
}
```

| Field | Rule |
|---|---|
| `id` | 1–64 lowercase letters, digits or `-`; it opens the run id |
| `kind` / `units.source` | `panel`/`profile`, `jury`/`list`, `fanout`/`input` — the pair must match |
| `units.idPrefix` | 1–4 letters; required for a panel, optional for a jury whose entries lack an `id`, absent for a fanout |
| `units.list` | jury only: 1–1000 entries, each with a `lens` string and any other string, number or boolean fields; an optional `id` |
| `pack` | optional pack id, recorded in the run |
| `brief.template` | plain relative path, no `.` or `..` parts |
| `brief.context` | names of context files the moderator passes at init; each is required |
| `answer.fields` | at most 50; `id` is implicit and always required |
| field types | `boolean`; `integer` and `number` with optional `min`/`max`; `string` with `min`/`max` length (default 0–4000, ceiling 20000); `enum` with 1–50 distinct `values`; `list` of nonempty strings with `maxItems` (default 50, ceiling 200) |
| `tally.rate` | a boolean field |
| `tally.groupBy` | up to 5 card fields; every card must carry them |
| `tally.counts` | enum fields |
| `tally.quotes` | string field → quotes kept per group (1–10) |
| `tally.numbers` | integer or number fields |
| `disclosure` | 1–500 characters, printed first in every tally |

## 2. Profile (panel)

```json
{
  "schemaVersion": 1,
  "subject": "Orbit espresso bar",
  "target": "Urban professionals who buy coffee most days",
  "dimensions": [
    {
      "name": "segment",
      "values": [
        { "value": "early career", "share": 0.45, "ranges": { "income": [38000, 85000] } },
        { "value": "mid career", "share": 0.4, "ranges": { "income": [85000, 150000] } },
        { "value": "high earner", "share": 0.15, "ranges": { "income": [150000, 210000] } }
      ]
    },
    {
      "name": "behaviour",
      "values": [
        { "value": "daily regular", "share": 0.2, "note": "same drink, same place, most mornings" },
        { "value": "explorer", "share": 0.5 },
        { "value": "occasional", "share": 0.3, "note": "a treat, not a routine" }
      ]
    }
  ],
  "ranges": { "age": [24, 38] },
  "pools": { "objection": ["too steep for a drink", "my place is closer"] }
}
```

- 1–10 dimensions, each with 1–50 values whose shares add up to 1. Each dimension is dealt by
  exact quota (largest remainder), then shuffled by the seeded generator: 20 cards from the
  profile above hold 9, 8 and 3 segments whatever the seed.
- A range on a value is sampled when that value is dealt; every value of a dimension declares the
  same range names. Top-level ranges are sampled per card. Integer bounds deal integers; other
  bounds deal numbers with two decimals.
- One entry of each pool is dealt per card.
- A value's `note` becomes the card field `<dimension>_note` (empty for values without one).
- Card fields are the dimension names, their range names, the top-level range names, the pool
  names and the notes; names must be distinct, and `id`, `scope` and `lens` are reserved.
- Names are not dealt. A brief that wants one draws it from a pool the pack supplies.

The dealt card for one unit:

```json
{ "id": "B007", "segment": "mid career", "income": 97250, "behaviour": "explorer", "behaviour_note": "", "age": 31, "objection": "my place is closer" }
```

## 3. Units file (fanout)

```json
{
  "schemaVersion": 1,
  "units": [
    { "id": "about", "scope": "site/about", "title": "About us", "tone": "warm" },
    { "id": "pricing", "scope": ["site/pricing", "site/data/prices.json"], "title": "Pricing", "tone": "plain" }
  ]
}
```

- `id`: 1–64 lowercase letters, digits, `_` or `-` (a Nexus task id).
- `scope`: one path or a list of up to 20, portable and project-relative, never `.git` or
  `.bmad-plus`; scopes are pairwise disjoint across units (no scope contains another).
- Other fields are strings, numbers or booleans and become card fields for the brief.

## 4. Brief template

A Markdown file. Placeholders, and nothing else between double braces:

| Placeholder | Renders |
|---|---|
| `{{card.<field>}}` | the card field; a list renders comma-separated |
| `{{context.<name>}}` | the context file passed at init, verbatim and frozen in the run |
| `{{answer.path}}` | the absolute path of the answer file the sub-agent must write |
| `{{run.id}}`, `{{unit.id}}` | the run and unit ids |
| `{{disclosure}}` | the definition's disclosure sentence |

An unknown placeholder, a card field some card lacks or an undeclared context fails `init`.
Literal `{{` sequences are not allowed in a template. Every value is inserted verbatim: the
runtime filters no instruction text out of a card, a pool entry or a context, so the pack owns
what its pools and unit fields say and the moderator reads a context before passing it.

```markdown
# You are unit {{unit.id}} of run {{run.id}}

Segment: {{card.segment}}, income {{card.income}}. Your first objection: {{card.objection}}.

## The pitch

{{context.pitch}}

Write a JSON object to `{{answer.path}}` with `id` ("{{unit.id}}"), `buys`, `reason_code`
and `reason`.

{{disclosure}}
```

## 5. Answer

What the sub-agent writes to `{{answer.path}}`: one JSON object, `id` equal to the unit id,
every required field present, no field the definition does not declare.

```json
{ "id": "B007", "buys": false, "reason_code": "price", "reason": "5.40 is a lunch, not a drink.", "price_floor": 3.5 }
```

`check` reports an answer as `missing` (no file) or `invalid` (unreadable JSON, wrong id, missing
required field, unknown field, type or bound breach) with the reasons. `save` applies the same
rules to the first balanced JSON object found in a printed reply.

## 6. Tally

`tally.json` and `tally.md`, over valid answers only. Units without one are listed as skipped and
counted in the denominator line. Every section has an `all` entry and one entry per `groupBy`
value.

```json
{
  "schemaVersion": 1,
  "run": "buyer-panel-20261016-k3f9",
  "disclosure": "Simulated units are not people. ...",
  "units": { "total": 20, "valid": 19, "skipped": [{ "unit": "B013", "reason": "no answer file" }] },
  "rate": { "field": "buys", "all": { "yes": 11, "of": 19, "rate": 0.5789 }, "groups": { "segment": { "early career": { "yes": 6, "of": 9, "rate": 0.6667 } } } },
  "counts": { "reason_code": { "all": { "price": 5, "habit": 7, "need": 4, "trust": 2, "other": 1 }, "groups": {} } },
  "quotes": { "reason": { "keep": 2, "all": [{ "unit": "B001", "text": "On my way to work." }], "groups": {} } },
  "numbers": { "price_floor": { "all": { "count": 14, "median": 4, "mean": 4.07, "min": 2.5, "max": 6 }, "groups": {} } }
}
```

`tally.md` opens with the disclosure as a quote, then the denominator line, then one section per
rate, count, quote and number. Quotes are JSON-escaped verbatim, attributed to their unit id.
