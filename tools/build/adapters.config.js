/**
 * BMAD+ Build — hand-authored project instructions (Pillar 5 adoption).
 *
 * When the root adapters (CLAUDE.md / GEMINI.md / AGENTS.md / .cursor / .codex /
 * .opencode / CONVENTIONS.md) were adopted as GENERATED files, every substantive
 * hand-written instruction they contained was folded into THIS file — the UNION
 * of all three pre-adoption root files, nothing dropped:
 *
 * Agent personas now live in registry.yaml; only repository-specific prose is here.
 *   - Skills paths (installed `.agents/` layout AND repo `src/bmad-plus/` layout)
 *   - Project Structure                                      — from GEMINI/AGENTS
 *   - Communication (user name + language policy)            — from CLAUDE
 *   - Commit Rules (no AI co-author)                          — from GEMINI
 *   - Repository Maintenance Rule (README i18n sync)          — from GEMINI/AGENTS
 *   - Memory Protocol (Karpathy Guardrails G1–G4 + files)     — from CLAUDE
 *
 * These sections are injected VERBATIM into the generated spine (AGENTS.md) and
 * into every generated adapter, so every tool keeps the full instructions even
 * when it only auto-loads its own file.
 *
 * EDIT THIS FILE (never the generated root files), then regenerate:
 *   node tools/build/generate-adapters.js --adopt
 *
 * Numbers policy: NO counts are hand-typed here (they drift — see audit DOC-06).
 * All counts live in the generated "Registry facts" section, derived from
 * registry.yaml. Agent personas and their pack membership live there too.
 *
 * Author: Laurent Rochetta
 */

'use strict';

/**
 * Markdown lines (LF-joined by the generator). Headings are `##` level so the
 * block nests directly under each generated file's H1.
 */
const MEMORY_INSTRUCTIONS = [
  '## Memory Protocol (Karpathy Guardrails)',
  '',
  'Agents MUST follow these behavioral principles:',
  '',
  '### G1 — Think Before Coding',
  '',
  '- State assumptions explicitly. If uncertain, ask.',
  '- Check `.agents/memory/decisions.md` for prior decisions before re-deciding.',
  '',
  '### G2 — Simplicity First',
  '',
  '- Minimum code that solves the problem. Nothing speculative.',
  '- Check `.agents/memory/patterns.md` for existing solutions.',
  '',
  '### G3 — Surgical Changes',
  '',
  '- Touch only what you must. Match existing style.',
  '- Log surprises in `.agents/memory/lessons.md`.',
  '',
  '### G4 — Goal-Driven Execution',
  '',
  '- Define success criteria before implementing.',
  '- Log non-obvious decisions in `.agents/memory/decisions.md`.',
  '',
  '### Memory Files',
  '',
  '- `.agents/memory/decisions.md` — Read at session start, write when making decisions',
  '- `.agents/memory/lessons.md` — Write when something unexpected happens',
  '- `.agents/memory/patterns.md` — Write when a reusable pattern is validated',
  '- `.agents/memory/context.md` — Update at session end with project state',
];

/** Shared once-per-session update instruction for source and installed projects. */
const UPDATE_INSTRUCTIONS = [
  '## Framework updates',
  '',
  'Once per session, check the installed framework before starting project work. If this is the BMAD+ source checkout, use `node tools/cli/bmad-plus-cli.js update-check --json`; otherwise use `npx --no-install bmad-plus update-check --json` from the project root.',
  'If the command is unavailable or the result is off, unknown, offline or stale, continue the user task. Do not install a CLI just to perform this check or claim that an offline version is current.',
  'When `updateAvailable` is true and `canAutoApply` is true, run the same CLI with `update --latest --auto`. This follows the project update policy; it does not grant permission to expand that policy.',
  'When an update is available but automatic application is not eligible, explain the version and reason. An explicit request to update can be fulfilled with `update --latest --yes`; do not change the policy, overwrite customized files, or resolve conflicts without the user request covering that action.',
  'After a successful update, reread the project spine and relevant installed skills, or start a fresh session if the client cannot reload them. Respect preserved local instructions. Check only once even when several adapters include this section.',
];

const PROJECT_INSTRUCTIONS = [
  '## Skills',
  '',
  '- Installed projects load skills from `.agents/skills/`; in this repository the sources live in `src/bmad-plus/skills/` and `src/bmad-plus/agents/`.',
  '- Each agent has a SKILL.md with capabilities, activation protocol, and role-switching rules.',
  '- Auto-activation triggers: `.agents/data/role-triggers.yaml` (source: `src/bmad-plus/data/role-triggers.yaml`).',
  '',
  '## Project Structure',
  '',
  '- `src/bmad-plus/` — Custom module (agents, skills, data)',
  '- `monitor/` — Upstream monitoring system (VPS)',
  '- `mcp-server/` — Audit 360° MCP Server',
  '- `osint-agent-package/` — OSINT package',
  '- `upstream/` — BMAD-METHOD reference clone',
  '',
  '## Communication',
  '',
  '- User name: laurent',
  '- Default language: Français for user-facing content, English for code and technical docs.',
  '',
  '## Commit Rules',
  '',
  '- NEVER add "Co-Authored-By: Claude" or any AI co-author attribution.',
  '- The sole author is Laurent Rochetta.',
  '',
  '## Repository Maintenance Rule',
  '',
  'The public README is README-DIST.md, generated by tools/release/publication-content.js. When it changes, you MUST synchronously update all translations in the readme-international/ directory (fr, es, de), which mirror it section by section.',
  '',
  ...MEMORY_INSTRUCTIONS,
  '',
  ...UPDATE_INSTRUCTIONS,
];

/** Tool display/detection metadata; installable tools and paths come from DERIVED. */
const TOOL_METADATA = {
  'claude-code': { name: 'Claude Code', detect: ['.claude'] },
  'gemini-cli': { name: 'Gemini CLI', detect: ['.gemini'] },
  antigravity: { name: 'Antigravity', detect: ['.gemini/antigravity'] },
  cursor: { name: 'Cursor', detect: ['.cursor'] },
  'codex-cli': { name: 'Codex CLI', detect: ['.codex'] },
  opencode: { name: 'OpenCode', detect: ['.opencode'] },
  aider: { name: 'Aider', detect: ['.aider.conf.yml'] },
};

module.exports = { PROJECT_INSTRUCTIONS, MEMORY_INSTRUCTIONS, UPDATE_INSTRUCTIONS, TOOL_METADATA };
