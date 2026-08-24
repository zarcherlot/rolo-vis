# Episode Cohort Review consumer contract

Status: approved and promoted as the v0.23.0 read-only baseline

Backend feature: `workbench.episode-cohort-read-model/v1`

Extends baseline: rolo-vis `v0.22.0`

## Purpose

E8 extends the two-revision comparison workflow into a bounded population review. A user
opens one validated Episode revision as the reference and reviews exact-match current
publications from other Episode identities in a declared time window.

The surface is descriptive. It must not label improvement, regression, pass rate, safety,
reliability, root cause, confidence, statistical significance, or release readiness.

## Feature negotiation

The Cohort lens appears only when rolo advertises both the Episode base feature and
`workbench.episode-cohort-read-model/v1`. Older connections retain the v0.22 detail,
revision history, diagnostic focus, and pair comparison without probing the cohort
endpoint or synthesizing a cohort from the locally loaded Episode list.

## Interaction

- The currently pinned Episode/revision is always the reference.
- The initial window is the 30 days preceding the reference start time; users may choose
  7, 30, or 90 days. The backend derives exact timestamps from the reference.
- Changing the reference revision or window aborts the previous read and clears derived
  results.
- A missing operation, test case, or expected behavior shows an explicit not-comparable
  state; the client does not relax matching.
- The URL may add `cohort_days=7|30|90`; robot, Episode, and revision remain mandatory.
- Leaving Episode Studio removes the cohort parameter through the existing navigation
  cleanup.

## Presentation

The first slice contains:

1. a population header with exact operation/test-case identity, window, as-of time,
   coverage, and included/excluded/truncated counts;
2. separate distributions for duration, event count, finding count, asset count, and
   evidence count over returned members;
3. separate categorical counts for outcome, verification, and publication coverage;
4. a newest-first member table that can open the existing revision-pinned Episode view;
5. visible limitations and exclusion categories.

Numeric summaries are limited to count, minimum, median, maximum, and the pinned reference
value. Median is the middle sorted value, or the arithmetic mean of the two middle values
for an even member count. They carry the label `DESCRIPTIVE_ONLY`; no color, icon, copy,
sorting default, or delta sign may imply better or worse.

## Trust and failure rules

- Parse the new schemas through a dedicated compatibility allowlist.
- Require exact response identity, reference revision, requested day window, derived
  timestamps, and limit.
- Recompute included/excluded/truncated arithmetic and reject contradictions.
- Require unique newest-first member identities and current-revision markers.
- Reject raw paths, URLs, prompts, payloads, credentials, secret content, and unknown
  fields recursively.
- Never derive cohort membership from task label, Agent content, outcome, confidence,
  proximity, or the current UI list.
- `BOUNDED_PARTIAL` means all distributions are visibly partial.
- Outcome and verification are always displayed separately.

## Deferred

- backend-authored verdicts, rankings, thresholds, alerts, or release gates;
- historical revisions as cohort members;
- multiple robots or cross-robot benchmarking;
- inferential statistics and anomaly scoring;
- media synchronization, replay, recollection, export, external handoff, and writes.

## Implemented review slices

- E8A: producer schemas, projection, endpoint, fixtures, security and bounds tests.
- E8B: strict consumer parser, client feature negotiation, neutral distribution model.
- E8C: Cohort lens UI, deep-link window, accessibility and empty/error/partial states.
- E8D: live `rolo-data` population fixture, end-to-end verification, baseline decision.

E8D passed against an isolated six-publication population: the 7/30/90-day windows
returned one, two, and three eligible immutable members; running and mutable publications
remained excluded; a limit-one read validated `BOUNDED_PARTIAL`. The reviewed producer
and consumer commits are frozen by the v0.23.0 baseline.
