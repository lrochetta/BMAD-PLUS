# Native boundary campaign

`2026-09-11-native-boundaries.json` predeclares three tasks, both instruction
variants and two repetitions: **12 observations**. The tasks cover customized
project rules, missing implementation inputs, and a review with a real bug plus
a correct guarded route. September 9 task inputs and receipts remain unchanged.
Preparation does not execute or measure any agent.

```sh
python evals/_runner/campaign.py prepare --plan evals/campaigns/2026-09-11-native-boundaries.json --output evals/_runs/2026-09-11/native-boundaries
```

Retain the returned `campaign_sha256` and each `preparation_sha256` in the
orchestrator's records, outside worker writes. Launch fresh host instances with
only their returned `task_file`, available host tools and allowed workspace.
Do not supply the replay, checker, campaign ledger or another worker's answer.
Use the existing inherited host model with no override. Alternate arm order
between repetitions as prepared; this counterbalances scheduling order, not
random sampling. Root's current concurrency limit determines actual scheduling.

The host must enforce the predeclared 300-second per-attempt deadline and
12-attempt launch limit. An agent-count limit does not establish a monetary cap.
No separate paid API calls are authorized by this plan; unknown host usage and
cost remain null. If a concrete model identity is available before preparation,
record it in a reviewed plan. A changed model requires a new campaign.

Store each actual final transcript outside its workspace. Collect all attempts,
including failed, blocked or interrupted executions, with their actual handles:

```sh
python evals/_runner/host.py collect --attempt ATTEMPT_DIRECTORY --expected-preparation PREPARATION_DIGEST --transcript TRANSCRIPT_FILE --host-id ACTUAL_HANDLE --model-alias gpt --outcome completed
python evals/_runner/campaign.py compare --campaign CAMPAIGN_FILE --expected CAMPAIGN_DIGEST --json evals/_runs/2026-09-11/native-comparison.json
```

`blocked` uses the existing `failed` execution outcome plus the transcript's
actual limitation. A task that correctly reports missing acceptance inputs can
still complete its *assessment* task; this is distinct from an interrupted host
execution. An interrupted attempt is collected with `--outcome interrupted` and
cannot pass even if its artifacts happen to be correct. The existing controller
tests separately exercise interrupted collection and prohibit silent regrading.

The comparison is incomplete until every declared observation exists. It rejects
duplicate attempts, missing pairs/repetitions, changed source/check identities,
mixed execution modes and different recorded model settings. It reports task
acceptance and critical regressions before any broader interpretation. A small
repeated pilot does not demonstrate general superiority, population-level review
precision or model-upgrade safety. Elapsed preparation-to-collection time includes
queueing; no model latency or token cost is fabricated.

The deterministic replay gate and controller tests are supporting infrastructure
evidence. Their authored artifacts must never be exported as native agent results.
