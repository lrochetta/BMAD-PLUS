# Changelog

All notable changes to BMAD+ will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.18.0] - 2026-09-25

### Added

- **The acceptance page names what it guarantees, and the build refuses a template that lost one.** `uat build --json` lists sixteen page guarantees (`hidden-before-start`, `verified-local-write`, `honest-save-status`, `save-on-every-change`, `restore-before-capabilities`, `revision-guard`, `other-tab-notice`, `unreadable-draft-kept`, `progress-accessible`, `storage-explained`, `finished-is-not-accepted`, …); a template missing one is not built. A jsdom suite replays every scenario of the FormaPro incident of 2026-09-25 — start, tick, note without blur, immediate reload, storage refused, unreadable draft, amended recipe, two tabs, artifact database precedence, local server — and `tools/qa/uat-page-browser-check.js` walks the essential pass in Chromium, because the original defect lived in the stylesheet.
- The page offers a run that answered another revision of the recipe instead of pouring it in: identical lines keep their answers, changed lines are asked again, the earlier run stays untouched and exportable, and the new run records `carriedFrom`. Another run can be started while the previous one stays saved; the resume list shows the newest copy of each run first, with its progress.
- Finishing with unanswered lines is questioned on the page itself and confirmed by a second click, never through a dialog a host may swallow. A change after finishing is kept, dated, and said on screen. A blocked line asks "What stopped you?"; a note already written stays in view whatever the answer became.
- `uat serve` refuses an older copy of a run (409), any host name but its own (403), and prints the port it actually bound. A tester whose name has no Latin letter signs the run with a stable hash instead of "anonymous".
- The skill carries the contract: an agent builds the page with the command, never writes it by hand, plays the essential pass in a real browser before handing the page over, tells the tester where the answers live, and says in the delivery which checks ran.

### Fixed

- **The acceptance page could say "saved" without a verified write.** A refused write to the browser (quota, private window, blocked storage) was swallowed and the status still read saved. A write now counts only once it reads back — the run and the pointer that finds it — and a failed save shows a persistent warning, questions leaving the page, and keeps the export available. A failed remote copy is reported as such, with the local copy kept.
- The browser's copy of a run is restored synchronously on reload, before the local-server probe and the artifact database answer or hang; an older remote copy no longer overwrites a newer local one, and a newer remote one is adopted and written back to the browser.
- A stored run that cannot be read is reported and exportable, never deleted in silence. Two tabs on the same run converge on the latest change, and the page says so.
- The progress bar exposes the share of lines answered as an accessible `progressbar` — answered, not passed — next to the seen / not seen / blocked counts, and the page explains where answers live and what can make them disappear. Finishing says it is not an acceptance. The diacritics range in run ids is written as escapes so a charset hop cannot corrupt it.
- `update`, `update --latest` and `update-check` run outside an installed project now say which folder they looked in and how to run them from the project folder (or with `--directory`), instead of a raw `ENOENT` error or an unexplained `invalid-installation` status. `update-check --json` keeps its JSON on stdout and writes the guidance to stderr.
- The release workflow's npm verification now reports the integrity npm actually served, so a registry availability delay can no longer read as a different archive.

## [0.17.1] - 2026-09-24

### Changed
- **`install` no longer overwrites a different installed version.** A downgrade is refused; an upgrade stops and points to `bmad-plus update`, which keeps backups and restorable receipts. Re-installing the same version only adds what is missing. Scripts that re-ran `install` to change versions must call `update` instead.
- **`--packs` and `--tools` add to the previous installation** instead of replacing it. An unknown pack or tool ID now fails before anything is written, and the error lists the valid IDs.
- **Unattended installs default to English.** Without a terminal, the communication language comes from `--lang`, then from the system locale, then English. `--yes` with no detected AI tool writes no adapter files.
- `update` deletes files that a new version no longer ships when you have not changed them; each deletion is backed up in the update receipt and `--restore` brings it back. Files you edited are kept and reported as `modified-orphaned-file`.
- The npm package no longer ships the maintainers' release and maintenance scripts, only the launcher, the CLI and the build modules it needs at runtime. The archive is smaller; installed projects are unaffected.
- The OSINT pack opens with a legal and ethics notice (GDPR lawful basis, platform terms, no private profiling), and Shadow's reports start with an AI-generated, not-legal-advice disclaimer. Shadow is described as governed public-source research; its lawful-basis gate is unchanged.
- The Shield pack and its audit report template carry a shared not-legal-advice notice, an AI-generated banner and a qualified-reviewer sign-off field.

### Fixed
- Re-installing keeps your `_bmad/config.yaml`: existing settings win, missing defaults are added, and an unparsable file is left untouched. The manifest and configuration are written atomically, so an interrupted install cannot leave them half-written.
- A `.bmad/update.lock` left by a crashed process no longer blocks the project: when its owner is provably dead on this machine, the lock is moved aside and taken over. Other stale locks are reported by `doctor`, and the error states the manual remedy.
- `uninstall` accepts `-d`/`--directory` like the other maintenance commands. Help names the program `bmad-plus`, and a subcommand's `--lang` is no longer swallowed by a global option.
- The installer shows each pack with its emoji icon.
- Release automation now waits for npm's publish-time scanning before verifying public archive integrity. Polling is bounded to thirty attempts with thirty-second intervals and a twenty-minute step limit. An unavailable version still blocks the landing, and recovery instructions explicitly forbid uploading the same version again.

### Security
- The development-only `js-yaml` copy used by the coverage tooling is pinned to the patched 4.3.2. The production dependency audit remains clean.

### Documentation
- The French, Spanish and German READMEs mirror the public README section by section. The README states that BMAD+ is not affiliated with BMad Code, LLC, and replaces the BMAD-METHOD comparison with a factual list of what BMAD+ ships.
- The website shows the install command with a copy control in its hero, supports a dark color scheme, folds navigation on small screens and names the supported tools.

## [0.17.0] - 2026-09-22

### Added
- The acceptance skill ships the two project gates it describes: `uat-spec-present.mjs` refuses a version that no recipe names, and `uat-release-gate.mjs` refuses a deployment whose recipe has no finished, current and classified run. Both need only Node, read the gate's own answer rather than guessing from an exit code, and report a gate that could not run as exactly that — never as a pass. `templates/README.md` carries the wiring.

- BMAD+ submits to its own gate. Its recipe describes what a person walks in a fresh project — install, roster, doctor, one workflow, an acceptance page, update awareness, and an uninstall that keeps the project's memory. Recipes, runs and triage stay on the maintainer's machine under `recettes/`: they carry local paths and terminal output, so git ignores the folder, the public mirror scrubs it and npm never packs it. A versioned `.husky/pre-push` hook refuses to push a `v*` tag — the push that publishes — unless `npm run uat:spec` and `npm run uat:gate` pass on that machine.
- The skill ships `templates/example-uat-spec.json`, a complete specification to copy, with a witness and its proof, a writing step and its read-only confirmation, and a positive control. A test keeps it passing the lint it teaches.

### Changed
- Public guides and generated npm documentation explain the acceptance fixes, include prompts for reviewing results and maintaining project memory, and stay synchronized in English, French, Spanish and German. The landing links to the official public source from its menu, footer and discovery assets.
- Release checks distinguish automated evidence, human observations and an explicit `accept-risk` decision by a named owner. A blocked expectation cannot be presented as observed merely because it was classified.

