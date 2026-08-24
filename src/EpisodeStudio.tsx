import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowsLeftRight,
  Clock,
  FileText,
  Funnel,
  Info,
  MagnifyingGlass,
  Pulse,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { buildEpisodePairComparison, type EpisodePairComparison } from "./episodeComparison";
import { EpisodeComparisonView } from "./EpisodeComparisonView";
import { roloClient } from "./roloClient";
import {
  appendTimelineEvents,
  buildEpisodeDeepLink,
  EPISODE_TIMELINE_PAGE_LIMIT,
  EPISODE_VISIBLE_EVENT_LIMIT,
  nextTimelineEventId,
  projectTimelineLayout,
  type EpisodeDeepLinkTarget,
} from "./episodeNavigation";
import "./episode.css";
import "./episode-polish.css";
import type {
  EpisodeAssetSummary,
  EpisodeAuthority,
  EpisodeCollection,
  EpisodeDetail,
  EpisodeFindingSummary,
  EpisodeSummary,
  EpisodeTimelineEvent,
  EpisodeTimelineLane,
} from "./types/rolo";

const TIMELINE_LANES: EpisodeTimelineLane[] = [
  "COMMAND", "STATE", "TELEMETRY", "OBSERVATION", "ALERT", "AGENT",
  "CONFIGURATION", "CHECKPOINT", "GATE", "OUTCOME",
];

const AUTHORITY_LABELS: Record<EpisodeAuthority, string> = {
  DECLARED: "Intended · configured",
  OBSERVED: "Observed fact",
  INFERRED: "Agent inference · unverified",
  HUMAN_CONFIRMED: "Human confirmed",
  VERIFIED: "Verify-stage result",
};

