# Terminology across locales

Resolve a term in this order. Preserve protected strings and quoted UI labels exactly. Apply the owner's approved glossary for this locale, product, meaning and channel. For an ordinary concept without an approved entry, use established wording in the destination language. If two plausible meanings imply different actions, keep the current wording and flag the decision.

A glossary entry should identify the source term, meaning, locale, preferred wording, scope and approving source. Record casing, grammatical gender or plural where they affect the text. Supply versioned bilingual UI labels before substituting a translated button name. An entry for one customer or product has no authority in another.

| Source expression | Context | Editorial decision |
| --- | --- | --- |
| `draft` | Literal value in JSON | Keep `draft` in all locales. |
| draft | Unpublished document in prose | *brouillon*, *draft* or *rascunho* according to locale. |
| release | Verb meaning “make a payment available” | Check the payment workflow. A software publication term would give the wrong action. |
| `{due_date}` | Template token | Translate the surrounding sentence and preserve the token byte for byte. Review the resulting sentence with an example date of known meaning. |

When converting prose dates or number formatting is authorized, compare the date components, numeric value, unit, currency, sign, range and qualification after the edit. Leave technical values and ambiguous source dates unchanged. Record a proposed glossary change in the review or handoff for the owner. It takes effect only after the owner adopts it in project resources.