### Fixed
- The distribution scrub now covers every maintainer adapter declared in the registry, including Codex, Cursor, OpenCode and Aider root files. Installed product templates remain available. A registry-derived regression check guards future adapter additions.
- **A blocked expectation can no longer pass the gate on a classification alone.** Nothing was observed, so explaining why establishes nothing about the product: the gate now requires a replay, or an `accept-risk` decision signed with `decidedBy`. The second run of BMAD+'s own recipe had 17 of 21 expectations blocked, all rightly classified as recipe defects — and would otherwise have passed.
- `uat build <id>` finds a recipe by its id whatever its file is called: the shipped `example-uat-spec.json` holds `example-1.0.0`, and building it by id used to report that no spec existed.
- **The acceptance page could discard a whole run in silence.** Classes that set `display` overrode the `hidden` attribute, so the steps showed before any run existed; a tester could tick and annotate every step, nothing was recorded, and "Save the JSON" exported `null.json`. The page now hides what must stay hidden whatever a class says, refuses to record, finish or export before a run starts, and says so where the tester is looking. Pages served inside claude.ai were protected by the host's own stylesheet, which is why the defect only appeared through `uat serve` and local files — it also affects 0.16.0.
- The page's progress bar shows one segment per step — green seen, red not seen, orange blocked, grey skipped — with the tester and the finish date ("Run by laurent · finished on 2026-09-16") and each count spelled out; a segment jumps to its step.
- A command in a "Do" line copies itself on click, and the lint warns when punctuation follows a command: testers had copied `doctor.` from a sentence into their terminal.
- The installer's test-environment question is translated into the ten installer languages.
- The skill asked for `recette.mode` while installation writes a `uat` block; it now names `uat.mode` and states that an absent block means `advisory`, which is what an updated project has until its configuration is extended by hand.
- The release gate ran the CLI through `npx`, which cannot be spawned without a shell on Windows: the gate reported `spawnSync npx.cmd EINVAL` instead of a verdict. It now runs the CLI's own entry point with the Node that started it, taken from `--cli`, from `BMAD_PLUS_CLI`, or from the project's `node_modules`, and says plainly when there is none.
- `autoconfig` no longer takes a health argument it never read.

## [0.16.0] - 2026-09-16

### Added
- Human acceptance recipes (recette): `bmad-plus uat` (alias `bmad-plus recette`) turns a delivery into a self-contained page a person plays step by step, and turns their answers into evidence the agents read. Actions: `lint`, `build`, `serve`, `import`, `read`, `gate`, `order`.
- Three versioned schemas ship with the skill: `bmad-plus/uat-spec/2` (what the agent writes), `bmad-plus/uat-results/2` (one run, never modified afterwards) and `bmad-plus/uat-triage/1` (how each failure was classified and decided).
- `uat lint --src <dir>` refuses a spec whose quoted on-screen label exists in no source file, a step that writes without its read-only confirmation, markup outside the allowlist, a witness that names an unknown step, and warns when a page exceeds its step or duration budget.
- The page reports per expectation: seen, not seen, blocked, or skipped for an optional step, with a note attached to the expectation rather than the whole step. It carries the SHA-256 of the specification it was built from, so a run always states which revision it answered.
- Answers reach the project three ways with the same result document: `uat serve` writes them into the repository at every tick over the loopback interface; a Claude artifact saves them in its own database; a local file exports or copies the JSON for `uat import`.
- `uat gate` passes only when the latest run is finished, answers the current revision, leaves no expectation unanswered, has every failure classified with a decision, and has every passed writing step confirmed read-only. `--emit-check` writes a self-contained verifier for a Nexus task, so its hash covers the whole check.
- The page ships the ten languages of the installer, opens in the recipe's language, otherwise the project's `communication_language`, otherwise English, and lets the tester switch on the page. Hebrew renders right to left.
- Sentinel gains a Recette role with three capabilities (build, read and triage, gate), auto-activation triggers, and the skill `bmad-plus-uat` installed with Core.
- `_bmad/config.yaml` carries a `uat` block. Installation asks once for the test environment. `advisory` (the default) produces and offers the page at every delivery and never blocks; `gate` makes the delivery checkpoint wait for a passing gate; `off` produces no recipe and says so in the delivery report.
- Specifications and runs written for the standalone FormaPro kit (`recette-interactive/1`) are read without conversion.

### Changed
- Autopilot and the orchestrator draft acceptance steps per story, finalize, deliver and read the recipe during Ship, and quote the run in the delivery report — figures, tester, what stays open.
- Dev Studio: a story states which acceptance criteria a person can observe and where; the acceptance matrix accepts the evidence status "awaiting human recette", which no implementer claim can replace; the delivery checklist requires the run to be read and classified first.

### Evidence and limits
- 41 tests cover the library and the command in a separate process, including the gate refusing an unfinished run, a stale one, an unclassified failure, an undecided classification and an unconfirmed write.
- A real human run through `uat serve` was recorded end to end: answers stored at every tick, the downloaded file byte-identical to the project's, and the gate refusing a ticked writing step whose write was never confirmed.
- A recipe establishes that a person saw a screen; it is labelled human-observed. The gate proves the run is complete, current and classified — never that the tester looked at the right place.
- The design is shaped by eight real runs on one product: of seventeen "not seen" answers, eleven were defects of the recipe itself, four of the product, two undecided, and one step ticked nine times out of nine had written nothing. Those figures come from a single product and are not a general measurement.

## [0.15.0] - 2026-09-11

### Added
- `nexus` manages durable project-local runs and attempts, with dependency and write-scope validation, exact host/session bindings, current-artifact checks, bounded retries and explicit interruption/cancellation reconciliation.
- Optional `nexus launch` supervises an explicitly planned command or Codex CLI process in the foreground. Independent clients inspect and collect exact attempt receipts; only the original supervisor controls its direct child. Host-managed attempts remain the default, and host permissions still apply.
- `mem observe` binds an exact project memory section to an accepted, currently verified Nexus result. Opt-in evidence ranking rechecks sources, scopes, artifacts, supersession and explicit contradictions before using a bounded relevance boost; ordinary lexical recall remains available.
- A registry-driven scored evaluation gate covers all nine packs with sealed deterministic replays and completion-only/interrupted negative controls. Repeated native campaigns record every planned attempt and keep replay validation separate from model observations.
- Release artifacts include a CycloneDX production dependency SBOM and integrity manifest. Publication uses the exact checked npm archive and verifies registry integrity before the dependent landing deployment.
- The evaluation backend loads the actual selected agent and declared resources, preserves effective inputs and result evidence, and distinguishes mock, rendered-response and native-host execution. A native harness prepares isolated task packets and independently scores resulting artifacts.
- Three paired native tasks cover cache contracts, stale CLI consumers and review false positives. All six observations passed, with 3/3 for both generic and selected-agent contexts; this small pilot demonstrates no quality advantage.

### Changed
- Forge, Sentinel and Nexus use proportionate investigation, evidence-backed review, consumer verification and bounded repair. Selected original adaptations are mapped to pinned BMAD-METHOD 6.12 sources; the declared baseline remains 6.6.0.
- Autopilot and parallel instructions use durable Nexus receipts while preserving host ownership, existing authorization and useful interrupted work.

### Fixed
- Completion prose, a zero worker exit or stale test evidence cannot satisfy current critical acceptance checks.
- Nexus verifier environments exclude inherited interpreter hooks and credentials; unsafe older verification receipts require fresh checks.
- Native evaluation collection is reserved exclusively before grading and publishes one complete receipt atomically. Check output capture is bounded, with explicit overflow, timeout and partial-stream evidence.
- Maintained Python dependency audits now block CI. Patch proposals remain visible for the separately frozen private MCP stack, whose known findings remain in an explicit advisory audit.
- Bundled third-party notices preserve upstream attribution, correct Shield provenance and distinguish declared licenses from missing upstream notice files. npm OIDC authentication remains separate from npm provenance, which is not enabled for the private build/mirror arrangement.
- Python interpreter caches are excluded from source installation and npm archives; executing a local toolkit no longer adds generated bytecode to managed framework files.

### Evidence and limits
- The nine scored replays and eighteen negative controls test the evaluation checks and failure handling; they make no model calls and do not establish model quality.
- The fixed 24-case English/French memory retrieval corpus reports 12/24 correct for lexical ranking and 24/24 for evidence ranking. This synthetic corpus includes explicit stale/conflicting cases; downstream LLM quality and causal improvement remain unmeasured.
- A real Codex CLI smoke attempt started and returned a transcript, but its host denied the requested file write. Independent verification failed and acceptance was refused. No sandbox bypass, successful Codex file edit, automatic scheduling or orphan-worker takeover is claimed.

## [0.14.0] - 2026-09-09

### Added
- `studio list` and `studio prepare` resolve installed Dev Studio routes, real instruction contents, input hashes and YAML configuration without executing an agent or writing deliverables.
- Dev Studio supplies original, self-contained procedures for all 38 workflows and six existing personas, with working entry points, declared resources and compatibility guides for earlier step paths.
- Installation diagnostics share one human/JSON report with registry-declared resources, ownership evidence, runtime limits and explicit host-managed execution capabilities.
- Optional `doctor --verify-python` checks a real provisioned environment, supported Python version and required imports within a bounded subprocess. Default diagnostics remain inspection-only.
- English-first public guides with French, Spanish and German translations cover installation, role activation, examples, updates and reviewed release history.
- Release tooling generates the npm README from shared public content, validates every translated candidate guide before publication, and verifies official npm metadata before synchronizing and deploying the website. Landing-only recovery uses the original source revision without republishing npm.

