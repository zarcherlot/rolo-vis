# Episode review anchor continuity baseline

Status: established baseline

Version: `0.34.0`

Baseline ID: `rolo-vis-episode-review-anchor-continuity/2026-08`

Extends: rolo-vis `v0.33.0` / `rolo-vis-episode-review-handoff-receipt/2026-08`

Frontend minimum: `55d4968`

Frontend main merge: `55d4968`

Producer minimum: rolo `463d501` (merged to main by `891cbf1`)

Validated upstream head: rolo `666f35c`

## Product boundary

This baseline preserves an independently accepted E18 review target as an immutable,
current-tab anchor while the recipient explores another valid Episode context. The UI
reports the exact navigation fields that differ and offers one explicit canonical link
back to the shared anchor.

Continuity is navigation context only. It is not backend state, review progress,
identity, Evidence or Asset content, outcome interpretation, or release authority.

## Frozen contract

- establish an anchor only after an E18 handoff receipt reaches `ACCEPTED`;
- retain it in current-tab component memory only, without browser or backend storage;
- compare robot, Episode, revision, Event, Finding, Asset, comparison Episode,
  comparison revision, Evidence context, and cohort window as exact fields;
- expose only `ANCHORED` and `EXPLORING`, with deterministic changed-field labels;
- preserve the accepted anchor immutably while local exploration changes;
- return through one user-initiated E18 canonical link and independently revalidate
  the complete original target;
- add no endpoint, producer contract, identity, content, automatic navigation,
  execution replay, release influence, deployment, or write authority.

## Promotion evidence

- E19A-E19C were reviewed and sealed as frontend minimum `55d4968`.
- The feature commit was fast-forwarded to `main` as `55d4968`; GitHub Actions CI run
  #48 completed successfully.
- The complete local gate passed 193 application tests, TypeScript checking,
  production/Sites packaging, and four Sites worker tests.
- The live gate established `ep-e9-reference@1` with comparison
  `ep-e9-member-newest@1`, distinguished changed Event and Evidence fields, and
  round-tripped the exact canonical return target.
- Negative checks confirmed no automatic navigation, persisted anchor, new endpoint,
  content access, execution replay, or write authority.

## Deferred successor work

Offline or cross-tab continuity, backend persistence, signatures, sender or user
identity, content export, media, execution replay, review progress, verdicts, release
influence, production deployment, and every robot write action remain outside this
baseline.
