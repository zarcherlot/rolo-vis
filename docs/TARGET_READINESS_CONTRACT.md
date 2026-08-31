# Target Readiness / Connection Assessment

Status: R1 producer published in rolo; rolo-vis consumer integration in progress

rolo-vis will consume a sanitized target readiness summary only after rolo publishes
the read model and advertises `workbench.target-readiness/v1` from `/health`. rolo
main includes this producer as of `15e6b7d1` (PR #47).

## Proposed public summary

The consumer contract is `rolo-target-readiness-summary/v1` and contains only:

- stable target ID and bounded `local`/`ssh` kind;
- producer-owned state: `READY`, `HOST_KEY_REQUIRED`, `UNREACHABLE`,
  `WORKSPACE_MISSING`, or `UNSUPPORTED`;
- reachability, host-key-pinned, platform, architecture, workspace-accessible, and
  companion status facts;
- bounded blocker/diagnostic/limitation text;
- `contains_secret_payloads: false`.

Raw SSH URIs, usernames, private keys, workspace paths, known-hosts data, and
bootstrap payloads are not part of the browser contract.

## Activation and negative capabilities

- No Target Readiness UI activates until the feature is advertised.
- The producer endpoints are `GET /v1/targets/readiness` and
  `GET /v1/targets/{target_id}/readiness`; the UI remains feature-gated and
  fail-closed when `/health.api_features` omits the feature.
- The workbench validates the projection with a fail-closed parser in
  `src/contracts/targetReadiness.ts`.
- `POST /v1/targets/bootstrap-execute` remains server/CLI-only and is never called by
  rolo-vis.
- A future UI may display an opaque Bootstrap Plan, but must not approve, execute,
  resume, retry, or rollback from the browser without a separate governance contract.
