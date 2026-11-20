---
name: index-docs
description: Build a task-oriented index from inspected project documents and verify its local destinations.
---

# Index Documents

Read the [execution guide](../../shared/execution.md) and adopt
[Huldah](../analysis/tech-writer-agent.md).

## Inputs

An explicit documentation scope or discovery request for the selected project.
The request can name a directory, audience or set of files. A project directory
alone does not establish which documents were inspected. Resolve scope within the
project and respect its ignored, private and generated areas.

## Procedure

1. Discover candidate documentation with the host's file tools. Prefer existing
   documentation roots and entry points. Exclude dependencies, build output,
   secrets and unrelated directories. Record the discovery scope and exclusions.
2. Read document titles and enough content to describe their actual purpose.
   Identify prerequisites, supported audience, ownership when documented and
   overlap with other files. Do not infer recency from a copyright year or treat a
   filename as proof of content.
3. Group entries by reader task: getting started, common operations, design,
   reference, troubleshooting or another structure supported by the documents.
   Keep one canonical destination for duplicate guidance and flag contradictions.
4. Write or update an index with concise descriptions and relative links. Read an
   existing index first and preserve useful authored explanations. Include a clear
   start point and the scope of the index; avoid listing every file indiscriminately.
5. Resolve every local destination and any heading anchors used. Check case and
   relocation from the index directory. Record missing targets and uncertain
   external destinations. Do not publish private documents because they were found.

## Output

The common report contains the inspected inventory, exclusions, index path,
grouping rationale, contradictions and validation results. The index itself lists
documents with their purpose and prerequisites where useful.

## Acceptance and continuation

Each description is supported by inspected content and each local link resolves.
Private or excluded paths remain outside the index. On resume, compare the scoped
inventory and existing index, add or remove entries based on actual file changes,
and recheck links affected by moves.
