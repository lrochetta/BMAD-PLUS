# AI Processing Register

> Procedure used by Shield when a user asks which AI tools touch the project's data, prepares a record of processing (GDPR Art. 30), a DPIA involving AI tooling, or an ISO 27001 / ISO 42001 supplier review. Template: `shared/ai-processing-register-template.yaml`. Tooling: `bmad-plus ai-register init|check`, and `bmad-plus doctor` when Shield is installed.

## What it produces

`_bmad/ai-processing-register.yaml`: one entry per AI tool the project uses — coding assistants, agent CLIs, model APIs called by the product, MCP servers — with its provider, purpose, the categories of data it sees, whether that includes personal data and on which legal basis, retention, transfers outside the EEA with their mechanism, and the processing agreement in place.

## Steps

1. **Inventory.** Run `bmad-plus ai-register check`. It lists the AI integrations present in the project: the adapter files BMAD+ installs (`CLAUDE.md`, `GEMINI.md`, `.cursor/rules/`, `.codex/AGENTS.md`...), the tools' own folders (`.claude/`, `.cursor/`, `.gemini/`...), and the MCP servers declared in `.mcp.json`, `.cursor/mcp.json`, `.gemini/settings.json` or `.vscode/mcp.json` (comments and trailing commas allowed). Ask the user for tools used without a trace in the repository (a model API called by the product, a browser assistant).
2. **One entry per tool.** `bmad-plus ai-register init` starts the file from the template; replace its example entries. An MCP server is registered as `mcp:` followed by its name exactly as declared. Fill each field from facts: the provider's terms and data processing addendum, the tool's settings (training opt-out, retention, region), what the tool can actually read. When a fact is unknown, say so to the user; do not guess a retention period or a transfer mechanism.
3. **Personal data.** Code rarely is, but commit authors, issue text, customer data in fixtures, logs and support tickets are. When `personalData` is true, choose the legal basis with the user (the `gdpr-agent` and `legitimate-interest` workflow help) and flag the entry for a DPIA (`dpia-sentinel`) when the processing is large-scale or novel.
4. **Transfers.** Every destination outside the EEA needs a mechanism; an adequacy decision covers a US provider only while it is certified under the Data Privacy Framework.
5. **Check again.** `bmad-plus ai-register check` must report every integration registered. Set `reviewed` to the date of the review; the check warns after twelve months.

## How the gate behaves

| Situation                                                                                                                   | Result                                                     |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| An AI integration found in the project that no entry covers                                                                 | Warning (exit code 0)                                      |
| No register while AI integrations are present                                                                               | Warning                                                    |
| Register last reviewed more than 365 days ago                                                                               | Warning                                                    |
| An entry that matches nothing found here                                                                                    | Listed as not found; it may be used outside the repository |
| A register that does not follow the schema (unknown key, legal basis missing for personal data, unknown transfer mechanism) | Error (exit code 1)                                        |

The gate is deliberately soft: it keeps the register in step with the tooling, and a missing entry never blocks a build; only a register that cannot be read exits non-zero. `bmad-plus doctor` shows every case, that one included, as a warning.

## Boundaries

- The register records processing; it does not make it lawful. The legal basis, transfer mechanism and agreements are decisions for the controller and its DPO.
- Detection sees configuration in the repository only. A tool installed on a developer's machine without project configuration is found by asking, not by the check.
