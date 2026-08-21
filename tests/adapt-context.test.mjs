import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdaptContextLens,
  filterCapabilitiesToTargetAdapter,
  filterOperationGovernance,
  getAdaptOperationContext,
  paginateOperationGovernance,
  summarizeOperationGovernance,
} from "../src/adaptContext.ts";

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

test("operation context joins slice role without promoting governance to availability", () => {
  const context = getAdaptOperationContext("linux.service.inspect", SLICE, GOVERNANCE);

  assert.equal(context.inCurrentSlice, true);
  assert.equal(context.role, "PRIMARY");
  assert.equal(context.executionClass, "TARGET_ADAPTER");
  assert.equal(context.governance.future_capability, "os.workload.inspect");
  assert.equal(context.classificationConsistent, true);

  const outside = getAdaptOperationContext("linux.time.status", SLICE, GOVERNANCE);
  assert.equal(outside.inCurrentSlice, false);
  assert.equal(outside.role, null);
  assert.equal(outside.executionClass, null);
});

test("target adapter focus preserves registry order and never invents capabilities", () => {
  const capabilities = [
    { operation: "linux.log.query" },
    { operation: "linux.time.status" },
    { operation: "linux.service.inspect" },
  ];

  assert.deepEqual(
    filterCapabilitiesToTargetAdapter(capabilities, SLICE).map((item) => item.operation),
    ["linux.log.query", "linux.service.inspect"],
  );
  assert.equal(filterCapabilitiesToTargetAdapter(capabilities, null), capabilities);
});

const GOVERNANCE_LEDGER = [
  GOVERNANCE[0],
  {
    ...GOVERNANCE[0],
    current_operation: "ros.topic.inspect",
    current_layer: "ros",
    semantic_layer: "middleware",
    execution_class: "PLATFORM_SPECIFIC",
    future_capability: null,
    migration_status: "RETAINED",
    migration_reason: "Middleware-specific semantics remain explicit.",
  },
  {
    ...GOVERNANCE[0],
    current_operation: "app.navigation.start",
    current_layer: "app",
    semantic_layer: "application",
    execution_class: "AGENT_NATIVE",
    future_capability: "application.navigation.start",
    migration_status: "DEFERRED",
    migration_reason: "Waiting for product contract alignment.",
  },
];

test("governance filters combine search, semantic, execution, and migration constraints", () => {
  const result = filterOperationGovernance(GOVERNANCE_LEDGER, {
    query: "topic",
    semanticLayer: "middleware",
    executionClass: "PLATFORM_SPECIFIC",
    migrationStatus: "RETAINED",
  });

  assert.deepEqual(result.map((item) => item.current_operation), ["ros.topic.inspect"]);
  assert.equal(filterOperationGovernance(GOVERNANCE_LEDGER, {
    query: "product contract",
    semanticLayer: "ALL",
    executionClass: "ALL",
    migrationStatus: "ALL",
  })[0].current_operation, "app.navigation.start");
});

test("governance summary keeps execution, migration, and semantic dimensions separate", () => {
  const summary = summarizeOperationGovernance(GOVERNANCE_LEDGER);

  assert.equal(summary.total, 3);
  assert.equal(summary.mappedFutureCapabilities, 2);
  assert.equal(summary.executionClasses.TARGET_ADAPTER, 1);
  assert.equal(summary.executionClasses.PLATFORM_SPECIFIC, 1);
  assert.equal(summary.migrationStatuses.DEFERRED, 1);
  assert.equal(summary.semanticLayers.middleware, 1);
});

test("governance pagination never renders beyond the bounded page size", () => {
  const ledger = Array.from({ length: 45 }, (_, index) => ({
    ...GOVERNANCE[0],
    current_operation: `linux.operation.${index + 1}`,
  }));

  const middle = paginateOperationGovernance(ledger, 2);
  assert.equal(middle.items.length, 20);
  assert.deepEqual([middle.start, middle.end, middle.pageCount], [21, 40, 3]);

  const bounded = paginateOperationGovernance(ledger, 99);
  assert.equal(bounded.page, 3);
  assert.equal(bounded.items.length, 5);

  const empty = paginateOperationGovernance([], 1);
  assert.deepEqual([empty.start, empty.end, empty.pageCount], [0, 0, 1]);
});
