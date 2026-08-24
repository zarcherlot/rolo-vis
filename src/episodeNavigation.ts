import type { EpisodeTimelineEvent, EpisodeTimelineLane } from "./types/rolo.ts";

export const EPISODE_TIMELINE_PAGE_LIMIT = 100;
export const EPISODE_VISIBLE_EVENT_LIMIT = 500;
export const EPISODE_TIMELINE_PROJECTION_BUDGET_MS = 25;

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const NAV_KEYS = ["view", "robot", "episode", "revision", "event", "compare", "compare_revision"] as const;

export interface EpisodeDeepLinkTarget {
  robotId: string;
  episodeId: string;
  revision: number | null;
  eventId: string | null;
  compareEpisodeId: string | null;
  compareRevision: number | null;
}

export function readEpisodeDeepLink(url: string): EpisodeDeepLinkTarget | null {
  const parsed = new URL(url, "http://rolo-vis.local");
  if (parsed.searchParams.get("view") !== "episode") return null;
  const robotId = parsed.searchParams.get("robot") || "";
  const episodeId = parsed.searchParams.get("episode") || "";
  const revisionValue = parsed.searchParams.get("revision");
  const eventId = parsed.searchParams.get("event");
  const compareEpisodeId = parsed.searchParams.get("compare");
  const compareRevisionValue = parsed.searchParams.get("compare_revision");
  if (!IDENTIFIER.test(robotId) || !IDENTIFIER.test(episodeId)) return null;
  const revision = revisionValue === null ? null : Number(revisionValue);
  if (revision !== null && (!Number.isInteger(revision) || revision < 1)) return null;
  if (eventId !== null && !IDENTIFIER.test(eventId)) return null;
  if ((compareEpisodeId === null) !== (compareRevisionValue === null)) return null;
  const compareRevision = compareRevisionValue === null ? null : Number(compareRevisionValue);
  if (compareEpisodeId !== null && !IDENTIFIER.test(compareEpisodeId)) return null;
  if (compareRevision !== null && (!Number.isInteger(compareRevision) || compareRevision < 1)) return null;
  if (compareEpisodeId === episodeId) return null;
  return { robotId, episodeId, revision, eventId, compareEpisodeId, compareRevision };
}

export function buildEpisodeDeepLink(url: string, target: EpisodeDeepLinkTarget): string {
  const parsed = new URL(url, "http://rolo-vis.local");
  parsed.searchParams.set("view", "episode");
  parsed.searchParams.set("robot", target.robotId);
  parsed.searchParams.set("episode", target.episodeId);
  if (target.revision === null) parsed.searchParams.delete("revision");
  else parsed.searchParams.set("revision", String(target.revision));
  if (target.eventId === null) parsed.searchParams.delete("event");
  else parsed.searchParams.set("event", target.eventId);
  if ((target.compareEpisodeId === null) !== (target.compareRevision === null)) throw new Error("Episode comparison deep links require both identity and revision.");
  if (target.compareEpisodeId === target.episodeId) throw new Error("Episode comparison deep links require two different Episode identities.");
  if (target.compareEpisodeId === null) {
    parsed.searchParams.delete("compare");
    parsed.searchParams.delete("compare_revision");
  } else {
    parsed.searchParams.set("compare", target.compareEpisodeId);
    parsed.searchParams.set("compare_revision", String(target.compareRevision));
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function buildWorkbenchViewLink(url: string, view: string): string {
  const parsed = new URL(url, "http://rolo-vis.local");
  for (const key of NAV_KEYS) parsed.searchParams.delete(key);
  if (view !== "stack") parsed.searchParams.set("view", view);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function appendTimelineEvents(
  current: EpisodeTimelineEvent[],
  incoming: EpisodeTimelineEvent[],
  limit = EPISODE_VISIBLE_EVENT_LIMIT,
): EpisodeTimelineEvent[] {
  const lastSequence = current.at(-1)?.sequence ?? -1;
  if (incoming.some((item, index) => item.sequence <= (index === 0 ? lastSequence : incoming[index - 1].sequence))) {
    throw new Error("Episode timeline pages overlap; the revision-pinned view was rejected.");
  }
  const ids = new Set(current.map((item) => item.event_id));
  if (incoming.some((item) => ids.has(item.event_id))) {
    throw new Error("Episode timeline pages repeat an event identity; the revision-pinned view was rejected.");
  }
  return [...current, ...incoming].slice(0, limit);
}

export function nextTimelineEventId(
  events: EpisodeTimelineEvent[],
  visibleLanes: Set<EpisodeTimelineLane>,
  selectedEventId: string,
  key: string,
): string | null {
  const visible = events.filter((event) => visibleLanes.has(event.lane));
  if (!visible.length) return null;
  const currentIndex = Math.max(0, visible.findIndex((event) => event.event_id === selectedEventId));
  if (key === "Home") return visible[0].event_id;
  if (key === "End") return visible.at(-1)?.event_id || null;
  if (key === "ArrowRight" || key === "ArrowDown") return visible[Math.min(visible.length - 1, currentIndex + 1)].event_id;
  if (key === "ArrowLeft" || key === "ArrowUp") return visible[Math.max(0, currentIndex - 1)].event_id;
  return null;
}

export function projectTimelineLayout(
  events: EpisodeTimelineEvent[],
  availableLanes: EpisodeTimelineLane[],
  visibleLanes: Set<EpisodeTimelineLane>,
) {
  const maxOffset = Math.max(1, ...events.map((event) => event.offset_ms + (event.duration_ms || 0)));
  const grouped = new Map<EpisodeTimelineLane, Array<{ event: EpisodeTimelineEvent; left: number; width: number }>>();
  for (const lane of availableLanes) if (visibleLanes.has(lane)) grouped.set(lane, []);
  for (const event of events) {
    const lane = grouped.get(event.lane);
    if (!lane) continue;
    lane.push({
      event,
      left: Math.min(98, Math.max(0, (event.offset_ms / maxOffset) * 100)),
      width: event.duration_ms ? Math.max(1.2, Math.min(18, (event.duration_ms / maxOffset) * 100)) : 1.2,
    });
  }
  return { maxOffset, lanes: [...grouped].map(([lane, items]) => ({ lane, items })) };
}
