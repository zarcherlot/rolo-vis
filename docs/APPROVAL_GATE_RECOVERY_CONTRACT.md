# Approval / Gate / Recovery read contract

Status: R2 producer published in rolo; rolo-vis consumer integration in progress

E25 defines the future read-only projection required by an approval and recovery
workbench. It does not add browser approval or execution authority.

## Proposed projection

The public schema is `rolo-approval-gate-summary/v1`, feature-gated by
`workbench.approval-gate-read-model/v1`. It binds one opaque `job_id` and `target_id`
to:

- Bootstrap plan status and bounded step summaries;
- required approval scopes and approval status;
- producer-owned Gate status and check labels;
- recovery availability and blockers;
- bounded limitations with `contains_secret_payloads: false`.

The projection must not contain private keys, SSH credentials, raw workspace paths,
package bytes, command arguments, artifact bodies, or unredacted transport output.

## Authority boundary

- GUI may display the exact target/action/version/digest summary only after rolo
  publishes a safe projection that binds those values.
- GUI may not create or approve `BootstrapApprovalRequest`, call
  `bootstrap-execute`, resume/retry/cancel a Job, or trigger rollback.
- Approval must remain separate from Gate outcome; a successful approval is not proof
  of execution, physical outcome, or release readiness.
- Recovery is a producer-owned state summary. The browser must never resume mutation
  automatically after refresh or reconnect.

rolo main includes the read model and governance boundary as of `15e6b7d1`
(PR #48). The producer endpoints are `GET /v1/approval-gates` and
`GET /v1/jobs/{job_id}/approval-gate`.

The workbench validates the projection with the fail-closed parser in
`src/contracts/targetReadiness.ts`; the consumer remains feature-gated and adds no
browser approval, execution, recovery, or rollback authority.
