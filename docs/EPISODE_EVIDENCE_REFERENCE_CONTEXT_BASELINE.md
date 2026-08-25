# Episode Evidence reference context baseline

Status: established baseline

Version: `0.26.0`

Baseline ID: `rolo-vis-episode-evidence-reference-context/2026-08`

Extends: rolo-vis `v0.25.0` / `rolo-vis-episode-comparison-evidence/2026-08`

Frontend minimum: `e863266` (merged to main by `838e2c2`)

Producer minimum: rolo `463d501` (merged to main by `891cbf1`)

Validated upstream head: rolo `e96c9b0`

## Product boundary

This release gives every visible comparison Evidence ID bounded, source-preserving
left and right attachment-point context. The projection is derived only from the two
already validated, revision-pinned Episode details and their bounded timelines.

The workbench can identify the public Episode, Timeline Event, Finding role, or Asset
that carries a reference. The existing Evidence drawer remains the only record-reading
surface; occurrence context neither reads nor compares Evidence content.

## Frozen contract

- derived model `rolo-vis-episode-evidence-reference-context/v1`;
- literal authority `REFERENCE_OCCURRENCE_ONLY`;
- separate left and right lanes, with at most 20 visible occurrences per side;
- deterministic truncation that retains every represented source lane before filling
  the remaining budget in publication order;
- identity and source-lane cross-checks against the validated v0.25 comparison;
- complete versus bounded-partial timeline coverage retained unchanged;
- literal false content, equivalence, quality, verification, causal-attribution,
  release, and write authority;
- no producer schema, endpoint, feature flag, Evidence batch read, or artifact access.

The producer minimum remains unchanged. `workbench.episode-read-model/v1`,
`workbench.episode-revision-history/v1`, and
`workbench.episode-cohort-read-model/v1` continue to be negotiated independently.

## Promotion evidence

- E11A–E11C commit `e863266` was approved.
- rolo-vis PR #11 passed the complete remote CI gate and merged to main as `838e2c2`.
- E11D independently read a live exact-match pair through `RoloClient`, derived the
  reviewed v2 comparison and v1 reference context, and retained Episode plus Timeline
  occurrences on both sides.
- Controlled stress projections were cloned from those parser-validated public read
  models. A 25-event mixed-source projection exercised all five source lanes and the
  20-occurrence bound; a bounded-partial projection preserved partial timeline
  coverage. These projections do not claim that the producer served the added rows.
- The referenced but unresolved Evidence record remained rejected with HTTP 404.
- Every authority-escalation flag remained literal `false`.

## Deferred successor work

Evidence content comparison, semantic equivalence, ranking, scoring, quality or
sufficiency verdicts, batch reads, export, external handoff, recollection, replay,
media delivery, release influence, and every write action remain outside this baseline.
