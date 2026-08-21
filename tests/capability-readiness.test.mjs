import assert from "node:assert/strict";
import test from "node:test";

import { capabilityReadinessSignals } from "../src/capabilityReadiness.ts";

function capability(overrides = {}) {
  return {
    integrity_status: "validated",
    applicability: "NOT_OBSERVED",
    registration: "NOT_REGISTERED",
    availability: "UNAVAILABLE",
    evidence_ids: [],
    last_verified_at: null,
    ...overrides,
  };
}

function binding(authority) {
  return { authority };
}

test("readiness signals preserve validated, available, and verified as different states", () => {
  const signals = capabilityReadinessSignals(capability({
    applicability: "APPLICABLE",
    registration: "BUILTIN",
    availability: "AVAILABLE",
  }), []);
  const byId = Object.fromEntries(signals.map((signal) => [signal.id, signal]));

  assert.equal(byId.contract.state, "partial");
  assert.equal(byId.applicability.state, "established");
  assert.equal(byId.registration.state, "established");
  assert.equal(byId.availability.state, "partial");
  assert.equal(byId.verification.state, "missing");
  assert.match(byId.availability.statement, /not reported as verified/);
});

test("declared binding remains partial and cannot establish runtime availability", () => {
  const bindingSignal = capabilityReadinessSignals(capability(), [binding("DECLARED")])
    .find((signal) => signal.id === "binding");

  assert.equal(bindingSignal.state, "partial");
  assert.match(bindingSignal.statement, /runtime availability is not established/);
});

test("gated binding still keeps task outcome evidence separate", () => {
  const bindingSignal = capabilityReadinessSignals(capability(), [binding("GATED")])
    .find((signal) => signal.id === "binding");

  assert.equal(bindingSignal.state, "established");
  assert.match(bindingSignal.statement, /not task outcome evidence/);
});