### Fixed
- Memory declares its shipped Node/file-based features; separately deployed MCP/RAG dependencies are no longer provisioned from an absent npm path.
- SEO entry points explain prompts-only operation and mark missing measurements unverified. Incomplete audits omit unsupported scores and use a report format that preserves missing evidence.
- Orchestrator, autopilot and upstream-sync notifications require a configured, authorized channel; ordinary installations report checkpoints in the session.
- The distributed npm README now includes the current reviewed release history and the official `bmad-plus.rochetta.fr` documentation links.

### Quality
- Python runtime paths are checked against package boundaries and the actual npm archive; shipped and tested SEO toolkit copies must match in file inventory and bytes.
- Regression coverage includes missing delivery resources, ownership changes, Python probe failures, unpublished release candidates and stale public content.
- Dev Studio resource graphs, aliases, input requirements, configuration, relocation and customized-file update/restore are checked against real consumer installations. Missing inputs remain explicit; the coding assistant executes the prepared instructions.
- The BMAD-METHOD 6.12 review informs selective original adaptations. The declared upstream baseline remains 6.6; no full 6.12 compatibility or standalone agent runtime is claimed.

## [0.13.0] - 2026-09-08

### Added
- Registry-derived installation now delivers the common agent spine and all seven tool adapters from one renderer, with consistent pack facts and persistent execution settings.
- Published-release discovery with `update-check` (JSON, refresh and offline modes), a 24-hour cache, and explicit project update policies. Notification is the default; automatic updates require an authorized semver range.
- `update --latest` dispatches an exact validated package through npm, rechecks policy and ownership, refuses downgrades and wrong-version children, and requests instruction reload. All generated tool adapters include one check per session.
- Managed-file hash inventories cover agents, skills, pack data and module files. Customized files are preserved; automatic updates refuse conflicts or incomplete legacy ownership. Updates are locked, backed up and recoverable with `update --restore <receipt-id> --yes`.

