# E12 Evidence context navigation continuity contract

Status: E12A–E12C approved on 2026-08-25. It is not yet a promoted successor baseline.

Extends: rolo-vis `v0.26.0` / `rolo-vis-episode-evidence-reference-context/2026-08`

## Goal

A reviewer can copy or refresh a revision-pinned pair comparison without losing the
currently expanded Evidence reference context. Selection continuity must not broaden
the authority or data access of the v0.26 model.

## Deep-link contract

`compare_evidence={evidence_id}` is valid only when `compare` and `compare_revision`
also pin the right side. The left Episode and revision remain pinned by the existing
Episode target.

The identifier must pass the same bounded identifier grammar as other Episode deep
links. After both public sides are read and the v0.26 context is derived, the requested
ID must exist in the visible, validated v0.26 context. A malformed link rejects the
Episode target; a stale, hidden, or unavailable derived selection is removed without
substituting another Evidence ID.

Changing either side or closing comparison clears the selection. Unrelated query state
continues to be preserved, and changing to another workbench view removes every
Episode-scoped parameter including `compare_evidence`.

## Authority rules

- Restoring Context expands bounded attachment points only; it does not open the
  Evidence drawer.
- Selection does not establish record availability, content, semantic equivalence,
  quality, sufficiency, verification, outcome, or cause.
- The v0.26 `REFERENCE_OCCURRENCE_ONLY` authority and all literal-false escalation
  flags remain unchanged.
- No new backend request is issued for selection continuity.

## Delivery slices

- **E12A — contract:** freeze scope, validation order, and failure behavior.
- **E12B — deep-link model:** parse, build, preserve, and remove `compare_evidence`.
- **E12C — controlled surface:** lift Context selection into Episode Studio, restore it
  after validation, and remove stale or pair-crossing state.

## Deferred

Occurrence-level links, scrolling or focusing source records, right-side source
navigation, Evidence content comparison, batch reads, export, external handoff,
recollection, replay, media delivery, release influence, and every write action remain
deferred.
