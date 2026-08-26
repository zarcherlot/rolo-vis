import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Clock, Crosshair, FileText, Info, Pulse, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { appendObservationBundlePage, validateCompleteObservationBundleHistory } from "./contracts/episodeObservation.ts";
import { RoloApiError, roloClient } from "./roloClient.ts";
import type {
  EpisodeDetail,
  EpisodeObservationBundleSummary,
  EpisodeObservationSourceAvailability,
  EpisodeObservationSpatialAlignment,
  EpisodeObservationWorldScope,
  EpisodeSynchronization,
  EpisodeTimelineEvent,
  EpisodeWorldKind,
} from "./types/rolo.ts";
import "./episode-observation.css";

const PAGE_LIMIT = 20;
const PAGE_BUDGET = 5;

const WORLD_SCOPE_LABELS: Record<EpisodeObservationWorldScope, string> = {
  NONE: "No asset-bearing source",
  PHYSICAL_ONLY: "Physical only",
  SIMULATED_ONLY: "Simulated only",
  REPLAYED_ONLY: "Replayed only",
  MIXED: "Mixed input",
};

const WORLD_KIND_LABELS: Record<EpisodeWorldKind, string> = {
  PHYSICAL: "Physical",
  SIMULATED: "Simulated",
  REPLAYED: "Replayed",
};

const AVAILABILITY_LABELS: Record<EpisodeObservationSourceAvailability, string> = {
  AVAILABLE: "Available",
  MISSING: "Missing declaration",
  STALE: "Stale publication",
  REJECTED: "Rejected by policy",
  UNAVAILABLE: "Source unavailable",
};

const SYNCHRONIZATION_LABELS: Record<EpisodeSynchronization, string> = {
  SYNCED: "Synced",
  DEGRADED: "Degraded time",
  UNSYNCED: "Unsynced",
  UNKNOWN: "Time unknown",
};

const SPATIAL_LABELS: Record<EpisodeObservationSpatialAlignment, string> = {
  ALIGNED: "Aligned",
  DEGRADED: "Degraded spatial",
  UNALIGNED: "Unaligned",
  UNKNOWN: "Spatial unknown",
};

function formatOffset(offsetMs: number): string {
  if (offsetMs < 1000) return `${offsetMs} ms`;
  return `${(offsetMs / 1000).toFixed(offsetMs < 10_000 ? 1 : 0)} s`;
}

function evidenceIdsFor(detail: EpisodeDetail, events: EpisodeTimelineEvent[]): Set<string> {
  const ids = new Set(detail.evidence_ids);
  detail.assets.forEach((asset) => asset.evidence_id && ids.add(asset.evidence_id));
  detail.findings.forEach((finding) => {
    finding.supporting_evidence_ids.forEach((id) => ids.add(id));
    finding.contradicting_evidence_ids.forEach((id) => ids.add(id));
  });
  events.forEach((event) => event.evidence_ids.forEach((id) => ids.add(id)));
  return ids;
}

function ObservationBundleHistory({
  items,
  selectedId,
  onSelect,
}: {
  items: EpisodeObservationBundleSummary[];
  selectedId: string;
  onSelect: (bundleId: string) => void;
}) {
  return <aside className="episode-observation-history">
    <header><span>Bundle history</span><strong>{items.length}</strong></header>
    <div>{items.map((item) => <button key={item.bundle_id} className={item.bundle_id === selectedId ? "is-active" : ""} onClick={() => onSelect(item.bundle_id)} aria-pressed={item.bundle_id === selectedId}>
      <span className="episode-observation-sequence">#{item.sequence}</span>
      <span><strong>{item.trigger_kind === "INITIAL" ? "Initial bundle" : "Supplementary bundle"}</strong><small>{formatOffset(item.window_start_offset_ms)} → {formatOffset(item.window_end_offset_ms)}</small></span>
      <em className={`is-${item.status.toLowerCase()}`}>{item.status}</em>
    </button>)}</div>
  </aside>;
}

