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

Everything else in `registry.yaml` (`display_name`, `icon_emoji`, `summary`,
`runtime`, `categories`, `workflows`, `governance`, `compliance_tags`,
`targets`, `runtimes`, `memory`, `eval`) is north-star metadata consumed by
future generators (module.yaml, README count tables, per-CLI adapters,
role-triggers) — declared once here so counts are derived, never typed.

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
