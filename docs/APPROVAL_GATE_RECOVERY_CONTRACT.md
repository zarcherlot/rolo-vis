# Approval / Gate / Recovery read contract

Status: E25 consumer boundary implemented; activation blocked on upstream publication

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

The current rolo API exposes only the write-side bootstrap endpoint, so E25 remains
contract-only until the read model and governance boundary are published.

The workbench validates the proposed projection with the fail-closed parser in
`src/contracts/targetReadiness.ts`; this does not add a read endpoint or any browser
approval, execution, recovery, or rollback authority.
