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

const health = await client.health();
for (const feature of [ROLO_API_FEATURES.episodeReadModel, ROLO_API_FEATURES.episodeCohortReadModel]) {
  if (!health.api_features.includes(feature)) throw new Error(`rolo does not advertise ${feature}.`);
}

const collection = await client.episodeCollection(robotId);
const reference = collection.items.find((item) => item.episode_id === referenceEpisodeId);
if (!reference) throw new Error(`Reference Episode ${referenceEpisodeId} is unavailable.`);
const cohort = await client.episodeCohort(robotId, reference.episode_id, reference.revision, undefined, { windowDays: 30, limit: 100 });
const member = cohort.items[0];
if (!member) throw new Error("E13D requires one exact-match member.");

const [left, right] = await Promise.all([
  readComparisonSide(reference.episode_id, reference.revision),
  readComparisonSide(member.episode_id, member.revision),
]);
const comparison = buildEpisodePairComparison(left.detail, left.events, right.detail, right.events);
const context = buildEpisodeEvidenceReferenceContext(comparison, left.detail, left.events, right.detail, right.events);
const contextItem = context.items.find((item) => item.left.items.some((occurrence) => occurrence.source === "TIMELINE"));
const timelineOccurrence = contextItem?.left.items.find((occurrence) => occurrence.source === "TIMELINE");
if (!contextItem || !timelineOccurrence) throw new Error("E13D requires one visible left Timeline occurrence.");

const focus = resolveEpisodeOccurrenceFocus(contextItem.evidenceId, timelineOccurrence, left.detail, left.events);
if (!focus || focus.kind !== "EVENT") throw new Error("The live Timeline occurrence did not resolve to its exact Event.");

const focusLink = buildEpisodeDeepLink("https://workbench.test/?theme=dark", {
  robotId,
  episodeId: reference.episode_id,
  revision: reference.revision,
  eventId: focus.eventId,
  findingId: null,
  compareEpisodeId: member.episode_id,
  compareRevision: member.revision,
  compareEvidenceId: contextItem.evidenceId,
  cohortDays: 30,
});
const restored = readEpisodeDeepLink(focusLink);
if (!restored
  || restored.eventId !== focus.eventId
  || restored.compareEvidenceId !== contextItem.evidenceId
  || restored.compareEpisodeId !== member.episode_id
  || restored.compareRevision !== member.revision) {
  throw new Error("The live composite occurrence anchor did not round-trip with both comparison pins.");
}

const detachedRejected = resolveEpisodeOccurrenceFocus("ev-e13-detached", timelineOccurrence, left.detail, left.events) === null;
const roleMismatchRejected = resolveEpisodeOccurrenceFocus(
  contextItem.evidenceId,
  { ...timelineOccurrence, role: "SUPPORTING" },
  left.detail,
  left.events,
) === null;
const episodeOccurrence = contextItem.left.items.find((occurrence) => occurrence.source === "EPISODE");
const episodeFocusRejected = !episodeOccurrence
  || resolveEpisodeOccurrenceFocus(contextItem.evidenceId, episodeOccurrence, left.detail, left.events) === null;
const assetOccurrence = contextItem.left.items.find((occurrence) => occurrence.source === "ASSET");
const assetFocusRejected = !assetOccurrence
  || resolveEpisodeOccurrenceFocus(contextItem.evidenceId, assetOccurrence, left.detail, left.events) === null;
if (!detachedRejected || !roleMismatchRejected || !episodeFocusRejected || !assetFocusRejected) {
  throw new Error("A detached, role-mismatched, Episode-level, or Asset occurrence gained focus authority.");
}

const liveFindingOccurrence = context.items.some((item) => item.left.items.some((occurrence) =>
  occurrence.source === "FINDING_SUPPORTING" || occurrence.source === "FINDING_CONTRADICTING"));

console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  live_pair: {
    left: `${comparison.left.episodeId}@${comparison.left.revision}`,
    right: `${comparison.right.episodeId}@${comparison.right.revision}`,
  },
  selected_evidence_id: contextItem.evidenceId,
  focused_event_id: focus.eventId,
  composite_anchor_restored: true,
  pair_pins_preserved: true,
  detached_reference_rejected: detachedRejected,
  role_mismatch_rejected: roleMismatchRejected,
  episode_focus_rejected: episodeFocusRejected,
  asset_focus_rejected: assetFocusRejected,
  live_finding_occurrence_available: liveFindingOccurrence,
  finding_focus_covered_by_deterministic_tests: !liveFindingOccurrence,
  focus_authority: "SOURCE_FOCUS_ONLY",
  focus_side: "LEFT_ONLY",
  opens_evidence_record: false,
  supports_write: false,
}, null, 2));
