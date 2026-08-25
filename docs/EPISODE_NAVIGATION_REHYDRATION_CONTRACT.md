# E16 Episode navigation rehydration contract

Status: E16A-E16C reviewed and approved on the `v0.30.0` read-only baseline.
E16D promotion is pending; no `v0.31.0` baseline is established yet.

## Decision

E16 makes browser Back and Forward deterministic workbench navigation inputs. A
history entry may restore an Episode only after the existing strict deep-link parser
validates the complete pinned context. This boundary carries
`NAVIGATION_REHYDRATION_ONLY` authority.

## State transform

| History input | Workbench result |
| --- | --- |
| valid pinned Episode URL | restore Episode target, clear transient drawers/focus, reconnect only when robot identity changes, and remount Episode Studio |
| valid non-Episode view | restore that view and clear the prior Episode replay target |
| missing `view` | restore Stack Map |
| malformed Episode URL | fail closed to Stack Map and normalize the URL |
| unsupported view | fail closed to Stack Map and normalize the URL |

An explicit Sidebar navigation clears the prior replay target. Opening Episode from
the Sidebar therefore starts an unpinned collection view instead of reviving stale
history state.

## Validation and lifecycle order

1. Parse the current URL with the bounded workbench navigation classifier.
2. For Episode, reuse the existing identifier, revision, comparison, Evidence, Asset,
   and cohort validation without relaxing any rule.
3. Clear transient Evidence drawer, Stack focus, and Wiki focus state.
4. If the pinned robot differs from the connected robot, run the existing read-only
   bootstrap for that exact robot. Do not reconnect when identity is unchanged.
5. Remount Episode Studio so all prior bounded request effects abort and the restored
   pinned inputs are independently read and revalidated.
6. Let existing feature negotiation reject Episode when the producer does not
   advertise the required read model.

The URL is navigation input, never trusted read-model data. Invalid state cannot be
partially applied.

## Negative authority

E16 adds no endpoint, producer schema, feature flag, query field, browser storage,
backend mutation, replay execution, teleoperation, shell access, artifact path,
Evidence or Asset content read, verdict, release signal, or production deployment.
It only restores already contracted read-only view state.

## Delivery slices

- **E16A — contract and classifier:** freeze restorable states, invalid-state fallback,
  request lifecycle, and negative authority.
- **E16B — controlled browser replay:** consume `popstate`, restore validated view
  state, reconnect only across robot identities, and remount the Episode boundary.
- **E16C — validation:** exercise Back/Forward across orientation handoffs, robot
  changes, malformed URLs, and unavailable feature negotiation in local/live gates.
- **E16D — baseline:** after review, complete remote CI, merge, metadata promotion,
  and `v0.31.0` tagging as separately authorized release work.

## E16C validation evidence

On 2026-08-25 the local production preview and the live rolo read model exercised one
real pair orientation history. Reorienting the right Timeline occurrence created a
same-document history entry; Back restored `ep-e9-reference@1`, its comparison, Context,
and `evt-command`, while Forward restored `ep-e9-member-newest@1`, the inverse
comparison, Context, and `evt-outcome`.

The reusable live gate also validated that same-robot replay does not request another
bootstrap, a different connected robot produces the exact pinned reconnect target,
malformed Episode and unsupported view state normalize to Stack, and missing Episode
feature negotiation is deferred while connecting but rejected after the connection
settles. The complete local gate passed 170 application tests, TypeScript checking,
production packaging, and four Sites worker tests. The gate performs no write,
content, new endpoint, or deployment operation.

## Upstream compatibility

rolo `main@666f35c` already provides every public Episode read contract consumed by
this feature. E16 is frontend navigation lifecycle work and requires no rolo producer
change.
