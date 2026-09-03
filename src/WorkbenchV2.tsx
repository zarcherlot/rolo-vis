import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Broadcast,
  CaretDown,
  CheckCircle,
  Clock,
  Code,
  Cpu,
  FileText,
  Gear,
  Graph,
  HardDrives,
  Info,
  MagnifyingGlass,
  Network,
  ShieldCheck,
  Stack,
  Target,
  X,
  Warning,
  Wrench,
  ClipboardText,
} from "@phosphor-icons/react";
import { createUserIntentReceipt } from "./contracts/association";
import { DEMO_ASSOCIATION } from "./associationData";
import { DEMO_CAPABILITIES, DEMO_EVIDENCE, DEMO_MHS, DEMO_ROBOT, DEMO_TOPOLOGY } from "./workbenchV2Data";
import { roloClient } from "./roloClient";
import type {
  CapabilitySummary,
  EvidenceRecord,
  EpisodeCollection,
  EpisodeDetail,
  EpisodeTimelinePage,
  EpisodeRevisionCollection,
  RobotCapability,
  RobotTopology,
  TopologyEdge,
  TopologyNode,
  MhsInventory,
  RkbProjection,
  ToolSurfaceReadModel,
  AssociationReport,
  UserIntentReceipt,
} from "./types/rolo";
import "./workbench-v2.css";

type Surface = "stack" | "rkb" | "tools" | "evidence" | "confirm" | "session";
type Status = "observed" | "partial" | "failed" | "unobserved";
type Layer = "Hardware" | "Linux" | "Middleware" | "Application";

const LAYERS: Layer[] = ["Hardware", "Linux", "Middleware", "Application"];

const layerIcon = {
  Hardware: HardDrives,
  Linux: Cpu,
  Middleware: Network,
  Application: Stack,
} as const;

function statusOf(state: string): Status {
  const normalized = state.toUpperCase();
  if (normalized === "OBSERVED" || normalized === "GATED" || normalized === "VERIFIED") return "observed";
  if (normalized === "PARTIAL" || normalized === "DEGRADED") return "partial";
  if (normalized === "FAILED" || normalized === "BLOCKED") return "failed";
  return "unobserved";
}

function statusLabel(status: Status) {
  return { observed: "Observed", partial: "Partial", failed: "Failed", unobserved: "Not observed" }[status];
}

function statusIcon(status: Status) {
  if (status === "observed") return <CheckCircle weight="fill" />;
  if (status === "partial") return <Warning weight="fill" />;
  if (status === "failed") return <X weight="bold" />;
  return <Info />;
}

function shortTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function iconForKind(kind: string) {
  if (kind.includes("sensor") || kind.includes("topic") || kind.includes("route")) return Broadcast;
  if (kind.includes("platform") || kind.includes("cpu")) return Cpu;
  if (kind.includes("network")) return Network;
  if (kind.includes("operation") || kind.includes("feature")) return Wrench;
  return Graph;
}

type DemoNode = (typeof DEMO_TOPOLOGY.nodes)[number];
type ViewNode = TopologyNode | DemoNode;
type ViewEdge = TopologyEdge | (typeof DEMO_TOPOLOGY.edges)[number];

function nodeId(node: ViewNode) {
  return "node_id" in node ? node.node_id : node.id;
}

function nodeLayer(node: ViewNode): Layer {
  return ("node_id" in node ? node.layer : node.layer === "ROS / Middleware" ? "Middleware" : node.layer) as Layer;
}

function nodeState(node: ViewNode): Status {
  return statusOf("state" in node ? node.state : node.status);
}

function nodeTitle(node: ViewNode) {
  return "node_id" in node ? node.label : node.label;
}

function nodeSubtitle(node: ViewNode) {
  return "node_id" in node ? node.subtitle : node.subtitle;
}

function nodeEvidence(node: ViewNode) {
  return "node_id" in node ? node.evidence_ids.length : node.evidence;
}

function nodeConfidence(node: ViewNode) {
  return Math.round(("node_id" in node ? node.confidence : ("confidence" in node ? node.confidence : 0.82)) * 100);
}

function edgeState(edge: ViewEdge) {
  return statusOf(edge.state);
}

function nodeAttributes(node: ViewNode) {
  return "node_id" in node ? node.attributes : {};
}

