import assert from "node:assert/strict";
import test from "node:test";

import { buildEpisodeDiagnosticFocus } from "../src/episodeDiagnosticFocus.ts";

function detail(overrides = {}) {
  return {
    robot_id: "mentorpi",
    episode_id: "ep-diagnostic",
    revision: 2,
    event_count: 3,
    assets: [{ asset_id: "asset-1", source_label: "Camera metadata", availability: "MISSING", evidence_id: null }],
    findings: [{
      finding_id: "finding-agent",
      kind: "CANDIDATE_CAUSE",
      authority: "INFERRED",
      verification: "UNVERIFIED",
      title: "Runtime visibility may be restricted",
      summary: "Sandbox isolation is one candidate explanation.",
      start_offset_ms: 1000,
      end_offset_ms: 2200,
      confidence: 0.6,
      supporting_evidence_ids: ["evidence-observation"],
      contradicting_evidence_ids: ["evidence-counter"],
      supporting_asset_ids: ["asset-1"],
      limitations: ["The explanation has not been verified."],
    }],
    ...overrides,
  };
}

function event(sequence, offsetMs, durationMs = null) {
  return {
    robot_id: "mentorpi",
    episode_id: "ep-diagnostic",
    revision: 2,
    event_id: `event-${sequence}`,
    sequence,
    offset_ms: offsetMs,
    duration_ms: durationMs,
    lane: sequence === 1 ? "AGENT" : "ALERT",
    authority: sequence === 1 ? "INFERRED" : "OBSERVED",
    severity: sequence === 2 ? "ERROR" : "WARNING",
    title: `Event ${sequence}`,
  };
}

test("diagnostic focus treats time-window events as context rather than causal evidence", () => {
  const result = buildEpisodeDiagnosticFocus(detail(), [event(0, 900, 200), event(1, 1600), event(2, 2300)], "finding-agent");
  assert.deepEqual(result.coincidentEvents.map((item) => item.eventId), ["event-0", "event-1"]);
  assert.equal(result.authority, "INFERRED");
  assert.equal(result.verification, "UNVERIFIED");
  assert.equal(result.supportsCausalAttribution, false);
  assert.equal(result.supportsRemediation, false);
  assert.match(result.limitations.join(" "), /do not establish evidentiary support or causation/);
});

test("diagnostic focus preserves supporting, contradicting, and missing-asset lanes", () => {
  const result = buildEpisodeDiagnosticFocus(detail(), [event(0, 900), event(1, 1600), event(2, 2300)], "finding-agent");
  assert.deepEqual(result.supportingEvidenceIds, ["evidence-observation"]);
  assert.deepEqual(result.contradictingEvidenceIds, ["evidence-counter"]);
  assert.deepEqual(result.supportingAssets, [{ assetId: "asset-1", sourceLabel: "Camera metadata", availability: "MISSING", evidenceId: null }]);
});

test("partial timeline coverage stays explicit without promoting Agent authority", () => {
  const result = buildEpisodeDiagnosticFocus(detail(), [event(0, 900)], "finding-agent");
  assert.equal(result.timelineCoverage, "BOUNDED_PARTIAL");
  assert.match(result.limitations.join(" "), /additional events may intersect/);
  assert.equal(result.supportsVerificationPromotion, false);
});

test("diagnostic focus fails closed on unsafe identity, order, count, asset, or candidate authority", () => {
  assert.throws(() => buildEpisodeDiagnosticFocus(detail(), [], "missing"), /unknown finding/);
  assert.throws(() => buildEpisodeDiagnosticFocus(detail(), [{ ...event(0, 0), revision: 3 }], "finding-agent"), /another identity or revision/);
  assert.throws(() => buildEpisodeDiagnosticFocus(detail(), [event(1, 1000), event(0, 1100)], "finding-agent"), /strictly sequence-ordered/);
  assert.throws(() => buildEpisodeDiagnosticFocus(detail({ event_count: 1 }), [event(0, 0), event(1, 1000)], "finding-agent"), /more events/);
  assert.throws(() => buildEpisodeDiagnosticFocus(detail({ event_count: 501 }), Array.from({ length: 501 }, (_, index) => event(index, index)), "finding-agent"), /500-event/);
  assert.throws(() => buildEpisodeDiagnosticFocus(detail({ assets: [] }), [], "finding-agent"), /unknown supporting asset/);
  assert.throws(() => buildEpisodeDiagnosticFocus(detail({ findings: [{ ...detail().findings[0], authority: "OBSERVED" }] }), [], "finding-agent"), /inferred and unverified/);
});
