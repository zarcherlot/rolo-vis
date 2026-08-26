# Episode Observation Bundle baseline

Status: established baseline

Version: `0.37.0`

Baseline ID: `rolo-vis-episode-observation-bundle/2026-08`

Extends: rolo-vis `v0.36.0` / `rolo-vis-episode-review-session-release/2026-08`

Frontend minimum: `a76801b`

Frontend main merge: `5453aa5`

Producer minimum: rolo `a75ea0b` (fast-forwarded to main as `a75ea0b`)

Validated upstream head: rolo `a75ea0b`

Required feature: `workbench.episode-observation-bundle/v1`

## Product boundary

This baseline adds a read-only Perspective Tray to an already accepted immutable
Episode revision. It explains sanitized Observation Bundle history and source coverage
without exposing internal capture/provider context or changing outcome, cause,
confirmation, Capability readiness, verification, release, or deployment authority.

## Frozen contract

- require exact immutable revision reads through
  `GET /v1/robots/{robot_id}/episodes/{episode_id}/observation-bundles`;
- advertise and call the endpoint only when
  `workbench.episode-observation-bundle/v1` is present;
- accept only the reviewed collection, summary, and source-coverage v1 schemas;
- keep bundle status, source availability, time synchronization, spatial alignment,
  and world scope as independent non-color semantics;
- derive `NONE` and `MIXED` only from asset-bearing sources;
- reject unknown fields/enums, unsafe strings, duplicate or unordered pages, stale
  Asset/Evidence IDs, verification influence, and invalid complete parent lineage;
- traverse at most five 20-item pages, retaining earlier validated pages as explicitly
  bounded when a later page fails;
- keep bundle selection in current React component memory only;
- reuse existing metadata-only Asset focus and sanitized Evidence drawer;
- add no media/content delivery, capture, recollection, replay, export, persistence,
  identity, execution, release, deployment, or robot write authority.

## Promotion evidence

- E22A-E22D were reviewed and approved; the consumer and live-gate candidate was
  sealed as frontend main merge `5453aa5`.
- The rolo producer was fast-forwarded to main as `a75ea0b` and advertised the exact
  feature and three reviewed public schemas.
- rolo collected 604 tests: 597 passed, 7 environment-gated tests skipped, and 0
  failed; `ruff check src tests` passed.
- rolo-vis passed 212 application/contract tests, TypeScript checking, production/Sites
  packaging, and four Sites worker tests.
- The live gate used an isolated copy of the desktop `rolo-data` directory without
  modifying its source. It read `mentorpi / ep-e22-observation@1`, newest-first bundle
  sequences 2 then 1, `UNAVAILABLE` and `PARTIAL` states, and `REJECTED`, `AVAILABLE`,
  and `MISSING` source states.
- Complete parent lineage resolved; unsafe internal fields remained absent;
  Observation influence on verification, media delivery, persistence, and write support
  all remained false. Invalid cursor returned 422 and revision conflict returned 409.

## Deferred successor work

Bundle deep links, browser or backend persistence, internal capture manifests, media or
asset bytes, recollection, replay, export, identity, causal or verification authority,
Capability readiness influence, deployment control, and every robot write action remain
outside this baseline.
