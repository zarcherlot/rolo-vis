# Episode Evidence context navigation baseline

Status: established baseline

Version: `0.27.0`

Baseline ID: `rolo-vis-episode-evidence-context-navigation/2026-08`

Extends: rolo-vis `v0.26.0` / `rolo-vis-episode-evidence-reference-context/2026-08`

Frontend minimum: `e2e8302` (merged to main by `2263cd8`)

Producer minimum: rolo `463d501` (merged to main by `891cbf1`)

Validated upstream head: rolo `e96c9b0`

## Product boundary

This release preserves one selected, visible v0.26 Evidence context row across copy,
refresh, and browser navigation. `compare_evidence` is scoped to the already pinned
left and right Episode revisions and carries only `CONTEXT_SELECTION_ONLY` authority.

Restoration waits until both public sides and the derived v0.26 context validate the
requested ID. It does not request, open, or infer an Evidence record.

## Frozen contract

- deep-link parameter `compare_evidence` requires both comparison identity and
  revision parameters;
- only the bounded identifier grammar is accepted;
- a requested ID must exist in the visible derived context before it is restored;
- stale, hidden, failed, and pair-crossing selections are cleared without substitution;
- unrelated workbench query state is preserved;
- changing workbench view removes every Episode-scoped navigation parameter;
- selection does not open the Evidence drawer or add a backend request;
- v0.26 `REFERENCE_OCCURRENCE_ONLY` authority and all negative-authority flags remain
  unchanged;
- no producer schema, endpoint, feature flag, content read, artifact access, release
  signal, or write authority is added.

## Promotion evidence

- E12A–E12C commit `e2e8302` was approved.
- rolo-vis PR #13 passed the complete remote CI gate and merged to main as `2263cd8`.
- E12D read a live exact-match pair and derived its v2 comparison plus v1 reference
  context through the existing public client.
- A visible live Evidence ID survived build/read round-trip and validation; a stale ID
  was removed, malformed input was rejected, and switching the right side removed the
  old selection without choosing a replacement.
- Browser validation independently confirmed restoration, close/reopen URL updates,
  and stale selection cleanup.
- No Evidence record request was issued by navigation validation.

## Deferred successor work

Occurrence-level anchors, scrolling or focusing source records, right-side source
navigation, Evidence content comparison, safe Evidence availability summaries, batch
reads, export, external handoff, recollection, replay, media delivery, release
influence, and every write action remain outside this baseline.
