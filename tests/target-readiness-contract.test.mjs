import test from "node:test";
import assert from "node:assert/strict";
import { parseApprovalGateCollection, parseApprovalGateSummary, parseTargetReadinessCollection, parseTargetReadinessSummary } from "../src/contracts/targetReadiness.ts";
import { RoloContractError } from "../src/contracts/guards.ts";
import { RoloClient, ROLO_API_FEATURES } from "../src/roloClient.ts";

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
  observed_at: "2026-08-31T03:00:00Z",
  freshness: "fresh",
  producer_revision: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
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
  observed_at: "2026-08-31T03:00:00Z",
  freshness: "fresh",
  producer_revision: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
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

test("R1/R2 collections enforce producer metadata and pagination", () => {
  const readinessPage = { schema_version: "rolo-target-readiness-collection/v1", items: [readiness], total: 1, limit: 100, offset: 0, next_offset: null, observed_at: readiness.observed_at, freshness: "fresh", producer_revision: readiness.producer_revision, contains_secret_payloads: false };
  const approvalPage = { schema_version: "rolo-approval-gate-collection/v1", items: [approval], total: 1, limit: 100, offset: 0, next_offset: null, observed_at: approval.observed_at, freshness: "fresh", producer_revision: approval.producer_revision, contains_secret_payloads: false };
  assert.equal(parseTargetReadinessCollection(readinessPage, "/readiness").items.length, 1);
  assert.equal(parseApprovalGateCollection(approvalPage, "/gates").items.length, 1);
});

test("RoloClient pins the published R1/R2 endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return { ok: true, json: async () => String(url).includes("approval-gates") ? { schema_version: "rolo-approval-gate-collection/v1", items: [approval], total: 1, limit: 100, offset: 0, next_offset: null, observed_at: approval.observed_at, freshness: "fresh", producer_revision: approval.producer_revision, contains_secret_payloads: false } : String(url).includes("approval-gate") ? approval : String(url).includes("/v1/targets/target-wsl2-01/readiness") ? readiness : String(url).includes("readiness") ? { schema_version: "rolo-target-readiness-collection/v1", items: [readiness], total: 1, limit: 100, offset: 0, next_offset: null, observed_at: readiness.observed_at, freshness: "fresh", producer_revision: readiness.producer_revision, contains_secret_payloads: false } : readiness };
  };
  try {
    const client = new RoloClient("http://rolo.test");
    assert.equal(ROLO_API_FEATURES.targetReadiness, "workbench.target-readiness/v1");
    assert.equal(ROLO_API_FEATURES.approvalGateReadModel, "workbench.approval-gate-read-model/v1");
    await client.targetReadiness();
    await client.approvalGates();
    await client.targetReadinessDetail("target-wsl2-01");
    await client.jobApprovalGate("job_01");
    assert.deepEqual(urls, [
      "http://rolo.test/v1/targets/readiness?limit=100&offset=0",
      "http://rolo.test/v1/approval-gates?limit=100&offset=0",
      "http://rolo.test/v1/targets/target-wsl2-01/readiness",
      "http://rolo.test/v1/jobs/job_01/approval-gate",
    ]);
  } finally { globalThis.fetch = originalFetch; }
});
