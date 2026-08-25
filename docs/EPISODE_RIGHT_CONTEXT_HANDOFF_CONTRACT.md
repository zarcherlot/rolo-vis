# E15 Episode right Context handoff contract

Status: E15A-E15D approved and promoted as the `v0.30.0` read-only baseline;
frontend minimum `801231f`, merged to `main` by `b487b01`.

The established release evidence is recorded in
`EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.md`.

## Decision

E15 may make an exact right-side occurrence actionable only through deterministic pair
reorientation. It does not focus an unrendered right-side source in place.

The chosen action carries `PAIR_ORIENTATION_HANDOFF_ONLY` authority:

- the current right Episode and revision become the new left reference orientation;
- the current left Episode and revision become the new right comparison orientation;
- the selected `compare_evidence` ID is preserved;
- the exact selected right Event, Finding, or Asset becomes the corresponding existing
  left-side source anchor after revalidation;
- no `side`, occurrence, producer, or backend query parameter is added.

“Reference” and “candidate” remain viewport orientation labels. Reorientation does not
promote a candidate, choose a preferred run, or change any published outcome.

## Why reorientation

The Studio renders the complete source surfaces only for the left Episode. Directly
scrolling to a right Event, Finding, or Asset would target UI that does not exist. A new
right-detail tray would duplicate bounded loading, selection, cleanup, and accessibility
logic. Reorientation instead reuses the already reviewed E13/E14 left focus pipeline and
keeps one source of navigation authority.

## State transform

| State | Before | After |
| --- | --- | --- |
| primary Episode | left ID + revision | right ID + revision |
| comparison Episode | right ID + revision | left ID + revision |
| Evidence Context | selected `compare_evidence` | same exact ID |
| source anchor | current left anchor or none | exact selected right Event/Finding/Asset |
| unrelated query state | preserved | preserved |

The transform clears the other source-anchor kinds. Episode-level occurrences remain
context only and cannot initiate a handoff.

## Validation order

1. Require the existing validated comparison, occurrence context, both pinned details,
   and both bounded timelines.
2. Require a visible right occurrence with source `TIMELINE`, `FINDING_SUPPORTING`,
   `FINDING_CONTRADICTING`, or `ASSET`.
3. Resolve that occurrence against the current right detail/timeline and the selected
   Evidence ID using the existing exact attachment rules.
4. Construct the swapped pair with both identities and revisions still pinned.
5. Preserve `compare_evidence` and set exactly one matching `event`, `finding`, or
   `asset` anchor.
6. After the new left detail/context load, revalidate the attachment again before
   showing source focus.

Stale IDs, detached Evidence, role mismatch, missing source metadata, or an
Episode-level occurrence reject the preflight handoff without navigation. If the
attachment drifts only after the swapped pair loads, the validated pair orientation is
retained, source focus is cleared, and the rejection is shown explicitly.

## Interaction boundary

- The action label is **Reorient to right source**, not Promote, Prefer, Accept, or Use.
- Right occurrence cards remain visually marked as Context until the orientation
  actually changes.
- Reorienting the now-right former reference provides a deterministic inverse action.
- The Evidence drawer remains a separate explicit Inspect action.
- Cohort data may reload for the new primary Episode but cannot influence the handoff.

## Negative authority

E15 adds no outcome verdict, regression/improvement claim, semantic equivalence,
verification, causal interpretation, release signal, Asset/Evidence content read, media
delivery, artifact path, export, external handoff, recollection, replay, producer
schema, endpoint, feature flag, or write action.

## Delivery slices

- **E15A — contract:** approve orientation semantics, state transform, and negative
  authority.
- **E15B — pure transform:** derive a fail-closed swapped deep-link target and cover
  Event, Finding, Asset, same-Episode/different-revision, and malformed inputs.
- **E15C — controlled UI:** expose the action only for exact visible right occurrences
  and revalidate after the orientation load.
- **E15D — validation and baseline:** exercise live round-trip/inverse handoff, remote
  CI, and final `v0.30.0` metadata after E15A–E15C review approval.

## Upstream compatibility

rolo `main@666f35c` already supplies every required public field through the existing
Episode detail, timeline, revision-history, and cohort contracts. E15 requires no rolo
producer or API change.
