# BMAD+ Build — Registry Generator (Pillar 1)

`registry.yaml` at the repo root is the **single source of truth** for the
9 packs, their agents, skills, data files, install layout, runtimes, and
compliance tags. Until now this data was hand-replicated in 5 places
(`tools/cli/lib/packs.js`, `src/bmad-plus/module.yaml`, `install.js`,
`ide-config.js`, `i18n.js`) — and they drifted.

`tools/build/generate.js` reads `registry.yaml` and generates the pack data
consumed by the CLI. The migration proof (`tests/unit/generate.test.js`)
asserts the generated `PACKS` / `PACK_ORDER` / `EXPECTED_AGENTS` are
**deep-strict-equal** to the hand-written `tools/cli/lib/packs.js`, so the
registry provably captures current reality before anything is replaced.

## Usage

```bash
# Print the generated packs module source (drop-in packs.js replacement)
node tools/build/generate.js

# Print PACKS / PACK_ORDER / EXPECTED_AGENTS as JSON
node tools/build/generate.js --json

# Write the generated module to a file
node tools/build/generate.js --out tools/cli/lib/packs.generated.js

# CI drift gate: exit 1 if registry.yaml no longer reproduces packs.js
# (also asserts product.version == package.json version)
node tools/build/generate.js --check
```

## Registry contract (fields the generator consumes)

Per pack under `packs:` in `registry.yaml`:

| Field | Maps to | Notes |
| --- | --- | --- |
| `order` | `PACK_ORDER` position | integer, unique |
| `cli.name` / `cli.icon` / `cli.desc` | `PACKS[id].name/icon/desc` | exact CLI strings (icon = glyph letter) |
| `agents` | `PACKS[id].agents` | agent ids the installer copies |
| `skills` | `PACKS[id].skills` | defaults to `[]` |
| `data` | `PACKS[id].data` | **key presence is significant** — only core & maker declare it |
| `external_package` | `PACKS[id].externalPackage` | osint only |
| `pack_dir` / `pack_src_dir` | `PACKS[id].packDir/packSrcDir` | `pack_src_dir` defaults to `packs` |
| `required` | `PACKS[id].required` | emitted **only when `true`** (packs.js omits it otherwise) |
| `install_layout` | `EXPECTED_AGENTS[id]` | `loose` → agents as directories, `packDir: null`; `packaged` → `packDir` + `doctor.pack_agents` |
| `doctor.pack_agents` | `EXPECTED_AGENTS[id].packAgents` | agent **filenames** inside `pack_dir` (packaged only) |
| `uses_skills` (pack or persona) | `PACKS[id].usesSkills`, `DERIVED.packs[id].usesSkills`, `personas[].usesSkills` | skill ids the agent drives; each must be a `skills` entry of some pack, an `external_module` skill or a Core skill — `--check` fails otherwise; the spine roster renders `— drives: …` |
| `external_module` | `PACKS[id].externalModule` | `{ package, version, skills }`; the package is an exact pinned `dependencies` entry of `package.json` and listed in `data_handling.runtime_dependencies`; `--check` resolves it from the repo root, matches `version` and finds `skills/<id>/SKILL.md`; installed as `.agents/skills/<id>/` and required by `doctor` |
| `pipelines` | `PACKS[id].pipelines`, `DERIVED.packs[id].pipelines` | `[{ id, title, steps: [{ workflow \| agent, gate }] }]`; ids unique in the pack, each step names exactly one of the pack's workflows (`workflows` / `categories[].workflows`) or agents (`agents` / `sub_agents`), `gate` is `require_approval`, `notify_only` or `auto`; the facts line gains `N pipelines` |
| `intake` | `PACKS[id].intake`, `DERIVED.packs[id].intake` | intake file relative to `pack_dir` (needs `pack_dir`); validated by `tools/build/intake-contract.js` with `pack` equal to the pack id; `.agents/skills/<pack_dir>/<intake>` becomes a required resource |
| `cohabitation_warning` | `DERIVED.packs[id].cohabitationWarning` | one sentence on how the pack overlaps another one; shown by the installer and rendered as `- Cohabitation (<pack>): …` under the registry facts of the spine, the previews and the installed adapters of the selected packs; emitted only when declared |

The last four are read only when present; a pack without them generates exactly
what it did before. Reference: `docs/specs/core-orchestration.md` §4–§5.

An `external_module` is resolved twice, by different rules. `generate.js --check`
calls `require.resolve` from the repository root and accepts wherever Node finds
the package (a working copy may hold it through a link). `bmad-plus install`
(`tools/cli/lib/pack-copy.js`) additionally requires the resolved package to sit
in the `node_modules` chain of the BMAD+ package root: a symlinked package, a
global module path and pnpm's isolated layout (`node_modules/.pnpm/...`) are
refused with a message naming them. Accepting the pnpm layout is a separate
decision, not a build-time setting.

Everything else in `registry.yaml` (`display_name`, `icon_emoji`, `summary`,
`runtime`, `categories`, `workflows`, `governance`, `compliance_tags`,
`targets`, `runtimes`, `memory`, `eval`) is north-star metadata consumed by
future generators (module.yaml, README count tables, per-CLI adapters,
role-triggers) — declared once here so counts are derived, never typed.

`data_handling` is read by `tools/build/verify-egress.js`, not by `generate.js`:
it declares every network, listener and process site of the npm payload and of
the maintainer services (`mcp-server/`, `monitor/`), and renders the
data-handling table of `SECURITY.md`. `generate.js` derives the package flows
that leave the machine into `DERIVED.dataHandling` for the adapters' facts line
(spec: `docs/specs/data-handling.md`).

```bash
node tools/build/verify-egress.js          # CI gate: sites, doctrine and SECURITY.md agree
node tools/build/verify-egress.js --list   # print the observed sites
node tools/build/verify-egress.js --write  # regenerate the SECURITY.md table
```

## Editing workflow

1. Edit `registry.yaml` (never the generated data).
2. Run `node tools/build/generate.js --check`.
3. While `packs.js` is still hand-written (migration phase), sync it via
   `node tools/build/generate.js --out tools/cli/lib/packs.js` or apply the
   equivalent hand edit — `--check` and `tests/unit/generate.test.js`
   (`npx jest tests/unit/generate.test.js`) both fail on any divergence.

## Migration end-state (for the orchestrator)

Once integration is approved, `tools/cli/lib/packs.js` becomes either:

- a checked-in generated file (`generate.js --out tools/cli/lib/packs.js`,
  with `--check` as a CI/pre-commit gate), or
- a thin runtime re-export:

  ```js
  const { loadRegistry, buildAll } = require('../../build/generate');
  module.exports = buildAll(loadRegistry());
  ```

Both keep the exact `{ PACKS, PACK_ORDER, EXPECTED_AGENTS }` shape every CLI
command already imports, so no call site changes.