const FINDING_LABELS = {
  OBSERVED_FACT: "Observed fact",
  CANDIDATE_CAUSE: "Candidate cause · unverified",
  HUMAN_CONFIRMATION: "Human confirmation",
  VERIFIED_OUTCOME: "Verified outcome",
} as const;

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return "In progress";
  const durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
  if (durationMs < 1000) return `${durationMs} ms`;
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)} s`;
  return `${Math.floor(durationMs / 60_000)}m ${Math.round((durationMs % 60_000) / 1000)}s`;
}

function formatOffset(offsetMs: number): string {
  if (offsetMs < 1000) return `${offsetMs} ms`;
  if (offsetMs < 60_000) return `${(offsetMs / 1000).toFixed(offsetMs < 10_000 ? 1 : 0)} s`;
  return `${Math.floor(offsetMs / 60_000)}m ${Math.round((offsetMs % 60_000) / 1000)}s`;
}

function compactDigest(value: string | null): string {
  return value ? `sha256:${value.slice(0, 12)}…${value.slice(-6)}` : "Withheld";
}

const EPISODE_COMPARE_PAGE_BUDGET = 5;

async function readBoundedTimeline(robotId: string, detail: EpisodeDetail, signal: AbortSignal): Promise<EpisodeTimelineEvent[]> {
  let page = await roloClient.episodeTimelinePage(robotId, detail.episode_id, detail.revision, { signal }, { limit: EPISODE_TIMELINE_PAGE_LIMIT });
  let accumulated = page.items;
  let cursor = page.next_cursor;
  let pagesRead = 1;
  const seenCursors = new Set<string>();
  while (cursor && accumulated.length < EPISODE_VISIBLE_EVENT_LIMIT && pagesRead < EPISODE_COMPARE_PAGE_BUDGET) {
    if (seenCursors.has(cursor)) throw new Error("Episode comparison timeline cursor repeated; the pair was rejected.");
    seenCursors.add(cursor);
    const limit = Math.min(EPISODE_TIMELINE_PAGE_LIMIT, EPISODE_VISIBLE_EVENT_LIMIT - accumulated.length);
    page = await roloClient.episodeTimelinePage(robotId, detail.episode_id, detail.revision, { signal }, { limit, cursor });
    accumulated = appendTimelineEvents(accumulated, page.items);
    cursor = page.next_cursor;
    pagesRead += 1;
  }
  if (cursor && accumulated.length >= detail.event_count) throw new Error("Episode comparison timeline pagination contradicts the published event count.");
  return accumulated;
}

async function readComparisonSide(robotId: string, episodeId: string, expectedRevision: number, signal: AbortSignal) {
  const episodeDetail = await roloClient.episode(robotId, episodeId, { signal });
  if (episodeDetail.revision !== expectedRevision) throw new Error(`Episode ${episodeId} moved from pinned revision ${expectedRevision} to ${episodeDetail.revision}.`);
  return { detail: episodeDetail, events: await readBoundedTimeline(robotId, episodeDetail, signal) };
}

function EpisodeListItem({ item, active, onClick }: { item: EpisodeSummary; active: boolean; onClick: () => void }) {
  return (
    <button className={`episode-list-item ${active ? "is-selected" : ""}`} onClick={onClick}>
      <span className="episode-list-heading"><strong>{item.task_label}</strong><ArrowRight size={14} /></span>
      <code>{item.episode_id} · rev {item.revision}</code>
      <span className="episode-list-badges">
        <em className={`episode-state is-${item.state.toLowerCase()}`}>{item.state}</em>
        <em className={`episode-outcome is-${item.outcome.toLowerCase()}`}>{item.outcome}</em>
        <em className={`episode-verification is-${item.verification.toLowerCase().replaceAll("_", "-")}`}>{item.verification.replaceAll("_", " ")}</em>
      </span>
      <span className="episode-list-meta"><time>{new Date(item.started_at).toLocaleString()}</time><small>{formatDuration(item.started_at, item.ended_at)}</small></span>
      <span className="episode-list-counts"><small>{item.event_count} events</small><small>{item.finding_count} findings</small><small>{item.asset_count} assets</small></span>
      {item.limitations.length > 0 && <span className="episode-list-warning"><WarningCircle size={13} weight="fill" /> {item.limitations.length} limitations</span>}
    </button>
  );
}

function AuthorityBadge({ authority }: { authority: EpisodeAuthority }) {
  return <span className={`episode-authority is-${authority.toLowerCase().replaceAll("_", "-")}`}>{AUTHORITY_LABELS[authority]}</span>;
}

function EventInspector({ event, onOpenEvidence }: { event: EpisodeTimelineEvent | null; onOpenEvidence: (evidenceId: string) => void }) {
  if (!event) {
    return <aside className="episode-inspector panel"><div className="episode-inspector-empty"><Clock size={26} /><strong>Select a timeline event</strong><span>Authority, timing, metrics, and evidence stay visible here.</span></div></aside>;
  }
  return (
    <aside className="episode-inspector panel" aria-label="Selected Episode event details">
      <header>
        <span>{event.lane} · sequence {event.sequence}</span>
        <h3>{event.title}</h3>
        <AuthorityBadge authority={event.authority} />
      </header>
      <p>{event.summary}</p>
      <dl className="episode-inspector-facts">
        <div><dt>Offset</dt><dd>{formatOffset(event.offset_ms)}</dd></div>
        <div><dt>UTC</dt><dd>{new Date(event.occurred_at).toISOString()}</dd></div>
        <div><dt>Clock</dt><dd>{event.clock_domain}</dd></div>
        <div><dt>Sync</dt><dd>{event.synchronization}</dd></div>
        <div><dt>Severity</dt><dd className={`is-${event.severity.toLowerCase()}`}>{event.severity}</dd></div>
        <div><dt>Duration</dt><dd>{event.duration_ms === null ? "Instant" : formatOffset(event.duration_ms)}</dd></div>
      </dl>
      {Object.keys(event.metrics).length > 0 && <section className="episode-inspector-section"><h4>Bounded metrics</h4><dl>{Object.entries(event.metrics).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{value}</dd></div>)}</dl></section>}
      <section className="episode-inspector-section">
        <h4>Evidence</h4>
        {event.evidence_ids.map((evidenceId) => <button key={evidenceId} onClick={() => onOpenEvidence(evidenceId)}><ShieldCheck size={15} /><span>{evidenceId}</span><ArrowRight size={13} /></button>)}
        {!event.evidence_ids.length && <span className="episode-none"><Info size={14} /> Declared intent has no observation evidence.</span>}
      </section>
      {event.limitations.length > 0 && <section className="episode-event-limitations"><WarningCircle size={15} weight="fill" /><ul>{event.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></section>}
    </aside>
  );
}

function EpisodeFindingCard({ finding, onOpenEvidence }: { finding: EpisodeFindingSummary; onOpenEvidence: (evidenceId: string) => void }) {
  const evidenceId = finding.supporting_evidence_ids[0];
  return (
    <button className={`episode-finding is-${finding.kind.toLowerCase().replaceAll("_", "-")}`} disabled={!evidenceId} onClick={() => evidenceId && onOpenEvidence(evidenceId)}>
      <span><strong>{FINDING_LABELS[finding.kind]}</strong><em>{finding.verification.replaceAll("_", " ")}</em></span>
      <h4>{finding.title}</h4>
      <p>{finding.summary}</p>
      <small>{formatOffset(finding.start_offset_ms)}–{formatOffset(finding.end_offset_ms)}{finding.confidence === null ? "" : ` · ${Math.round(finding.confidence * 100)}% confidence`}</small>
      {evidenceId && <span className="episode-evidence-link"><ShieldCheck size={13} /> Open supporting evidence</span>}
    </button>
  );
}

function EpisodeAssetCard({ asset, onOpenEvidence }: { asset: EpisodeAssetSummary; onOpenEvidence: (evidenceId: string) => void }) {
  return (
    <article className={`episode-asset is-${asset.availability.toLowerCase()}`}>
      <header><span><strong>{asset.source_label}</strong><small>{asset.modality} · {asset.media_type}</small></span><em className={`world-${asset.world_kind.toLowerCase()}`}>{asset.world_kind}</em></header>
      <dl>
        <div><dt>Evidence kind</dt><dd>{asset.evidence_kind}</dd></div>
        <div><dt>Offset</dt><dd>{formatOffset(asset.offset_ms)}</dd></div>
        <div><dt>Frame</dt><dd>{asset.frame || "Not declared"}</dd></div>
        <div><dt>Sync</dt><dd>{asset.synchronization}</dd></div>
        <div><dt>Classification</dt><dd>{asset.data_classification}</dd></div>
        <div><dt>Digest</dt><dd>{compactDigest(asset.digest)}</dd></div>
      </dl>
      <footer><span className={`asset-availability is-${asset.availability.toLowerCase()}`}>{asset.availability}</span><button disabled={!asset.evidence_id} onClick={() => asset.evidence_id && onOpenEvidence(asset.evidence_id)}><ShieldCheck size={14} /> Evidence</button></footer>
    </article>
  );
}

function EpisodeTimeline({ detail, events, selectedEventId, visibleLanes, onSelectEvent }: {
  detail: EpisodeDetail;
  events: EpisodeTimelineEvent[];
  selectedEventId: string;
  visibleLanes: Set<EpisodeTimelineLane>;
  onSelectEvent: (eventId: string) => void;
}) {
  const markerRefs = useRef(new Map<string, HTMLButtonElement>());
  const layout = useMemo(() => projectTimelineLayout(events, TIMELINE_LANES.filter((lane) => detail.available_lanes.includes(lane)), visibleLanes), [detail.available_lanes, events, visibleLanes]);
  const firstVisibleEventId = events.find((event) => visibleLanes.has(event.lane))?.event_id || "";
  const moveSelection = (eventId: string, key: string) => {
    const nextId = nextTimelineEventId(events, visibleLanes, eventId, key);
    if (!nextId) return false;
    onSelectEvent(nextId);
    window.requestAnimationFrame(() => markerRefs.current.get(nextId)?.focus());
    return true;
  };
  return (
    <div className="episode-timeline panel" aria-label="Episode metadata timeline" aria-describedby="episode-timeline-keyboard-help">
      <span className="visually-hidden" id="episode-timeline-keyboard-help">Use arrow keys to move between visible events. Home and End move to the first and last visible event.</span>
      <header className="episode-time-ruler"><span>Lane</span><div>{[0, .25, .5, .75, 1].map((fraction) => <time key={fraction} style={{ left: `${fraction * 100}%` }}>{formatOffset(Math.round(layout.maxOffset * fraction))}</time>)}</div></header>
      <div className="episode-lanes">
        {layout.lanes.map(({ lane, items }) => {
          return <div className="episode-lane" key={lane}>
            <span><strong>{lane}</strong><small>{items.length}</small></span>
            <div>
              {items.map(({ event, left, width }) => {
                return <button
                  key={event.event_id}
                  ref={(node) => { if (node) markerRefs.current.set(event.event_id, node); else markerRefs.current.delete(event.event_id); }}
                  className={`episode-event-marker is-${event.authority.toLowerCase().replaceAll("_", "-")} ${selectedEventId === event.event_id ? "is-selected" : ""}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  onClick={() => onSelectEvent(event.event_id)}
                  onKeyDown={(keyboardEvent) => {
                    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(keyboardEvent.key) && moveSelection(event.event_id, keyboardEvent.key)) keyboardEvent.preventDefault();
                  }}
                  aria-label={`${event.lane} at ${formatOffset(event.offset_ms)}: ${event.title}`}
                  aria-current={selectedEventId === event.event_id ? "true" : undefined}
                  tabIndex={selectedEventId === event.event_id || (!selectedEventId && firstVisibleEventId === event.event_id) ? 0 : -1}
                  title={`${event.title} · ${AUTHORITY_LABELS[event.authority]}`}
                ><span /></button>;
              })}
            </div>
          </div>;
        })}
      </div>
    </div>
  );
}

