import assert from "node:assert/strict";
import test from "node:test";

import { buildAdaptContextLens } from "../src/adaptContext.ts";

const SLICE = {
  schema_version: "robot-target-operation-slice/v1",
  robot_id: "AMR-07",
  discovery_id: "discovery-1",
  registry_sha256: "a".repeat(64),
  slice_sha256: "b".repeat(64),
  primary_operations: ["linux.service.inspect", "app.navigation.start"],
  dependency_operations: ["linux.service.inspect", "linux.log.query"],
  agent_native_operations: ["app.navigation.start", "app.navigation.start"],
  builtin_operations: [],
  target_adapter_operations: ["linux.service.inspect", "linux.log.query"],
  platform_specific_operations: [],
  deferred_summary: { TARGET_ROUTE_NOT_OBSERVED: 3, NO_PORTABLE_SEMANTICS: 1, EMPTY: 0 },
};

const GOVERNANCE = [{
  current_operation: "linux.service.inspect",
  current_layer: "linux",
  semantic_layer: "os",
  execution_class: "TARGET_ADAPTER",
  portable_semantics: true,
  future_capability: "os.workload.inspect",
  migration_status: "PLANNED",
  migration_reason: "Portable workload inspection is planned.",
  current_registry_action: "KEEP",
}];

test("Adapt context keeps execution class, workset role, and governance authority separate", () => {
  const lens = buildAdaptContextLens(SLICE, GOVERNANCE);

  assert.equal(lens.worksetCount, 3);
  assert.deepEqual(lens.executionCounts, {
    AGENT_NATIVE: 1,
    PRODUCT_BUILTIN: 0,
    TARGET_ADAPTER: 2,
    PLATFORM_SPECIFIC: 0,
  });
  assert.equal(lens.governedTargetCount, 1);
  assert.deepEqual(lens.targetOperations.map((item) => [item.operation, item.role]), [
    ["linux.log.query", "DEPENDENCY"],
    ["linux.service.inspect", "PRIMARY"],
  ]);
  assert.equal(lens.targetOperations[1].governance.future_capability, "os.workload.inspect");
});

test("Adapt context orders deferred reasons and excludes zero-count entries", () => {
  const lens = buildAdaptContextLens(SLICE, GOVERNANCE);

  assert.equal(lens.deferredCount, 4);
  assert.deepEqual(lens.deferred, [
    { reason: "TARGET_ROUTE_NOT_OBSERVED", count: 3 },
    { reason: "NO_PORTABLE_SEMANTICS", count: 1 },
  ]);
});
