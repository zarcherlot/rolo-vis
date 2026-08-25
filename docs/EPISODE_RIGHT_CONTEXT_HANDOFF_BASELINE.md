# Episode right Context handoff baseline candidate

Status: release candidate; not yet promoted

Target version: `0.30.0`

Baseline ID: `rolo-vis-episode-right-context-handoff/2026-08`

Extends: rolo-vis `v0.29.0` / `rolo-vis-episode-asset-occurrence-focus/2026-08`

Frontend minimum: `801231f`

Frontend main merge: pending final promotion

Producer minimum: rolo `463d501` (merged to main by `891cbf1`)

Validated upstream head: rolo `666f35c`

## Product boundary

This candidate lets one exact visible right Event, Finding, or Asset occurrence become
actionable by deterministically swapping the two pinned comparison orientations. The
action carries only `PAIR_ORIENTATION_HANDOFF_ONLY` authority.

The selected Evidence Context remains pinned, exactly one existing source anchor is
carried into the new left orientation, and that attachment is revalidated after load.
Reference and candidate remain viewport labels rather than ranking or release signals.

## Frozen candidate contract

- require a visible exact right Timeline, Finding, or Asset occurrence;
- swap the primary and comparison Episode IDs and revisions without changing either;
- preserve the same `compare_evidence` and set exactly one `event`, `finding`, or
  `asset` anchor;
- revalidate the source against the newly loaded left detail, timeline, and Context;
- reject stale, detached, role-mismatched, unsafe, or Episode-level inputs;
- retain a successfully loaded pair orientation but clear source focus if a later
  attachment drift is detected;
- add no `side` state, right-detail surface, preferred-run meaning, Evidence content
  read, producer field, endpoint, feature flag, verdict, release, or write authority.

## E15D candidate evidence

- E15A–E15C were reviewed and sealed as frontend minimum `801231f`.
- The E15D live check reads the real rolo Episode collection, exact-match cohort, both
  pinned details, and both bounded timelines before deriving Context locally.
- The exact live right occurrence swaps orientation, round-trips the composite deep
  link without a `side` parameter, and preserves unrelated query state.
- A second exact occurrence on the former reference restores the original pair
  orientation, demonstrating the deterministic inverse.
- Detached source, mismatched role, and Episode-level occurrence checks fail closed.
- Deterministic tests cover Event, both Finding roles, Asset, same-Episode/different-
  revision pairs, identity drift, and post-load attachment revalidation.

## Promotion gate

Promotion to the established `v0.30.0` baseline requires E15D review approval, remote
CI success, merge to `main`, replacement of the pending merge metadata, and creation of
the immutable `v0.30.0` tag.

## Deferred successor work

Right-detail duplication, preferred-run semantics, outcome interpretation, Asset or
Evidence content, media, batch reads, export, external handoff, recollection, replay,
release influence, and every write action remain outside this candidate.
