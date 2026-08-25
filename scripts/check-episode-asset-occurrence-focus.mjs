import { buildEpisodePairComparison } from "../src/episodeComparison.ts";
import { buildEpisodeEvidenceReferenceContext } from "../src/episodeEvidenceContext.ts";
import {
  appendTimelineEvents,
  buildEpisodeDeepLink,
  EPISODE_TIMELINE_PAGE_LIMIT,
  EPISODE_VISIBLE_EVENT_LIMIT,
  readEpisodeDeepLink,
} from "../src/episodeNavigation.ts";
import { resolveEpisodeOccurrenceFocus } from "../src/episodeOccurrenceFocus.ts";
import { RoloClient, ROLO_API_FEATURES } from "../src/roloClient.ts";

const EPISODE_COMPARE_PAGE_BUDGET = 5;
const FORBIDDEN_ASSET_KEYS = new Set([
  "artifact_path",
  "content",
  "data",
  "download_url",
  "file_path",
  "payload",
  "raw_path",
  "storage_path",
  "uri",
  "url",
]);
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

function rejectUnsafeAssetMetadata(asset) {
  for (const key of Object.keys(asset)) {
    if (FORBIDDEN_ASSET_KEYS.has(key)) throw new Error(`The public Asset summary exposed forbidden field ${key}.`);
  }
}

const health = await client.health();
for (const feature of [ROLO_API_FEATURES.episodeReadModel, ROLO_API_FEATURES.episodeCohortReadModel]) {
  if (!health.api_features.includes(feature)) throw new Error(`rolo does not advertise ${feature}.`);
}

const collection = await client.episodeCollection(robotId);
const reference = collection.items.find((item) => item.episode_id === referenceEpisodeId);
if (!reference) throw new Error(`Reference Episode ${referenceEpisodeId} is unavailable.`);
const cohort = await client.episodeCohort(robotId, reference.episode_id, reference.revision, undefined, { windowDays: 30, limit: 100 });
const member = cohort.items[0];
if (!member) throw new Error("E14D requires one exact-match comparison member.");

const [left, right] = await Promise.all([
  readComparisonSide(reference.episode_id, reference.revision),
  readComparisonSide(member.episode_id, member.revision),
]);
const comparison = buildEpisodePairComparison(left.detail, left.events, right.detail, right.events);
const context = buildEpisodeEvidenceReferenceContext(comparison, left.detail, left.events, right.detail, right.events);
const contextItem = context.items.find((item) => item.left.items.some((occurrence) => occurrence.source === "ASSET"));
const assetOccurrence = contextItem?.left.items.find((occurrence) => occurrence.source === "ASSET");
if (!contextItem || !assetOccurrence) throw new Error("E14D requires one visible left Asset occurrence.");

const asset = left.detail.assets.find((item) => item.asset_id === assetOccurrence.contextId);
if (!asset || asset.evidence_id !== contextItem.evidenceId) {
  throw new Error("The live Asset occurrence is detached from its public Evidence reference.");
}
rejectUnsafeAssetMetadata(asset);

const focus = resolveEpisodeOccurrenceFocus(contextItem.evidenceId, assetOccurrence, left.detail, left.events);
if (!focus || focus.kind !== "ASSET" || focus.assetId !== asset.asset_id) {
  throw new Error("The live Asset occurrence did not resolve to its exact metadata card.");
}

const focusLink = buildEpisodeDeepLink("https://workbench.test/?theme=dark", {
  robotId,
  episodeId: reference.episode_id,
  revision: reference.revision,
  eventId: null,
  findingId: null,
  assetId: focus.assetId,
  compareEpisodeId: member.episode_id,
  compareRevision: member.revision,
  compareEvidenceId: contextItem.evidenceId,
  cohortDays: 30,
});
const restored = readEpisodeDeepLink(focusLink);
if (!restored
  || restored.assetId !== focus.assetId
  || restored.compareEvidenceId !== contextItem.evidenceId
  || restored.compareEpisodeId !== member.episode_id
  || restored.compareRevision !== member.revision) {
  throw new Error("The live Asset anchor did not round-trip with the selected Context and both comparison pins.");
}

const detachedRejected = resolveEpisodeOccurrenceFocus("ev-e14-detached", assetOccurrence, left.detail, left.events) === null;
const roleMismatchRejected = resolveEpisodeOccurrenceFocus(
  contextItem.evidenceId,
  { ...assetOccurrence, role: "SUPPORTING" },
  left.detail,
  left.events,
) === null;
const missingAssetRejected = resolveEpisodeOccurrenceFocus(
  contextItem.evidenceId,
  { ...assetOccurrence, contextId: "asset-e14-missing" },
  left.detail,
  left.events,
) === null;
const mismatchedDetail = {
  ...left.detail,
  assets: left.detail.assets.map((item) => item.asset_id === asset.asset_id ? { ...item, evidence_id: "ev-e14-detached" } : item),
};
const summaryMismatchRejected = resolveEpisodeOccurrenceFocus(
  contextItem.evidenceId,
  assetOccurrence,
  mismatchedDetail,
  left.events,
) === null;
if (!detachedRejected || !roleMismatchRejected || !missingAssetRejected || !summaryMismatchRejected) {
  throw new Error("A detached, role-mismatched, missing, or summary-mismatched Asset gained focus authority.");
}

console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  live_pair: {
    left: `${comparison.left.episodeId}@${comparison.left.revision}`,
    right: `${comparison.right.episodeId}@${comparison.right.revision}`,
  },
  selected_evidence_id: contextItem.evidenceId,
  focused_asset_id: focus.assetId,
  asset_availability: asset.availability,
  asset_media_type: asset.media_type,
  composite_anchor_restored: true,
  pair_pins_preserved: true,
  detached_reference_rejected: detachedRejected,
  role_mismatch_rejected: roleMismatchRejected,
  missing_asset_rejected: missingAssetRejected,
  summary_mismatch_rejected: summaryMismatchRejected,
  unsafe_asset_fields_rejected: true,
  focus_authority: "ASSET_METADATA_FOCUS_ONLY",
  focus_side: "LEFT_ONLY",
  opens_evidence_record: false,
  reads_asset_bytes: false,
  supports_write: false,
}, null, 2));
