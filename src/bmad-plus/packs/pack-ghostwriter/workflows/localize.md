---
name: localize
description: Adapt selected prose to a target locale while preserving values, qualifications, technical strings and voice.
---

# Localize

Read the [editorial contract](../shared/editorial-contract.md). Use `ghostwriter-localize`.

## Inputs

Resolve the source and target locale, audience, market, channel, glossary, required literals and space limits. Use the project's approved locale-specific profile. Clarify a market or language variant only when the choice changes the text materially.

## Procedure

1. Extract the claims and their conditions. Identify fixed items such as links, names, variables, markup, translation keys, quoted labels, currency, units and call to action. Keep the original beside the selected fields.
2. Write idiomatic target-language prose with the appropriate form of address. Keep the glossary's product names and prescribed vocabulary. Use local number or date conventions only when the underlying value is unambiguous and the field allows it.
3. For example, French « jusqu’à 2,5 % » can become English “up to 2.5%” or Brazilian Portuguese “até 2,5%”. Explicitly compare both the quantity and its upper-bound meaning. Resolve an ambiguous numeric date with the author before changing its representation.
4. Inspect the output in its format. Confirm placeholders, ICU argument names and structure, URL destinations and excluded fields against the source. Check line or character limits for interface text. Report unsupported formats or incomplete comparisons.
5. Read the candidate in the target language and compare directly with the source for changed negation, certainty, eligibility, deadlines and obligations. If a claim requires local market research or a currency conversion, seek the missing basis before making it.

## Delivery

Return the localized content, the target locale and unresolved choices as requested. Preserve the original where a choice is blocked, identify the passage, and keep a partial localization distinguishable from a completed one.
