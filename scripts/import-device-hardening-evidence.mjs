import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { importDeviceHardeningEvidence } from "../src/deviceHardeningEvidence.ts";

const matrixPath = process.argv[2] || "tests/fixtures/device-hardening-matrix.json";
const bundlePath = process.argv[3] || process.env.ROLO_DEVICE_EVIDENCE_BUNDLE;
assert.ok(bundlePath, "pass a bundle path or set ROLO_DEVICE_EVIDENCE_BUNDLE");
const result = importDeviceHardeningEvidence(
  JSON.parse(await readFile(matrixPath, "utf8")),
  JSON.parse(await readFile(bundlePath, "utf8")),
);
console.log(JSON.stringify({
  status: result.promotion_status,
  release_line: result.matrix.release_line,
  rolo_revision: result.bundle.rolo_revision,
  producer_revision: result.bundle.producer_revision,
  target_id: result.bundle.target_id,
  target_kind: result.bundle.target_kind,
  external_complete: result.external_complete,
  scenarios: result.matrix.scenarios.map(({ id, class: scenarioClass, status }) => ({ id, class: scenarioClass, status })),
  limitations: result.limitations,
}, null, 2));
