import { buildEpisodePairComparison, EPISODE_COMPARISON_EVIDENCE_LIMIT } from "../src/episodeComparison.ts";
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
  return { detail, events, pages, remainingCursor: cursor || null };
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
if (!member) throw new Error("E10D requires one exact-match comparison member.");

const [left, right] = await Promise.all([
  readComparisonSide(reference.episode_id, reference.revision),
  readComparisonSide(member.episode_id, member.revision),
]);
const comparison = buildEpisodePairComparison(left.detail, left.events, right.detail, right.events);
const trace = comparison.evidenceTrace;

if (comparison.schemaVersion !== "rolo-vis-episode-pair-comparison/v2") throw new Error("E10D did not derive the reviewed comparison v2 model.");
if (trace.authority !== "REFERENCE_PRESENCE_ONLY") throw new Error("Evidence trace authority was promoted.");
if (trace.visibleLimit !== EPISODE_COMPARISON_EVIDENCE_LIMIT || trace.items.length > trace.visibleLimit) throw new Error("Evidence trace exceeded its visible limit.");
if (trace.totalUniqueCount < 1) throw new Error("The E10D fixture must contain at least one Evidence reference.");
if (trace.visibleCount + trace.truncatedCount !== trace.totalUniqueCount) throw new Error("Evidence trace truncation arithmetic is inconsistent.");
if (trace.leftOnlyCount + trace.sharedCount !== trace.leftUniqueCount || trace.rightOnlyCount + trace.sharedCount !== trace.rightUniqueCount) {
  throw new Error("Evidence trace side arithmetic is inconsistent.");
}
if (trace.supportsEvidenceQuality || trace.supportsVerification || trace.supportsCausalAttribution) throw new Error("Evidence reference presence gained unsupported authority.");
for (const item of trace.items) {
  if (item.relation === "SHARED" && (!item.leftSources.length || !item.rightSources.length)) throw new Error("A shared reference is missing one side.");
  if (item.relation === "LEFT_ONLY" && (!item.leftSources.length || item.rightSources.length)) throw new Error("A left-only reference has inconsistent sources.");
  if (item.relation === "RIGHT_ONLY" && (item.leftSources.length || !item.rightSources.length)) throw new Error("A right-only reference has inconsistent sources.");
}

let unresolvedReferenceRejected = false;
try {
  await client.evidence(trace.items[0].evidenceId);
} catch (error) {
  unresolvedReferenceRejected = error instanceof RoloApiError && error.status === 404;
}
if (!unresolvedReferenceRejected) throw new Error("The E10D fixture must prove that reference presence does not assert record availability.");

console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  robot_id: robotId,
  comparison: {
    schema_version: comparison.schemaVersion,
    left: `${comparison.left.episodeId}@${comparison.left.revision}`,
    right: `${comparison.right.episodeId}@${comparison.right.revision}`,
    left_pages: left.pages,
    right_pages: right.pages,
  },
  evidence_trace: {
    authority: trace.authority,
    total_unique_count: trace.totalUniqueCount,
    shared_count: trace.sharedCount,
    left_only_count: trace.leftOnlyCount,
    right_only_count: trace.rightOnlyCount,
    visible_count: trace.visibleCount,
    truncated_count: trace.truncatedCount,
    unresolved_reference_rejected: unresolvedReferenceRejected,
  },
  supports_evidence_quality: trace.supportsEvidenceQuality,
  supports_verification: trace.supportsVerification,
  supports_causal_attribution: trace.supportsCausalAttribution,
  supports_write: false,
}, null, 2));

