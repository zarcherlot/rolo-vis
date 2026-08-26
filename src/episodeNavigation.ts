import type { EpisodeTimelineEvent, EpisodeTimelineLane } from "./types/rolo.ts";

export const EPISODE_TIMELINE_PAGE_LIMIT = 100;
export const EPISODE_VISIBLE_EVENT_LIMIT = 500;
export const EPISODE_TIMELINE_PROJECTION_BUDGET_MS = 25;

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const REVIEW_HANDOFF_KEY = "review_handoff";
const REVIEW_HANDOFF_VALUE = "1";
const NAV_KEYS = ["view", "robot", "episode", "revision", "event", "finding", "asset", "compare", "compare_revision", "compare_evidence", "cohort_days", REVIEW_HANDOFF_KEY] as const;

export const WORKBENCH_VIEW_IDS = ["fleet", "overview", "stack", "capabilities", "lifecycle", "deployment", "episode", "wiki", "evidence"] as const;
export type WorkbenchViewId = (typeof WORKBENCH_VIEW_IDS)[number];
export type WorkbenchNavigationIntent =
  | { kind: "EPISODE"; view: "episode"; target: EpisodeDeepLinkTarget }
  | { kind: "VIEW"; view: Exclude<WorkbenchViewId, "episode"> }
  | { kind: "INVALID"; view: "stack"; reason: "INVALID_EPISODE" | "UNSUPPORTED_VIEW" };

export interface WorkbenchNavigationReplay {
  view: WorkbenchViewId;
  episodeTarget: EpisodeDeepLinkTarget | null;
  reconnectRobotId: string | null;
  normalizeToStack: boolean;
}

export interface EpisodeDeepLinkTarget {
  robotId: string;
  episodeId: string;
  revision: number | null;
  eventId: string | null;
  findingId: string | null;
  assetId: string | null;
  compareEpisodeId: string | null;
  compareRevision: number | null;
  compareEvidenceId: string | null;
  cohortDays: 7 | 30 | 90 | null;
}

export type EpisodeReviewHandoffIntent =
  | { kind: "NONE" }
  | { kind: "VALID"; target: EpisodeDeepLinkTarget }
  | { kind: "INVALID"; reason: "NON_CANONICAL_REVIEW_HANDOFF" };

export function isEpisodeIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

export function readEpisodeDeepLink(url: string): EpisodeDeepLinkTarget | null {
  const parsed = new URL(url, "http://rolo-vis.local");
  if (parsed.searchParams.get("view") !== "episode") return null;
  const robotId = parsed.searchParams.get("robot") || "";
  const episodeId = parsed.searchParams.get("episode") || "";
  const revisionValue = parsed.searchParams.get("revision");
  const eventId = parsed.searchParams.get("event");
  const findingId = parsed.searchParams.get("finding");
  const assetId = parsed.searchParams.get("asset");
  const compareEpisodeId = parsed.searchParams.get("compare");
  const compareRevisionValue = parsed.searchParams.get("compare_revision");
  const compareEvidenceId = parsed.searchParams.get("compare_evidence");
  const cohortDaysValue = parsed.searchParams.get("cohort_days");
  if (!IDENTIFIER.test(robotId) || !IDENTIFIER.test(episodeId)) return null;
  const revision = revisionValue === null ? null : Number(revisionValue);
  if (revision !== null && (!Number.isInteger(revision) || revision < 1)) return null;
  if (eventId !== null && !IDENTIFIER.test(eventId)) return null;
  if (findingId !== null && !IDENTIFIER.test(findingId)) return null;
  if ((compareEpisodeId === null) !== (compareRevisionValue === null)) return null;
  const compareRevision = compareRevisionValue === null ? null : Number(compareRevisionValue);
  if (compareEpisodeId !== null && !IDENTIFIER.test(compareEpisodeId)) return null;
  if (compareRevision !== null && (!Number.isInteger(compareRevision) || compareRevision < 1)) return null;
  if (compareEvidenceId !== null && (!IDENTIFIER.test(compareEvidenceId) || compareEpisodeId === null)) return null;
  if (assetId !== null && (!IDENTIFIER.test(assetId) || compareEvidenceId === null)) return null;
  if (compareEpisodeId === episodeId && (revision === null || compareRevision === revision)) return null;
  const cohortDays = cohortDaysValue === null ? null : Number(cohortDaysValue);
  if (cohortDays !== null && cohortDays !== 7 && cohortDays !== 30 && cohortDays !== 90) return null;
  return { robotId, episodeId, revision, eventId, findingId, assetId, compareEpisodeId, compareRevision, compareEvidenceId, cohortDays };
}

