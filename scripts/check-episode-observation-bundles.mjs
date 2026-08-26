import assert from "node:assert/strict";

import { appendObservationBundlePage, validateCompleteObservationBundleHistory } from "../src/contracts/episodeObservation.ts";
import { RoloApiError, RoloClient, ROLO_API_FEATURES } from "../src/roloClient.ts";

const baseUrl = (process.env.ROLO_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const robotId = process.env.ROLO_ROBOT_ID || "mentorpi";
const episodeId = process.env.ROLO_EPISODE_ID || "ep-e22-observation";
const client = new RoloClient(baseUrl);

const health = await client.health();
for (const feature of [ROLO_API_FEATURES.episodeReadModel, ROLO_API_FEATURES.episodeObservationBundle]) {
  assert.ok(health.api_features.includes(feature), `rolo does not advertise ${feature}`);
}

const collection = await client.episodeCollection(robotId);
const summary = collection.items.find((item) => item.episode_id === episodeId);
if (!summary) throw new Error(`The isolated E22 Episode ${episodeId} is unavailable.`);
const detail = await client.episode(robotId, episodeId, undefined, summary.revision);
assert.equal(detail.revision, summary.revision);
assert.equal(detail.immutable, true);
assert.ok(detail.ended_at);

let timelineCursor;
let timelineEvents = [];
do {
  const page = await client.episodeTimelinePage(robotId, episodeId, detail.revision, undefined, { limit: 100, cursor: timelineCursor });
  timelineEvents.push(...page.items);
  timelineCursor = page.next_cursor || undefined;
} while (timelineCursor);

const evidenceIds = new Set(detail.evidence_ids);
detail.assets.forEach((asset) => asset.evidence_id && evidenceIds.add(asset.evidence_id));
detail.findings.forEach((finding) => {
  finding.supporting_evidence_ids.forEach((id) => evidenceIds.add(id));
  finding.contradicting_evidence_ids.forEach((id) => evidenceIds.add(id));
});
timelineEvents.forEach((event) => event.evidence_ids.forEach((id) => evidenceIds.add(id)));
const validation = {
  episodeDurationMs: Date.parse(detail.ended_at) - Date.parse(detail.started_at),
  assetIds: new Set(detail.assets.map((asset) => asset.asset_id)),
  evidenceIds,
};

let bundleCursor;
let bundles = [];
let pagesRead = 0;
do {
  const page = await client.episodeObservationBundlePage(
    robotId,
    episodeId,
    detail.revision,
    validation,
    undefined,
    { limit: 20, cursor: bundleCursor },
  );
  bundles = appendObservationBundlePage(bundles, page.items);
  bundleCursor = page.next_cursor || undefined;
  pagesRead += 1;
  assert.ok(pagesRead <= 5, "Observation Bundle history exceeded the consumer page budget");
} while (bundleCursor);
validateCompleteObservationBundleHistory(bundles);

assert.deepEqual(bundles.map((item) => item.sequence), [2, 1]);
assert.deepEqual(bundles.map((item) => item.status), ["UNAVAILABLE", "PARTIAL"]);
assert.ok(bundles.every((item) => item.influences_verification === false));
assert.ok(bundles.some((item) => item.sources.some((source) => source.availability === "MISSING")));
assert.ok(bundles.some((item) => item.sources.some((source) => source.availability === "REJECTED")));
assert.ok(bundles.every((item) => item.world_scope === "NONE"));

const encoded = JSON.stringify(bundles);
for (const unsafe of [
  "artifact://", "provider_identity", "topic_name", "device_path", "raw_context",
  "internal_metadata", "model_prompt", "renderer_config", "diagnosis-agent",
]) {
  assert.equal(encoded.includes(unsafe), false, `public bundle history leaked ${unsafe}`);
}

let invalidCursorStatus = null;
try {
  await client.episodeObservationBundlePage(
    robotId,
    episodeId,
    detail.revision,
    validation,
    undefined,
    { limit: 20, cursor: `epobcur_${"0".repeat(40)}` },
  );
} catch (error) {
  if (!(error instanceof RoloApiError)) throw error;
  invalidCursorStatus = error.status;
}
assert.equal(invalidCursorStatus, 422);

let missingRevisionStatus = null;
try {
  await client.episodeObservationBundlePage(robotId, episodeId, detail.revision + 999, validation);
} catch (error) {
  if (!(error instanceof RoloApiError)) throw error;
  missingRevisionStatus = error.status;
}
assert.equal(missingRevisionStatus, 409);

console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  robot_id: robotId,
  episode_id: episodeId,
  revision: detail.revision,
  pages_checked: pagesRead,
  bundle_sequences: bundles.map((item) => item.sequence),
  bundle_statuses: bundles.map((item) => item.status),
  source_availability: [...new Set(bundles.flatMap((item) => item.sources.map((source) => source.availability)))],
  exact_revision: true,
  parent_lineage_resolved: true,
  unsafe_internal_fields_exposed: false,
  influences_verification: false,
  invalid_cursor_status: invalidCursorStatus,
  missing_revision_status: missingRevisionStatus,
  media_delivery: false,
  persists_state: false,
  supports_write: false,
}, null, 2));
