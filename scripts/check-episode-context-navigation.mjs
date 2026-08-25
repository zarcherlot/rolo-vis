import { buildEpisodePairComparison } from "../src/episodeComparison.ts";
import { buildEpisodeEvidenceReferenceContext } from "../src/episodeEvidenceContext.ts";
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
const [member, alternateMember] = cohort.items;
if (!member || !alternateMember) throw new Error("E12D requires two exact-match members to validate pair-switch clearing.");

const [left, right] = await Promise.all([
  readComparisonSide(reference.episode_id, reference.revision),
  readComparisonSide(member.episode_id, member.revision),
]);
const comparison = buildEpisodePairComparison(left.detail, left.events, right.detail, right.events);
const context = buildEpisodeEvidenceReferenceContext(comparison, left.detail, left.events, right.detail, right.events);
const visibleItem = context.items[0];
if (!visibleItem) throw new Error("E12D requires one visible Evidence context row.");

const validLink = buildEpisodeDeepLink("https://workbench.test/?theme=dark", {
  robotId,
  episodeId: reference.episode_id,
  revision: reference.revision,
  eventId: null,
  findingId: null,
  compareEpisodeId: member.episode_id,
  compareRevision: member.revision,
  compareEvidenceId: visibleItem.evidenceId,
  cohortDays: 30,
});
const restored = readEpisodeDeepLink(validLink);
if (!restored || restored.compareEvidenceId !== visibleItem.evidenceId) throw new Error("A visible live Context selection did not round-trip.");
if (!context.items.some((item) => item.evidenceId === restored.compareEvidenceId)) throw new Error("The restored Context selection is not visible in the validated model.");

const staleEvidenceId = "ev-e12-stale";
const staleLink = buildEpisodeDeepLink(validLink, { ...restored, compareEvidenceId: staleEvidenceId });
const staleTarget = readEpisodeDeepLink(staleLink);
if (!staleTarget || staleTarget.compareEvidenceId !== staleEvidenceId) throw new Error("The syntactically valid stale selection did not reach derived validation.");
const validatedStaleSelection = context.items.some((item) => item.evidenceId === staleTarget.compareEvidenceId)
  ? staleTarget.compareEvidenceId
  : null;
const cleanedStaleLink = buildEpisodeDeepLink(staleLink, { ...staleTarget, compareEvidenceId: validatedStaleSelection });
if (new URL(cleanedStaleLink, "https://workbench.test").searchParams.has("compare_evidence")) throw new Error("A stale selection survived derived validation.");

const malformedRejected = readEpisodeDeepLink(
  `https://workbench.test/?view=episode&robot=${robotId}&episode=${reference.episode_id}&revision=${reference.revision}&compare=${member.episode_id}&compare_revision=${member.revision}&compare_evidence=..%2Funsafe`,
) === null;
const orphanRejected = readEpisodeDeepLink(
  `https://workbench.test/?view=episode&robot=${robotId}&episode=${reference.episode_id}&revision=${reference.revision}&compare_evidence=${visibleItem.evidenceId}`,
) === null;
if (!malformedRejected || !orphanRejected) throw new Error("Unsafe or comparison-free Context selection was accepted.");

const switchedLink = buildEpisodeDeepLink(validLink, {
  ...restored,
  compareEpisodeId: alternateMember.episode_id,
  compareRevision: alternateMember.revision,
  compareEvidenceId: null,
});
const switched = readEpisodeDeepLink(switchedLink);
if (!switched || switched.compareEpisodeId !== alternateMember.episode_id || switched.compareEvidenceId !== null) {
  throw new Error("Switching the pinned comparison side retained the previous Context selection.");
}

for (const key of [
  "supportsEvidenceContent",
  "supportsSemanticEquivalence",
  "supportsEvidenceQuality",
  "supportsVerification",
  "supportsCausalAttribution",
]) {
  if (context[key] !== false) throw new Error(`Context navigation promoted ${key}.`);
}

console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  live_pair: {
    left: `${comparison.left.episodeId}@${comparison.left.revision}`,
    right: `${comparison.right.episodeId}@${comparison.right.revision}`,
  },
  selected_evidence_id: visibleItem.evidenceId,
  valid_selection_restored: true,
  stale_selection_removed: validatedStaleSelection === null,
  malformed_selection_rejected: malformedRejected,
  orphan_selection_rejected: orphanRejected,
  pair_switch_selection_cleared: switched.compareEvidenceId === null,
  selection_authority: "CONTEXT_SELECTION_ONLY",
  reference_context_authority: context.authority,
  opens_evidence_record: false,
  supports_write: false,
}, null, 2));
