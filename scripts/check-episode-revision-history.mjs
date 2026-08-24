import { parseEpisodeDetail, parseEpisodeRevisionCollection, parseEpisodeTimelinePage } from "../src/contracts/episode.ts";
import { buildEpisodePairComparison } from "../src/episodeComparison.ts";

const baseUrl = (process.env.ROLO_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const robotId = process.env.ROLO_ROBOT_ID || "mentorpi";
const requestedEpisodeId = process.env.ROLO_EPISODE_ID || "";

async function readJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} (${path})`);
  return response.json();
}

const health = await readJson("/health");
if (!health.api_features?.includes("workbench.episode-revision-history/v1")) throw new Error("rolo does not advertise the E7 revision-history feature.");

const collection = await readJson(`/v1/robots/${encodeURIComponent(robotId)}/episodes?limit=50&offset=0`);
const episodeId = requestedEpisodeId || collection.items?.[0]?.episode_id;
if (!episodeId) throw new Error(`No published Episode is available for ${robotId}.`);
const basePath = `/v1/robots/${encodeURIComponent(robotId)}/episodes/${encodeURIComponent(episodeId)}`;
const history = parseEpisodeRevisionCollection(
  await readJson(`${basePath}/revisions?limit=100&offset=0`),
  `${basePath}/revisions`, robotId, episodeId, { limit: 100, offset: 0 },
);
if (history.total < 2 || history.items.length < 2) throw new Error("Live E7 review requires at least two published revisions.");

async function readSide(revision) {
  const detail = parseEpisodeDetail(await readJson(`${basePath}?revision=${revision}`), basePath, robotId, episodeId, revision);
  const timelinePath = `${basePath}/timeline`;
  const page = parseEpisodeTimelinePage(
    await readJson(`${timelinePath}?revision=${revision}&limit=100`), timelinePath,
    { robotId, episodeId, revision }, { limit: 100 },
  );
  return { detail, events: page.items };
}

const [rightRevision, leftRevision] = history.items.slice(0, 2).map((item) => item.revision);
const [left, right] = await Promise.all([readSide(leftRevision), readSide(rightRevision)]);
const comparison = buildEpisodePairComparison(left.detail, left.events, right.detail, right.events);

console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  robot_id: robotId,
  episode_id: episodeId,
  revisions: [leftRevision, rightRevision],
  history_total: history.total,
  timeline_events_checked: [left.events.length, right.events.length],
  comparison_schema: comparison.schemaVersion,
  delta_interpretation: [...new Set(comparison.metrics.map((item) => item.interpretation))],
  supports_outcome_verdict: comparison.supportsOutcomeVerdict,
  supports_causal_attribution: comparison.supportsCausalAttribution,
}, null, 2));
