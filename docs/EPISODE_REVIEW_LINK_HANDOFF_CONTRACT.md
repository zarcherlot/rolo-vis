# E17 Episode review link handoff contract

Status: E17A-E17D approved and promoted as the `v0.32.0` read-only baseline

Target baseline: rolo-vis `v0.32.0`

Extends: rolo-vis `v0.31.0` / `rolo-vis-episode-navigation-rehydration/2026-08`

## Decision

E17 turns the deterministic E16 browser state into a deliberately user-initiated,
read-only review handoff. The copied URL is a navigation capability only. It carries
opaque identifiers required to independently reload the same published context; it
does not carry Episode, Evidence, Finding, or Asset content.

## E17A: canonical link construction

- Accept only an HTTP(S) workbench origin without embedded credentials.
- Require an exact non-null Episode revision.
- Start from the current origin and pathname, then discard every query field and hash.
- Rebuild only the existing strict Episode navigation allowlist.
- Parse the result again and require exact field-for-field round-trip equality.
- Reject malformed identifiers, incomplete comparison pins, unsafe focus, or any state
  that cannot survive the strict E16 parser.

## E17B: review handoff surface

- Expose one explicit `Copy review link` action; no automatic clipboard write occurs.
- Require the current left publication to be immutable and revision-pinned.
- Revalidate Event, Finding, and Asset focus against the currently loaded bounded
  public inputs.
- When a comparison is present, require both independently loaded immutable revisions,
  exact pair identity, and a visible selected Evidence context.
- Report clipboard denial or stale state without navigating, retrying, or weakening
  validation.

## Authority boundary

E17 adds no endpoint, producer schema, feature flag, browser storage, background sync,
Evidence or Asset content, raw path, export file, verdict, release influence, execution
replay, robot action, or write authority. Opening a copied link remains subject to the
recipient's connectivity, feature negotiation, E16 strict parser, and all existing
Episode read-model validation.

## E17C: validation

- Exercise simple focused and comparison links against two independently read immutable
  Episode publications.
- Verify unrelated query state and fragments never cross the handoff boundary.
- Verify same-robot restore stays inside the existing connection and cross-robot restore
  requests the exact pinned robot identity.
- Exercise stale or malformed state and clipboard denial without navigation fallback.
- Keep the reusable gate explicit about navigation-only authority and the absence of
  endpoints, content export, and writes.

## E17D: baseline promotion

The reviewed E17 contract is frozen as rolo-vis `v0.32.0`, with frontend minimum and
main merge `92689a9`. Release evidence is recorded in
`EPISODE_REVIEW_LINK_HANDOFF_BASELINE.md`.

## E17C validation evidence

- The complete local gate passed 177 application tests, TypeScript checking, production
  packaging, and four Sites worker tests.
- The reusable live gate independently read `ep-e9-reference@1` and
  `ep-e9-member-newest@1`, then passed simple and comparison round trips, unrelated
  state stripping, cross-robot planning, malformed state, and clipboard denial.
- Browser validation copied a simple link, restored the comparison link in a new tab,
  and retained both exact revision pins and the Evidence trace.
- A stale `compare_evidence=missing-evidence` selection was removed while its valid
  pair remained loaded. The rebuilt preview reported no console errors.