function ObservationSourceCard({
  source,
  onFocusAsset,
}: {
  source: EpisodeObservationBundleSummary["sources"][number];
  onFocusAsset: (assetId: string) => void;
}) {
  return <article className={`episode-observation-source is-${source.availability.toLowerCase()}`}>
    <header>
      <div><Crosshair size={16} weight="fill" /><span><strong>{source.label}</strong><small>{source.source_kind.replaceAll("_", " ")} · {source.modality}</small></span></div>
      <em>{AVAILABILITY_LABELS[source.availability]}</em>
    </header>
    <div className="episode-observation-tags">
      <span className={`is-${source.world_kind.toLowerCase()}`}>{WORLD_KIND_LABELS[source.world_kind]}</span>
      <span>{SYNCHRONIZATION_LABELS[source.synchronization]}</span>
      <span>{SPATIAL_LABELS[source.spatial_alignment]}</span>
    </div>
    {source.asset_ids.length > 0 && <div className="episode-observation-references"><span>Published assets</span>{source.asset_ids.map((assetId) => <button key={assetId} onClick={() => onFocusAsset(assetId)}><FileText size={13} /><code>{assetId}</code><ArrowRight size={12} /></button>)}</div>}
    {source.limitations.length > 0 && <ul>{source.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>}
  </article>;
}

export function EpisodeObservationTray({
  detail,
  events,
  onFocusAsset,
  onOpenEvidence,
  onEpisodeUnavailable,
}: {
  detail: EpisodeDetail;
  events: EpisodeTimelineEvent[];
  onFocusAsset: (assetId: string) => void;
  onOpenEvidence: (evidenceId: string) => void;
  onEpisodeUnavailable: (message: string) => void;
}) {
  const [items, setItems] = useState<EpisodeObservationBundleSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [historyComplete, setHistoryComplete] = useState(false);
  const [collectionLimitations, setCollectionLimitations] = useState<string[]>([]);
  const request = useRef<AbortController | null>(null);
  const evidenceIds = useMemo(() => evidenceIdsFor(detail, events), [detail, events]);
  const evidenceKey = useMemo(() => [...evidenceIds].sort().join("\u0000"), [evidenceIds]);

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setItems([]);
    setSelectedId("");
    setMessage("");
    setHistoryComplete(false);
    setCollectionLimitations([]);
    setLoading(true);
    if (!detail.immutable || !detail.ended_at) {
      setMessage("Observation Bundles require a closed, immutable Episode revision.");
      setLoading(false);
      return;
    }
    const validation = {
      episodeDurationMs: Date.parse(detail.ended_at) - Date.parse(detail.started_at),
      assetIds: new Set(detail.assets.map((asset) => asset.asset_id)),
      evidenceIds,
    };
    let accumulated: EpisodeObservationBundleSummary[] = [];
    let cursor: string | undefined;
    const seenCursors = new Set<string>();
    try {
      for (let pageIndex = 0; pageIndex < PAGE_BUDGET; pageIndex += 1) {
        let page;
        try {
          page = await roloClient.episodeObservationBundlePage(
            detail.robot_id,
            detail.episode_id,
            detail.revision,
            validation,
            { signal: controller.signal },
            { limit: PAGE_LIMIT, cursor },
          );
        } catch (error) {
          if (controller.signal.aborted) return;
          if (error instanceof RoloApiError && error.status === 404) throw error;
          if (accumulated.length > 0) {
            setItems(accumulated);
            setSelectedId(accumulated[0]?.bundle_id || "");
            setMessage(`Bundle history is bounded and incomplete: ${error instanceof Error ? error.message : "a later page failed."}`);
            return;
          }
          throw error;
        }
        if (controller.signal.aborted) return;
        accumulated = appendObservationBundlePage(accumulated, page.items);
        if (pageIndex === 0) setCollectionLimitations(page.limitations);
        if (page.next_cursor === null) {
          validateCompleteObservationBundleHistory(accumulated);
          setHistoryComplete(true);
          setItems(accumulated);
          setSelectedId((current) => accumulated.some((item) => item.bundle_id === current) ? current : accumulated[0]?.bundle_id || "");
          return;
        }
        if (seenCursors.has(page.next_cursor)) throw new Error("Observation Bundle cursor repeated.");
        seenCursors.add(page.next_cursor);
        cursor = page.next_cursor;
      }
      setItems(accumulated);
      setSelectedId(accumulated[0]?.bundle_id || "");
      setMessage("Bundle history exceeds the bounded 100-record Perspective Tray.");
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof RoloApiError && error.status === 404) {
        onEpisodeUnavailable("The pinned Episode identity became stale while reading Observation Bundles. Refresh the Episode index before continuing.");
        return;
      }
      setItems([]);
      setSelectedId("");
      setCollectionLimitations([]);
      setMessage(error instanceof Error ? error.message : "Observation Bundle history was rejected.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      if (request.current === controller) request.current = null;
    }
  }, [detail, evidenceIds, evidenceKey, onEpisodeUnavailable]);

  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);

  const selected = items.find((item) => item.bundle_id === selectedId) || items[0] || null;
  const availableSourceCount = selected?.sources.filter((source) => source.availability === "AVAILABLE").length || 0;
  const parentResolved = selected?.parent_bundle_id ? items.some((item) => item.bundle_id === selected.parent_bundle_id) : true;

  return <section className="episode-observation panel" aria-label="Observation Bundle Perspective Tray">
    <header className="episode-observation-heading">
      <div><Crosshair size={19} weight="fill" /><span><small>Read-only Perspective Tray</small><h3>Observation Bundles</h3><p>Sanitized source coverage for the pinned revision; completeness never changes verification.</p></span></div>
      <span className="episode-observation-pin"><ShieldCheck size={14} /><strong>rev {detail.revision}</strong><small>metadata only</small></span>
    </header>
    {loading && items.length === 0 && <div className="episode-observation-state"><Pulse size={20} /><span><strong>Reading published bundle history</strong><small>Every page remains pinned to Episode revision {detail.revision}.</small></span></div>}
    {message && items.length === 0 && <div className="episode-observation-state is-error" role="alert"><WarningCircle size={20} weight="fill" /><span><strong>Perspective Tray closed</strong><small>{message}</small></span><button className="secondary-button" onClick={() => void load()}>Retry exact revision</button></div>}
    {!loading && !message && items.length === 0 && <div className="episode-observation-state is-empty"><Info size={20} /><span><strong>No published observation bundles for this revision</strong><small>No fixture or asset metadata was substituted.</small></span></div>}
    {items.length > 0 && <>
      {message && <div className="episode-observation-bounded" role="status"><WarningCircle size={15} weight="fill" /><span><strong>Bounded history</strong><small>{message}</small></span></div>}
      <div className="episode-observation-shell">
        <ObservationBundleHistory items={items} selectedId={selected?.bundle_id || ""} onSelect={setSelectedId} />
        {selected && <div className="episode-observation-detail">
          <header><div><span>Bundle #{selected.sequence}</span><h4>{selected.trigger_kind === "INITIAL" ? "Initial observation window" : "Supplementary observation window"}</h4><code>{selected.bundle_id}</code></div><em className={`is-${selected.status.toLowerCase()}`}>{selected.status}</em></header>
          <dl className="episode-observation-coverage">
            <div><dt>Time alignment</dt><dd>{SYNCHRONIZATION_LABELS[selected.synchronization]}</dd></div>
            <div><dt>Spatial alignment</dt><dd>{SPATIAL_LABELS[selected.spatial_alignment]}</dd></div>
            <div><dt>World scope</dt><dd>{WORLD_SCOPE_LABELS[selected.world_scope]}</dd></div>
            <div><dt>Available sources</dt><dd>{availableSourceCount} / {selected.sources.length}</dd></div>
          </dl>
          <div className="episode-observation-authority"><Info size={14} /><span><strong>{selected.status === "COMPLETE" ? "Declared inputs assembled" : "Coverage is explicitly incomplete"}</strong><small>This is source coverage only—not outcome, cause, confirmation, readiness, or verification.</small></span></div>
          {selected.parent_bundle_id && <div className={`episode-observation-parent ${parentResolved ? "is-resolved" : "is-unresolved"}`}><Clock size={13} /><span>Parent <code>{selected.parent_bundle_id}</code></span><em>{parentResolved ? "Resolved" : historyComplete ? "Rejected" : "Outside loaded history"}</em></div>}
          <div className="episode-observation-source-grid">{selected.sources.map((source) => <ObservationSourceCard key={source.source_id} source={source} onFocusAsset={onFocusAsset} />)}</div>
          {selected.evidence_ids.length > 0 && <div className="episode-observation-evidence"><span>Sanitized Evidence references</span>{selected.evidence_ids.map((evidenceId) => <button key={evidenceId} onClick={() => onOpenEvidence(evidenceId)}><ShieldCheck size={13} /><code>{evidenceId}</code><ArrowRight size={12} /></button>)}</div>}
          {selected.limitations.length > 0 && <div className="episode-observation-limitations"><WarningCircle size={14} weight="fill" /><ul>{selected.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></div>}
        </div>}
      </div>
      {collectionLimitations.length > 0 && <footer className="episode-observation-collection-limitations"><WarningCircle size={14} /><ul>{collectionLimitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></footer>}
    </>}
  </section>;
}
