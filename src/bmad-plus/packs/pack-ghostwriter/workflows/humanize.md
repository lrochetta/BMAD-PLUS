---
name: humanize
description: Retouch the wording of an existing text while keeping its substance, voice, and technical regions intact.
---

# Humanize

Read the [editorial contract](../shared/editorial-contract.md). Use `ghostwriter-humanize`.

## Inputs

Read the source, any relevant preceding chat turns, and the intended destination. Establish whether the request is for a revised text or an audit of wording. Keep the original as the comparison copy.

When the request simply asks for humanization, return a clean version ready to copy. An earlier reply explicitly referred to as “ta dernière réponse” can be the source. Ask for the source only when it cannot be identified. Use a change report, new voice profile, localization or story workshop only when the request calls for it.

## Procedure

1. Identify the permitted prose. In a structured file, identify the exact fields or spans the user selected. Preserve the surrounding structure, keys, code, paths, destinations and quoted language. Surface any unsupported format or unread section as a coverage gap.
2. Read the whole message for its practical purpose. Look for a lead that delays the answer, repeated conclusions, empty praise, rhythm which obscures a procedure, or vague language that conceals the actor. Consider each in its genre. Parallel reference entries and a deliberate refrain can serve the reader.
3. Revise the smallest sufficient passage. Re-read it alongside its neighbors. In a French support chat, « Il convient de préciser que le dossier attend votre signature » can become « Le dossier attend votre signature. » Keep the existing form of address.
4. Compare actors, dates, quantities and units, negations, conditions, strength of claims, links and next actions with the original. Preserve meaningful spaces and punctuation of the locale. Return unchanged text when the wording already works.
5. When the revision gives the reader what they need, return it on its own. If an essential fact is missing or disputed, flag it in a separate note to the author. For example, if the reader needs a delivery date and the draft only promises an update, keep that promise and identify the missing date outside the copy. For an explicit “text only” request, ask the author the single factual question needed before writing if the gap prevents a usable reply. Otherwise, return only the requested text. In audit mode give the passage, proposed edit and reader benefit.

### Slop and recurring patterns in a chat

| Look for | Editorial decision | Expected result |
| --- | --- | --- |
| Praise, broad claims, unsupported superlatives or a closing restatement | Remove language that contributes nothing to the reader's task. Identify a missing substantive answer when the source cannot supply it. | The decision, fact or next action appears earlier. |
| Reused openers across supplied turns, forced oppositions, obligatory groups of three or paragraphs built to the same pattern | Change the passages where repetition obscures the point. Keep purposeful lists, refrains and the user's register. | The rhythm follows the content. |
| A reported watermark or copy/paste artifact | Use the watermark guidance below only when relevant. | The user gets a specific formatting diagnosis where possible and an accurate account of what was verified. |

**French support example.** The user only asks to humanize this reply:

> Excellente question ! Dans un monde en constante évolution, il est essentiel de rappeler que votre lien expire vendredi à midi.

Return the following as the whole answer:

> Votre lien expire vendredi à midi.

The unchanged deadline is essential. An offer to renew the link, a changed hour or an explanation appended to the answer would add material the user did not request.

## Delivery

Return the revised prose and any requested comparison. Record which sections could be reviewed when coverage is partial.

### When the request mentions a watermark

Find out what the user observed if it is unclear. A recurring phrase can be edited. For a copy/paste or layout fault, identify the character and the affected passage before proposing a change. Preserve meaningful typography, such as the French narrow nonbreaking space in a percentage or number with a unit. Keep provenance labels and file credentials intact in the editorial workflow.

For a requested inspection of a specific UTF-8 text file up to 1 MiB, the optional [typography inspector](../tools/inspect-typography.cjs) reads the file and emits JSON. From the installed project root, run `node .agents/skills/pack-ghostwriter/tools/inspect-typography.cjs "path/to/text.txt"` in the project's authorized execution environment. It reports code points, line and column, and a contextual suggestion to preserve or review each occurrence. Check the reported total and truncation flag when only the first 250 occurrences are listed. The tool leaves the file intact and calculates no authorship or watermark score.

A statistical text watermark can be distributed across the generator's word choices. Pasting plain text, removing spaces and rewriting sentences do not establish its removal. A generic AI-detector score does not verify its presence or absence. If no compatible provider check was performed, report the watermark as unverified when the user asks about it. Ordinary requests for natural prose need only the revised passage.
