# Artifact Analysis Read Model

Status: candidate-demo-only

The UI currently renders a clearly labelled, sanitized fixture. It does not
pretend that the fixture is a live rolo producer and it does not read local
files, artifact bytes, raw paths, or signed URLs.

## Proposed producer contract

- Schema: `rolo-artifact-analysis-summary/v1`
- Feature gate: `workbench.artifact-analysis-read-model/v1`
- Endpoint: not published by rolo
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

`source_kind: demo_fixture` is the only currently usable source. The UI labels
it as a demo fixture and keeps the analysis advisory: it does not establish
Capability readiness, Job success, physical outcome, or release readiness.

## Activation gate

Do not add an API request or activate a live navigation item until rolo
publishes the feature and endpoint, plus positive and negative fixtures for
fresh, stale, partial, identity-mismatch, oversized, and sensitive payloads.
