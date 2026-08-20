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
import type { Node, NodeMouseHandler, NodeProps, ReactFlowInstance } from "@xyflow/react";
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
import type { RobotCapability, RobotOverview } from "./types/rolo";
import { getSurfaceSource } from "./workbenchPolicy";
import type { WorkbenchMode } from "./workbenchPolicy";

type NavId = "overview" | "stack" | "capabilities" | "lifecycle" | "evidence";
type ViewRobot = DemoRobot | (RobotCapability & { status: "online" });
type RobotOption = DemoRobot | RobotCapability;

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
  live: "Live overview",
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
          <small>This surface is scheduled for the next Stack Map / Evidence milestone.</small>
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

function StackMapView({ onOpenEvidence }: { onOpenEvidence: (item: EvidenceItem) => void }) {
  const [selectedId, setSelectedId] = useState("localization");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [compare, setCompare] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!flowInstance || !mapRef.current) return undefined;
    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(() => flowInstance.fitView({ padding: 0.08, duration: 0 }));
    });
    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, [flowInstance]);

  const nodes = useMemo(() => TOPOLOGY_NODES.map((node) => {
    const searchable = `${node.data.label} ${node.data.subtitle} ${node.data.layer}`.toLowerCase();
    const queryMatch = !query || searchable.includes(query.toLowerCase());
    const statusMatch = filter === "all" || node.data.status === filter;
    return {
      ...node,
      selected: node.id === selectedId,
      style: { opacity: queryMatch && statusMatch ? 1 : 0.18 },
    };
  }), [selectedId, query, filter]);

  const selectedNode = TOPOLOGY_NODES.find((node) => node.id === selectedId) || TOPOLOGY_NODES[10];
  const details = selectedNode.data;
  const connected = TOPOLOGY_EDGES.filter((edge) => edge.source === selectedId || edge.target === selectedId);
  const SelectedIcon = nodeIcons[details.icon] || Cube;
  const handleNodeClick: NodeMouseHandler = useCallback((_, node) => setSelectedId(node.id), []);

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
        <button className={`secondary-button ${compare ? "is-active" : ""}`} onClick={() => setCompare((value) => !value)}>
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
          {["Hardware", "Linux", "ROS / Middleware", "Application"].map((layer, index) => (
            <div key={layer}>
              <strong>{layer}</strong>
              <span><StatusDot status={index === 3 ? "partial" : "observed"} />{index === 3 ? "Partial" : "Observed"}</span>
            </div>
          ))}
        </div>
        <ReactFlow
          nodes={nodes}
          edges={TOPOLOGY_EDGES}
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
          <div><dt>Since</dt><dd>Aug 20, 2026 10:12:07</dd></div>
          <div><dt>Node</dt><dd>/{selectedId}_node</dd></div>
          <div><dt>Lifecycle</dt><dd>{details.status === "unobserved" ? "unknown" : "active"}</dd></div>
          <div><dt>Namespace</dt><dd>/</dd></div>
        </dl>

        <div className="inspector-section">
          <h4>What it does</h4>
          <p>{details.label === "Localization" ? "Fuses LiDAR, IMU, wheel odometry, and TF data to estimate the robot pose in the map frame." : `Provides the observed ${details.label} capability within the ${details.layer} layer.`}</p>
        </div>

        <div className="inspector-section">
          <div className="section-title-row"><h4>Relationships</h4><span>{connected.length}</span></div>
          <div className="relationship-list">
            {connected.slice(0, 5).map((edge) => {
              const peerId = edge.source === selectedId ? edge.target : edge.source;
              const peer = TOPOLOGY_NODES.find((node) => node.id === peerId);
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
          <h4>Observed in</h4>
          <div className="observed-record"><FileText size={19} /><span><strong>rosbag2_2026-08-20_10-00-00</strong><small>10:00:00–10:30:00 AM · {details.evidence} records</small></span></div>
        </div>

        <div className="inspector-section confidence-section">
          <div className="section-title-row"><h4>Confidence</h4><strong>{details.confidence || 92}%</strong></div>
          <div className="confidence-track"><span style={{ width: `${details.confidence || 92}%` }} /></div>
          <p>Evidence is consistent with declared intent.</p>
        </div>

        <div className="inspector-actions">
          <button className="primary-button" onClick={() => onOpenEvidence(EVIDENCE[0])}>Open evidence</button>
          <button className="secondary-button" onClick={() => setCompare(true)}>Compare snapshot</button>
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
  onOpenEvidence: (item: EvidenceItem) => void;
  onNavigate: (view: NavId) => void;
}

function OverviewView({ robot, pipeline, overview, mode, onOpenEvidence, onNavigate }: OverviewViewProps) {
  const primaryBlocker = overview?.blockers?.[0];
  const attentionTitle = overview?.state === "READY" ? "Ready" : overview?.state === "DEGRADED" ? "Degraded" : "Attention required";
  const attentionSummary = overview?.summary || "Demo data shows an Adapt dependency mismatch.";
  return (
    <section className="content-view">
      <PageTitle
        eyebrow="Robot overview"
        title={`Is ${robot.robot_id} trustworthy now?`}
        description="One decision surface for runtime health, lifecycle readiness, and the evidence behind every blocker."
        action={<button className="secondary-button" onClick={() => onNavigate("stack")}><GitBranch size={17} /> Open Stack Map</button>}
      />
      <div className="trust-summary">
        <div className="trust-state"><WarningCircle size={30} weight="fill" /><div><strong>{attentionTitle}</strong><span>{attentionSummary}</span></div></div>
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
            <button className="primary-button" disabled={mode !== "demo"} onClick={() => onOpenEvidence(EVIDENCE[1])}>{mode === "demo" ? "View demo evidence" : "Evidence API next"}</button>
          </div>}
        </div>
        <div className="panel attention-panel">
          <div className="panel-heading"><div><span>Needs attention</span><h3>{overview ? `${overview.blockers.length} active items` : "Preview items"}</h3></div></div>
          {overview?.blockers.map((blocker) => <div className="attention-row" key={blocker.blocker_id}>
            <WarningCircle size={21} weight="fill" /><span><strong>{blocker.stage} blocked</strong><small>{blocker.message}</small></span><ArrowRight size={15} />
          </div>)}
          {overview && !overview.blockers.length && <div className="attention-empty"><CheckCircle size={23} weight="fill" /><span><strong>No active blockers</strong><small>The current pipeline assessment is clear.</small></span></div>}
          {!overview && <button className="attention-row" onClick={() => onNavigate("lifecycle")}><WarningCircle size={21} weight="fill" /><span><strong>Pipeline compatibility mode</strong><small>Overview read model is not available.</small></span><ArrowRight size={15} /></button>}
        </div>
      </div>
      <div className="panel recent-evidence">
        <div className="panel-heading"><div><span>Recent evidence</span><h3>{mode === "demo" ? "Preview records" : "Evidence API planned next"}</h3></div>{mode === "demo" && <button onClick={() => onNavigate("evidence")}>Open demo ledger <ArrowRight size={15} /></button>}</div>
        {mode === "demo" ? EVIDENCE.slice(0, 3).map((item) => <EvidenceRow key={item.id} item={item} onClick={() => onOpenEvidence(item)} />) : <div className="evidence-api-notice"><Info size={20} /><span><strong>No fixture evidence is mixed into the live overview.</strong><small>The next milestone will resolve opaque evidence IDs from rolo.</small></span></div>}
      </div>
    </section>
  );
}

function CapabilityView({ onOpenEvidence }: { onOpenEvidence: (item: EvidenceItem) => void }) {
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

function LifecycleView({ pipeline, onOpenEvidence }: { pipeline: PipelineRow[]; onOpenEvidence: (item: EvidenceItem) => void }) {
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

function EvidenceView({ onOpenEvidence }: { onOpenEvidence: (item: EvidenceItem) => void }) {
  const [query, setQuery] = useState("");
  const [integrity, setIntegrity] = useState("all");
  const filtered = EVIDENCE.filter((item) => {
    const queryMatch = `${item.title} ${item.id} ${item.source} ${item.kind}`.toLowerCase().includes(query.toLowerCase());
    return queryMatch && (integrity === "all" || item.integrity === integrity);
  });
  return (
    <section className="content-view">
      <PageTitle title="Evidence" description="Every conclusion can be traced to a bounded, integrity-checked source." />
      <div className="evidence-toolbar">
        <div className="search-box"><MagnifyingGlass size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search evidence" /></div>
        <label className="select-control"><Funnel size={16} /><select value={integrity} onChange={(event) => setIntegrity(event.target.value)}><option value="all">All integrity states</option><option value="verified">Verified</option><option value="unresolved">Unresolved</option></select></label>
      </div>
      <div className="panel evidence-ledger">
        <div className="ledger-header"><span>Evidence</span><span>Type</span><span>Integrity</span><span>Observed</span></div>
        {filtered.map((item) => <EvidenceRow key={item.id} item={item} onClick={() => onOpenEvidence(item)} />)}
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
        <div className="evidence-verdict"><CheckCircle size={24} weight="fill" /><div><strong>Integrity verified</strong><span>Digest and source reference match the current run manifest.</span></div></div>
        <dl className="drawer-facts"><div><dt>Evidence ID</dt><dd>{evidence.id}</dd></div><div><dt>Source</dt><dd>{evidence.source}</dd></div><div><dt>Observed</dt><dd>Aug 20, 2026 · {evidence.time}</dd></div><div><dt>Classification</dt><dd>INTERNAL</dd></div></dl>
        <div className="drawer-section"><h4>Observed fact</h4><p>{evidence.title}. This record was produced by a bounded read-only probe and retained in the immutable discovery manifest.</p></div>
        <div className="drawer-section"><h4>Artifact reference</h4><code>{evidence.ref}</code></div>
        <div className="drawer-section"><h4>Digest</h4><code>sha256:82f38dc1b9110f2da0b36b6d86d343efc8016278c17f9a4f1885c423d77ba149</code></div>
        <div className="drawer-note"><Info size={19} /><p>Evidence proves what rolo observed. It does not by itself prove physical outcome correctness or safety.</p></div>
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
      if (result.pipeline?.stages?.length) {
        setPipeline(result.pipeline.stages.map((stage) => ({
          stage: stage.stage,
          status: stage.status,
          summary: stage.summary,
          artifacts: Object.keys(stage.artifacts || {}).length,
          blockers: stage.blockers?.length || 0,
        })));
      } else setPipeline([]);
      setConnectionMessage(result.issues.join(" "));
      setMode(result.mode);
    } catch (error) {
      setRobot(null);
      setRobots([]);
      setPipeline([]);
      setOverview(null);
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
    setConnectionMessage("Explicit fixture mode; no values on this screen are live robot observations.");
    setMode("demo");
  }, []);

  useEffect(() => { void connect(); }, [connect]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") setEvidence(null); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const activeLabel = NAV_ITEMS.find((item) => item.id === active)?.label || "Stack Map";
  return (
    <div className="app-shell">
      <Sidebar active={active} onChange={setActive} />
      <Topbar robot={robot} robots={robots} activeLabel={activeLabel} mode={mode} snapshot={overview?.observed_at} onRetry={() => connect(robot?.robot_id)} onRobotChange={connect} />
      <main className="app-main">
        {(["connecting", "unavailable"].includes(mode) || !robot) ? <ConnectionStateView mode={mode} message={connectionMessage} onRetry={() => connect()} onUseDemo={useDemo} /> : <>
          {active === "stack" && (getSurfaceSource(mode, "stack") === "demo" ? <StackMapView onOpenEvidence={setEvidence} /> : <ReadModelUnavailableView title="Stack Map" description="Live topology needs a versioned rolo topology read model." />)}
          {active === "overview" && <OverviewView robot={robot} pipeline={pipeline} overview={overview} mode={mode} onOpenEvidence={setEvidence} onNavigate={setActive} />}
          {active === "capabilities" && (getSurfaceSource(mode, "capabilities") === "demo" ? <CapabilityView onOpenEvidence={setEvidence} /> : <ReadModelUnavailableView title="Capabilities" description="Live capability coverage needs a versioned rolo capability read model." />)}
          {active === "lifecycle" && <LifecycleView pipeline={pipeline} onOpenEvidence={setEvidence} />}
          {active === "evidence" && (getSurfaceSource(mode, "evidence") === "demo" ? <EvidenceView onOpenEvidence={setEvidence} /> : <ReadModelUnavailableView title="Evidence" description="Live evidence resolution needs a versioned rolo evidence read model." />)}
        </>}
      </main>
      <EvidenceDrawer evidence={evidence} onClose={() => setEvidence(null)} />
    </div>
  );
}

export function App() {
  return <AppContent />;
}
