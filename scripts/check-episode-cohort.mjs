import { buildEpisodeCohortReview } from "../src/episodeCohort.ts";
import { RoloClient, ROLO_API_FEATURES } from "../src/roloClient.ts";

const baseUrl = (process.env.ROLO_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const robotId = process.env.ROLO_ROBOT_ID || "mentorpi";
const requestedEpisodeId = process.env.ROLO_EPISODE_ID || "";

const client = new RoloClient(baseUrl);
const health = await client.health();
if (!health.api_features.includes(ROLO_API_FEATURES.episodeCohortReadModel)) {
  throw new Error("rolo does not advertise the E8 cohort read-model feature.");
}

const collection = await client.episodeCollection(robotId);
const summary = requestedEpisodeId
  ? collection.items.find((item) => item.episode_id === requestedEpisodeId)
  : collection.items[0];
if (!summary) throw new Error(`No published Episode is available for ${robotId}.`);
const detail = await client.episode(robotId, summary.episode_id, undefined, summary.revision);

const windows = [];
for (const windowDays of [7, 30, 90]) {
  const cohort = await client.episodeCohort(
    robotId,
    detail.episode_id,
    detail.revision,
    undefined,
    { windowDays, limit: 100 },
  );
  const review = buildEpisodeCohortReview(cohort, detail);
  windows.push({
    window_days: windowDays,
    population_count: cohort.population_count,
    included_count: cohort.included_count,
    excluded_count: cohort.excluded_count,
    truncated_count: cohort.truncated_count,
    coverage: cohort.coverage,
    duration_median_ms: review.distributions.find((item) => item.metric === "duration_ms")?.median ?? null,
    authority: review.authority,
  });
}
const boundedPartial = await client.episodeCohort(
  robotId,
  detail.episode_id,
  detail.revision,
  undefined,
  { windowDays: 90, limit: 1 },
);
if (boundedPartial.coverage !== "BOUNDED_PARTIAL" || boundedPartial.truncated_count < 1) {
  throw new Error("Live E8 review requires a validated bounded-partial population.");
}

console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  robot_id: robotId,
  reference_episode_id: detail.episode_id,
  reference_revision: detail.revision,
  windows,
  bounded_partial: {
    limit: boundedPartial.limit,
    included_count: boundedPartial.included_count,
    truncated_count: boundedPartial.truncated_count,
    coverage: boundedPartial.coverage,
  },
  supports_verdict: false,
  supports_write: false,
}, null, 2));
