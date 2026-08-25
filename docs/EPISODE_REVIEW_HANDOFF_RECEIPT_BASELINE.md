# Episode review handoff receipt baseline

Status: established baseline

Version: `0.33.0`

Baseline ID: `rolo-vis-episode-review-handoff-receipt/2026-08`

Extends: rolo-vis `v0.32.0` / `rolo-vis-episode-review-link-handoff/2026-08`

Frontend minimum: `347abd8`

Frontend main merge: `347abd8`

Producer minimum: rolo `463d501` (merged to main by `891cbf1`)

Validated upstream head: rolo `666f35c`

## Product boundary

This baseline lets a recipient distinguish an intentional Episode review handoff from
an ordinary deep link. A receipt is accepted only after the exact canonical marker and
every pinned public identifier have been independently re-read from rolo.

The receipt reports navigation restoration only. It is not a signature, sender or user
identity, Evidence attestation, causal claim, verified outcome, or release decision.

## Frozen contract

- preserve the E17 canonical review-link builder as an independently tested boundary;
- add exactly one `review_handoff=1` marker after E17 canonicalization;
- reject unknown or duplicate query fields, fragments, credentials, unsafe origins,
  missing revision pins, and every non-canonical marker shape;
- accept only after the robot, immutable Episode revision, bounded Event/Finding/Asset
  focus, optional comparison pair, Evidence context, and Asset attachment all revalidate;
- keep `validating`, `accepted`, and `rejected` separate from Episode outcome and
  comparison state;
- clear the marker on explicit navigation to another workbench view and never persist
  it in browser storage;
- add no endpoint, producer contract, signature, sender identity, content export,
  execution replay, release influence, deployment, or write authority.

## Promotion evidence

- E18A-E18C were reviewed and sealed as frontend minimum `347abd8`.
- The feature commit was fast-forwarded to `main` as `347abd8`; GitHub Actions CI run
  #46 completed successfully.
- The complete local gate passed 186 application tests, TypeScript checking,
  production/Sites packaging, and four Sites worker tests.
- The live gate independently read `ep-e9-reference@1` and
  `ep-e9-member-newest@1`, rebuilt their comparison and Evidence context, accepted the
  canonical receipt, and rejected stale or non-canonical variants.
- The local preview exposed the accepted navigation-only receipt against the same live
  pair without adding content or write authority.

## Deferred successor work

Cryptographic signatures, sender or user identity, execution replay, recollection,
media, Asset or Evidence content, export files, ranking, verdicts, release influence,
offline persistence, multi-tab synchronization, production deployment, and every robot
write action remain outside this baseline.
