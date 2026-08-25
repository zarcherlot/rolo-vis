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

function event(episodeId, sequence, authority = "DECLARED", evidenceIds = []) {
  return {
    robot_id: "mentorpi",
    episode_id: episodeId,
    revision: 1,
    event_id: `${episodeId}-event-${sequence}`,
    sequence,
    lane: sequence ? "OUTCOME" : "COMMAND",
    authority,
    severity: "INFO",
    evidence_ids: evidenceIds,
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
  assert.equal(result.schemaVersion, "rolo-vis-episode-pair-comparison/v2");
});

test("evidence trace preserves side, source lane, and first-reference order without authority promotion", () => {
  const left = detail("ep-left", {
    evidence_ids: ["shared-root", "left-root"],
    assets: [{ evidence_id: "asset-shared", availability: "AVAILABLE" }],
    findings: [{ kind: "CANDIDATE_CAUSE", supporting_evidence_ids: ["finding-shared"], contradicting_evidence_ids: ["left-contradiction"] }],
  });
  const right = detail("ep-right", {
    evidence_ids: ["shared-root", "right-root"],
    assets: [{ evidence_id: "asset-shared", availability: "AVAILABLE" }],
    findings: [{ kind: "OBSERVED_FACT", supporting_evidence_ids: ["right-finding"], contradicting_evidence_ids: ["finding-shared"] }],
  });
  const result = buildEpisodePairComparison(
    left,
    [event("ep-left", 0, "DECLARED", ["timeline-shared", "left-event"]), event("ep-left", 1, "OBSERVED", ["shared-root"])],
    right,
    [event("ep-right", 0, "DECLARED", ["timeline-shared", "right-event"]), event("ep-right", 1)],
  );

  assert.deepEqual(result.evidenceTrace.items.map((item) => item.evidenceId), [
    "shared-root", "left-root", "timeline-shared", "left-event", "finding-shared", "left-contradiction", "asset-shared", "right-root", "right-event", "right-finding",
  ]);
  assert.deepEqual(result.evidenceTrace.items.find((item) => item.evidenceId === "shared-root"), {
    evidenceId: "shared-root",
    relation: "SHARED",
    leftSources: ["EPISODE", "TIMELINE"],
    rightSources: ["EPISODE"],
  });
  assert.deepEqual(result.evidenceTrace.items.find((item) => item.evidenceId === "finding-shared"), {
    evidenceId: "finding-shared",
    relation: "SHARED",
    leftSources: ["FINDING_SUPPORTING"],
    rightSources: ["FINDING_CONTRADICTING"],
  });
  assert.deepEqual(result.evidenceTrace.items.find((item) => item.evidenceId === "left-root")?.relation, "LEFT_ONLY");
  assert.deepEqual(result.evidenceTrace.items.find((item) => item.evidenceId === "right-root")?.relation, "RIGHT_ONLY");
  assert.deepEqual({
    left: result.evidenceTrace.leftUniqueCount,
    right: result.evidenceTrace.rightUniqueCount,
    shared: result.evidenceTrace.sharedCount,
    leftOnly: result.evidenceTrace.leftOnlyCount,
    rightOnly: result.evidenceTrace.rightOnlyCount,
    total: result.evidenceTrace.totalUniqueCount,
  }, { left: 7, right: 7, shared: 4, leftOnly: 3, rightOnly: 3, total: 10 });
  assert.equal(result.evidenceTrace.authority, "REFERENCE_PRESENCE_ONLY");
  assert.equal(result.evidenceTrace.supportsEvidenceQuality, false);
  assert.equal(result.evidenceTrace.supportsVerification, false);
  assert.equal(result.evidenceTrace.supportsCausalAttribution, false);
});

test("evidence trace remains deterministically bounded and reports hidden references", () => {
  const evidenceIds = Array.from({ length: 105 }, (_, index) => `evidence-${String(index).padStart(3, "0")}`);
  const result = buildEpisodePairComparison(
    detail("ep-left", { event_count: 0, evidence_ids: evidenceIds }),
    [],
    detail("ep-right", { event_count: 0, evidence_ids: [] }),
    [],
  );
  assert.equal(result.evidenceTrace.visibleLimit, 100);
  assert.equal(result.evidenceTrace.visibleCount, 100);
  assert.equal(result.evidenceTrace.totalUniqueCount, 105);
  assert.equal(result.evidenceTrace.truncatedCount, 5);
  assert.equal(result.evidenceTrace.items.at(-1).evidenceId, "evidence-099");
  assert.ok(result.evidenceTrace.items.every((item) => item.relation === "LEFT_ONLY"));
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
  assert.equal(result.evidenceTrace.timelineCoverage.left, "BOUNDED_PARTIAL");
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
