# Changelog

## 0.22.0 - 2026-08-24

- Add feature-negotiated, bounded Episode revision history.
- Pin historical detail and timeline reads to validated immutable revisions.
- Allow neutral same-Episode comparison across two distinct revision pins.
- Preserve current-only behavior for older rolo connections and keep all write, replay,
  media, recollection, export, and verdict authority outside the plugin.

## 0.18.0 - 2026-08-21

- Baseline the Visualization Sprint 2 workbench across Fleet, Stack Map, Capabilities, Lifecycle, Robot Wiki, and Evidence.
- Add feature-negotiated Adapt target-operation context and a bounded operation-governance matrix.
- Link Adapt target work and governance records to canonical Capability details without changing Registry trust states.
- Surface per-snapshot discovery limitations separately from warning counts in Robot Wiki.
- Preserve compatibility with backends that do not advertise the optional Adapt read models.
