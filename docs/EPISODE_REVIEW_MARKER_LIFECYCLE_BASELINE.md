# Episode review marker lifecycle baseline

Status: established baseline

Version: `0.35.0`

Baseline ID: `rolo-vis-episode-review-marker-lifecycle/2026-08`

Extends: rolo-vis `v0.34.0` / `rolo-vis-episode-review-anchor-continuity/2026-08`

Frontend minimum: `dbe5028`

Frontend main merge: `dbe5028`

Producer minimum: rolo `463d501` (merged to main by `891cbf1`)

Validated upstream head: rolo `666f35c`

## Product boundary

This baseline binds `review_handoff=1` to the exact canonical inbound review target.
When the recipient explores any different valid Episode context, the visible URL drops
the marker and becomes ordinary navigation while the immutable E19 anchor remains in
current-tab memory.

Marker ownership describes URL provenance only. It is not identity, review progress,
Evidence quality, outcome interpretation, or release authority.

## Frozen contract

- preserve the marker only while all ten E19-reviewed navigation fields exactly match
  the original valid handoff target;
- remove only `review_handoff=1` when any reviewed field diverges;
- preserve ordinary query state, fragments, and browser history behavior;
- leave an initially malformed marker visible for the E18 rejected receipt instead of
  silently normalizing the claim;
- make a reload of the explored URL ordinary Episode navigation with no handoff intent;
- retain the original anchor in current-tab memory and restore its marker only through
  the explicit canonical return link;
- add no endpoint, producer contract, persistence, automatic navigation, identity,
  content, execution replay, release influence, deployment, or write authority.

## Promotion evidence

- E20A-E20C were reviewed and sealed as frontend minimum `dbe5028`.
- The feature commit was fast-forwarded to `main` as `dbe5028`; GitHub Actions CI run
  #50 completed successfully.
- The complete local gate passed 199 application tests, TypeScript checking,
  production/Sites packaging, and four Sites worker tests.
- The live gate used `ep-e9-reference@1` and `ep-e9-member-newest@1`, retained the
  marker at the exact target, removed it after Event/cohort divergence, and verified
  that the explored URL reloads as ordinary navigation.
- Negative checks confirmed no automatic navigation, persisted state, new endpoint,
  content access, execution replay, or write authority.

## Deferred successor work

Offline or cross-tab continuity, backend persistence, signatures, sender or user
identity, review progress, content export, media, execution replay, verdicts, release
influence, production deployment, and every robot write action remain outside this
baseline.
