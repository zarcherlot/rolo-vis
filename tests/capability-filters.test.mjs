import assert from "node:assert/strict";
import test from "node:test";

import {
  activeGovernanceFilterCount,
  filterCapabilities,
} from "../src/capabilityFilters.ts";

const ALL = {
  query: "",
  layer: "ALL",
  availability: "ALL",
  risk: "ALL",
  access: "ALL",
  lifecycle: "ALL",
  classification: "ALL",
};

function capability(operation, overrides = {}) {
  return {
    operation,
    description: operation,
    layer: "Application",
    availability: "AVAILABLE",
    risk: "R0",
    access: "read",
    lifecycle: "RELEASED",
    data_classification: "INTERNAL",
    ...overrides,
  };
}

test("capability governance filters compose without merging independent dimensions", () => {
  const items = [
    capability("app.status"),
    capability("app.motion.start", { risk: "R3", access: "write", lifecycle: "GATEABLE", data_classification: "SENSITIVE" }),
    capability("linux.service.stop", { layer: "Linux", risk: "R2", access: "write", lifecycle: "GATEABLE" }),
  ];

  assert.deepEqual(
    filterCapabilities(items, { ...ALL, access: "write", lifecycle: "GATEABLE", classification: "SENSITIVE" }).map((item) => item.operation),
    ["app.motion.start"],
  );
  assert.equal(activeGovernanceFilterCount({ ...ALL, risk: "R3", access: "write" }), 2);
});

test("query, product layer, and availability remain compatible with governance filters", () => {
  const items = [
    capability("app.motion.start", { risk: "R3", access: "write" }),
    capability("app.motion.stop", { risk: "R3", access: "write", availability: "UNAVAILABLE" }),
  ];

  assert.deepEqual(
    filterCapabilities(items, { ...ALL, query: "stop", layer: "Application", availability: "UNAVAILABLE", risk: "R3" }).map((item) => item.operation),
    ["app.motion.stop"],
  );
});
