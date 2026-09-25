# BMAD+

[![Version](https://img.shields.io/badge/version-0.18.0-blue)](https://www.npmjs.com/package/bmad-plus)

**Version 0.18.0** · Node.js `>=20.0.0` · MIT

Project-local AI development workflows with clear roles, shared context, safe updates and coding-tool adapters

[Website](https://bmad-plus.rochetta.fr/) · [Get started](https://bmad-plus.rochetta.fr/docs/#start) · [Examples](https://bmad-plus.rochetta.fr/docs/#examples) · [What’s new](https://bmad-plus.rochetta.fr/docs/#news)

BMAD+ installs project instructions, roles and workflows for your existing AI coding tool. Default execution is host-managed: your tool supplies the model, permissions, command execution and any parallel-agent capability. Nexus can also launch an explicitly planned local command or Codex CLI process under a foreground supervisor, record its result and require independent checks before acceptance. Host permissions still apply; there is no background scheduler or universal host lifecycle integration. Model subscriptions and API access are separate.

Adapters: Claude Code, Gemini CLI, Antigravity, Cursor, Codex CLI, OpenCode, Aider.

## Get started

Requires Node.js `>=20.0.0`. Optional packs may need additional runtimes or API access. Run terminal commands from your project folder.

### 1. Open your project folder

Use a terminal in the repository you want to work on, then check your Node.js version. Keep your usual version control workflow.

**In your project terminal:**

```sh
node --version
```

The command should report v20 or newer. Install or update Node.js separately if needed.

### 2. Install BMAD+ and choose your tools

Run the installer. Select the adapters for the AI tools you use and the packs your project needs. Core contains Atlas, Forge, Sentinel and Nexus.

**In your project terminal:**

```sh
npx bmad-plus@0.18.0 install
```

The installer creates the agent instructions, shared project spine and selected tool adapters. Optional packs may need additional runtimes or API access.

### 3. Start a session in that same folder

Open or restart your AI coding assistant in this project so it can load its adapter and AGENTS.md. Ask it to show the installed agents and workflows.

**In your AI assistant:**

```text
bmad-help
```

There is no extra BMAD+ initialization command after installation. bmad-help is a message to the assistant, not a terminal command.

### 4. Give one role a concrete task

Describe your goal, constraints and expected result. For a new idea, start with Atlas. For an existing code change, start with Forge.

**In your AI assistant:**

```text
Atlas, help me define a small invoicing app for freelancers. Ask about the users, identify the first useful workflow and write a brief with acceptance criteria.
```

Review the brief before asking Forge to implement one story. A clear deliverable makes progress easier to verify.

### 5. Review the result and preserve context

Ask Sentinel to check the change against its acceptance criteria. Ask for test evidence and a short handoff so the next session can continue.

**In your AI assistant:**

```text
Sentinel, review this change against the acceptance criteria. Check the main success and failure paths, report remaining issues and summarize what the next session needs to know.
```

Read the changes and test results. The assistant follows the permissions and capabilities of its host tool.

## Core roles

| Role | Focus | Purpose |
| --- | --- | --- |
| Atlas | Strategy & product | Decide what deserves to be built. |
| Forge | Architecture & development | Make the plan concrete. |
| Sentinel | Quality & review | Look for what the first pass missed. |
| Nexus | Planning & coordination | Keep the work moving together. |

## Packs

| Pack | What it provides |
| --- | --- |
| Core | Strategy, architecture, development, quality and coordination through the four core roles. |
| OSINT | Investigation workflows for gathering public information and assessing sources. |
| Maker | A workflow to design, validate and package your own BMAD+ agents. |
| Shield | Specialized compliance and governance workflows, including GDPR and ISO 27001. |
| SEO | Technical scanning, content analysis and search optimization workflows with supporting tools. |
| Memory | Project notes, decision records and session handoffs that preserve useful context. |
| Dev Studio | Specialized roles and workflows for product planning, design, engineering and documentation. |
| Backup | Instructions and utilities for timestamped backups, restoration and rotation. |
| Animated | A focused workflow for creating video-driven scrolling websites. |

## Examples

### Turn an idea into a first release

Use after you have described the users and the problem.

```text
Nexus, plan the first usable release of my appointment-booking app. Have Atlas define scope, Forge propose the smallest implementation and Sentinel define acceptance checks. List dependencies and stop at the plan review before implementation.
```

Expected result: a prioritized plan with a small first story and explicit review points.

### Fix a bug in an existing project

Include the failing behavior, steps to reproduce and any relevant error output.

```text
Forge, investigate why saving an edited invoice creates a duplicate. Reproduce the issue, trace the cause and propose the smallest fix. Add a regression check for the real failure, then ask Sentinel to review the affected flow.
```

Expected result: a reproduced failure, a focused fix and evidence that the regression is covered.

### Coordinate independent work

Use when your host supports parallel agents and the tasks do not write to the same files.

```text
Nexus, split the approved work into independent tasks. Give each role a scope, owned files and a definition of done. Use parallel agents only if this host supports them; otherwise run the tasks sequentially. Integrate the results and have Sentinel check the whole user flow.
```

Expected result: bounded assignments, explicit dependencies and one integrated review. Parallel execution comes from the host tool.

### Have a person confirm a delivery

Use when a version reaches your test environment and someone must check it on screen.

```text
Sentinel, write the acceptance recipe for this delivery on our test environment. One step per gesture, one verifiable fact per line, on-screen labels quoted from the code, and mark the steps that write for real. Build the page, then tell me the link, how long it takes and what I must not skip. Use disposable test data when possible, name the exact folder and files each command changes, and keep automated evidence separate from the person’s answers. Before handing the page over, build it with uat build, check the guarantees it lists, play the essential pass yourself in a real browser — start, tick, type a remark, reload, everything back — and tell me which checks ran.
```

Expected result: a page a non-technical person can play, and a run the agent reads back to classify every failure before anything is fixed.

### Save a session with Zecher

Use before ending a session, with the optional Memory pack installed.

```text
Zecher, update this project’s memory from the changes and checks we actually completed. Separate implemented, tested, published and still pending work. Record decisions and useful evidence, archive superseded notes without deleting them, and write a short prompt for the next session. Keep project memory local and exclude secrets.
```

Expected result: a concise current context, a dated session handoff and a restart prompt that identifies the next unfinished task.

### Read a test run without guessing

Use when a person has completed or stopped an acceptance run.

```text
Sentinel, read the latest acceptance run and compare its fingerprint with the current recipe. Ask what actually happened when answers and evidence disagree. Classify failures before proposing fixes, verify writing steps read-only, and distinguish human observations, automated checks and any explicit risk decision by its named owner. Never mark an unperformed step as passed.
```

Expected result: a clear verdict, evidence for confirmed writes and a short list of checks still requiring action.

### Resume without losing decisions

Use at the start of a later session in the same project; no optional pack is required.

```text
Read AGENTS.md and the available project memory. Summarize the last verified state, open decisions and the next unfinished task. Distinguish released features from local candidates, and automated checks from human acceptance. Check that the notes still match the code before continuing.
```

Expected result: a short, evidence-based restart. Project notes are useful context and still need to be checked against the current work.

## What’s new in 0.18.0

Acceptance pages that keep every answer

The acceptance page now verifies every save, restores your answers on reload before anything else, keeps runs from other revisions and other tabs apart, and names sixteen guarantees the build refuses to lose. Nothing changes in how you install or update; rebuild your recipe pages to get the new page.

- A write to the browser counts only once it reads back. A refused save (quota, private window, blocked storage) is named on the page, questions leaving, and the export stays available — the page never says saved on its own word.
- Your answers come back on reload before the local server or the artifact database answer, and the newer copy always wins: an older remote copy never overwrites what you just ticked.
- A run that answered another revision of the recipe is offered, not poured in: unchanged lines keep their answers, changed lines are asked again, the earlier run stays untouched and exportable, and the new run records where its answers came from.
- Two tabs or two devices on the same run converge on the latest change and say so. A saved run that cannot be read is reported and exportable, never deleted.
- The progress bar exposes the share of lines answered — answered, not passed — with the seen, not seen and blocked counts; the page says where answers live and what can make them disappear.
- Finishing with unanswered lines is questioned on the page itself and confirmed with a second click; a finished run says it is not an acceptance, and a change made after finishing is dated and shown.
- uat build lists the sixteen guarantees the page carries and refuses a template that lost one; uat serve refuses an older copy of a run and any host name but its own. A name with no Latin letters signs its run with a stable hash.
- The acceptance skill tells the agent to build the page with the command, never write it by hand, play the essential pass in a real browser before handing it over, and say which checks ran. The page strings gain twenty-two sentences in ten languages.

## Version History

These dates identify reviewed CHANGELOG notes, not npm publication dates. The website verifies npm publication dates separately.

| Version | Release-notes date | Reviewed summary |
| --- | --- | --- |
| 0.18.0 | 2026-09-25 | The acceptance page now verifies every save, restores your answers on reload before anything else, keeps runs from other revisions and other tabs apart, and names sixteen guarantees the build refuses to lose. Nothing changes in how you install or update; rebuild your recipe pages to get the new page. |
| 0.17.1 | 2026-09-24 | Installing over a different version now stops and points to update, re-installs keep your settings, and updates remove files a version no longer ships while keeping a restorable backup. Some install behaviors changed; review your scripts before rerunning them. |
| 0.17.0 | 2026-09-22 | Acceptance pages now prevent silent answer loss and empty exports, recipes build by their own identifier, and project release checks work directly with Node on Windows. Guides add practical prompts for reading results and preserving project context. |

[Release history and update guide](https://bmad-plus.rochetta.fr/docs/#changelog) · [All published npm versions](https://www.npmjs.com/package/bmad-plus?activeTab=versions)

---

## License

MIT — Based on [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) (MIT)

BMAD+ is an independent community project derived from BMAD-METHOD (MIT) by BMad Code, LLC. It is not affiliated with, endorsed by or certified by BMad Code, LLC. BMad™ and BMad Method™ are trademarks of BMad Code, LLC; see the [BMad trademark guidelines](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/TRADEMARK.md).
Bundled source attributions and terms: [Third-party notices](THIRD-PARTY-LICENSES.md).

The OSINT pack is governed: researching a named person requires a recorded purpose and legal basis. See the [OSINT legal notice](osint-agent-package/skills/bmad-osint-investigate/osint/references/gdpr-osint.md).

Translations: [Français](readme-international/README.fr.md) · [Español](readme-international/README.es.md) · [Deutsch](readme-international/README.de.md)

### Credits

**Creator**
- **BMAD+** Created by [Laurent Rochetta](https://github.com/lrochetta) ([LinkedIn](https://www.linkedin.com/in/laurentrochetta/))

**Original Packs** (created by Laurent Rochetta)
- **Dev Studio** — 6 specialized SDLC agents: Miriam (business analyst), Huldah (tech writer), Yosef (product manager), Rachel (UX designer), Bezalel (system architect), Oholiab (senior engineer) — 38 workflows covering the full lifecycle from brainstorming to deployment
- **SEO Engine** — 3 agents (Scout, Chief, Judge), 6-phase audit pipeline, PageSpeed perfection loop, Google Search Console & GA4 integrations
- **Memory Pack** — Zecher agent for persistent cross-session brain with project scanner

**External Sources & Inspirations**
- **BMAD-METHOD** by [bmad-code-org](https://github.com/bmad-code-org/BMAD-METHOD) — Original multi-agent methodology (MIT)
- **Shield GRC** — 27 compliance agents + 11 workflows adapted from [Hemant Naik's GRC skills](https://github.com/Sushegaad/Claude-Skills-Governance-Risk-and-Compliance) (MIT)
- **OSINT Pipeline** based on [smixs/osint-skill](https://github.com/smixs/osint-skill) (MIT)
- **Apify integration** — OSINT helper and inspiration from [Apify agent skills](https://github.com/apify/agent-skills) (upstream declares Apache-2.0; see notices)
- **Karpathy Guardrails** — Memory Pack adaptation of [community guidelines by forrestchang](https://github.com/multica-ai/andrej-karpathy-skills), inspired by Andrej Karpathy (MIT declared upstream)
