import assert from "node:assert/strict";
import test from "node:test";

import { buildEpisodePairComparison } from "../src/episodeComparison.ts";

function detail(episodeId, overrides = {}) {
  return {
    robot_id: "mentorpi",
    episode_id: episodeId,
    revision: 1,
    task_label: "Inspect ROS graph",
    operation: "ros.graph.inspect",
    test_case_id: "ros-graph-smoke",
    expected_behavior: "A bounded ROS graph summary is published.",
    immutable: true,
    state: "COMPLETED",
    outcome: "SUCCEEDED",
    verification: "UNVERIFIED",
    coverage: "COMPLETE",
    synchronization: "SYNCED",
    started_at: "2026-08-24T00:00:00Z",
    ended_at: "2026-08-24T00:00:02Z",
    event_count: 2,
    finding_count: 0,
    asset_count: 0,
    evidence_ids: ["evidence-outcome"],
    limitations: [],
    assets: [],
    findings: [],
    ...overrides,
  };
}

function event(episodeId, sequence, authority = "DECLARED") {
  return {
    robot_id: "mentorpi",
    episode_id: episodeId,
    revision: 1,
    event_id: `${episodeId}-event-${sequence}`,
    sequence,
    lane: sequence ? "OUTCOME" : "COMMAND",
    authority,
    severity: "INFO",
  };
}

test("pair comparison keeps numeric deltas neutral and outcome separate from verification", () => {
  const left = detail("ep-left");
  const right = detail("ep-right", { ended_at: "2026-08-24T00:00:03Z", verification: "VERIFIED" });
  const result = buildEpisodePairComparison(left, [event("ep-left", 0), event("ep-left", 1, "OBSERVED")], right, [event("ep-right", 0), event("ep-right", 1, "VERIFIED")]);
  assert.equal(result.comparability, "COMPARABLE");
  assert.equal(result.metrics.find((item) => item.key === "duration_ms").delta, 1000);
  assert.ok(result.metrics.every((item) => item.interpretation === "UNINTERPRETED_DELTA"));
  assert.deepEqual(result.outcome, { left: "SUCCEEDED", right: "SUCCEEDED" });
  assert.deepEqual(result.verification, { left: "UNVERIFIED", right: "VERIFIED" });
  assert.deepEqual(result.publication.left, { state: "COMPLETED", coverage: "COMPLETE", synchronization: "SYNCED", immutable: true });
  assert.equal(result.supportsOutcomeVerdict, false);
  assert.equal(result.supportsCausalAttribution, false);
});

test("mismatched semantic identity degrades to descriptive-only instead of inventing comparability", () => {
  const result = buildEpisodePairComparison(
    detail("ep-left"),
    [event("ep-left", 0), event("ep-left", 1)],
    detail("ep-right", { operation: "nav.execute", test_case_id: null }),
    [event("ep-right", 0), event("ep-right", 1)],
  );
  assert.equal(result.comparability, "DESCRIPTIVE_ONLY");
  assert.match(result.comparabilityReasons.join(" "), /operations do not match/);
  assert.match(result.comparabilityReasons.join(" "), /Test-case identities do not match/);
});

test("Agent inference distribution cannot promote outcome or verification", () => {
  const result = buildEpisodePairComparison(
    detail("ep-left"),
    [event("ep-left", 0), event("ep-left", 1, "INFERRED")],
    detail("ep-right"),
    [event("ep-right", 0), event("ep-right", 1, "INFERRED")],
  );
  assert.equal(result.authorities.left.INFERRED, 1);
  assert.equal(result.authorities.right.INFERRED, 1);
  assert.deepEqual(result.verification, { left: "UNVERIFIED", right: "UNVERIFIED" });
});

test("partial timeline coverage stays explicit and comparison inputs remain bounded", () => {
  const leftEvents = Array.from({ length: 500 }, (_, index) => event("ep-left", index));
  const result = buildEpisodePairComparison(detail("ep-left", { event_count: 600 }), leftEvents, detail("ep-right"), [event("ep-right", 0), event("ep-right", 1)]);
  assert.equal(result.timelineCoverage.left, "BOUNDED_PARTIAL");
  assert.match(result.limitations.join(" "), /partially loaded/);
  assert.throws(() => buildEpisodePairComparison(detail("ep-left", { event_count: 501 }), [...leftEvents, event("ep-left", 500)], detail("ep-right"), [event("ep-right", 0)]), /500-event/);
  assert.throws(() => buildEpisodePairComparison(detail("ep-left", { event_count: 1 }), [event("ep-left", 0), event("ep-left", 1)], detail("ep-right"), []), /more timeline events/);
});

test("cross-robot, identical, mixed-revision, and unordered inputs fail closed", () => {
  assert.throws(() => buildEpisodePairComparison(detail("ep-left"), [], detail("ep-right", { robot_id: "other" }), []), /one robot identity/);
  assert.throws(() => buildEpisodePairComparison(detail("ep-left"), [], detail("ep-left"), []), /distinct published revisions/);
  assert.throws(() => buildEpisodePairComparison(detail("ep-left"), [event("ep-left", 0)], detail("ep-right"), [{ ...event("ep-right", 0), revision: 2 }]), /another identity or revision/);
  assert.throws(() => buildEpisodePairComparison(detail("ep-left"), [event("ep-left", 1), event("ep-left", 0)], detail("ep-right"), []), /strictly sequence-ordered/);
});

test("the same Episode can be compared across two independently pinned revisions", () => {
  const left = detail("ep-left", { revision: 1 });
  const right = detail("ep-left", { revision: 2, ended_at: "2026-08-24T00:00:04Z" });
  const result = buildEpisodePairComparison(
    left,
    [event("ep-left", 0), event("ep-left", 1)],
    right,
    [{ ...event("ep-left", 0), revision: 2 }, { ...event("ep-left", 1), revision: 2 }],
  );
  assert.deepEqual([result.left.episodeId, result.left.revision, result.right.episodeId, result.right.revision], ["ep-left", 1, "ep-left", 2]);
  assert.equal(result.metrics.find((item) => item.key === "duration_ms").delta, 2000);
  assert.equal(result.metrics.find((item) => item.key === "duration_ms").interpretation, "UNINTERPRETED_DELTA");
});
