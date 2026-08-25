import assert from "node:assert/strict";
import test from "node:test";

import { buildEpisodeDeepLink, readEpisodeDeepLink } from "../src/episodeNavigation.ts";
import { buildEpisodeRightContextHandoffTarget } from "../src/episodeRightContextHandoff.ts";

const side = (episodeId, revision) => ({
  robotId: "mentorpi",
  episodeId,
  revision,
  taskLabel: episodeId,
  operation: "nav.execute",
  testCaseId: "navigation-smoke",
});
const comparison = (leftEpisode = "ep-left", leftRevision = 1, rightEpisode = "ep-right", rightRevision = 2) => ({
  left: side(leftEpisode, leftRevision),
  right: side(rightEpisode, rightRevision),
});
const occurrence = (source, role, contextId) => ({
  source,
  role,
  contextId,
  label: contextId,
  offsetMs: 10,
  endOffsetMs: 10,
  lane: source === "TIMELINE" ? "OUTCOME" : null,
  authority: null,
  verification: null,
  availability: source === "ASSET" ? "MISSING" : null,
});
const detail = (episodeId = "ep-right", revision = 2) => ({
  robot_id: "mentorpi",
  episode_id: episodeId,
  revision,
  findings: [{
    finding_id: "finding-right",
    supporting_evidence_ids: ["ev-shared"],
    contradicting_evidence_ids: ["ev-contradict"],
  }],
  assets: [{ asset_id: "asset-right", evidence_id: "ev-asset" }],
});
const event = (episodeId = "ep-right", revision = 2, eventId = "event-right", evidenceId = "ev-shared") => ({
  robot_id: "mentorpi",
  episode_id: episodeId,
  revision,
  event_id: eventId,
  lane: "OUTCOME",
  evidence_ids: [evidenceId],
});
const context = (evidenceId, item) => ({
  authority: "REFERENCE_OCCURRENCE_ONLY",
  items: [{ evidenceId, left: { items: [] }, right: { items: [item] } }],
});

function targetFor(evidenceId, item, overrides = {}) {
  return buildEpisodeRightContextHandoffTarget({
    comparison: comparison(),
    evidenceContext: context(evidenceId, item),
    evidenceId,
    occurrence: item,
    rightDetail: detail(),
    rightEvents: [event()],
    cohortDays: 30,
    ...overrides,
  });
}

test("E15B reorients exact right Event, Finding, and Asset occurrences into one left anchor", () => {
  const eventTarget = targetFor("ev-shared", occurrence("TIMELINE", "REFERENCE", "event-right"));
  assert.deepEqual(eventTarget, {
    robotId: "mentorpi", episodeId: "ep-right", revision: 2,
    eventId: "event-right", findingId: null, assetId: null,
    compareEpisodeId: "ep-left", compareRevision: 1,
    compareEvidenceId: "ev-shared", cohortDays: 30,
  });

  const supporting = targetFor("ev-shared", occurrence("FINDING_SUPPORTING", "SUPPORTING", "finding-right"));
  assert.equal(supporting?.findingId, "finding-right");
  assert.equal(supporting?.eventId, null);
  assert.equal(supporting?.assetId, null);

  const contradicting = targetFor("ev-contradict", occurrence("FINDING_CONTRADICTING", "CONTRADICTING", "finding-right"));
  assert.equal(contradicting?.findingId, "finding-right");

  const assetTarget = targetFor("ev-asset", occurrence("ASSET", "REFERENCE", "asset-right"));
  assert.equal(assetTarget?.assetId, "asset-right");
  assert.equal(assetTarget?.eventId, null);
  assert.equal(assetTarget?.findingId, null);
});

test("E15B round-trips a same-Episode different-revision handoff without side query state", () => {
  const item = occurrence("TIMELINE", "REFERENCE", "event-right");
  const target = targetFor("ev-shared", item, {
    comparison: comparison("ep-shared", 1, "ep-shared", 2),
    rightDetail: detail("ep-shared", 2),
    rightEvents: [event("ep-shared", 2)],
  });
  assert.equal(target?.episodeId, "ep-shared");
  assert.equal(target?.revision, 2);
  assert.equal(target?.compareEpisodeId, "ep-shared");
  assert.equal(target?.compareRevision, 1);
  const link = buildEpisodeDeepLink("https://workbench.test/?theme=dark", target);
  assert.equal(new URL(`https://workbench.test${link}`).searchParams.has("side"), false);
  assert.deepEqual(readEpisodeDeepLink(`https://workbench.test${link}`), target);
});

test("E15B pair reorientation has a deterministic inverse", () => {
  const rightOccurrence = occurrence("TIMELINE", "REFERENCE", "event-right");
  const forward = targetFor("ev-shared", rightOccurrence);
  assert.equal(forward?.episodeId, "ep-right");
  assert.equal(forward?.compareEpisodeId, "ep-left");

  const leftOccurrence = occurrence("TIMELINE", "REFERENCE", "event-left");
  const inverse = buildEpisodeRightContextHandoffTarget({
    comparison: comparison("ep-right", 2, "ep-left", 1),
    evidenceContext: context("ev-shared", leftOccurrence),
    evidenceId: "ev-shared",
    occurrence: leftOccurrence,
    rightDetail: detail("ep-left", 1),
    rightEvents: [event("ep-left", 1, "event-left")],
    cohortDays: 30,
  });
  assert.equal(inverse?.episodeId, "ep-left");
  assert.equal(inverse?.revision, 1);
  assert.equal(inverse?.compareEpisodeId, "ep-right");
  assert.equal(inverse?.compareRevision, 2);
});

test("E15B rejects unsafe, detached, stale, role-mismatched, Episode-level, and identity-drifted handoffs", () => {
  const valid = occurrence("TIMELINE", "REFERENCE", "event-right");
  assert.equal(targetFor("../unsafe", valid), null);
  assert.equal(targetFor("ev-detached", valid), null);
  assert.equal(targetFor("ev-shared", { ...valid, contextId: "missing-event" }), null);
  assert.equal(targetFor("ev-shared", { ...valid, role: "SUPPORTING" }), null);
  assert.equal(targetFor("ev-shared", occurrence("EPISODE", "REFERENCE", "ep-right@2")), null);
  assert.equal(targetFor("ev-shared", valid, { rightDetail: detail("ep-drift", 2) }), null);
  assert.equal(targetFor("ev-shared", valid, { rightEvents: [event("ep-drift", 2)] }), null);
  assert.equal(targetFor("ev-shared", valid, { evidenceContext: context("ev-shared", occurrence("ASSET", "REFERENCE", "asset-right")) }), null);
});
