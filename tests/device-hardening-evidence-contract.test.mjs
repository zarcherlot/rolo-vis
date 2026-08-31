import assert from "node:assert/strict";
import test from "node:test";

import { parseDeviceHardeningEvidenceBundle } from "../src/contracts/deviceHardeningEvidence.ts";
import { RoloContractError } from "../src/contracts/guards.ts";

const valid = {
  schema_version: "rolo-vis-device-hardening-evidence/v1",
  release_line: "v0.37.x",
  rolo_revision: "8441e222a6cb91e",
  producer_revision: "8441e222a6cb91e",
  target_id: "staging-arm64-01",
  target_kind: "ssh",
  evidence: [{
    scenario_id: "linux-arm64",
    status: "VERIFIED",
    evidence: {
      os: "Linux",
      architecture: "arm64",
      package_digest: "a1b2c3d4",
      job_id: "job-20260831-01",
      gate_result: "PASSED",
      observed_at: "2026-08-31T00:00:00Z",
      summary: "Install and read-only health checks passed.",
    },
  }],
};

test("evidence bundle accepts bounded sanitized verified evidence", () => {
  const parsed = parseDeviceHardeningEvidenceBundle(valid);
  assert.equal(parsed.evidence[0].status, "VERIFIED");
});

test("evidence bundle accepts rolo producer's explicit null for pending evidence", () => {
  const pending = { ...valid, evidence: [{ scenario_id: "linux-arm64", status: "PENDING_EXTERNAL", evidence: null }] };
  const parsed = parseDeviceHardeningEvidenceBundle(pending);
  assert.equal(parsed.evidence[0].evidence, undefined);
});

test("evidence bundle rejects incomplete, duplicate, or unsafe evidence", () => {
  assert.throws(() => parseDeviceHardeningEvidenceBundle({ ...valid, evidence: [] }), RoloContractError);
  assert.throws(() => parseDeviceHardeningEvidenceBundle({ ...valid, evidence: [valid.evidence[0], valid.evidence[0]] }), RoloContractError);
  assert.throws(() => parseDeviceHardeningEvidenceBundle({ ...valid, evidence: [{ ...valid.evidence[0], scenario_id: "unknown-scenario" }] }), RoloContractError);
  assert.throws(() => parseDeviceHardeningEvidenceBundle({ ...valid, evidence: [{ ...valid.evidence[0], evidence: { ...valid.evidence[0].evidence, summary: "C:\\workspace\\secret" } }] }), RoloContractError);
  assert.throws(() => parseDeviceHardeningEvidenceBundle({ ...valid, evidence: [{ ...valid.evidence[0], evidence: { ...valid.evidence[0].evidence, summary: "https://internal.example/evidence" } }] }), RoloContractError);
  assert.throws(() => parseDeviceHardeningEvidenceBundle({ ...valid, evidence: [{ ...valid.evidence[0], evidence: { ...valid.evidence[0].evidence, summary: "token was printed" } }] }), RoloContractError);
  assert.throws(() => parseDeviceHardeningEvidenceBundle({ ...valid, target_id: "ssh://host" }), RoloContractError);
});
