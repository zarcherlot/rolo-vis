# Episode Evidence occurrence focus contract

Status: E13A–E13C review candidate. This document does not establish the v0.28 baseline.

## Purpose

E13 connects one selected v0.27 Evidence context row to an already published source
surface on the pinned left Episode. It is a navigation aid with `SOURCE_FOCUS_ONLY`
authority, not a new Evidence interpretation.

The durable composite anchor reuses the existing `compare_evidence` selection together
with either the existing `event` or `finding` deep-link field. No duplicate occurrence
query state or producer endpoint is introduced.

## Allowed focus targets

- A left `TIMELINE` occurrence may focus the exact public Event when that Event still
  references the selected Evidence ID.
- A left `FINDING_SUPPORTING` or `FINDING_CONTRADICTING` occurrence may focus the exact
  public Finding when the corresponding producer-authored reference list still contains
  the selected Evidence ID.
- The target is resolved again against the current revision-pinned left detail and
  bounded timeline. Stale IDs, mismatched roles, and detached references fail closed.
- Focusing preserves both comparison revisions and keeps the Evidence context expanded.
  Refresh recovery uses the same pinned `compare_evidence` plus `event` or `finding` tuple.

## Deliberate exclusions

- Right-side occurrences remain context only; E13 cannot swap, mutate, or navigate the
  candidate side.
- Episode-level and Asset occurrences remain context only in this batch because no
  equivalent sanitized focus surface is established here.
- Supporting and contradicting labels remain producer-authored attachment roles. Focus
  does not decide whether a Finding is true, sufficient, verified, or causal.
- The feature does not read Evidence content, open the Evidence drawer, access artifact
  paths, rank outcomes, produce release signals, or add write authority.
