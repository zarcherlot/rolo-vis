# E21 Episode review session release contract

Status: E21A-E21C review candidate; E21D baseline promotion requires explicit approval

Target baseline: rolo-vis `v0.36.0`

Extends: rolo-vis `v0.35.0` / `rolo-vis-episode-review-marker-lifecycle/2026-08`

## Decision

E21 gives the recipient an explicit way to end the current-tab shared review session.
An E18-accepted target activates the E19 anchor, but that anchor no longer has to remain
active until component unmount. A user-initiated release removes the E20 handoff marker
and clears local anchor continuity without changing the currently open Episode context.

Release is a local navigation-session decision only. It does not reject the original
handoff, notify a sender, record review progress, or write any state to rolo.

## E21A: session lifecycle

- Model `PENDING`, `ACTIVE`, and `RELEASED` as separate states.
- Transition from `PENDING` to `ACTIVE` only after the E18 receipt reaches `ACCEPTED`.
- Keep `ACTIVE` stable while the user explores, even when the current context no longer
  matches the inbound target.
- Transition from `ACTIVE` to `RELEASED` only through an explicit user action.
- Make `RELEASED` terminal for the current component lifetime. Later receipt changes
  cannot reactivate it; reopening the original shared link starts a new validation.

## E21B: explicit end action

- Offer `End anchored review` while the anchor is active, both at the exact target and
  while exploring beyond it.
- On click, remove only `review_handoff=1` from the current URL and retain all Episode,
  revision, focus, comparison, Evidence-context, cohort, ordinary query, and fragment
  state.
- Keep the current context visible without reload, automatic navigation, clipboard
  access, browser storage, or backend mutation.
- Replace the receipt/anchor notice with a neutral local notice stating that the shared
  anchor ended for this tab and no review state was written back.

## E21C: validation

- Cover the complete transition matrix, explicit release from anchored and exploring
  contexts, and terminal release behavior.
- Verify marker-only removal, strict deep-link preservation, ordinary reload behavior,
  and fresh validation when the original canonical link is reopened.
- Exercise the lifecycle against live revision-pinned Episode and comparison data.
- Keep negative checks for endpoints, persistence, sender identity, content, execution
  replay, release influence, automatic navigation, and writes.

## E21D: deferred baseline promotion

Promotion to `v0.36.0`, baseline metadata, main merge, tag, and production deployment
remain deferred until E21A-E21C receive explicit review approval.

## Authority boundary

E21 adds no producer schema, endpoint, feature flag, persistence, signature, sender or
user identity, content access, review progress, verdict, release signal, execution
replay, robot action, or write authority.
