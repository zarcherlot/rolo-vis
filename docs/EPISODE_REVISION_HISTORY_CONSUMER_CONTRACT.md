# Episode revision history consumer contract

Status: E7 review candidate

Backend feature: `workbench.episode-revision-history/v1`

## Scope

rolo-vis may expose revision selection only after both the base Episode read model and the
revision-history feature are advertised. Without E7, Episode Studio keeps its v0.21
behavior: it reads the current published detail, pins that revision, and never requests a
historical record.

## Read flow

For a negotiated E7 connection, the workbench:

1. reads the bounded newest-first revision collection;
2. validates schema, robot and Episode identity, unique revisions, current marker,
   contiguous committed lineage, timestamps, counts, source metadata, and safe content;
3. requests detail with an explicit `revision` query;
4. pages the timeline with the same revision pin;
5. rejects the view if any identity or revision differs.

The client reads at most ten 100-item history pages, matching the producer's 1,000-record
hard limit. Missing pages, duplicate revisions, or an incomplete advertised total fail
closed. A legacy projection-only response can expose only its current revision and cannot
manufacture history.

## Same-Episode comparison

The pair selector may offer another validated revision of the selected Episode. Each side
is fetched and parsed independently, then bounded to five timeline pages and 500 visible
events. The comparison remains the existing local
`rolo-vis-episode-pair-comparison/v1` projection:

- numeric values are neutral `right - left` deltas;
- outcome and verification remain independent;
- Agent inference remains unverified;
- the view assigns no improvement, regression, safety, success, or causal verdict.

Deep links may carry the same Episode identity on both sides only when their positive
revision numbers differ. An unpinned left side, an identical pair, malformed identity, or
half-specified comparison is rejected.

## Deferred authority

E7 adds no write, replay, recollection, media, export, external handoff, or robot-action
surface. It is not part of the v0.21 MVP baseline; baseline promotion requires the backend
and frontend candidates to merge, remote checks to pass, and live two-revision evidence.
