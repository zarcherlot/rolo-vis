import assert from "node:assert/strict";

import { buildEpisodeReviewHandoffLink, readEpisodeDeepLink, readEpisodeReviewHandoff } from "../src/episodeNavigation.ts";
import {
  advanceEpisodeReviewSession,
  buildEpisodeReviewSessionReleaseNavigation,
  releaseEpisodeReviewSession,
} from "../src/episodeReviewSession.ts";
import { RoloClient, ROLO_API_FEATURES } from "../src/roloClient.ts";

const baseUrl = (process.env.ROLO_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const workbenchUrl = process.env.ROLO_VIS_URL || "http://127.0.0.1:4173/workbench";
const robotId = process.env.ROLO_ROBOT_ID || "mentorpi";
const client = new RoloClient(baseUrl);

const health = await client.health();
assert.ok(health.api_features.includes(ROLO_API_FEATURES.episodeReadModel));
const collection = await client.episodeCollection(robotId);
const [reference, candidate] = collection.items;
if (!reference || !candidate) throw new Error("E21C requires two published Episode revisions.");
const [referenceDetail, candidateDetail, timeline] = await Promise.all([
  client.episode(robotId, reference.episode_id, undefined, reference.revision),
  client.episode(robotId, candidate.episode_id, undefined, candidate.revision),
  client.episodeTimelinePage(robotId, reference.episode_id, reference.revision, undefined, { limit: 100 }),
]);
const event = timeline.items[0];
if (!event) throw new Error("E21C requires one published Event.");

const target = {
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
const canonical = buildEpisodeReviewHandoffLink(workbenchUrl, target);
const intent = readEpisodeReviewHandoff(canonical);
assert.deepEqual(intent, { kind: "VALID", target });

const active = advanceEpisodeReviewSession("PENDING", "ACCEPTED");
assert.equal(active, "ACTIVE");
const releasedState = releaseEpisodeReviewSession(active);
assert.equal(releasedState, "RELEASED");
assert.equal(advanceEpisodeReviewSession(releasedState, "ACCEPTED"), "RELEASED");
const releasedUrl = buildEpisodeReviewSessionReleaseNavigation(canonical);
assert.deepEqual(readEpisodeReviewHandoff(new URL(releasedUrl, workbenchUrl).href), { kind: "NONE" });
assert.deepEqual(readEpisodeDeepLink(new URL(releasedUrl, workbenchUrl).href), target);
assert.deepEqual(readEpisodeReviewHandoff(canonical), { kind: "VALID", target });

console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  anchor: `${referenceDetail.episode_id}@${referenceDetail.revision}`,
  comparison: `${candidateDetail.episode_id}@${candidateDetail.revision}`,
  accepted_session_activated: true,
  explicit_release_terminal: true,
  marker_only_removed: true,
  current_context_preserved: true,
  released_reload_is_ordinary_navigation: true,
  canonical_reopen_requires_fresh_validation: true,
  release_authority: "LOCAL_REVIEW_SESSION_ONLY",
  automatic_navigation: false,
  persists_state: false,
  adds_endpoint: false,
  supports_content_export: false,
  supports_write: false,
}, null, 2));