export function readWorkbenchNavigationIntent(url: string): WorkbenchNavigationIntent {
  const parsed = new URL(url, "http://rolo-vis.local");
  const view = parsed.searchParams.get("view");
  if (view === "episode") {
    const target = readEpisodeDeepLink(url);
    return target
      ? { kind: "EPISODE", view: "episode", target }
      : { kind: "INVALID", view: "stack", reason: "INVALID_EPISODE" };
  }
  if (view === null || view === "stack") return { kind: "VIEW", view: "stack" };
  if (WORKBENCH_VIEW_IDS.some((candidate) => candidate === view)) {
    return { kind: "VIEW", view: view as Exclude<WorkbenchViewId, "episode"> };
  }
  return { kind: "INVALID", view: "stack", reason: "UNSUPPORTED_VIEW" };
}

export function planWorkbenchNavigationReplay(
  intent: WorkbenchNavigationIntent,
  connectedRobotId: string | null,
): WorkbenchNavigationReplay {
  if (intent.kind === "EPISODE") {
    return {
      view: "episode",
      episodeTarget: intent.target,
      reconnectRobotId: connectedRobotId === intent.target.robotId ? null : intent.target.robotId,
      normalizeToStack: false,
    };
  }
  if (intent.kind === "VIEW") {
    return { view: intent.view, episodeTarget: null, reconnectRobotId: null, normalizeToStack: false };
  }
  return { view: "stack", episodeTarget: null, reconnectRobotId: null, normalizeToStack: true };
}

export function shouldRejectEpisodeNavigation(
  view: WorkbenchViewId,
  episodeFeatureAvailable: boolean,
  connectionSettled: boolean,
): boolean {
  return view === "episode" && !episodeFeatureAvailable && connectionSettled;
}

