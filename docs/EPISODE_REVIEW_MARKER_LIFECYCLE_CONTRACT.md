# E20 Episode review marker lifecycle contract

Status: E20A-E20D approved and promoted as the rolo-vis `v0.35.0` read-only baseline

Target baseline: rolo-vis `v0.35.0`

Extends: rolo-vis `v0.34.0` / `rolo-vis-episode-review-anchor-continuity/2026-08`

## Decision

E20 makes ownership of the E18 `review_handoff=1` marker exact. The marker belongs
only to the canonical inbound target that created the receipt. When the recipient
changes any E19-reviewed navigation field, the visible URL becomes ordinary Episode
navigation while the accepted anchor remains available in current-tab memory.

This prevents a reload of a locally explored context from presenting that context as
a new shared handoff. Returning to the immutable anchor uses the existing E19
canonical link and independently runs the complete E18 receipt validation again.

## E20A: marker ownership policy

- Preserve `review_handoff=1` only while every reviewed field exactly matches the
  original valid handoff target.
- Remove only the handoff marker when robot, Episode, revision, Event, Finding, Asset,
  comparison Episode, comparison revision, Evidence context, or cohort window differs.
- Keep ordinary workbench query state and browser history behavior unchanged.
- Do not rewrite malformed handoff claims during their initial rejected receipt; the
  marker lifecycle policy applies only to a previously canonical `VALID` intent.
- Keep the original E19 target immutable in component memory after the visible marker
  is removed.

## E20B: recipient disclosure

- State in the E19 exploration notice that the current address is ordinary navigation,
  not a replacement shared handoff.
- Keep one explicit `Return to shared anchor` link. Its canonical URL restores the
  original marker and exact target only after a user click.
- Do not navigate, reload, copy, persist, or discard the current context automatically.

## E20C: validation

- Cover exact-target marker retention and one-field/composite divergence across the
  complete reviewed field list.
- Verify that re-reading a diverged URL yields no handoff intent, while the canonical
  return URL still round-trips to the original target.
- Exercise the policy against live revision-pinned Episode and comparison data.
- Keep negative checks for endpoints, storage, authentication, content, execution
  replay, release influence, and writes.

## E20D: baseline promotion

The reviewed feature commit `dbe5028` was fast-forwarded to `main` and passed GitHub
Actions CI run #50. Baseline metadata and release evidence are frozen in
`EPISODE_REVIEW_MARKER_LIFECYCLE_BASELINE.md`. Production deployment remains a
separate, explicitly authorized operation.

## Authority boundary

E20 adds no producer schema, endpoint, feature flag, persistence, signature, sender or
user identity, content access, review progress, verdict, release signal, execution
replay, robot action, or write authority.
