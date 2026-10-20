---
name: editorial-review-prose
description: Review wording for clarity and precision while preserving technical meaning, evidence and the intended voice.
---

# Editorial Review: Prose

Read the [execution guide](../../shared/execution.md) and adopt
[Huldah](../analysis/tech-writer-agent.md).

## Inputs

At least one explicit draft and its intended audience or use. Use the document's
existing voice when no style preference is supplied. Identify protected content
such as quoted material, commands, API names, translated strings and legal wording.

## Procedure

1. Read the draft and identify its purpose, audience and promised outcome. Note
   whether the user requested a review, direct edits or both; apply already
   authorized edits without inventing a separate approval ritual.
2. Inspect sentences for ambiguous references, unsupported certainty, needless
   repetition, hidden actions, undefined terms and unclear conditions. Prefer the
   smallest change that helps the reader act or understand.
3. Propose or apply specific replacements with a short reason. Preserve numbers,
   names, units, caveats, links and the distinction between evidence and opinion.
   Flag factual uncertainty for verification rather than rewriting it into a fact.
4. Read each changed sentence in its paragraph. Check that connective wording,
   tense and terminology remain consistent and that examples still support the
   explanation. Keep code and literal commands unchanged unless their correction
   is in scope and has been verified.
5. Review the final diff if editing. Follow the repository's translation and
   generated-file rules. Run a relevant documentation or link check when the
   edits could affect it; a stylistic change alone needs no invented test suite.

## Output

The common report records the audience, inspected scope and prioritized wording
issues. For review-only work, show location, original phrase, proposed replacement
and reason. For direct edits, record the changed files and material choices.
List unresolved factual questions separately from writing improvements.

## Acceptance and continuation

Edits improve clarity while retaining meaning and the requested voice. Material
claims have not acquired unsupported certainty. Literal content and user additions
are preserved unless an authorized, verified correction was needed. On resume,
review the latest diff and only reopen suggestions still relevant to the new text.
