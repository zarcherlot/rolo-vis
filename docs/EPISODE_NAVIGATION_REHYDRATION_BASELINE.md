# Episode navigation rehydration baseline

Status: established baseline

Version: `0.31.0`

Baseline ID: `rolo-vis-episode-navigation-rehydration/2026-08`

Extends: rolo-vis `v0.30.0` / `rolo-vis-episode-right-context-handoff/2026-08`

Frontend minimum: `5776492`

Frontend main merge: `5776492`

Producer minimum: rolo `463d501` (merged to main by `891cbf1`)

Validated upstream head: rolo `666f35c`

## Product boundary

This baseline makes browser Back and Forward deterministic read-only workbench inputs.
It restores an Episode only after the complete existing deep-link contract validates,
and carries only `NAVIGATION_REHYDRATION_ONLY` authority.

Same-robot history restores do not repeat the workbench bootstrap. A target for another
robot invokes the existing read-only bootstrap for that exact identity, then remains
subject to feature negotiation and every existing Episode contract check.

## Frozen contract

- consume browser `popstate` without adding a new navigation parameter;
- restore the complete pinned Episode, comparison, Context, source focus, and cohort
  window only after strict validation;
- remount Episode Studio on history replay so prior bounded requests are aborted and
  restored inputs are independently loaded;
- clear transient Evidence drawer, Stack focus, and Wiki focus state;
- reconnect only when the pinned robot identity differs from the connected robot;
- fail malformed Episode and unsupported view state closed to Stack and normalize the
  URL;
- wait for settled feature negotiation before rejecting an unavailable Episode model;
- add no endpoint, producer contract, content access, execution replay, release signal,
  deployment, or write authority.

## Promotion evidence

- E16A-E16C were reviewed and sealed as frontend minimum `5776492`.
- The feature commit was fast-forwarded to `main` as `5776492`; GitHub Actions CI run
  #42 completed successfully.
- The complete local gate passed 170 application tests, TypeScript checking,
  production packaging, and four Sites worker tests.
- A live rolo gate used `ep-e9-reference@1` and `ep-e9-member-newest@1` to validate
  both orientations, same/cross-robot replay planning, malformed state, and settled
  feature negotiation.
- Browser Back restored the reference Episode, comparison Context, and `evt-command`;
  Forward restored the reoriented Episode, inverse comparison, and `evt-outcome`.
- Malformed Episode and unsupported view URLs were normalized to Stack in the rebuilt
  production preview.

## Deferred successor work

Execution replay, recollection, media, Asset or Evidence content, export, external
handoff, ranking, verdicts, release influence, offline persistence, multi-tab
synchronization, and every write action remain outside this baseline.
