# Episode Cohort Investigation consumer contract

Status: review candidate

Candidate: E9 / rolo-vis v0.24 development line

Extends: rolo-vis `v0.23.0` Episode Cohort Review baseline

Producer minimum: unchanged from E8 (`workbench.episode-cohort-read-model/v1`)

## Purpose

E9 connects two already validated read-only surfaces. A user may keep the current
revision-pinned Episode as the cohort reference and send one exact-match cohort member to
the right side of the existing pair comparison. This removes the need to leave the
reference, find the member again in the bounded Episode index, and reconstruct the pair.

The bridge carries identity only: robot, Episode ID, and revision. Both comparison sides
are still fetched and validated independently before any descriptive delta is rendered.
The cohort response is not treated as Episode detail or timeline evidence.

## Interaction contract

- Every cohort member offers two distinct actions: open that published revision, or
  compare it with the pinned reference.
- Compare keeps the reference Episode and revision unchanged and pins the member on the
  right side.
- Open retains the v0.23 behavior: it clears comparison state and makes the member the
  new reference.
- A comparison selection remains revision-addressable in the existing `compare` and
  `compare_revision` deep-link parameters. The selected cohort window remains in
  `cohort_days`.
- A cohort member that is not present in the currently loaded Episode index remains a
  valid pinned comparison target. The comparison loader reads it by exact identity.
- Loading, rejection, and comparison limits continue to use the E5 pair-comparison
  states and budgets.

## Trust and authority

- No new backend endpoint, feature flag, producer schema, or write permission is added.
- Cohort membership is only a navigation hint. It does not satisfy detail, timeline,
  evidence, outcome, or verification validation for the comparison.
- Comparison remains descriptive and release-neutral. Member order remains server-authored
  newest-first; no rank, score, threshold, anomaly, improvement, or regression is derived.
- The action is available only inside the independently negotiated E8 cohort surface.
- Media, replay, recollection, export, external handoff, and all writes remain deferred.

## Upstream compatibility checkpoint

rolo main through `e96c9b0` adds deterministic non-ROS CLI routes and middleware-neutral
Wiki narrative, but does not change the public Episode cohort, detail, revision-history,
or timeline schemas consumed by E9. E9 therefore requires no rolo producer change and
must remain compatible with the E8 producer minimum.

## Review slices

- E9A: approve this identity-only bridge and its authority boundary.
- E9B: add explicit Open and Compare actions while preserving the pinned reference.
- E9C: cover off-index members, deep-link continuity, accessibility, and neutral copy.
- E9D: run the full baseline gate and live validation before a v0.24 baseline proposal.
