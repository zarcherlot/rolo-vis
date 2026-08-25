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

## Phase 2 E4: Episode read-only baseline

Status: approved and promoted as rolo-vis `v0.20.0`; producer minimum rolo `e2217bb`.

- `EPISODE_SCHEMA_COMPATIBILITY` freezes the seven reviewed v1 public read models
  without mutating `MVP_SCHEMA_COMPATIBILITY` or the `v0.19.0` tag.
- `EPISODE_BASELINE` pins candidate commit `cb09340`, read-only mode, release `0.20.0`,
  and the required `workbench.episode-read-model/v1` feature.
- Parsers resolve accepted schema names through the compatibility allowlist while
  preserving exact field, identity, revision, authority, and unsafe-content checks.
- The rolo E1–E2 producer is pinned to `e2217bb`; clean two-repository verification and
  the live `rolo-data` regression passed before promotion work began.
- Episode pair comparison is the next planned read-only contract design after this
  candidate is promoted; media, live stream, replay, export, and write actions remain
  outside the candidate.

## Phase 2 E5: Episode Pair Compare

Status: E5A and E5B approved.

- Comparison reuses two independently validated Episode v1 details and bounded
  revision-pinned timelines; no backend compare endpoint is introduced.
- Comparable mode requires the same robot, immutable terminal publications, matching
  operation, test-case identity, and expected behavior.
- All numeric deltas are neutral `right - left` facts. The client cannot label them as
  improved, regressed, safer, successful, or verified.
- Agent inference, confidence, evidence volume, and finding counts never produce a
  pair verdict or causal attribution.
- E5B UI work starts only after the derived model and trust language are reviewed.
- The pair URL pins `compare` and `compare_revision`; leaving Episode Studio clears the
  complete pair identity together with the left-side selection.
- E5B independently reads both details and bounded timelines, then renders publication
  facts, neutral deltas, and count-only lane/authority/severity/finding/asset
  distributions without a pair score.
- Revision drift, mixed identity, repeated cursors, page overlap, and event-count
  contradictions fail closed; incomplete inputs remain explicitly bounded partial.
- E5B rejects same-ID revision comparison because the public detail endpoint is not
  historical-revision addressable; this remains a future producer-contract dependency.

## Phase 2 E6: Finding Focus / Diagnostic Context

Status: approved and promoted with E5 as rolo-vis `v0.21.0`; producer minimum rolo
`570bad0`, merged to rolo `main` by `4cac539`.

- Selecting a published Finding creates a stable, revision-pinned `finding` deep link.
- Timeline events are included only as coincident window context; proximity cannot
  establish supporting evidence, cause, verification, or remediation authority.
- Supporting evidence, contradicting evidence, and supporting assets remain separate
  published lanes, including missing and redacted asset states.
- Candidate causes must remain inferred and unverified; confidence cannot promote them.
- Direct links may load only the existing bounded 500-event timeline. Partial context is
  explicit, and unsafe identity, order, count, or asset references fail closed.
- Supplementary observation, external handoff, export, replay, and every write action
  remain deferred pending separate producer and governance contracts.

The release freezes the E5 neutral pair comparison and E6 finding focus as a read-only
successor to `v0.20.0`. Same-Episode cross-revision comparison remains unavailable until
the producer exposes revision-addressable historical detail and timeline reads.

## E7 baseline: revision-addressable Episode history

Status: approved and promoted as rolo-vis `v0.22.0`; producer minimum rolo `48da032`,
merged to main by `4efd11df`; frontend minimum `b836dcd`, merged by `b9ca3f0`.

- Negotiate `workbench.episode-revision-history/v1` separately from the v0.21 Episode
  baseline.
- Validate the bounded revision chain before exposing historical detail.
- Keep old backends on current-revision behavior without probing the new endpoint.
- Allow the same Episode identity on both comparison sides only for two independently
  validated, distinct revision pins.
- Preserve neutral deltas and existing inference, evidence, and read-only authority
  boundaries.
- Promotion evidence includes all backend and frontend remote checks plus live
  two-revision validation with six timeline events per side.

## E8 baseline: Episode Cohort Review

Status: approved and promoted as rolo-vis `v0.23.0`; producer minimum rolo `463d501`,
merged to main by `891cbf1`; frontend minimum `2c2967f`, merged by `3f18124`.

- Use one pinned Episode revision as the server-validated semantic reference.
- Include at most one current, terminal, immutable revision from each other Episode.
- Require exact operation, test-case, and expected-behavior identity in a mandatory
  7/30/90-day window.
- Return one bounded, non-pageable population of at most 100 members with explicit
  complete/partial coverage and exclusion arithmetic.
- Keep all distributions descriptive; no ranking, regression, significance, causal,
  release, or write authority is introduced.
- E8A–E8D are frozen as the v0.23.0 read-only successor to the revision-history baseline.
- Validation evidence: 568 producer tests passed with four expected skips; 132 consumer
  tests, type checking, production build, and four Sites packaging tests passed.
- Live validation covered all 7/30/90-day windows, running and mutable exclusions, and
  a limit-one `BOUNDED_PARTIAL` response. No successor development is included.

## E9 candidate: Cohort investigation continuity

Status: E9A-E9C approved and pushed as `547134c`; E9D isolated live validation passed.
The v0.24 baseline candidate is pending review and promotion.

- Keep the revision-pinned cohort reference unchanged while selecting one exact-match
  member as the right side of the existing pair comparison.
- Carry only Episode identity and revision from the cohort. Independently read and
  validate both detail and timeline inputs before rendering a comparison.
- Preserve the existing comparison deep link and the selected cohort window, including
  members outside the currently loaded Episode index.
- Add no endpoint, producer schema, ranking, verdict, release signal, media access,
  external handoff, or write authority.
- rolo main through `e96c9b0` changes ADAPT discovery and Wiki narrative but leaves the
  public Episode contracts used here unchanged; the E8 producer minimum remains valid.
- E9D kept the reference pinned while independently reading an off-index cohort member,
  rejected an unavailable member revision, and round-tripped both pins plus the cohort
  window without introducing verdict or write authority.
