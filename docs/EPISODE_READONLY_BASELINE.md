# Episode read-only baseline

Status: established baseline

Version: `0.20.0`

Baseline ID: `rolo-vis-episode-readonly/2026-08`

Extends: rolo-vis `v0.19.0` / `rolo-vis-mvp-readonly/2026-08`

Frontend candidate: `cb09340`

Producer minimum: rolo `e2217bb`

## Product boundary

This release adds the feature-negotiated, read-only Episode Studio to the established
MVP shell. It freezes collection, detail, revision-pinned metadata timeline, selected
event inspection, evidence drilldown, finding authority, metadata-only assets, stable
deep links, keyboard navigation, and bounded failure states.

The `v0.19.0` MVP remains a valid historical baseline. Episode support is a successor
boundary and does not widen any existing capability or discovery compatibility range.

## Compatibility matrix

| Read model | Accepted by rolo-vis | Producer minimum |
| --- | --- | --- |
| Episode collection | v1 | `e2217bb` |
| Episode summary | v1 | `e2217bb` |
| Episode detail | v1 | `e2217bb` |
| Timeline page | v1 | `e2217bb` |
| Timeline event | v1 | `e2217bb` |
| Asset summary | v1 | `e2217bb` |
| Finding summary | v1 | `e2217bb` |

The executable source of truth is `EPISODE_SCHEMA_COMPATIBILITY` in
`src/contracts/compatibility.ts`. Unknown versions and fields fail closed.

## Frozen trust and performance invariants

- Navigation appears only with `workbench.episode-read-model/v1`.
- Live failures never substitute Lifecycle or fixture data.
- State, execution outcome, verification, authority, and confidence remain independent.
- Agent inference remains unverified and cannot become observation or Verify evidence.
- Robot, Episode, revision, and selected event remain pinned in the URL.
- Timeline pages are limited to 100 events and the visible view to 500 events.
- Raw paths, URLs, payloads, prompts, credentials, secret content, and media bytes stay
  outside the public consumer boundary.
- The plugin exposes no Episode invoke, cancel, replay, export, recollect, or remediation
  operation.

## Promotion evidence

- rolo full suite passed with two expected skips before producer commit `e2217bb`.
- rolo-vis baseline verification passed with 108 tests, typecheck, production build,
  and four Sites packaging tests.
- Live `rolo-data` regression validated one MentorPi Episode with six events, two
  findings, and one metadata-only asset.
- Browser QA passed feature negotiation, Evidence drilldown, deep-link restore,
  revision rejection, keyboard navigation, reduced motion, and responsive containment.

## Successor work

Episode pair comparison is the next read-only contract design. Media delivery, live
updates, replay, evidence export, supplementary observation, and robot write actions
remain separate future contracts.
