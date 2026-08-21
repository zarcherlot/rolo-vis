import assert from "node:assert/strict";
import test from "node:test";

import { projectContractSchema } from "../src/contractSchema.ts";

test("contract schema projection preserves required, unit, and constraint semantics", () => {
  const projection = projectContractSchema({
    type: "object",
    properties: {
      frame_id: { type: "string", enum: ["base_link", "odom"] },
      distance_m: { type: "number", minimum: 0.1, maximum: 10 },
      options: {
        type: "object",
        properties: { timeout_s: { type: "number" } },
        required: ["timeout_s"],
      },
    },
    required: ["frame_id", "distance_m"],
    additionalProperties: false,
  }, { distance_m: "m", timeout_s: "s" });

  assert.equal(projection.rootType, "object");
  assert.equal(projection.allowsAdditionalProperties, false);
  assert.deepEqual(projection.fields, [
    { path: "frame_id", depth: 0, type: "string", required: true, unit: null, description: null, constraints: ["enum: base_link, odom"] },
    { path: "distance_m", depth: 0, type: "number", required: true, unit: "m", description: null, constraints: ["min: 0.1", "max: 10"] },
    { path: "options", depth: 0, type: "object", required: false, unit: null, description: null, constraints: [] },
    { path: "options.timeout_s", depth: 1, type: "number", required: true, unit: "s", description: null, constraints: [] },
  ]);
});

test("contract schema projection describes array item types without treating examples as data", () => {
  const projection = projectContractSchema({
    type: "object",
    properties: {
      warnings: { type: "array", items: { type: "string" } },
    },
  });

  assert.equal(projection.fields[0].type, "array<string>");
  assert.equal(projection.truncated, false);
});
