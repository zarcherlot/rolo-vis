import { buildEpisodePairComparison } from "../src/episodeComparison.ts";
import {
  buildEpisodeEvidenceReferenceContext,
  EPISODE_EVIDENCE_OCCURRENCE_LIMIT_PER_SIDE,
} from "../src/episodeEvidenceContext.ts";
import { appendTimelineEvents, EPISODE_TIMELINE_PAGE_LIMIT, EPISODE_VISIBLE_EVENT_LIMIT } from "../src/episodeNavigation.ts";
import { RoloApiError, RoloClient, ROLO_API_FEATURES } from "../src/roloClient.ts";

const EPISODE_COMPARE_PAGE_BUDGET = 5;
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

function assertNegativeAuthority(context) {
  for (const key of [
    "supportsEvidenceContent",
    "supportsSemanticEquivalence",
    "supportsEvidenceQuality",
    "supportsVerification",
    "supportsCausalAttribution",
  ]) {
    if (context[key] !== false) throw new Error(`Episode Evidence context promoted ${key}.`);
  }
}

function denseValidatedProjection(side, evidenceId) {
  const baseEvent = side.events[0];
  if (!baseEvent) throw new Error("E11D requires at least one parser-validated live Timeline Event.");
  const events = Array.from({ length: 25 }, (_, index) => ({
    ...baseEvent,
    event_id: `evt-e11-dense-${index + 1}`,
    sequence: index + 1,
    offset_ms: index * 10,
    occurred_at: new Date(Date.parse(baseEvent.occurred_at) + index * 10).toISOString(),
    evidence_ids: [evidenceId],
    asset_ids: [],
    related_event_ids: [],
  }));
  const assetId = "asset-e11-mixed-source";
  const detail = {
    ...side.detail,
    event_count: events.length,
    asset_count: 1,
    finding_count: 1,
    evidence_ids: [evidenceId],
    assets: [{
      schema_version: "rolo-episode-asset-summary/v1",
      robot_id: side.detail.robot_id,
      episode_id: side.detail.episode_id,
      revision: side.detail.revision,
      asset_id: assetId,
      modality: "diagnostic",
      source_label: "E11 mixed-source validation asset",
      captured_at: baseEvent.occurred_at,
      offset_ms: 5,
      world_kind: "REPLAYED",
      evidence_kind: "NORMALIZED",
      frame: null,
      clock_domain: baseEvent.clock_domain,
      synchronization: baseEvent.synchronization,
      media_type: "application/json",
      byte_count: null,
      digest: null,
      data_classification: "INTERNAL",
      evidence_id: evidenceId,
      availability: "MISSING",
      limitations: ["Controlled projection; no media or artifact access."],
    }],
    findings: [{
      schema_version: "rolo-episode-finding-summary/v1",
      robot_id: side.detail.robot_id,
      episode_id: side.detail.episode_id,
      revision: side.detail.revision,
      finding_id: "finding-e11-mixed-source",
      kind: "CANDIDATE_CAUSE",
      authority: "INFERRED",
      title: "E11 mixed-source validation finding",
      summary: "Exercises separate supporting and contradicting attachment roles.",
      start_offset_ms: 5,
      end_offset_ms: 15,
      supporting_evidence_ids: [evidenceId],
      supporting_asset_ids: [assetId],
      contradicting_evidence_ids: [evidenceId],
      confidence: 0.5,
      verification: "UNVERIFIED",
      limitations: ["Controlled projection; not a producer-authored causal conclusion."],
    }],
  };
  return { detail, events };
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
if (!member) throw new Error("E11D requires one exact-match comparison member.");

const [left, right] = await Promise.all([
  readComparisonSide(reference.episode_id, reference.revision),
  readComparisonSide(member.episode_id, member.revision),
]);
const liveComparison = buildEpisodePairComparison(left.detail, left.events, right.detail, right.events);
const liveContext = buildEpisodeEvidenceReferenceContext(liveComparison, left.detail, left.events, right.detail, right.events);
if (liveContext.schemaVersion !== "rolo-vis-episode-evidence-reference-context/v1") throw new Error("E11D did not derive the reviewed context model.");
if (liveContext.authority !== "REFERENCE_OCCURRENCE_ONLY") throw new Error("Episode Evidence context authority was promoted.");
if (liveContext.occurrenceLimitPerSide !== EPISODE_EVIDENCE_OCCURRENCE_LIMIT_PER_SIDE) throw new Error("Episode Evidence occurrence bound drifted.");
assertNegativeAuthority(liveContext);

const shared = liveComparison.evidenceTrace.items.find((item) => item.relation === "SHARED");
if (!shared) throw new Error("E11D requires one shared live Evidence reference.");
const liveItem = liveContext.items.find((item) => item.evidenceId === shared.evidenceId);
for (const side of [liveItem?.left, liveItem?.right]) {
  const sources = new Set(side?.items.map((item) => item.source));
  if (!sources.has("EPISODE") || !sources.has("TIMELINE")) throw new Error("Live context did not preserve Episode and Timeline occurrences.");
}

const denseLeft = denseValidatedProjection(left, shared.evidenceId);
const denseComparison = buildEpisodePairComparison(denseLeft.detail, denseLeft.events, right.detail, right.events);
const denseContext = buildEpisodeEvidenceReferenceContext(denseComparison, denseLeft.detail, denseLeft.events, right.detail, right.events);
const denseItem = denseContext.items.find((item) => item.evidenceId === shared.evidenceId);
if (!denseItem || denseItem.left.totalCount <= denseItem.left.visibleCount) throw new Error("Dense context did not exercise truncation.");
if (denseItem.left.visibleCount !== EPISODE_EVIDENCE_OCCURRENCE_LIMIT_PER_SIDE) throw new Error("Dense context did not enforce the occurrence limit.");
const denseSources = new Set(denseItem.left.items.map((item) => item.source));
for (const source of ["EPISODE", "TIMELINE", "FINDING_SUPPORTING", "FINDING_CONTRADICTING", "ASSET"]) {
  if (!denseSources.has(source)) throw new Error(`Dense selection dropped the ${source} source lane.`);
}
assertNegativeAuthority(denseContext);

const partialEvents = denseLeft.events.slice(0, 1);
const partialComparison = buildEpisodePairComparison(denseLeft.detail, partialEvents, right.detail, right.events);
const partialContext = buildEpisodeEvidenceReferenceContext(partialComparison, denseLeft.detail, partialEvents, right.detail, right.events);
if (partialContext.timelineCoverage.left !== "BOUNDED_PARTIAL") throw new Error("Partial timeline coverage was promoted to complete.");
assertNegativeAuthority(partialContext);

let unresolvedReferenceRejected = false;
try {
  await client.evidence(shared.evidenceId);
} catch (error) {
  unresolvedReferenceRejected = error instanceof RoloApiError && error.status === 404;
}
if (!unresolvedReferenceRejected) throw new Error("E11D must prove that occurrence context does not assert record availability.");

console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  live_pair: {
    left: `${liveComparison.left.episodeId}@${liveComparison.left.revision}`,
    right: `${liveComparison.right.episodeId}@${liveComparison.right.revision}`,
    evidence_id: shared.evidenceId,
    left_occurrences: liveItem.left.totalCount,
    right_occurrences: liveItem.right.totalCount,
  },
  controlled_stress_projection: {
    source: "parser-validated live public read models",
    total_occurrences: denseItem.left.totalCount,
    visible_occurrences: denseItem.left.visibleCount,
    truncated_occurrences: denseItem.left.truncatedCount,
    retained_sources: [...denseSources],
    partial_coverage: partialContext.timelineCoverage.left,
  },
  authority: liveContext.authority,
  unresolved_reference_rejected: unresolvedReferenceRejected,
  supports_evidence_content: liveContext.supportsEvidenceContent,
  supports_semantic_equivalence: liveContext.supportsSemanticEquivalence,
  supports_evidence_quality: liveContext.supportsEvidenceQuality,
  supports_verification: liveContext.supportsVerification,
  supports_causal_attribution: liveContext.supportsCausalAttribution,
  supports_write: false,
}, null, 2));
