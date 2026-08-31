import assert from "node:assert/strict";
import test from "node:test";

import { assertArtifactAnalysisBinding, parseArtifactAnalysisSummary } from "../src/contracts/artifactAnalysis.ts";
import { RoloContractError } from "../src/contracts/guards.ts";
import { REAL_DEVICE_ARTIFACT_ANALYSIS } from "../src/lerobotAnalysisData.ts";

function validPayload() {
  return {
    schema_version: "rolo-artifact-analysis-summary/v1",
    analysis_id: "analysis-1",
    target_id: "robot-1",
    robot_id: "robot-1",
    run_id: "run-1",
    discovery_id: "discovery-1",
    source_kind: "rolo_api",
    source_label: "Sanitized artifact summary",
    observed_at: "2026-08-30T00:00:00Z",
    freshness: "fresh",
    contains_secret_payloads: false,
    kind: "Artifact analysis",
    run_status: "COMPLETE",
    title: "Bounded analysis",
    description: "A safe summary.",
    gate_status: "PASSED",
    gate_label: "analysis gate",
    gate_tone: "green",
    release_status: "SHADOW_ONLY",
    release_label: "No release effect",
    release_tone: "amber",
    run_duration: "1m",
    event_count: 1,
    eligible_operation_count: 0,
    route_review_flags: "0 / 0",
    context_bars: [{ label: "Nodes", value: 1, display: "1 observed", tone: "blue" }],
    evidence_note: "Read-only summary.",
    operations: [{ name: "app.inspect", route: "observed route", route_status: "observed", checks: ["bounded"], contract: "DISCOVERED_UNVERIFIED" }],
    graph_nodes: [{ label: "target", state: "bound", tone: "green" }],
    stages: [{ label: "Analysis", status: "passed", timestamp: "00:00:00Z", detail: "Complete." }],
    findings: [{ tone: "blue", title: "Advisory", body: "No release effect." }],
    hashes: [["summary", "a1b2c3d4…e5f6a7b8"]],
    limitations: ["Read-only and advisory."],
  };
}

test("the real-device demo fixture is parsed through the artifact contract", () => {
  assert.equal(REAL_DEVICE_ARTIFACT_ANALYSIS.schemaVersion, "rolo-artifact-analysis-summary/v1");
  assert.equal(REAL_DEVICE_ARTIFACT_ANALYSIS.sourceKind, "demo_fixture");
  assert.equal(REAL_DEVICE_ARTIFACT_ANALYSIS.containsSecretPayloads, false);
  assert.match(REAL_DEVICE_ARTIFACT_ANALYSIS.sourceLabel, /Demo fixture/);
});

test("artifact analysis parser accepts bounded sanitized summaries", () => {
  const parsed = parseArtifactAnalysisSummary(validPayload());
  assert.equal(parsed.analysis_id, "analysis-1");
  assert.equal(parsed.operations[0].routeStatus, "observed");
  assert.equal(parsed.contains_secret_payloads, false);
});

test("artifact analysis preserves partial and stale states without readiness promotion", () => {
  const partial = parseArtifactAnalysisSummary({ ...validPayload(), freshness: "stale", run_status: "PARTIAL", gate_status: "BLOCKED" });
  assert.equal(partial.freshness, "stale");
  assert.equal(partial.run_status, "PARTIAL");
  assert.equal(partial.gate_status, "BLOCKED");
  assert.throws(() => assertArtifactAnalysisBinding(partial, { targetId: "other-target" }), RoloContractError);
  assert.throws(() => assertArtifactAnalysisBinding(partial, { jobId: "other-job" }), RoloContractError);
});

test("artifact analysis parser rejects unsafe references, oversized text, and secret flags", () => {
  assert.throws(() => parseArtifactAnalysisSummary({ ...validPayload(), evidence_note: "artifact://private/report.json" }), RoloContractError);
  assert.throws(() => parseArtifactAnalysisSummary({ ...validPayload(), title: "x".repeat(241) }), RoloContractError);
  assert.throws(() => parseArtifactAnalysisSummary({ ...validPayload(), contains_secret_payloads: true }), RoloContractError);
  assert.throws(() => parseArtifactAnalysisSummary({ ...validPayload(), run_id: "C:\\private\\run" }), RoloContractError);
});
