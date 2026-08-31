import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseDeviceHardeningMatrix, summarizeDeviceHardening } from "../src/contracts/deviceHardening.ts";
import { RoloContractError } from "../src/contracts/guards.ts";

const matrix = JSON.parse(await readFile(new URL("./fixtures/device-hardening-matrix.json", import.meta.url), "utf8"));

test("device hardening matrix is strict, bounded, and keeps external evidence pending", () => {
  const parsed = parseDeviceHardeningMatrix(matrix);
  const summary = summarizeDeviceHardening(parsed);
  assert.equal(summary.total, 11);
  assert.equal(summary.external, 10);
  assert.equal(summary.AUTOMATED_CHECKED, 1);
  assert.equal(summary.PENDING_EXTERNAL, 10);
});

test("device hardening rejects invalid status, duplicate scenarios, and unsafe evidence", () => {
  assert.throws(() => parseDeviceHardeningMatrix({ ...matrix, scenarios: [{ ...matrix.scenarios[0], status: "READY" }] }), RoloContractError);
  assert.throws(() => parseDeviceHardeningMatrix({ ...matrix, scenarios: [matrix.scenarios[0], matrix.scenarios[0]] }), RoloContractError);
  assert.throws(() => parseDeviceHardeningMatrix({ ...matrix, scenarios: [{ ...matrix.scenarios[0], class: "external", status: "AUTOMATED_CHECKED" }] }), RoloContractError);
  assert.throws(() => parseDeviceHardeningMatrix({ ...matrix, scenarios: [{ ...matrix.scenarios[0], status: "VERIFIED", evidence: { os: "Linux", architecture: "arm64", package_digest: "a1b2c3d4", job_id: "job-1", gate_result: "PASSED", observed_at: "2026-08-31T00:00:00Z", summary: "C:\\private\\transport" } }] }), RoloContractError);
});
