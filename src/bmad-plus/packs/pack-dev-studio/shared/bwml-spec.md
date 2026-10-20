# BWML migration note

Earlier Dev Studio documents described XML-like instructions as the BMAD+
Workflow Markup Language, or BWML. The pack did not ship an interpreter that
implemented those tags as runtime operations. A tag in a prompt does not by
itself create an agent, run a test, persist memory or enforce a validation gate.

The maintained workflows now use original Markdown procedures and the
[execution guide](execution.md). The [catalog](catalog.json) resolves stable
workflow IDs to shipped files. The host assistant reads those instructions and
uses its available tools; the CLI only prepares a read-only context bundle.

## How earlier notation maps to supported behavior

| Earlier notation | Current explicit behavior |
| --- | --- |
| Workflow, phase and step tags | Read the selected workflow and perform its numbered procedure |
| Context tags and interpolated paths | Resolve the selected project, supported YAML config and real catalog resources |
| Agent and parallel tags | Create actual independent host agents when supported and appropriate; record assignments |
| Validation and guard tags | Run the named checks and record evidence, failures and unavailable checks |
| Memory tags | Read or write an actual authorized project report; record the path and what changed |
| Emit tags | Write the specified artifact and inspect it; no implicit event bus exists |
| Retry tags | Retry only when useful and justified by new evidence; record the attempt and remaining problem |
| Escalation and notification tags | Explain the specific dependency to the user; external messages need authorization |
| Fallback tags | State the available execution mode and its limitations without converting missing evidence into success |

Existing workflow IDs and persona names remain the public navigation contract.
Retained support files are compatibility instructions, not a second execution
engine. Consult the [pack README](../README.md) for the complete route list.

## Configuration migration

Dev Studio reads `_bmad/config.yaml` in the selected project with explicit
defaults. It does not resolve `config.toml`, `config.user.toml`, per-agent TOML
overrides or imported placeholder paths. Review existing custom settings and map
only supported fields through the [customize workflow](../categories/utilities/customize.md).
Preserve the originals and unrelated project settings; a prose description of
merge rules cannot make an absent resolver work.

For custom workflow instructions, keep the user's changes and deliberately adapt
their required behavior to the common guide. Do not overwrite a locally modified
file merely because a new framework version exists. Read previous reports as
context and revalidate changed inputs before resuming.

## What validation establishes

Catalog and package checks establish that declared routes and resources exist.
Preparation checks establish that inputs and configuration were loaded within
the supported boundaries. Neither establishes that an LLM executed a workflow,
that independent review occurred or that a project passed tests. Those claims
require actual host execution and recorded evidence.
