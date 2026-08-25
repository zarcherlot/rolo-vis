# Episode Cohort Investigation baseline

Status: established baseline

Version: `0.24.0`

Baseline ID: `rolo-vis-episode-cohort-investigation/2026-08`

Extends: rolo-vis `v0.23.0` / `rolo-vis-episode-cohort-review/2026-08`

Frontend minimum: `858c824` (merged to main by `a42adeb`)

Producer minimum: rolo `463d501` (merged to main by `891cbf1`)

Validated upstream head: rolo `e96c9b0`

## Product boundary

This release connects two previously baselined, read-only Episode surfaces. One pinned
Episode revision remains the exact-match cohort reference. A selected cohort member may
become the right side of the existing pair comparison without replacing that reference.

The bridge carries only robot, Episode ID, and revision. Both detail and timeline inputs
are fetched and validated independently before comparison. Members outside the currently
loaded Episode index page remain addressable by exact identity, and the existing deep link
preserves both revision pins plus the selected cohort window.

## Frozen contract

- `workbench.episode-read-model/v1`
- `workbench.episode-revision-history/v1`
- `workbench.episode-cohort-read-model/v1`
- separate Open and Compare actions for each cohort member
- unchanged reference identity when comparison is selected
- bounded independent detail and timeline reads on both comparison sides
- `compare`, `compare_revision`, and `cohort_days` deep-link continuity
- no new endpoint, producer schema, feature flag, or write authority

Comparison remains descriptive and release-neutral. Cohort order remains server-authored
newest-first; no rank, anomaly, regression, improvement, significance, causal claim, or
outcome verdict is introduced.

## Promotion evidence

- E9 frontend and validation commits `547134c` and `858c824` were approved.
- rolo-vis PR #7 passed its complete remote CI gate and merged to main as `a42adeb`.
- Final local promotion verification passed 136 application tests, TypeScript checking,
  production packaging, and four Sites worker tests.
- Isolated live validation copied desktop `rolo-data` without modifying its source,
  selected a cohort member outside a limit-one index page, independently read two complete
  two-event timelines, rejected an unavailable revision with HTTP 409, and reproduced
  both pins plus `cohort_days=30` from the deep link.

## Deferred successor work

Rankings, thresholds, anomaly scoring, regression or improvement labels, inferential
statistics, release gates, cross-robot benchmarking, historical cohort membership, media
synchronization, replay, recollection, export, external handoff, and every write action
remain outside this baseline and require separately reviewed contracts.
