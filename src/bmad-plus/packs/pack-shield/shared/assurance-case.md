# Security Assurance Case

> Procedure used by Shield when a user asks for an assurance case, evidence for an audit, or proof that security controls hold at a given commit. Template: `shared/assurance-case-template.yaml`. Tooling: `bmad-plus assurance init|run|verify`.

## What it produces

A case in `_bmad/assurance/<id>.yaml` that states **claims**, gives for each an **argument**, and supports it with **evidence**. Evidence is only ever a check that ran: `bmad-plus assurance run` executes each declared command without a shell and appends to a hash-chained ledger what happened (exit code, output digest, digests of the artifacts the run wrote, commit, whether the tree was clean of changes and untracked files). `bmad-plus assurance verify` then refuses any claim whose evidence is missing, failed or stale, and the case file itself cannot name evidence that is only asserted.

## Steps

0. **Start.** `bmad-plus assurance init _bmad/assurance/<id>.yaml` copies this template under that id; it never overwrites a case.
1. **Scope.** Agree with the user on what the case covers (system, commit or release, deployment) and which frameworks matter. Write it in `scope`.
2. **Claims from controls.** Start from the controls in scope (the relevant framework agent and `shared/cross-framework-mapper.md` help). Write one top claim, then sub-claims narrow enough that a single command can show each one. Tag a claim with the controls it supports (`ISO27001:A.8.8`, `SOC2:CC8.1`, `GDPR:Art.32`); unknown or mistyped controls are refused.
3. **Checks.** For every leaf claim, choose a command that exits zero only when the claim holds: a test suite, a dependency audit, a secret scanner, a configuration linter, `bmad-plus review gate`, a policy-as-code evaluation. Declare artifacts the command writes (reports, SBOMs) so they are hashed with the run.
4. **Argument.** Say why a passing check shows the claim, and what it does not show. A check that cannot fail for the reason the claim is about is not evidence of it.
5. **Run and verify** at the commit the case is about, with a clean working tree (untracked files count unless git ignores them; the case's own ledger folder and artifacts do not):
   ```
   bmad-plus assurance run _bmad/assurance/<id>.yaml
   bmad-plus assurance verify _bmad/assurance/<id>.yaml --ledger-head <head> --emit-check _bmad-output/assurance/<id>/check.json
   ```
   `run` reports the ledger head; keep it where the ledger's writers cannot change it (the CI job log, the audit file) and pass it to `verify`. In CI, run both in the same job with `BMAD_PLUS_ASSURANCE_KEY` set from a secret.
6. **Report.** Present the verdict: supported and unsupported claims with their reasons, and the controls that now have executed evidence (`controls.supported`). Never describe an unsupported claim as met.

## What is refused

| Situation                                                                                                                                               | Result                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Evidence that is a statement, a document or a link                                                                                                      | The case does not load: evidence must name a check                |
| A claim with neither evidence nor sub-claims                                                                                                            | The case does not load: the claim is only asserted                |
| A check that never ran                                                                                                                                  | `missing` — the claim is unsupported                              |
| A non-zero or unexpected exit code, a timeout, an artifact the run did not write (absent, or left unchanged from before)                                | `failed`                                                          |
| A run at another commit or on uncommitted changes or untracked files, a command changed since, an artifact changed since, a run older than `maxAgeDays` | `stale`                                                           |
| A ledger record edited or reordered, or removed before the last one                                                                                     | The whole case is unsupported until the ledger is rebuilt         |
| The last records removed                                                                                                                                | Unsupported with `--ledger-head` given; unseen without it         |
| A record written by hand, with its digest recomputed                                                                                                    | Unsupported with `BMAD_PLUS_ASSURANCE_KEY` set; unseen without it |

## How far the ledger can be trusted

Without a key, the chain of SHA-256 digests shows accidental and careless edits only: anyone who can write the ledger can append a record that verifies, or cut off the records after a run they want forgotten. Two things close that, both kept outside the ledger:

- **A key.** With `BMAD_PLUS_ASSURANCE_KEY` (at least 32 characters) set, `run` signs every record with an HMAC and `verify` refuses any record the key does not authenticate. The key is never passed to a check, and a case cannot ask for it.
- **The head.** `verify --ledger-head <sha256>` refuses a ledger that no longer holds the record `run` reported last, so removed runs are seen.

Report which of the two applied (`ledger.authenticated`, `ledger.anchor` in the verdict); without either, say the evidence is recorded, not tamper-proof.

## Boundaries

- The case shows that named checks passed at a commit. It does not certify the system, and it is not an audit opinion: a qualified auditor decides what the evidence is worth.
- `assurance run` executes the commands written in the case, with the same trust as a project's own scripts. Read a case from someone else before running it.
- Evidence is bound to the commit by default (`freshness.sameCommit: true`). Set it to false only for a project outside git, and say so in the report.
