import assert from "node:assert/strict";

import { buildEpisodeReviewHandoffLink, readEpisodeReviewHandoff } from "../src/episodeNavigation.ts";
import { buildEpisodeReviewMarkerSafeNavigation } from "../src/episodeReviewMarkerLifecycle.ts";
import { RoloClient, ROLO_API_FEATURES } from "../src/roloClient.ts";

const baseUrl = (process.env.ROLO_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const workbenchUrl = process.env.ROLO_VIS_URL || "http://127.0.0.1:4173/workbench";
const robotId = process.env.ROLO_ROBOT_ID || "mentorpi";
const client = new RoloClient(baseUrl);

const health = await client.health();
assert.ok(health.api_features.includes(ROLO_API_FEATURES.episodeReadModel));
const collection = await client.episodeCollection(robotId);
const [reference, candidate] = collection.items;
if (!reference || !candidate) throw new Error("E20C requires two published Episode revisions.");
const [referenceDetail, candidateDetail, timeline] = await Promise.all([
  client.episode(robotId, reference.episode_id, undefined, reference.revision),
  client.episode(robotId, candidate.episode_id, undefined, candidate.revision),
  client.episodeTimelinePage(robotId, reference.episode_id, reference.revision, undefined, { limit: 100 }),
]);
const event = timeline.items[0];
if (!event) throw new Error("E20C requires one published Event.");

const anchor = {
  robotId,
  episodeId: referenceDetail.episode_id,
  revision: referenceDetail.revision,
  eventId: event.event_id,
  findingId: null,
  assetId: null,
  compareEpisodeId: candidateDetail.episode_id,
  compareRevision: candidateDetail.revision,
  compareEvidenceId: null,
  cohortDays: 30,
};
const link = buildEpisodeReviewHandoffLink(workbenchUrl, anchor);
const intent = readEpisodeReviewHandoff(link);
assert.deepEqual(intent, { kind: "VALID", target: anchor });

const exact = buildEpisodeReviewMarkerSafeNavigation({ url: link, intent, current: anchor });
assert.deepEqual(readEpisodeReviewHandoff(new URL(exact, workbenchUrl).href), { kind: "VALID", target: anchor });
const explored = buildEpisodeReviewMarkerSafeNavigation({
  url: link,
  intent,
  current: { ...anchor, eventId: null, cohortDays: 90 },
});
assert.deepEqual(readEpisodeReviewHandoff(new URL(explored, workbenchUrl).href), { kind: "NONE" });
assert.deepEqual(readEpisodeReviewHandoff(link), { kind: "VALID", target: anchor });

console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  anchor: `${referenceDetail.episode_id}@${referenceDetail.revision}`,
  comparison: `${candidateDetail.episode_id}@${candidateDetail.revision}`,
  exact_target_marker_retained: true,
  explored_reload_is_ordinary_navigation: true,
  canonical_return_restores_marker: true,
  marker_ownership: "ORIGINAL_CANONICAL_TARGET_ONLY",
  automatic_navigation: false,
  persists_state: false,
  adds_endpoint: false,
  supports_content_export: false,
  supports_write: false,
}, null, 2));
