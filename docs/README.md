# Documentation guide

This directory is the product and integration record for `rolo-vis`. Start here before
opening a contract or a release note.

## Start here

| Question | Document |
| --- | --- |
| What is the product and who is it for? | [Web visualization product proposal](./WEB_VISUALIZATION_PRODUCT_PROPOSAL.md) |
| What is the supported read-only boundary? | [MVP baseline](./MVP_READONLY_BASELINE.md) |
| What is shipped today? | [README status and commands](../README.md) |
| What is still waiting on rolo/staging evidence? | [External closure runbook](./ROLO_EXTERNAL_CLOSURE_RUNBOOK.md) |
| What visual direction should changes follow? | [Selected Stack Map](./design/selected-stack-map.png) |

## Contract and baseline records

The root-level contract and baseline files are intentionally kept at stable paths because
tests and downstream handoffs use them as machine-checkable evidence.

- **Core read models:** [Job](./JOB_READONLY_CONTRACT.md), [Target readiness](./TARGET_READINESS_CONTRACT.md), [Approval/Gate/Recovery](./APPROVAL_GATE_RECOVERY_CONTRACT.md), [Artifact analysis](./ARTIFACT_ANALYSIS_CONTRACT.md), and [device hardening](./DEVICE_HARDENING_VERIFICATION_PLAN.md).
- **Episode Studio:** [consumer contract](./EPISODE_STUDIO_CONSUMER_CONTRACT.md), [read-only baseline](./EPISODE_READONLY_BASELINE.md), and the versioned comparison, cohort, evidence, navigation, focus, handoff, review, and observation-bundle records.
- **How to read the names:** `*_CONTRACT.md` is normative consumer behavior; `*_BASELINE.md` is a promoted, version-pinned release record; `*_BASELINE_CANDIDATE.md` is review evidence retained for provenance.

## Operational documents

- [Engineering handoff](./ROLO_ENGINEERING_HANDOFF_LIVE_ARTIFACT.md) — paired live-gate state and rolo follow-ups.
- [External closure runbook](./ROLO_EXTERNAL_CLOSURE_RUNBOOK.md) — how to collect sanitized staging/device evidence.
- [Device hardening verification plan](./DEVICE_HARDENING_VERIFICATION_PLAN.md) — scenario matrix and required evidence.

## Planning archive

Roadmaps and development checklists change frequently and used to duplicate the same
status across several files. They now live under [archive/planning](./archive/planning/)
as historical snapshots. Use the operational documents above for current handoff work;
the archived files remain available for decision history.

## Source of truth

When documentation and implementation disagree, use the executable checks as the tie
breaker: parsers in `src/contracts/`, compatibility declarations in
`src/contracts/compatibility.ts`, and the tests under `tests/`. Update the relevant
contract and its baseline together when a public read model changes.
