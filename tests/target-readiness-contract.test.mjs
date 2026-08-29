import test from "node:test";
import assert from "node:assert/strict";
import { parseApprovalGateSummary, parseTargetReadinessSummary } from "../src/contracts/targetReadiness.ts";
import { RoloContractError } from "../src/contracts/guards.ts";

const readiness = {
  schema_version: "rolo-target-readiness-summary/v1",
  target_id: "target-wsl2-01",
  target_kind: "ssh",
  state: "WORKSPACE_MISSING",
  reachable: true,
  host_key_pinned: true,
  platform: "linux",
  architecture: "x86_64",
  workspace_accessible: false,
  companion: "MISSING",
  blockers: ["workspace is not accessible"],
  diagnostics: ["host reachable; workspace probe failed"],
  limitations: ["read-only assessment; no bootstrap attempted"],
  contains_secret_payloads: false,
};

const approval = {
  schema_version: "rolo-approval-gate-summary/v1",
  job_id: "job_01",
  target_id: "target-wsl2-01",
  plan_status: "APPROVAL_REQUIRED",
  steps: [{ action: "VERIFY_WORKSPACE", risk: "READ_ONLY", approval_required: false, description: "Verify the configured workspace." }],
  required_approvals: ["target.bootstrap"],
  approval_status: "PENDING",
  gate_status: "BLOCKED",
  gate_checks: ["workspace_accessible"],
  recovery_state: "NOT_REQUIRED",
  blockers: ["approval is pending"],
  limitations: ["display-only projection"],
  contains_secret_payloads: false,
};

test("E24C parser accepts the sanitized target readiness projection", () => {
  assert.equal(parseTargetReadinessSummary(readiness, "/target").state, "WORKSPACE_MISSING");
});

test("E25 parser accepts approval, gate, and recovery as separate states", () => {
  const parsed = parseApprovalGateSummary(approval, "/approval");
  assert.equal(parsed.approval_status, "PENDING");
  assert.equal(parsed.gate_status, "BLOCKED");
  assert.equal(parsed.recovery_state, "NOT_REQUIRED");
});

test("future projections fail closed on paths or secret-bearing payloads", () => {
  assert.throws(() => parseTargetReadinessSummary({ ...readiness, diagnostics: ["C:\\\\workspace\\\\robot"] }, "/target"), RoloContractError);
  assert.throws(() => parseApprovalGateSummary({ ...approval, contains_secret_payloads: true }, "/approval"), RoloContractError);
});
