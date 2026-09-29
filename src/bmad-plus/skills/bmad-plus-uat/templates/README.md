# Project gates for human acceptance

BMAD+ installs no lifecycle hook, so an instruction can be skipped and a Nexus task
can be bypassed. These two scripts are the layer that cannot: they run inside your
own checks and fail the command that calls them. Copy the ones you want into your
project — for example under `scripts/` — and wire them where they bite.

Both need nothing but Node 20 and are safe to read before you run them.

## G1 — a version does not leave without its recipe

`uat-spec-present.mjs` fails when no recipe names the version in `package.json`.

```jsonc
// package.json
{
  "scripts": {
    "uat:spec": "node scripts/uat-spec-present.mjs",
    "pretest": "npm run uat:spec"          // or call it from your CI step
  }
}
```

A grouped recipe covers a version because it **names** it in `versions`, never
because its file name suggests a range. That is deliberate: deducing coverage from
a range makes a version look checked when nobody wrote anything about it.

Where to run it: the same place your tests run, and before the push, not after the
deployment. A reminder printed once the version is live only records the miss.

## G3 — production waits for a run that was read

`uat-release-gate.mjs` resolves the recipe covering the current version and runs
`bmad-plus uat gate` on it. It exits 0 only when the latest run is finished, answers
the current revision of the recipe, leaves no expectation unanswered, has every
failure classified with a decision, and has every passed writing step confirmed
read-only.

```sh
# deploy-production.sh
node scripts/uat-release-gate.mjs || exit 1
# … deploy only below this line
```

Exit codes: `0` passed · `1` failed · `2` no finished run yet · `3` the run answered
another revision of the recipe · `4` the gate itself could not run. The last one is
not a pass: a missing gate is a missing gate.

The script runs the CLI's own entry point with the Node that started it: `BMAD_PLUS_CLI`
if you set it, otherwise `node_modules/bmad-plus/` if the project installed it. No shell
and no `npx`: a Windows `.cmd` shim cannot be spawned without a shell, and a release gate
must not depend on a download. If neither exists it exits 4 and says so.

## What these gates do and do not establish

They establish that a recipe exists for the version, and that a human run covering
it is complete, current and classified. They do not establish that the tester looked
at the right place, and they do not judge the product. Every report says
*human-observed* for that reason.

A failure classified as a defect of the recipe is not a product fix: amend the spec,
rebuild it, replay the affected steps, and say so. A failure nobody could classify
keeps the gate red on purpose — ask the tester what they saw instead of guessing.
