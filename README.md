# BMAD+

[![Version](https://img.shields.io/badge/version-0.23.1-blue)](https://www.npmjs.com/package/bmad-plus)

**Version 0.23.1** · Node.js `>=20.0.0` · MIT

Ten packs of project-local AI roles and workflows (design, SEO, GRC, OSINT, memory) with ask-first intake, swarms under a budget, safe updates and adapters for seven AI coding tools

[Website](https://bmad-plus.rochetta.fr/) · [Get started](https://bmad-plus.rochetta.fr/docs/#start) · [Examples](https://bmad-plus.rochetta.fr/docs/#examples) · [What’s new](https://bmad-plus.rochetta.fr/docs/#news)

BMAD+ installs project instructions, roles and workflows for your existing AI coding tool. Default execution is host-managed: your tool supplies the model, permissions, command execution and any parallel-agent capability. Nexus can also launch an explicitly planned local command or Codex CLI process under a foreground supervisor, record its result and require independent checks before acceptance. Host permissions still apply; there is no background scheduler or universal host lifecycle integration. Model subscriptions and API access are separate.

BMAD+ ships ten packs. Ask first: `bmad-plus intake` asks a pack’s questions a few at a time, proposes defaults, records what you do not know and renders the brief the pack then works from. Swarms: `bmad-plus swarm` deals simulated units, briefs one sub-agent each, validates every answer and counts only the valid ones, within a budget you set. Atelier, the design engine of the Design pack, builds, audits and redesigns interfaces under checkable rules.

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
npx bmad-plus@0.23.1 install
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
Sentinel, review this change against the acceptance criteria. Check the main success and failure paths, report remaining issues and summarize what the next session needs to know. If the BMAD+ CLI is available, seal the scope with bmad-plus review scope, apply the rules in its checklist, quote the code of every finding, account for every selected file, then report what bmad-plus review gate answers.
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
| SEO | Classic SEO and GEO, visibility in AI-generated answers: technical inspection and performance (Scout), content quality, structured data and AI-search readiness (Judge), scoring, strategy and reporting (Chief). |
| Memory | Project notes, decision records and session handoffs that preserve useful context. |
| Dev Studio | Specialized roles and workflows for product planning, design, engineering and documentation. |
| Backup | Instructions and utilities for timestamped backups, restoration and rotation. |
| Animated | A focused workflow for creating video-driven scrolling websites. |
| Design | Atelier, the design engine: build, audit and redesign interfaces under checkable rules, with an intake first. |

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

### Design a screen with Atelier

Use with the optional Design pack installed. Atelier asks its questions first, then follows checkable rules.

```text
Atelier, run the design read for the invoice list of my app, build the screen, and end with the pre-flight verdict.
```

Expected result: the recorded design read, the screen with every state covered, and the pre-flight verdict quoted as the last line.

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

## What’s new in 0.23.1

A truer site, steadier commands

The documentation site is rebuilt in four languages with seven videos. Several commands now behave exactly as their pages say: refusals read the same everywhere, a workspace review starts from HEAD, and the config file is plain YAML. Installing and updating work as before.

- The website now carries 52 documentation pages, each in English, French, Spanish and German, a rebuilt landing page and seven presentation videos with captions and described transcripts, including a case study of how the site itself was rebuilt with a swarm of agents.
- An --auto update that the policy does not allow is refused with the same message everywhere: Update refused: automatic-updates-not-authorized. The refusals for a legacy ownership inventory and for local conflicts use the same Update refused: form.
- bmad-plus review scope --workspace starts from HEAD when you give no --base, so reviewing uncommitted work no longer fails or drags in the last commit.
- _bmad/config.yaml is written as plain YAML (auto_role_activation: true, not a tagged !!bool 'true') whichever supported js-yaml version wrote it.
- The generated instruction files tell the assistant to skip the version check, without mentioning it, when npx finds no local copy of bmad-plus; Nexus errors carry the Nexus: prefix once instead of twice.
- Shield names PCI DSS v4.0.1 everywhere, the swarm skills say there are three kinds, the Backup pack’s Bash variant prints the archive size like its PowerShell variant, and the npm description, keywords and README credits are refreshed.

## Version History

These dates identify reviewed CHANGELOG notes, not npm publication dates. The website verifies npm publication dates separately.

| Version | Release-notes date | Reviewed summary |
| --- | --- | --- |
| 0.23.1 | 2026-10-19 | The documentation site is rebuilt in four languages with seven videos. Several commands now behave exactly as their pages say: refusals read the same everywhere, a workspace review starts from HEAD, and the config file is plain YAML. Installing and updating work as before. |
| 0.23.0 | 2026-10-17 | A pack now declares the questions it needs answered before it acts, and Nexus can run a swarm of sub-agents, a simulated panel or a jury, within a budget you set. Atelier, the design engine, joins as the tenth pack. Installing and updating work as before. |
| 0.22.0 | 2026-09-29 | BMAD+ now declares every way it sends data or starts a process, and its CI refuses anything undeclared. The recipe page and the SEO report load nothing from other sites, OSINT calls are HTTPS-only, and Shield gains an evidence-bound assurance case and an AI processing register. Nothing changes in how you install or update. |

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

**Written by Laurent Rochetta**
- **Core extensions** — Autopilot, Parallel and Sync (0.1.0), the Nexus durable execution (0.15.0), human acceptance recipes (`uat`, 0.16.0), checkable reviews (0.19.0), and in 0.23.0 the pack intake (`bmad-plus intake`) and the swarm runtime (`bmad-plus swarm`) with the registry fields and the trigger gate that feed them
- **Dev Studio** — 6 specialized SDLC agents: Miriam (business analyst), Huldah (tech writer), Yosef (product manager), Rachel (UX designer), Bezalel (system architect), Oholiab (senior engineer) — 38 workflows, written as original BMAD+ instructions; the persona names and workflow lineage acknowledge BMAD-METHOD 6.6.0 (MIT). The pack ledger is `src/bmad-plus/packs/pack-dev-studio/upstream-sync.yaml`
- **Maker** — design, build, validate and package your own BMAD+ agents (2026-03-17)
- **Design** — Atelier, built on the author’s own public npm package [design-skill](https://github.com/lrochetta/design-skill) (MIT): the package supplies the three skills and their rules, BMAD+ adds the persona, the intake and the routing
- **Memory** — Zecher agent for persistent cross-session memory, with a project scanner and brain detection; the Karpathy guardrails it carries are adapted, see below
- **SEO** — 3 agents (Scout, Chief, Judge), 6-phase audit pipeline, PageSpeed perfection loop, Google Search Console & GA4 integrations; version 2.0 rebuilt the first SEO audit agent, written under Oveanet, and kept its PageSpeed playbook
- **Backup** and **Animated** — timestamped project backups, and video-driven scrolling websites; written under Oveanet, Laurent Rochetta’s company, and merged into BMAD+ in 0.2.0 (2026-03-18) together with the first SEO agent

**Derived from BMAD-METHOD** (MIT)
- **BMAD-METHOD** by [bmad-code-org](https://github.com/bmad-code-org/BMAD-METHOD) — original multi-agent methodology (MIT); BMAD+ is an independent derivative, not an official release
- **Core** — Atlas, Forge, Sentinel and Nexus: BMAD+ began as a fork of BMAD-METHOD 6.2.0 and was extended by Laurent Rochetta (see Core extensions above). The four personas follow its persona format and keep part of the wording of its analyst (Atlas), architect (Forge), QA (Sentinel) and scrum master (Nexus) personas; merging roles into one switchable persona and auto-activation are BMAD+ additions

**Adapted from other open-source projects**
- **Shield** — 27 compliance agents + 11 workflows adapted from [Hemant Naik's GRC skills](https://github.com/Sushegaad/Claude-Skills-Governance-Risk-and-Compliance) (MIT), with their 79 reference files; the GDPR and EU AI Act workflows also draw on the architecture of the [Lawve.ai](https://lawve.ai) skills catalog (Oliver Schmidt-Prietz). The orchestrator, cross-framework mapping, report templates, assurance case, AI processing register and compliance review rules are BMAD+ additions
- **OSINT** — pipeline and Python helpers adapted from [smixs/osint-skill](https://github.com/smixs/osint-skill) (MIT); the lawful-basis gate and the legal notice are BMAD+ additions
- **Apify integration** — OSINT helper and inspiration from [Apify agent skills](https://github.com/apify/agent-skills) (upstream declares Apache-2.0; see notices)
- **Karpathy Guardrails** — Memory adaptation of [community guidelines by forrestchang](https://github.com/multica-ai/andrej-karpathy-skills), inspired by Andrej Karpathy (MIT declared upstream)
