import assert from "node:assert/strict";

import { RoloApiError, RoloClient, ROLO_API_FEATURES } from "../src/roloClient.ts";
import { liveAuthConfig } from "./liveAuth.mjs";

const baseUrl = (process.env.ROLO_BASE_URL || process.env.ROLO_API_BASE || "http://127.0.0.1:8080").replace(/\/$/, "");
const client = new RoloClient(baseUrl, liveAuthConfig());
const requestedTargetId = process.env.ROLO_PREFLIGHT_TARGET_ID || process.env.ROLO_ARTIFACT_TARGET_ID || "";
const requestedJobId = process.env.ROLO_PREFLIGHT_JOB_ID || process.env.ROLO_JOB_ID || process.env.ROLO_ARTIFACT_JOB_ID || "";
const report = {
  schema_version: "rolo-vis-real-device-preflight/v1",
  status: "BLOCKED",
  source: sanitizeSource(baseUrl),
  auth: { mode: client.authMode, scopes: ["jobs:read", "target-readiness:read", "approval-gate:read", "artifact-analysis:read"] },
  steps: [],
  reads_only: true,
  write_operations_attempted: false,
  limitations: ["Read-only preflight; no bootstrap, resume, retry, cancel, rollback, release, path, or artifact-byte access."],
};
let currentStep = "health";

function sanitizeSource(value) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "withheld";
  }
}

function addStep(id, feature, payload, opaqueIds = [], limitations = []) {
  report.steps.push({
    id,
    status: "PASSED",
    feature,
    schema: payload.schema_version,
    observed_at: payload.observed_at || null,
    opaque_ids: opaqueIds.filter(Boolean),
    limitations: [...limitations],
  });
}

async function run() {
  currentStep = "health";
  const health = await client.health();
  assert.equal(health.status, "HEALTHY", `health status is ${health.status}`);
  addStep("health", null, { schema_version: "rolo-health/v1", observed_at: health.timestamp }, [], ["Health is service-level only."]);

  currentStep = "feature-negotiation";
  const requiredFeatures = [ROLO_API_FEATURES.jobReadModel, ROLO_API_FEATURES.targetReadiness, ROLO_API_FEATURES.approvalGateReadModel, ROLO_API_FEATURES.artifactAnalysisReadModel];
  const missingFeatures = requiredFeatures.filter((feature) => !health.api_features.includes(feature));
  assert.equal(missingFeatures.length, 0, `missing negotiated feature(s): ${missingFeatures.join(", ")}`);
  addStep("feature-negotiation", null, { schema_version: "rolo-health/v1", observed_at: health.timestamp }, requiredFeatures, ["Feature negotiation is producer-authored; it grants no write authority."]);

  currentStep = "target-readiness";
  const readiness = await client.targetReadiness(undefined, { limit: 100, offset: 0 });
  const target = requestedTargetId ? readiness.items.find((item) => item.target_id === requestedTargetId) : readiness.items[0];
  assert.ok(target, requestedTargetId ? `target ${requestedTargetId} was not returned by readiness` : "readiness returned no target");
  addStep("target-readiness", ROLO_API_FEATURES.targetReadiness, readiness, [target.target_id], [...readiness.limitations, ...target.limitations]);
  currentStep = "target-readiness-detail";
  const readinessDetail = await client.targetReadinessDetail(target.target_id);
  assert.equal(readinessDetail.target_id, target.target_id, "target readiness detail identity drifted");

  currentStep = "jobs";
  const jobs = await client.jobs(undefined, { limit: 100, offset: 0 });
  const selectedJob = requestedJobId ? jobs.items.find((item) => item.job_id === requestedJobId) : jobs.items[0];
  assert.ok(selectedJob, requestedJobId ? `job ${requestedJobId} was not returned by Job list` : "Job list returned no selectable Job");
  addStep("jobs", ROLO_API_FEATURES.jobReadModel, jobs, [selectedJob.job_id], ["Job payloads are bounded summaries only."]);
  currentStep = "job-detail-events";
  const recovery = await client.job(selectedJob.job_id);
  const events = await client.jobEvents(selectedJob.job_id, undefined, { limit: 100, offset: 0 });
  assert.equal(recovery.job.job_id, selectedJob.job_id, "Job detail identity drifted");
  assert.equal(events.job_id, selectedJob.job_id, "Job event identity drifted");
  report.steps.at(-1).detail = { schema: recovery.job.schema_version, events_schema: events.schema_version, event_count: events.items.length };

  currentStep = "approval-gate";
  const gates = await client.approvalGates(undefined, { limit: 100, offset: 0 });
  const gate = gates.items.find((item) => item.job_id === selectedJob.job_id && item.target_id === target.target_id) || gates.items.find((item) => item.job_id === selectedJob.job_id) || gates.items[0];
  assert.ok(gate, "approval-gate list returned no selectable Gate");
  assert.equal(gate.job_id, selectedJob.job_id, "Gate does not bind to selected Job");
  addStep("approval-gate", ROLO_API_FEATURES.approvalGateReadModel, gates, [gate.job_id, gate.target_id], [...gates.limitations, ...gate.limitations]);
  currentStep = "approval-gate-detail";
  const gateDetail = await client.jobApprovalGate(selectedJob.job_id);
  assert.equal(gateDetail.job_id, selectedJob.job_id, "Gate detail identity drifted");

  currentStep = "artifact-analysis";
  const analysis = await client.targetArtifactAnalysis(target.target_id);
  assert.equal(analysis.target_id, target.target_id, "Artifact Analysis target identity drifted");
  addStep("artifact-analysis", ROLO_API_FEATURES.artifactAnalysisReadModel, analysis, [analysis.target_id, analysis.analysis_id, analysis.job_id], analysis.limitations);
  if (requestedJobId) {
    currentStep = "artifact-analysis-job";
    const jobAnalysis = await client.jobArtifactAnalysis(selectedJob.job_id);
    assert.equal(jobAnalysis.job_id, selectedJob.job_id, "Artifact Analysis Job identity drifted");
    report.steps.at(-1).job_detail = { schema: jobAnalysis.schema_version, job_id: jobAnalysis.job_id, analysis_id: jobAnalysis.analysis_id };
  }

  report.status = "PASSED";
}

try {
  await run();
} catch (error) {
  report.steps.push({ id: currentStep, status: "BLOCKED", feature: null, schema: null, observed_at: null, opaque_ids: [], limitations: [] });
  report.blocker = {
    message: error instanceof RoloApiError && error.authFailure
      ? `${error.message}${error.requiredScope ? `; required scope: ${error.requiredScope}` : ""}`
      : error instanceof Error ? error.message : "preflight failed",
    http_status: error instanceof RoloApiError ? error.status : null,
    auth_failure: error instanceof RoloApiError ? error.authFailure : null,
  };
}

console.log(JSON.stringify(report, null, 2));
if (report.status !== "PASSED") process.exitCode = 1;
