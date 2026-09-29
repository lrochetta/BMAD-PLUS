---
name: bmad-technical-research
description: Compare technical options against project constraints with primary sources and bounded experiments.
---

# Technical research

Load the [execution guide](../../shared/execution.md) and
[Miriam](analyst-agent.md). Produce a technical recommendation whose assumptions
and verification limits are clear.

## Inputs

Use the decision to make, project constraints, relevant code or architecture and
candidate approaches if supplied. Establish required capabilities and observable
acceptance criteria before comparing tools or vendors.

## Procedure

1. Inspect the actual environment: manifests, locked dependency versions,
   deployment target, interfaces, data sensitivity and operational constraints
   relevant to the question. Separate fixed requirements from preferences.
2. Define comparable options, including retaining the current approach when
   viable. State the disqualifying constraints and the uncertainties worth
   investigating; avoid a long catalogue of unrelated technologies.
3. Consult current official documentation, specifications, repositories or
   original research for version-sensitive technical claims. Record source
   versions and dates. Verify that a proposed API exists in the intended version.
4. Compare capability fit, integration effort, compatibility, operating cost
   assumptions, maintenance and failure recovery. Distinguish documented limits
   from measured behavior. Show the basis of any quantitative estimate.
5. Where useful, run a small authorized local experiment for the decisive unknown.
   Define input, environment, command, expected observation and stopping limit
   first. Keep it isolated from production state and preserve user changes.
   Do not install or invoke a paid external service without applicable authority.
6. Record the actual result, including failures and unrun checks. A toy benchmark
   supports its observed workload, not a general performance or reliability claim.
7. Recommend an option with reasons, rejected alternatives, migration or exit
   considerations and the condition that would change the recommendation.

## Output

Write the decision and constraints; inspected environment; options comparison;
source ledger; experiment method and results where executed; recommendation;
risks and unresolved questions; and next implementation or architecture action.
Keep evidence-backed facts separate from proposed implementation details.

## Acceptance and continuation

Every claimed decisive advantage must have a source, observation or explicit
assumption. If current docs or runtime access are unavailable, give the bounded
analysis and leave the affected capability unverified.

On resume, compare dependency versions, constraints and experiment inputs. Reuse
unaffected observations and rerun only checks whose basis changed. A supported
decision can feed [Architecture](../architecture/create-architecture.md); it does
not itself authorize a migration or vendor purchase.
