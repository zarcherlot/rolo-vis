import assert from "node:assert/strict";
import test from "node:test";

import { summarizeLifecycleAssessment } from "../src/lifecycleAssessment.ts";

test("lifecycle assessment matrix preserves stage facts without inventing run history", () => {
  const summary = summarizeLifecycleAssessment([
    { stage: "verify", status: "BLOCKED", summary: "", artifacts: 1, blockers: 1, optional: true, prerequisites: ["diagnose handoff"], agentRequirement: "verification_agent" },
    { stage: "adapt", status: "DEGRADED", summary: "", artifacts: 3, blockers: 1, optional: false, prerequisites: ["inputs"], agentRequirement: "adapter_agent" },
    { stage: "diagnose", status: "BLOCKED", summary: "", artifacts: 1, blockers: 1, optional: false, prerequisites: ["adapt handoff"], agentRequirement: "diagnosis_agent" },
  ], []);

  assert.equal(summary.stages, 3);
  assert.equal(summary.blocked, 2);
  assert.equal(summary.degraded, 1);
  assert.equal(summary.blockers, 3);
  assert.equal(summary.supportedRuns, 0);
  assert.deepEqual(summary.rows.map((row) => row.stage), ["adapt", "diagnose", "verify"]);
  assert.deepEqual(summary.rows.map((row) => row.supportedRuns), [0, 0, 0]);
});

test("supported immutable runs are counted only for their declared stage", () => {
  const summary = summarizeLifecycleAssessment([
    { stage: "adapt", status: "COMPLETE", summary: "", artifacts: 2, blockers: 0 },
    { stage: "diagnose", status: "READY", summary: "", artifacts: 1, blockers: 0 },
  ], [
    { stage: "adapt" },
    { stage: "adapt" },
    { stage: "diagnose" },
  ]);

  assert.equal(summary.readyOrComplete, 2);
  assert.equal(summary.supportedRuns, 3);
  assert.deepEqual(summary.rows.map((row) => row.supportedRuns), [2, 1]);
});
