import assert from "node:assert/strict";
import test from "node:test";

import { bindingTrustStatement, summarizeBindingTrust } from "../src/bindingTrust.ts";

function binding(authority, overrides = {}) {
  return {
    authority,
    evidence_ids: [],
    limitations: [],
    ...overrides,
  };
}

test("binding trust summary keeps authority lanes and evidence coverage separate", () => {
  const summary = summarizeBindingTrust([
    binding("GATED", { evidence_ids: ["ev-1"] }),
    binding("OBSERVED", { limitations: ["publisher identity unavailable"] }),
    binding("DECLARED", { limitations: ["not observed", "schema unavailable"] }),
  ]);

  assert.deepEqual(summary, {
    total: 3,
    gated: 1,
    observed: 1,
    declared: 1,
    evidenceLinked: 1,
    limitations: 3,
  });
});

test("binding trust statements never promote a route to task success", () => {
  assert.match(bindingTrustStatement(binding("GATED")), /physical outcome.*separate evidence/);
  assert.match(bindingTrustStatement(binding("OBSERVED")), /no gated adapter release/);
  assert.match(bindingTrustStatement(binding("DECLARED")), /does not establish runtime availability/);
});
