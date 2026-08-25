# E11 / v0.26 Episode Evidence reference context contract

Status: E11A–E11D approved and promoted as the `v0.26.0` read-only baseline.

Extends: rolo-vis `v0.25.0` / `rolo-vis-episode-comparison-evidence/2026-08`

## Goal

The v0.25 trace identifies which Evidence IDs appear on each comparison side and which
public source lanes reference them. E11 adds bounded attachment-point context so a
reviewer can identify the exact Episode, Timeline Event, Finding, or Asset carrying a
visible reference before choosing whether to inspect its Evidence record.

E11 does not read or compare Evidence content. It adds no endpoint, batch request,
producer contract, feature flag, artifact access, or write action.

## Derived model

`rolo-vis-episode-evidence-reference-context/v1` is built only alongside an already
validated `rolo-vis-episode-pair-comparison/v2`. Its authority is the literal
`REFERENCE_OCCURRENCE_ONLY`.

For each of the at most 100 IDs visible in the v0.25 trace, the model preserves separate
left and right occurrence lanes:

- Episode reference: pinned `episode_id@revision`, task label, and published Episode
  verification as a separate fact;
- Timeline reference: event ID, title, offset/duration, lane, and event authority;
- Finding supporting or contradicting reference: Finding ID, title, time window,
  authority, verification, and an explicit supporting/contradicting role;
- Asset reference: Asset ID, source label, offset, and availability.

The model checks both pinned identities and verifies that the source lanes reconstructed
from occurrences exactly match the already validated v0.25 trace. Drift or disagreement
fails closed.

## Bounds and ordering

- Each Evidence ID exposes at most 20 occurrences per side.
- Total, visible, and truncated occurrence counts remain separate.
- When a side exceeds 20 occurrences, deterministic selection first retains one item
  from every represented source lane, then fills the remaining budget in published
  occurrence order.
- Only the first 100 IDs already visible in the v0.25 trace receive occurrence context.
- Timeline coverage remains complete or bounded partial exactly as published by the
  parent comparison.

Hidden occurrences and references outside a bounded timeline cannot be treated as
absent.

## Authority rules

- An occurrence means only that a sanitized public record attaches the ID at that
  location.
- Supporting and contradicting are producer-authored Finding roles, not a client
  judgment about which claim is correct.
- Event authority, Finding verification, Episode verification, and Asset availability
  remain separate dimensions.
- Matching IDs or similar occurrence positions do not establish Evidence content,
  semantic equivalence, quality, sufficiency, verification, outcome, or cause.
- An occurrence does not establish that the Evidence record resolves; the existing
  drawer may still reject an unknown ID.

The model freezes `supportsEvidenceContent`, `supportsSemanticEquivalence`,
`supportsEvidenceQuality`, `supportsVerification`, and
`supportsCausalAttribution` as literal `false`.

## Delivery slices

- **E11A — contract:** freeze attachment fields, ordering, bounds, and authority.
- **E11B — derived model:** build and cross-check bounded occurrence lanes.
- **E11C — workbench surface:** expand one visible Evidence row into left/right context
  without replacing the existing Evidence drawer action.
- **E11D — validation and baseline:** approved on 2026-08-25 after exercising live
  producer reads plus controlled dense, partial, unresolved, and mixed-source derived
  projections. Promotion evidence is frozen in
  `EPISODE_EVIDENCE_REFERENCE_CONTEXT_BASELINE.md`.

## Deferred

Evidence content comparison, semantic alignment, sufficiency or quality scoring,
automatic claim resolution, batch reads, export, external handoff, recollection,
replay, media delivery, release influence, and every write action remain deferred.

