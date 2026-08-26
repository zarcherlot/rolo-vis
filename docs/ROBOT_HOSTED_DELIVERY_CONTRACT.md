# E23 robot-hosted delivery consumer contract

Status: E23A approved; E23B/C implementation review candidate

Target baseline: rolo-vis `v0.38.0`

Preserves: rolo-vis `v0.37.0` Episode Observation Bundle baseline

Paired producer/host contract: rolo
`docs/WORKBENCH_PLUGIN_HOST_CONTRACT.md`

## 1. Decision

rolo-vis is delivered as a read-only robot plugin. In production, the robot's rolo
process serves the compiled frontend and the control-plane API on one origin. rolo-vis
does not require or advertise a public production site.

The browser entry point is `/workbench/`; the same-origin API base remains
`/rolo-api`. Existing Vite proxying is a development aid only. E23C removes the Sites
project binding, Worker wrapper, Sites packaging step, and Sites-only tests. Historical
baseline documents remain immutable records and are superseded by this decision rather
than rewritten.

## 2. Consumer route contract

- the package entry is `dist/client/index.html`;
- Vite assets use relative URLs so the package is mounted below `/workbench/` without
  knowing a hostname or public URL at build time;
- API requests continue to use `/rolo-api` and never synthesize a remote host;
- query-based Stack Map and Episode deep links remain under `/workbench/`;
- the client does not add CORS, a backend selector, a tunnel URL, or a hosted fallback;
- an unavailable `/rolo-api/health` retains the explicit live-data-unavailable gate and
  never silently substitutes fixture data.

No browser code receives a bearer token. Robot-local use relies on loopback. Remote use
relies on a trusted robot-owned reverse proxy that controls access and forwards both
route families to a loopback-bound rolo process.

## 3. `rolo-plugin/v2` package

E23C upgrades `rolo.plugin.json` from the historical v1 shape to
`rolo-plugin/v2`. The required package layout is:

```text
rolo-vis-<version>/
  rolo.plugin.json
  SHA256SUMS
  dist/client/index.html
  dist/client/assets/*
```

The manifest must declare:

- `delivery.mode: device-local`;
- `delivery.mount_path: /workbench/` and scoped SPA fallback;
- `api.base_path: /rolo-api` plus required health-advertised API features;
- the existing read-only security boundary;
- `integrity.algorithm: sha256` and `integrity.manifest: SHA256SUMS`.

`SHA256SUMS` covers the manifest and every served file in stable path order. The
package command fails on an unexpected file, a missing entry, duplicate or
case-colliding paths, absolute paths, traversal, or nondeterministic output. Checksums
detect transport corruption; they do not grant publisher authenticity or any new robot
authority.

## 4. Build and release contract

E23C implements the following reviewed build contract:

- `npm run build` performs only the Vite client build into `dist/client`;
- `npm test` includes robot-hosted delivery contract coverage;
- `npm run package:plugin` creates the deterministic device package and checksums;
- `npm run verify:baseline` runs application tests, type checking, client build, and
  plugin-package verification without Sites or network access.

The following are retired from active delivery in E23C:

- `.openai/hosting.json`;
- `worker/index.js`;
- `scripts/prepare-sites-build.mjs`;
- `tests/sites-worker.test.mjs` and `npm run test:sites`.

Those files are removed by the E23C implementation. The deleted Sites project is not
recreated, saved, previewed, or deployed.

## 5. Compatibility and activation behavior

Compatibility is decided from the v2 manifest's required API features and rolo's
health catalog. A version label is display metadata, not a substitute for feature
negotiation. rolo validates the whole package before exposing `index.html`; therefore a
browser must never partially load a rejected or corrupt package.

The UI still independently negotiates optional features after load. A missing optional
feature hides or disables only that surface. A host-level required-feature mismatch
rejects activation and produces a bounded device diagnostic instead of a degraded,
misleading page.

## 6. Browser and authority boundary

- no public URL, Sites runtime, cloud database, external CDN, upload, or hosted secret;
- no browser persistence for credentials, plugin paths, or activation state;
- no directory browsing, source-map route, media byte expansion, or arbitrary file
  request;
- no teleoperation, shell command, arbitrary filesystem access, capture, recollection,
  replay, export, remediation, or verification influence;
- no demo fallback unless the user explicitly selects labeled demo data.

The UI may display package and rolo compatibility diagnostics, but it must not display
local paths, checksum values, raw exceptions, environment variables, or proxy secrets.

## 7. Lifecycle and rollback UX

E23 adds no in-browser installer or updater. Installation, selection, rollback, and
uninstall are robot-side operations. The UI may show the active plugin version and a
safe rejection reason, but it cannot activate or delete a package.

Rollback selects a previously validated package and reloads `/workbench/`. Existing
Episode deep links may survive only when the selected package still supports their
feature contracts; otherwise the current fail-closed compatibility view is shown.

## 8. Delivery slices

### E23A: contract design

- freeze the route, package, integrity, offline, compatibility, and trust boundaries;
- update durable repository instructions to make robot-hosted delivery authoritative;
- add no product source, manifest v2, package script, or server change.

### E23B: paired rolo host

- consume only a fully validated v2 package;
- serve `/workbench/` and adapt `/rolo-api` inside the existing process;
- preserve root API clients and API-only operation.

### E23C: frontend package migration

- remove the obsolete Sites delivery path;
- produce relative static assets and deterministic v2 packages;
- retain same-origin API and live-data failure semantics.

### E23D: device validation and baseline

- exercise preserved `rolo-data`, offline behavior, corruption and mismatch rejection,
  trusted proxy routing, rollback, and Episode Observation Bundle continuity;
- establish `v0.38.0` as a Git/tagged device-package baseline with no hosted deploy.

## 9. E23A acceptance decisions

1. Production means a device-local plugin package, not a public page.
2. `/workbench/` and `/rolo-api` share the robot-owned origin.
3. The frontend contains no host selector or secret-bearing remote mode.
4. Strict hosting begins at `rolo-plugin/v2` with complete checksum validation.
5. Required compatibility is feature-negotiated before activation.
6. Sites artifacts are removed in E23C, while historical baseline records remain.
7. `v0.37.0` is not moved; `v0.38.0` becomes the first robot-hosted baseline.
