# Episode Diagnostic Focus consumer contract

Status: E6 approved

Base: rolo-vis Episode Pair Compare commit `1dcfb46`

Derived model: `rolo-vis-episode-diagnostic-focus/v1`

## Decision

E6 adds a read-only diagnostic focus inside one validated Episode revision. Selecting a
published Finding pins its identity in the URL, locates timeline events whose declared
offset range intersects the Finding window, and keeps supporting evidence,
contradicting evidence, and asset availability in separate lanes.

Time overlap is context only. It never makes an event supporting evidence, a cause, a
verification result, or a remediation recommendation. Only evidence and asset IDs
explicitly published on the Finding enter those lanes.

## Authority rules

- Finding `kind`, `authority`, and `verification` are displayed independently.
- `CANDIDATE_CAUSE` must remain `INFERRED + UNVERIFIED` or the projection is rejected.
- Confidence is descriptive metadata and never changes authority or verification.
- `OBSERVED_FACT` does not become a verified outcome.
- A coincident `VERIFIED` event does not verify the selected Finding.

## Bounded focus

- Focus consumes the already validated Episode detail and sequence-ordered timeline.
- Direct Finding links may page forward only to the existing 500-event display limit.
- A partially loaded timeline is labeled `BOUNDED_PARTIAL`; the UI states that more
  events may intersect the window.
- Mixed identity, mixed revision, unordered events, event-count overflow, unknown
  Findings, and dangling supporting asset IDs fail closed.

## Stable link

```text
?view=episode&robot={robot_id}&episode={episode_id}&revision={revision}
  &event={event_id}&finding={finding_id}
```

The `event` identifies the current inspector selection. The `finding` identifies the
diagnostic context; changing one does not change the published authority of the other.

## Explicitly deferred

- supplementary observation or recollection requests;
- remediation, retry, replay, cancel, and every other write action;
- automatic root-cause ranking;
- evidence-package export;
- media playback or synchronization;
- diagnosis handoff to another user or external system.

E6 provides a reviewable in-workbench context only. External handoff requires a
separate contract for identity, access, classification, and audit behavior.
