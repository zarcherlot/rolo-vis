import { buildEpisodePairComparison } from "../src/episodeComparison.ts";
import {
  appendTimelineEvents,
  buildEpisodeDeepLink,
  EPISODE_TIMELINE_PAGE_LIMIT,
  EPISODE_VISIBLE_EVENT_LIMIT,
  readEpisodeDeepLink,
} from "../src/episodeNavigation.ts";
import { RoloClient, ROLO_API_FEATURES } from "../src/roloClient.ts";

const EPISODE_COMPARE_PAGE_BUDGET = 5;
const baseUrl = (process.env.ROLO_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const robotId = process.env.ROLO_ROBOT_ID || "mentorpi";
const requestedEpisodeId = process.env.ROLO_EPISODE_ID || "";
const windowDays = Number(process.env.ROLO_COHORT_DAYS || 30);
if (windowDays !== 7 && windowDays !== 30 && windowDays !== 90) {
  throw new Error("ROLO_COHORT_DAYS must be 7, 30, or 90.");
}

const client = new RoloClient(baseUrl);

async function readComparisonSide(episodeId, revision) {
  const detail = await client.episode(robotId, episodeId, undefined, revision);
  let events = [];
  let cursor;
  let pages = 0;
  do {
    if (pages >= EPISODE_COMPARE_PAGE_BUDGET) {
      throw new Error(`Episode ${episodeId} exceeds the comparison page budget.`);
    }
    const limit = Math.min(EPISODE_TIMELINE_PAGE_LIMIT, EPISODE_VISIBLE_EVENT_LIMIT - events.length);
    const page = await client.episodeTimelinePage(
      robotId,
      episodeId,
      revision,
      undefined,
      { limit, cursor },
    );
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

const boundedIndex = await client.episodeCollection(robotId, undefined, { limit: 1, offset: 0 });
const referenceSummary = requestedEpisodeId
  ? (await client.episodeCollection(robotId)).items.find((item) => item.episode_id === requestedEpisodeId)
  : boundedIndex.items[0];
if (!referenceSummary) throw new Error(`No reference Episode is available for ${robotId}.`);

const cohort = await client.episodeCohort(
  robotId,
  referenceSummary.episode_id,
  referenceSummary.revision,
  undefined,
  { windowDays, limit: 100 },
);
const member = cohort.items[0];
if (!member) throw new Error("E9D requires at least one exact-match cohort member.");
if (boundedIndex.items.some((item) => item.episode_id === member.episode_id)) {
  throw new Error("E9D requires the selected cohort member to be outside the bounded index page.");
}

const referenceIdentity = `${referenceSummary.episode_id}@@${referenceSummary.revision}`;
const [left, right] = await Promise.all([
  readComparisonSide(referenceSummary.episode_id, referenceSummary.revision),
  readComparisonSide(member.episode_id, member.revision),
]);
if (`${left.detail.episode_id}@@${left.detail.revision}` !== referenceIdentity) {
  throw new Error("The pinned cohort reference changed while reading the comparison member.");
}
const comparison = buildEpisodePairComparison(left.detail, left.events, right.detail, right.events);
if (comparison.left.episodeId !== referenceSummary.episode_id || comparison.left.revision !== referenceSummary.revision) {
  throw new Error("The comparison did not preserve the cohort reference on the left side.");
}
if (comparison.right.episodeId !== member.episode_id || comparison.right.revision !== member.revision) {
  throw new Error("The comparison did not pin the selected cohort member on the right side.");
}

const deepLink = buildEpisodeDeepLink("https://workbench.test/?theme=dark", {
  robotId,
  episodeId: referenceSummary.episode_id,
  revision: referenceSummary.revision,
  eventId: null,
  findingId: null,
  compareEpisodeId: member.episode_id,
  compareRevision: member.revision,
  cohortDays: windowDays,
});
const restored = readEpisodeDeepLink(deepLink);
if (!restored
  || restored.episodeId !== referenceSummary.episode_id
  || restored.revision !== referenceSummary.revision
  || restored.compareEpisodeId !== member.episode_id
  || restored.compareRevision !== member.revision
  || restored.cohortDays !== windowDays) {
  throw new Error("The cohort investigation deep link did not reproduce both pinned revisions and its window.");
}

let staleRevisionRejected = false;
try {
  await client.episode(robotId, member.episode_id, undefined, member.revision + 1);
} catch {
  staleRevisionRejected = true;
}
if (!staleRevisionRejected) throw new Error("The live producer accepted an unavailable comparison revision.");

console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  robot_id: robotId,
  reference: {
    episode_id: comparison.left.episodeId,
    revision: comparison.left.revision,
    events_checked: left.events.length,
    pages_checked: left.pages,
    remaining_cursor: left.remainingCursor,
  },
  member: {
    episode_id: comparison.right.episodeId,
    revision: comparison.right.revision,
    events_checked: right.events.length,
    pages_checked: right.pages,
    remaining_cursor: right.remainingCursor,
    outside_bounded_index: true,
  },
  cohort: {
    window_days: cohort.window_days,
    included_count: cohort.included_count,
    coverage: cohort.coverage,
  },
  comparison: {
    comparability: comparison.comparability,
    left_timeline_coverage: comparison.timelineCoverage.left,
    right_timeline_coverage: comparison.timelineCoverage.right,
    stale_revision_rejected: staleRevisionRejected,
  },
  deep_link: deepLink,
  reference_preserved: true,
  supports_outcome_verdict: comparison.supportsOutcomeVerdict,
  supports_causal_attribution: comparison.supportsCausalAttribution,
  supports_write: false,
}, null, 2));

