# Episode revision history baseline

Status: established baseline

Version: `0.22.0`

Baseline ID: `rolo-vis-episode-revision-history/2026-08`

Extends: rolo-vis `v0.21.0` / `rolo-vis-episode-diagnostic/2026-08`

Frontend minimum: `b836dcd` (merged to main by `b9ca3f0`)

Producer minimum: rolo `48da032` (merged to main by `4efd11df`)

## Product boundary

This release adds feature-negotiated, revision-addressable historical detail and timeline
reads to the read-only Episode Studio. A validated newest-first history lets the user pin
an immutable revision and compare two distinct revisions of the same Episode. The client
continues to derive only neutral right-minus-left facts and never assigns a verdict.

Connections without `workbench.episode-revision-history/v1` keep the v0.21 current-only
behavior and do not call the history endpoint.

## Frozen contract

- `rolo-episode-revision-collection/v1`
- `rolo-episode-revision-summary/v1`
- `GET /v1/robots/{robot_id}/episodes/{episode_id}/revisions`
- revision-addressed Episode detail and timeline reads
- at most 1,000 contiguous immutable revisions, read in bounded 100-item pages

Identity drift, duplicate or missing revisions, false current markers, broken parent
links, unsafe references, timeline drift, repeated cursors, and publication-count
contradictions fail closed. Agent inference remains unverified, and numeric deltas remain
`UNINTERPRETED_DELTA`.

## Promotion evidence

- rolo PR #15 passed Python 3.10–3.13, production-sandbox, and LeRobot E2E checks.
- rolo-vis PR #3 passed its complete remote verification gate.
- Local verification passed 127 tests, TypeScript checking, production packaging, and
  four Sites worker tests.
- Live isolated validation read revisions 1 and 2 of one MentorPi Episode, six events per
  side, with outcome and causal authority both explicitly disabled.

## Deferred successor work

Media synchronization, live streaming, replay, recollection, export, external handoff,
statistical cohort verdicts, and every write action require separate contracts and remain
outside this baseline.
