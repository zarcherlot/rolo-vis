import assert from "node:assert/strict";

import { buildEpisodePairComparison } from "../src/episodeComparison.ts";
import { buildEpisodeEvidenceReferenceContext } from "../src/episodeEvidenceContext.ts";
import {
  appendTimelineEvents,
  buildEpisodeDeepLink,
  EPISODE_TIMELINE_PAGE_LIMIT,
  EPISODE_VISIBLE_EVENT_LIMIT,
  readEpisodeDeepLink,
} from "../src/episodeNavigation.ts";
import { buildEpisodeRightContextHandoffTarget } from "../src/episodeRightContextHandoff.ts";
import { RoloClient, ROLO_API_FEATURES } from "../src/roloClient.ts";

const EPISODE_COMPARE_PAGE_BUDGET = 5;
const ACTIONABLE_SOURCES = new Set(["TIMELINE", "FINDING_SUPPORTING", "FINDING_CONTRADICTING", "ASSET"]);
const baseUrl = (process.env.ROLO_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const robotId = process.env.ROLO_ROBOT_ID || "mentorpi";
const referenceEpisodeId = process.env.ROLO_EPISODE_ID || "ep-e9-reference";
const client = new RoloClient(baseUrl);

async function readComparisonSide(episodeId, revision) {
  const detail = await client.episode(robotId, episodeId, undefined, revision);
  let events = [];
  let cursor;
  let pages = 0;
  do {
    if (pages >= EPISODE_COMPARE_PAGE_BUDGET) throw new Error(`Episode ${episodeId} exceeds the comparison page budget.`);
    const limit = Math.min(EPISODE_TIMELINE_PAGE_LIMIT, EPISODE_VISIBLE_EVENT_LIMIT - events.length);
    const page = await client.episodeTimelinePage(robotId, episodeId, revision, undefined, { limit, cursor });
    events = appendTimelineEvents(events, page.items);
    cursor = page.next_cursor || undefined;
    pages += 1;
  } while (cursor && events.length < EPISODE_VISIBLE_EVENT_LIMIT);
  return { detail, events };
}

function selectedAnchorCount(target) {
  return [target.eventId, target.findingId, target.assetId].filter(Boolean).length;
}

function findRightAction(context, evidenceId) {
  const candidates = evidenceId
    ? context.items.filter((item) => item.evidenceId === evidenceId)
    : context.items;
  for (const item of candidates) {
    const occurrence = item.right.items.find((entry) => ACTIONABLE_SOURCES.has(entry.source));
    if (occurrence) return { evidenceId: item.evidenceId, occurrence };
  }
  return null;
}

const health = await client.health();
for (const feature of [ROLO_API_FEATURES.episodeReadModel, ROLO_API_FEATURES.episodeRevisionHistory, ROLO_API_FEATURES.episodeCohortReadModel]) {
  if (!health.api_features.includes(feature)) throw new Error(`rolo does not advertise ${feature}.`);
}

const collection = await client.episodeCollection(robotId);
const reference = collection.items.find((item) => item.episode_id === referenceEpisodeId);
if (!reference) throw new Error(`Reference Episode ${referenceEpisodeId} is unavailable.`);
const cohort = await client.episodeCohort(robotId, reference.episode_id, reference.revision, undefined, { windowDays: 30, limit: 100 });
const member = cohort.items[0];
if (!member) throw new Error("E15D requires one exact-match comparison member.");

const [left, right] = await Promise.all([
  readComparisonSide(reference.episode_id, reference.revision),
  readComparisonSide(member.episode_id, member.revision),
]);
const comparison = buildEpisodePairComparison(left.detail, left.events, right.detail, right.events);
const context = buildEpisodeEvidenceReferenceContext(comparison, left.detail, left.events, right.detail, right.events);
const forwardAction = findRightAction(context);
if (!forwardAction) throw new Error("E15D requires one visible actionable right occurrence.");

const forward = buildEpisodeRightContextHandoffTarget({
  comparison,
  evidenceContext: context,
  evidenceId: forwardAction.evidenceId,
  occurrence: forwardAction.occurrence,
  rightDetail: right.detail,
  rightEvents: right.events,
  cohortDays: 30,
});
assert.ok(forward, "the exact live right occurrence must derive a handoff target");
assert.equal(forward.episodeId, comparison.right.episodeId);
assert.equal(forward.revision, comparison.right.revision);
assert.equal(forward.compareEpisodeId, comparison.left.episodeId);
assert.equal(forward.compareRevision, comparison.left.revision);
assert.equal(forward.compareEvidenceId, forwardAction.evidenceId);
assert.equal(selectedAnchorCount(forward), 1);

const link = buildEpisodeDeepLink("https://workbench.test/?theme=dark", forward);
const linkUrl = new URL(link, "https://workbench.test");
assert.equal(linkUrl.searchParams.has("side"), false);
assert.equal(linkUrl.searchParams.get("theme"), "dark");
assert.deepEqual(readEpisodeDeepLink(linkUrl), forward);

const swappedComparison = buildEpisodePairComparison(right.detail, right.events, left.detail, left.events);
const swappedContext = buildEpisodeEvidenceReferenceContext(swappedComparison, right.detail, right.events, left.detail, left.events);
const inverseAction = findRightAction(swappedContext, forwardAction.evidenceId);
if (!inverseAction) throw new Error("E15D requires an exact inverse occurrence on the former reference.");
const inverse = buildEpisodeRightContextHandoffTarget({
  comparison: swappedComparison,
  evidenceContext: swappedContext,
  evidenceId: inverseAction.evidenceId,
  occurrence: inverseAction.occurrence,
  rightDetail: left.detail,
  rightEvents: left.events,
  cohortDays: 30,
});
assert.ok(inverse, "the former reference must derive the deterministic inverse orientation");
assert.equal(inverse.episodeId, comparison.left.episodeId);
assert.equal(inverse.revision, comparison.left.revision);
assert.equal(inverse.compareEpisodeId, comparison.right.episodeId);
assert.equal(inverse.compareRevision, comparison.right.revision);
assert.equal(inverse.compareEvidenceId, forwardAction.evidenceId);
assert.equal(selectedAnchorCount(inverse), 1);

const detachedRejected = buildEpisodeRightContextHandoffTarget({
  comparison,
  evidenceContext: context,
  evidenceId: forwardAction.evidenceId,
  occurrence: { ...forwardAction.occurrence, contextId: "detached-source" },
  rightDetail: right.detail,
  rightEvents: right.events,
  cohortDays: 30,
}) === null;
const roleMismatchRejected = buildEpisodeRightContextHandoffTarget({
  comparison,
  evidenceContext: context,
  evidenceId: forwardAction.evidenceId,
  occurrence: { ...forwardAction.occurrence, role: forwardAction.occurrence.role === "REFERENCE" ? "SUPPORTING" : "REFERENCE" },
  rightDetail: right.detail,
  rightEvents: right.events,
  cohortDays: 30,
}) === null;
const episodeAction = context.items.flatMap((item) => item.right.items.map((occurrence) => ({ evidenceId: item.evidenceId, occurrence }))).find((item) => item.occurrence.source === "EPISODE");
const episodeOccurrenceRejected = episodeAction ? buildEpisodeRightContextHandoffTarget({
  comparison,
  evidenceContext: context,
  evidenceId: episodeAction.evidenceId,
  occurrence: episodeAction.occurrence,
  rightDetail: right.detail,
  rightEvents: right.events,
  cohortDays: 30,
}) === null : false;
assert.equal(detachedRejected, true);
assert.equal(roleMismatchRejected, true);
assert.equal(episodeOccurrenceRejected, true);

console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  live_pair: {
    left: `${comparison.left.episodeId}@${comparison.left.revision}`,
    right: `${comparison.right.episodeId}@${comparison.right.revision}`,
  },
  selected_evidence_id: forwardAction.evidenceId,
  forward_source: forwardAction.occurrence.source,
  forward_orientation_swapped: true,
  inverse_orientation_restored: true,
  composite_anchor_round_trip: true,
  unrelated_query_preserved: true,
  side_parameter_added: false,
  detached_reference_rejected: detachedRejected,
  role_mismatch_rejected: roleMismatchRejected,
  episode_occurrence_rejected: episodeOccurrenceRejected,
  handoff_authority: "PAIR_ORIENTATION_HANDOFF_ONLY",
  opens_evidence_record: false,
  reads_asset_bytes: false,
  supports_write: false,
}, null, 2));
