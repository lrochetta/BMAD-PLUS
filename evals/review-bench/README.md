# Review bench corpus

Small repositories with planted, documented defects and decoys, scored by
`tools/qa/review-bench.js` under the matching rule published in
[docs/specs/review-bench.md](../../docs/specs/review-bench.md).

- `cases/<id>/` — `before/` (base tree), `after/` (changed files), `case.json` (the answer: defects and decoys, each with its reason).
- `runs/` — recorded reference runs (`perfect`, `empty`, `noisy`) and `expected.json`, their totals worked out by hand.

The fixture code is deliberately wrong in places. It is data, never executed: Jest ignores
`evals/`, and a built case repository holds only `before/` and `after/`, never `case.json`.

```sh
node tools/qa/review-bench.js check
node tools/qa/review-bench.js build --out /tmp/bench
node tools/qa/review-bench.js score evals/review-bench/runs/noisy.json
```
