# Episode Evidence occurrence focus baseline

Status: established baseline

Version: `0.28.0`

Baseline ID: `rolo-vis-episode-evidence-occurrence-focus/2026-08`

Extends: rolo-vis `v0.27.0` / `rolo-vis-episode-evidence-context-navigation/2026-08`

Frontend minimum: `508c6d2` (merged to main by `57e3aaf`)

Producer minimum: rolo `463d501` (merged to main by `891cbf1`)

Validated upstream head: rolo `666f35c`

## Product boundary

This release connects one selected v0.27 Evidence reference context to an exact,
already-published source surface on the pinned left Episode. It carries only
`SOURCE_FOCUS_ONLY` authority.

The composite deep link reuses `compare_evidence` with the existing `event` or
`finding` field. No occurrence parameter, producer endpoint, or Evidence request is
added.

## Frozen contract

- only left Timeline and Finding supporting/contradicting occurrences expose focus;
- the selected Evidence attachment is revalidated against the pinned public inputs;
- stale IDs, detached references, and mismatched roles fail closed;
- both comparison identities, revisions, and the selected Context remain pinned;
- refresh restores the same composite Context plus Event/Finding anchor;
- right-side, Episode-level, and Asset occurrences remain context only;
- Finding attachment roles do not establish truth, sufficiency, verification, or cause;
- the focus action does not open or infer an Evidence record;
- no content read, artifact path, backend write, release signal, or new feature flag is
  introduced.

## Promotion evidence

- E13A–E13C commit `508c6d2` was approved.
- rolo-vis PR #15 passed the complete remote CI gate and merged to main as `57e3aaf`.
- E13D resolved a live left Timeline attachment from the existing Episode detail and
  bounded timeline, round-tripped `compare_evidence + event`, and rejected detached,
  role-mismatched, Episode-level, and Asset focus attempts.
- The live fixture exposes no Finding occurrence; the supporting and contradicting
  branches are covered by deterministic attachment tests rather than fabricated live
  data.
- Browser validation confirmed Event focus, unchanged pair/context state, absence of a
  right-side focus action, and refresh recovery.
- rolo `main@666f35c` was reviewed; changes since the previous validation point affect
  ADAPT/LeRobot runtime files and do not alter the public Episode read model.

## Deferred successor work

Right-side navigation, Episode or Asset focus, Evidence content comparison, safe
availability summaries, batch reads, export, external handoff, recollection, replay,
media delivery, release influence, and every write action remain outside this baseline.
