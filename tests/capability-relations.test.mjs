import assert from "node:assert/strict";
import test from "node:test";

import {
  capabilityFamily,
  capabilityRelations,
  groupCapabilitiesByFamily,
} from "../src/capabilityRelations.ts";

function capability(operation, overrides = {}) {
  return {
    operation,
    paired_operation: null,
    replacement_operation: null,
    compensation_operation: null,
    ...overrides,
  };
}

test("canonical operations group by namespace and object without inventing taxonomy", () => {
  const groups = groupCapabilitiesByFamily([
    capability("linux.service.stop"),
    capability("app.camera.stream.start"),
    capability("linux.service.start"),
  ]);

  assert.equal(capabilityFamily("app.camera.stream.start"), "app.camera");
  assert.deepEqual(groups.map((group) => group.family), ["app.camera", "linux.service"]);
  assert.deepEqual(
    groups[1].items.map((item) => item.operation),
    ["linux.service.start", "linux.service.stop"],
  );
});

test("operation relations preserve declared kinds and registry gaps", () => {
  const registry = [
    capability("app.camera.stream.start", {
      paired_operation: "app.camera.stream.stop",
      compensation_operation: "app.camera.reset",
    }),
    capability("app.camera.stream.stop"),
  ];

  assert.deepEqual(
    capabilityRelations(registry[0], registry).map((relation) => ({
      kind: relation.kind,
      operation: relation.operation,
      resolved: relation.capability?.operation || null,
    })),
    [
      { kind: "paired", operation: "app.camera.stream.stop", resolved: "app.camera.stream.stop" },
      { kind: "compensation", operation: "app.camera.reset", resolved: null },
    ],
  );
});
