# Artifact Analysis Read Model

Status: candidate · producer released, live gate pending

The UI renders a feature-gated rolo producer projection when the negotiated
feature is present. Demo mode remains an explicit fallback. The consumer does
does not read local files, artifact bytes, raw paths, or signed URLs.

## Proposed producer contract

- Schema: `rolo-artifact-analysis-summary/v1`
- Feature gate: `workbench.artifact-analysis-read-model/v1`
- Endpoints: `GET /v1/targets/{target_id}/artifact-analysis` and
  `GET /v1/jobs/{job_id}/artifact-analysis`
- Producer minimum: rolo `8a4bd6a2b5316ea21118ed83139e4f89bc9412f3`
- Mode: read-only

The future producer must own the analysis identity, target/job/discovery
relationships, source provenance, freshness, gate state, and limitations. The
consumer may only display the bounded summary after parsing and feature-gate
negotiation.

## Consumer boundary

The parser rejects:

- unknown schema versions, invalid identities, timestamps, statuses, or tones;
- unbounded text, collections, operation checks, or hash lists;
- `artifact://` references, filesystem paths, transport dumps, and secret-bearing
  fields;
- payloads that do not explicitly declare `contains_secret_payloads: false`.

`source_kind: rolo_api` is accepted only after feature negotiation; the demo
fixture remains explicit and labelled. Both sources keep the analysis advisory:
it does not establish
Capability readiness, Job success, physical outcome, or release readiness.

## Activation gate

The consumer is activated only after feature negotiation. Run
`npm run check:artifact-analysis-live` against the deterministic rolo harness
(`python scripts/rolo-live-harness.py --port 8765`) before treating the
producer path as live-verified. The gate covers positive summaries, target/job
identity binding, source provenance, and secret-free payloads; malformed,
identity-mismatched, oversized, and sensitive payloads remain fail-closed in
the parser and producer.
