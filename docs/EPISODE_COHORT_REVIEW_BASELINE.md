# Episode Cohort Review baseline

Status: established baseline

Version: `0.23.0`

Baseline ID: `rolo-vis-episode-cohort-review/2026-08`

Extends: rolo-vis `v0.22.0` / `rolo-vis-episode-revision-history/2026-08`

Frontend minimum: `2c2967f` (merged to main by `3f18124`)

Producer minimum: rolo `463d501` (merged to main by `891cbf1`)

## Product boundary

This release adds a feature-negotiated, read-only Cohort lens to Episode Studio. One
pinned Episode revision remains the reference; rolo derives exact operation, test-case,
and normalized expected-behavior identity and returns exact-match current publications
from other Episode identities.

The population uses the closed-open 7, 30, or 90 days preceding the reference start.
Only terminal immutable current publications are members. Running and mutable semantic
matches remain explicit exclusions, and responses above the returned limit are marked
`BOUNDED_PARTIAL`.

Connections without `workbench.episode-cohort-read-model/v1` retain v0.22 behavior and do
not call the cohort endpoint or synthesize membership from the locally loaded Episode list.

## Frozen contract

- `workbench.episode-cohort-read-model/v1`
- `rolo-episode-cohort/v1`
- `rolo-episode-cohort-member/v1`
- `rolo-episode-cohort-exclusions/v1`
- `GET /v1/robots/{robot_id}/episode-cohorts`
- 7/30/90-day closed-open windows, at most 100 returned members, and a 1,000-publication
  scan bound
- unique newest-first current member identities with balanced included, excluded, and
  truncated arithmetic

Numeric summaries are limited to count, minimum, median, maximum, and the pinned
reference value. They remain `DESCRIPTIVE_ONLY`; outcome, independent verification, and
publication coverage remain separate categorical facts.

## Promotion evidence

- rolo PR #16 passed Python 3.10–3.13, production-sandbox, and LeRobot E2E checks.
- rolo-vis PR #5 passed its complete remote verification gate.
- Local verification passed 132 tests, TypeScript checking, production packaging, and
  four Sites worker tests.
- Isolated live validation returned one, two, and three eligible members for 7/30/90-day
  windows, kept one running and one mutable publication excluded, and validated a
  limit-one `BOUNDED_PARTIAL` response with two truncated members.

## Deferred successor work

Rankings, thresholds, anomaly scoring, regression or improvement labels, significance,
causal claims, release gates, cross-robot benchmarking, historical cohort members, media
synchronization, replay, recollection, export, external handoff, and every write action
remain outside this baseline and require separately reviewed contracts.
