# E22 Episode Observation Bundle consumer contract

Status: E22A-E22C approved; E22D baseline and live-data review candidate

Target baseline: rolo-vis `v0.37.0`

Extends: rolo-vis `v0.36.0` / `rolo-vis-episode-review-session-release/2026-08`

Required upstream candidate: `workbench.episode-observation-bundle/v1`

## 1. Decision

E22 introduces the contract for a read-only Perspective Tray in Episode Studio. The
tray explains which sanitized observation source classes and already-published Episode
assets formed each immutable Observation Bundle. It must not read an internal bundle
manifest or treat bundle completeness as outcome, cause, confirmation, or verification.

E22A and the matching E22B producer are approved. E22C now implements a strictly
feature-negotiated client read and the smallest coherent Perspective Tray while
rolo-vis continues to advertise version `0.36.0`. Promotion to `v0.37.0`, main, tag,
live-data gate, and production deployment remain reserved for E22D review.

## 2. Negotiated contract

The consumer requires all of the following:

- health feature `workbench.episode-observation-bundle/v1`;
- `rolo-episode-observation-bundle-collection/v1`;
- `rolo-episode-observation-bundle-summary/v1`;
- `rolo-episode-observation-source-coverage/v1`;
- the existing `rolo-episode-asset-summary/v1` and sanitized Evidence contracts.

The candidate read is:

```text
GET /v1/robots/{robot_id}/episodes/{episode_id}/observation-bundles
    ?revision={revision}&limit={1..20}&cursor={opaque}
```

The client must use the exact immutable revision already accepted for Episode detail.
Pages are newest-first with strictly descending sequences. It must reject a response
with another robot, Episode, revision, duplicate bundle ID or sequence, invalid order,
stale asset/Evidence ID, unknown enum, inconsistent world scope, unsafe limitation, or
verification influence. A parent may be on an older page; complete traversal must
resolve every parent and reject cycles or dangling references.

## 3. Perspective Tray information architecture

The future tray has three levels:

1. **Bundle history** — sequence, initial/supplementary trigger, closed-open Episode
   window, status, and local selection.
2. **Coverage summary** — synchronization, spatial alignment, world scope, available
   source count, and explicit partial/unavailable limitations.
3. **Source cards** — safe label, source kind, modality, world kind, availability,
   time/spatial quality, existing asset references, and limitations.

Bundle selection remains current-component memory only in E22. It does not add URL,
browser history, clipboard, local/session storage, cookie, cross-tab, or review-handoff
state. A later deep-link proposal must define revision and bundle identity explicitly.

## 4. Required visual semantics

- `PHYSICAL`, `SIMULATED`, and `REPLAYED` receive distinct, persistent text labels;
  color alone is insufficient.
- `NONE` means the bundle has no asset-bearing source; `MIXED` is shown as mixed input,
  never normalized to physical. Missing or rejected declarations do not change scope.
- `SYNCED`, `DEGRADED`, `UNSYNCED`, and `UNKNOWN` describe time alignment only.
- `ALIGNED`, `DEGRADED`, `UNALIGNED`, and `UNKNOWN` describe spatial/calibration
  alignment only; the two quality dimensions cannot be merged into one score.
- `MISSING`, `STALE`, `REJECTED`, and `UNAVAILABLE` stay distinct. `REJECTED` is a
  policy/contract refusal, not a sensor failure.
- `COMPLETE` means declared bundle inputs were assembled. It never upgrades Episode
  outcome, Finding authority, Evidence quality, Capability readiness, or verification.
- `SUPPLEMENTARY` indicates sequence history only. It does not expose requester
  identity or provide a control to request another observation.

## 5. Asset and Evidence handoff

An asset reference resolves only through the existing Episode detail projection. The
tray may focus the existing metadata inspector or sanitized Evidence drawer. It must
not construct a content URL, infer a path, request an internal artifact, or display a
media player in E22.

