# Episode review session release baseline

Status: established baseline

Version: `0.36.0`

Baseline ID: `rolo-vis-episode-review-session-release/2026-08`

Extends: rolo-vis `v0.35.0` / `rolo-vis-episode-review-marker-lifecycle/2026-08`

Frontend minimum: `98d3a38`

Frontend main merge: `98d3a38`

Producer minimum: rolo `463d501` (merged to main by `891cbf1`)

Validated upstream head: rolo `666f35c`

## Product boundary

This baseline lets the recipient explicitly end the accepted, current-tab Episode
review anchor without leaving the Episode context they are viewing. Release removes
only `review_handoff=1`, keeps the current deep-link state visible, and makes a later
reload ordinary navigation.

Release is local session control only. It is not rejection, sender notification,
review progress, Evidence interpretation, release influence, or backend state.

## Frozen contract

- model `PENDING`, `ACTIVE`, and terminal current-component `RELEASED` states;
- activate only after an independently accepted E18 receipt;
- release only through the recipient's explicit `End anchored review` action;
- keep the active anchor stable while the recipient explores another valid Episode
  context;
- remove only `review_handoff=1` on release while preserving all Episode, comparison,
  Evidence-context, cohort, ordinary query, and fragment state;
- do not reactivate a released session during the same component lifetime;
- require fresh independent validation when the original canonical link is reopened;
- add no endpoint, producer contract, persistence, automatic navigation, sender or
  user identity, content access, execution replay, release influence, deployment, or
  write authority.

## Promotion evidence

- E21A-E21C were reviewed and sealed as frontend minimum `98d3a38`.
- The feature commit was fast-forwarded to `main` as `98d3a38`; GitHub Actions CI run
  #52 completed successfully.
- The E21D complete local gate passed 205 application tests, TypeScript checking,
  production/Sites packaging, and four Sites worker tests.
- The live gate used `ep-e9-reference@1` and `ep-e9-member-newest@1`, activated the
  accepted session, released it explicitly, removed only the marker, retained current
  context, and verified ordinary reload plus fresh canonical reopening.
- Negative checks confirmed no automatic navigation, persisted state, new endpoint,
  content access, execution replay, sender notification, or write authority.

## Deferred successor work

Offline or cross-tab continuity, backend persistence, signatures, sender or user
identity, review progress, content export, media, execution replay, verdicts, release
influence, production deployment, and every robot write action remain outside this
baseline.
