# Job read-only consumer contract

Status: E24A candidate

rolo-vis consumes only the versioned Job read models published by rolo. This slice
defines the transport and validation boundary; it does not start, resume, retry, or
cancel a Job.

## Supported schemas

- `rolo-job-page/v1`
- `rolo-job-summary/v1`
- `rolo-job-recovery/v1`
- `rolo-job/v1`
- `rolo-job-event-page/v1`
- `rolo-job-event/v1`
- `rolo-job-checkpoint/v1`

The client fails closed on unknown schema versions, invalid identity, invalid status,
negative revisions/sequences, invalid timestamps, duplicate page identities, and
pagination contradictions.

## Trust boundary

- `target` is a display string supplied by rolo; the browser does not interpret it as
  a filesystem path or execute it.
- Event `payload` and checkpoint `state` remain opaque summaries. They are never used
  to construct commands or mutate a target.
- The consumer rejects Job, event, and checkpoint projections containing artifact/raw
  path references and rejects opaque payloads larger than 16 KiB; rejected responses
  remain unavailable instead of being partially rendered.
- The browser has no Job write method. `POST /v1/targets/bootstrap-execute` remains
  outside this contract and outside the plugin endpoint manifest.
- The `workbench.job-read-model/v1` feature is required before a future UI surface
  activates. Existing views remain unchanged when the feature is absent.

## Pagination

The client sends bounded `limit`/`offset` queries and validates that returned items do
not exceed the requested page, `next_offset` advances monotonically, and all page
identities are unique.
