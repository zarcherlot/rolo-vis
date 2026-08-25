import assert from "node:assert/strict";

import { buildEpisodePairComparison } from "../src/episodeComparison.ts";
import { buildEpisodeEvidenceReferenceContext } from "../src/episodeEvidenceContext.ts";
import {
  buildEpisodeReviewHandoffLink,
  readEpisodeReviewHandoff,
  writeEpisodeReviewHandoffLink,
} from "../src/episodeNavigation.ts";
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
if (!reference || !candidate) throw new Error("E18C requires two published Episode revisions.");

const [referenceDetail, candidateDetail, referenceTimeline, candidateTimeline] = await Promise.all([
  client.episode(robotId, reference.episode_id, undefined, reference.revision),
  client.episode(robotId, candidate.episode_id, undefined, candidate.revision),
  client.episodeTimelinePage(robotId, reference.episode_id, reference.revision, undefined, { limit: 100 }),
  client.episodeTimelinePage(robotId, candidate.episode_id, candidate.revision, undefined, { limit: 100 }),
]);
assert.equal(referenceDetail.immutable, true);
assert.equal(candidateDetail.immutable, true);
const comparison = buildEpisodePairComparison(referenceDetail, referenceTimeline.items, candidateDetail, candidateTimeline.items);
const evidenceContext = buildEpisodeEvidenceReferenceContext(
  comparison,
  referenceDetail,
  referenceTimeline.items,
  candidateDetail,
  candidateTimeline.items,
);
const selectedContext = evidenceContext.items.find((item) => item.left.visibleCount > 0 && item.right.visibleCount > 0)
  || evidenceContext.items[0];
if (!selectedContext) throw new Error("E18C requires one visible Evidence context.");
const focusedEvent = referenceTimeline.items.find((item) => item.evidence_ids.includes(selectedContext.evidenceId))
  || referenceTimeline.items[0];
if (!focusedEvent) throw new Error("E18C requires one visible reference Event.");

const target = {
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
const link = buildEpisodeReviewHandoffLink(workbenchUrl, target);
const intent = readEpisodeReviewHandoff(link);
assert.deepEqual(intent, { kind: "VALID", target });
assert.doesNotMatch(link, /theme|token|withheld|drawer/);
assert.equal(assessEpisodeReviewReceipt({
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
}).status, "ACCEPTED");

for (const value of [`${link}&tracking=campaign`, `${link}#drawer`, link.replace("review_handoff=1", "review_handoff=yes")]) {
  assert.equal(readEpisodeReviewHandoff(value).kind, "INVALID");
}
assert.equal(assessEpisodeReviewReceipt({
  intent,
  robotId,
  detail: { ...referenceDetail, revision: referenceDetail.revision + 1 },
  events: referenceTimeline.items,
  detailLoading: false,
  detailError: "",
  comparison,
  evidenceContext,
  comparisonLoading: false,
  comparisonError: "",
}).status, "REJECTED");

let deniedClipboardValue = "";
await assert.rejects(() => writeEpisodeReviewHandoffLink({
  writeText: async (value) => {
    deniedClipboardValue = value;
    throw new Error("clipboard denied");
  },
}, workbenchUrl, target), /clipboard denied/);
assert.equal(deniedClipboardValue, link);

console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  reference: `${referenceDetail.episode_id}@${referenceDetail.revision}`,
  candidate: `${candidateDetail.episode_id}@${candidateDetail.revision}`,
  focused_event: focusedEvent.event_id,
  selected_evidence_context: selectedContext.evidenceId,
  canonical_receipt_round_trip: true,
  independent_publication_validation: true,
  stale_or_noncanonical_receipt_rejected: true,
  clipboard_denial_propagated: true,
  receipt_authority: "NAVIGATION_RESTORATION_RECEIPT_ONLY",
  authenticates_sender: false,
  adds_endpoint: false,
  supports_content_export: false,
  supports_write: false,
}, null, 2));
