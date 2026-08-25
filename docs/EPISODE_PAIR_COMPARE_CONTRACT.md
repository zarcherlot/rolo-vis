# Episode Pair Compare consumer contract

Status: E5A and E5B approved

Base: rolo-vis `v0.20.0`

Derived model: `rolo-vis-episode-pair-comparison/v1`

E10 extends this historical E5 projection as
`rolo-vis-episode-pair-comparison/v2`; only the bounded Evidence reference trace is
added. The original E5 comparison dimensions and negative authority remain unchanged.

## Decision

The first compare slice is a client-derived, read-only comparison of two already
validated Episode v1 publications for the same robot. It does not add a backend compare
endpoint and does not change the rolo `e2217bb` producer contract.

Comparison is intentionally asymmetric: left is the reference Episode and right is the
candidate Episode. A numeric delta is always `right - left`, but is labeled
`UNINTERPRETED_DELTA`. The client never turns duration, event, finding, asset, severity,
confidence, or evidence-count differences into improved, regressed, safer, successful,
or verified language.

## Eligibility

`COMPARABLE` requires all of the following:

- same `robot_id`;
- distinct Episode/revision identity;
- both publications are immutable and terminal;
- exact matching non-null canonical `operation`;
- exact matching non-null `test_case_id`;
- exact matching non-null `expected_behavior`.

When any semantic condition is absent, the pair remains visible as
`DESCRIPTIVE_ONLY`, with every failed condition listed. Cross-robot pairs and identical
Episode/revision pairs are rejected rather than downgraded.

## Bounded inputs

The projection consumes only the existing public detail and revision-pinned timeline
contracts. Each timeline keeps the v0.20 limits: 100 events per request and at most 500
visible events. If either published `event_count` exceeds the loaded set, distributions
are labeled `BOUNDED_PARTIAL`.

No raw artifacts, media bytes, storage locations, prompts, provider responses, command
payloads, or collector metadata enter the comparison.

## V1 comparison dimensions

- Episode state, outcome, and verification shown independently;
- duration and published event/finding/asset/evidence counts;
- event counts by lane, authority, and severity;
- asset counts by availability;
- finding counts by kind;
- synchronization, coverage, and limitations presented on each side.

Finding confidence may be shown inside its existing kind but is not aggregated into a
pair score. Agent inference counts never affect outcome or verification.

## Explicitly unsupported conclusions

- no pass/fail or release recommendation;
- no improved/regressed, faster/slower-is-better, safer/riskier, or root-cause verdict;
- no event-to-event semantic alignment based on title, timestamp, or sequence;
- no claim that matching outcomes prove equivalent physical behavior;
- no claim that more evidence means better execution;
- no write, replay, export, recollection, or supplementary-observation action.

## Proposed deep link

```text
?view=episode&robot={robot_id}&episode={left_id}&revision={left_revision}
  &compare={right_id}&compare_revision={right_revision}
```

The selected event remains scoped to the left Episode in V1. Pair selection must not
silently change either pinned revision.

Since E7/v0.22.0, the selector also accepts one `episode_id` with two distinct positive
revision pins when rolo advertises `workbench.episode-revision-history/v1`. Each side is
independently resolved through the historical detail and timeline contracts. Older rolo
connections keep E5B's two-Episode current-revision behavior and never probe history.

## Delivery slices

### E5A — implemented for design review

- pure derived comparison model;
- strict identity, ordering, and 500-event bounds;
- comparability and partial-coverage semantics;
- neutral delta and authority-separation tests.

### E5B — approved

- compare selection and stable pair deep link;
- two-column facts and neutral delta table;
- side-by-side bounded lane/authority distributions;
- explicit descriptive-only and partial-coverage states.
- independently re-read both pinned revisions instead of trusting list metadata;
- load no more than five 100-event pages or 500 events per side;
- reject revision drift, mixed identity, repeated cursors, overlapping pages, and
  publication-count contradictions;
- preserve the left selected event while the right side remains an aggregate view.

### Deferred

- backend-authored verdicts or event alignment;
- media synchronization;
- statistical comparison across Episode cohorts;
- compare export and every write-side action.
