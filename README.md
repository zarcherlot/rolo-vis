# rolo-vis

`rolo-vis` is the read-only Web workbench plugin for [rolo](../robot_loop). It turns robot discovery, lifecycle, capability, and evidence data into an explorable engineering interface.

## MVP

- Topology-first Stack Map across Hardware, Linux, ROS/Middleware, and Application.
- Robot Overview focused on trust, blockers, and next action.
- Capability Explorer for canonical operations, risk, lifecycle, and bindings.
- Lifecycle gate view for Adapt → Diagnose → Verify.
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

The plugin is read-only. It does not provide teleoperation, a free-form terminal, arbitrary file browsing, or operation invocation.

## Build and verify

```powershell
npm run build
npm run test:sites
```

The selected visual target is stored at `docs/design/selected-stack-map.png`, and the product scope is in `docs/WEB_VISUALIZATION_PRODUCT_PROPOSAL.md`.

