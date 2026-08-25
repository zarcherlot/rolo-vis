# E14 Episode Asset occurrence focus contract

Status: E14A–E14D approved and promoted as the `v0.29.0` read-only baseline.

The promotion evidence is recorded in
`EPISODE_ASSET_OCCURRENCE_FOCUS_BASELINE.md`.

## Purpose

E14 extends the v0.28 left-only source focus to the existing public Asset metadata
card. It carries `ASSET_METADATA_FOCUS_ONLY` authority and never requests Asset bytes,
media, storage locations, raw paths, or Evidence content.

The durable composite anchor adds the bounded `asset` field to the existing pinned
`compare_evidence` context. An `asset` value without the selected Evidence context,
both comparison identities, and both revisions is rejected.

## Validation order

1. Parse every Episode, comparison, Evidence, and Asset identifier with the existing
   bounded identifier grammar.
2. Read and validate both pinned Episode details and bounded timelines.
3. Reconstruct the selected Evidence occurrence context from those same inputs.
4. Require a visible left `ASSET / REFERENCE` occurrence with the exact Asset ID.
5. Require the current left public Asset summary to bind the same `evidence_id`.
6. Only then select and scroll to the already-rendered metadata card.

Stale Asset IDs, detached Evidence references, changed Context rows, failed comparison
loads, and pair changes clear the focus without substitution.

## Interaction boundary

- Asset and Finding focus are mutually exclusive visual source anchors. The existing
  Timeline selection remains visible as bounded Episode context; selecting another
  Timeline event clears Asset focus.
- Closing or changing Context, changing either comparison side, or opening another
  Episode clears Asset focus.
- Refresh restores the same `compare_evidence + asset` tuple only after validation.
- Right-side Asset occurrences remain context only.
- Episode-level occurrences remain context only.
- The Evidence button retains its existing, separate record-inspection behavior; Asset
  focus itself does not open the Evidence drawer.

## Negative authority

E14 adds no backend endpoint, producer schema, feature flag, availability inference,
media delivery, artifact access, Evidence content read, causal interpretation, release
signal, export, external handoff, or write action.

## Delivery slices

- **E14A — contract and deep link:** freeze `asset` grammar, composite scope, and cleanup.
- **E14B — exact attachment resolver:** validate public Asset identity and Evidence bind.
- **E14C — controlled UI:** focus the left metadata card and preserve refresh continuity.
- **E14D — validation and baseline:** deferred until E14A–E14C review approval.
