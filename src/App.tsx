import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  Broadcast,
  Camera,
  CaretDown,
  CheckCircle,
  Clock,
  Cpu,
  Crosshair,
  Cube,
  FileText,
  Funnel,
  Gear,
  GitBranch,
  HardDrive,
  House,
  Info,
  MagnifyingGlass,
  Network,
  Path,
  Pulse,
  ShieldCheck,
  Stack,
  Target,
  TreeStructure,
  Warning,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { Background, Controls, Handle, Position, ReactFlow } from "@xyflow/react";
import type { Edge, Node, NodeMouseHandler, NodeProps, ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  CAPABILITIES,
  DEMO_PIPELINE,
  DEMO_ROBOT,
  EVIDENCE,
  TOPOLOGY_EDGES,
  TOPOLOGY_NODES,
} from "./demoData";
import type {
  DemoRobot,
  EvidenceItem,
  PipelineRow,
  TopologyIcon,
  TopologyNodeData,
  TopologyStatus,
} from "./demoData";
import { RoloApiError, roloClient } from "./roloClient";
import type {
  CapabilityDetail,
  CapabilitySummary,
  EvidenceAuthority,
  EvidenceCollection,
  EvidenceRecord,
  RobotCapability,
  RobotOverview,
  RobotTopology,
} from "./types/rolo";
import { getOverviewPresentation, getSurfaceSource } from "./workbenchPolicy";
import type { WorkbenchMode } from "./workbenchPolicy";

type NavId = "overview" | "stack" | "capabilities" | "lifecycle" | "evidence";
type ViewRobot = DemoRobot | (RobotCapability & { status: "online" });
type RobotOption = DemoRobot | RobotCapability;
type OpenEvidence = (item: EvidenceItem | string) => void;

const NAV_ITEMS: Array<{ id: NavId; label: string; icon: typeof House }> = [
  { id: "overview", label: "Overview", icon: House },
  { id: "stack", label: "Stack Map", icon: GitBranch },
  { id: "capabilities", label: "Capabilities", icon: Stack },
  { id: "lifecycle", label: "Lifecycle", icon: Clock },
  { id: "evidence", label: "Evidence", icon: FileText },
];

const nodeIcons: Record<TopologyIcon, typeof Cube> = {
  sensor: Broadcast,
  pulse: Pulse,
  target: Target,
  camera: Camera,
  cpu: Cpu,
  network: Network,
  clock: Clock,
  storage: HardDrive,
  cube: Cube,
  radio: Broadcast,
  crosshair: Crosshair,
  tree: TreeStructure,
  route: Path,
  nodes: GitBranch,
  shield: ShieldCheck,
};

const statusLabels: Record<TopologyStatus, string> = {
  observed: "Observed",
  partial: "Partial",
  failed: "Failed",
  unobserved: "Not observed",
};
const TOPOLOGY_STATUSES: TopologyStatus[] = ["observed", "partial", "failed", "unobserved"];
const LAYER_ORDER = ["Hardware", "Linux", "Middleware", "Application"] as const;

function topologyStatus(state: string): TopologyStatus {
  if (state === "GATED" || state === "OBSERVED") return "observed";
  if (state === "PARTIAL") return "partial";
  if (state === "FAILED") return "failed";
  return "unobserved";
}

function topologyIcon(kind: string): TopologyIcon {
  if (kind === "sensor") return "sensor";
  if (kind === "platform") return "cpu";
  if (kind === "route") return "radio";
  if (kind === "operation") return "route";
  if (kind === "feature") return "nodes";
  if (kind === "robot") return "target";
  return "cube";
}

function aggregateLayerStatus(
  nodes: Node<TopologyNodeData>[],
  layer: string,
): TopologyStatus {
  const statuses = nodes
    .filter((node) => node.data.layer === layer)
    .map((node) => node.data.status);
  if (!statuses.length || statuses.every((status) => status === "unobserved")) return "unobserved";
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("partial") || statuses.includes("unobserved")) return "partial";
  return "observed";
}

function liveFlowNodes(topology: RobotTopology): Node<TopologyNodeData>[] {
  const rows = new Map<string, number>();
  return topology.nodes.map((node) => {
    const layerIndex = Math.max(0, LAYER_ORDER.indexOf(node.layer));
    const row = rows.get(node.layer) || 0;
    rows.set(node.layer, row + 1);
    return {
      id: node.node_id,
      type: "rolo",
      position: { x: 30 + layerIndex * 274, y: 64 + row * 126 },
      data: {
        label: node.label,
        subtitle: node.subtitle,
        layer: node.layer === "Middleware" ? "ROS / Middleware" : node.layer,
        status: topologyStatus(node.state),
        icon: topologyIcon(node.kind),
        evidence: node.evidence_ids.length,
        evidenceIds: node.evidence_ids,
        confidence: Math.round(node.confidence * 100),
        kind: node.kind,
        integrityStatus: node.integrity_status,
        attributes: node.attributes,
      },
    };
  });
}

function liveFlowEdges(topology: RobotTopology): Edge[] {
  return topology.edges.map((edge) => ({
    id: edge.edge_id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    animated: edge.state === "OBSERVED",
    className: edge.state === "DECLARED" ? "edge-declared" : "edge-observed",
    label: edge.relation,
  }));
}

function evidenceRecordToItem(record: EvidenceRecord): EvidenceItem {
  return {
    id: record.evidence_id,
    title: record.title,
    source: record.source_kind.replace("_", " "),
    kind: record.authority,
    integrity: record.integrity_status,
    time: new Date(record.observed_at).toLocaleTimeString(),
    ref: record.reference_hint,
    digest: record.reference_digest,
    summary: record.summary,
    confidence: Math.round(record.confidence * 100),
    classification: record.classification,
    limitations: record.limitations,
  };
}

function StatusDot({ status }: { status: TopologyStatus }) {
  return <span className={`status-dot status-${status}`} aria-hidden="true" />;
}