### Security
- Patch runtime `js-yaml` from 5.2.1 to 5.2.2 for [GHSA-pm4m-ph32-ghv5](https://github.com/advisories/GHSA-pm4m-ph32-ghv5). Production npm audit reports zero vulnerabilities for the validated lockfile.
- Update and install destinations reject redirected paths; restore validates every backup before changing files and preserves subsequent local edits.

### Fixed
- Uninstall preserves project memory, settings, modified pack files, custom IDE instructions and nonempty output. Only identifiable BMAD+ files are removed after checking for symlinks/junctions; legacy installs may retain files whose ownership cannot be established.
- Doctor and uninstall report invalid manifests with failure exit codes. Installation/removal without a terminal requires `--yes`; the npx launcher propagates child launch failures and signals.
- MCP audit entry points validate identifiers and confine filesystem operations before deletion, cloning or metadata writes. Git URL validation is shared across audit and Git tools.
- GitHub requests have connection/read timeouts. RAG ingestion uses the server interpreter and working directory without an undrained stderr pipe.

### Quality
- Distribution security audit explicitly checks production dependencies, matching its production-only install and the CI gate.
- CI now blocks on pinned Ruff correctness checks and MCP tool, evaluation-backend and memory-bridge tests. SEO DNS/HTTP tests use offline fixtures.
- JavaScript regression suite expanded to 709 tests in 31 suites, with all coverage thresholds passing. Python correctness-lint findings removed; mutable argument defaults replaced.
- Source/npm contract verifies 64 installations, 168 generated adapters, complete managed-file hashes and offline update checks. npm execution with Windows path metacharacters is covered by a real offline process test.
- Backlog projection completed with CLI safety, MCP hardening and Python-quality epics. Dependency modernization retains its existing decision gate.

## [0.12.2] - 2026-07-16

### Added — capabilities now actually delivered
- **SEO pack works from npm (was broken-on-arrival for three cycles).** The SEO Python toolkit — `seo_fetch.py`, `seo_crawl.py`, `seo_parse.py`, `seo_apis.py`, `seo_screenshot.py`, `seo_report.py` + `requirements.txt` — is now **embarked** in `src/bmad-plus/packs/pack-seo/scripts/`, so it ships in the npm tarball (`files[]="src/bmad-plus"`) and is copied into user projects by pack-copy. `install.js --provision-python` and `registry.yaml` `python_package` point at the in-pack copy; the SKILL.md's `scripts/*.py` and `agent/*.md` load paths now resolve in the shipped, flat packaged layout. Regression-gated by `tests/unit/seo-pack-shipping.test.js` (asserts every SKILL-commanded script/agent ships and the installer path stays in-pack).
- **SEO agents auto-activate.** `data/role-triggers.yaml` gained a `seo` block (Scout / Chief / Judge) so the three dedicated agents are reachable by keyword, not only by name.
- **Monitor is rebuildable from committed docs.** New `monitor/requirements.txt` pinning the modern **`google-genai`** SDK (matches `ai_analyzer.py`); `DEPLOY.md` installs `-r requirements.txt` (previously installed the deprecated `google-generativeai`) with an import sanity check. Dependabot pip entries added for `/monitor` and `/src/bmad-plus/packs/pack-seo`.

### Fixed
- **Hand-typed count drift (blocking `check:counts`):** `README.md` "360 Tests" → **472** (real suite total), `module.yaml` Dev Studio "30 workflows" → **38**, `pack-shield/SKILL.md` "85 regulatory reference files" → **79** (derived count). `check:counts` now green unarmed and armed (`BMAD_PLUS_TEST_COUNT=472`).
- **OSINT lawful-basis gate reaches every personal-data path (GRC-03, third cycle).** The Phase Router now routes the direct extraction / psychoprofile / contact-enrichment entries through the mandatory Phase −1 Lawful Basis Gate (GDPR Art. 6, plus Art. 9 for psychoprofiling); `osint-investigator.md` and `agent-shadow/SKILL.md` carry an explicit gate rule for the `[LI]/[IG]/[FB]/[PP]/[CE]` menu items. No menu item removed — the gate governs, it does not restrict lawful use. Regression-gated by `tests/unit/osint-lawful-basis-gate.test.js`.
- `SECURITY.md`: supported version `0.7.x` → **`0.12.x`**; runtime dependency count `6` → **5** (matches `package.json`).

### Testing
- **mcp-server security logic is now really tested + gated in CI (QA-02).** The dead `test_server.py` (tautological, asserted on nonexistent `_bmad/bmm/**` paths, ran in no lane) is replaced with 23 tests against a new `mcp-server/security.py` — the password policy, constant-time secret comparison, Basic-Auth parsing, and Bearer-token expiry extracted from `server.py` so they are unit-testable without fastmcp/starlette or runtime env vars. `server.py`'s auth middleware now delegates to these (behavior-identical). A blocking Python pytest lane in `ci.yml` runs them + the SEO toolkit's 69 tests (incl. `TestSSRFProtection`) on every push/PR and, via `workflow_call`, every release.
- **CLI maintenance commands are no longer untested (QA-03).** New `tests/unit/cli-commands.test.js` (11 tests) drives the real `action()` of `uninstall`, `update`, and `doctor` — previously **zero executed lines** — across not-installed exit, full install, corrupt/again-current manifests, confirm/cancel, and a real update that rewrites the manifest. Per-file `coverageThreshold` entries (60–90% lines) make the gap visible to the gate.

### Security
- **SEO crawler redirect-SSRF closed (SEC-02).** `seo_crawl.py` now follows redirects manually (`allow_redirects=False`) with a per-hop `is_safe_url` revalidation shared across all three network paths (`fetch`, `fetch_robots_txt`, `parse_sitemap`) via a `_safe_get` helper — a public URL that 302s to an internal/metadata endpoint is refused. `seo_fetch.py` was already fail-closed.
- `.gitignore`: exclude Graphify graph artifacts (`graphify-out/`, `.graphify/`, `.agents/graph/` — safeguard 7, graph indexes are strictly local) and root `.venv/` / `.pytest_cache/`.

### Verified
- `npm test` **483/483** (21 suites); Python `pytest` **92/92** (mcp-server security 23 + SEO 69); `check:counts` green (unarmed + armed 483); `eslint` 0 errors; `generate.js --check` + `generate-adapters.js --check` no drift; `py_compile` clean; `dependabot.yml` + `ci.yml` valid YAML.

## [0.12.1] - 2026-07-12

### Added
- **Portfolio brain detection** (`memory-init.js`): brain resolution now honors, in order, the `BMAD_PLUS_BRAIN` env var → a `_brain/` directory in the project dir **or any ancestor** (portfolio brain shared by sibling projects under a workspace root) → `~/.bmad-plus/brain` → `~/.claude/memory`. Previously `~/.bmad-plus/brain` always won once it existed, silently splitting memory away from an existing workspace-level brain. `.brain-link` now records a `brain_type` (`portfolio` / `bmad-global` / `claude-memory`). `resolveBrain()` is exported with 4 new unit tests; `pack-memory/shared/memory-protocol.md` documents the portfolio-brain rule.

### Fixed
- **Brain detection state machine (`memory-init.js`) — five defects (audit MEM-01..05 + JS-08):** the `projects/` index was written into `~/.bmad-plus/brain` unconditionally while identity/global-memory creation was skipped whenever any brain was detected, leaving a permanent identity-less "half brain" (now: idempotent `ensureGlobalBrain()` self-heals on every touch); `.brain-link` is now written on creation too (was: detection branch only — non-idempotent re-runs); brain candidates must be directories and `~/.claude/memory` must be non-empty (was: a stray *file* named `_brain` could be linked as a brain); project indexing now only targets the global brain when it is the linked brain (portfolio installs no longer write orphan entries); path hashing unified in `tools/cli/lib/path-hash.js` shared with `scan.js` (drive-letter casing no longer double-indexes projects); `initMemory` takes an injectable `homeDir` and the test suite runs against a temp home (was: every `npm test` polluted the real user brain — 454 junk entries live-confirmed); the install-time call is try/catch-wrapped so a read-only home warns instead of aborting pre-manifest. 15 unit tests. See `audit/2026-07-10/14-addendum-memory-init.md`.
- **GitHub Actions red on master since v0.10.0:** `package-lock.json` was missing `@emnapi/core`/`@emnapi/runtime` entries required by npm 10 (Node 20 runners) — an npm 10 vs 11 ideal-tree divergence invisible to local (npm 11) validation, including fresh clones. Lock regenerated with `npm@10`; **CI + Platform now green on master for the first time**. New standing rule: locks are regenerated with `npx npm@10 install --package-lock-only` and validated with both npm 10 and npm 11 `ci --dry-run`.
- `platform.yml`: the two adapter drift gates (`generate-adapters.js --check` and `--check --adopt`) joined the spine as blocking checks; the eval self-check job now installs its `pyyaml` dependency (it had none on the runner and failed every push).
- Dependabot: removed the dead `docker` entry for `/monitor` (no Dockerfile there — the update job failed every weekly cycle).

### Security — supply chain
- `mcp-server/Dockerfile`: base image now **pinned by multi-arch index digest** (`python:3.11.15-slim@sha256:b27df584…`) — closes the PHASE-1 "Dockerfile digest pin" residual and picks up ~18 months of CPython security patches (3.11.9 → 3.11.15).
- GitHub Actions bumped and SHA-pinned across all workflows: `checkout` v7.0.0, `setup-node` v6.4.0, `setup-python` v6.3.0.
- Python pins raised: mcp-server `uvicorn` 0.49.0, `gitpython` 3.1.50, `pyyaml` 6.0.3, `requests>=2.34.2`; seo-audit-360 `requests>=2.34.2`, `beautifulsoup4` 4.15.0, `lxml` 6.1.1; Google extensions `google-auth` 2.55.1, `google-auth-oauthlib` 1.4.0, `google-analytics-data` 0.23.0, `google-api-python-client` 2.198.0. Validated in clean venvs (install + import/parse smoke).

### Changed — dependency governance
- npm: `eslint` 9 → 10 (flat config; `@eslint/js` now a declared devDependency — it was consumed transitively and broke under eslint 10), `js-yaml` 4 → 5.2.1 (CJS export intact, full suite green), `fs-extra` 11.3.6.
- **Removed `chalk`** — declared but never imported (the CLI uses picocolors); removal beats chasing the ESM-only v5.
- Declined with rationale (dependabot `ignore` rules added): `commander` 15 (ESM-only, requires Node ≥22.12; CLI is CommonJS on Node 20), fastmcp/chromadb/sentence-transformers at ALL levels (deliberate pins — breaking across minors, zero CI coverage; joint upgrade tracked as the mcp-server ML-stack modernization task), `pypdf` majors (5.x removed `PdfMerger`, used by `gamma_report.py`), docker `python` major/minor. Dependabot queue: 26+9 PRs → **0 open**.

### Verified
- `npm test` 333/333 (16 suites); lint 0 errors under eslint 10; both `npx npm@10 ci --dry-run` and `npm ci --dry-run` green; CI + Platform workflows green on GOLDEN master.

## [0.12.0] - 2026-07-02

### Added — Load-bearing activation (north-star Pillars 3, 4, 5)
- **Pillar 4 executable:** `evals/_runner/providers.py` — a provider-neutral model gateway (anthropic / openai / generic-HTTP adapters selected by `BMAD_EVAL_PROVIDER`, default deterministic **mock** so `--self-check` and CI never hit the network). `run_agent(spec, model)` now routes through it; the eval harness genuinely runs (3/3 specs pass).
- **Pillar 3 portable via MCP:** `mcp-server/tools/memory_tools.py` exposes `memory.recall` / `memory.write` / `memory.reinforce` as MCP tools that shell out to the same `bmad mem --json` CLI (single source of truth) — MCP-capable CLIs and the CLI can never diverge. Registered additively in `server.py`.
- **Pillar 5 adopt mode:** `tools/build/generate-adapters.js --adopt` can generate the REAL repo-root adapters + AGENTS.md spine from the registry; hand-authored instructions live in `tools/build/adapters.config.js` and are injected so no tool loses content. `.gitattributes` pins LF on the adopted files (avoids the CRLF drift class). Root adoption is opt-in and NOT applied in this release.

### Fixed
- Adapter `--check` is now EOL-insensitive; `.gitattributes` pins LF on `tools/build/**` + registry so a Windows clone doesn't false-positive drift. Verified from a **fresh clone**: `npm ci` + `npm test` (333/333) + both drift-checks green.

### Verified
- `npm test` **333 passed / 16 suites**; `build:check` + `generate-adapters --check` no drift; `run.py --self-check` 3/3; edited Python parses.

## [0.11.0] - 2026-07-02

### Added — Karpathy loop CLI + multi-CLI adapters (north-star Pillars 3 & 5)
- **`bmad mem` command (Pillar 3):** `recall <query>` / `write` / `reinforce` expose the memory-journal (append/recall + Elo reward + governance guard) from the CLI, so the learning loop is usable from any driving tool. `tests/unit/memory-journal-cmd.test.js`.
- **Multi-CLI adapter generator (Pillar 5):** `tools/build/generate-adapters.js` generates the per-CLI wrappers (CLAUDE.md, GEMINI.md, `.codex/AGENTS.md`, `.cursor/rules`, `.opencode/AGENTS.md`, CONVENTIONS.md) from `registry.yaml` — counts/names computed, never typed — with a `--check` drift gate. Generated previews live under `tools/build/generated-adapters/`. `tests/unit/generate-adapters.test.js`.

### Changed — Compliance (govern, don't cut)
- **CG-02 — OSINT pack governed:** added a mandatory **Phase −1 Lawful Basis Gate** to the OSINT skill (lawful basis Art. 6, Art. 9 condition for psychoprofiles, purpose, retention, DSAR) + a lawful-basis/ROPA record template + a GDPR-OSINT reference + a governance block in the dossier template. The capability is kept in full; lawful use is now explicit and auditable. See `audit/2026-07-01/CG-RESOLUTION.md`.
- **CG-01 — trademark:** `bmad-plus` name kept by owner decision.

### Verified
- `npm test` **325 passed / 16 suites**; `npm run build:check` no drift; `generate-adapters.js --check` no drift.

## [0.10.0] - 2026-07-02

### Added — Platform-spine foundations (north-star Phase 2)
Built as **new files only** (no existing core file modified); test suite grew from 176/10 to **258 passed / 13 suites**. Cut nothing; multi-tool/multi-model preserved.

- **Registry-as-SSOT (Pillar 1) — ACTIVE:** `registry.yaml` (repo root) is now the single source of truth for all 9 packs. `tools/cli/lib/packs.js` is **generated from it** (`npm run build`), no longer hand-maintained. `tools/build/generate.js` provides the generator + `npm run build:check` drift gate; `tests/unit/generate.test.js` (14 tests) proves the generated `PACKS`/`PACK_ORDER`/`EXPECTED_AGENTS` strictly equal the shipped module. This kills the 5-place pack-registry drift at its root.
- **Python provisioning (Pillar 2):** `tools/cli/lib/python-provision.js` — detect python≥3.11, pick uv/pipx/venv, create isolated env, install requirements, verify entry (shell-safe, testable).
- **Karpathy learning layer (Pillar 3):** `tools/cli/lib/memory-journal.js` — `journal.ndjson` append/recall, Elo/decayed reward update (eval+acceptance+ci), governance guard (promotions PROPOSED, never auto-applied).
- **Eval harness (Pillar 4 — the moat):** `evals/` schema + Forge/Shield/Sentinel golden specs + fixtures + `run.py --self-check`, provider-neutral model backend seam.
- **CI:** `.github/workflows/platform.yml` — registry drift-check + eval self-check, blocking, SHA-pinned.

Pillar 1 is wired (packs.js generated + `npm run build`/`build:check`). Remaining integration (provisioning called from install, memory exposed via MCP, generated multi-CLI adapters) lands next as its own tested commit — see `audit/2026-07-01/PHASE-2-STATUS.md`.

## [0.9.2] - 2026-07-01

### Security — Phase 1 remediation (exploitable findings)
- **RCE closed** (`ci_cd.py`): command allowlist now uses exact-token matching (shlex.split) + realpath/commonpath containment instead of prefix/`startswith` — defeats argument injection (`make -f attacker.mk`) and sibling-path bypass; `shell=False` throughout; dead Makefile fallback removed.
- **SSRF hardened** (`seo_fetch.py`): fails **closed** on DNS error, blocks private/loopback/reserved/link-local IPs (incl. IPv4-mapped IPv6), re-validates every redirect hop manually.
- **Stored + DOM XSS closed** (`seo_report.py`, `dashboard.html`): all audited/external values HTML-escaped in the report; dashboard renders via `textContent`/`createElement` + `addEventListener` instead of `innerHTML`/inline `onclick`.
- **MCP server** (`server.py`): constant-time `hmac.compare_digest` for token + dashboard password; app assembled in module-level `create_app()` so `uvicorn server:app` runs with auth intact; dead `verify_mcp_token` removed; rate-limit map eviction.
- **XXE**: `seo_crawl.py` hard-fails without `defusedxml` (no unsafe stdlib fallback).

### Supply chain
- `requests>=2.32.4` (CVE-2024-35195) across all requirements files.
- `PyPDF2`→`pypdf==4.3.1` (dep + consumer import in `gamma_report.py`).
- `defusedxml==0.7.1` added; Dockerfile non-root user + tag pin; docker-compose off `:latest`; GitHub Actions pinned to commit SHAs; Dependabot covers pip + docker + github-actions.

### Fixed — robustness
- Non-destructive install (backs up existing CLAUDE/GEMINI/AGENTS.md); marker-based uninstall; IDE-scoped autoconfig; `doctor` no longer emits false "Missing agent" warnings; guarded manifest `JSON.parse`; Windows-safe project-path hashing; hardened `validateUserName`; lazy RAG model load; async gamma polling; repo-URL validation; `git_ops` path confinement.

### Notes
- Documented residual follow-ups (SSRF crawler-class redirect hops, DNS-rebinding IP pinning, Dockerfile digest pin) are tracked in `audit/2026-07-01/PHASE-1-STATUS.md`.
- Verified: `npm test` 176/176, `npm run lint` 0 errors, all edited Python parses; SEO report smoke-tested (renders + XSS escaped).

## [0.9.1] - 2026-07-01

### Fixed — Credibility (honest status)
- **Real CI on push/PR** (`.github/workflows/ci.yml`): lint + test + npm audit, all blocking. Previously the only workflow ran at release-tag and swallowed failures with `|| echo`.
- **Test harness repaired**: mock ESM `@clack/prompts` so Jest loads the autoconfig suite — `npm test` now genuinely passes (176 tests, 10/10 suites). It did not before.
- **Lint restored**: added flat `eslint.config.js` (ESLint v9); removed legacy `.eslintrc.json` + deprecated `--ext`. `npm run lint` runs with 0 errors.
- **Lockfile resynced** to the correct version with full devDependency tree — `npm ci` works from a clean clone.
- Publish workflow no longer masks `npm publish` failures; npm audit is blocking.
- Removed hardcoded VPS IP from `mcp-server/server.py` docstring.

### Documentation — Honesty correction
- Removed the unverifiable **"143 tests / 0 vulnerabilities / Score A+"** badges from README and README-DIST.
- Fixed the corrupted version-history table (0.9.0/0.8.0 were duplicated).
- **Note on 0.9.0 below:** the "64/64 fixed, score A+" and "auth on all endpoints" claims in the 0.9.0 entry were **overstated**. A 2026-07-01 adversarial re-audit (see `audit/2026-07-01/`) found 102 open findings and re-graded the project **C+**. The MCP token *is* checked by middleware on `/sse` and `/messages/`, but the prior "all endpoints" phrasing and the A+ score were not accurate. This release begins the honest remediation.

## [0.9.0] - 2026-06-24

### Security
- Full audit remediation: 64/64 findings fixed, score C- → A+
- P0: Command injection eliminated (execSync → spawnSync in CLI entry point)
- P0: MCP Server authentication added (token-validated middleware on all endpoints)
- CI/CD hardened: PAT removed, force-push eliminated, npm audit gate blocking
- MCP allowlist hardened, path traversal protection, URL hostname validation
- VPS IP → env var, TLS deployment docs, SSRF/XXE protection
- 0 npm audit vulnerabilities

### Changed
- Shared PACKS module — single source of truth for all 9 packs
- install.js 740→300 lines: extracted memory-init.js + pack-copy.js
- print() → logging, time.sleep → asyncio.sleep, empty catch blocks filled
- Dynamic version in i18n.js (reads from package.json)

### Removed
- Duplicate agents/pack-{seo,animated,backup}/ directories

### Documentation
- Maker + Zecher in all config files, CHANGELOG v0.7.2 added
- French README fix, version history synced to all translations
- 7 audit reports in audit/ folder

### Tests
- 143/143 tests passing

## [0.8.0] - 2026-06-24

### Added
- 3 new packs: pack-animated (web animation agent), pack-backup (universal backup agent), pack-seo (full SEO audit — 15 files with agents, refs, templates, playbooks)
- `extract_frames.py` script for animated-website (263 lines, ffprobe/ffmpeg)

### Security
- P0 remediation: fix command injection, path traversal, token-in-URL, wildcard hosts, error leak (Shield GRC v2.0)
- CI: add npm audit gate with continue-on-error, remove silent-fail pattern

### Changed
- README.de.md: full sync (+131 lines) — Pack System, Autopilot, Project Structure, Credits
- All Torah-named references removed from Dev Studio, module.yaml, READMEs
- Dev Studio: cleaned references in orchestrator, bwml-spec, upstream-sync
- process-info.md: updated (oveanet-pack not in npm package)
- CI: Windows %TEMP% → tmp/ in .npmignore and CI workflow
- Badge shields: version 0.7.5 → 0.8.0 across all 5 READMEs

### Fixed
- Broken TOC anchor links across all 5 READMEs (#the-56-agents)
- oveanet ↔ .agents mirror directories sync (31 files)

### Tests
- 143/143 tests passing ✅

## [0.7.5] - 2026-05-17

### 🩺 Quality & Compliance

### Added
- **MIT LICENSE** — Proper license file matching `package.json` declaration
- **PACKS↔module.yaml sync check** — New Check 9 in `npx bmad-plus doctor` that cross-validates install.js PACKS object against module.yaml packs, preventing invisible pack bugs
- **30 new unit tests** — Total now 97:
  - `scan.js` module validation (markers, skip dirs, options)
  - `autoconfig.js` function checks (detectStack, analyzeStructure, calculateHealth, recommendPacks)
  - `memory.js` subcommand and health score validation
  - PACKS↔module.yaml bidirectional sync (count + key match)
  - LICENSE file integrity
- **Global brain consolidation** — Promoted cross-project wisdom:
  - 1 lesson (PowerShell UTF-8 corruption)
  - 2 decisions (anti-regression protocol, i18n-first CLI)
  - 2 patterns (dual-tier memory, surgical edit protocol)

## [0.7.4] - 2026-05-17

### 🧠 Smart Autoconfig

### Added
- **`npx bmad-plus autoconfig`** — Smart project bootstrap:
  - **Existing projects**: analyzes stack, structure, health; auto-selects packs; populates memory
  - **New projects**: interactive wizard (type + description); initializes everything
  - Auto-preserves existing IDE configs (`--tools none` when configs detected)
  - Writes `context.md` with full project analysis for agent continuity
  - Shows contextual recommendations ("Talk to Forge to...", "Talk to Sentinel to...")

### Fixed
- `--tools none` installer crash (undefined IDE name)

## [0.7.3] - 2026-05-17

### 🎨 Scan UX Improvements

### Added
- **Scan legend** — Color-coded status legend displayed before the project table
- **`--active-days <n>`** — Custom threshold for "active" status (default: 30 days)
- **`--paused-days <n>`** — Custom threshold for "paused" status (default: 180 days)

## [0.7.2] - 2026-05-17
### Fixed
- `scan` command: `bmad-plus scan <path>` now accepts a positional path argument

## [0.7.1] - 2026-05-17

### 🛠️ CLI Commands & Guardrails Injection

### Added
- **`npx bmad-plus scan [path]`** — Interactive project scanner
  - Recursive directory scan with stack auto-detection (Node.js, Rust, Python, Go, PHP, Ruby, Java)
  - Framework detection (Next.js, Nuxt, React, Vue, Svelte, Express, Electron, Tauri)
  - Status tracking (active/paused/archived based on last modified)
  - Interactive validation: index all, select, or skip
  - Auto-generates `projects-index.md` in global brain
- **`npx bmad-plus memory status`** — Memory health report
  - Shows project memory + global brain status
  - Entry counts, last modified dates, health score
  - Brain link detection
- **`npx bmad-plus memory export`** — Export brain as portable Markdown archive
- **Karpathy Guardrails injection** — 4 principles auto-injected into CLAUDE.md/GEMINI.md/AGENTS.md when Memory pack is installed
- **i18n** — Memory + Dev Studio keys for EN and FR (other languages use fallback)

## [0.7.0] - 2026-05-17

### 🧠 Pack Memory — Persistent Brain

### Added
- **Pack Memory** — Persistent cross-session memory system with brain detection
  - 🧠 **Zecher Agent** (זכר, "remembrance") — Memory archivist for consolidation, project scanning, context recall
  - 📁 **Project Memory** (`.agents/memory/`) — decisions.md, lessons.md, patterns.md, context.md, sessions/
  - 🌐 **Global Brain** (`~/.bmad-plus/brain/`) — Cross-project knowledge, identity, project index
  - 🔍 **Project Scanner** — Scan directories/disks, detect stacks, interactive validation, auto-index
  - 🛡️ **Karpathy Guardrails** — 4 behavioral principles (Think, Simplify, Surgical, Goal-driven) woven into agents
  - 📋 **Memory Protocol** — Complete read/write rules for when agents use memory
  - 🔗 **Brain Detection** — Detects existing `_brain/`, `~/.claude/memory/`, links instead of overwrites
  - 📝 **6 templates** — decisions, lessons, patterns, context, session-handoff, identity.yaml

### Changed
- CLI installer: brain detection step (4.5) with merge-safe logic
- IDE config generation: Zecher agent listed when memory pack selected
- Install guide: memory-specific examples (Zecher commands)

## [0.6.0] - 2026-05-17

### 🏗️ Pack Dev Studio — Full Software Development Lifecycle

### Added
- **Pack Dev Studio** — 6 specialized agents + 30 workflows covering the complete SDLC
  - 📊 **Analysis** (8): Miriam (Business Analyst), Huldah (Tech Writer), Product Brief, PRFAQ, Market/Domain/Technical Research
  - 📋 **Planning** (7): Yosef (Product Manager), Rachel (UX Designer), PRD Create/Edit/Validate, UX Design
  - 🏗️ **Architecture** (5+9 steps): Bezalel (System Architect), Create Architecture (8-step workflow), Epics & Stories, Readiness Check
  - 💻 **Implementation** (12): Oholiab (Senior Engineer), Sprint Planning, Dev Story (TDD cycle), Code Review, Quick Dev, Investigate
  - 🔧 **Utilities** (12): Distillator, Party Mode, Adversarial Review, Edge Case Hunter, Editorial Reviews, Advanced Elicitation
- **BWML** (BMAD+ Workflow Markup Language) — Proprietary DSL extending BMAD v6 XML with 12 new primitives:
  `<agent>`, `<parallel>`, `<loop>`, `<validate>`, `<guard>`, `<emit>`, `<context>`, `<memory>`, `<escalate>`, `<retry>`, `<fallback>`, `<metric>`
- **Dev Studio Orchestrator** — Intelligent routing across 5 phases with BWML-powered workflow definitions
- **Torah-named Personas** — Agents named after Torah figures matching their roles: Miriam, Huldah, Yosef, Rachel, Bezalel, Oholiab
- **Upstream Sync** — Tracking config for BMAD-METHOD v6.6.0 updates (commit `0f852a3`)
- **64 files** — 59 .md skills, module-help.csv, BWML spec, orchestrator, README, upstream-sync

### Changed
- **module.yaml** — Added dev-studio pack with 5 categories and cohabitation warning for Core pack
- **install.js** — IDE configs now include 6 Torah-named agents when Dev Studio is selected
- **Version reference** — Updated from BMAD-METHOD v6.2.0 to v6.6.0

## [0.5.0] - 2026-05-17

> **Correction (2026-07-15)** — as published, this section announced "38 expert compliance agents"
> and "85 Reference Files". Both were false on the day they were written, so they are corrected
> below rather than preserved. What v0.5.0 shipped has not changed: **27 compliance agents across
> 6 categories, plus 11 GDPR & AI Act workflows**. 38 was those two different things summed into
> one dimension — the per-category breakdown below (5+6+6+4+3+3 agents, then 11 workflows) always
> added up to 27+11 and contradicted its own headline. The pack has 79 reference files and always
> has (79 added at once, none ever removed). Verified three ways: `registry.yaml`, the files on
> disk, and `git ls-files`. Now enforced by `tools/build/check-counts.js`.

### 🛡️ Pack Shield — GRC Compliance (27 agents + 11 workflows)

### Added
- **Pack Shield** — 27 compliance agents across 6 categories, plus 11 GDPR & AI Act workflows, covering 25+ regulatory frameworks
  - 🔐 **Data Privacy** (5): GDPR, CCPA/CPRA, LGPD, DPDPA, ISO 27701
  - 🛡️ **Cybersecurity** (6): ISO 27001, NIST CSF 2.0, NIST 800-53, CIS Controls v8, NIS2, ISM
  - 🏢 **Industry Compliance** (6): SOC 2, PCI DSS v4.0, HIPAA, SWIFT CSP, DORA, FedRAMP
  - 🔒 **Defense & Export** (4): CMMC 2.0, ITAR, EAR, TSA
  - 🤖 **AI Governance** (3): EU AI Act, ISO 42001, NIST AI RMF
  - ♿ **Accessibility & ESG** (3): WCAG, Section 508, CSRD
  - 📋 **GDPR & AI Act Workflows** (11): DPIA, Breach Response, LIA, Privacy Notices/Policies, Cookie Compliance, AI Act Classification/Roles/FRIA/Incidents
- **Shield Orchestrator** — Intelligent routing across all 27 agents and 11 workflows with cross-framework mapping
- **79 Reference Files** — Deep regulatory knowledge extracted from upstream Claude Skills archives
- **3 Shared Templates** — Gap Analysis, Cross-Framework Mapper, Audit Report
- **Upstream Sync System** — Tracking configuration for Sushegaad GRC skill updates
- **module.yaml** — Full shield pack definition with 7 category blocks — the 6 agent categories plus a `workflows` block — each carrying an `agents:` list
- **CLI Integration** — Shield pack selectable in `npx bmad-plus install` with 3 localized example commands
- **IDE Config** — Shield agent advertised in generated AGENTS.md/GEMINI.md

### Changed
- **install_packs** — All packs now listed in multiselect (seo, backup, animated were missing)
- **module.yaml** — Replaced old `audit` (coming_soon) stub with fully realized `shield` pack

### Attribution
- Based on [Claude Skills for GRC](https://github.com/Sushegaad/Claude-Skills-Governance-Risk-and-Compliance) by Hemant Naik — MIT License
- GDPR/EU AI Act workflows inspired by [Lawve.ai](https://lawve.ai) professional skills catalog

---

## [0.4.4] - 2026-05-17

### 🔧 Encoding Fix + i18n Complete + Tests

### Fixed
- **UTF-8 encoding** — Fixed double-encoding corruption in `i18n.js` caused by PowerShell `Set-Content`
- **Credits URL** — Now points to public repo `github.com/lrochetta/BMAD-PLUS`
- **npm re-publish** — v0.4.3 had corrupted Unicode on npm; this release replaces it

### Added
- **Complete i18n** — CLI guide strings (commands, examples) now translated in all 10 languages (no more EN fallbacks)
- **Unit tests** — 53+ tests covering i18n, CLI modules, package.json integrity, module.yaml, source files, version consistency
- **`npm test`** — Jest test script added to package.json

---

## [0.4.3] - 2026-05-17

### 🔧 CLI Commands + Security Hardening + UX Enhancements

### Added
- **`bmad-plus update`** — Update agents & skills while preserving config, IDE configs, and output directories
- **`bmad-plus doctor`** — Check installation integrity (version, agents, configs, pack health)
- **Internationalized `uninstall`** — Uses i18n system from install manifest language (10 languages)
- **Credits at startup** — Author attribution displayed immediately when installer launches
- **Enriched post-install guide** — CLI commands section + pack-specific usage examples in selected language
- **i18n strings for update/uninstall/doctor** — EN, FR, ES, DE, PT-BR, RU, ZH, HE, JA, IT
- **CLI guide strings** — `guide_cli_title`, `guide_examples_title`, pack examples for SEO/Backup/Animated/OSINT

### Fixed
- **Security** — Added `mcp-server/.env` to `.gitignore`, created `.env.example` template
- **Manifest version** — Now reads from `package.json` dynamically (was hardcoded `0.4.0`)
- **`module.yaml` sync** — Added missing SEO, Backup, Animated pack definitions
- **`package.json` cleanup** — Removed `oveanet-pack` from `files[]` (already excluded by `.npmignore`)
- **CI/CD reliability** — Removed `continue-on-error` from npm publish step
- **Comment accuracy** — Updated "9 languages" → "10 languages" in install.js header
- **Installer title** — Now reads version from `package.json` dynamically

### Changed
- **Dependencies** — Updated `@clack/prompts` 1.1.0 → 1.4.0, `fs-extra` 11.3.4 → 11.3.5
- **npm scripts** — Added `update:bmad` and `doctor:bmad` scripts

---

## [0.4.2] - 2026-03-19

### 📦 Public Packs — SEO/Backup/Animated now in npm

### Added
- **Public pack agents** — SEO Audit 360, Universal Backup, Animated Website agent files now included in npm package
- Agent files copied from `oveanet-pack/` to `src/bmad-plus/agents/pack-seo/`, `pack-backup/`, `pack-animated/`
- Installer `packDir` system replaces `oveanetAgent` for proper npm distribution

---

## [0.4.1] - 2026-03-19

### 🌐 CLI Internationalization + DevOps Hardening

### Added
- **10-language CLI installer** — EN, FR, ES, DE, PT-BR, RU, ZH, HE, JA, IT with language selector at startup
- **CI/CD pipeline** — `publish-distribution.yml` GitHub Action (Golden → Public repo scrubbing)
- **`.npmignore`** — Excludes private directories from npm package
- **`/deploy` workflow** — Mandatory pre-deployment checklist
- **Post-install guide** — Enriched with all packs (SEO, Backup, Animated Website)

### Fixed
- **Security** — Purged `secrets/github_pat.txt` from git history, fixed `.gitignore` UTF-16 corruption
- **Version badges** — Updated from 0.1.0 → 0.4.1 across all 5 READMEs
- **Project structure** — Updated trees in both Golden and Distribution READMEs

---

## [0.4.0] - 2026-03-19

### 🏢 SEO Engine — Enterprise Extensions (Sprint 4)

### Added
- **Google Search Console extension** — OAuth2 client for organic search data (queries, pages, coverage, sitemaps)
- **Google Analytics 4 extension** — GA4 Data API client for organic traffic, landing pages, and engagement metrics
- Both extensions include setup guides, Python clients, and separate requirements

### Notes
- Extensions are **optional** and require OAuth2 setup (see `EXTENSION.md` in each directory)
- Core SEO Engine (SKILL.md + 3 agents + Python toolkit) works without extensions
- GSC and GA4 share OAuth2 credentials for simplified auth flow

---

## [0.3.3] - 2026-03-19

### 🧪 SEO Engine — Quality & Security (Sprint 3)

### Added
- **Unit tests** — 50 pytest tests covering all Python scripts (fetch, parse, crawl, APIs)
- **Pre-commit hook** — `hooks/seo-check.sh` validates HTML for title, meta, alt, H1 before commit
- **Audit JSON schema** — `ref/audit-schema.json` standardized export format for dashboard/API integration
- **Test fixture** — `tests/fixtures/sample_page.html` with known SEO elements

---

## [0.3.2] - 2026-03-19

### 📊 SEO Engine — Reports, Competitor & Hreflang (Sprint 2)

### Added
- **seo_report.py** — Professional HTML report generator with inline SVG radar chart, color-coded issue cards, quick wins section, and print-friendly CSS
- **Benchmarker role** — Added to Chief agent for `/seo competitor` command (side-by-side site comparison with delta scoring)
- **hreflang-rules.md** — Complete hreflang audit reference with 7 validation rules, 6 common error patterns, and 12-point checklist

---

## [0.3.1] - 2026-03-19

### 🔧 SEO Engine Enhancements (Sprint 1)

### Added
- **SKILL.md orchestrator** — Single entry point routing 15 `/seo` commands to the right agents
- **seo_apis.py** — Google APIs client (PageSpeed Insights, CrUX field data, Rich Results Test)
- **requirements.txt** — Python dependencies (requests, beautifulsoup4, lxml)
- **install.sh + install.ps1** — Cross-platform dependency installer with venv support

---

## [0.3.0] - 2026-03-19

### 🚀 SEO Engine v2.0 — Complete Rewrite

### Added
- **3 multi-role SEO agents** (replacing single monolithic agent):
  - 🔎 **Scout** — Technical scanner (Crawler, Inspector, Photographer)
  - ⚖️ **Judge** — Content & AI analyst (Content Expert, Schema Master, GEO Analyst)
  - 👑 **Chief** — Strategist & reporter (Scorer, Strategist, Reporter)
- **4 Python scripts** (new toolkit):
  - `seo_fetch.py` — Secure HTTP fetcher with SSRF protection and multi-UA support
  - `seo_parse.py` — HTML parser for meta, schema, links, images, word count
  - `seo_crawl.py` — Recursive mini-crawler with sitemap parsing and orphan detection
  - `seo_screenshot.py` — Playwright viewport screenshots with above-fold analysis
- **6 reference documents**:
  - Core Web Vitals 2026 thresholds (LCP subparts, INP, CLS)
  - Schema.org v29.4 type catalog with deprecation status
  - E-E-A-T scoring grid (100-point evaluation)
  - GEO signals for AI search optimization (Google AI Overviews, ChatGPT, Perplexity)
  - Quality gates with content thresholds by page type
  - 14 ready-to-use JSON-LD schema templates
- **6-phase audit workflow** with PageSpeed perfection loop
- **SEO Health Score (0–100)** with 7 weighted categories
- **Auto-generated code fixes** for common SEO issues
- **13 user commands** (`/seo full`, `/seo quick`, `/seo pagespeed`, etc.)
- **Monitoring system** with historical score comparison

### Changed
- SEO Audit 360 pack upgraded from v1.0 to v2.0
- Architecture: single SKILL.md → 3 specialized agents with parallel execution

### Preserved
- `pagespeed-playbook.md` — Battle-tested oveanet.ch PageSpeed optimization loop
- `checklist.md` — Original PageSpeed perfection checklist

---

## [0.2.0] - 2026-03-18

### 🔀 Oveanet Fusion

### Added
- **3 new utility packs** from oveanet-agents:
  - 🔍 **SEO Audit 360** — 9-category audit for search engines + AI engines (by Oveanet)
  - 🗂️ **Universal Backup** — Timestamped ZIP backup with smart exclusions (by Oveanet)
  - 🎬 **Animated Website** — Luxury scroll-driven website from video (by Oveanet)
- `oveanet-pack/` directory as source for oveanet agent content
- Oveanet sync documentation in `process-info.md`

### Changed
- Installer now shows 7 packs (Core + OSINT + Maker + Audit + SEO + Backup + Animated)
- `package.json` includes `oveanet-pack` in npm distribution

### Removed
- `pour etudier/` directory (content migrated to `oveanet-pack/`)

---

## [0.1.3] - 2026-03-18

### 🔧 Cross-Platform Fix

### Fixed
- LF line endings for `bin` scripts (fixes `npx` execution on macOS/Linux)
- Added `.gitattributes` to enforce LF on executable scripts

---

## [0.1.2] - 2026-03-17

### 📝 Credits Update

### Changed
- Author credits translated to English in CLI installer and READMEs
- Added LinkedIn link to credits section

---

## [0.1.1] - 2026-03-17

### 👤 Author Attribution

### Added
- Laurent Rochetta credit in `README.md`, `README-DIST.md`, and CLI success message
- GitHub and LinkedIn links in credits section

---

## [0.1.0] - 2026-03-17

### 🎉 Initial Release — Foundation

First release of BMAD+, an augmented fork of BMAD-METHOD v6.2.0.

### Added

#### Core Module (`src/bmad-plus/`)
- **module.yaml** — Module configuration with execution mode, auto-role activation, parallel execution, and modular pack system
- **module-help.csv** — Contextual help for all 8 registered skills/agents

#### 5 Multi-Role Agents
- **Atlas (Strategist)** — Fuses Analyst + PM into 2 switchable roles with auto-activation
- **Forge (Architect-Dev)** — Fuses Architect + Dev + Tech Writer into 3 switchable roles
- **Sentinel (Quality)** — Fuses QA + UX Designer into 2 switchable roles
- **Nexus (Orchestrator)** — Fuses SM + Quick-Flow + new Autopilot Controller + new Parallel Supervisor (4 roles)
- **Shadow (OSINT)** — Converted from legacy XML agent to BMAD+ v6 format (pack: osint)

#### 3 Custom Skills
- **bmad-plus-autopilot** — Full pipeline automation (Discovery → Build → Ship) with configurable checkpoints
- **bmad-plus-parallel** — Multi-agent parallel execution with orchestrator supervision (launch/stop/restart/reallocate/escalate)
- **bmad-plus-sync** — Upstream synchronization via VPS MCP Server

#### Auto-Activation System
- **role-triggers.yaml** — 3-level intelligent role switching:
  - Level 1: Pattern matching (keywords in user requests)
  - Level 2: Contextual analysis (domain detection during work)
  - Level 3: Reasoning chains (logical discoveries during execution)

#### Modular Pack System
- **Core pack** (required) — 4 agents, 3 skills, role-triggers
- **OSINT pack** (optional) — Shadow agent + OSINT investigation skills
- **Maker pack** (optional) — Maker meta-agent for creating new BMAD+ compatible agents (4-phase pipeline: Discovery → Design → Generation → Validation)
- **Audit pack** (coming soon) — Shield agent placeholder
- Multi-select installer menu with per-pack API key requirements

#### `npx bmad-plus install` CLI
- Interactive installer with pack selection, IDE auto-detection, user config
- Contextual post-install guide adapted to installed packs
- `--packs`, `--yes`, `--tools`, `--directory` flags for non-interactive use
- Uninstall command: `npx bmad-plus uninstall`

#### Monitoring System (`monitor/`)
- **weekly-check.py** — Weekly upstream monitoring script (cron)
- **ai_analyzer.py** — Gemini API-powered diff analysis (compatible/review/breaking)
- **notifier.py** — WhatsApp notifications via Evolution API + email fallback
- **mcp_bridge.py** — Bridge to Audit 360° MCP Server for VPS git/github operations
- **docker-compose.yml** — Evolution API container configuration
- **config.example.yaml** — Configuration template

#### Multi-IDE Support
- **CLAUDE.md** — Claude Code configuration
- **GEMINI.md** — Gemini CLI configuration
- **AGENTS.md** — Codex CLI / OpenCode configuration

#### Integration
- Integrated existing **osint-agent-package** (Shadow agent, 55+ Apify actors, 7 APIs)
- Integrated existing **mcp-server** (Audit 360° with 35 tools) via MCP Bridge

### Upstream Compatibility
- Based on BMAD-METHOD v6.2.0 (2026-03-15)
- Compatible with core versions 6.0.0 — 7.0.0
- Replaces `bmm` module while keeping core skills

---

*For earlier history, see the upstream [BMAD-METHOD CHANGELOG](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/CHANGELOG.md).*

<!-- Version links point to the npm release page. The public repository is a single snapshot, so per-version compare links are not available. Not published on npm: 0.15.0, 0.11.0, 0.10.0, 0.1.2. -->

[0.17.1]: https://www.npmjs.com/package/bmad-plus/v/0.17.1
[0.17.0]: https://www.npmjs.com/package/bmad-plus/v/0.17.0
[0.16.0]: https://www.npmjs.com/package/bmad-plus/v/0.16.0
[0.14.0]: https://www.npmjs.com/package/bmad-plus/v/0.14.0
[0.13.0]: https://www.npmjs.com/package/bmad-plus/v/0.13.0
[0.12.2]: https://www.npmjs.com/package/bmad-plus/v/0.12.2
[0.12.1]: https://www.npmjs.com/package/bmad-plus/v/0.12.1
[0.12.0]: https://www.npmjs.com/package/bmad-plus/v/0.12.0
[0.9.2]: https://www.npmjs.com/package/bmad-plus/v/0.9.2
[0.9.1]: https://www.npmjs.com/package/bmad-plus/v/0.9.1
[0.9.0]: https://www.npmjs.com/package/bmad-plus/v/0.9.0
[0.8.0]: https://www.npmjs.com/package/bmad-plus/v/0.8.0
[0.7.5]: https://www.npmjs.com/package/bmad-plus/v/0.7.5
[0.7.4]: https://www.npmjs.com/package/bmad-plus/v/0.7.4
[0.7.3]: https://www.npmjs.com/package/bmad-plus/v/0.7.3
[0.7.2]: https://www.npmjs.com/package/bmad-plus/v/0.7.2
[0.7.1]: https://www.npmjs.com/package/bmad-plus/v/0.7.1
[0.7.0]: https://www.npmjs.com/package/bmad-plus/v/0.7.0
[0.6.0]: https://www.npmjs.com/package/bmad-plus/v/0.6.0
[0.5.0]: https://www.npmjs.com/package/bmad-plus/v/0.5.0
[0.4.4]: https://www.npmjs.com/package/bmad-plus/v/0.4.4
[0.4.3]: https://www.npmjs.com/package/bmad-plus/v/0.4.3
[0.4.2]: https://www.npmjs.com/package/bmad-plus/v/0.4.2
[0.4.1]: https://www.npmjs.com/package/bmad-plus/v/0.4.1
[0.4.0]: https://www.npmjs.com/package/bmad-plus/v/0.4.0
[0.3.3]: https://www.npmjs.com/package/bmad-plus/v/0.3.3
[0.3.2]: https://www.npmjs.com/package/bmad-plus/v/0.3.2
[0.3.1]: https://www.npmjs.com/package/bmad-plus/v/0.3.1
[0.3.0]: https://www.npmjs.com/package/bmad-plus/v/0.3.0
[0.2.0]: https://www.npmjs.com/package/bmad-plus/v/0.2.0
[0.1.3]: https://www.npmjs.com/package/bmad-plus/v/0.1.3
[0.1.1]: https://www.npmjs.com/package/bmad-plus/v/0.1.1
[0.1.0]: https://www.npmjs.com/package/bmad-plus/v/0.1.0
