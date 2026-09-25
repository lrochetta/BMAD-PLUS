---
name: customize
description: Adapt supported BMAD+ configuration or explicit local instructions while preserving existing project settings and custom files.
---

# Customize Dev Studio

Read the [execution guide](../../shared/execution.md) and adopt
[Oholiab](../implementation/dev-agent.md).

## Inputs

A concrete customization request and the selected project, plus the target agent
or workflow when the request changes its behavior. Inspect the existing
installation and project instructions before proposing a file change.

## Supported configuration

Dev Studio reads these optional string fields from `_bmad/config.yaml`:

| Field | Default when absent | Purpose |
| --- | --- | --- |
| user_name | user | Name used in project context |
| communication_language | English | Conversation preference |
| document_output_language | English | Document preference |
| output_folder | _bmad-output | Base for proposed workflow reports |
| project_name | Selected directory name | Project label |

Current user instructions take precedence over language preferences. Existing
unrelated YAML settings remain intact. A malformed existing file or a known field
with the wrong type must be corrected explicitly; do not silently replace it.
This pack does not load TOML overrides or merge hidden customization layers.

## Procedure

1. Identify the intended behavior and where it belongs. Use the supported YAML
   fields for configuration. Use an actual project instruction file already read
   by the host for broader conventions. Use the specific workflow or persona file
   only for an explicitly requested local change to that instruction.
2. Read the target file, applicable project rules and any previous customization.
   Distinguish the framework source checkout from a consumer installation. In a
   source checkout edit the maintained source. In an installation a change to an
   owned pack file becomes a local customization that future updates must preserve.
   Never hand-edit an adapter marked as generated; follow its source instructions.
3. Prepare and apply the smallest change covered by the user's request. Preserve
   unrelated YAML keys, comments and user-authored content. Do not replace the
   whole configuration to change one value. If no target instruction file is
   automatically loaded by the host, document the required explicit loading step;
   creating a new file alone does not activate it.
4. Validate the result with the available YAML parser and inspect the diff.
   Prepare a representative workflow through the CLI to verify resolved
   configuration and loaded instruction text. Preparation verifies loading; it
   does not demonstrate that an LLM followed the new behavior.
5. Explain what changed, which host or command reads it, the check performed and
   how to revert the specific change. Keep a locally customized pack instruction
   identified as such; do not adopt or overwrite its ownership hash merely to hide
   the customization.

## Output

The common report includes the request, changed path and fields, before/after
summary, resolved configuration or instruction evidence, remaining limitations
and a precise rollback description. Keep private values out of public examples.

## Acceptance and continuation

The requested setting resolves as intended, unrelated settings are preserved and
the activation mechanism is real. On resume, read the latest file and compare
prior evidence before changing anything; preserve intervening edits and recheck
the representative prepared context.