export function buildEpisodeDeepLink(url: string, target: EpisodeDeepLinkTarget): string {
  const parsed = new URL(url, "http://rolo-vis.local");
  const assetId = target.assetId ?? null;
  if (target.compareEvidenceId !== null && !IDENTIFIER.test(target.compareEvidenceId)) throw new Error("Episode Evidence context deep links require a safe identifier.");
  if (assetId !== null && (!IDENTIFIER.test(assetId) || target.compareEvidenceId === null)) throw new Error("Episode Asset focus deep links require a safe Asset and selected Evidence context.");
  parsed.searchParams.set("view", "episode");
  parsed.searchParams.set("robot", target.robotId);
  parsed.searchParams.set("episode", target.episodeId);
  if (target.revision === null) parsed.searchParams.delete("revision");
  else parsed.searchParams.set("revision", String(target.revision));
  if (target.eventId === null) parsed.searchParams.delete("event");
  else parsed.searchParams.set("event", target.eventId);
  if (target.findingId === null) parsed.searchParams.delete("finding");
  else parsed.searchParams.set("finding", target.findingId);
  if (assetId === null) parsed.searchParams.delete("asset");
  else parsed.searchParams.set("asset", assetId);
  if ((target.compareEpisodeId === null) !== (target.compareRevision === null)) throw new Error("Episode comparison deep links require both identity and revision.");
  if (target.compareEpisodeId === target.episodeId && (target.revision === null || target.compareRevision === target.revision)) throw new Error("Episode comparison deep links require two distinct published revisions.");
  if (target.compareEpisodeId === null) {
    if (target.compareEvidenceId !== null) throw new Error("Episode Evidence context deep links require a pinned comparison.");
    parsed.searchParams.delete("compare");
    parsed.searchParams.delete("compare_revision");
    parsed.searchParams.delete("compare_evidence");
  } else {
    parsed.searchParams.set("compare", target.compareEpisodeId);
    parsed.searchParams.set("compare_revision", String(target.compareRevision));
    if (target.compareEvidenceId === null) parsed.searchParams.delete("compare_evidence");
    else parsed.searchParams.set("compare_evidence", target.compareEvidenceId);
  }
  if (target.cohortDays === null) parsed.searchParams.delete("cohort_days");
  else parsed.searchParams.set("cohort_days", String(target.cohortDays));
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function sameEpisodeDeepLinkTarget(left: EpisodeDeepLinkTarget, right: EpisodeDeepLinkTarget): boolean {
  return left.robotId === right.robotId
    && left.episodeId === right.episodeId
    && left.revision === right.revision
    && left.eventId === right.eventId
    && left.findingId === right.findingId
    && left.assetId === right.assetId
    && left.compareEpisodeId === right.compareEpisodeId
    && left.compareRevision === right.compareRevision
    && left.compareEvidenceId === right.compareEvidenceId
    && left.cohortDays === right.cohortDays;
}

export function buildEpisodeReviewLink(url: string, target: EpisodeDeepLinkTarget): string {
  const source = new URL(url);
  if (!["http:", "https:"].includes(source.protocol) || source.username || source.password) {
    throw new Error("Episode review links require an HTTP(S) workbench origin without embedded credentials.");
  }
  if (target.revision === null) {
    throw new Error("Episode review links require an exact published revision.");
  }
  const cleanBase = new URL(source.pathname, source.origin);
  const relative = buildEpisodeDeepLink(cleanBase.href, target);
  const absolute = new URL(relative, source.origin);
  absolute.hash = "";
  const restored = readEpisodeDeepLink(absolute.href);
  if (!restored || !sameEpisodeDeepLinkTarget(restored, target)) {
    throw new Error("Episode review link state did not survive strict canonical validation.");
  }
  return absolute.href;
}

export function buildEpisodeReviewHandoffLink(url: string, target: EpisodeDeepLinkTarget): string {
  const absolute = new URL(buildEpisodeReviewLink(url, target));
  absolute.searchParams.set(REVIEW_HANDOFF_KEY, REVIEW_HANDOFF_VALUE);
  return absolute.href;
}

export function readEpisodeReviewHandoff(url: string): EpisodeReviewHandoffIntent {
  let source: URL;
  try {
    source = new URL(url);
  } catch {
    return { kind: "NONE" };
  }
  const markers = source.searchParams.getAll(REVIEW_HANDOFF_KEY);
  if (!markers.length) return { kind: "NONE" };
  if (markers.length !== 1 || markers[0] !== REVIEW_HANDOFF_VALUE) {
    return { kind: "INVALID", reason: "NON_CANONICAL_REVIEW_HANDOFF" };
  }
  const target = readEpisodeDeepLink(source.href);
  if (!target || target.revision === null) {
    return { kind: "INVALID", reason: "NON_CANONICAL_REVIEW_HANDOFF" };
  }
  try {
    const canonical = buildEpisodeReviewHandoffLink(`${source.origin}${source.pathname}`, target);
    return canonical === source.href
      ? { kind: "VALID", target }
      : { kind: "INVALID", reason: "NON_CANONICAL_REVIEW_HANDOFF" };
  } catch {
    return { kind: "INVALID", reason: "NON_CANONICAL_REVIEW_HANDOFF" };
  }
}

export async function writeEpisodeReviewLink(
  clipboard: Pick<Clipboard, "writeText">,
  url: string,
  target: EpisodeDeepLinkTarget,
): Promise<string> {
  const link = buildEpisodeReviewLink(url, target);
  await clipboard.writeText(link);
  return link;
}

export async function writeEpisodeReviewHandoffLink(
  clipboard: Pick<Clipboard, "writeText">,
  url: string,
  target: EpisodeDeepLinkTarget,
): Promise<string> {
  const link = buildEpisodeReviewHandoffLink(url, target);
  await clipboard.writeText(link);
  return link;
}

export function buildWorkbenchViewLink(url: string, view: WorkbenchViewId): string {
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
