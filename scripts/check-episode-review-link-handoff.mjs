import assert from "node:assert/strict";

import {
  buildEpisodeReviewLink,
  planWorkbenchNavigationReplay,
  readEpisodeDeepLink,
  readWorkbenchNavigationIntent,
  writeEpisodeReviewLink,
} from "../src/episodeNavigation.ts";
import { RoloClient, ROLO_API_FEATURES } from "../src/roloClient.ts";

const baseUrl = (process.env.ROLO_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const workbenchUrl = process.env.ROLO_VIS_URL || "http://127.0.0.1:4173/workbench?theme=dark&token=withheld#drawer";
const robotId = process.env.ROLO_ROBOT_ID || "mentorpi";
const client = new RoloClient(baseUrl);

const health = await client.health();
assert.ok(health.api_features.includes(ROLO_API_FEATURES.episodeReadModel));
const collection = await client.episodeCollection(robotId);
const [reference, candidate] = collection.items;
if (!reference || !candidate) throw new Error("E17C requires two published Episode revisions.");

const [referenceDetail, candidateDetail, referenceTimeline] = await Promise.all([
  client.episode(robotId, reference.episode_id, undefined, reference.revision),
  client.episode(robotId, candidate.episode_id, undefined, candidate.revision),
  client.episodeTimelinePage(robotId, reference.episode_id, reference.revision, undefined, { limit: 100 }),
]);
assert.equal(referenceDetail.immutable, true);
assert.equal(candidateDetail.immutable, true);
const focusedEvent = referenceTimeline.items.find((item) => item.evidence_ids.length > 0) || referenceTimeline.items[0];
if (!focusedEvent) throw new Error("E17C requires one visible reference timeline event.");
const sharedEvidenceId = referenceDetail.evidence_ids.find((id) => candidateDetail.evidence_ids.includes(id));
if (!sharedEvidenceId) throw new Error("E17C requires one shared public Evidence identifier.");

const simpleTarget = {
  robotId,
  episodeId: referenceDetail.episode_id,
  revision: referenceDetail.revision,
  eventId: focusedEvent.event_id,
  findingId: null,
  assetId: null,
  compareEpisodeId: null,
  compareRevision: null,
  compareEvidenceId: null,
  cohortDays: 30,
};
const simpleLink = buildEpisodeReviewLink(workbenchUrl, simpleTarget);
assert.deepEqual(readEpisodeDeepLink(simpleLink), simpleTarget);
assert.doesNotMatch(simpleLink, /theme|token|withheld|drawer/);

const comparisonTarget = {
  ...simpleTarget,
  compareEpisodeId: candidateDetail.episode_id,
  compareRevision: candidateDetail.revision,
  compareEvidenceId: sharedEvidenceId,
};
const comparisonLink = buildEpisodeReviewLink(workbenchUrl, comparisonTarget);
assert.deepEqual(readEpisodeDeepLink(comparisonLink), comparisonTarget);
const comparisonIntent = readWorkbenchNavigationIntent(comparisonLink);
assert.equal(comparisonIntent.kind, "EPISODE");
assert.equal(planWorkbenchNavigationReplay(comparisonIntent, robotId).reconnectRobotId, null);
assert.equal(planWorkbenchNavigationReplay(comparisonIntent, "another-robot").reconnectRobotId, robotId);

assert.throws(() => buildEpisodeReviewLink(workbenchUrl, { ...simpleTarget, revision: null }), /exact published revision/);
assert.throws(() => buildEpisodeReviewLink(workbenchUrl, { ...simpleTarget, eventId: "..\/unsafe" }), /strict canonical validation/);
assert.throws(() => buildEpisodeReviewLink("https://user:secret@workbench.test/", simpleTarget), /without embedded credentials/);
let deniedClipboardValue = "";
await assert.rejects(() => writeEpisodeReviewLink({
  writeText: async (value) => {
    deniedClipboardValue = value;
    throw new Error("clipboard denied");
  },
}, workbenchUrl, simpleTarget), /clipboard denied/);
assert.equal(deniedClipboardValue, simpleLink);

console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  reference: `${referenceDetail.episode_id}@${referenceDetail.revision}`,
  candidate: `${candidateDetail.episode_id}@${candidateDetail.revision}`,
  focused_event: focusedEvent.event_id,
  shared_evidence: sharedEvidenceId,
  simple_link_round_trip: true,
  comparison_link_round_trip: true,
  unrelated_state_stripped: true,
  cross_robot_reconnect_target: robotId,
  stale_or_malformed_state_rejected: true,
  clipboard_denial_propagated: true,
  navigation_authority: "READ_ONLY_REVIEW_HANDOFF_ONLY",
  adds_endpoint: false,
  supports_content_export: false,
  supports_write: false,
}, null, 2));
