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
- Binding trust inspector for endpoint authority, provenance, evidence coverage, digests, and limitations.
- Capability readiness lens that keeps contract, applicability, registration, binding, availability, and verification signals independent.
- Agent-inferred capability routes shown in a separate discovered-unverified lane that never contributes to readiness.
- Feature-negotiated Adapt context lens for on-demand target-operation slices, execution classes, deferred reasons, governance mappings, and bounded Capability Explorer focus.
- Bounded operation-governance matrix with cross-layer summaries, combined filters, pagination, and Registry detail navigation.
- Governance filters for risk, access, lifecycle, and data classification with row-level policy context.
- Lifecycle gate view for Adapt → Diagnose → Verify.
- Lifecycle assessment matrix for current stage status, blockers, prerequisites, artifacts, owners, and supported runs.
- Immutable lifecycle run details with independent gate checks and verified handoffs.
- Robot Wiki with manifest-verified discovery summaries, advisory insights, and evidence-linked changes.
- Manifest-verified discovery history with bounded probe coverage and capability-candidate summaries.
- Sanitized target-evidence scope and freshness with read-only recollection guidance.
- Bidirectional Wiki and Stack Map layer context without inferred entity relationships.
- Evidence ledger with provenance and integrity status.
- Episode Studio with revision-pinned timelines, diagnostic focus, neutral pair comparison,
  feature-negotiated immutable revision history, and descriptive-only exact-match Cohort
  Review over bounded 7/30/90-day windows.
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

Authenticated Target and Job writes are deliberately shipped as a second plugin under
`deployment-control/`. Its production artifact is `dist/deployment-control/` and includes its own
`rolo.plugin.json`; the original `rolo-vis` manifest and browser client remain read-only. The control
plugin verifies `GET /v1/deployment-session` before exposing its workbench, holds the Controller
Bearer token in React memory only, and clears it on disconnect or page reload. It never accepts SSH
private keys or arbitrary commands.

Robot Wiki keeps its trust lanes explicit: machine insights and discovery diffs come from the verified discovery manifest, while human-maintained Wiki text is shown separately as validated, unverified, or unavailable. Human prose is never promoted to a machine-observed fact.

## Build and verify

```powershell
npm run build
npm run test:sites
```

To verify only the independent deployment-control artifact:

```powershell
npm run test:deployment-control
npm run typecheck:deployment-control
npm run build:deployment-control
```

The control plugin also contains the W9 Natural-language deployment panel. It sends an explicit
selected-target allowlist to `POST /v1/session-agent/turns`; the browser bearer authenticates only
the Controller request and is never forwarded to Codex. The backend feature is disabled by default
and requires a dedicated Session Agent provider key. Codex can choose only broker catalog actions,
cannot decide approvals, and the UI rejects raw target output or credential-bearing responses.
The panel also reads the authenticated W10 readiness report and displays unresolved production gates;
static configuration checks never suppress the required real-provider, SSH, HA, OS-isolation, or architecture acceptance.
The same authenticated plugin exposes an R3 target-runtime rollback form backed by
`POST /v1/targets/{target_id}/runtime-rollback-jobs`. It accepts only the previous package ID,
exact current/previous manifest digests, an independent approver, TTL, and timeout. Submission
freezes an Approval and does not immediately mutate the target; shell, argv, SSH credentials, and
Controller paths remain outside the browser contract.
The R3 host-provisioning form similarly calls
`POST /v1/targets/{target_id}/host-provisioning-jobs` with two distinct Ed25519 public keys, an
independent approver, TTL, and optional current-plan CAS digest. It never accepts private keys. The
response is limited to Job, Approval, and plan digest; approval and Job execution remain separate
authenticated actions, and unknown remote outcomes require reconciliation.

For the complete MVP release-candidate gate, run:

```powershell
npm run verify:baseline
```

The selected visual target is stored at `docs/design/selected-stack-map.png`, and the product scope is in `docs/WEB_VISUALIZATION_PRODUCT_PROPOSAL.md`.
