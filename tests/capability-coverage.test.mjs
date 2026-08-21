import assert from "node:assert/strict";
import test from "node:test";

import {
  capabilityCoveragePercent,
  summarizeCapabilityCoverage,
} from "../src/capabilityCoverage.ts";

function capability(overrides) {
  return {
    layer: "Hardware",
    lifecycle: "GATEABLE",
    applicability: "APPLICABLE",
    availability: "UNKNOWN",
    risk: "R0",
    binding_count: 0,
    ...overrides,
  };
}

test("capability coverage preserves trust states instead of merging them", () => {
  const coverage = summarizeCapabilityCoverage([
    capability({ availability: "VERIFIED", binding_count: 1, lifecycle: "RELEASED" }),
    capability({ availability: "AVAILABLE", risk: "R2" }),
    capability({ layer: "Linux", availability: "UNAVAILABLE", applicability: "NOT_OBSERVED" }),
    capability({ layer: "Application", availability: "UNKNOWN", applicability: "UNKNOWN" }),
  ]);

  assert.equal(coverage.total, 4);
  assert.deepEqual(coverage.availability, {
    VERIFIED: 1,
    AVAILABLE: 1,
    UNAVAILABLE: 1,
    UNKNOWN: 1,
  });
  assert.deepEqual(
    coverage.layers.find((item) => item.layer === "Hardware"),
    {
      layer: "Hardware",
      total: 2,
      applicable: 2,
      withBindings: 1,
      released: 1,
      elevatedRisk: 1,
      availability: { VERIFIED: 1, AVAILABLE: 1, UNAVAILABLE: 0, UNKNOWN: 0 },
    },
  );
});

test("coverage percentages are bounded for empty and populated layers", () => {
  assert.equal(capabilityCoveragePercent(0, 0), "0%");
  assert.equal(capabilityCoveragePercent(1, 4), "25%");
});
