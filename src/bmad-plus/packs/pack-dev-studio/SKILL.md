---
name: dev-studio
description: Use six specialist personas and 38 Dev Studio workflows to carry out product, architecture, documentation and implementation tasks.
---

# Dev Studio

Use this pack when the user requests a Dev Studio persona, a named workflow or a
software task that benefits from its specific procedure. Read the
[execution guide](shared/execution.md) before acting. The
[catalog](shared/catalog.json) provides the actual agents, aliases, workflow paths,
input kinds and required resources.

## Activate

1. Start from the user's actual objective and current authorization. Read relevant
   project instructions and previous decisions. Keep the user's current language
   preference; configuration supplies defaults when no preference is stated.
2. Resolve the named persona or workflow through the catalog. For an unqualified
   task use the [orchestrator](dev-studio-orchestrator.md) to choose the smallest
   useful route. Use bmad-help for a roster or a next-step recommendation.
3. Read the selected workflow, its persona and declared resources. Check the
   inputs against the content actually supplied. A filename alone is not evidence
   of a complete brief, a valid PRD or a reproduced defect.
4. Execute the workflow's procedure with real host tools. Record actual outcomes
   and unavailable checks. Independent agents require host support; sequential
   perspectives by one assistant must be labeled accurately.
5. Deliver the requested artifact with verification evidence and remaining work.
   Preserve existing reports and user changes. On resume, compare input hashes
   and project state, invalidate affected decisions and continue incomplete work.

## Optional context preparation

With the CLI already available, use:

```sh
npx --no-install bmad-plus studio list --json
npx --no-install bmad-plus studio prepare product-brief --directory . --request "Define a small issue triage tool" --json
```

For artifact workflows, provide an existing project-relative file through
`--input`; repeat the flag for additional artifacts. The CLI reports missing
inputs and returns a read-only bundle with actual text, hashes, resolved
configuration and a proposed report path. It neither executes the workflow nor
certifies model behavior. The host must still perform the work.

See the [README](README.md) for all 38 routes and configuration examples.
The [BWML migration note](shared/bwml-spec.md) explains the replacement for earlier
XML and TOML assumptions.
