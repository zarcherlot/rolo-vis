# rolo-vis

`rolo-vis` is the read-only Web workbench plugin for [rolo](../robot_loop). It turns robot discovery, lifecycle, capability, and evidence data into an explorable engineering interface.

## MVP

- Fleet readiness and Blocker Inbox aggregated from validated robot overview and pipeline models.
- Topology-first Stack Map across Hardware, Linux, ROS/Middleware, and Application.
- Hash-verified gated topology history with snapshot comparison and bounded change details.
- Bounded topology path explanations with relationship direction and evidence drilldown.
- Robot Overview focused on trust, blockers, and next action.
- Capability Explorer for canonical operations, risk, lifecycle, and bindings.
- Capability coverage map by product layer with distinct verified, available, unavailable, and unknown trust states.
- Canonical operation families with explicit paired, replacement, and compensation navigation.
- Read-only contract schema inspector for required fields, constraints, units, frames, and execution semantics.
- Lifecycle gate view for Adapt → Diagnose → Verify.
- Immutable lifecycle run details with independent gate checks and verified handoffs.
- Robot Wiki with manifest-verified discovery summaries, advisory insights, and evidence-linked changes.
- Manifest-verified discovery history with bounded probe coverage and capability-candidate summaries.
- Bidirectional Wiki and Stack Map layer context without inferred entity relationships.
- Evidence ledger with provenance and integrity status.
- Live rolo API probing with an explicit demo fallback when no robot runtime is reachable.

## Run

```powershell
npm install
npm run dev
```

By default, the UI requests the rolo control plane through `/rolo-api`. During Vite development this path is proxied to `http://127.0.0.1:8080`. Override it with:

```powershell
$env:VITE_ROLO_API_BASE='http://127.0.0.1:8080'
npm run dev
```

To keep the browser on the same origin while targeting a different local rolo port, set `ROLO_API_PROXY_TARGET` before starting Vite.

The plugin is read-only. It does not provide teleoperation, a free-form terminal, arbitrary file browsing, or operation invocation.

Robot Wiki keeps its trust lanes explicit: machine insights and discovery diffs come from the verified discovery manifest, while human-maintained Wiki text is shown separately as validated, unverified, or unavailable. Human prose is never promoted to a machine-observed fact.

## Build and verify

```powershell
npm run build
npm run test:sites
```

The selected visual target is stored at `docs/design/selected-stack-map.png`, and the product scope is in `docs/WEB_VISUALIZATION_PRODUCT_PROPOSAL.md`.
