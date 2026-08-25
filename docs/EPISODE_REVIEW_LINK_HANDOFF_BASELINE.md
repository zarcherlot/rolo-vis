# Episode review link handoff baseline

Status: established baseline

Version: `0.32.0`

Baseline ID: `rolo-vis-episode-review-link-handoff/2026-08`

Extends: rolo-vis `v0.31.0` / `rolo-vis-episode-navigation-rehydration/2026-08`

Frontend minimum: `92689a9`

Frontend main merge: `92689a9`

Producer minimum: rolo `463d501` (merged to main by `891cbf1`)

Validated upstream head: rolo `666f35c`

## Product boundary

This baseline lets a user deliberately hand one immutable, revision-pinned Episode
review context to another browser through a canonical URL. The URL is a navigation
capability carrying opaque public identifiers only. It does not contain Episode,
Evidence, Finding, or Asset content.

The recipient independently reconnects when robot identity differs, negotiates every
existing feature, rereads both optional comparison sides, and revalidates focus before
rendering. The link carries only `READ_ONLY_REVIEW_HANDOFF_ONLY` authority.

## Frozen contract

- accept only HTTP(S) workbench origins without embedded credentials;
- require an exact non-null immutable Episode revision;
- discard unrelated query fields and fragments before rebuilding the strict existing
  Episode navigation allowlist;
- require exact parser round-trip equality before any clipboard write;
- revalidate Event, Finding, Asset, comparison, and Evidence-context focus against the
  currently loaded bounded public inputs;
- permit clipboard writing only after an explicit user action and expose denial without
  fallback navigation or storage;
- add no endpoint, producer contract, browser persistence, content export, execution
  replay, verdict, release signal, deployment, or write authority.

## Promotion evidence

- E17A-E17C were reviewed and sealed as frontend minimum `92689a9`.
- The feature commit was fast-forwarded to `main` as `92689a9`; GitHub Actions CI run
  #44 completed successfully.
- The complete local gate passed 177 application tests, TypeScript checking,
  production packaging, and four Sites worker tests.
- The live gate independently read `ep-e9-reference@1` and
  `ep-e9-member-newest@1`, then validated simple/comparison round trips, unrelated-state
  stripping, same/cross-robot planning, malformed input, and clipboard denial.
- Browser validation copied a canonical link and independently restored the exact pair
  in a new tab. A stale Evidence selection was removed while the valid pair remained;
  the rebuilt preview reported no console errors.

## Deferred successor work

Execution replay, recollection, media, Asset or Evidence content, export files, ranking,
verdicts, release influence, offline persistence, multi-tab synchronization, and every
robot write action remain outside this baseline.
