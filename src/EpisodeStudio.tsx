import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowsLeftRight,
  Clock,
  Crosshair,
  FileText,
  Funnel,
  Info,
  LinkSimple,
  MagnifyingGlass,
  Pulse,
  ShieldCheck,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { buildEpisodePairComparison, type EpisodePairComparison } from "./episodeComparison";
import { buildEpisodeEvidenceReferenceContext, type EpisodeEvidenceOccurrence, type EpisodeEvidenceReferenceContext } from "./episodeEvidenceContext";
import { resolveEpisodeOccurrenceFocus } from "./episodeOccurrenceFocus";
import { buildEpisodeRightContextHandoffTarget, type EpisodeComparisonInputs } from "./episodeRightContextHandoff";
import { buildEpisodeCohortReview } from "./episodeCohort";
import { EpisodeCohortView } from "./EpisodeCohortView";
import { EpisodeComparisonView } from "./EpisodeComparisonView";
import { buildEpisodeDiagnosticFocus } from "./episodeDiagnosticFocus";
import { EpisodeDiagnosticFocusView } from "./EpisodeDiagnosticFocusView";
import { roloClient } from "./roloClient";
import {
  appendTimelineEvents,
  buildEpisodeDeepLink,
  EPISODE_TIMELINE_PAGE_LIMIT,
  EPISODE_VISIBLE_EVENT_LIMIT,
  nextTimelineEventId,
  projectTimelineLayout,
  readEpisodeDeepLink,
  readEpisodeReviewHandoff,
  writeEpisodeReviewHandoffLink,
  type EpisodeDeepLinkTarget,
} from "./episodeNavigation";
import { assessEpisodeReviewReceipt } from "./episodeReviewReceipt";
import { deriveEpisodeReviewAnchorContinuity } from "./episodeReviewAnchor";
import { buildEpisodeReviewMarkerSafeNavigation } from "./episodeReviewMarkerLifecycle";
import {
  advanceEpisodeReviewSession,
  buildEpisodeReviewSessionReleaseNavigation,
  releaseEpisodeReviewSession,
  type EpisodeReviewSessionState,
} from "./episodeReviewSession";
import "./episode.css";
import "./episode-polish.css";
import type {
  EpisodeAssetSummary,
  EpisodeAuthority,
  EpisodeCollection,
  EpisodeCohort,
  EpisodeCohortMember,
  EpisodeDetail,
  EpisodeFindingSummary,
  EpisodeRevisionCollection,
  EpisodeRevisionSummary,
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

async function readComparisonSide(robotId: string, episodeId: string, expectedRevision: number, signal: AbortSignal, revisionHistorySupported: boolean) {
  const episodeDetail = await roloClient.episode(robotId, episodeId, { signal }, revisionHistorySupported ? expectedRevision : undefined);
  if (episodeDetail.revision !== expectedRevision) throw new Error(`Episode ${episodeId} moved from pinned revision ${expectedRevision} to ${episodeDetail.revision}.`);
  return { detail: episodeDetail, events: await readBoundedTimeline(robotId, episodeDetail, signal) };
}

async function readRevisionHistory(robotId: string, episodeId: string, signal: AbortSignal): Promise<EpisodeRevisionCollection> {
  const first = await roloClient.episodeRevisions(robotId, episodeId, { signal });
  const items: EpisodeRevisionSummary[] = [...first.items];
  let nextOffset = first.next_offset;
  let pagesRead = 1;
  while (nextOffset !== null && pagesRead < 10) {
    const page = await roloClient.episodeRevisions(robotId, episodeId, { signal }, { limit: 100, offset: nextOffset });
    items.push(...page.items);
    nextOffset = page.next_offset;
    pagesRead += 1;
  }
  if (nextOffset !== null || items.length !== first.total) throw new Error("Episode revision history exceeds the bounded 1,000-revision view or does not cover its advertised total.");
  if (new Set(items.map((item) => item.revision)).size !== items.length) throw new Error("Episode revision history repeats a published revision.");
  if (items.some((item, index) => index > 0 && item.revision !== items[index - 1].revision - 1)) throw new Error("Episode revision history is not contiguous across page boundaries.");
  return { ...first, items, next_offset: null };
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

function EpisodeFindingCard({ finding, active, onFocus }: { finding: EpisodeFindingSummary; active: boolean; onFocus: () => void }) {
  return (
    <button className={`episode-finding is-${finding.kind.toLowerCase().replaceAll("_", "-")} ${active ? "is-selected" : ""}`} onClick={onFocus} aria-pressed={active}>
      <span><strong>{FINDING_LABELS[finding.kind]}</strong><em>{finding.verification.replaceAll("_", " ")}</em></span>
      <h4>{finding.title}</h4>
      <p>{finding.summary}</p>
      <small>{formatOffset(finding.start_offset_ms)}–{formatOffset(finding.end_offset_ms)}{finding.confidence === null ? "" : ` · ${Math.round(finding.confidence * 100)}% confidence`}</small>
      <span className="episode-evidence-link"><Crosshair size={13} /> Focus diagnostic window</span>
    </button>
  );
}

function EpisodeAssetCard({ asset, active, onOpenEvidence }: { asset: EpisodeAssetSummary; active: boolean; onOpenEvidence: (evidenceId: string) => void }) {
  return (
    <article id={`episode-asset-${asset.asset_id}`} className={`episode-asset is-${asset.availability.toLowerCase()} ${active ? "is-selected" : ""}`} aria-current={active ? "true" : undefined} tabIndex={active ? -1 : undefined}>
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

function EpisodeTimeline({ detail, events, selectedEventId, visibleLanes, focusedEventIds, onSelectEvent }: {
  detail: EpisodeDetail;
  events: EpisodeTimelineEvent[];
  selectedEventId: string;
  visibleLanes: Set<EpisodeTimelineLane>;
  focusedEventIds: Set<string> | null;
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
    <div id="episode-timeline" className="episode-timeline panel" aria-label="Episode metadata timeline" aria-describedby="episode-timeline-keyboard-help">
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
                  className={`episode-event-marker is-${event.authority.toLowerCase().replaceAll("_", "-")} ${selectedEventId === event.event_id ? "is-selected" : ""} ${focusedEventIds && !focusedEventIds.has(event.event_id) ? "is-outside-diagnostic" : ""}`}
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

export function EpisodeStudio({ robotId, initialTarget, revisionHistorySupported, cohortSupported, onOpenEvidence }: { robotId: string; initialTarget?: EpisodeDeepLinkTarget | null; revisionHistorySupported: boolean; cohortSupported: boolean; onOpenEvidence: (evidenceId: string) => void }) {
  const [collection, setCollection] = useState<EpisodeCollection | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(true);
  const [collectionMessage, setCollectionMessage] = useState("");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(() => initialTarget?.robotId === robotId ? initialTarget.episodeId : "");
  const [selectedRevision, setSelectedRevision] = useState<number | null>(() => initialTarget?.robotId === robotId ? initialTarget.revision : null);
  const [revisionHistory, setRevisionHistory] = useState<EpisodeRevisionCollection | null>(null);
  const [detail, setDetail] = useState<EpisodeDetail | null>(null);
  const [events, setEvents] = useState<EpisodeTimelineEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMessage, setDetailMessage] = useState("");
  const [timelineNotice, setTimelineNotice] = useState("");
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(() => initialTarget?.robotId === robotId ? initialTarget.eventId || "" : "");
  const [selectedFindingId, setSelectedFindingId] = useState(() => initialTarget?.robotId === robotId ? initialTarget.findingId || "" : "");
  const [selectedAssetId, setSelectedAssetId] = useState(() => initialTarget?.robotId === robotId ? initialTarget.assetId || "" : "");
  const [detailReload, setDetailReload] = useState(0);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [visibleLanes, setVisibleLanes] = useState<Set<EpisodeTimelineLane>>(new Set(TIMELINE_LANES));
  const [compareEpisodeId, setCompareEpisodeId] = useState(() => initialTarget?.robotId === robotId ? initialTarget.compareEpisodeId || "" : "");
  const [compareRevision, setCompareRevision] = useState<number | null>(() => initialTarget?.robotId === robotId ? initialTarget.compareRevision : null);
  const [comparison, setComparison] = useState<EpisodePairComparison | null>(null);
  const [comparisonInputs, setComparisonInputs] = useState<EpisodeComparisonInputs | null>(null);
  const [evidenceContext, setEvidenceContext] = useState<EpisodeEvidenceReferenceContext | null>(null);
  const [selectedComparisonEvidenceId, setSelectedComparisonEvidenceId] = useState(() => initialTarget?.robotId === robotId ? initialTarget.compareEvidenceId || "" : "");
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonMessage, setComparisonMessage] = useState("");
  const [cohortDays, setCohortDays] = useState<7 | 30 | 90>(() => initialTarget?.robotId === robotId ? initialTarget.cohortDays ?? 30 : 30);
  const [cohort, setCohort] = useState<EpisodeCohort | null>(null);
  const [cohortLoading, setCohortLoading] = useState(false);
  const [cohortMessage, setCohortMessage] = useState("");
  const collectionRequest = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  const comparisonRequest = useRef<AbortController | null>(null);
  const cohortRequest = useRef<AbortController | null>(null);
  const initialTargetConsumed = useRef(false);
  const pendingHandoffTarget = useRef<EpisodeDeepLinkTarget | null>(null);
  const [handoffValidation, setHandoffValidation] = useState<{ target: EpisodeDeepLinkTarget; evidenceId: string; occurrence: EpisodeEvidenceOccurrence } | null>(null);
  const [reviewLinkState, setReviewLinkState] = useState<"idle" | "copied" | "error">("idle");
  const [reviewLinkMessage, setReviewLinkMessage] = useState("");
  const [reviewHandoffIntent] = useState(() => readEpisodeReviewHandoff(window.location.href));
  const [reviewSessionState, setReviewSessionState] = useState<EpisodeReviewSessionState>("PENDING");

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
      const preferredEpisodeId = (initialTarget?.robotId === robotId ? initialTarget.episodeId : "") || value.items[0]?.episode_id || "";
      setSelectedEpisodeId((current) => current || preferredEpisodeId);
      setSelectedRevision((current) => current ?? value.items.find((item) => item.episode_id === preferredEpisodeId)?.revision ?? null);
    } catch (error) {
      if (controller.signal.aborted) return;
      setCollection(null);
      setEpisodes([]);
      setSelectedEpisodeId("");
      setSelectedRevision(null);
      setRevisionHistory(null);
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
    setRevisionHistory(null);
    setEvents([]);
    setNextCursor(null);
    setSelectedEventId("");
    setSelectedFindingId("");
    setSelectedAssetId("");
    setDetailMessage("");
    setTimelineNotice("");
    if (!selectedEpisodeId) return;
    const summary = episodes.find((item) => item.episode_id === selectedEpisodeId);
    const controller = new AbortController();
    detailRequest.current = controller;
    setDetailLoading(true);
    const pendingTarget = pendingHandoffTarget.current?.robotId === robotId && pendingHandoffTarget.current.episodeId === selectedEpisodeId ? pendingHandoffTarget.current : null;
    const deepTarget = pendingTarget || (!initialTargetConsumed.current && initialTarget?.robotId === robotId && initialTarget.episodeId === selectedEpisodeId ? initialTarget : null);
    const initiallyRequestedRevision = selectedRevision ?? deepTarget?.revision ?? summary?.revision ?? null;
    void (async () => {
      const history = revisionHistorySupported ? await readRevisionHistory(robotId, selectedEpisodeId, controller.signal) : null;
      const requestedRevision = initiallyRequestedRevision ?? history?.current_revision ?? null;
      const episodeDetail = await roloClient.episode(robotId, selectedEpisodeId, { signal: controller.signal }, revisionHistorySupported && requestedRevision !== null ? requestedRevision : undefined);
      if (history && !history.items.some((item) => item.revision === requestedRevision)) throw new Error(`Revision ${requestedRevision} is not present in the validated Episode history.`);
      if (!revisionHistorySupported && requestedRevision !== null && episodeDetail.revision !== requestedRevision) throw new Error(`Deep link pins revision ${requestedRevision}, but this rolo connection only exposes current revision ${episodeDetail.revision}.`);
      if (summary && requestedRevision === summary.revision && episodeDetail.revision !== summary.revision) throw new Error("Episode revision changed while opening Studio. Refresh the Episode list before continuing.");
      let timeline = await roloClient.episodeTimelinePage(robotId, selectedEpisodeId, episodeDetail.revision, { signal: controller.signal }, { limit: EPISODE_TIMELINE_PAGE_LIMIT });
      let accumulated = timeline.items;
      let cursor = timeline.next_cursor;
      const seenCursors = new Set<string>();
      while (((deepTarget?.eventId && !accumulated.some((item) => item.event_id === deepTarget.eventId)) || deepTarget?.findingId) && cursor && accumulated.length < EPISODE_VISIBLE_EVENT_LIMIT) {
        if (seenCursors.has(cursor)) throw new Error("Episode timeline cursor repeated; the bounded deep-link lookup was rejected.");
        seenCursors.add(cursor);
        const limit = Math.min(EPISODE_TIMELINE_PAGE_LIMIT, EPISODE_VISIBLE_EVENT_LIMIT - accumulated.length);
        timeline = await roloClient.episodeTimelinePage(robotId, selectedEpisodeId, episodeDetail.revision, { signal: controller.signal }, { limit, cursor });
        accumulated = appendTimelineEvents(accumulated, timeline.items);
        cursor = timeline.next_cursor;
      }
      if (controller.signal.aborted) return;
      if (pendingTarget === deepTarget) pendingHandoffTarget.current = null;
      initialTargetConsumed.current = true;
      setSelectedRevision(episodeDetail.revision);
      setRevisionHistory(history);
      setDetail(episodeDetail);
      setEvents(accumulated);
      setNextCursor(cursor);
      const deepEventFound = deepTarget?.eventId && accumulated.some((item) => item.event_id === deepTarget.eventId);
      const deepFindingFound = deepTarget?.findingId && episodeDetail.findings.some((item) => item.finding_id === deepTarget.findingId);
      const deepAssetFound = deepTarget?.assetId && episodeDetail.assets.some((item) => item.asset_id === deepTarget.assetId);
      setSelectedEventId(deepEventFound ? deepTarget.eventId || "" : accumulated[0]?.event_id || "");
      setSelectedFindingId(deepFindingFound ? deepTarget.findingId || "" : "");
      setSelectedAssetId(deepAssetFound ? deepTarget.assetId || "" : "");
      const notices: string[] = [];
      if (deepTarget?.eventId && !deepEventFound) notices.push(`Event ${deepTarget.eventId} is not present in the bounded ${EPISODE_VISIBLE_EVENT_LIMIT}-event view.`);
      if (deepTarget?.findingId && !deepFindingFound) notices.push(`Finding ${deepTarget.findingId} is not present in this published revision.`);
      if (deepTarget?.assetId && !deepAssetFound) notices.push(`Asset ${deepTarget.assetId} is not present in this published revision.`);
      if (cursor && accumulated.length >= EPISODE_VISIBLE_EVENT_LIMIT) notices.push(`The visible timeline is capped at ${EPISODE_VISIBLE_EVENT_LIMIT} events.`);
      setTimelineNotice(notices.join(" "));
      setVisibleLanes(new Set(episodeDetail.available_lanes));
    })().catch((error: unknown) => {
      if (!controller.signal.aborted) setDetailMessage(error instanceof Error ? error.message : "Episode Studio could not be read.");
    }).finally(() => {
      if (!controller.signal.aborted) setDetailLoading(false);
      if (detailRequest.current === controller) detailRequest.current = null;
    });
    return () => controller.abort();
  }, [robotId, selectedEpisodeId, selectedRevision, revisionHistorySupported, episodes, initialTarget, detailReload]);

  useEffect(() => {
    if (selectedEpisodeId !== compareEpisodeId || (revisionHistorySupported && selectedRevision !== compareRevision)) return;
    pendingHandoffTarget.current = null;
    comparisonRequest.current?.abort();
    setCompareEpisodeId("");
    setCompareRevision(null);
    setComparison(null);
    setComparisonInputs(null);
    setEvidenceContext(null);
    setSelectedComparisonEvidenceId("");
    setSelectedAssetId("");
    setHandoffValidation(null);
    setComparisonMessage("");
  }, [selectedEpisodeId, selectedRevision, compareEpisodeId, compareRevision, revisionHistorySupported]);

  useEffect(() => {
    comparisonRequest.current?.abort();
    setComparison(null);
    setComparisonInputs(null);
    setEvidenceContext(null);
    setComparisonMessage("");
    setComparisonLoading(false);
    if (!detail || detail.episode_id !== selectedEpisodeId || detail.revision !== selectedRevision || !compareEpisodeId || compareRevision === null) return;
    const controller = new AbortController();
    comparisonRequest.current = controller;
    setComparisonLoading(true);
    void Promise.all([
      readComparisonSide(robotId, detail.episode_id, detail.revision, controller.signal, revisionHistorySupported),
      readComparisonSide(robotId, compareEpisodeId, compareRevision, controller.signal, revisionHistorySupported),
    ]).then(([left, right]) => {
      if (controller.signal.aborted) return;
      const pair = buildEpisodePairComparison(left.detail, left.events, right.detail, right.events);
      const context = buildEpisodeEvidenceReferenceContext(pair, left.detail, left.events, right.detail, right.events);
      setComparison(pair);
      setComparisonInputs({ left, right });
      setEvidenceContext(context);
      setSelectedComparisonEvidenceId((current) => current && context.items.some((item) => item.evidenceId === current) ? current : "");
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setSelectedComparisonEvidenceId("");
        setSelectedAssetId("");
        setHandoffValidation(null);
        setComparisonMessage(error instanceof Error ? error.message : "Episode comparison could not be derived.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setComparisonLoading(false);
      if (comparisonRequest.current === controller) comparisonRequest.current = null;
    });
    return () => controller.abort();
  }, [robotId, detail, selectedEpisodeId, selectedRevision, compareEpisodeId, compareRevision, revisionHistorySupported]);

  useEffect(() => {
    cohortRequest.current?.abort();
    setCohort(null);
    setCohortMessage("");
    setCohortLoading(false);
    if (!cohortSupported || !detail) return;
    if (!detail.operation || !detail.test_case_id || !detail.expected_behavior?.trim()) {
      setCohortMessage("The pinned revision has no complete operation, test case, and expected-behavior identity. Exact matching was not relaxed.");
      return;
    }
    const controller = new AbortController();
    cohortRequest.current = controller;
    setCohortLoading(true);
    void roloClient.episodeCohort(
      robotId,
      detail.episode_id,
      detail.revision,
      { signal: controller.signal },
      { windowDays: cohortDays },
    ).then((value) => {
      if (!controller.signal.aborted) setCohort(value);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setCohortMessage(error instanceof Error ? error.message : "The exact-match cohort could not be read.");
    }).finally(() => {
      if (!controller.signal.aborted) setCohortLoading(false);
      if (cohortRequest.current === controller) cohortRequest.current = null;
    });
    return () => controller.abort();
  }, [robotId, detail, cohortDays, cohortSupported]);

  useEffect(() => {
    if (!detail || detail.episode_id !== selectedEpisodeId || detail.revision !== selectedRevision) return;
    const markerSafeNext = buildEpisodeReviewMarkerSafeNavigation({
      url: window.location.href,
      intent: reviewHandoffIntent,
      current: {
      robotId,
      episodeId: detail.episode_id,
      revision: detail.revision,
      eventId: selectedEventId || null,
      findingId: selectedFindingId || null,
      assetId: selectedComparisonEvidenceId ? selectedAssetId || null : null,
      compareEpisodeId: compareEpisodeId && (compareEpisodeId !== detail.episode_id || compareRevision !== detail.revision) ? compareEpisodeId : null,
      compareRevision: compareEpisodeId && (compareEpisodeId !== detail.episode_id || compareRevision !== detail.revision) ? compareRevision : null,
      compareEvidenceId: compareEpisodeId && (compareEpisodeId !== detail.episode_id || compareRevision !== detail.revision) ? selectedComparisonEvidenceId || null : null,
      cohortDays: cohortSupported ? cohortDays : null,
      },
    });
    const next = reviewSessionState === "RELEASED"
      ? buildEpisodeReviewSessionReleaseNavigation(markerSafeNext)
      : markerSafeNext;
    window.history.replaceState(null, "", next);
  }, [robotId, detail, selectedEpisodeId, selectedRevision, selectedEventId, selectedFindingId, selectedAssetId, compareEpisodeId, compareRevision, selectedComparisonEvidenceId, cohortDays, cohortSupported, reviewHandoffIntent, reviewSessionState]);

  useEffect(() => {
    setReviewLinkState("idle");
    setReviewLinkMessage("");
  }, [robotId, selectedEpisodeId, selectedRevision, selectedEventId, selectedFindingId, selectedAssetId, compareEpisodeId, compareRevision, selectedComparisonEvidenceId, cohortDays]);

  const copyReviewLink = async () => {
    setReviewLinkState("idle");
    setReviewLinkMessage("");
    try {
      if (!detail || detail.episode_id !== selectedEpisodeId || detail.revision !== selectedRevision || !detail.immutable) {
        throw new Error("Only an immutable, revision-pinned Episode can be handed off for review.");
      }
      const target = readEpisodeDeepLink(window.location.href);
      if (!target || target.robotId !== robotId || target.episodeId !== detail.episode_id || target.revision !== detail.revision) {
        throw new Error("The current Episode URL no longer matches the validated publication.");
      }
      if (target.eventId && !events.some((event) => event.event_id === target.eventId)) {
        throw new Error("The selected timeline event is not present in the validated bounded timeline.");
      }
      if (target.findingId && !detail.findings.some((finding) => finding.finding_id === target.findingId)) {
        throw new Error("The selected finding is not attached to this Episode revision.");
      }
      if (target.assetId && !detail.assets.some((asset) => asset.asset_id === target.assetId)) {
        throw new Error("The selected Asset metadata is not attached to this Episode revision.");
      }
      if (target.compareEpisodeId) {
        const comparisonMatches = comparison
          && comparison.left.robotId === robotId
          && comparison.left.episodeId === target.episodeId
          && comparison.left.revision === target.revision
          && comparison.right.episodeId === target.compareEpisodeId
          && comparison.right.revision === target.compareRevision
          && comparison.publication.left.immutable
          && comparison.publication.right.immutable;
        if (!comparisonMatches || comparisonLoading || !evidenceContext) {
          throw new Error("The revision-pinned comparison has not completed independent validation.");
        }
        const selectedContext = target.compareEvidenceId
          ? evidenceContext.items.find((item) => item.evidenceId === target.compareEvidenceId)
          : null;
        if (target.compareEvidenceId && !selectedContext) {
          throw new Error("The selected Evidence context is not visible in the validated comparison.");
        }
        if (target.assetId) {
          const occurrence = selectedContext?.left.items.find((item) => item.source === "ASSET"
            && item.role === "REFERENCE"
            && item.contextId === target.assetId);
          const focus = occurrence
            ? resolveEpisodeOccurrenceFocus(target.compareEvidenceId!, occurrence, detail, events)
            : null;
          if (focus?.kind !== "ASSET" || focus.assetId !== target.assetId) {
            throw new Error("The selected Asset focus is not attached to the validated Evidence context.");
          }
        }
      }
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable in this browser context.");
      }
      await writeEpisodeReviewHandoffLink(navigator.clipboard, window.location.href, target);
      setReviewLinkState("copied");
      setReviewLinkMessage("Canonical read-only review handoff copied.");
    } catch (error) {
      setReviewLinkState("error");
      setReviewLinkMessage(error instanceof Error ? error.message : "The review link could not be copied.");
    }
  };

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
  const currentReviewTarget = useMemo<EpisodeDeepLinkTarget | null>(() => {
    if (!detail) return null;
    const hasComparison = Boolean(compareEpisodeId && (compareEpisodeId !== detail.episode_id || compareRevision !== detail.revision));
    return {
      robotId,
      episodeId: detail.episode_id,
      revision: detail.revision,
      eventId: selectedEventId || null,
      findingId: selectedFindingId || null,
      assetId: selectedComparisonEvidenceId ? selectedAssetId || null : null,
      compareEpisodeId: hasComparison ? compareEpisodeId : null,
      compareRevision: hasComparison ? compareRevision : null,
      compareEvidenceId: hasComparison ? selectedComparisonEvidenceId || null : null,
      cohortDays: cohortSupported ? cohortDays : null,
    };
  }, [robotId, detail, selectedEventId, selectedFindingId, selectedAssetId, compareEpisodeId, compareRevision, selectedComparisonEvidenceId, cohortDays, cohortSupported]);
  const reviewReceipt = useMemo(() => assessEpisodeReviewReceipt({
    intent: reviewHandoffIntent,
    robotId,
    detail,
    events,
    detailLoading,
    detailError: detailMessage,
    comparison,
    evidenceContext,
    comparisonLoading,
    comparisonError: comparisonMessage,
  }), [reviewHandoffIntent, robotId, detail, events, detailLoading, detailMessage, comparison, evidenceContext, comparisonLoading, comparisonMessage]);
  useEffect(() => {
    setReviewSessionState((current) => advanceEpisodeReviewSession(current, reviewReceipt.status));
  }, [reviewReceipt.status]);
  const reviewAnchorContinuity = useMemo(() => deriveEpisodeReviewAnchorContinuity({
    intent: reviewHandoffIntent,
    anchorAccepted: reviewSessionState === "ACTIVE",
    current: currentReviewTarget,
    workbenchUrl: window.location.href,
  }), [reviewHandoffIntent, reviewSessionState, currentReviewTarget]);
  const endAnchoredReview = () => {
    setReviewSessionState((current) => releaseEpisodeReviewSession(current));
    window.history.replaceState(null, "", buildEpisodeReviewSessionReleaseNavigation(window.location.href));
  };
  const diagnosticFocus = useMemo(() => {
    if (!detail || !selectedFindingId) return null;
    return buildEpisodeDiagnosticFocus(detail, events, selectedFindingId);
  }, [detail, events, selectedFindingId]);
  const focusedEventIds = useMemo(() => diagnosticFocus ? new Set(diagnosticFocus.coincidentEvents.map((event) => event.eventId)) : null, [diagnosticFocus]);
  useEffect(() => {
    if (!selectedAssetId || comparisonLoading || !comparison || !evidenceContext || !detail) return;
    const contextItem = evidenceContext.items.find((item) => item.evidenceId === selectedComparisonEvidenceId);
    const occurrenceAttached = contextItem?.left.items.some((occurrence) => occurrence.source === "ASSET" && occurrence.contextId === selectedAssetId) || false;
    const assetAttached = detail.assets.some((asset) => asset.asset_id === selectedAssetId && asset.evidence_id === selectedComparisonEvidenceId);
    if (!occurrenceAttached || !assetAttached) {
      setSelectedAssetId("");
      return;
    }
    window.requestAnimationFrame(() => document.getElementById(`episode-asset-${selectedAssetId}`)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    }));
  }, [selectedAssetId, selectedComparisonEvidenceId, comparisonLoading, comparison, evidenceContext, detail]);
  useEffect(() => {
    if (!handoffValidation || comparisonLoading || !comparison || !evidenceContext || !detail) return;
    const target = handoffValidation.target;
    if (detail.robot_id !== target.robotId || detail.episode_id !== target.episodeId || detail.revision !== target.revision) return;
    const contextItem = evidenceContext.items.find((item) => item.evidenceId === handoffValidation.evidenceId);
    const occurrence = contextItem?.left.items.find((item) => item.source === handoffValidation.occurrence.source
      && item.role === handoffValidation.occurrence.role
      && item.contextId === handoffValidation.occurrence.contextId);
    const focus = occurrence ? resolveEpisodeOccurrenceFocus(handoffValidation.evidenceId, occurrence, detail, events) : null;
    const focusMatches = focus?.kind === "EVENT" ? focus.eventId === target.eventId
      : focus?.kind === "FINDING" ? focus.findingId === target.findingId
        : focus?.kind === "ASSET" ? focus.assetId === target.assetId
          : false;
    if (!focus || !focusMatches) {
      setSelectedEventId(events[0]?.event_id || "");
      setSelectedFindingId("");
      setSelectedAssetId("");
      setComparisonMessage("Right Context handoff source focus was cleared because its attachment changed after the orientation load.");
      setHandoffValidation(null);
      return;
    }
    if (focus.kind === "EVENT") {
      setVisibleLanes((current) => new Set(current).add(focus.lane));
      window.requestAnimationFrame(() => document.getElementById("episode-timeline")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center",
      }));
    }
    setHandoffValidation(null);
  }, [handoffValidation, comparisonLoading, comparison, evidenceContext, detail, events]);
  useEffect(() => {
    const first = diagnosticFocus?.coincidentEvents[0];
    if (!first) return;
    setSelectedEventId(first.eventId);
    setVisibleLanes((current) => {
      const next = new Set(current);
      for (const event of diagnosticFocus.coincidentEvents) next.add(event.lane);
      return next;
    });
    window.requestAnimationFrame(() => document.getElementById("episode-diagnostic-focus")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    }));
  }, [diagnosticFocus]);
  const compareOptions = useMemo(() => {
    const currentEpisodes = episodes
      .filter((item) => item.episode_id !== selectedEpisodeId)
      .map((item) => ({ episodeId: item.episode_id, revision: item.revision, label: `${item.task_label} · rev ${item.revision}` }));
    const historicalRevisions = revisionHistorySupported && detail && revisionHistory
      ? revisionHistory.items
        .filter((item) => item.revision !== detail.revision)
        .map((item) => ({ episodeId: detail.episode_id, revision: item.revision, label: `Same Episode · rev ${item.revision}${item.is_current ? " · current" : ""}` }))
      : [];
    return [...historicalRevisions, ...currentEpisodes];
  }, [episodes, selectedEpisodeId, detail, revisionHistory, revisionHistorySupported]);
  const comparisonKey = compareEpisodeId && compareRevision !== null ? `${compareEpisodeId}@@${compareRevision}` : "";
  const cohortReview = useMemo(() => cohort && detail ? buildEpisodeCohortReview(cohort, detail) : null, [cohort, detail]);
  const compareSelectionMissing = Boolean(comparisonKey) && !compareOptions.some((item) => `${item.episodeId}@@${item.revision}` === comparisonKey);
  const clearComparison = () => {
    pendingHandoffTarget.current = null;
    setHandoffValidation(null);
    comparisonRequest.current?.abort();
    setCompareEpisodeId("");
    setCompareRevision(null);
    setComparison(null);
    setComparisonInputs(null);
    setEvidenceContext(null);
    setSelectedComparisonEvidenceId("");
    setSelectedAssetId("");
    setComparisonMessage("");
    setComparisonLoading(false);
  };
  const chooseComparison = (key: string) => {
    if (!key) {
      clearComparison();
      return;
    }
    const option = compareOptions.find((item) => `${item.episodeId}@@${item.revision}` === key);
    if (!option) return;
    pendingHandoffTarget.current = null;
    setHandoffValidation(null);
    setComparisonInputs(null);
    setSelectedComparisonEvidenceId("");
    setSelectedAssetId("");
    setCompareEpisodeId(option.episodeId);
    setCompareRevision(option.revision);
  };
  const openCohortMember = (member: EpisodeCohortMember) => {
    clearComparison();
    setSelectedEpisodeId(member.episode_id);
    setSelectedRevision(member.revision);
    window.requestAnimationFrame(() => document.querySelector(".episode-page-title")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    }));
  };
  const compareCohortMember = (member: EpisodeCohortMember) => {
    if (!detail || (member.episode_id === detail.episode_id && member.revision === detail.revision)) return;
    comparisonRequest.current?.abort();
    setComparison(null);
    setComparisonInputs(null);
    setEvidenceContext(null);
    setSelectedComparisonEvidenceId("");
    setSelectedAssetId("");
    pendingHandoffTarget.current = null;
    setHandoffValidation(null);
    setComparisonMessage("");
    setComparisonLoading(false);
    setCompareEpisodeId(member.episode_id);
    setCompareRevision(member.revision);
    window.requestAnimationFrame(() => document.querySelector(".episode-compare-control")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    }));
  };
  const focusLeftOccurrence = (evidenceId: string, occurrence: EpisodeEvidenceOccurrence) => {
    if (!detail || !comparison
      || detail.robot_id !== comparison.left.robotId
      || detail.episode_id !== comparison.left.episodeId
      || detail.revision !== comparison.left.revision) return;
    const target = resolveEpisodeOccurrenceFocus(evidenceId, occurrence, detail, events);
    if (!target) return;
    if (target.kind === "EVENT") {
      setSelectedFindingId("");
      setSelectedAssetId("");
      setSelectedEventId(target.eventId);
      setVisibleLanes((current) => new Set(current).add(target.lane));
      window.requestAnimationFrame(() => document.getElementById("episode-timeline")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center",
      }));
      return;
    }
    if (target.kind === "FINDING") {
      setSelectedAssetId("");
      setSelectedFindingId(target.findingId);
      return;
    }
    setSelectedFindingId("");
    setSelectedAssetId(target.assetId);
  };
  const handoffRightOccurrence = (evidenceId: string, occurrence: EpisodeEvidenceOccurrence) => {
    if (!comparison || !evidenceContext || !comparisonInputs) return;
    const target = buildEpisodeRightContextHandoffTarget({
      comparison,
      evidenceContext,
      evidenceId,
      occurrence,
      rightDetail: comparisonInputs.right.detail,
      rightEvents: comparisonInputs.right.events,
      cohortDays: cohortSupported ? cohortDays : null,
    });
    if (!target || target.revision === null || target.compareEpisodeId === null || target.compareRevision === null) {
      setComparisonMessage("Right Context handoff was rejected because the selected source no longer matches the pinned right Episode.");
      return;
    }
    const next = buildEpisodeDeepLink(window.location.href, target);
    pendingHandoffTarget.current = target;
    setHandoffValidation({ target, evidenceId, occurrence });
    comparisonRequest.current?.abort();
    setComparison(null);
    setComparisonInputs(null);
    setEvidenceContext(null);
    setComparisonMessage("");
    setComparisonLoading(false);
    setSelectedEventId(target.eventId || "");
    setSelectedFindingId(target.findingId || "");
    setSelectedAssetId(target.assetId || "");
    setSelectedComparisonEvidenceId(evidenceId);
    setCompareEpisodeId(target.compareEpisodeId);
    setCompareRevision(target.compareRevision);
    setSelectedEpisodeId(target.episodeId);
    setSelectedRevision(target.revision);
    window.history.pushState(null, "", next);
  };

  if (collectionLoading && !collection) return <section className="content-view episode-view"><div className="page-title"><div><div className="eyebrow">Read-only execution record</div><h2>Episode Studio</h2><p>Loading published Episode revisions without inferring live runtime state.</p></div></div><div className="panel episode-state-view"><Pulse size={28} /><div><strong>Reading Episode index</strong><p>Only a feature-negotiated, versioned read model can populate this workspace.</p></div></div></section>;
  if (collectionMessage && !collection) return <section className="content-view episode-view"><div className="page-title"><div><div className="eyebrow">Read-only execution record</div><h2>Episode Studio</h2><p>Published execution history with explicit authority and verification boundaries.</p></div></div><div className="panel episode-state-view is-error"><WarningCircle size={28} weight="fill" /><div><strong>Episode read model unavailable</strong><p>{collectionMessage}</p><small>No Lifecycle or fixture data was substituted.</small><button className="secondary-button" onClick={() => void loadCollection()}>Retry Episode index</button></div></div></section>;
  if (collection && collection.total === 0) return <section className="content-view episode-view"><div className="page-title"><div><div className="eyebrow">Read-only execution record</div><h2>Episode Studio</h2><p>Published execution history with explicit authority and verification boundaries.</p></div></div><div className="panel episode-state-view is-empty"><Clock size={28} /><div><strong>No published Episodes</strong><p>rolo advertises the Episode read model, but this robot has no committed public revisions yet.</p><small>The workbench will not relabel Lifecycle runs as Episodes.</small></div></div></section>;

  return (
    <section className="content-view episode-view">
      <div className="page-title episode-page-title">
        <div><div className="eyebrow">Read-only execution record</div><h2>Episode Studio</h2><p>Sequence-ordered execution context, observations, inferences, and Verify-stage results.</p></div>
        {detail && <div className="episode-revision-tools">
          {revisionHistorySupported && revisionHistory && revisionHistory.items.length > 1 && <label className="select-control episode-revision-selector"><Clock size={14} /><select value={detail.revision} onChange={(event) => { clearComparison(); setSelectedRevision(Number(event.target.value)); }} aria-label="Select Episode revision">{revisionHistory.items.map((item) => <option key={item.revision} value={item.revision}>Revision {item.revision}{item.is_current ? " · current" : ""}</option>)}</select></label>}
          <div className="episode-review-link">
            <button className="secondary-button" disabled={!detail.immutable || comparisonLoading} onClick={() => void copyReviewLink()}><LinkSimple size={15} /> Copy review link</button>
            <small>Identifiers only · no Evidence or Asset content</small>
            {reviewLinkMessage && <span className={`is-${reviewLinkState}`} role={reviewLinkState === "error" ? "alert" : "status"}>{reviewLinkMessage}</span>}
          </div>
          <div className="episode-revision-lock"><ShieldCheck size={17} /><span><strong>Revision {detail.revision} pinned</strong><small>{detail.immutable ? "Immutable publication" : "Live publication"} · {detail.coverage.replaceAll("_", " ")}</small></span></div>
        </div>}
      </div>
      {reviewSessionState === "RELEASED" ? <section className="episode-review-receipt panel is-released" role="status" aria-label="Episode review session ended">
        <span className="episode-review-receipt-icon"><XCircle size={22} weight="fill" /></span>
        <div><span className="eyebrow">Shared review anchor · local session ended</span><h3>Anchored review ended for this tab</h3><p>The current Episode context remains open as ordinary navigation. Reopen the original shared link to start a new independently validated session.</p>
          <span className="episode-review-receipt-facts"><small>No review state was written back</small><small>No sender notification</small></span>
        </div>
      </section> : reviewAnchorContinuity.status === "EXPLORING" ? <section className="episode-review-receipt panel is-exploring" role="status" aria-label="Episode review anchor continuity">
        <span className="episode-review-receipt-icon"><Crosshair size={22} weight="fill" /></span>
        <div><span className="eyebrow">Shared review anchor · local exploration</span><h3>Exploring beyond the restored handoff</h3><p>The shared anchor remains immutable in this tab. Current exploration does not change what the sender handed off or create a new review claim. Current address is ordinary navigation and no longer carries the shared handoff marker.</p>
          <span className="episode-review-receipt-facts"><code>{reviewAnchorContinuity.target.episodeId}@{reviewAnchorContinuity.target.revision}</code>{reviewAnchorContinuity.differences.map((field) => <small key={field}>{field} changed</small>)}</span>
          <span className="episode-review-session-actions"><a className="secondary-button episode-review-anchor-return" href={reviewAnchorContinuity.returnLink}><ArrowRight size={14} /> Return to shared anchor</a><button className="secondary-button episode-review-session-end" type="button" onClick={endAnchoredReview}><XCircle size={14} /> End anchored review</button></span>
        </div>
      </section> : reviewReceipt.status !== "NONE" && <section className={`episode-review-receipt panel is-${reviewReceipt.status.toLowerCase()}`} role={reviewReceipt.status === "REJECTED" ? "alert" : "status"} aria-label="Episode review handoff receipt">
        <span className="episode-review-receipt-icon">{reviewReceipt.status === "ACCEPTED" ? <ShieldCheck size={22} weight="fill" /> : reviewReceipt.status === "REJECTED" ? <WarningCircle size={22} weight="fill" /> : <Pulse size={22} />}</span>
        <div><span className="eyebrow">Review handoff receipt · navigation only</span><h3>{reviewReceipt.title}</h3><p>{reviewReceipt.detail}</p>
          {reviewReceipt.status === "ACCEPTED" && <span className="episode-review-receipt-facts"><code>{reviewReceipt.targetLabel}</code><small>{reviewReceipt.comparison ? "Two pinned publications re-read" : "One pinned publication re-read"}</small><small>No sender authentication</small>{reviewAnchorContinuity.status === "ANCHORED" && <small>Shared anchor active for this tab</small>}</span>}
          {reviewReceipt.status === "ACCEPTED" && reviewSessionState === "ACTIVE" && <button className="secondary-button episode-review-session-end" type="button" onClick={endAnchoredReview}><XCircle size={14} /> End anchored review</button>}
        </div>
      </section>}
      <section className="episode-compare-control panel" aria-label="Episode pair selection">
        <div><ArrowsLeftRight size={18} /><span><h3>Compare a second published Episode</h3><p>Both revisions are read independently; differences remain descriptive and release-neutral.</p></span></div>
        <div className="episode-compare-picker">
          <label className="select-control"><ArrowsLeftRight size={14} /><select value={comparisonKey} onChange={(event) => chooseComparison(event.target.value)} disabled={!detail || (!compareOptions.length && !compareEpisodeId)} aria-label="Select Episode revision to compare"><option value="">No comparison</option>{compareSelectionMissing && <option value={comparisonKey}>{compareEpisodeId} · rev {compareRevision} · pinned deep link</option>}{compareOptions.map((item) => <option key={`${item.episodeId}-${item.revision}`} value={`${item.episodeId}@@${item.revision}`}>{item.label}</option>)}</select></label>
          {compareEpisodeId && <span className="episode-compare-pin"><small>RIGHT SIDE</small><strong>rev {compareRevision}</strong></span>}
        </div>
      </section>
      {comparisonLoading && <div className="episode-compare-state panel"><Pulse size={20} /><span><strong>Reading both pinned revisions</strong><small>Each side is bounded to {EPISODE_COMPARE_PAGE_BUDGET} timeline pages and {EPISODE_VISIBLE_EVENT_LIMIT} visible events.</small></span></div>}
      {comparisonMessage && <div className="episode-compare-state is-error panel" role="alert"><WarningCircle size={20} weight="fill" /><span><strong>Comparison or handoff rejected</strong><small>{comparisonMessage}</small></span></div>}
      {comparison && evidenceContext && <EpisodeComparisonView comparison={comparison} evidenceContext={evidenceContext} selectedEvidenceId={selectedComparisonEvidenceId || null} onSelectEvidenceContext={(evidenceId) => { setSelectedAssetId(""); setSelectedComparisonEvidenceId(evidenceId || ""); }} onFocusLeftOccurrence={focusLeftOccurrence} onHandoffRightOccurrence={handoffRightOccurrence} onClear={clearComparison} onOpenEvidence={onOpenEvidence} />}
      {cohortSupported && <EpisodeCohortView cohort={cohort} review={cohortReview} loading={cohortLoading} message={cohortMessage} windowDays={cohortDays} disabled={!detail || detailLoading} onWindowDays={setCohortDays} onOpenMember={openCohortMember} onCompareMember={compareCohortMember} />}
      <div className="episode-shell">
        <aside className="episode-index panel">
          <header><span>Published Episodes</span><strong>{collection?.total || episodes.length}</strong></header>
          <div className="episode-index-tools"><label className="search-box"><MagnifyingGlass size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Episode" aria-label="Search Episodes" /></label><label className="select-control"><Funnel size={14} /><select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} aria-label="Filter Episode state"><option value="all">All states</option><option value="RUNNING">Running</option><option value="COMPLETED">Completed</option><option value="FAILED">Failed</option><option value="CANCELLED">Cancelled</option><option value="PARTIAL">Partial</option></select></label></div>
          <div className="episode-index-list">{filteredEpisodes.map((item) => <EpisodeListItem key={`${item.episode_id}-${item.revision}`} item={item} active={item.episode_id === selectedEpisodeId && item.revision === selectedRevision} onClick={() => { pendingHandoffTarget.current = null; setHandoffValidation(null); if (item.episode_id === compareEpisodeId && item.revision === compareRevision) clearComparison(); else setSelectedComparisonEvidenceId(""); setSelectedEpisodeId(item.episode_id); setSelectedRevision(item.revision); }} />)}{!filteredEpisodes.length && <div className="episode-index-empty"><MagnifyingGlass size={20} /><span>No Episodes match this view.</span></div>}</div>
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
            <EpisodeTimeline detail={detail} events={events} selectedEventId={selectedEventId} visibleLanes={visibleLanes} focusedEventIds={focusedEventIds} onSelectEvent={(eventId) => { setSelectedAssetId(""); setSelectedEventId(eventId); }} />
            <div className="episode-timeline-footer"><span>Loaded {events.length} of {detail.event_count} sequence-ordered events · keyboard: arrows / Home / End</span>{nextCursor && events.length < EPISODE_VISIBLE_EVENT_LIMIT && <button className="secondary-button" disabled={timelineLoading} onClick={() => void loadMoreTimeline()}>{timelineLoading ? "Loading…" : "Load next pinned page"}</button>}</div>
            {timelineNotice && <div className="episode-timeline-notice" role="status"><Info size={16} /><span>{timelineNotice}</span></div>}
            {diagnosticFocus && <EpisodeDiagnosticFocusView focus={diagnosticFocus} onSelectEvent={setSelectedEventId} onOpenEvidence={onOpenEvidence} onClear={() => setSelectedFindingId("")} />}
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
          <div className="episode-finding-grid">{detail.findings.map((finding) => <EpisodeFindingCard key={finding.finding_id} finding={finding} active={finding.finding_id === selectedFindingId} onFocus={() => { setSelectedAssetId(""); setSelectedFindingId(finding.finding_id); }} />)}{!detail.findings.length && <div className="panel episode-section-empty"><Info size={18} /><span>No evidence-backed findings were published.</span></div>}</div>
        </section>

        <section className="episode-assets-section">
          <header><div><span>Metadata-only perspective tray</span><h3>Observation assets</h3></div><small>{detail.assets.length} records · bytes and storage locations withheld</small></header>
          <div className="episode-asset-grid">{detail.assets.map((asset) => <EpisodeAssetCard key={asset.asset_id} asset={asset} active={asset.asset_id === selectedAssetId} onOpenEvidence={onOpenEvidence} />)}{!detail.assets.length && <div className="panel episode-section-empty"><FileText size={18} /><span>No public asset metadata was published.</span></div>}</div>
        </section>

        {detail.limitations.length > 0 && <section className="episode-limitations panel"><header><WarningCircle size={17} weight="fill" /><span><strong>Episode limitations</strong><small>{detail.limitations.length} bounded diagnostics</small></span></header><ul>{detail.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></section>}
      </>}
    </section>
  );
}
