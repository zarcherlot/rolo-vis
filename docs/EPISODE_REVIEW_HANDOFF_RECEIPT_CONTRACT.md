# E18 Episode review handoff receipt contract

Status: E18A-E18C review candidate; E18D baseline promotion requires explicit approval

Target baseline: rolo-vis `v0.33.0`

Extends: rolo-vis `v0.32.0` / `rolo-vis-episode-review-link-handoff/2026-08`

## Decision

E18 lets a recipient distinguish an intentional Episode review handoff from an
ordinary deep link. The receipt is established only after a canonical marker and every
pinned public identifier are independently re-read and validated. It is a local UI
statement about navigation restoration, not a signature, sender identity, Evidence
attestation, outcome, verification, or release decision.

## E18A: canonical receipt intent

- Keep the frozen E17 canonical review link builder available unchanged.
- Add exactly one `review_handoff=1` marker after E17 canonicalization.
- Accept the marker only on an exact HTTP(S), credential-free, fragment-free Episode
  URL containing no unknown or duplicate query fields.
- Require an immutable revision pin and require the complete URL to round-trip to the
  new canonical builder byte-for-byte.
- Treat a missing marker as ordinary navigation. Treat a malformed or non-canonical
  marker as a rejected receipt without elevating or blocking otherwise valid Episode
  navigation.
- Clear the marker on explicit navigation to another workbench view; do not persist it
  in browser storage.

## E18B: independently validated recipient receipt

- Display `validating`, `accepted`, or `rejected` separately from Episode loading and
  comparison outcome.
- Accept only when the connected robot, Episode identity, exact revision, immutable
  publication, and every focused Event, Finding, or Asset still match bounded public
  reads.
- For a comparison, independently require both immutable identities and revisions,
  then re-derive the selected Evidence context and any Asset attachment.
- State explicitly that acceptance proves neither sender identity nor Evidence quality,
  verification, causal attribution, outcome, or release authority.
- Never relax a missing, stale, partial, or malformed target into an accepted receipt.

## E18C: validation

- Cover canonical simple and comparison markers, duplicate and unknown query fields,
  fragments, wrong marker values, stale focus, publication drift, and rejected Asset
  attachment.
- Exercise an isolated live pair through the existing public Episode reads and derive
  the same comparison and Evidence context used by the UI.
- Keep static negative-authority checks for endpoints, storage, content export,
  sender authentication, execution replay, and writes.

## E18D: deferred baseline promotion

Promotion to `v0.33.0`, baseline metadata, main merge, tag, and production deployment
remain deferred until E18A-E18C receive explicit review approval.

## Authority boundary

E18 adds no producer schema, endpoint, feature flag, browser persistence, cryptographic
signature, user or sender identity, Evidence or Asset content, raw artifact path,
export file, ranking, verdict, release influence, execution replay, robot action, or
write authority.
