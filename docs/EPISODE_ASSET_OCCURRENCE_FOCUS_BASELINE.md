# Episode Asset occurrence focus baseline candidate

Status: release candidate; not yet promoted

Target version: `0.29.0`

Baseline ID: `rolo-vis-episode-asset-occurrence-focus/2026-08`

Extends: rolo-vis `v0.28.0` / `rolo-vis-episode-evidence-occurrence-focus/2026-08`

Frontend minimum: `7123f01`

Frontend main merge: pending final promotion

Producer minimum: rolo `463d501` (merged to main by `891cbf1`)

Validated upstream head: rolo `666f35c`

## Product boundary

This candidate extends the reviewed left-only source focus to one exact public Asset
metadata card. It carries only `ASSET_METADATA_FOCUS_ONLY` authority.

The durable anchor adds the bounded `asset` parameter to the existing pinned
`compare_evidence` Context. Asset focus cannot exist without both revision-pinned
comparison identities and the selected Evidence reference.

## Frozen candidate contract

- only a visible left `ASSET / REFERENCE` occurrence exposes focus;
- the exact public Asset ID and its `evidence_id` attachment are revalidated;
- stale IDs, detached Evidence references, mismatched roles, and changed summaries fail
  closed;
- Context, pair, revision, or Episode changes clear the Asset focus;
- refresh restores the same `compare_evidence + asset` tuple only after validation;
- right-side and Episode-level occurrences remain context only;
- availability and media type remain descriptive metadata, not content-read authority;
- the focus action does not open or infer an Evidence record;
- no Asset bytes, raw path, media delivery, endpoint, producer schema, write, verdict, or
  release authority is introduced.

## E14D candidate evidence

- E14A–E14C were reviewed and sealed as frontend minimum `7123f01`.
- The E14D live check reads the real rolo Episode collection, cohort, pinned details,
  and bounded timelines before deriving the left Asset occurrence locally.
- The isolated projection passes rolo's public read-model parser and exposes one
  metadata-only `MISSING` Asset bound to the selected Evidence ID.
- The live check round-trips both comparison pins plus `compare_evidence + asset` and
  rejects detached Evidence, mismatched role, missing Asset, summary mismatch, and
  forbidden path/content fields.
- Deterministic UI tests preserve the absence of right-side focus and keep the Evidence
  drawer separate.

## Promotion gate

Promotion to the established `v0.29.0` baseline requires E14D review approval, remote
CI success, merge to `main`, replacement of the pending merge metadata, and creation of
the immutable `v0.29.0` tag.

## Deferred successor work

Right-side navigation, Asset content or media, Evidence content comparison, batch
reads, export, external handoff, recollection, replay, release influence, and every
write action remain outside this candidate.
