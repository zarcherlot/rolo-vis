import {
  parseEpisodeCollection,
  parseEpisodeDetail,
  parseEpisodeTimelinePage,
} from "../src/contracts/episode.ts";
import {
  appendTimelineEvents,
  EPISODE_TIMELINE_PAGE_LIMIT,
  EPISODE_VISIBLE_EVENT_LIMIT,
} from "../src/episodeNavigation.ts";

const baseUrl = (process.env.ROLO_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const robotId = process.env.ROLO_ROBOT_ID || "mentorpi";
const requestedEpisodeId = process.env.ROLO_EPISODE_ID || "";

async function readJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} (${path})`);
  return response.json();
}

const collectionPath = `/v1/robots/${encodeURIComponent(robotId)}/episodes`;
const collection = parseEpisodeCollection(
  await readJson(`${collectionPath}?limit=50&offset=0`),
  collectionPath,
  robotId,
  { limit: 50, offset: 0 },
);
const summary = requestedEpisodeId
  ? collection.items.find((item) => item.episode_id === requestedEpisodeId)
  : collection.items[0];
if (!summary) throw new Error(`No published Episode is available for ${robotId}.`);

const episodePath = `${collectionPath}/${encodeURIComponent(summary.episode_id)}`;
const detail = parseEpisodeDetail(await readJson(episodePath), episodePath, robotId, summary.episode_id);
if (detail.revision !== summary.revision) throw new Error("Collection and detail revisions do not match.");

let cursor;
let events = [];
do {
  const limit = Math.min(EPISODE_TIMELINE_PAGE_LIMIT, EPISODE_VISIBLE_EVENT_LIMIT - events.length);
  const query = new URLSearchParams({ revision: String(detail.revision), limit: String(limit) });
  if (cursor) query.set("cursor", cursor);
  const timelinePath = `${episodePath}/timeline`;
  const page = parseEpisodeTimelinePage(
    await readJson(`${timelinePath}?${query}`),
    timelinePath,
    { robotId, episodeId: detail.episode_id, revision: detail.revision },
    { limit, cursor },
  );
  events = appendTimelineEvents(events, page.items);
  cursor = page.next_cursor || undefined;
} while (cursor && events.length < EPISODE_VISIBLE_EVENT_LIMIT);

if (!events.length || events.length > detail.event_count) throw new Error("Timeline event counts are inconsistent.");

console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  robot_id: robotId,
  episode_id: detail.episode_id,
  revision: detail.revision,
  events_checked: events.length,
  event_count: detail.event_count,
  bounded_at: EPISODE_VISIBLE_EVENT_LIMIT,
  remaining_cursor: cursor || null,
  findings_checked: detail.findings.length,
  assets_checked: detail.assets.length,
}, null, 2));
