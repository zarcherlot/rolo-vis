import assert from "node:assert/strict";
import test from "node:test";

import { filterSliceObservations, hasSliceDiagnostics } from "../src/sliceStability.ts";

function observation(runId, overrides = {}) {
  return {
    run_id: runId,
    decision_ref: `artifact://adapt/robot/runs/${runId}/slice-activation-decision.json`,
    mode: "CANARY",
    outcome: "ACTIVATED",
    selected: true,
    affects_agent_context: true,
    agent_run_status: "SUCCEEDED",
    gate_status: "PASSED",
    authoritative_operation_count: 10,
    requested_operation_count: 5,
    effective_operation_count: 5,
    potential_context_reduction_ratio: 0.5,
    effective_context_reduction_ratio: 0.5,
    prompt_token_estimate: 100,
    boot_context_token_estimate: 200,
    boot_context_budget_tokens: 500,
    context_budget_exceeded: false,
    alert_codes: [],
    fallback_reason: null,
    ...overrides,
  };
}

test("Slice diagnostics preserve independent failure, fallback, budget, and alert signals", () => {
  assert.equal(hasSliceDiagnostics(observation("clean")), false);
  assert.equal(hasSliceDiagnostics(observation("alert", { alert_codes: ["ELIGIBLE_NOT_IN_SLICE"] })), true);
  assert.equal(hasSliceDiagnostics(observation("gate", { gate_status: "FAILED" })), true);
  assert.equal(hasSliceDiagnostics(observation("budget", { context_budget_exceeded: true })), true);
  assert.equal(hasSliceDiagnostics(observation("fallback", { outcome: "FALLBACK", fallback_reason: "slice invalid" })), true);
});

test("Slice observation filters compose outcome and diagnostics without changing order", () => {
  const observations = [
    observation("run-3"),
    observation("run-2", { outcome: "FALLBACK", fallback_reason: "slice invalid" }),
    observation("run-1", { outcome: "SHADOW_ONLY", selected: false, affects_agent_context: false }),
  ];

  assert.deepEqual(
    filterSliceObservations(observations, { outcome: "ALL", diagnosticsOnly: true }).map((item) => item.run_id),
    ["run-2"],
  );
  assert.deepEqual(
    filterSliceObservations(observations, { outcome: "SHADOW_ONLY", diagnosticsOnly: false }).map((item) => item.run_id),
    ["run-1"],
  );
});