Missing or unavailable metadata remains visible as a limitation. The client must not
substitute demo assets, silently drop a source, or infer freshness, synchronization,
alignment, world kind, or verification from timestamps or labels.

## 6. Loading and failure states

- Feature absent: omit the Perspective Tray and keep the frozen Episode v1 experience.
- Collection empty: show `No published observation bundles for this revision`.
- `404`: Episode identity is stale or unavailable; keep the existing Episode failure
  boundary.
- `409`: selected revision is no longer a valid exact read; do not retry against latest.
- `422`: reject malformed local request state before sending when possible.
- Integrity or schema failure: fail the complete tray closed with no partial fixture
  fallback.
- A later page failure retains the already validated earlier page but marks history
  bounded and incomplete; unresolved parents remain neutral until traversal completes,
  and the client does not invent a total.

## 7. Security, deployment, and authority boundary

The consumer recursively rejects artifact references, paths, URIs, signed/content
URLs, host/device/topic names, collector/provider identity, credentials, command or
telemetry payloads, TF/map/calibration/renderer payloads, prompts, model responses, and
arbitrary JSON.

The Sites build may call only the same configured HTTP control-plane API used by the
existing workbench. It receives no filesystem dependency, raw TCP connection, hosted
secret, durable state, upload, or Sites-owned database for this feature.

E22 adds no execution outcome, causal, confirmation, verification, readiness, release,
identity, content, media, capture, recollection, replay, export, remediation,
deployment, or robot write authority.

## 8. Delivery and review gates

### E22A — current contract design

- agree the public schemas, endpoint, enums, integrity rules, and UI semantics across
  rolo and rolo-vis;
- at design approval, retain `v0.36.0` runtime behavior and advertise no new feature.

### E22B — upstream producer

- wait for an independently reviewed rolo projection and fixture;
- cover complete, partial, unavailable, mixed-world, missing, stale, and rejected
  source cases plus unsafe-field rejection.

### E22C — approved consumer and Perspective Tray

- add strict types, parser, client read, feature gate, and the smallest coherent tray;
- reuse existing asset/Evidence views and keep content delivery absent.

Implemented in this candidate:

- strict recursive public-field rejection plus exact identity, revision, page, enum,
  world-scope, asset, Evidence, parent-lineage, and non-verification validation;
- bounded newest-first traversal of at most 100 records, with earlier validated pages
  retained and labeled incomplete when a later page fails;
- component-memory-only bundle selection, explicit time/spatial/world/availability
  labels, and handoff only to existing Asset focus and sanitized Evidence views;
- omission of the complete tray when the health feature is absent, with no demo,
  media, capture, persistence, replay, export, recollection, or write fallback.

### E22D — current baseline candidate

- run complete rolo and rolo-vis gates plus live `rolo-data` validation;
- require explicit review before `v0.37.0`, tag, main promotion, or any production
  deployment.

## 9. E22A acceptance

- Contract names and revision rules match the upstream design.
- No current manifest or client advertises or calls the candidate feature.
- Every source state and trust dimension has an explicit non-color label.
- Partial and unavailable data remain useful without becoming authoritative.
- Existing Episode asset and Evidence projections remain the only safe drilldowns.
- Unsafe fields and inconsistent cross-model references fail closed.
- The design contains no hidden media, persistence, identity, or write expansion.

## 10. E22C acceptance

- The endpoint is called only when `workbench.episode-observation-bundle/v1` is
  advertised and always uses the already accepted immutable Episode revision.
- Unknown fields/enums, unsafe strings, stale Asset/Evidence IDs, inconsistent world
  scope, verification influence, duplicate/order violations, and invalid complete
  lineage fail closed.
- `COMPLETE` is visibly described as input assembly only, while missing, stale,
  rejected, and unavailable sources remain distinct non-color labels.
- Selection remains React component memory only and adds no URL or browser storage.
- E22C remains unpromoted until the E22D full and live-data gates are approved.