function RoloNode({ data, selected }: NodeProps<Node<TopologyNodeData>>) {
  const Icon = nodeIcons[data.icon];
  return (
    <div className={`topology-node ${selected ? "is-selected" : ""}`}>
      <Handle type="target" position={Position.Left} className="node-handle" />
      <span className="node-icon"><Icon size={20} weight="regular" /></span>
      <span className="node-copy">
        <strong>{data.label}</strong>
        <small>{data.subtitle}</small>
      </span>
      <StatusDot status={data.status} />
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}

const nodeTypes = { rolo: RoloNode };

function Sidebar({ active, onChange }: { active: NavId; onChange: (value: NavId) => void }) {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar-brand"><img src="/assets/rolo-mark.png" alt="rolo" /></div>
      <nav>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-button ${active === id ? "is-active" : ""}`}
            onClick={() => onChange(id)}
            aria-label={label}
            aria-current={active === id ? "page" : undefined}
            title={label}
          >
            <Icon size={23} weight={active === id ? "fill" : "regular"} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button className="nav-button" aria-label="Alerts" title="Alerts"><Bell size={22} /></button>
        <button className="nav-button" aria-label="Settings" title="Settings"><Gear size={22} /></button>
      </div>
    </aside>
  );
}

const MODE_LABELS: Record<WorkbenchMode, string> = {
  connecting: "Connecting",
  live: "Live trusted",
  partial: "Partial live",
  unavailable: "Unavailable",
  demo: "Demo data",
};

function formatSnapshot(value?: string) {
  if (!value) return "No live snapshot";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Snapshot unavailable";
  return `Snapshot: ${date.toLocaleString()}`;
}

interface TopbarProps {
  robot: ViewRobot | null;
  robots: RobotOption[];
  activeLabel: string;
  mode: WorkbenchMode;
  snapshot?: string;
  onRetry: () => void;
  onRobotChange: (robotId: string) => void;
}

function Topbar({ robot, robots, activeLabel, mode, snapshot, onRetry, onRobotChange }: TopbarProps) {
  return (
    <header className="topbar">
      <label className="robot-selector">
        <StatusDot status={robot?.status === "online" ? "observed" : mode === "demo" ? "partial" : "failed"} />
        <select
          value={robot?.robot_id || ""}
          onChange={(event) => onRobotChange(event.target.value)}
          aria-label="Select robot"
          disabled={!robots.length || mode === "connecting"}
        >
          {!robot && <option value="">No live robot</option>}
          {robots.map((item) => <option key={item.robot_id} value={item.robot_id}>{item.robot_id}</option>)}
        </select>
        <CaretDown size={14} />
      </label>
      <div className="topbar-divider" />
      <h1>{activeLabel}</h1>
      <div className="topbar-spacer" />
      <div className={`data-mode mode-${mode}`}>
        <span>{MODE_LABELS[mode]}</span>
        {["partial", "unavailable", "demo"].includes(mode) && <button onClick={onRetry}>Retry</button>}
      </div>
      <div className="snapshot-time">
        <Clock size={17} />
        <span>{formatSnapshot(snapshot)}</span>
      </div>
      <button className="user-avatar" aria-label="User menu">ZL</button>
    </header>
  );
}

interface ConnectionStateViewProps {
  mode: WorkbenchMode;
  message: string;
  onRetry: () => void;
  onUseDemo: () => void;
}

function ConnectionStateView({ mode, message, onRetry, onUseDemo }: ConnectionStateViewProps) {
  const connecting = mode === "connecting";
  return (
    <section className="connection-state" aria-live="polite">
      <div className="connection-state-card">
        {connecting ? <Pulse size={34} /> : <WarningCircle size={34} weight="fill" />}
        <span>{connecting ? "Connecting to rolo" : "Live data is unavailable"}</span>
        <h2>{connecting ? "Reading the trusted control-plane state…" : "The workbench will not substitute fixture data automatically."}</h2>
        <p>{message || "Waiting for health, robot registry, and overview read models."}</p>
        {!connecting && <div className="connection-actions"><button className="primary-button" onClick={onRetry}>Retry connection</button><button className="secondary-button" onClick={onUseDemo}>Use labeled demo data</button></div>}
      </div>
    </section>
  );
}

function ReadModelUnavailableView({ title, description }: { title: string; description: string }) {
  return (
    <section className="content-view">
      <PageTitle title={title} description={description} />
      <div className="panel read-model-unavailable" role="status">
        <Info size={26} weight="fill" />
        <div>
          <strong>No compatible live read model is available.</strong>
          <p>rolo-vis will not substitute demo fixtures while the workbench is connected to live data.</p>
          <small>This surface remains unavailable until rolo publishes a compatible trusted read model.</small>
        </div>
      </div>
    </section>
  );
}

interface PageTitleProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

function PageTitle({ eyebrow, title, description, action }: PageTitleProps) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function StackMapView({
  onOpenEvidence,
  topology,
}: {
  onOpenEvidence: OpenEvidence;
  topology?: RobotTopology | null;
}) {
  const sourceNodes = useMemo(
    () => topology ? liveFlowNodes(topology) : TOPOLOGY_NODES,
    [topology],
  );
  const sourceEdges = useMemo(
    () => topology ? liveFlowEdges(topology) : TOPOLOGY_EDGES,
    [topology],
  );
  const [selectedId, setSelectedId] = useState(() => sourceNodes[0]?.id || "localization");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [compare, setCompare] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sourceNodes.some((node) => node.id === selectedId)) {
      setSelectedId(sourceNodes[0]?.id || "");
    }
  }, [selectedId, sourceNodes]);

  useEffect(() => {
    if (!flowInstance || !mapRef.current) return undefined;
    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(() => flowInstance.fitView({ padding: 0.08, duration: 0 }));
    });
    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, [flowInstance]);

  const nodes = useMemo(() => sourceNodes.map((node) => {
    const searchable = `${node.data.label} ${node.data.subtitle} ${node.data.layer}`.toLowerCase();
    const queryMatch = !query || searchable.includes(query.toLowerCase());
    const statusMatch = filter === "all" || node.data.status === filter;
    return {
      ...node,
      selected: node.id === selectedId,
      style: { opacity: queryMatch && statusMatch ? 1 : 0.18 },
    };
  }), [selectedId, query, filter, sourceNodes]);

  const handleNodeClick: NodeMouseHandler = useCallback((_, node) => setSelectedId(node.id), []);
  const selectedNode = sourceNodes.find((node) => node.id === selectedId) || sourceNodes[0];
  if (!selectedNode) {
    return <ReadModelUnavailableView title="Stack Map" description="The topology read model contains no nodes." />;
  }
  const details = selectedNode.data;
  const connected = sourceEdges.filter((edge) => edge.source === selectedId || edge.target === selectedId);
  const SelectedIcon = nodeIcons[details.icon] || Cube;

  return (
    <section className="stack-workspace">
      {toolsOpen && <div className="map-toolbar">
        <div className="search-box">
          <MagnifyingGlass size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search components" aria-label="Search components" />
          {query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>}
        </div>
        <label className="select-control">
          <Funnel size={16} />
          <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter topology status">
            <option value="all">All states</option>
            <option value="observed">Observed</option>
            <option value="partial">Partial</option>
            <option value="failed">Failed</option>
            <option value="unobserved">Not observed</option>
          </select>
        </label>
        <button className={`secondary-button ${compare ? "is-active" : ""}`} disabled={Boolean(topology)} onClick={() => setCompare((value) => !value)} title={topology ? "Snapshot diff is planned next" : undefined}>
          <GitBranch size={17} /> Compare snapshot
        </button>
      </div>}

      {compare && (
        <div className="compare-banner">
          <Info size={18} weight="fill" />
          <span>Comparing Aug 20 against Aug 18: 2 bindings changed, 1 node disappeared.</span>
          <button onClick={() => setCompare(false)}><X size={16} /></button>
        </div>
      )}

      <div className="map-stage" ref={mapRef}>
        <button className="map-tools-toggle" onClick={() => setToolsOpen((value) => !value)} aria-label="Search and filter topology" title="Search and filter">
          {toolsOpen ? <X size={18} /> : <MagnifyingGlass size={18} />}
        </button>
        <div className="lane-headings" aria-hidden="true">
          {["Hardware", "Linux", "ROS / Middleware", "Application"].map((layer) => {
            const status = aggregateLayerStatus(sourceNodes, layer);
            return <div key={layer}>
              <strong>{layer}</strong>
              <span><StatusDot status={status} />{statusLabels[status]}</span>
            </div>;
          })}
        </div>
        <ReactFlow
          nodes={nodes}
          edges={sourceEdges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onInit={setFlowInstance}
          fitView
          fitViewOptions={{ padding: 0.08 }}
          minZoom={0.25}
          maxZoom={1.45}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#223044" gap={32} size={1} />
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>
        <div className="map-legend">
          {TOPOLOGY_STATUSES.map((status) => (
            <span key={status}><StatusDot status={status} />{statusLabels[status]}</span>
          ))}
          <span className="line-key solid" /> <small>Observed relationship</small>
          <span className="line-key dashed" /> <small>Declared (not observed)</small>
        </div>
      </div>

      <aside className="node-inspector" aria-label="Selected topology node details">
        <div className="inspector-heading">
          <span className="inspector-icon"><SelectedIcon size={26} /></span>
          <div><h3>{details.label}</h3><p>{details.subtitle}</p></div>
          <span className={`status-chip chip-${details.status}`}><StatusDot status={details.status} />{statusLabels[details.status]}</span>
        </div>

        <dl className="facts-grid">
          <div><dt>Status</dt><dd>{statusLabels[details.status]}</dd></div>
          <div><dt>Snapshot</dt><dd>{topology ? new Date(topology.observed_at).toLocaleString() : "Aug 20, 2026 10:12:07"}</dd></div>
          <div><dt>Node</dt><dd>{selectedId}</dd></div>
          <div><dt>Integrity</dt><dd>{details.integrityStatus || "preview"}</dd></div>
          <div><dt>Kind</dt><dd>{details.kind || "component"}</dd></div>
        </dl>

        <div className="inspector-section">
          <h4>What it does</h4>
          <p>{topology ? `Represents ${details.label} from the ${topology.coverage === "GATED_RELEASE" ? "hash-verified active release" : "validated robot registry"}.` : details.label === "Localization" ? "Fuses LiDAR, IMU, wheel odometry, and TF data to estimate the robot pose in the map frame." : `Provides the observed ${details.label} capability within the ${details.layer} layer.`}</p>
        </div>

        <div className="inspector-section">
          <div className="section-title-row"><h4>Relationships</h4><span>{connected.length}</span></div>
          <div className="relationship-list">
            {connected.slice(0, 5).map((edge) => {
              const peerId = edge.source === selectedId ? edge.target : edge.source;
              const peer = sourceNodes.find((node) => node.id === peerId);
              if (!peer) return null;
              return (
                <button key={edge.id} onClick={() => setSelectedId(peerId)}>
                  <StatusDot status={peer.data.status} />
                  <span><strong>{peer.data.label}</strong><small>{edge.source === selectedId ? "Downstream" : "Upstream"}</small></span>
                  <ArrowRight size={15} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="inspector-section observed-record-section">
          <h4>{topology ? "Evidence source" : "Observed in"}</h4>
          <div className="observed-record"><FileText size={19} /><span><strong>{topology ? topology.coverage.replace("_", " ") : "rosbag2_2026-08-20_10-00-00"}</strong><small>{topology ? `${topology.integrity_status} · ${details.evidence} evidence references` : `10:00:00–10:30:00 AM · ${details.evidence} records`}</small></span></div>
        </div>

        <div className="inspector-section confidence-section">
          <div className="section-title-row"><h4>Confidence</h4><strong>{details.confidence ?? 92}%</strong></div>
          <div className="confidence-track"><span style={{ width: `${details.confidence ?? 92}%` }} /></div>
          <p>{topology?.limitations[0] || "Evidence is consistent with declared intent."}</p>
        </div>

        <div className="inspector-actions">
          <button className="primary-button" disabled={Boolean(topology && !details.evidenceIds?.length)} onClick={() => onOpenEvidence(topology ? details.evidenceIds?.[0] || "" : EVIDENCE[0])}>Open evidence</button>
          <button className="secondary-button" disabled={Boolean(topology)} onClick={() => setCompare(true)} title={topology ? "Snapshot diff is planned next" : undefined}>Compare snapshot</button>
        </div>
      </aside>
    </section>
  );
}

interface OverviewViewProps {
  robot: ViewRobot;
  pipeline: PipelineRow[];
  overview: RobotOverview | null;
  mode: WorkbenchMode;
  evidenceItems: EvidenceItem[];
  onOpenEvidence: OpenEvidence;
  onNavigate: (view: NavId) => void;
}

function OverviewView({ robot, pipeline, overview, mode, evidenceItems, onOpenEvidence, onNavigate }: OverviewViewProps) {
  const primaryBlocker = overview?.blockers?.[0];
  const overviewPresentation = getOverviewPresentation(mode, overview, pipeline[0]?.summary);
  return (
    <section className="content-view">
      <PageTitle
        eyebrow="Robot overview"
        title={`Is ${robot.robot_id} trustworthy now?`}
        description="One decision surface for runtime health, lifecycle readiness, and the evidence behind every blocker."
        action={<button className="secondary-button" onClick={() => onNavigate("stack")}><GitBranch size={17} /> Open Stack Map</button>}
      />
      <div className="trust-summary">
        <div className="trust-state"><WarningCircle size={30} weight="fill" /><div><strong>{overviewPresentation.title}</strong><span>{overviewPresentation.summary}</span></div></div>
        <div className="summary-meta"><span>Freshness</span><strong>{overview?.freshness || (mode === "demo" ? "Fixture" : "Unknown")}</strong></div>
        <div className="summary-meta"><span>Integrity</span><strong>{overview?.integrity_status || (mode === "demo" ? "Preview only" : "Not asserted")}</strong></div>
        <div className="summary-meta"><span>Read model</span><strong>{overview?.schema_version || "Pipeline compatibility"}</strong></div>
      </div>

      <div className="overview-grid">
        <div className="panel lifecycle-panel">
          <div className="panel-heading"><div><span>Lifecycle</span><h3>Adapt → Diagnose → Verify</h3></div><button onClick={() => onNavigate("lifecycle")}>View lifecycle <ArrowRight size={15} /></button></div>
          <div className="stage-rail">
            {pipeline.map((stage, index) => (
              <div className={`stage-item stage-${stage.status.toLowerCase().replace("_", "-")}`} key={stage.stage}>
                <div className="stage-line"><span>{index + 1}</span></div>
                <strong>{stage.stage}</strong>
                <em>{stage.status.replace("_", " ")}</em>
                <small>{stage.summary}</small>
              </div>
            ))}
          </div>
          {(primaryBlocker || mode === "demo") && <div className="blocker-detail">
            <span className="blocker-icon"><Warning size={21} weight="fill" /></span>
            <div><strong>{primaryBlocker ? `${primaryBlocker.stage} blocker` : "Dependency mismatch"}</strong><p>{primaryBlocker?.message || "Localization latency p95 is 312 ms. Nav Stack v2.4.0 requires ≤ 120 ms before Adapt can pass."}</p></div>
            <button className="primary-button" disabled={mode !== "demo" && !primaryBlocker?.evidence_ids.length} onClick={() => mode === "demo" ? onOpenEvidence(EVIDENCE[1]) : primaryBlocker?.evidence_ids[0] && onOpenEvidence(primaryBlocker.evidence_ids[0])}>{mode === "demo" ? "View demo evidence" : primaryBlocker?.evidence_ids.length ? "Open blocker evidence" : "No blocker evidence"}</button>
          </div>}
        </div>
        <div className="panel attention-panel">
          <div className="panel-heading"><div><span>Needs attention</span><h3>{overview ? `${overview.blockers.length} active items` : mode === "demo" ? "Preview items" : "Compatibility status"}</h3></div></div>
          {overview?.blockers.map((blocker) => <div className="attention-row" key={blocker.blocker_id}>
            <WarningCircle size={21} weight="fill" /><span><strong>{blocker.stage} blocked</strong><small>{blocker.message}</small></span><ArrowRight size={15} />
          </div>)}
          {overview && !overview.blockers.length && <div className="attention-empty"><CheckCircle size={23} weight="fill" /><span><strong>No active blockers</strong><small>The current pipeline assessment is clear.</small></span></div>}
          {!overview && <button className="attention-row" onClick={() => onNavigate("lifecycle")}><WarningCircle size={21} weight="fill" /><span><strong>Pipeline compatibility mode</strong><small>Overview read model is not available.</small></span><ArrowRight size={15} /></button>}
        </div>
      </div>
      <div className="panel recent-evidence">
        <div className="panel-heading"><div><span>Recent evidence</span><h3>{mode === "demo" ? "Preview records" : `${evidenceItems.length} trusted records`}</h3></div>{(mode === "demo" || evidenceItems.length > 0) && <button onClick={() => onNavigate("evidence")}>{mode === "demo" ? "Open demo ledger" : "Open evidence ledger"} <ArrowRight size={15} /></button>}</div>
        {mode === "demo" ? EVIDENCE.slice(0, 3).map((item) => <EvidenceRow key={item.id} item={item} onClick={() => onOpenEvidence(item)} />) : evidenceItems.length ? evidenceItems.slice(0, 3).map((item) => <EvidenceRow key={item.id} item={item} onClick={() => onOpenEvidence(item.id)} />) : <div className="evidence-api-notice"><Info size={20} /><span><strong>No fixture evidence is mixed into the live overview.</strong><small>The live evidence read model is unavailable for this robot.</small></span></div>}
      </div>
    </section>
  );
}

function DemoCapabilityView({ onOpenEvidence }: { onOpenEvidence: (item: EvidenceItem) => void }) {
  const [selected, setSelected] = useState(CAPABILITIES[0]);
  const [query, setQuery] = useState("");
  const visible = CAPABILITIES.filter((item) => `${item.id} ${item.title} ${item.layer}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <section className="content-view capabilities-view">
      <PageTitle title="Capabilities" description="Evidence-driven answers about what this robot can do, and why." action={<div className="coverage-summary"><strong>294 canonical operations</strong><span><i style={{ width: "52%" }} /><i style={{ width: "31%" }} /><i style={{ width: "9%" }} /><i style={{ width: "8%" }} /></span></div>} />
      <div className="capability-layout">
        <div className="capability-list panel">
          <div className="capability-search search-box"><MagnifyingGlass size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search operations" /></div>
          <div className="layer-summary-row"><span>Operation</span><span>Lifecycle</span><span>Availability</span></div>
          {visible.map((item) => (
            <button key={item.id} className={`operation-row ${selected.id === item.id ? "is-selected" : ""}`} onClick={() => setSelected(item)}>
              <span className="operation-main"><code>{item.id}</code><small>{item.title}</small></span>
              <span className={`mini-chip lifecycle-${item.lifecycle.toLowerCase()}`}>{item.lifecycle}</span>
              <span className={`mini-chip availability-${item.availability.toLowerCase()}`}>{item.availability}</span>
              <ArrowRight size={15} />
            </button>
          ))}
          {!visible.length && <div className="empty-state"><MagnifyingGlass size={28} /><strong>No operations found</strong><span>Try a layer or verb such as “navigation” or “read”.</span></div>}
        </div>
        <div className="capability-detail panel">
          <div className="detail-layer">{selected.layer}</div>
          <code className="detail-operation">{selected.id}</code>
          <p>{selected.title}. The current release binds this canonical contract to an endpoint observed on {DEMO_ROBOT.robot_id}.</p>
          <div className="capability-badges">
            <div><span>Availability</span><strong className={`mini-chip availability-${selected.availability.toLowerCase()}`}>{selected.availability}</strong></div>
            <div><span>Lifecycle</span><strong className={`mini-chip lifecycle-${selected.lifecycle.toLowerCase()}`}>{selected.lifecycle}</strong></div>
            <div><span>Access</span><strong>{selected.access}</strong></div>
            <div><span>Risk</span><strong className={`risk-${selected.risk.toLowerCase()}`}>{selected.risk}</strong></div>
            <div><span>Classification</span><strong>{selected.classification}</strong></div>
          </div>
          <div className="contract-facts">
            <div><span>Observed binding</span><strong>{selected.binding}</strong></div>
            <div><span>Contract version</span><strong>v{selected.version}</strong></div>
            <div><span>Last validated</span><strong>Aug 20, 2026 09:42</strong></div>
          </div>
          <div className="trust-chain">
            <h4>Trust chain</h4>
            {["Canonical contract signed", "Endpoint observed", "Adapter route gated", "Release digest verified"].map((label, index) => (
              <div key={label}><span><CheckCircle size={18} weight="fill" /></span><strong>{label}</strong><small>{index === 1 ? selected.binding : `${selected.evidence + index} evidence records`}</small></div>
            ))}
          </div>
          <button className="primary-button detail-cta" onClick={() => onOpenEvidence(EVIDENCE[2])}>View evidence</button>
        </div>
      </div>
    </section>
  );
}

