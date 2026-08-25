import assert from "node:assert/strict";
import test from "node:test";

import { buildEpisodePairComparison } from "../src/episodeComparison.ts";
import { buildEpisodeEvidenceReferenceContext } from "../src/episodeEvidenceContext.ts";

function finding(episodeId, supporting = [], contradicting = []) {
  return {
    episode_id: episodeId,
    finding_id: `${episodeId}-finding`,
    kind: "CANDIDATE_CAUSE",
    authority: "INFERRED",
    title: "Candidate diagnostic context",
    start_offset_ms: 10,
    end_offset_ms: 20,
    supporting_evidence_ids: supporting,
    contradicting_evidence_ids: contradicting,
    verification: "UNVERIFIED",
  };
}

function asset(episodeId, evidenceId) {
  return {
    episode_id: episodeId,
    asset_id: `${episodeId}-asset`,
    source_label: "Diagnostic capture",
    offset_ms: 15,
    evidence_id: evidenceId,
    availability: "AVAILABLE",
  };
}

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
    event_count: 0,
    finding_count: 0,
    asset_count: 0,
    evidence_ids: [],
    limitations: [],
    assets: [],
    findings: [],
    ...overrides,
  };
}

function event(episodeId, sequence, evidenceIds = []) {
  return {
    robot_id: "mentorpi",
    episode_id: episodeId,
    revision: 1,
    event_id: `${episodeId}-event-${sequence}`,
    sequence,
    offset_ms: sequence * 10,
    duration_ms: sequence === 0 ? null : 5,
    lane: sequence ? "OBSERVATION" : "COMMAND",
    authority: sequence ? "OBSERVED" : "DECLARED",
    severity: "INFO",
    title: `Event ${sequence}`,
    evidence_ids: evidenceIds,
  };
}

test("reference context preserves exact Episode, event, Finding, and Asset attachment points", () => {
  const evidenceId = "evidence-shared";
  const leftEvents = [event("ep-left", 0, [evidenceId])];
  const rightEvents = [];
  const left = detail("ep-left", {
    event_count: 1,
    finding_count: 1,
    asset_count: 1,
    evidence_ids: [evidenceId],
    findings: [finding("ep-left", [evidenceId], [evidenceId])],
    assets: [asset("ep-left", evidenceId)],
  });
  const right = detail("ep-right", { evidence_ids: [evidenceId] });
  const comparison = buildEpisodePairComparison(left, leftEvents, right, rightEvents);
  const context = buildEpisodeEvidenceReferenceContext(comparison, left, leftEvents, right, rightEvents);

  assert.equal(context.schemaVersion, "rolo-vis-episode-evidence-reference-context/v1");
  assert.equal(context.authority, "REFERENCE_OCCURRENCE_ONLY");
  assert.equal(context.items.length, 1);
  assert.deepEqual(context.items[0].left.items.map((item) => item.source), [
    "EPISODE", "TIMELINE", "FINDING_SUPPORTING", "FINDING_CONTRADICTING", "ASSET",
  ]);
  assert.deepEqual(context.items[0].left.items.map((item) => item.role), [
    "REFERENCE", "REFERENCE", "SUPPORTING", "CONTRADICTING", "REFERENCE",
  ]);
  assert.equal(context.items[0].left.items[1].contextId, "ep-left-event-0");
  assert.equal(context.items[0].left.items[2].authority, "INFERRED");
  assert.equal(context.items[0].left.items[4].availability, "AVAILABLE");
  assert.equal(context.items[0].right.totalCount, 1);
  assert.equal(context.supportsEvidenceContent, false);
  assert.equal(context.supportsSemanticEquivalence, false);
  assert.equal(context.supportsEvidenceQuality, false);
  assert.equal(context.supportsVerification, false);
  assert.equal(context.supportsCausalAttribution, false);
});

test("per-side occurrence projection stays bounded while retaining one visible item from every source lane", () => {
  const evidenceId = "evidence-dense";
  const leftEvents = Array.from({ length: 25 }, (_, index) => event("ep-left", index, [evidenceId]));
  const left = detail("ep-left", {
    event_count: leftEvents.length,
    finding_count: 1,
    asset_count: 1,
    evidence_ids: [evidenceId],
    findings: [finding("ep-left", [evidenceId], [evidenceId])],
    assets: [asset("ep-left", evidenceId)],
  });
  const right = detail("ep-right", { evidence_ids: [evidenceId] });
  const comparison = buildEpisodePairComparison(left, leftEvents, right, []);
  const context = buildEpisodeEvidenceReferenceContext(comparison, left, leftEvents, right, []);
  const lane = context.items[0].left;

  assert.equal(lane.totalCount, 29);
  assert.equal(lane.visibleCount, 20);
  assert.equal(lane.truncatedCount, 9);
  assert.equal(lane.visibleLimit, 20);
  assert.deepEqual(new Set(lane.items.map((item) => item.source)), new Set([
    "EPISODE", "TIMELINE", "FINDING_SUPPORTING", "FINDING_CONTRADICTING", "ASSET",
  ]));
});

test("reference context fails closed on identity drift or source disagreement", () => {
  const evidenceId = "evidence-safe";
  const left = detail("ep-left", { evidence_ids: [evidenceId] });
  const right = detail("ep-right", { evidence_ids: [evidenceId] });
  const comparison = buildEpisodePairComparison(left, [], right, []);
  assert.throws(
    () => buildEpisodeEvidenceReferenceContext(comparison, { ...left, revision: 2 }, [], right, []),
    /does not match the validated comparison identity/,
  );
  comparison.evidenceTrace.items[0].leftSources = ["TIMELINE"];
  assert.throws(
    () => buildEpisodeEvidenceReferenceContext(comparison, left, [], right, []),
    /sources do not match the validated trace/,
  );
});

