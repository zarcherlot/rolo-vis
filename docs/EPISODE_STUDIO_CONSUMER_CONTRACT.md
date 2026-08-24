# Episode Studio consumer contract

Status: V1C hardening review
Frontend base: rolo-vis `v0.19.0`  
Producer design: `rolo-episode-contract-design/v1`

## Consumer boundary

rolo-vis will consume only the public `rolo-episode-*/v1` read models. It will not
parse Episode artifact manifests, call `episode.inspect/export`, read files, or render
raw `RobotUseSupervision` provider responses.

The first frontend slice remains read-only and is hidden until the control-plane
health response advertises an explicit Episode read-model feature. No fixture or
existing Lifecycle data is re-labeled as an Episode.

## Required producer contracts

- `rolo-episode-collection/v1`
- `rolo-episode-summary/v1`
- `rolo-episode-detail/v1`
- `rolo-episode-timeline-page/v1`
- `rolo-episode-timeline-event/v1`
- `rolo-episode-asset-summary/v1`
- `rolo-episode-finding-summary/v1`

Expected endpoints:

```text
GET /v1/robots/{robot_id}/episodes
GET /v1/robots/{robot_id}/episodes/{episode_id}
GET /v1/robots/{robot_id}/episodes/{episode_id}/timeline
```

## Screen contract

### Episode list

Shows task label, Episode state, execution outcome, verification status, start/end,
duration, lane coverage, warning/finding counts, and limitations. State does not choose
the outcome color, and outcome does not choose the verification badge.

### Episode Studio shell

- left: bounded Episode list and published revision;
- center: shared time cursor and lane timeline;
- right: selected event/finding/evidence inspector;
- lower summary: Expected vs Observed and independent verification state;
- perspective tray: metadata-only asset cards in the first slice.

The initial implementation does not render image/video bytes. Asset cards show
modality, physical/simulated/replayed world, raw/derived/screenshot evidence kind,
frame, synchronization, classification, digest, limitations, and an Evidence link.

## Timeline rules

- Use `sequence` and `offset_ms` for deterministic order.
- Display UTC time but do not use browser clock parsing to reorder events.
- Pin every page request to Episode `revision`; reject mixed revisions.
- Keep `COMMAND`, `STATE`, `TELEMETRY`, `OBSERVATION`, `ALERT`, `AGENT`,
  `CONFIGURATION`, `CHECKPOINT`, `GATE`, and `OUTCOME` as explicit lanes.
- Unknown lanes or enums fail closed with a contract error.
- Coarse-to-fine zoom changes density only; it cannot discard authority labels.

## Trust presentation

| Authority | UI language | Must not imply |
| --- | --- | --- |
| `DECLARED` | Intended / configured | Executed or observed |
| `OBSERVED` | Observed fact | Causal explanation |
| `INFERRED` | Agent inference · unverified | Observation or verification |
| `HUMAN_CONFIRMED` | Human confirmed | Automated Verify result |
| `VERIFIED` | Verify-stage result | Live physical state outside its interval |

Finding kinds remain visibly distinct: observed fact, candidate cause, human
confirmation, and verified outcome. Confidence changes emphasis inside one kind; it
never changes the kind.

## Data and security rules

- Reject artifact refs, paths, signed URLs, collector identity, credentials, command
  payloads, model prompts, and model responses recursively.
- Never display `SECRET` payloads; show only redaction counts and limitations.
- `SIMULATED` and `REPLAYED` are persistent badges, not optional metadata.
- Missing or degraded synchronization prevents precise spatial/time claims.
- No export, replay, recollection, invoke, cancel, or remediation control appears in
  the first slice.
- A live contract failure never substitutes demo data automatically.

## Feature negotiation

Proposed health feature: `workbench.episode-read-model/v1`.

Without that feature, rolo-vis keeps Episode navigation absent. Once advertised, the
client may expose the shell, but each endpoint still validates its exact schema and
robot/Episode identity.

## Delivery plan

### V1A: parser and navigation gate — implemented in E3

- TypeScript types and fail-closed parsers;
- feature-negotiated navigation;
- empty, loading, unavailable, and incompatible states;
- collection and detail contract tests.

### V1B: metadata timeline — implemented in E3

- revision-pinned cursor pagination;
- lane filters and selected-event inspector;
- evidence drilldown and finding authority labels;
- asset metadata cards without content delivery.

### V1C: hardening after E3 review — implemented

- backend reference fixture and `rolo-data` regression;
- performance budget for 500 visible events and bounded pages;
- keyboard timeline navigation and reduced-motion behavior;
- stable deep link to robot, Episode, revision, and selected event.

The stable read-only link uses bounded query state:

```text
?view=episode&robot={robot_id}&episode={episode_id}&revision={revision}&event={event_id}
```

Invalid identities or revisions fail closed. A deep-linked event may page forward only
until the 500-event display budget is reached; it never triggers an unbounded scan.

### Deferred

- media content delivery and synchronized playback;
- live stream updates;
- Episode compare;
- diagnosis supplementary-observation loop;
- evidence package export and all write actions.

## E3 implementation evidence

- Feature negotiation hides Episode navigation until rolo advertises
  `workbench.episode-read-model/v1`.
- The client rejects unknown enums, mixed revisions, recursive unsafe fields, and
  candidate causes that claim verification.
- The metadata timeline was exercised against the E2 MentorPi producer fixture,
  including degraded synchronization, missing evidence, observed facts, Agent
  inference, and shared Evidence resolution.
- Desktop, 900 px, and 390 px layouts were browser-verified without body overflow;
  the narrow timeline uses bounded local horizontal scrolling.
- Visual comparison and browser evidence are recorded in `design-qa.md`.

## V1C hardening evidence

- Timeline pages remain bounded to 100 events and the accumulated interactive view is
  capped at 500 events. Layout projection has a 25 ms synchronous budget in tests.
- Arrow keys move through visible events in sequence order; Home and End select the
  first and last visible event. Markers use a roving tab stop and visible focus ring.
- `prefers-reduced-motion` disables Episode animation and transition movement.
- The URL pins robot, Episode, revision, and selected event. Initial bootstrap requests
  the linked robot and rejects a changed revision.
- `npm run check:episode-live` validates the collection, detail, revision-pinned pages,
  counts, and public safety contract against a running rolo backend. It passed against
  the local MentorPi `rolo-data` projection with 6 events, 2 findings, and 1 asset.
- Initial collection and pinned-detail failures expose explicit retry actions and never
  substitute fixture data.

## Acceptance carried forward

- Backend contract names, enums, bounds, cursor/revision semantics, and unsafe-field
  rules are approved.
- A reference fixture represents physical, simulated/replayed, degraded-clock, missing
  evidence, Agent inference, and verified outcome states.
- Product review confirms that metadata-only assets are useful before media delivery.
- Episode navigation remains absent from the MVP baseline and from live surfaces until
  the feature is advertised.
