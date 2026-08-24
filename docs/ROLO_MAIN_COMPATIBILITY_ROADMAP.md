# rolo main compatibility roadmap

## Delivery status

- Batch 1 + Batch 2: approved, committed, and pushed.
- Batch 3: approved, committed, and pushed.
- Batch 4 + Batch 5: approved and ready to become the next compatibility baseline.

## Approved baseline: Batch 1 + Batch 2

This batch restores a safe compatibility boundary between rolo-vis and the P0 Adapt
heuristic Agent redesign merged into rolo `main`.

- Fleet blocker collections are parsed as explicit v1 or v2 contracts. v1 remains a
  basic read-only inbox and never receives invented triage categories or resolution
  semantics.
- v2 retains normalized triage, resolution evidence, and blocker detail.
- Wiki insight cards expose the already validated `source` enum as either
  `Rule-derived` or `Agent suggestion · unverified`.
- Raw artifact paths remain rejected by the client trust boundary.

Batch 1 + 2 passed review and is the compatibility baseline for the remaining work.

## Batch 3: Discovery heuristic summary

Status: approved, committed, and pushed.

### Upstream dependency

rolo must publish a versioned, sanitized discovery-history summary. rolo-vis must not
read `heuristic_analysis_ref` or any raw heuristic artifact.

### Expected safe contract

- `mode`: `disabled | shadow | enabled`
- `status`: `AGENT_COMPLETED | FALLBACK | DISABLED`
- `inferred_operation_count`: non-negative integer
- `missing_evidence_count`: non-negative integer
- `influences_release`: literal `false`

### UI scope

- Show mode and status on the selected Wiki discovery snapshot.
- Show inferred and missing-evidence counts in a separate advisory trust lane.
- State explicitly that `AGENT_COMPLETED` means the analysis completed, not that an
  Operation or physical outcome was verified.

### Acceptance

- Cover all three statuses and all supported modes.
- `shadow + AGENT_COMPLETED` must not change Capability readiness.
- Unknown enum values, unsafe references, negative counts, and `influences_release`
  values other than `false` fail closed.

## Batch 4: Capability inference provenance

Status: approved.

### Upstream dependency

rolo must expose candidate provenance through a versioned Capability summary or
binding contract, including:

- `origin`: `DETERMINISTIC | HEURISTIC_AGENT`
- `verification_status`: `DISCOVERED_UNVERIFIED` for heuristic candidates
- the existing route authority as a separate dimension

### UI scope

- Render heuristic mappings as `Inferred · unverified`.
- Separate inferred mappings from deterministic applicability and ordinary binding
  coverage.
- If a route was observed but its Operation mapping was inferred, show both facts
  without collapsing them into `Observed binding`.

### Acceptance

- Heuristic candidates do not increase Available or Verified counts.
- Heuristic candidates do not increase ordinary Applicable, With bindings, or
  Observed-binding counts.
- Release-gated bindings remain the only established binding readiness signal.

## Batch 5: Target evidence scope and freshness

Status: approved.

### Upstream dependency

rolo must compute a sanitized target-evidence summary. The Web client must not infer
freshness from request timestamps or expose collector identity, transport details, or
raw paths.

### Expected safe contract

- `deployment_scope`: `LOCAL | REMOTE`
- `freshness`: a backend-owned bounded enum
- `collected_at`: sanitized timestamp
- `refresh_required`: boolean
- `refresh_reason`: bounded safe text or null

### UI scope

- Show local/remote scope alongside the relevant discovery snapshot.
- Show expired/stale evidence and a read-only recollection prompt.
- Do not execute recollection or remediation from rolo-vis in this batch.

### Acceptance

- Request `expires_at` is never presented as evidence freshness.
- Stale evidence cannot appear current or verified.
- Raw artifact paths and sensitive collector metadata remain rejected.

## Batch 6: MVP baseline hardening

Status: approved and included in the MVP baseline.

- Capability and discovery parsers now live behind an explicit contract boundary.
- The accepted capability v1/v2 and discovery v1/v2/v3 schema ranges are pinned in
  one compatibility manifest and exercised by baseline tests.
- Review-only trust fixtures cover Agent completed, fallback, disabled, fresh-local,
  and stale-remote states without entering the live product data path.
- Development, production build, preview, and Sites packaging use the same Vite
  configuration loader.

## Batch 7: Read-only MVP baseline candidate

Status: approved and promoted as the `0.19.0` MVP baseline.

- Version `0.19.0` identifies the established read-only MVP baseline.
- The baseline freezes the read-only Overview, Stack Map, Capability, Wiki,
  Lifecycle, and Evidence boundaries described in `MVP_READONLY_BASELINE.md`.
- Promotion passed the full baseline verification command and a live `rolo-data`
  regression. Future contract expansion starts from this tagged boundary.

## Phase 2 design: Episode contracts

Status: E1–E2 producer contracts implemented; E3 approved and V1C hardening is ready
for review on an independent post-baseline branch.

- rolo owns a new sanitized Episode read-model family; rolo-vis will not consume raw
  Episode artifacts, Canonical Operation output, or `robot_use` provider payloads.
- V1 design covers collection, detail, revision-pinned timeline pages, asset metadata,
  and evidence-linked findings.
- State, execution outcome, and verification remain separate dimensions.
- Timeline authority keeps declared intent, observation, Agent inference, human
  confirmation, and Verify-stage outcome distinct.
- Media delivery, live streaming, Episode compare, replay, recollection, and write
  actions are deferred until their contracts receive separate review.

Frontend acceptance and rollout order are recorded in
`EPISODE_STUDIO_CONSUMER_CONTRACT.md`.

E3 adds only feature-negotiated read surfaces. V1C adds bounded 500-event projection,
keyboard navigation, reduced-motion behavior, stable revision/event deep links, and a
live `rolo-data` contract regression. The `v0.19.0` MVP tag and its compatibility
ranges remain unchanged until Episode is promoted separately.
