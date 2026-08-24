# Episode read-only baseline candidate

Status: review candidate

Candidate ID: `rolo-vis-episode-readonly/2026-08`

Base: rolo-vis `v0.19.0` / `rolo-vis-mvp-readonly/2026-08`

Frontend minimum: `d712f32`

Producer minimum: rolo `e2217bb`

## Purpose

This candidate freezes the reviewed Episode v1 consumer boundary without changing the
established `v0.19.0` MVP tag. It is a compatibility checkpoint, not a release tag and
not permission to expose media, replay, export, recollection, or robot write actions.

## Frozen public contract

| Read model | Accepted version |
| --- | --- |
| Episode collection | `rolo-episode-collection/v1` |
| Episode summary | `rolo-episode-summary/v1` |
| Episode detail | `rolo-episode-detail/v1` |
| Timeline page | `rolo-episode-timeline-page/v1` |
| Timeline event | `rolo-episode-timeline-event/v1` |
| Asset summary | `rolo-episode-asset-summary/v1` |
| Finding summary | `rolo-episode-finding-summary/v1` |

The executable allowlist is `EPISODE_SCHEMA_COMPATIBILITY` in
`src/contracts/compatibility.ts`. Unknown schemas fail closed.

## Frozen behavior

- Episode navigation remains gated by `workbench.episode-read-model/v1`.
- Live contract failures never substitute Lifecycle or fixture data.
- Robot, Episode, revision, and selected event are pinned in stable read-only links.
- Timeline requests are revision-pinned, pages are limited to 100 events, and the
  interactive view is capped at 500 events.
- Declared, observed, inferred, human-confirmed, and Verify-stage authority remain
  distinct. Agent inference never becomes observation or verification.
- Assets remain metadata-only. Storage paths, signed URLs, raw payloads, prompts,
  credentials, and secret content remain rejected.

## Promotion gate

1. The rolo Episode producer implementation and reference projection must be reviewed,
   committed, and reachable from a durable branch or `main`.
2. `npm run verify:baseline` must pass from a clean rolo-vis candidate worktree.
3. `npm run check:episode-live` must pass against the committed producer using the
   desktop `rolo-data` projection.
4. Browser review must cover feature negotiation, stable deep-link restore, revision
   conflict, keyboard navigation, Evidence drilldown, and responsive containment.
5. The candidate must contain no Episode media fetch, replay, export, recollection,
   invocation, cancellation, remediation, terminal, or arbitrary file-access path.
6. Only after both repositories have traceable commits may the release version and tag
   be proposed. This candidate does not itself create `v0.20.0`.

The producer durability gate was satisfied on 2026-08-24 by rolo commit `e2217bb` on
`codex/episode-contract-design` after the full backend suite passed.

## Deferred successor work

- Episode pair comparison should be the next read-only contract design after promotion.
- Media delivery requires a separate bounded content contract and classification gate.
- Live updates require monotonic cursor/resume semantics and a disconnect model.
- Replay, evidence export, supplementary observation, and all robot actions require
  separate authority, risk, and audit contracts.
