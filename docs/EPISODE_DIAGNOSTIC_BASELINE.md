# Episode comparison and diagnostic baseline

Status: established baseline

Version: `0.21.0`

Baseline ID: `rolo-vis-episode-diagnostic/2026-08`

Extends: rolo-vis `v0.20.0` / `rolo-vis-episode-readonly/2026-08`

Frontend candidate: `118173f`

Producer minimum: rolo `570bad0` (merged to `main` by `4cac539`)

## Product boundary

This release keeps the Episode workbench read-only and adds two reviewed client-side
surfaces to the `v0.20.0` collection, detail, and revision-pinned timeline baseline:

- E5 independently loads two immutable Episode publications and presents only neutral
  right-minus-left facts and count distributions; it does not produce a pair verdict.
- E6 focuses one published Finding and its coincident timeline window while preserving
  supporting evidence, contradicting evidence, assets, authority, and verification as
  separate lanes.

The seven accepted public Episode schema versions remain unchanged. The release does not
add a compare, diagnosis, remediation, recollection, replay, export, media, or write API.

## Frozen trust and boundedness invariants

- Agent and candidate-cause content remains `INFERRED / UNVERIFIED` regardless of
  confidence, proximity, event count, or evidence volume.
- Pair comparison remains neutral and cannot label a side improved, regressed, safer,
  successful, causal, or verified.
- Coincident events are context only; time overlap cannot establish evidence or cause.
- Each side is independently identity- and revision-pinned and limited to five pages or
  500 visible events.
- Repeated cursors, page overlap, event-count contradictions, identity drift, revision
  drift, unsafe fields, and unresolved asset references fail closed.
- Raw paths, URLs, payloads, prompts, credentials, secret content, and media bytes remain
  outside the public consumer boundary.

## Promotion evidence

- The producer was migrated onto rolo `v0.1.0-rc.1` main without conflicts and its full
  local suite passed.
- rolo PR #14 passed Python 3.10–3.13, production-sandbox, and LeRobot E2E gates before
  merge.
- Live `rolo-data` regression validated one MentorPi Episode with six events, two
  findings, and one metadata-only asset against the merged producer contract.
- Public payload review found no artifact or host paths, prompts, or signed URLs; stale
  revision and invalid cursor reads failed closed with 409 and 422.
- rolo-vis baseline verification covers unit contracts, typecheck, production build,
  Sites packaging, and the live Episode read-model check.

## Successor work

E7 is the next contract boundary: revision-addressable historical Episode detail and
timeline reads, followed by same-Episode cross-revision neutral comparison. Media,
streaming, replay, recollection, export, external handoff, and every write action remain
deferred.
