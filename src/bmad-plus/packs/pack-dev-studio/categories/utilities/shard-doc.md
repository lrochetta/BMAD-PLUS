---
name: shard-doc
description: Split a long document into usable linked sections while preserving its original and verifying coverage.
---

# Shard Document

Read the [execution guide](../../shared/execution.md) and adopt
[Huldah](../analysis/tech-writer-agent.md).

## Inputs

At least one explicit source document and the intended reading or maintenance
purpose. Use a new directory under the configured output folder unless the user
specified an authorized destination. The original remains available; splitting
does not authorize its deletion.

## Procedure

1. Read the document and record its path, hash, headings, references and any front
   matter. Identify units that need to stay together: a procedure with its
   prerequisites, a code example with its explanation, a table, a quotation or a
   diagram and its legend.
2. Design a small set of sections with meaningful names and a reading order. Use
   stable filename slugs without path separators. Check destination collisions
   before writing; read and preserve any existing user-authored files.
3. Create a navigation index with purpose, source provenance, reading order and a
   link to each section. Give each section sufficient local context and a link
   back to that index. Do not present an extract as the entire source.
4. Copy the relevant content without changing technical meaning. Preserve complete
   fenced blocks and tables. Rewrite relative links and reference definitions for
   the new locations; account for heading anchors that moved between files.
5. Compare the result to the source section by section. Record where every heading
   and material paragraph went, including any intentionally duplicated context.
   Check local links, fence balance, code language labels and referenced assets.
   Do not claim exact preservation from matching character counts alone.

## Output

Write the split documents and their index, plus the common report. Include a
source-to-file mapping, original hash, destination inventory, link-check results,
intentional omissions or duplication and any unresolved references.

## Acceptance and continuation

All intended source content is accounted for, the original is unchanged, and
navigation works within the generated set. Unchecked external links are labeled.
On resume, compare source and destination hashes; update affected sections while
preserving user edits and report conflicts that need a deliberate merge.
