import assert from "node:assert/strict";

import { buildEpisodePairComparison } from "../src/episodeComparison.ts";
import { buildEpisodeEvidenceReferenceContext } from "../src/episodeEvidenceContext.ts";
import { buildEpisodeReviewHandoffLink, readEpisodeReviewHandoff } from "../src/episodeNavigation.ts";
import { deriveEpisodeReviewAnchorContinuity } from "../src/episodeReviewAnchor.ts";
import { assessEpisodeReviewReceipt } from "../src/episodeReviewReceipt.ts";
import { RoloClient, ROLO_API_FEATURES } from "../src/roloClient.ts";

const baseUrl = (process.env.ROLO_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const workbenchUrl = process.env.ROLO_VIS_URL || "http://127.0.0.1:4173/workbench?theme=dark&token=withheld#drawer";
const robotId = process.env.ROLO_ROBOT_ID || "mentorpi";
const client = new RoloClient(baseUrl);

const health = await client.health();
assert.ok(health.api_features.includes(ROLO_API_FEATURES.episodeReadModel));
const collection = await client.episodeCollection(robotId);
const [reference, candidate] = collection.items;
if (!reference || !candidate) throw new Error("E19C requires two published Episode revisions.");
const [referenceDetail, candidateDetail, referenceTimeline, candidateTimeline] = await Promise.all([
  client.episode(robotId, reference.episode_id, undefined, reference.revision),
  client.episode(robotId, candidate.episode_id, undefined, candidate.revision),
  client.episodeTimelinePage(robotId, reference.episode_id, reference.revision, undefined, { limit: 100 }),
  client.episodeTimelinePage(robotId, candidate.episode_id, candidate.revision, undefined, { limit: 100 }),
]);
const comparison = buildEpisodePairComparison(referenceDetail, referenceTimeline.items, candidateDetail, candidateTimeline.items);
const evidenceContext = buildEpisodeEvidenceReferenceContext(comparison, referenceDetail, referenceTimeline.items, candidateDetail, candidateTimeline.items);
const selectedContext = evidenceContext.items.find((item) => item.left.visibleCount > 0 && item.right.visibleCount > 0) || evidenceContext.items[0];
const focusedEvent = selectedContext
  ? referenceTimeline.items.find((item) => item.evidence_ids.includes(selectedContext.evidenceId)) || referenceTimeline.items[0]
  : null;
if (!selectedContext || !focusedEvent) throw new Error("E19C requires one visible Event and Evidence context.");

const anchor = {
  robotId,
  episodeId: referenceDetail.episode_id,
  revision: referenceDetail.revision,
  eventId: focusedEvent.event_id,
  findingId: null,
  assetId: null,
  compareEpisodeId: candidateDetail.episode_id,
  compareRevision: candidateDetail.revision,
  compareEvidenceId: selectedContext.evidenceId,
  cohortDays: 30,
};
const link = buildEpisodeReviewHandoffLink(workbenchUrl, anchor);
const intent = readEpisodeReviewHandoff(link);
const receipt = assessEpisodeReviewReceipt({
  intent,
  robotId,
  detail: referenceDetail,
  events: referenceTimeline.items,
  detailLoading: false,
  detailError: "",
  comparison,
  evidenceContext,
  comparisonLoading: false,
  comparisonError: "",
});
assert.equal(receipt.status, "ACCEPTED");
const anchored = deriveEpisodeReviewAnchorContinuity({ intent, anchorAccepted: true, current: anchor, workbenchUrl: link });
assert.equal(anchored.status, "ANCHORED");
const current = { ...anchor, eventId: null, compareEvidenceId: null };
const exploring = deriveEpisodeReviewAnchorContinuity({ intent, anchorAccepted: true, current, workbenchUrl: `${link}&tracking=discarded#drawer` });
assert.equal(exploring.status, "EXPLORING");
assert.deepEqual(exploring.differences, ["Event focus", "Evidence context"]);
assert.deepEqual(readEpisodeReviewHandoff(exploring.returnLink), { kind: "VALID", target: anchor });
assert.deepEqual(deriveEpisodeReviewAnchorContinuity({ intent, anchorAccepted: false, current, workbenchUrl: link }), { status: "NONE" });

console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  anchor: `${referenceDetail.episode_id}@${referenceDetail.revision}`,
  comparison: `${candidateDetail.episode_id}@${candidateDetail.revision}`,
  accepted_anchor_established: true,
  local_exploration_distinguished: true,
  changed_fields: exploring.differences,
  canonical_return_round_trip: true,
  automatic_navigation: false,
  anchor_persisted: false,
  continuity_authority: "LOCAL_NAVIGATION_CONTINUITY_ONLY",
  adds_endpoint: false,
  supports_content_export: false,
  supports_write: false,
}, null, 2));