function SideRail({ surface, onSurface }: { surface: Surface; onSurface: (surface: Surface) => void }) {
  const items: Array<[Surface, string, typeof Graph]> = [
    ["stack", "Stack Map", Graph],
    ["rkb", "Robot Knowledge Base", Code],
    ["tools", "Tool Surface", Wrench],
    ["evidence", "Evidence", FileText],
    ["confirm", "Confirm", ClipboardText],
    ["session", "Session", ShieldCheck],
  ];
  return (
    <aside className="v2-rail">
      <div className="v2-brand" aria-label="rolo Workbench"><span>rolo</span><small>Workbench</small></div>
      <nav aria-label="Workbench surfaces">
        {items.map(([id, label, Icon]) => (
          <button key={id} className={`v2-rail-button ${surface === id ? "is-active" : ""}`} onClick={() => onSurface(id)} aria-label={label} aria-pressed={surface === id}>
            <Icon size={21} weight={surface === id ? "fill" : "regular"} /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="v2-rail-footer"><button className="v2-rail-button" aria-label="Read-only policy"><Gear size={20} /><span>Read-only policy</span></button><div className="v2-user">EL</div></div>
    </aside>
  );
}

function TopBar({ robot, robots, surface, mode, observedAt, onRobot }: { robot: RobotCapability | typeof DEMO_ROBOT; robots: Array<RobotCapability | typeof DEMO_ROBOT>; surface: Surface; mode: "live" | "demo" | "loading"; observedAt?: string; onRobot: (id: string) => void }) {
  const label = surface === "stack" ? "Stack Map" : surface === "rkb" ? "Robot Knowledge Base" : surface === "tools" ? "Tool Surface" : surface === "evidence" ? "Evidence" : surface === "confirm" ? "Confirm" : "Session";
  return <header className="v2-topbar">
    <div className="v2-robot-select"><span className={`v2-status-dot ${mode === "live" ? "is-live" : "is-demo"}`} />
      <select value={robot.robot_id} onChange={(event) => onRobot(event.target.value)} aria-label="Select robot">
        {robots.map((item) => <option key={item.robot_id} value={item.robot_id}>{item.robot_id}</option>)}
      </select><CaretDown size={14} />
    </div>
    <div className="v2-topbar-divider" /><h1>{label}</h1><div className="v2-topbar-spacer" />
    <div className="v2-snapshot"><Clock size={17} /><span>Snapshot: {shortTime(observedAt)}</span><CaretDown size={13} /></div>
    <div className={`v2-mode-pill ${mode}`}><span />{mode === "live" ? "Live" : mode === "loading" ? "Connecting" : "Demo data"}</div>
  </header>;
}

function LayerHeader({ layer, nodes }: { layer: Layer; nodes: ViewNode[] }) {
  const Icon = layerIcon[layer];
  const statuses = nodes.map(nodeState);
  const status: Status = statuses.length === 0 || statuses.every((item) => item === "unobserved") ? "unobserved" : statuses.includes("failed") ? "failed" : statuses.includes("partial") || statuses.includes("unobserved") ? "partial" : "observed";
  return <div className="v2-layer-head"><div className="v2-layer-name"><Icon size={16} />{layer === "Middleware" ? "ROS / Middleware" : layer}</div><div className={`v2-layer-status ${status}`}><span className="v2-status-dot" />{statusLabel(status)}</div></div>;
}

function TopologyCard({ node, selected, onSelect }: { node: ViewNode; selected: boolean; onSelect: () => void }) {
  const status = nodeState(node); const Icon = iconForKind("kind" in node ? node.kind : node.icon);
  return <button className={`v2-node-card ${selected ? "is-selected" : ""} status-${status}`} onClick={onSelect} aria-pressed={selected}>
    <span className="v2-node-icon"><Icon size={21} /></span><span className="v2-node-copy"><strong>{nodeTitle(node)}</strong><small>{nodeSubtitle(node)}</small></span><span className="v2-node-state" title={statusLabel(status)}>{statusIcon(status)}</span>
  </button>;
}

function Topology({ nodes, edges, selectedId, onSelect }: { nodes: ViewNode[]; edges: ViewEdge[]; selectedId: string; onSelect: (id: string) => void }) {
  const byLayer = useMemo(() => Object.fromEntries(LAYERS.map((layer) => [layer, nodes.filter((node) => nodeLayer(node) === layer)])) as Record<Layer, ViewNode[]>, [nodes]);
  const observedRelations = edges.filter((edge) => edgeState(edge) === "observed").length;
  const declaredRelations = edges.length - observedRelations;
  return <section className="v2-map-panel"><div className="v2-map-grid">
    {LAYERS.map((layer) => <div className="v2-layer-column" key={layer}><LayerHeader layer={layer} nodes={byLayer[layer]} /><div className="v2-node-list">{byLayer[layer].map((node) => <TopologyCard key={nodeId(node)} node={node} selected={nodeId(node) === selectedId} onSelect={() => onSelect(nodeId(node))} />)}</div></div>)}
  </div><div className="v2-map-legend"><span><i className="dot observed" />Observed</span><span><i className="dot partial" />Partial</span><span><i className="dot failed" />Failed</span><span><i className="dot unobserved" />Not observed</span><span className="line solid" />Observed relationship<span className="line dashed" />Declared (not observed)<b>{observedRelations} observed · {declaredRelations} declared</b></div></section>;
}

function Inspector({ node, allNodes, edges, evidence, onClose, onEvidence }: { node: ViewNode | null; allNodes: ViewNode[]; edges: ViewEdge[]; evidence: Array<EvidenceRecord | (typeof DEMO_EVIDENCE)[number]>; onClose: () => void; onEvidence: (id: string) => void }) {
  if (!node) return <aside className="v2-inspector is-empty"><Target size={42} /><h2>Select a stack element</h2><p>Choose a node to inspect its bounded evidence and relationships.</p></aside>;
  const id = nodeId(node); const status = nodeState(node); const upstream = edges.filter((edge) => edge.target === id).map((edge) => allNodes.find((item) => nodeId(item) === edge.source)).filter(Boolean) as ViewNode[]; const downstream = edges.filter((edge) => edge.source === id).map((edge) => allNodes.find((item) => nodeId(item) === edge.target)).filter(Boolean) as ViewNode[];
  const evidenceIds = "node_id" in node ? node.evidence_ids : [];
  const related = evidence.filter((item) => evidenceIds.length === 0 || evidenceIds.includes("evidence_id" in item ? item.evidence_id : item.id)).slice(0, 4);
    return <aside className="v2-inspector"><div className="v2-inspector-head"><div className="v2-inspector-title"><span className="v2-node-icon large"><Target size={27} /></span><div><h2>{nodeTitle(node)}</h2><small>{nodeSubtitle(node)}</small></div></div><button className="v2-icon-button" onClick={onClose} aria-label="Close inspector"><X size={18} /></button></div><div className="v2-inspector-badge"><span className={`v2-status-dot ${status}`} />{statusLabel(status)}</div><dl className="v2-facts"><div><dt>Layer</dt><dd>{nodeLayer(node) === "Middleware" ? "ROS / Middleware" : nodeLayer(node)}</dd></div><div><dt>Confidence</dt><dd>{nodeConfidence(node)}%</dd></div><div><dt>Evidence count</dt><dd>{nodeEvidence(node)}</dd></div><div><dt>Observed</dt><dd>{"observed_at" in node ? shortTime(String(node.observed_at)) : "Aug 20, 2026 10:24 AM"}</dd></div></dl>
    <section className="v2-inspector-section"><h3>What it does</h3><p>{"attributes" in node && Object.keys(node.attributes).length ? Object.entries(node.attributes).slice(0, 2).map(([key, value]) => `${key}: ${value}`).join(" · ") : `Observed ${nodeSubtitle(node)} in the ${nodeLayer(node).toLowerCase()} layer.`}</p></section>
    {upstream.length > 0 && <RelationGroup title={`Upstream (${upstream.length})`} nodes={upstream} />}{downstream.length > 0 && <RelationGroup title={`Downstream (${downstream.length})`} nodes={downstream} />}
    <section className="v2-inspector-section"><h3>Evidence trail</h3>{related.length ? related.map((item) => { const itemId = "evidence_id" in item ? item.evidence_id : item.id; return <button className="v2-evidence-link" key={itemId} onClick={() => onEvidence(itemId)}><span className={`v2-status-dot ${"authority" in item && item.authority === "GATED" ? "observed" : "partial"}`} /><span>{item.title}</span><ArrowUpRight size={14} /></button>; }) : <p className="v2-muted">No public evidence references are attached to this node.</p>}</section>
    <div className="v2-confidence"><span>Evidence confidence</span><strong>{nodeConfidence(node)}%</strong><div><i style={{ width: `${nodeConfidence(node)}%` }} /></div></div>
  </aside>;
}

function RelationGroup({ title, nodes }: { title: string; nodes: ViewNode[] }) { return <section className="v2-relation-group"><h3>{title}</h3>{nodes.map((node) => <div className="v2-relation" key={nodeId(node)}><span className={`v2-status-dot ${nodeState(node)}`} /><span><strong>{nodeTitle(node)}</strong><small>{nodeSubtitle(node)}</small></span><em>{statusLabel(nodeState(node))}</em></div>)}</section>; }

function ToolsSurface({ capabilities, mode, mhsData, toolData }: { capabilities: Array<CapabilitySummary | (typeof DEMO_CAPABILITIES)[number]>; mode: "live" | "demo" | "loading"; mhsData: MhsInventory | null; toolData: ToolSurfaceReadModel | null }) {
  const [query, setQuery] = useState(""); const filtered = capabilities.filter((item) => `${item.operation} ${item.description}`.toLowerCase().includes(query.toLowerCase()));
  const mhs = mhsData?.items ?? (mode === "demo" ? DEMO_MHS : []); const verified = toolData?.verified_count ?? mhs.filter((item) => item.tool_state === "VERIFIED").length; const registered = mhsData?.registered_count ?? mhs.filter((item) => item.registration === "REGISTERED").length;
  const stateFor = (item: CapabilitySummary | (typeof DEMO_CAPABILITIES)[number]) => toolData?.items.find((tool) => tool.operation_id === item.operation)?.state ?? ("availability" in item ? item.availability : "DISCOVERED");
  return <section className="v2-surface"><div className="v2-surface-heading"><div><p className="v2-eyebrow">Agent-native contract</p><h2>Tool Surface</h2><p>Only target-bound, read-only tools published by rolo are shown here.</p></div><div className="v2-readonly-note"><ShieldCheck size={18} />Read-only</div></div><div className="v2-tool-summary"><div><span>MHS discovered</span><strong>{mhs.length || "—"}</strong><small>{mhs.length ? `${registered} registered` : "Live MHS projection unavailable"}</small></div><div className="is-green"><span>Tools Verified</span><strong>{verified || "—"}</strong><small>{verified ? "available to the next Agent" : "requires independent Conformance"}</small></div><div><span>Agent-callable</span><strong>{(toolData?.agent_callable_count ?? verified) || "—"}</strong><small>typed arguments · bounded output</small></div></div>{mhs.length > 0 && <><div className="v2-subsection-heading"><h3>MHS devices</h3><span>manifest → provider → tool state</span></div><div className="v2-mhs-table"><div className="v2-mhs-row v2-mhs-header"><span>Device</span><span>Discovery</span><span>Registration</span><span>Tool state</span><span>Agent</span></div>{mhs.map((item) => <div className="v2-mhs-row" key={item.device_id}><span><strong>{item.device_id}</strong><small>{item.device_class} · {item.model}</small><small>manifest {item.manifest_sha256?.slice(0, 10) ?? "—"} · driver {item.driver_sha256?.slice(0, 10) ?? "—"}</small></span><span><i className="dot observed" />{item.discovery}</span><span><i className={`dot ${item.registration === "REGISTERED" ? "observed" : item.registration === "REJECTED" ? "failed" : "partial"}`} />{item.registration}</span><span><i className={`dot ${item.tool_state === "VERIFIED" ? "observed" : item.tool_state === "UNAVAILABLE" ? "failed" : "partial"}`} />{item.tool_state}</span><span className={item.callable ? "v2-callable" : "v2-not-callable"}>{item.callable ? "Callable" : "Blocked"}</span></div>)}</div></>}<div className="v2-subsection-heading"><h3>Published tools</h3><span>four semantic families · no command passthrough</span></div><label className="v2-search"><MagnifyingGlass size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter tool ids or descriptions" /></label><div className="v2-tool-table"><div className="v2-tool-row v2-tool-header"><span>Tool</span><span>Layer</span><span>Availability</span><span>Risk</span></div>{filtered.map((item) => { const toolRecord = toolData?.items.find((tool) => tool.operation_id === item.operation); const state = toolRecord?.state ?? stateFor(item); return <div className="v2-tool-row" key={item.operation}><span><strong>{item.operation}</strong><small>{toolRecord?.reason ?? item.description}</small>{toolRecord?.conformance_status && <small>conformance {toolRecord.conformance_status} · session {toolRecord.session_id?.slice(0, 10) ?? "—"}</small>}</span><span>{item.layer}</span><span><i className={`dot ${state === "VERIFIED" ? "observed" : state === "UNAVAILABLE" || state === "STALE" ? "failed" : "partial"}`} />{state}</span><span>{"risk" in item ? item.risk : "R0"}</span></div>; })}</div></section>;
}

function EvidenceSurface({ evidence, onEvidence }: { evidence: Array<EvidenceRecord | (typeof DEMO_EVIDENCE)[number]>; onEvidence: (id: string) => void }) { return <section className="v2-surface"><div className="v2-surface-heading"><div><p className="v2-eyebrow">Bounded public read model</p><h2>Evidence</h2><p>References stay sanitized; raw artifacts and host paths never enter the browser.</p></div><div className="v2-evidence-count">{evidence.length} records</div></div><div className="v2-evidence-list">{evidence.map((item) => { const id = "evidence_id" in item ? item.evidence_id : item.id; const authority = "authority" in item ? item.authority : item.integrity === "verified" ? "GATED" : "OBSERVED"; return <button key={id} className="v2-evidence-row" onClick={() => onEvidence(id)}><span className={`v2-evidence-mark ${authority.toLowerCase()}`}><FileText size={17} /></span><span className="v2-evidence-copy"><strong>{item.title}</strong><small>{item.summary}</small></span><span className="v2-evidence-meta"><b>{authority}</b><small>{shortTime("observed_at" in item ? item.observed_at : item.time)}</small></span><ArrowUpRight size={16} /></button>; })}</div></section>; }

function RkbValue({ label, value, status = "observed" }: { label: string; value: string; status?: Status }) { return <div className="v2-rkb-value"><span className={`v2-status-dot ${status}`} /><div><small>{label}</small><strong>{value}</strong></div></div>; }

function EpisodeDetailPanel({ detail, timeline, revisions, selectedRevision, loading, onClose, onEvidence, onRevision }: { detail: EpisodeDetail | null; timeline: EpisodeTimelinePage | null; revisions: EpisodeRevisionCollection | null; selectedRevision: number | null; loading: boolean; onClose: () => void; onEvidence: (id: string) => void; onRevision: (revision: number) => void }) {
  if (loading) return <article className="v2-rkb-card v2-rkb-wide v2-episode-detail"><div className="v2-rkb-card-head"><h3>Episode detail</h3><span className="v2-rkb-schema">Loading</span></div><p className="v2-muted">Reading the selected immutable publication…</p></article>;
  if (!detail) return null;
  const currentRevision = revisions?.items.find((item) => item.revision === revisions.current_revision) ?? null;
  const selectedRevisionSummary = revisions?.items.find((item) => item.revision === detail.revision) ?? null;
  return <article className="v2-rkb-card v2-rkb-wide v2-episode-detail"><div className="v2-rkb-card-head"><div><h3>{detail.task_label}</h3><small className="v2-muted">{detail.episode_id} · revision {detail.revision}</small></div><div className="v2-episode-actions">{revisions && revisions.items.length > 0 && <label>Revision <select value={detail.revision} onChange={(event) => onRevision(Number(event.target.value))}>{revisions.items.map((item) => <option key={item.revision} value={item.revision}>r{item.revision}{item.is_current ? " · current" : ""}</option>)}</select></label>}<button className="v2-icon-button" onClick={onClose} aria-label="Close Episode detail"><X size={17} /></button></div></div>{currentRevision && selectedRevisionSummary && detail.revision !== revisions?.current_revision && <div className="v2-episode-compare"><strong>Revision comparison</strong><span>r{detail.revision} vs current r{revisions?.current_revision}</span><small>events {selectedRevisionSummary.event_count} → {currentRevision.event_count} · assets {selectedRevisionSummary.asset_count} → {currentRevision.asset_count} · findings {selectedRevisionSummary.finding_count} → {currentRevision.finding_count}</small></div>}<div className="v2-episode-detail-meta"><span><b>{detail.state}</b><small>State</small></span><span><b>{detail.outcome}</b><small>Outcome</small></span><span><b>{detail.verification}</b><small>Verification</small></span><span><b>{detail.coverage}</b><small>Coverage</small></span></div><div className="v2-episode-detail-grid"><div><small>Timeline</small><strong>{timeline?.items.length ?? detail.event_count} events</strong></div><div><small>Assets</small><strong>{detail.assets.length}</strong></div><div><small>Findings</small><strong>{detail.findings.length}</strong></div><div><small>Evidence</small><strong>{detail.evidence_ids.length}</strong></div></div>{timeline?.items.length ? <div className="v2-episode-timeline">{timeline.items.slice(0, 8).map((event) => <div key={event.event_id}><span className="v2-status-dot observed" /><span><strong>{event.title}</strong><small>{event.lane} · {event.summary}</small></span><em>{event.offset_ms}ms</em></div>)}</div> : <p className="v2-muted">No published timeline events. {detail.limitations[0] ?? "The backend has not published event detail."}</p>}{timeline?.next_cursor && <div className="v2-episode-truncated"><Warning size={14} />Timeline truncated at the read-model page boundary; additional events are not shown.</div>}<div className="v2-episode-evidence-sections"><details open><summary>Assets ({detail.assets.length})</summary>{detail.assets.length ? detail.assets.map((asset) => <div className="v2-episode-reference" key={asset.asset_id}><span className={`v2-status-dot ${asset.availability === "AVAILABLE" ? "observed" : asset.availability === "MISSING" ? "failed" : "partial"}`} /><span><strong>{asset.source_label}</strong><small>{asset.asset_id} · {asset.modality} · {asset.media_type} · {asset.offset_ms}ms</small></span><em>{asset.availability}</em>{asset.evidence_id && <button className="v2-evidence-link" onClick={() => onEvidence(asset.evidence_id!)}>Evidence <ArrowUpRight size={13} /></button>}</div>) : <p className="v2-muted">No published assets.</p>}</details><details open><summary>Findings ({detail.findings.length})</summary>{detail.findings.length ? detail.findings.map((finding) => <div className="v2-episode-reference" key={finding.finding_id}><span className={`v2-status-dot ${finding.verification === "VERIFIED" ? "observed" : finding.verification === "UNVERIFIED" ? "partial" : "unobserved"}`} /><span><strong>{finding.title}</strong><small>{finding.kind} · {finding.summary}</small></span><em>{finding.confidence === null ? "—" : `${Math.round(finding.confidence * 100)}%`}</em>{finding.supporting_evidence_ids[0] && <button className="v2-evidence-link" onClick={() => onEvidence(finding.supporting_evidence_ids[0])}>Evidence <ArrowUpRight size={13} /></button>}</div>) : <p className="v2-muted">No published findings.</p>}</details></div><div className="v2-episode-limitations"><Info size={14} />{detail.limitations.join(" · ") || "Published read model"}</div></article>;
}

function RkbSurface({ robot, topology, capabilities, evidence, mode, projection, episodes, selectedEpisodeId, selectedEpisode, episodeTimeline, episodeRevisions = null, selectedRevision = null, episodeLoading, onOpenEpisode, onCloseEpisode, onEvidence, onRevision = () => {} }: { robot: RobotCapability | typeof DEMO_ROBOT; topology: ViewNode[]; capabilities: Array<CapabilitySummary | (typeof DEMO_CAPABILITIES)[number]>; evidence: Array<EvidenceRecord | (typeof DEMO_EVIDENCE)[number]>; mode: "live" | "demo" | "loading"; projection: RkbProjection | null; episodes: EpisodeCollection | null; selectedEpisodeId: string | null; selectedEpisode: EpisodeDetail | null; episodeTimeline: EpisodeTimelinePage | null; episodeRevisions?: EpisodeRevisionCollection | null; selectedRevision?: number | null; episodeLoading: boolean; onOpenEpisode: (id: string) => void; onCloseEpisode: () => void; onEvidence: (id: string) => void; onRevision?: (revision: number) => void }) {
  const hardware = topology.filter((node) => nodeLayer(node) === "Hardware"); const middleware = topology.filter((node) => nodeLayer(node) === "Middleware"); const appCapabilities = capabilities.filter((item) => item.layer === "Application");
  const platform = "platform" in robot ? Object.entries(robot.platform).slice(0, 3) : [["os", "Ubuntu 22.04"], ["arch", "aarch64"], ["ros", "Humble"]];
  const projectedState = projection?.sections.os_runtime.value && typeof projection.sections.os_runtime.value.state === "string" ? projection.sections.os_runtime.value.state : null;
  const currentState = projectedState ?? ("status" in robot ? String(robot.status).toUpperCase() : topology.some((node) => nodeState(node) === "failed") ? "DEGRADED" : topology.some((node) => nodeState(node) === "partial") ? "ATTENTION" : "READY");
  const evidenceCount = projection?.provenance.evidence_ids.length ?? evidence.length;
  const executableItems = projection?.sections.application.value && Array.isArray(projection.sections.application.value) ? projection.sections.application.value : [];
  const episodeItems = episodes?.items ?? (projection?.sections.episodes.value && Array.isArray(projection.sections.episodes.value) ? projection.sections.episodes.value : []);
  return <section className="v2-surface v2-rkb-surface"><div className="v2-surface-heading"><div><p className="v2-eyebrow">Typed projections · rkb-read-model-metadata/v1</p><h2>Robot Knowledge Base</h2><p>One evidence-backed view of identity, runtime, hardware, middleware, executables and capability state.</p></div><div className="v2-readonly-note"><Code size={17} />{projection ? "Live RKB" : mode === "live" ? "Derived projection" : "Demo projection"}</div></div><div className="v2-rkb-grid">
    <div className={`v2-rkb-state state-${currentState.toLowerCase()}`}><span className="v2-status-dot" /><div><small>Current robot state</small><strong>{currentState}</strong></div><span>derived from bounded read models · no write authority</span></div>
    <article className="v2-rkb-card v2-rkb-identity"><div className="v2-rkb-card-head"><h3>Identity</h3><span className="v2-rkb-schema">robot-snapshot-identity/v1</span></div><RkbValue label="Robot" value={robot.robot_id} /><RkbValue label="Access" value="READ_ONLY" /><RkbValue label="Collector" value={"collector_id" in robot ? String(robot.collector_id) : "native-probe"} /><RkbValue label="Observed" value={shortTime("observed_at" in robot ? robot.observed_at : DEMO_ROBOT.observed_at)} /></article>
    <article className="v2-rkb-card"><div className="v2-rkb-card-head"><h3>Runtime status</h3><span className="v2-rkb-schema">rkb-runtime-status/v1</span></div>{platform.map(([label, value]) => <RkbValue key={label} label={label} value={String(value)} />)}<RkbValue label="State" value="OBSERVED" /></article>
    <article className="v2-rkb-card v2-rkb-wide"><div className="v2-rkb-card-head"><h3>Hardware inventory</h3><span className="v2-rkb-schema">rkb-hardware-inventory/v1</span></div><div className="v2-rkb-items">{hardware.map((node) => <div key={nodeId(node)}><span className={`v2-status-dot ${nodeState(node)}`} /><span><strong>{nodeTitle(node)}</strong><small>{nodeSubtitle(node)}</small></span><em>{nodeState(node) === "unobserved" ? "UNKNOWN" : "STABLE"}</em></div>)}</div></article>
    <article className="v2-rkb-card v2-rkb-wide"><div className="v2-rkb-card-head"><h3>Middleware graph</h3><span className="v2-rkb-schema">rkb-middleware-graph/v1</span></div><div className="v2-rkb-items">{middleware.map((node) => <div key={nodeId(node)}><span className={`v2-status-dot ${nodeState(node)}`} /><span><strong>{nodeTitle(node)}</strong><small>{nodeSubtitle(node)}</small></span><em>{nodeState(node) === "partial" ? "UNSTABLE" : "OBSERVED"}</em></div>)}</div></article>
    <article className="v2-rkb-card"><div className="v2-rkb-card-head"><h3>Capability state</h3><span className="v2-rkb-schema">rkb-capability-record/v1</span></div><div className="v2-rkb-items compact">{appCapabilities.slice(0, 4).map((item) => <div key={item.operation}><span className={`v2-status-dot ${"availability" in item && item.availability === "UNAVAILABLE" ? "failed" : "observed"}`} /><span><strong>{item.operation}</strong><small>{item.description}</small></span><em>{"availability" in item ? item.availability : "ELIGIBLE"}</em></div>)}</div></article>
    <article className="v2-rkb-card v2-rkb-wide"><div className="v2-rkb-card-head"><h3>Executable inventory</h3><span className="v2-rkb-schema">rkb-executable/v1</span></div>{executableItems.length ? <div className="v2-rkb-items">{executableItems.slice(0, 6).map((item, index) => { const record = item as Record<string, unknown>; return <div key={String(record.executable_id ?? index)}><span className="v2-status-dot observed" /><span><strong>{String(record.name ?? record.executable_id ?? "UNKNOWN")}</strong><small>{String(record.source_kind ?? "OBSERVED")}</small></span><em>{record.observed === false ? "UNKNOWN" : "OBSERVED"}</em></div>; })}</div> : <p className="v2-muted">No executable observation is published in this snapshot.</p>}</article>
    <article className="v2-rkb-card v2-rkb-wide"><div className="v2-rkb-card-head"><h3>Episodes</h3><span className="v2-rkb-schema">rolo-episode-summary/v1</span></div>{episodeItems.length ? <div className="v2-rkb-items">{episodeItems.slice(0, 6).map((item, index) => { const record = item as Record<string, unknown>; const state = String(record.state ?? "UNKNOWN"); const id = String(record.episode_id ?? index); return <button className="v2-rkb-episode-row" key={id} onClick={() => onOpenEpisode(id)}><span className={`v2-status-dot ${state === "FAILED" ? "failed" : state === "RUNNING" ? "partial" : "observed"}`} /><span><strong>{String(record.task_label ?? id)}</strong><small>{id} · rev {String(record.revision ?? 1)}</small></span><em>{state}</em><ArrowUpRight size={14} /></button>; })}</div> : <p className="v2-muted">No Episode read model is present in this snapshot.</p>}</article>
    <article className="v2-rkb-card"><div className="v2-rkb-card-head"><h3>State & safety</h3><span className="v2-rkb-schema">rkb-state-safety/v1</span></div><RkbValue label="Safety status" value="UNKNOWN · no write authority" status="partial" /><RkbValue label="Evidence links" value={`${evidenceCount} public records`} /><RkbValue label="Limitations" value="No inferred defaults" status="partial" /></article>
  </div>{selectedEpisodeId && <EpisodeDetailPanel detail={selectedEpisode} timeline={episodeTimeline} revisions={episodeRevisions} selectedRevision={selectedRevision} loading={episodeLoading} onClose={onCloseEpisode} onEvidence={onEvidence} onRevision={onRevision} />}<div className="v2-rkb-footnote"><Info size={15} /><span>Unknown values are explicit. Static declarations and heuristic inference never promote a capability or influence release.<br /><code>snapshot: {projection?.snapshot_digest ?? "demo-fixture"}</code> · {evidenceCount} provenance-linked records</span></div></section>;
}

function ConfirmationSurface({ report, mode, receipt, onCreate }: { report: AssociationReport; mode: "live" | "demo" | "loading"; receipt: UserIntentReceipt | null; onCreate: (proposal: AssociationReport["proposals"][number]) => void }) {
  const proposal = report.proposals.find((item) => item.decision === "PROPOSED" && item.requires_user_confirmation) ?? null;
  return <section className="v2-surface v2-confirm-surface"><div className="v2-surface-heading"><div><p className="v2-eyebrow">Human confirmation gate</p><h2>Confirm an association</h2><p>Review the target, evidence and scope before creating a receipt artifact. This action never invokes a device or Write Execution.</p></div><div className="v2-readonly-note"><ShieldCheck size={17} />Receipt only</div></div><div className="v2-confirm-banner"><div><span>Target fingerprint</span><code>{report.target_fingerprint}</code></div><div><span>Snapshot</span><code>{report.snapshot_id}</code></div><div><span>Association</span><code>{report.association_id}</code></div></div>{proposal ? <article className="v2-confirm-card"><div className="v2-confirm-card-head"><div><p className="v2-eyebrow">{proposal.decision} · {Math.round(proposal.confidence * 100)}% confidence</p><h3>{proposal.operation_id}</h3><small>{proposal.resource_id ?? "No resource binding"}</small></div><span className="v2-risk-badge">Risk {proposal.operation_id.includes("send") ? "R2" : "R0"}</span></div><p>{proposal.rationale}</p><div className="v2-confirm-facts"><div><span>Evidence IDs</span><strong>{proposal.evidence_ids.join(" · ")}</strong></div><div><span>Limitations</span><strong>{proposal.limitations.join(" · ")}</strong></div><div><span>Parameter digest</span><strong>sha256: none supplied (read-only)</strong></div></div><button className="v2-primary-button" onClick={() => onCreate(proposal)} disabled={Boolean(receipt) || mode === "loading"}><ClipboardText size={16} />{receipt ? "Receipt created" : "Create UserIntentReceipt"}</button></article> : <div className="v2-empty-card"><Info size={24} /><strong>No confirmable proposal</strong><span>Only PROPOSED associations with evidence and an explicit confirmation requirement can reach this panel.</span></div>}{report.proposals.filter((item) => item !== proposal).map((item) => <div className="v2-secondary-proposal" key={item.operation_id}><span className={`v2-status-dot ${item.decision === "UNSUPPORTED" ? "failed" : "partial"}`} /><strong>{item.operation_id}</strong><em>{item.decision}</em><small>{item.rationale}</small></div>)}{receipt && <article className="v2-receipt-card"><div className="v2-rkb-card-head"><h3>UserIntentReceipt</h3><span className="v2-rkb-schema">immutable artifact · {receipt.status}</span></div><pre>{JSON.stringify(receipt, null, 2)}</pre><div className="v2-readonly-note"><ShieldCheck size={15} />Ready for a separate Trace sandbox; no execution was requested.</div></article>}<div className="v2-episode-limitations"><Info size={14} />{report.limitations.join(" · ")}</div></section>;
}

function SessionSurface({ health, robotId, mode }: { health: Awaited<ReturnType<typeof roloClient.health>> | null; robotId: string; mode: "live" | "demo" | "loading" }) { const features = health?.api_features ?? []; return <section className="v2-surface v2-session-surface"><div className="v2-surface-heading"><div><p className="v2-eyebrow">Probe-first boundary</p><h2>Read-only session</h2><p>This workbench can inspect published Tool Surface data, never execute commands or approve writes.</p></div><div className="v2-session-state"><span className={`v2-status-dot ${mode === "live" ? "observed" : "partial"}`} />{mode === "live" ? "Connected" : "Demo boundary"}</div></div><div className="v2-session-card"><div className="v2-session-icon"><ShieldCheck size={24} /></div><div><strong>{robotId}</strong><small>Target-bound session · browser authority: read-only</small></div><span className="v2-session-chip">No bearer secret in UI</span></div><div className="v2-contract-grid"><div><span>Control plane</span><strong>{health?.service ?? "rolo"}</strong></div><div><span>Server version</span><strong>{health?.version ?? "demo fixture"}</strong></div><div><span>API features</span><strong>{features.length || "fixture"}</strong></div><div><span>Mutation surface</span><strong>0 endpoints</strong></div></div><div className="v2-feature-list"><h3>Negotiated features</h3>{(features.length ? features : ["workbench.topology-read-model/v1", "workbench.tool-surface/v1", "workbench.evidence-read-model/v1"]).map((feature) => <div key={feature}><CheckCircle size={16} />{feature}</div>)}</div></section>; }

export function WorkbenchV2() {
  const [surface, setSurface] = useState<Surface>("stack"); const [mode, setMode] = useState<"loading" | "live" | "demo">("loading"); const [robots, setRobots] = useState<Array<RobotCapability | typeof DEMO_ROBOT>>([DEMO_ROBOT]); const [robotId, setRobotId] = useState(DEMO_ROBOT.robot_id); const [topology, setTopology] = useState<RobotTopology | null>(null); const [capabilities, setCapabilities] = useState<Array<CapabilitySummary | (typeof DEMO_CAPABILITIES)[number]>>([...DEMO_CAPABILITIES]); const [evidence, setEvidence] = useState<Array<EvidenceRecord | (typeof DEMO_EVIDENCE)[number]>>([...DEMO_EVIDENCE]); const [health, setHealth] = useState<Awaited<ReturnType<typeof roloClient.health>> | null>(null); const [rkbProjection, setRkbProjection] = useState<RkbProjection | null>(null); const [mhsInventory, setMhsInventory] = useState<MhsInventory | null>(null); const [toolSurface, setToolSurface] = useState<ToolSurfaceReadModel | null>(null); const [episodeCollection, setEpisodeCollection] = useState<EpisodeCollection | null>(null); const [association, setAssociation] = useState<AssociationReport | null>(null); const [receipt, setReceipt] = useState<UserIntentReceipt | null>(null); const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null); const [selectedEpisode, setSelectedEpisode] = useState<EpisodeDetail | null>(null); const [episodeRevisions, setEpisodeRevisions] = useState<EpisodeRevisionCollection | null>(null); const [selectedRevision, setSelectedRevision] = useState<number | null>(null); const [episodeTimeline, setEpisodeTimeline] = useState<EpisodeTimelinePage | null>(null); const [episodeLoading, setEpisodeLoading] = useState(false); const [selectedId, setSelectedId] = useState<string>(DEMO_TOPOLOGY.nodes[6].id); const [evidenceId, setEvidenceId] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; setMode("loading"); setRkbProjection(null); setMhsInventory(null); setToolSurface(null); setEpisodeCollection(null); setAssociation(null); setReceipt(null); setSelectedEpisodeId(null); setSelectedEpisode(null); setEpisodeRevisions(null); setSelectedRevision(null); setEpisodeTimeline(null); roloClient.bootstrapV2({}, robotId).then((result) => { if (!active) return; setHealth(result.health); if (result.robots.length) setRobots(result.robots); if (result.robot) setRobotId(result.robot.robot_id); if (result.rkb) setRkbProjection(result.rkb); if (result.mhs) setMhsInventory(result.mhs); if (result.tools) setToolSurface(result.tools); if (result.episodes) setEpisodeCollection(result.episodes); if (result.association) setAssociation(result.association); const live = result.mode === "live" && Boolean(result.rkb); setMode(live ? "live" : "demo"); setError(result.issues.length ? result.issues[0] : null); }).catch((reason: unknown) => { if (!active) return; setMode("demo"); setError(reason instanceof Error ? reason.message : "rolo is unreachable; showing demo data"); }); return () => { active = false; }; }, [robotId]);
  useEffect(() => { if (!selectedEpisodeId || mode !== "live") return; let active = true; setEpisodeLoading(true); Promise.all([roloClient.episode(robotId, selectedEpisodeId), roloClient.episodeRevisions(robotId, selectedEpisodeId)]).then(([detail, revisions]) => roloClient.episodeTimelinePage(robotId, selectedEpisodeId, detail.revision, undefined, { limit: 50 }).then((timeline) => { if (!active) return; setSelectedEpisode(detail); setEpisodeRevisions(revisions); setEpisodeTimeline(timeline); })).catch(() => { if (!active) return; setSelectedEpisode(null); setEpisodeRevisions(null); setEpisodeTimeline(null); setError("Episode detail is unavailable; summary remains visible."); }).finally(() => { if (active) setEpisodeLoading(false); }); return () => { active = false; }; }, [mode, robotId, selectedEpisodeId]);
  useEffect(() => { if (!selectedEpisodeId || mode !== "live" || selectedRevision === null || selectedRevision === selectedEpisode?.revision) return; let active = true; setEpisodeLoading(true); roloClient.episode(robotId, selectedEpisodeId, undefined, selectedRevision).then((detail) => roloClient.episodeTimelinePage(robotId, selectedEpisodeId, detail.revision, undefined, { limit: 50 }).then((timeline) => { if (active) { setSelectedEpisode(detail); setEpisodeTimeline(timeline); } })).catch(() => { if (active) setError("Selected Episode revision is unavailable; current publication remains visible."); }).finally(() => { if (active) setEpisodeLoading(false); }); return () => { active = false; }; }, [mode, robotId, selectedEpisodeId, selectedRevision, selectedEpisode?.revision]);
  const nodes: ViewNode[] = topology?.nodes ? [...topology.nodes] : [...DEMO_TOPOLOGY.nodes]; const edges: ViewEdge[] = topology?.edges ? [...topology.edges] : [...DEMO_TOPOLOGY.edges]; const selected = nodes.find((node) => nodeId(node) === selectedId) ?? nodes[0] ?? null; const activeEvidence = evidenceId ? evidence.find((item) => ("evidence_id" in item ? item.evidence_id : item.id) === evidenceId) : null; const associationReport = association ?? DEMO_ASSOCIATION;
  const createReceipt = (proposal: AssociationReport["proposals"][number]) => { try { setReceipt(createUserIntentReceipt(proposal, associationReport, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", proposal.operation_id.includes("send") ? "R2" : "R0")); } catch (reason) { setError(reason instanceof Error ? reason.message : "Receipt creation was rejected by the contract."); } };
  return <div className="v2-shell"><SideRail surface={surface} onSurface={setSurface} /><TopBar robot={robots.find((item) => item.robot_id === robotId) ?? robots[0]} robots={robots} surface={surface} mode={mode} observedAt={topology?.observed_at ?? DEMO_TOPOLOGY.observed_at} onRobot={setRobotId} /><main className="v2-main">{error && <div className="v2-banner"><Info size={16} /><span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss notice"><X size={15} /></button></div>}{surface === "stack" && <div className="v2-stack-layout"><Topology nodes={nodes} edges={edges} selectedId={selected ? nodeId(selected) : ""} onSelect={setSelectedId} /><Inspector node={selected} allNodes={nodes} edges={edges} evidence={evidence} onClose={() => setSelectedId("")} onEvidence={setEvidenceId} /></div>}{surface === "rkb" && <RkbSurface robot={robots.find((item) => item.robot_id === robotId) ?? DEMO_ROBOT} topology={nodes} capabilities={capabilities} evidence={evidence} mode={mode} projection={rkbProjection} episodes={episodeCollection} selectedEpisodeId={selectedEpisodeId} selectedEpisode={selectedEpisode} episodeRevisions={episodeRevisions} selectedRevision={selectedRevision} episodeTimeline={episodeTimeline} episodeLoading={episodeLoading} onOpenEpisode={(id) => { setSelectedEpisodeId(id); setSelectedRevision(null); if (mode !== "live") setError("Episode detail requires a live published RKB; the summary remains visible in demo mode."); }} onCloseEpisode={() => { setSelectedEpisodeId(null); setSelectedEpisode(null); setEpisodeRevisions(null); setSelectedRevision(null); setEpisodeTimeline(null); }} onEvidence={setEvidenceId} onRevision={setSelectedRevision} />}{surface === "tools" && <ToolsSurface capabilities={capabilities} mode={mode} mhsData={mhsInventory} toolData={toolSurface} />}{surface === "evidence" && <EvidenceSurface evidence={evidence} onEvidence={setEvidenceId} />}{surface === "confirm" && <ConfirmationSurface report={associationReport} mode={mode} receipt={receipt} onCreate={createReceipt} />}{surface === "session" && <SessionSurface health={health} robotId={robotId} mode={mode} />}</main>{activeEvidence && <div className="v2-modal-backdrop" onClick={() => setEvidenceId(null)}><section className="v2-evidence-modal" onClick={(event) => event.stopPropagation()}><div className="v2-modal-head"><div><p className="v2-eyebrow">Evidence record</p><h2>{activeEvidence.title}</h2></div><button className="v2-icon-button" onClick={() => setEvidenceId(null)} aria-label="Close evidence"><X size={18} /></button></div><p>{activeEvidence.summary}</p><dl className="v2-modal-facts"><div><dt>Authority</dt><dd>{"authority" in activeEvidence ? activeEvidence.authority : activeEvidence.integrity === "verified" ? "GATED" : "OBSERVED"}</dd></div><div><dt>Reference</dt><dd>{"reference_hint" in activeEvidence ? activeEvidence.reference_hint : activeEvidence.ref}</dd></div><div><dt>Observed</dt><dd>{shortTime("observed_at" in activeEvidence ? activeEvidence.observed_at : activeEvidence.time)}</dd></div></dl><div className="v2-readonly-note"><ShieldCheck size={17} />Reference only · raw artifact bytes withheld</div></section></div>}</div>;
}

export default WorkbenchV2;