export function EpisodeStudio({ robotId, initialTarget, onOpenEvidence }: { robotId: string; initialTarget?: EpisodeDeepLinkTarget | null; onOpenEvidence: (evidenceId: string) => void }) {
  const [collection, setCollection] = useState<EpisodeCollection | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(true);
  const [collectionMessage, setCollectionMessage] = useState("");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(() => initialTarget?.robotId === robotId ? initialTarget.episodeId : "");
  const [detail, setDetail] = useState<EpisodeDetail | null>(null);
  const [events, setEvents] = useState<EpisodeTimelineEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMessage, setDetailMessage] = useState("");
  const [timelineNotice, setTimelineNotice] = useState("");
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(() => initialTarget?.robotId === robotId ? initialTarget.eventId || "" : "");
  const [detailReload, setDetailReload] = useState(0);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [visibleLanes, setVisibleLanes] = useState<Set<EpisodeTimelineLane>>(new Set(TIMELINE_LANES));
  const [compareEpisodeId, setCompareEpisodeId] = useState(() => initialTarget?.robotId === robotId ? initialTarget.compareEpisodeId || "" : "");
  const [compareRevision, setCompareRevision] = useState<number | null>(() => initialTarget?.robotId === robotId ? initialTarget.compareRevision : null);
  const [comparison, setComparison] = useState<EpisodePairComparison | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonMessage, setComparisonMessage] = useState("");
  const collectionRequest = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  const comparisonRequest = useRef<AbortController | null>(null);
  const initialTargetConsumed = useRef(false);

  const loadCollection = useCallback(async () => {
    collectionRequest.current?.abort();
    const controller = new AbortController();
    collectionRequest.current = controller;
    setCollectionLoading(true);
    setCollectionMessage("");
    try {
      const value = await roloClient.episodeCollection(robotId, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setCollection(value);
      setEpisodes(value.items);
      setSelectedEpisodeId((current) => current || (initialTarget?.robotId === robotId ? initialTarget.episodeId : "") || value.items[0]?.episode_id || "");
    } catch (error) {
      if (controller.signal.aborted) return;
      setCollection(null);
      setEpisodes([]);
      setSelectedEpisodeId("");
      setCollectionMessage(error instanceof Error ? error.message : "Episode collection is unavailable.");
    } finally {
      if (!controller.signal.aborted) setCollectionLoading(false);
      if (collectionRequest.current === controller) collectionRequest.current = null;
    }
  }, [robotId, initialTarget]);

  useEffect(() => {
    void loadCollection();
    return () => collectionRequest.current?.abort();
  }, [loadCollection]);

  useEffect(() => {
    detailRequest.current?.abort();
    setDetail(null);
    setEvents([]);
    setNextCursor(null);
    setSelectedEventId("");
    setDetailMessage("");
    setTimelineNotice("");
    if (!selectedEpisodeId) return;
    const summary = episodes.find((item) => item.episode_id === selectedEpisodeId);
    const controller = new AbortController();
    detailRequest.current = controller;
    setDetailLoading(true);
    void roloClient.episode(robotId, selectedEpisodeId, { signal: controller.signal }).then(async (episodeDetail) => {
      if (summary && episodeDetail.revision !== summary.revision) throw new Error("Episode revision changed while opening Studio. Refresh the Episode list before continuing.");
      const deepTarget = !initialTargetConsumed.current && initialTarget?.robotId === robotId && initialTarget.episodeId === selectedEpisodeId ? initialTarget : null;
      if (deepTarget && deepTarget.revision !== null && deepTarget.revision !== episodeDetail.revision) throw new Error(`Deep link pins revision ${deepTarget.revision}, but rolo published revision ${episodeDetail.revision}.`);
      let timeline = await roloClient.episodeTimelinePage(robotId, selectedEpisodeId, episodeDetail.revision, { signal: controller.signal }, { limit: EPISODE_TIMELINE_PAGE_LIMIT });
      let accumulated = timeline.items;
      let cursor = timeline.next_cursor;
      const seenCursors = new Set<string>();
      while (deepTarget?.eventId && !accumulated.some((item) => item.event_id === deepTarget.eventId) && cursor && accumulated.length < EPISODE_VISIBLE_EVENT_LIMIT) {
        if (seenCursors.has(cursor)) throw new Error("Episode timeline cursor repeated; the bounded deep-link lookup was rejected.");
        seenCursors.add(cursor);
        const limit = Math.min(EPISODE_TIMELINE_PAGE_LIMIT, EPISODE_VISIBLE_EVENT_LIMIT - accumulated.length);
        timeline = await roloClient.episodeTimelinePage(robotId, selectedEpisodeId, episodeDetail.revision, { signal: controller.signal }, { limit, cursor });
        accumulated = appendTimelineEvents(accumulated, timeline.items);
        cursor = timeline.next_cursor;
      }
      if (controller.signal.aborted) return;
      initialTargetConsumed.current = true;
      setDetail(episodeDetail);
      setEvents(accumulated);
      setNextCursor(cursor);
      const deepEventFound = deepTarget?.eventId && accumulated.some((item) => item.event_id === deepTarget.eventId);
      setSelectedEventId(deepEventFound ? deepTarget.eventId || "" : accumulated[0]?.event_id || "");
      if (deepTarget?.eventId && !deepEventFound) setTimelineNotice(`Event ${deepTarget.eventId} is not present in the bounded ${EPISODE_VISIBLE_EVENT_LIMIT}-event view.`);
      else if (cursor && accumulated.length >= EPISODE_VISIBLE_EVENT_LIMIT) setTimelineNotice(`The visible timeline is capped at ${EPISODE_VISIBLE_EVENT_LIMIT} events.`);
      setVisibleLanes(new Set(episodeDetail.available_lanes));
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setDetailMessage(error instanceof Error ? error.message : "Episode Studio could not be read.");
    }).finally(() => {
      if (!controller.signal.aborted) setDetailLoading(false);
      if (detailRequest.current === controller) detailRequest.current = null;
    });
    return () => controller.abort();
  }, [robotId, selectedEpisodeId, episodes, initialTarget, detailReload]);

  useEffect(() => {
    if (selectedEpisodeId !== compareEpisodeId) return;
    comparisonRequest.current?.abort();
    setCompareEpisodeId("");
    setCompareRevision(null);
    setComparison(null);
    setComparisonMessage("");
  }, [selectedEpisodeId, compareEpisodeId]);

  useEffect(() => {
    comparisonRequest.current?.abort();
    setComparison(null);
    setComparisonMessage("");
    setComparisonLoading(false);
    if (!detail || !compareEpisodeId || compareRevision === null) return;
    const controller = new AbortController();
    comparisonRequest.current = controller;
    setComparisonLoading(true);
    void Promise.all([
      readComparisonSide(robotId, detail.episode_id, detail.revision, controller.signal),
      readComparisonSide(robotId, compareEpisodeId, compareRevision, controller.signal),
    ]).then(([left, right]) => {
      if (!controller.signal.aborted) setComparison(buildEpisodePairComparison(left.detail, left.events, right.detail, right.events));
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setComparisonMessage(error instanceof Error ? error.message : "Episode comparison could not be derived.");
    }).finally(() => {
      if (!controller.signal.aborted) setComparisonLoading(false);
      if (comparisonRequest.current === controller) comparisonRequest.current = null;
    });
    return () => controller.abort();
  }, [robotId, detail, compareEpisodeId, compareRevision]);

  useEffect(() => {
    if (!detail) return;
    const next = buildEpisodeDeepLink(window.location.href, {
      robotId,
      episodeId: detail.episode_id,
      revision: detail.revision,
      eventId: selectedEventId || null,
      compareEpisodeId: compareEpisodeId && compareEpisodeId !== detail.episode_id ? compareEpisodeId : null,
      compareRevision: compareEpisodeId && compareEpisodeId !== detail.episode_id ? compareRevision : null,
    });
    window.history.replaceState(null, "", next);
  }, [robotId, detail, selectedEventId, compareEpisodeId, compareRevision]);

  const loadMoreTimeline = async () => {
    if (!detail || !nextCursor || timelineLoading || events.length >= EPISODE_VISIBLE_EVENT_LIMIT) return;
    setTimelineLoading(true);
    setDetailMessage("");
    try {
      const limit = Math.min(EPISODE_TIMELINE_PAGE_LIMIT, EPISODE_VISIBLE_EVENT_LIMIT - events.length);
      const page = await roloClient.episodeTimelinePage(robotId, detail.episode_id, detail.revision, undefined, { limit, cursor: nextCursor });
      const merged = appendTimelineEvents(events, page.items);
      setEvents(merged);
      setNextCursor(page.next_cursor);
      if (page.next_cursor && merged.length >= EPISODE_VISIBLE_EVENT_LIMIT) setTimelineNotice(`The visible timeline is capped at ${EPISODE_VISIBLE_EVENT_LIMIT} events. Narrow the lanes before reviewing this record.`);
    } catch (error) {
      setDetailMessage(error instanceof Error ? error.message : "The next timeline page could not be read.");
    } finally {
      setTimelineLoading(false);
    }
  };

  const loadMoreEpisodes = async () => {
    if (!collection?.next_offset || collectionLoading) return;
    setCollectionLoading(true);
    setCollectionMessage("");
    try {
      const page = await roloClient.episodeCollection(robotId, undefined, { limit: collection.limit, offset: collection.next_offset });
      setEpisodes((current) => [...current, ...page.items]);
      setCollection({ ...page, items: [...episodes, ...page.items] });
    } catch (error) {
      setCollectionMessage(error instanceof Error ? error.message : "The next Episode page could not be read.");
    } finally {
      setCollectionLoading(false);
    }
  };

  const filteredEpisodes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return episodes.filter((item) => (stateFilter === "all" || item.state === stateFilter) && (!normalized || `${item.task_label} ${item.episode_id} ${item.operation || ""}`.toLowerCase().includes(normalized)));
  }, [episodes, query, stateFilter]);
  const selectedEvent = events.find((event) => event.event_id === selectedEventId) || null;
  const compareOptions = episodes.filter((item) => item.episode_id !== selectedEpisodeId);
  const compareSelectionMissing = compareEpisodeId && !compareOptions.some((item) => item.episode_id === compareEpisodeId);
  const clearComparison = () => {
    comparisonRequest.current?.abort();
    setCompareEpisodeId("");
    setCompareRevision(null);
    setComparison(null);
    setComparisonMessage("");
    setComparisonLoading(false);
  };
  const chooseComparison = (episodeId: string) => {
    if (!episodeId) {
      clearComparison();
      return;
    }
    const summary = episodes.find((item) => item.episode_id === episodeId);
    if (!summary) return;
    setCompareEpisodeId(summary.episode_id);
    setCompareRevision(summary.revision);
  };

  if (collectionLoading && !collection) return <section className="content-view episode-view"><div className="page-title"><div><div className="eyebrow">Read-only execution record</div><h2>Episode Studio</h2><p>Loading published Episode revisions without inferring live runtime state.</p></div></div><div className="panel episode-state-view"><Pulse size={28} /><div><strong>Reading Episode index</strong><p>Only a feature-negotiated, versioned read model can populate this workspace.</p></div></div></section>;
  if (collectionMessage && !collection) return <section className="content-view episode-view"><div className="page-title"><div><div className="eyebrow">Read-only execution record</div><h2>Episode Studio</h2><p>Published execution history with explicit authority and verification boundaries.</p></div></div><div className="panel episode-state-view is-error"><WarningCircle size={28} weight="fill" /><div><strong>Episode read model unavailable</strong><p>{collectionMessage}</p><small>No Lifecycle or fixture data was substituted.</small><button className="secondary-button" onClick={() => void loadCollection()}>Retry Episode index</button></div></div></section>;
  if (collection && collection.total === 0) return <section className="content-view episode-view"><div className="page-title"><div><div className="eyebrow">Read-only execution record</div><h2>Episode Studio</h2><p>Published execution history with explicit authority and verification boundaries.</p></div></div><div className="panel episode-state-view is-empty"><Clock size={28} /><div><strong>No published Episodes</strong><p>rolo advertises the Episode read model, but this robot has no committed public revisions yet.</p><small>The workbench will not relabel Lifecycle runs as Episodes.</small></div></div></section>;

  return (
    <section className="content-view episode-view">
      <div className="page-title episode-page-title"><div><div className="eyebrow">Read-only execution record</div><h2>Episode Studio</h2><p>Sequence-ordered execution context, observations, inferences, and Verify-stage results.</p></div>{detail && <div className="episode-revision-lock"><ShieldCheck size={17} /><span><strong>Revision {detail.revision} pinned</strong><small>{detail.immutable ? "Immutable publication" : "Live publication"} · {detail.coverage.replaceAll("_", " ")}</small></span></div>}</div>
      <section className="episode-compare-control panel" aria-label="Episode pair selection">
        <div><ArrowsLeftRight size={18} /><span><h3>Compare a second published Episode</h3><p>Both revisions are read independently; differences remain descriptive and release-neutral.</p></span></div>
        <div className="episode-compare-picker">
          <label className="select-control"><ArrowsLeftRight size={14} /><select value={compareEpisodeId} onChange={(event) => chooseComparison(event.target.value)} disabled={!detail || (!compareOptions.length && !compareEpisodeId)} aria-label="Select Episode to compare"><option value="">No comparison</option>{compareSelectionMissing && <option value={compareEpisodeId}>{compareEpisodeId} · pinned deep link</option>}{compareOptions.map((item) => <option key={`${item.episode_id}-${item.revision}`} value={item.episode_id}>{item.task_label} · rev {item.revision}</option>)}</select></label>
          {compareEpisodeId && <span className="episode-compare-pin"><small>RIGHT SIDE</small><strong>rev {compareRevision}</strong></span>}
        </div>
      </section>
      {comparisonLoading && <div className="episode-compare-state panel"><Pulse size={20} /><span><strong>Reading both pinned revisions</strong><small>Each side is bounded to {EPISODE_COMPARE_PAGE_BUDGET} timeline pages and {EPISODE_VISIBLE_EVENT_LIMIT} visible events.</small></span></div>}
      {comparisonMessage && <div className="episode-compare-state is-error panel" role="alert"><WarningCircle size={20} weight="fill" /><span><strong>Comparison rejected</strong><small>{comparisonMessage}</small></span></div>}
      {comparison && <EpisodeComparisonView comparison={comparison} onClear={clearComparison} />}
      <div className="episode-shell">
        <aside className="episode-index panel">
          <header><span>Published Episodes</span><strong>{collection?.total || episodes.length}</strong></header>
          <div className="episode-index-tools"><label className="search-box"><MagnifyingGlass size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Episode" aria-label="Search Episodes" /></label><label className="select-control"><Funnel size={14} /><select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} aria-label="Filter Episode state"><option value="all">All states</option><option value="RUNNING">Running</option><option value="COMPLETED">Completed</option><option value="FAILED">Failed</option><option value="CANCELLED">Cancelled</option><option value="PARTIAL">Partial</option></select></label></div>
          <div className="episode-index-list">{filteredEpisodes.map((item) => <EpisodeListItem key={`${item.episode_id}-${item.revision}`} item={item} active={item.episode_id === selectedEpisodeId} onClick={() => { if (item.episode_id === compareEpisodeId) clearComparison(); setSelectedEpisodeId(item.episode_id); }} />)}{!filteredEpisodes.length && <div className="episode-index-empty"><MagnifyingGlass size={20} /><span>No Episodes match this view.</span></div>}</div>
          {collection?.next_offset !== null && <footer><button className="secondary-button" disabled={collectionLoading} onClick={() => void loadMoreEpisodes()}>{collectionLoading ? "Loading…" : "Load more Episodes"}</button></footer>}
        </aside>

        <div className="episode-studio-main">
          {detailLoading && <div className="panel episode-detail-state"><Pulse size={24} /><span><strong>Opening pinned revision</strong><small>Detail and timeline are resolved together.</small></span></div>}
          {detailMessage && <div className="panel episode-detail-state is-error" role="alert"><WarningCircle size={21} weight="fill" /><span><strong>Studio view rejected</strong><small>{detailMessage}</small></span><button className="secondary-button" onClick={() => setDetailReload((value) => value + 1)}>Retry pinned view</button></div>}
          {detail && <>
            <header className="episode-detail-heading panel">
              <div><span>{detail.operation || "Operation not declared"}</span><h3>{detail.task_label}</h3><code>{detail.episode_id} · revision {detail.revision}</code></div>
              <div className="episode-detail-status"><em className={`episode-state is-${detail.state.toLowerCase()}`}>{detail.state}</em><em className={`episode-outcome is-${detail.outcome.toLowerCase()}`}>{detail.outcome}</em><em className={`episode-verification is-${detail.verification.toLowerCase().replaceAll("_", "-")}`}>{detail.verification.replaceAll("_", " ")}</em></div>
              <dl><div><dt>Started</dt><dd>{new Date(detail.started_at).toLocaleString()}</dd></div><div><dt>Duration</dt><dd>{formatDuration(detail.started_at, detail.ended_at)}</dd></div><div><dt>Clock</dt><dd>{detail.clock_domain}</dd></div><div><dt>Sync</dt><dd>{detail.synchronization}</dd></div></dl>
              {detail.evidence_ids[0] && <button className="secondary-button" onClick={() => onOpenEvidence(detail.evidence_ids[0])}><ShieldCheck size={15} /> Outcome evidence</button>}
            </header>
            {detail.synchronization !== "SYNCED" && <div className="episode-sync-warning"><WarningCircle size={17} weight="fill" /><span><strong>{detail.synchronization} clock synchronization</strong><small>offset_ms remains the ordering authority; precise cross-sensor timing claims are withheld.</small></span></div>}
            <div className="episode-lane-filter" aria-label="Episode timeline lane filters">{detail.available_lanes.map((lane) => <button key={lane} className={visibleLanes.has(lane) ? "is-active" : ""} onClick={() => setVisibleLanes((current) => { const next = new Set(current); if (next.has(lane) && next.size > 1) next.delete(lane); else next.add(lane); return next; })}>{lane}<span>{events.filter((event) => event.lane === lane).length}</span></button>)}</div>
            <EpisodeTimeline detail={detail} events={events} selectedEventId={selectedEventId} visibleLanes={visibleLanes} onSelectEvent={setSelectedEventId} />
            <div className="episode-timeline-footer"><span>Loaded {events.length} of {detail.event_count} sequence-ordered events · keyboard: arrows / Home / End</span>{nextCursor && events.length < EPISODE_VISIBLE_EVENT_LIMIT && <button className="secondary-button" disabled={timelineLoading} onClick={() => void loadMoreTimeline()}>{timelineLoading ? "Loading…" : "Load next pinned page"}</button>}</div>
            {timelineNotice && <div className="episode-timeline-notice" role="status"><Info size={16} /><span>{timelineNotice}</span></div>}
          </>}
        </div>

        <EventInspector event={selectedEvent} onOpenEvidence={onOpenEvidence} />
      </div>

      {detail && <>
        <section className="panel episode-behavior-summary">
          <article><span>Expected</span><h3>Declared behavior</h3><p>{detail.expected_behavior || "No expected behavior was published."}</p></article>
          <ArrowRight size={20} />
          <article><span>Observed</span><h3>Producer observation</h3><p>{detail.observed_behavior || "No observed behavior was published."}</p></article>
          <article className={`episode-verification-summary is-${detail.verification.toLowerCase().replaceAll("_", "-")}`}><span>Independent verification</span><h3>{detail.verification.replaceAll("_", " ")}</h3><p>{detail.verification === "VERIFIED" ? "A Verify-stage result is bound to this revision." : detail.verification === "UNVERIFIED" ? "Execution outcome is not an independent Verify-stage result." : "No verification read model is available for this revision."}</p></article>
        </section>

        <section className="episode-findings-section">
          <header><div><span>Diagnosis and verification</span><h3>Findings</h3></div><small>{detail.findings.length} published · authority never inferred from confidence</small></header>
          <div className="episode-finding-grid">{detail.findings.map((finding) => <EpisodeFindingCard key={finding.finding_id} finding={finding} onOpenEvidence={onOpenEvidence} />)}{!detail.findings.length && <div className="panel episode-section-empty"><Info size={18} /><span>No evidence-backed findings were published.</span></div>}</div>
        </section>

        <section className="episode-assets-section">
          <header><div><span>Metadata-only perspective tray</span><h3>Observation assets</h3></div><small>{detail.assets.length} records · bytes and storage locations withheld</small></header>
          <div className="episode-asset-grid">{detail.assets.map((asset) => <EpisodeAssetCard key={asset.asset_id} asset={asset} onOpenEvidence={onOpenEvidence} />)}{!detail.assets.length && <div className="panel episode-section-empty"><FileText size={18} /><span>No public asset metadata was published.</span></div>}</div>
        </section>

        {detail.limitations.length > 0 && <section className="episode-limitations panel"><header><WarningCircle size={17} weight="fill" /><span><strong>Episode limitations</strong><small>{detail.limitations.length} bounded diagnostics</small></span></header><ul>{detail.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></section>}
      </>}
    </section>
  );
}
