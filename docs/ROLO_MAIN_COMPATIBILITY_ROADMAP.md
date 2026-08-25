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

Status: approved and promoted as rolo-vis `v0.24.0`; frontend commits `547134c` and
`858c824`, merged to main by `a42adeb`; the E8 producer minimum remains unchanged.

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
- The E9 contract and validation are frozen as the v0.24.0 read-only successor to the
  Cohort Review baseline.

## E10 candidate: Comparison Evidence traceability

Status: approved and promoted as rolo-vis `v0.25.0`; frontend minimum `e756702`,
merged to main by `0dd4fec`; the E8 producer minimum remains unchanged.

- Derive one deterministic, bounded trace from the two already validated Episode
  details and revision-pinned timeline inputs. No producer or comparison endpoint is
  added.
- Preserve Episode, Timeline, Finding supporting, Finding contradicting, and Asset
  reference sources independently on both sides.
- Distinguish shared, left-only, and right-only ID presence without treating the label
  as evidence quality, verification, semantic equivalence, completeness, or cause.
- Render at most 100 unique references while keeping full counts, hidden counts, and
  bounded-partial timeline coverage explicit.
- Reuse the existing single-record Evidence drawer. Presence does not assert that the
  referenced record exists or supports an outcome.
- The E8 producer minimum remains unchanged. E10D passed live comparison-v2 and
  unresolved-Evidence validation before the `v0.25.0` promotion.

The detailed negative-authority and ordering rules are frozen in
`EPISODE_COMPARISON_EVIDENCE_TRACE_CONTRACT.md`.

The established release evidence is recorded in
`EPISODE_COMPARISON_EVIDENCE_BASELINE.md`.

## E11 baseline: Evidence reference occurrence context

Status: E11A–E11D are approved and promoted as the `v0.26.0` read-only baseline;
frontend minimum `e863266`, merged to main by `838e2c2`.

- Extend each visible v0.25 Evidence trace row with bounded left/right attachment
  points from the same validated Episode details and timelines.
- Preserve exact Episode, Timeline Event, Finding supporting/contradicting, and Asset
  identities without reading Evidence content.
- Show at most 20 occurrences per side and retain at least one visible occurrence from
  every represented source lane when truncation is required.
- Cross-check reconstructed occurrence sources against the v0.25 trace and fail closed
  on identity or source drift.
- Keep occurrence presence separate from Evidence availability, content, quality,
  sufficiency, semantic equivalence, verification, outcome, and cause.
- Add no producer schema, endpoint, feature flag, artifact access, release signal, or
  write authority.

The detailed contract is `EPISODE_EVIDENCE_REFERENCE_CONTEXT_CONTRACT.md`.

The established release evidence is recorded in
`EPISODE_EVIDENCE_REFERENCE_CONTEXT_BASELINE.md`.

## E12 baseline: Evidence context navigation continuity

Status: E12A–E12D are approved and promoted as the `v0.27.0` read-only baseline;
frontend minimum `e2e8302`, merged to main by `2263cd8`.

- Pin one selected v0.26 Evidence context row as `compare_evidence` alongside both
  comparison identities and revisions.
- Restore the selection only after the derived context validates the ID as visible;
  stale, hidden, malformed, or failed comparison selections are removed.
- Keep Context expansion separate from the Evidence drawer and preserve unrelated
  workbench query state.
- Clear the selection when either comparison side changes instead of carrying context
  across a different pair.
- Add no source-focus action, producer schema, endpoint, feature flag, content read,
  artifact access, release signal, or write authority.

The detailed contract is `EPISODE_EVIDENCE_CONTEXT_NAVIGATION_CONTRACT.md`.

The established release evidence is recorded in
`EPISODE_CONTEXT_NAVIGATION_BASELINE.md`.

## E13 baseline: Evidence occurrence source focus

Status: E13A–E13D are approved and promoted as the `v0.28.0` read-only baseline;
frontend minimum `508c6d2`, merged to main by `57e3aaf`.

- Reuse the existing `compare_evidence` selection with the existing `event` or
  `finding` deep-link field instead of creating duplicate occurrence state.
- Resolve left Timeline and Finding occurrence targets again against the pinned public
  inputs and fail closed when an ID, role, or Evidence attachment has drifted.
- Preserve both comparison identities, keep Context expanded, and leave every right
  occurrence context-only.
- Keep Episode and Asset occurrences context-only until an equivalent sanitized focus
  surface is explicitly contracted.
- Add no producer schema, endpoint, Evidence content read, artifact access, verdict,
  release signal, or write authority.

The frozen contract is `EPISODE_EVIDENCE_OCCURRENCE_FOCUS_CONTRACT.md`.

The established release evidence is recorded in
`EPISODE_OCCURRENCE_FOCUS_BASELINE.md`.

## E14 baseline: Asset occurrence focus continuity

Status: E14A–E14D are approved and promoted as the `v0.29.0` read-only baseline.
Frontend minimum `7123f01` was merged to `main` by `4578788` after remote CI passed.

- Add one bounded `asset` deep-link field scoped to an existing selected
  `compare_evidence` context and both revision-pinned comparison identities.
