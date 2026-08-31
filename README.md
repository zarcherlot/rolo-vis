# rolo-vis

`rolo-vis` is the read-only web workbench for [rolo](https://github.com/zarcherlot/rolo).
It turns robot discovery, topology, capabilities, lifecycle state, Episodes, and
evidence into one traceable engineering view.

> Understand the stack. Inspect the contract. Follow the evidence.

![Stack Map preview](docs/design/selected-stack-map.png)

## Status

The current release is `0.37.0`. The MVP is intentionally read-only: it can explain
what rolo has published, but it cannot operate a robot, approve a Job, or mutate a
target. Live data is preferred; an explicitly labelled demo mode is available when a
rolo control plane is not reachable.

## What it includes

- **Stack Map:** a four-layer Hardware → Linux → ROS/Middleware → Application view with
  verified topology snapshots, bounded diffs, paths, and evidence drill-down.
- **Fleet and robot views:** readiness, blockers, robot overview, lifecycle gates, Wiki,
  discovery history, and evidence provenance.
- **Capabilities:** canonical operation contracts, bindings, coverage, risk/lifecycle
  filters, readiness signals, and a separate discovered-unverified lane for inference.
- **Episode Studio:** revision-pinned timelines, diagnostic focus, pair comparison,
  exact-match cohort review, evidence context, review handoffs, and observation bundles.
- **Feature-negotiated read models:** Job history, Target Readiness, Approval/Gate/
  Recovery, and Artifact Analysis appear only when the connected rolo advertises their
  versioned feature. Unsupported or unsafe payloads fail closed.

The UI never reads local files or artifact bytes, exposes raw paths or credentials, or
calls write endpoints such as bootstrap, resume, retry, cancel, rollback, or release.
See the [MVP baseline](docs/MVP_READONLY_BASELINE.md) for the full boundary.

## Quick start

Requirements: Node.js 24 (the version used by CI) and npm.

```powershell
npm install
npm run dev
```

Open the URL printed by Vite. During development, `/rolo-api` is proxied to
`http://127.0.0.1:8080`. To use another control-plane URL:

```powershell
$env:VITE_ROLO_API_BASE = 'http://127.0.0.1:8080'
npm run dev
```

To keep the browser on the same origin while changing the local proxy target, set
`ROLO_API_PROXY_TARGET` before starting Vite. If no compatible rolo API is available,
the app clearly labels its demo data; it never silently substitutes fixtures for a
failed live request.

## Verify a change

```powershell
npm run typecheck       # TypeScript checks
npm test                # application and contract tests
npm run build           # production bundle and Sites handoff files
npm run test:sites      # worker/hosting packaging checks
```

The release-candidate gate runs all of the above plus hardening checks:

```powershell
npm run verify:baseline
```

## Architecture at a glance

The browser talks to rolo through a small client layer. Versioned parsers in
`src/contracts/` validate every response; feature negotiation in `/health` controls
which surfaces may request data; views render only bounded, producer-owned summaries.
The `worker/` entrypoint and `scripts/prepare-sites-build.mjs` package the same build
for Sites hosting.

```text
rolo control plane ── /rolo-api ──> roloClient ──> contracts + feature gates ──> views
                                      │
                                      └── explicit demo fixtures when live data is unavailable
```

## Documentation

The [documentation guide](docs/README.md) is the canonical map. It separates durable
contracts and promoted baselines from operational handoffs and archived planning
snapshots.

- [Product proposal](docs/WEB_VISUALIZATION_PRODUCT_PROPOSAL.md) — product intent and
  information architecture.
- [MVP read-only baseline](docs/MVP_READONLY_BASELINE.md) — trust and capability
  boundary.
- [Episode Studio contract](docs/EPISODE_STUDIO_CONSUMER_CONTRACT.md) — Episode read
  models and interaction rules.
- [External closure runbook](docs/ROLO_EXTERNAL_CLOSURE_RUNBOOK.md) — staging/device
  evidence required before promoting a candidate baseline.
- [Selected visual direction](docs/design/selected-stack-map.png) — topology-first
  visual source of truth.

## Contributing

Keep changes bounded and evidence-led. When a public read model changes, update its
contract, parser, feature gate, negative tests, and baseline record together. Preserve
the read-only boundary and run `npm run verify:baseline` before opening a pull request.

The repository is designed to be handed to [Sites](https://openai.com/index/introducing-codex/)
without changing `.openai/hosting.json`, `worker/index.js`,
`scripts/prepare-sites-build.mjs`, or `tests/sites-worker.test.mjs`.