function LiveCapabilityView({
  robotId,
  items,
  limitations,
  onOpenEvidence,
}: {
  robotId: string;
  items: CapabilitySummary[];
  limitations: string[];
  onOpenEvidence: OpenEvidence;
}) {
  const [selectedOperation, setSelectedOperation] = useState(items[0]?.operation || "");
  const [detail, setDetail] = useState<CapabilityDetail | null>(null);
  const [detailMessage, setDetailMessage] = useState("");
  const [query, setQuery] = useState("");
  const [layer, setLayer] = useState("All layers");
  const [tab, setTab] = useState<"overview" | "contract" | "binding" | "evidence">("overview");

  useEffect(() => {
    if (!items.some((item) => item.operation === selectedOperation)) {
      setSelectedOperation(items[0]?.operation || "");
    }
  }, [items, selectedOperation]);

  useEffect(() => {
    if (!selectedOperation) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setDetail(null);
    setDetailMessage("Loading trusted contract…");
    void roloClient.capability(robotId, selectedOperation, { signal: controller.signal })
      .then((result) => {
        setDetail(result);
        setDetailMessage("");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setDetailMessage(error instanceof Error ? error.message : "Capability detail is unavailable.");
      });
    return () => controller.abort();
  }, [robotId, selectedOperation]);

  const visible = items.filter((item) => {
    const matchesQuery = `${item.operation} ${item.description} ${item.layer}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (layer === "All layers" || item.layer === layer);
  });
  const selected = items.find((item) => item.operation === selectedOperation) || items[0];
  const counts = items.reduce<Record<string, number>>((result, item) => {
    result[item.availability] = (result[item.availability] || 0) + 1;
    return result;
  }, {});
  const width = (status: string) => `${items.length ? ((counts[status] || 0) / items.length) * 100 : 0}%`;
  const detailItem = detail?.capability || selected;

  return (
    <section className="content-view capabilities-view">
      <PageTitle
        title="Capabilities"
        description="Canonical contracts joined with current robot applicability, bindings, and evidence."
        action={<div className="coverage-summary"><strong>{items.length} canonical operations · {counts.VERIFIED || 0} verified</strong><span><i style={{ width: width("VERIFIED") }} /><i style={{ width: width("AVAILABLE") }} /><i style={{ width: width("UNAVAILABLE") }} /><i style={{ width: width("UNKNOWN") }} /></span></div>}
      />
      <div className="capability-layout">
        <div className="capability-list panel">
          <div className="capability-toolbar">
            <div className="capability-search search-box"><MagnifyingGlass size={18} /><input aria-label="Search canonical operations" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search operations" /></div>
            <label className="capability-layer-filter"><span>Layer</span><select value={layer} onChange={(event) => setLayer(event.target.value)}>{["All layers", "Hardware", "Linux", "Middleware", "Application"].map((value) => <option key={value}>{value}</option>)}</select></label>
          </div>
          <div className="layer-summary-row"><span>Operation</span><span>Lifecycle</span><span>Availability</span></div>
          {visible.map((item) => (
            <button key={item.operation} className={`operation-row ${selected?.operation === item.operation ? "is-selected" : ""}`} onClick={() => { setSelectedOperation(item.operation); setTab("overview"); }}>
              <span className="operation-main"><code>{item.operation}</code><small>{item.layer} · {item.applicability.replace("_", " ")}</small></span>
              <span className={`mini-chip lifecycle-${item.lifecycle.toLowerCase()}`}>{item.lifecycle}</span>
              <span className={`mini-chip availability-${item.availability.toLowerCase()}`}>{item.availability}</span>
              <ArrowRight size={15} />
            </button>
          ))}
          {!visible.length && <div className="empty-state"><MagnifyingGlass size={28} /><strong>No operations found</strong><span>Change the query or layer filter.</span></div>}
        </div>
        <div className="capability-detail panel" aria-live="polite">
          {!detailItem ? <div className="empty-state"><Info size={28} /><strong>No capability records</strong><span>The API returned an empty product registry.</span></div> : <>
            <div className="detail-layer">{detailItem.layer}</div>
            <code className="detail-operation">{detailItem.operation}</code>
            <p>{detailItem.description}</p>
            <div className="capability-badges">
              <div><span>Availability</span><strong className={`mini-chip availability-${detailItem.availability.toLowerCase()}`}>{detailItem.availability}</strong></div>
              <div><span>Lifecycle</span><strong className={`mini-chip lifecycle-${detailItem.lifecycle.toLowerCase()}`}>{detailItem.lifecycle}</strong></div>
              <div><span>Applicability</span><strong>{detailItem.applicability.replace("_", " ")}</strong></div>
              <div><span>Access</span><strong>{detailItem.access}</strong></div>
              <div><span>Risk</span><strong className={`risk-${detailItem.risk.toLowerCase()}`}>{detailItem.risk}</strong></div>
              <div><span>Classification</span><strong>{detailItem.data_classification}</strong></div>
            </div>
            <div className="capability-tabs" role="tablist" aria-label="Capability detail">
              {(["overview", "contract", "binding", "evidence"] as const).map((value) => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "is-active" : ""} onClick={() => setTab(value)}>{value}</button>)}
            </div>
            {detailMessage && !detail && <div className="capability-detail-message"><Info size={18} /><span>{detailMessage}</span></div>}
            {tab === "overview" && <>
              <div className="contract-facts">
                <div><span>Registration</span><strong>{detailItem.registration.replace("_", " ")}</strong></div>
                <div><span>Contract</span><strong>v{detailItem.contract_version}</strong></div>
                <div><span>Last verified</span><strong>{detailItem.last_verified_at ? new Date(detailItem.last_verified_at).toLocaleString() : "Not verified"}</strong></div>
              </div>
              <div className="trust-chain"><h4>Current trust statement</h4>
                <div><span><CheckCircle size={18} weight="fill" /></span><strong>Canonical contract validated</strong><small>{detailItem.contract_digest.slice(0, 12)}…</small></div>
                <div><span className={detailItem.integrity_status === "verified" ? "" : "trust-unknown"}><ShieldCheck size={18} weight="fill" /></span><strong>{detailItem.integrity_status === "verified" ? "Gated release binding" : "No gated release proof"}</strong><small>{detailItem.binding_count} bindings</small></div>
              </div>
              {(detailItem.limitations.length || limitations.length) > 0 && <div className="capability-limitations"><strong>Known limits</strong>{[...new Set([...detailItem.limitations, ...limitations])].map((value) => <p key={value}>{value}</p>)}</div>}
            </>}
            {tab === "contract" && detail && <div className="capability-contract-view">
              <div><span>Input schema</span><pre>{JSON.stringify(detail.contract.input_schema, null, 2)}</pre></div>
              <div><span>Output schema</span><pre>{JSON.stringify(detail.contract.output_schema, null, 2)}</pre></div>
              <div className="contract-rule-list"><strong>Preconditions</strong>{detail.contract.preconditions.length ? detail.contract.preconditions.map((value) => <p key={value}>{value}</p>) : <p>None declared.</p>}<strong>Result semantics</strong><p>{detail.contract.result_semantics} · {detail.contract.execution_mode}</p></div>
            </div>}
            {tab === "binding" && detail && <div className="capability-binding-list">{detail.bindings.length ? detail.bindings.map((binding) => <div key={binding.binding_id}><span className={`mini-chip authority-${binding.authority.toLowerCase()}`}>{binding.authority}</span><code>{binding.endpoint}</code><small>{binding.kind}{binding.interface_type ? ` · ${binding.interface_type}` : ""}</small></div>) : <div className="empty-state"><Network size={26} /><strong>No observed binding</strong><span>This contract is not bound to a current robot endpoint.</span></div>}</div>}
            {tab === "evidence" && <div className="capability-evidence-list">{detailItem.evidence_ids.length ? detailItem.evidence_ids.map((id) => <button key={id} onClick={() => onOpenEvidence(id)}><ShieldCheck size={17} /><code>{id}</code><ArrowRight size={14} /></button>) : <div className="empty-state"><FileText size={26} /><strong>No gated evidence record</strong><span>Contract validation alone is not runtime or outcome evidence.</span></div>}</div>}
            {detailItem.evidence_ids[0] && <button className="primary-button detail-cta" onClick={() => onOpenEvidence(detailItem.evidence_ids[0])}>View primary evidence</button>}
          </>}
        </div>
      </div>
    </section>
  );
}

function DemoLifecycleView({ pipeline, onOpenEvidence }: { pipeline: PipelineRow[]; onOpenEvidence: (item: EvidenceItem) => void }) {
  const [active, setActive] = useState("adapt");
  const selected = pipeline.find((item) => item.stage === active) || pipeline[0];
  if (!selected) return <section className="content-view"><PageTitle title="Lifecycle" description="No pipeline stages are available." /></section>;
  return (
    <section className="content-view">
      <PageTitle title="Lifecycle" description="Every stage opens only when its evidence-bound handoff is valid." />
      <div className="lifecycle-tabs" role="tablist">
        {pipeline.map((item, index) => (
          <button key={item.stage} className={active === item.stage ? "is-active" : ""} onClick={() => setActive(item.stage)}>
            <span>{index + 1}</span><strong>{item.stage}</strong><small>{item.status.replace("_", " ")}</small>
          </button>
        ))}
      </div>
      <div className="lifecycle-detail-grid">
        <div className="panel stage-detail-panel">
          <div className="stage-detail-header"><div><span>Stage {pipeline.findIndex((item) => item.stage === active) + 1}</span><h3>{selected.stage}</h3></div><span className={`stage-status status-${selected.status.toLowerCase().replace("_", "-")}`}>{selected.status.replace("_", " ")}</span></div>
          <p>{selected.summary}</p>
          <div className="gate-checklist">
            {((active === "adapt" ? [
              ["Discovery manifest integrity", true], ["Operation contract coverage", true], ["Adapter route availability", true], ["Dependency latency threshold", false],
            ] : active === "diagnose" ? [
              ["Validated Adapt handoff", false], ["Diagnosis constraints", true], ["Frozen configuration", false], ["Affected regression", false],
            ] : [
              ["Validated Diagnosis handoff", false], ["Acceptance constraints", false], ["Full regression", false], ["Evidence package", false],
            ]) as Array<[string, boolean]>).map(([label, passed]) => (
              <div key={label} className={passed ? "is-passed" : "is-pending"}>{passed ? <CheckCircle size={20} weight="fill" /> : <Clock size={20} />}<span><strong>{label}</strong><small>{passed ? "Evidence verified" : "Waiting for prerequisite"}</small></span></div>
            ))}
          </div>
        </div>
        <div className="panel handoff-panel">
          <span>Bound handoff</span><h3>{active === "adapt" ? "adapt handoff" : `${active} handoff`}</h3>
          <div className="handoff-hash"><code>{active === "adapt" ? "sha256:82f3…a149" : "Not published"}</code></div>
          <dl><div><dt>Source run</dt><dd>{active === "adapt" ? "adapt-20260820-0942" : "—"}</dd></div><div><dt>Artifacts</dt><dd>{selected.artifacts}</dd></div><div><dt>Blockers</dt><dd>{selected.blockers}</dd></div></dl>
          <button className="secondary-button" disabled={active !== "adapt"} onClick={() => onOpenEvidence(EVIDENCE[3])}>Inspect handoff</button>
        </div>
      </div>
    </section>
  );
}

function LiveLifecycleView({ pipeline }: { pipeline: PipelineRow[] }) {
  const [active, setActive] = useState("adapt");
  const selected = pipeline.find((item) => item.stage === active) || pipeline[0];

  useEffect(() => {
    if (pipeline.length && !pipeline.some((item) => item.stage === active)) {
      setActive(pipeline[0].stage);
    }
  }, [active, pipeline]);

  if (!selected) {
    return <ReadModelUnavailableView title="Lifecycle" description="The live pipeline contains no stage assessments." />;
  }
  const prerequisites = selected.prerequisites || [];
  const artifacts = selected.artifactRefs || [];
  const blockers = selected.blockerMessages || [];
  return (
    <section className="content-view">
      <PageTitle title="Lifecycle" description="Read-only pipeline facts; a stage status is not physical outcome evidence." />
      <div className="lifecycle-tabs" role="tablist">
        {pipeline.map((item, index) => (
          <button key={item.stage} className={active === item.stage ? "is-active" : ""} onClick={() => setActive(item.stage)}>
            <span>{index + 1}</span><strong>{item.stage}</strong><small>{item.status.replaceAll("_", " ")}</small>
          </button>
        ))}
      </div>
      <div className="lifecycle-detail-grid">
        <div className="panel stage-detail-panel">
          <div className="stage-detail-header"><div><span>Stage {pipeline.findIndex((item) => item.stage === active) + 1}</span><h3>{selected.stage}</h3></div><span className={`stage-status status-${selected.status.toLowerCase().replaceAll("_", "-")}`}>{selected.status.replaceAll("_", " ")}</span></div>
          <p>{selected.summary}</p>
          <div className="gate-checklist">
            {blockers.map((message) => <div key={message} className="is-pending"><Warning size={20} weight="fill" /><span><strong>Reported blocker</strong><small>{message}</small></span></div>)}
            {prerequisites.map((reference) => <div key={reference} className="is-neutral"><Info size={20} /><span><strong>{reference}</strong><small>Sanitized prerequisite declared by the stage assessment</small></span></div>)}
            {!blockers.length && <div className="is-passed"><CheckCircle size={20} weight="fill" /><span><strong>No active blocker reported</strong><small>This statement is limited to the current pipeline assessment.</small></span></div>}
          </div>
        </div>
        <div className="panel handoff-panel">
          <span>Assessment provenance</span><h3>{selected.agentRequirement?.replaceAll("_", " ") || "Unassigned agent"}</h3>
          <div className="handoff-hash"><code>{selected.observedAt ? `Observed ${new Date(selected.observedAt).toLocaleString()}` : "Observation time unavailable"}</code></div>
          <dl><div><dt>Optional stage</dt><dd>{selected.optional ? "Yes" : "No"}</dd></div><div><dt>Artifacts</dt><dd>{artifacts.length}</dd></div><div><dt>Blockers</dt><dd>{blockers.length}</dd></div></dl>
          <div className="artifact-reference-list">
            {artifacts.map((artifact) => <div key={artifact.name}><strong>{artifact.name}</strong><code>{artifact.reference}</code></div>)}
            {!artifacts.length && <small>No artifact reference is asserted for this stage.</small>}
          </div>
        </div>
      </div>
    </section>
  );
}

function EvidenceRow({ item, onClick }: { item: EvidenceItem; onClick: () => void }) {
  return (
    <button className="evidence-row" onClick={onClick}>
      <span className={`evidence-kind kind-${item.integrity}`}><FileText size={19} /></span>
      <span className="evidence-main"><strong>{item.title}</strong><small>{item.id} · {item.source}</small></span>
      <span className="evidence-type">{item.kind}</span>
      <span className={`integrity integrity-${item.integrity}`}><StatusDot status={item.integrity === "verified" ? "observed" : "partial"} />{item.integrity}</span>
      <time>{item.time}</time>
      <ArrowRight size={15} />
    </button>
  );
}

function EvidenceView({
  onOpenEvidence,
  items = EVIDENCE,
  live = false,
  collection = null,
  robotId,
}: {
  onOpenEvidence: OpenEvidence;
  items?: EvidenceItem[];
  live?: boolean;
  collection?: EvidenceCollection | null;
  robotId?: string;
}) {
  const [query, setQuery] = useState("");
  const [integrity, setIntegrity] = useState("all");
  const [authority, setAuthority] = useState<"all" | EvidenceAuthority>("all");
  const [records, setRecords] = useState<EvidenceRecord[]>(collection?.items || []);
  const [total, setTotal] = useState(collection?.total ?? items.length);
  const [nextOffset, setNextOffset] = useState<number | null>(collection?.next_offset ?? null);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const requestGeneration = useRef(0);

  useEffect(() => {
    requestGeneration.current += 1;
    setRecords(collection?.items || []);
    setTotal(collection?.total || (live ? 0 : items.length));
    setNextOffset(collection?.next_offset ?? null);
    setAuthority("all");
    setLoading(false);
    setPageError("");
  }, [collection, items.length, live, robotId]);

  const loadPage = useCallback(async (
    selectedAuthority: "all" | EvidenceAuthority,
    offset: number,
    append: boolean,
  ) => {
    if (!live || !robotId) return;
    const generation = ++requestGeneration.current;
    setLoading(true);
    setPageError("");
    try {
      const page = await roloClient.evidenceCollection(
        robotId,
        undefined,
        {
          limit: 25,
          offset,
          authority: selectedAuthority === "all" ? undefined : selectedAuthority,
        },
      );
      if (generation !== requestGeneration.current) return;
      setRecords((current) => {
        if (!append) return page.items;
        const merged = new Map(current.map((record) => [record.evidence_id, record]));
        page.items.forEach((record) => merged.set(record.evidence_id, record));
        return [...merged.values()];
      });
      setTotal(page.total);
      setNextOffset(page.next_offset);
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      setPageError(error instanceof Error ? error.message : "The evidence page could not be read.");
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [live, robotId]);

  const handleAuthorityChange = (value: "all" | EvidenceAuthority) => {
    setAuthority(value);
    setRecords([]);
    setTotal(0);
    setNextOffset(null);
    void loadPage(value, 0, false);
  };

  const visibleItems = live ? records.map(evidenceRecordToItem) : items;
  const filtered = visibleItems.filter((item) => {
    const queryMatch = `${item.title} ${item.id} ${item.source} ${item.kind}`.toLowerCase().includes(query.toLowerCase());
    return queryMatch && (integrity === "all" || item.integrity === integrity);
  });
  return (
    <section className="content-view">
      <PageTitle title="Evidence" description={live ? "Opaque IDs resolve to bounded, sanitized evidence records from rolo." : "Every conclusion can be traced to a bounded, integrity-checked source."} />
      <div className="evidence-toolbar">
        <div className="search-box"><MagnifyingGlass size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search loaded evidence" aria-label="Search loaded evidence" /></div>
        {live && <label className="select-control"><Funnel size={16} /><select value={authority} onChange={(event) => handleAuthorityChange(event.target.value as "all" | EvidenceAuthority)} aria-label="Filter evidence authority"><option value="all">All authority levels</option><option value="DECLARED">Declared</option><option value="OBSERVED">Observed</option><option value="GATED">Gated</option></select></label>}
        <label className="select-control"><Funnel size={16} /><select value={integrity} onChange={(event) => setIntegrity(event.target.value)} aria-label="Filter evidence integrity"><option value="all">All integrity states</option><option value="verified">Verified</option><option value="validated">Validated declaration</option><option value="unresolved">Unresolved</option></select></label>
      </div>
      <div className="panel evidence-ledger">
        <div className="ledger-header"><span>Evidence</span><span>Type</span><span>Integrity</span><span>Observed</span></div>
        {filtered.map((item) => <EvidenceRow key={item.id} item={item} onClick={() => onOpenEvidence(live ? item.id : item)} />)}
        {!filtered.length && !loading && <div className="evidence-empty"><MagnifyingGlass size={24} /><strong>No evidence matches this view</strong><span>Change the search or trust filters to continue.</span></div>}
        {live && <div className="evidence-paging"><span>{loading && !records.length ? "Loading trusted records…" : `Loaded ${records.length} of ${total} trusted records${authority === "all" ? "" : ` · ${authority.toLowerCase()}`}`}</span><div>{pageError && <small role="alert">{pageError}</small>}{nextOffset !== null && <button className="secondary-button" disabled={loading} onClick={() => void loadPage(authority, nextOffset, true)}>{loading ? "Loading…" : "Load more"}</button>}</div></div>}
      </div>
    </section>
  );
}

function EvidenceDrawer({ evidence, onClose }: { evidence: EvidenceItem | null; onClose: () => void }) {
  if (!evidence) return null;
  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="evidence-drawer" aria-label="Evidence details">
        <div className="drawer-header"><div><span>{evidence.kind}</span><h3>{evidence.title}</h3></div><button onClick={onClose} aria-label="Close evidence"><X size={20} /></button></div>
        <div className={`evidence-verdict verdict-${evidence.integrity}`}><CheckCircle size={24} weight="fill" /><div><strong>Integrity {evidence.integrity}</strong><span>{evidence.integrity === "verified" ? "The reference is bound to a hash-verified release." : "The declaration passed schema validation but does not prove runtime presence."}</span></div></div>
        <dl className="drawer-facts"><div><dt>Evidence ID</dt><dd>{evidence.id}</dd></div><div><dt>Source</dt><dd>{evidence.source}</dd></div><div><dt>Observed</dt><dd>{evidence.time}</dd></div><div><dt>Classification</dt><dd>{evidence.classification || "INTERNAL"}</dd></div></dl>
        <div className="drawer-section"><h4>Evidence statement</h4><p>{evidence.summary || `${evidence.title}. This record was produced by a bounded read-only source.`}</p></div>
        <div className="drawer-section"><h4>Sanitized reference</h4><code>{evidence.ref}</code></div>
        <div className="drawer-section"><h4>Reference digest</h4><code>{evidence.digest ? `sha256:${evidence.digest}` : "Digest available in live evidence mode"}</code></div>
        <div className="drawer-note"><Info size={19} /><p>{evidence.limitations?.[0] || "Evidence proves what rolo observed. It does not by itself prove physical outcome correctness or safety."}</p></div>
        <button className="primary-button drawer-close" onClick={onClose}>Done</button>
      </aside>
    </div>
  );
}

function AppContent() {
  const [active, setActive] = useState<NavId>("stack");
  const [mode, setMode] = useState<WorkbenchMode>("connecting");
  const [robots, setRobots] = useState<RobotOption[]>([]);
  const [robot, setRobot] = useState<ViewRobot | null>(null);
  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  const [overview, setOverview] = useState<RobotOverview | null>(null);
  const [topology, setTopology] = useState<RobotTopology | null>(null);
  const [evidenceList, setEvidenceList] = useState<EvidenceCollection | null>(null);
  const [capabilityList, setCapabilityList] = useState<CapabilitySummary[] | null>(null);
  const [capabilityLimitations, setCapabilityLimitations] = useState<string[]>([]);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [evidence, setEvidence] = useState<EvidenceItem | null>(null);

  const connect = useCallback(async (requestedRobotId?: string) => {
    setMode("connecting");
    setConnectionMessage("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const result = await roloClient.bootstrap({ signal: controller.signal }, requestedRobotId);
      setRobots(result.robots);
      setRobot(result.robot ? { ...result.robot, status: "online" } : null);
      setOverview(result.overview);
      setTopology(result.topology);
      setEvidenceList(result.evidence);
      setCapabilityList(result.capabilities);
      setCapabilityLimitations(result.capabilityLimitations);
      if (result.pipeline?.stages?.length) {
        setPipeline(result.pipeline.stages.map((stage) => ({
          stage: stage.stage,
          status: stage.status,
          summary: stage.summary,
          artifacts: Object.keys(stage.artifacts || {}).length,
          blockers: stage.blockers?.length || 0,
          optional: stage.optional,
          prerequisites: stage.prerequisites,
          artifactRefs: Object.entries(stage.artifacts).map(([name, reference]) => ({ name, reference })),
          blockerMessages: stage.blockers,
          agentRequirement: stage.agent_requirement,
          observedAt: stage.observed_at,
        })));
      } else setPipeline([]);
      setConnectionMessage(result.issues.join(" "));
      setMode(result.mode);
    } catch (error) {
      setRobot(null);
      setRobots([]);
      setPipeline([]);
      setOverview(null);
      setTopology(null);
      setEvidenceList(null);
      setCapabilityList(null);
      setCapabilityLimitations([]);
      setConnectionMessage(error instanceof RoloApiError ? `${error.message}${error.path ? ` (${error.path})` : ""}` : "The rolo control plane could not be read.");
      setMode("unavailable");
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  const useDemo = useCallback(() => {
    setRobot(DEMO_ROBOT);
    setRobots([DEMO_ROBOT]);
    setPipeline(DEMO_PIPELINE);
    setOverview(null);
    setTopology(null);
    setEvidenceList(null);
    setCapabilityList(null);
    setCapabilityLimitations([]);
    setConnectionMessage("Explicit fixture mode; no values on this screen are live robot observations.");
    setMode("demo");
  }, []);

  useEffect(() => { void connect(); }, [connect]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") setEvidence(null); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const openEvidence = useCallback(async (item: EvidenceItem | string) => {
    if (typeof item !== "string") {
      setEvidence(item);
      return;
    }
    try {
      setEvidence(evidenceRecordToItem(await roloClient.evidence(item)));
    } catch (error) {
      setEvidence({
        id: item,
        title: "Evidence unavailable",
        source: "rolo evidence API",
        kind: "Unavailable",
        integrity: "unresolved",
        time: new Date().toLocaleTimeString(),
        ref: "opaque ID could not be resolved",
        summary: error instanceof Error ? error.message : "The evidence record could not be read.",
        limitations: ["No evidence conclusion should be drawn until this record resolves."],
      });
    }
  }, []);

  const activeLabel = NAV_ITEMS.find((item) => item.id === active)?.label || "Stack Map";
  const evidenceItems = useMemo(
    () => evidenceList?.items.map(evidenceRecordToItem) || [],
    [evidenceList],
  );
  const stackSource = getSurfaceSource(mode, "stack", { stack: Boolean(topology) });
  const evidenceSource = getSurfaceSource(mode, "evidence", { evidence: Boolean(evidenceList) });
  const lifecycleSource = getSurfaceSource(mode, "lifecycle", { lifecycle: Boolean(pipeline.length) });
  const capabilitySource = getSurfaceSource(mode, "capabilities", { capabilities: Boolean(capabilityList) });
  return (
    <div className="app-shell">
      <Sidebar active={active} onChange={setActive} />
      <Topbar robot={robot} robots={robots} activeLabel={activeLabel} mode={mode} snapshot={overview?.observed_at} onRetry={() => connect(robot?.robot_id)} onRobotChange={connect} />
      <main className="app-main">
        {(["connecting", "unavailable"].includes(mode) || !robot) ? <ConnectionStateView mode={mode} message={connectionMessage} onRetry={() => connect()} onUseDemo={useDemo} /> : <>
          {active === "stack" && (stackSource === "demo" ? <StackMapView onOpenEvidence={openEvidence} /> : stackSource === "live" ? <StackMapView topology={topology} onOpenEvidence={openEvidence} /> : <ReadModelUnavailableView title="Stack Map" description="Live topology needs a versioned rolo topology read model." />)}
          {active === "overview" && <OverviewView robot={robot} pipeline={pipeline} overview={overview} mode={mode} evidenceItems={evidenceItems} onOpenEvidence={openEvidence} onNavigate={setActive} />}
          {active === "capabilities" && (capabilitySource === "demo" ? <DemoCapabilityView onOpenEvidence={setEvidence} /> : capabilitySource === "live" && capabilityList ? <LiveCapabilityView robotId={robot.robot_id} items={capabilityList} limitations={capabilityLimitations} onOpenEvidence={openEvidence} /> : <ReadModelUnavailableView title="Capabilities" description="Live capability coverage needs a versioned rolo capability read model." />)}
          {active === "lifecycle" && (lifecycleSource === "demo" ? <DemoLifecycleView pipeline={pipeline} onOpenEvidence={setEvidence} /> : lifecycleSource === "live" ? <LiveLifecycleView pipeline={pipeline} /> : <ReadModelUnavailableView title="Lifecycle" description="Live lifecycle requires a trusted pipeline assessment." />)}
          {active === "evidence" && (evidenceSource === "demo" ? <EvidenceView onOpenEvidence={openEvidence} /> : evidenceSource === "live" ? <EvidenceView live collection={evidenceList} robotId={robot.robot_id} onOpenEvidence={openEvidence} /> : <ReadModelUnavailableView title="Evidence" description="Live evidence resolution needs a versioned rolo evidence read model." />)}
        </>}
      </main>
      <EvidenceDrawer evidence={evidence} onClose={() => setEvidence(null)} />
    </div>
  );
}

export function App() {
  return <AppContent />;
}
