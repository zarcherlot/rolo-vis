# Episode Cohort Investigation baseline candidate

Status: approved and promoted by the `v0.24.0` baseline

Proposed version: `0.24.0`

Baseline ID: `rolo-vis-episode-cohort-investigation/2026-08`

Extends: rolo-vis `v0.23.0`

Reviewed frontend slice: `547134c`

Producer minimum: unchanged from E8, rolo `463d501` / feature
`workbench.episode-cohort-read-model/v1`

Validated upstream head: rolo `e96c9b0`

## Candidate boundary

This candidate adds one identity-only investigation bridge between the v0.23 Cohort lens
and the existing revision-pinned pair comparison. The pinned cohort reference remains on
the left; a selected exact-match member becomes the right side. Each side is read and
validated independently before the comparison is derived.

No endpoint, producer schema, feature flag, cohort membership rule, ranking, verdict,
release authority, media access, external handoff, or write surface is added.

## E9D validation evidence

Date: 2026-08-25

The current rolo service was started against an isolated, read-only copy of the desktop
`rolo-data` configuration and artifacts. Three controlled public Episode projections were
added only to the isolated validation copy; the source directory was not modified.

- The bounded Episode index returned only the pinned reference.
- The exact-match 30-day cohort returned two members with `COMPLETE` coverage.
- The selected member was outside the bounded index page and remained directly readable
  by exact Episode ID and revision.
- Reference and member detail plus timeline were fetched independently. Each timeline
  contained two sequence-ordered events, completed in one bounded page, and matched its
  published identity and revision.
- The derived pair kept `ep-e9-reference@1` on the left and
  `ep-e9-member-newest@1` on the right.
- Requesting the unavailable member revision `2` was rejected by the live producer.
- The round-tripped deep link preserved robot, both Episode identities, both revisions,
  and `cohort_days=30`.
- The result advertised no outcome verdict, causal attribution, or write support.

## Promotion result

E9D tooling and evidence were approved, commit `858c824` passed the PR #7 remote gate,
and the candidate merged to main as `a42adeb`. The release metadata, final verification,
main merge, and `v0.24.0` tag are recorded by the established baseline document.

