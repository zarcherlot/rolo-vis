# rolo-vis read-only MVP baseline

Status: established baseline  
Version: `0.19.0`  
Baseline ID: `rolo-vis-mvp-readonly/2026-08`

This baseline freezes the first useful read-only workbench boundary. It does not
freeze future write operations, Episode views, or upstream artifact formats.

## Product boundary

- Fleet overview and blocker triage
- Robot Overview and four-layer Stack Map
- Topology snapshots, diffs, paths, and evidence drilldown
- Capability contracts, deterministic bindings, readiness, and isolated Agent
  inference provenance
- Wiki insights, discovery history, heuristic status, target-evidence freshness, and
  limitations
- Lifecycle runs, gates, handoffs, and evidence ledger

All views fail closed on unsupported contracts. Demo data remains explicitly labeled
and is never substituted automatically when a live request fails.

## Compatibility matrix

| Read model | Accepted by rolo-vis | Current rolo producer |
| --- | --- | --- |
| Capability collection | v1, v2 | v2 |
| Capability summary | v1, v2 | v2 |
| Capability detail | v1, v2 | v2 |
| Discovery collection | v1, v2, v3 | v3 |
| Discovery summary | v1, v2, v3 | v3 |

The executable source of truth is `src/contracts/compatibility.ts`. Older accepted
versions retain only the semantics they publish; the client does not synthesize v2 or
v3 trust fields.

## Trust invariants

- Agent-inferred routes are always `DISCOVERED_UNVERIFIED` and never contribute to
  Available, Verified, applicability, or established-binding readiness.
- Heuristic status is advisory and `influences_release` must be false.
- Target evidence freshness is backend-owned; request expiry is not treated as
  evidence freshness.
- Raw artifact paths, host paths, collector details, and secret payloads remain
  outside the public read model.
- Recollection guidance is read-only; this plugin performs no remediation.

## Review and promotion gate

1. Run `npm run verify:baseline`.
2. Start rolo against the desktop `rolo-data` and verify the workbench remains in live
   or explicitly partial mode.
3. Review the tests-only trust fixture states for semantics not present in current
   live data.
4. Confirm there is no write, operation invocation, terminal, or arbitrary file
   access path.
5. Any later contract expansion must preserve this tagged compatibility boundary or
   publish an explicit successor schema.

## Known limitations

- Current `rolo-data` may not contain Agent-inferred routes or target-evidence
  freshness; those states are covered by isolated review fixtures and contract tests.
- The workbench cannot initiate evidence recollection.
- Episode/timeline correlation and write-side robot operations are post-MVP work.
- The UI remains a single application shell; this batch isolates high-risk contract
  parsing first and deliberately avoids a visual rewrite.