- Revalidate the exact left Asset occurrence and its public `evidence_id` attachment
  before focusing the existing metadata-only card.
- Clear stale focus when Context, pair, revision, or Episode identity changes.
- Keep right-side Asset and every Episode-level occurrence context-only.
- Add no producer contract, endpoint, Asset bytes, media delivery, raw path, Evidence
  content read, verdict, release signal, or write authority.

The review contract is `EPISODE_ASSET_OCCURRENCE_FOCUS_CONTRACT.md`.

The established release evidence is recorded in
`EPISODE_ASSET_OCCURRENCE_FOCUS_BASELINE.md`.

## E15 baseline: right Context handoff

Status: E15A-E15D are approved and promoted as the `v0.30.0` read-only baseline.
Frontend minimum `801231f` was merged to `main` by `b487b01` after all complete local,
Sites, static authority, and isolated live gates passed.

- Make an exact visible right Event, Finding, or Asset actionable only by swapping the
  two already pinned Episode/revision orientations.
- Preserve the selected `compare_evidence` ID and reuse the reviewed left-side focus
  resolver after the swap.
- Add no `side` query state, right-detail UI, endpoint, producer contract, content read,
  verdict, release signal, or write authority.
- Treat reference/candidate as viewport orientation labels; handoff never promotes a
  run or changes outcome authority.

The review contract is `EPISODE_RIGHT_CONTEXT_HANDOFF_CONTRACT.md`.

The established release evidence is recorded in
`EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.md`.

## E16 candidate: Episode navigation rehydration

Status: E16A-E16D approved and promoted as the `v0.31.0` read-only baseline.
Frontend minimum `5776492` was fast-forwarded to `main` as `5776492`; main CI #42
passed before baseline promotion.

- Treat browser Back/Forward as a controlled input and restore only strictly validated
  Episode deep links or known workbench views.
- Remount the Episode request boundary on history replay so prior bounded requests are
  aborted and restored pins are independently loaded and revalidated.
- Reconnect only when the restored target names a different robot; same-robot history
  replay must not repeat the workbench bootstrap.
- Fail malformed Episode and unsupported view history entries closed to Stack Map and
  remove their navigation fields.
- Clear stale Episode replay state on explicit Sidebar navigation.
- Add no producer/API contract, write authority, execution replay, content access,
  release signal, or production deployment.
- E16C exercised a real E15 orientation history through Back/Forward and added a
  reusable live gate for same/cross-robot replay, malformed state, and settled feature
  negotiation without adding endpoint or write authority.

The review contract is `EPISODE_NAVIGATION_REHYDRATION_CONTRACT.md`.

The established release evidence is recorded in
`EPISODE_NAVIGATION_REHYDRATION_BASELINE.md`.

## E17 candidate: Episode review link handoff

Status: E17A-E17D approved and promoted as the rolo-vis `v0.32.0` read-only
baseline. Frontend minimum `92689a9` was fast-forwarded to `main` as `92689a9`;
main CI #44 passed before baseline promotion.

- Build one absolute canonical review link only from an immutable, revision-pinned
  Episode state that survives the strict E16 parser unchanged.
- Strip unknown query state, hash fragments, credentials, and non-HTTP(S) origins.
- Revalidate visible Event, Finding, Asset, comparison, and Evidence-context focus
  before a user-initiated clipboard write.
- Keep the recipient on the existing independent read and feature-negotiation path.
- Add no endpoint, producer contract, browser storage, content export, verdict, release
  signal, execution replay, or robot write authority.
- E17C covers canonical and comparison round trips, unrelated-state stripping,
  same/cross-robot restore planning, stale state, and clipboard denial.
- E17C passed 177 application tests, TypeScript, production/Sites packaging, the live
  two-Episode gate, and rebuilt-preview copy/restore/stale-context validation without
  adding console errors or authority.

The review contract is `EPISODE_REVIEW_LINK_HANDOFF_CONTRACT.md`.

The established release evidence is recorded in
`EPISODE_REVIEW_LINK_HANDOFF_BASELINE.md`.

## E18 candidate: Episode review handoff receipt

Status: E18A-E18D approved and promoted as the rolo-vis `v0.33.0` read-only
baseline. Frontend minimum `347abd8` was fast-forwarded to `main` as `347abd8`;
main CI #46 passed before baseline promotion.

- Extend the E17 link with one canonical `review_handoff=1` navigation marker while
  retaining the frozen E17 builder as an independently testable boundary.
- Show a recipient receipt only after the exact robot, immutable revision, bounded
  focus, optional comparison pair, Evidence context, and Asset attachment are re-read
  and revalidated.
- Reject duplicate, malformed, fragmented, credential-bearing, or non-canonical receipt
  URLs without treating ordinary Episode navigation as authenticated.
- State that the receipt does not prove sender identity, Evidence quality, outcome,
  verification, cause, or release authority.
- Add no endpoint, producer contract, browser storage, signature, content export,
  execution replay, release signal, or write authority.

The review contract is `EPISODE_REVIEW_HANDOFF_RECEIPT_CONTRACT.md`.

The established release evidence is recorded in
`EPISODE_REVIEW_HANDOFF_RECEIPT_BASELINE.md`.
