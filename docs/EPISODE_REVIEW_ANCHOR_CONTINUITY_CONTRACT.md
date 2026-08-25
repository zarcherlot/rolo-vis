# E19 Episode review anchor continuity contract

Status: E19A-E19C review candidate; E19D baseline promotion requires explicit approval

Target baseline: rolo-vis `v0.34.0`

Extends: rolo-vis `v0.33.0` / `rolo-vis-episode-review-handoff-receipt/2026-08`

## Decision

E19 preserves the exact E18 handoff target as a tab-lifetime review anchor after, and
only after, E18 has independently accepted it. A recipient may then explore another
valid Episode context without the UI misrepresenting that deliberate divergence as a
failed handoff. The original anchor remains immutable and can be restored only through
an explicit user-initiated canonical navigation.

## E19A: anchor continuity model

- Establish an anchor only from an E18 `VALID` intent whose receipt reached
  `ACCEPTED`; malformed, stale, loading, or rejected receipts never establish one.
- Keep the anchor in component memory for the current tab lifetime only. Do not use
  local storage, session storage, cookies, BroadcastChannel, or a backend record.
- Compare robot, Episode, revision, Event, Finding, Asset, comparison Episode,
  comparison revision, Evidence context, and cohort window as separate exact fields.
- Report `ANCHORED` when every field matches and `EXPLORING` with a deterministic list
  of changed fields when the current valid context differs.
- Never relabel backend drift at the original target as exploration; the E18 rejected
  receipt remains authoritative in that case.

## E19B: explicit return to the shared anchor

- Replace the misleading rejected receipt with a neutral local-exploration notice only
  after the anchor was previously accepted and the current target differs.
- Display the immutable anchor identity and each changed navigation dimension without
  interpreting the difference as outcome, quality, cause, or review progress.
- Provide one ordinary link labelled `Return to shared anchor`, rebuilt through the E18
  canonical handoff builder.
- Do not navigate automatically, overwrite browser history in the background, copy to
  the clipboard, or discard the recipient's current context without a click.
- A return reloads and independently validates the original handoff again; prior
  acceptance is not reused as data authority.

## E19C: validation

- Cover absent or unaccepted anchors, exact restoration, one-field and composite
  divergence, stable field ordering, canonical return links, and return round trips.
- Exercise a live accepted comparison anchor, diverge its local focus, and verify the
  return link restores the original exact target.
- Keep negative-authority checks for endpoints, storage, content, authentication,
  execution replay, automatic navigation, release influence, and writes.

## E19D: deferred baseline promotion

Promotion to `v0.34.0`, baseline metadata, main merge, tag, and production deployment
remain deferred until E19A-E19C receive explicit review approval.

## Authority boundary

E19 adds no producer schema, endpoint, feature flag, persistence, signature, sender or
user identity, Evidence or Asset content, raw path, export, ranking, verdict, review
progress, release signal, execution replay, robot action, or write authority.
