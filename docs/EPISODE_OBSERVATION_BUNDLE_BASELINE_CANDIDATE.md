# Episode Observation Bundle baseline candidate

Status: E22D review candidate; not promoted

Target version: `0.37.0`

Candidate ID: `rolo-vis-episode-observation-bundle/2026-08`

Extends: rolo-vis `v0.36.0` / `rolo-vis-episode-review-session-release/2026-08`

Frontend minimum: `a76801b`

Producer minimum: rolo `a75ea0b`

Required feature: `workbench.episode-observation-bundle/v1`

## Candidate boundary

This candidate adds a read-only Perspective Tray to an already accepted immutable
Episode revision. It explains sanitized Observation Bundle history and source coverage
without exposing internal capture/provider context or changing outcome, cause,
confirmation, Capability readiness, verification, release, or deployment authority.

The candidate remains versioned as `0.36.0` in package and plugin manifests until the
E22D review is approved. It is not merged to `main`, tagged, or deployed.

## Frozen contract proposal

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

## E22D validation plan

- preserve the desktop `rolo-data` source and create an isolated validation copy;
- seed that copy with one immutable Episode publication and matching sanitized
  Observation Bundle publication derived from reviewed upstream fixtures;
- run the rolo `a75ea0b` API against only the isolated config/artifact/output roots;
- verify feature negotiation, exact revision, newest-first history, parent resolution,
  partial/unavailable bundles, missing/rejected sources, unsafe-field omission, invalid
  cursor rejection, and exact-revision conflict rejection through the rolo-vis client;
- run complete rolo and rolo-vis tests, TypeScript checking, production/Sites build,
  and Sites worker packaging tests.

## E22D validation evidence

Validated on 2026-08-26 against an isolated copy of the desktop `rolo-data`
directory; the source directory was not modified.

- rolo producer `a75ea0b`: 604 tests collected, 597 passed, 7 environment-gated
  skips, 0 failures; `ruff check src tests` passed;
- rolo-vis consumer `a76801b` plus this uncommitted E22D candidate: TypeScript
  checking passed, 212 application/contract tests passed, 4 Sites worker tests
  passed, and the production/Sites build completed;
- the live gate connected through the rolo-vis client to the real rolo API,
  negotiated `workbench.episode-observation-bundle/v1`, and read the immutable
  `mentorpi / ep-e22-observation@1` publication;
- the gate observed two newest-first bundles (`sequence` 2 then 1), both
  `UNAVAILABLE` and `PARTIAL` bundle states, and `REJECTED`, `AVAILABLE`, and
  `MISSING` source states;
- complete parent lineage resolved; no unsafe internal field was exposed and no
  Observation influenced verification;
- invalid cursor returned 422 and a nonexistent exact revision returned 409;
- media delivery, persistence, and write support remained false.

The preview at `http://127.0.0.1:5175/` uses the same isolated API and data copy for
review. These results are candidate evidence only and do not promote the baseline.

## Promotion gate

Promotion requires explicit review after all E22D evidence is attached. Only then may a
separate operation update manifests to `0.37.0`, commit the final baseline document,
merge both repositories as applicable, create `v0.37.0`, update remote baseline
metadata, or deploy production. The candidate itself authorizes none of those actions.
