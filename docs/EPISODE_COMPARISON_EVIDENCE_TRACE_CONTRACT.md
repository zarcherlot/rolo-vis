# E10 / v0.25 Episode comparison evidence trace contract

Status: E10A–E10C review candidate. It is not a promoted `v0.25.0` baseline.

## Goal

Continue the E9 cohort-to-comparison investigation path with a bounded, read-only
index of Evidence IDs referenced by either pinned Episode side. The index helps an
operator answer two questions without creating new authority:

1. Is the validated Evidence ID referenced on the left, right, or both sides?
2. Does each side reference it from Episode metadata, a visible timeline event, a
   Finding lane, or an Asset summary?

The existing Evidence drawer remains the only record inspection surface. E10 does not
add an Episode comparison endpoint, an Evidence batch endpoint, or another producer
contract.

## Input and derivation boundary

E10 derives `rolo-vis-episode-pair-comparison/v2` only after the two existing Episode
details and bounded revision-pinned timelines pass their current identity, revision,
ordering, count, schema, and unsafe-content checks.

The trace collects only these sanitized public references:

- `EpisodeDetail.evidence_ids` as `EPISODE`;
- visible `EpisodeTimelineEvent.evidence_ids` as `TIMELINE`;
- `EpisodeFindingSummary.supporting_evidence_ids` as `FINDING_SUPPORTING`;
- `EpisodeFindingSummary.contradicting_evidence_ids` as
  `FINDING_CONTRADICTING`;
- non-null `EpisodeAssetSummary.evidence_id` as `ASSET`.

IDs are deduplicated per side. Source lanes are preserved independently on both sides.
The display order is deterministic: first occurrence on the left, followed by IDs
first occurring on the right. Source badges use a fixed Episode, Timeline, Finding
supporting, Finding contradicting, Asset order.

## Bounded projection

- At most 100 unique Evidence IDs are rendered.
- `totalUniqueCount`, `visibleCount`, and `truncatedCount` keep truncation explicit.
- Left/right unique, shared, and side-only counts are computed over the full derived
  union, not only the visible first 100 rows.
- Timeline coverage is carried into the trace. `BOUNDED_PARTIAL` means event-level
  references outside the loaded window may be absent.
- The trace never probes missing pages, raw artifacts, paths, URLs, or producer
  payloads to fill gaps.

## Authority rules

The trace authority is the literal `REFERENCE_PRESENCE_ONLY`.

- `SHARED` means the same validated Evidence ID is referenced by both sides. It does
  not mean the record supports the same claim, outcome, or Finding on both sides.
- `LEFT_ONLY` and `RIGHT_ONLY` describe bounded reference presence, not missing
  evidence, improvement, regression, completeness, or correctness.
- Supporting and contradicting Finding lanes remain separate. Neither lane is
  promoted to a client verdict.
- Opening the Evidence drawer validates and reads that one record through the existing
  Evidence contract. An ID's presence alone does not assert that the record exists,
  is fresh, is sufficient, or is applicable.
- Evidence volume and source count do not affect Episode comparability, outcome,
  verification, cohort membership, release state, or causal attribution.

The derived model freezes these negative authorities as literal `false`:
`supportsEvidenceQuality`, `supportsVerification`, and
`supportsCausalAttribution`.

## Compatibility

- Producer minimum remains the E8 baseline; rolo `main` through `e96c9b0` requires no
  Episode schema change for E10.
- The E9 comparison and cohort deep-link behavior remains unchanged.
- Backends without revision history or cohort support retain their current comparison
  behavior; E10 adds no feature probe.
- Raw artifact paths and unsafe URLs remain rejected before the derived model is
  built.

## Delivery slices

- **E10A — contract:** freeze sources, ordering, bounds, and negative authority.
- **E10B — derived model:** build the deterministic per-side trace and coverage facts.
- **E10C — workbench surface:** show counts and source lanes, and open the existing
  Evidence drawer for one selected ID.
- **E10D — validation and promotion:** after review, run live compatible-backend
  regression, freeze the successor metadata, and promote `v0.25.0` separately.

## Deferred

Evidence content comparison, semantic equivalence, ranking, scoring, quality or
sufficiency verdicts, batch reads, export, external handoff, recollection, replay,
media delivery, release influence, and every write action remain out of scope.

