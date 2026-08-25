import assert from "node:assert/strict";

import {
  buildEpisodeDeepLink,
  planWorkbenchNavigationReplay,
  readWorkbenchNavigationIntent,
  shouldRejectEpisodeNavigation,
} from "../src/episodeNavigation.ts";
import { RoloClient, ROLO_API_FEATURES } from "../src/roloClient.ts";

const baseUrl = (process.env.ROLO_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const robotId = process.env.ROLO_ROBOT_ID || "mentorpi";
const client = new RoloClient(baseUrl);

const health = await client.health();
if (!health.api_features.includes(ROLO_API_FEATURES.episodeReadModel)) {
  throw new Error(`rolo does not advertise ${ROLO_API_FEATURES.episodeReadModel}.`);
}
const collection = await client.episodeCollection(robotId);
const [reference, candidate] = collection.items;
if (!reference || !candidate) throw new Error("E16C requires two live published Episodes for history orientation replay.");

const referenceTarget = {
  robotId,
  episodeId: reference.episode_id,
  revision: reference.revision,
  eventId: null,
  findingId: null,
  assetId: null,
  compareEpisodeId: candidate.episode_id,
  compareRevision: candidate.revision,
  compareEvidenceId: null,
  cohortDays: 30,
};
const reorientedTarget = {
  ...referenceTarget,
  episodeId: candidate.episode_id,
  revision: candidate.revision,
  compareEpisodeId: reference.episode_id,
  compareRevision: reference.revision,
};
const referenceIntent = readWorkbenchNavigationIntent(buildEpisodeDeepLink("https://workbench.test/?theme=dark", referenceTarget));
const reorientedIntent = readWorkbenchNavigationIntent(buildEpisodeDeepLink("https://workbench.test/?theme=dark", reorientedTarget));
assert.equal(referenceIntent.kind, "EPISODE");
assert.equal(reorientedIntent.kind, "EPISODE");

const sameRobotReplay = planWorkbenchNavigationReplay(referenceIntent, robotId);
const forwardReplay = planWorkbenchNavigationReplay(reorientedIntent, robotId);
assert.equal(sameRobotReplay.reconnectRobotId, null);
assert.equal(forwardReplay.reconnectRobotId, null);
assert.equal(forwardReplay.episodeTarget?.episodeId, candidate.episode_id);
assert.equal(forwardReplay.episodeTarget?.compareEpisodeId, reference.episode_id);

const crossRobotReplay = planWorkbenchNavigationReplay(referenceIntent, "another-robot");
assert.equal(crossRobotReplay.reconnectRobotId, robotId);

const malformedReplay = planWorkbenchNavigationReplay(
  readWorkbenchNavigationIntent(`https://workbench.test/?view=episode&robot=${robotId}&episode=..%2Funsafe`),
  robotId,
);
const unsupportedReplay = planWorkbenchNavigationReplay(
  readWorkbenchNavigationIntent("https://workbench.test/?view=teleop"),
  robotId,
);
assert.deepEqual(malformedReplay, { view: "stack", episodeTarget: null, reconnectRobotId: null, normalizeToStack: true });
assert.deepEqual(unsupportedReplay, { view: "stack", episodeTarget: null, reconnectRobotId: null, normalizeToStack: true });

assert.equal(shouldRejectEpisodeNavigation("episode", false, false), false);
assert.equal(shouldRejectEpisodeNavigation("episode", false, true), true);
assert.equal(shouldRejectEpisodeNavigation("episode", true, true), false);

console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  live_pair: {
    reference: `${reference.episode_id}@${reference.revision}`,
    reoriented: `${candidate.episode_id}@${candidate.revision}`,
  },
  same_robot_bootstrap_repeated: false,
  cross_robot_reconnect_target: crossRobotReplay.reconnectRobotId,
  malformed_episode_normalized_to_stack: malformedReplay.normalizeToStack,
  unsupported_view_normalized_to_stack: unsupportedReplay.normalizeToStack,
  unsettled_feature_negotiation_deferred: !shouldRejectEpisodeNavigation("episode", false, false),
  settled_missing_feature_rejected: shouldRejectEpisodeNavigation("episode", false, true),
  navigation_authority: "NAVIGATION_REHYDRATION_ONLY",
  adds_endpoint: false,
  supports_write: false,
}, null, 2));
