# Episode Comparison Evidence baseline

Status: established baseline

Version: `0.25.0`

Baseline ID: `rolo-vis-episode-comparison-evidence/2026-08`

Extends: rolo-vis `v0.24.0` / `rolo-vis-episode-cohort-investigation/2026-08`

Frontend minimum: `e756702` (merged to main by `0dd4fec`)

Producer minimum: rolo `463d501` (merged to main by `891cbf1`)

Validated upstream head: rolo `e96c9b0`

## Product boundary

This release extends the established revision-pinned Episode pair comparison with one
bounded Evidence reference index. The index is derived only after both Episode details
and their visible timelines pass the existing public-contract validation.

The projection records whether a validated ID is referenced on the left, right, or both
sides and preserves its Episode, Timeline, Finding supporting, Finding contradicting,
and Asset source lanes independently. The existing Evidence drawer remains the only
record-reading surface.

## Frozen contract

- derived model `rolo-vis-episode-pair-comparison/v2`;
- literal Evidence trace authority `REFERENCE_PRESENCE_ONLY`;
- deterministic first-left-then-right ordering and fixed source-lane ordering;
- at most 100 visible unique IDs with explicit total, visible, and truncated counts;
- complete versus bounded-partial timeline coverage retained in the trace;
- shared, left-only, and right-only reference presence without semantic equivalence;
- literal false quality, verification, causal-attribution, release, and write authority;
- no producer schema, endpoint, feature flag, Evidence batch read, or artifact access.

The producer minimum remains unchanged. `workbench.episode-read-model/v1`,
`workbench.episode-revision-history/v1`, and
`workbench.episode-cohort-read-model/v1` continue to be negotiated independently.

## Promotion evidence

- E10A–E10C commit `e756702` was approved.
- rolo-vis PR #9 passed the complete remote CI gate and merged to main as `0dd4fec`.
- Final local promotion verification passed 139 application tests, TypeScript checking,
  production packaging, and four Sites worker tests.
- Isolated live validation copied desktop `rolo-data` without modifying its source,
  selected an exact-match cohort pair, independently read two complete two-event
  timelines, and derived comparison v2 with one shared Evidence ID.
- The live trace retained Episode and Timeline source lanes, declared only
  `REFERENCE_PRESENCE_ONLY`, and rejected the unresolved referenced record with HTTP
  404 instead of treating ID presence as record availability.

## Deferred successor work

Evidence content comparison, semantic equivalence, ranking, scoring, quality or
sufficiency verdicts, batch reads, export, external handoff, recollection, replay,
media delivery, release influence, and every write action remain outside this baseline.

