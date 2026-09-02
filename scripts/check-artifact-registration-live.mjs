import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { parseArtifactAnalysisSummary } from "../src/contracts/artifactAnalysis.ts";
import { RoloApiError, RoloClient, ROLO_API_FEATURES } from "../src/roloClient.ts";

const baseUrl = (process.env.ROLO_API_BASE || "http://127.0.0.1:8080").replace(/\/$/, "");
const targetId = process.env.ROLO_ARTIFACT_TARGET_ID || "mentorpi";
const idempotencyKey = process.env.ROLO_ARTIFACT_REGISTRATION_KEY || `rolo-vis-${targetId}-analysis`;
const summaryPath = process.env.ROLO_ARTIFACT_SUMMARY_PATH;
const apiToken = process.env.ROLO_API_TOKEN?.trim();
const client = new RoloClient(baseUrl, { apiToken });

const report = {
  schema_version: "rolo-vis-artifact-registration-staging/v1",
  status: "BLOCKED",
  source: baseUrl,
  target_id: targetId,
  idempotency_key: idempotencyKey,
  feature: ROLO_API_FEATURES.artifactRegistration,
  steps: [],
  write_scope: "artifact-analysis:write",
  limitations: [
    "Only a bounded, sanitized analysis summary is registered; no artifact URL, path, bytes, Job, Gate, or Handoff is imported.",
  ],
};

try {
  assert.ok(apiToken, "ROLO_API_TOKEN is required for authenticated registration");
  assert.ok(summaryPath, "ROLO_ARTIFACT_SUMMARY_PATH must point to a sanitized rolo-artifact-analysis-summary/v1 JSON file");
  const health = await client.health();
  assert.equal(health.status, "HEALTHY", `health status is ${health.status}`);
  assert.ok(health.api_features.includes(ROLO_API_FEATURES.artifactRegistration), `missing negotiated feature: ${ROLO_API_FEATURES.artifactRegistration}`);
  report.steps.push({ id: "feature-negotiation", status: "PASSED", observed_at: health.timestamp });

  const summary = parseArtifactAnalysisSummary(JSON.parse(await readFile(summaryPath, "utf8")), "registration_summary");
  assert.equal(summary.source_kind, "rolo_api", "summary source_kind must be rolo_api");
  assert.equal(summary.target_id, targetId, "summary target binding does not match target id");

  const request = {
    schema_version: "rolo-artifact-registration-request/v1",
    kind: "analysis_summary",
    idempotency_key: idempotencyKey,
    target_id: targetId,
    summary,
  };
  const registered = await client.registerArtifactAnalysis(request);
  assert.equal(registered.target_id, targetId);
  report.steps.push({ id: "register", status: "PASSED", registration_id: registered.registration_id, receipt_status: registered.status });

  const replay = await client.registerArtifactAnalysis(request);
  assert.equal(replay.status, "REPLAYED");
  assert.equal(replay.registration_id, registered.registration_id);
  report.steps.push({ id: "idempotent-replay", status: "PASSED", receipt_status: replay.status });

  const readBack = await client.targetArtifactAnalysis(targetId);
  assert.equal(readBack.analysis_id, summary.analysis_id);
  report.steps.push({ id: "read-back", status: "PASSED", analysis_id: readBack.analysis_id, source_kind: readBack.source_kind });
  report.status = "PASSED";
} catch (error) {
  report.blocker = {
    message: error instanceof Error ? error.message : "artifact registration staging check failed",
    http_status: error instanceof RoloApiError ? error.status : null,
  };
}

console.log(JSON.stringify(report, null, 2));
if (report.status !== "PASSED") process.exitCode = 1;
