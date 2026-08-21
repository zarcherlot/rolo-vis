import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  BookOpenText,
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
  Robot,
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
import { ROLO_API_FEATURES, RoloApiError, roloClient } from "./roloClient";
import type {
  CapabilityBinding,
  CapabilityDetail,
  CapabilitySummary,
  DiscoverySnapshotCollection,
  EvidenceAuthority,
  EvidenceCollection,
  EvidenceRecord,
  FleetBlockerCollection,
  FleetCollection,
  LifecycleRunCollection,
  LifecycleRunDetail,
  OperationDisposition,
  RobotCapability,
  RobotOverview,
  RobotTopology,
  RobotWikiSnapshot,
  TargetOperationSlice,
  TopologyDiff,
  TopologyPathExplanation,
  TopologySnapshotCollection,
  WikiLayer,
} from "./types/rolo";
import { buildAdaptContextLens } from "./adaptContext";
import {
  topologyLayerForWiki,
  wikiLayerForTopology,
} from "./contextLink";
import type { ContextWikiLayer, TopologyDisplayLayer } from "./contextLink";
import {
  CAPABILITY_AVAILABILITY,
  CAPABILITY_LAYERS,
  capabilityCoveragePercent,
  summarizeCapabilityCoverage,
} from "./capabilityCoverage";
import {
  capabilityRelations as getCapabilityRelations,
  groupCapabilitiesByFamily,
} from "./capabilityRelations";
import { projectContractSchema } from "./contractSchema";
import { bindingTrustStatement, summarizeBindingTrust } from "./bindingTrust";
import { capabilityReadinessSignals } from "./capabilityReadiness";
import {
  CAPABILITY_ACCESS,
  CAPABILITY_CLASSIFICATIONS,
  CAPABILITY_LIFECYCLES,
  CAPABILITY_RISKS,
  activeGovernanceFilterCount,
  filterCapabilities,
} from "./capabilityFilters";
import type { CapabilityFilterState } from "./capabilityFilters";
import { summarizeLifecycleAssessment } from "./lifecycleAssessment";
import { getOverviewPresentation, getSurfaceSource } from "./workbenchPolicy";
import type { WorkbenchMode } from "./workbenchPolicy";

type NavId = "fleet" | "overview" | "stack" | "capabilities" | "lifecycle" | "wiki" | "evidence";
type ViewRobot = DemoRobot | (RobotCapability & { status: "online" });
type RobotOption = DemoRobot | RobotCapability;
type OpenEvidence = (item: EvidenceItem | string) => void;
type StackContextFocus = { layer: ContextWikiLayer; requestId: number };

const NAV_ITEMS: Array<{ id: NavId; label: string; icon: typeof House }> = [
  { id: "fleet", label: "Fleet", icon: Robot },
  { id: "overview", label: "Overview", icon: House },
  { id: "stack", label: "Stack Map", icon: GitBranch },
  { id: "capabilities", label: "Capabilities", icon: Stack },
  { id: "lifecycle", label: "Lifecycle", icon: Clock },
  { id: "wiki", label: "Robot Wiki", icon: BookOpenText },
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

function FleetView({
  fleet,
  blockers,
  onSelectRobot,
  onOpenEvidence,
}: {
  fleet: FleetCollection;
  blockers: FleetBlockerCollection;
  onSelectRobot: (robotId: string) => void;
  onOpenEvidence: OpenEvidence;
}) {
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRobots = fleet.items.filter((item) =>
    (stateFilter === "all" || item.state === stateFilter)
    && (!normalizedQuery || `${item.robot_id} ${item.adapter} ${item.architecture} ${item.ros_distro} ${item.next_action}`.toLowerCase().includes(normalizedQuery)),
  );
  const filteredBlockers = blockers.items.filter((item) =>
    (stageFilter === "all" || item.stage === stageFilter)
    && (!normalizedQuery || `${item.robot_id} ${item.message} ${item.owner}`.toLowerCase().includes(normalizedQuery)),
  );
  const summary = [
    { label: "Ready", value: fleet.ready, state: "ready" },
    { label: "Attention", value: fleet.attention, state: "attention" },
    { label: "Degraded", value: fleet.degraded, state: "degraded" },
    { label: "Not ready", value: fleet.not_ready, state: "not-ready" },
    { label: "Open blockers", value: fleet.blocker_count, state: "blockers" },
  ];
  return (
    <section className="content-view fleet-view">
      <PageTitle
        eyebrow="Cross-robot workspace"
        title="Fleet"
        description="Validated robot overviews and pipeline blockers, aggregated without inventing runtime telemetry."
        action={<div className="fleet-observed"><ShieldCheck size={16} /><span>Validated snapshot<br /><small>{new Date(fleet.observed_at).toLocaleString()}</small></span></div>}
      />
      <div className="fleet-summary">
        {summary.map((item) => <div className={`panel fleet-summary-card fleet-summary-${item.state}`} key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}
      </div>
      <div className="fleet-toolbar">
        <label className="search-box"><MagnifyingGlass size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search robots, adapters, blockers…" /></label>
        <label className="select-control"><Funnel size={15} /><select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}><option value="all">All robot states</option><option value="READY">Ready</option><option value="ATTENTION">Attention</option><option value="DEGRADED">Degraded</option><option value="NOT_READY">Not ready</option></select></label>
        <label className="select-control"><GitBranch size={15} /><select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}><option value="all">All blocker stages</option><option value="adapt">Adapt</option><option value="diagnose">Diagnose</option><option value="verify">Verify</option></select></label>
      </div>
      <div className="fleet-layout">
        <section className="panel fleet-robots">
          <header><div><span>Robot readiness</span><h3>{filteredRobots.length} visible robots</h3></div><small>Overview state · active stage · next action</small></header>
          <div className="fleet-table-heading"><span>Robot</span><span>State</span><span>Active stage</span><span>Blockers</span><span>Observed</span></div>
          {filteredRobots.map((item) => (
            <button key={item.robot_id} className="fleet-robot-row" onClick={() => onSelectRobot(item.robot_id)}>
              <span className="fleet-robot-name"><Robot size={19} /><span><strong>{item.robot_id}</strong><small>{item.adapter} · {item.architecture} · ROS {item.ros_distro}</small></span></span>
              <span className={`fleet-state fleet-state-${item.state.toLowerCase().replace("_", "-")}`}><StatusDot status={item.state === "READY" ? "observed" : item.state === "ATTENTION" ? "failed" : item.state === "DEGRADED" ? "partial" : "unobserved"} />{item.state.replace("_", " ")}</span>
              <span className="fleet-stage"><strong>{item.active_stage || "—"}</strong><small>{item.active_status?.replace("_", " ") || "No assessment"}</small></span>
              <strong className={item.blocker_count ? "has-blockers" : ""}>{item.blocker_count}</strong>
              <time>{new Date(item.observed_at).toLocaleTimeString()}</time>
              <span className="fleet-next-action">Next: {item.next_action}</span><ArrowRight size={15} />
            </button>
          ))}
          {!filteredRobots.length && <div className="evidence-empty"><Robot size={24} /><strong>No robots match this view</strong><span>Change the search or state filter.</span></div>}
        </section>
        <aside className="panel blocker-inbox">
          <header><div><span>Blocker Inbox</span><h3>{filteredBlockers.length} visible blockers</h3></div><small>Validated pipeline assessments</small></header>
          {filteredBlockers.map((item) => (
            <button key={item.blocker_id} onClick={() => item.evidence_ids[0] ? onOpenEvidence(item.evidence_ids[0]) : onSelectRobot(item.robot_id)}>
              <span className="blocker-inbox-heading"><strong>{item.robot_id}</strong><em>{item.stage}</em></span>
              <p>{item.message}</p>
              <dl><div><dt>Owner</dt><dd>{item.owner.replaceAll("_", " ")}</dd></div><div><dt>Evidence</dt><dd>{item.evidence_ids.length || "No bound artifact"}</dd></div></dl>
              <span className="blocker-action">{item.recommended_action}<ArrowRight size={13} /></span>
            </button>
          ))}
          {!filteredBlockers.length && <div className="evidence-empty"><CheckCircle size={24} /><strong>No blockers match this view</strong><span>Validated pipeline blockers will appear here.</span></div>}
        </aside>
      </div>
    </section>
  );
}

function StackMapView({
  onOpenEvidence,
  onOpenWikiLayer,
  focusLayer,
  topology,
  topologySnapshots,
  robotId,
}: {
  onOpenEvidence: OpenEvidence;
  onOpenWikiLayer?: (layer: ContextWikiLayer) => void;
  focusLayer?: StackContextFocus | null;
  topology?: RobotTopology | null;
  topologySnapshots?: TopologySnapshotCollection | null;
  robotId?: string;
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
  const [fromSnapshotId, setFromSnapshotId] = useState("");
  const [toSnapshotId, setToSnapshotId] = useState("");
  const [topologyDiff, setTopologyDiff] = useState<TopologyDiff | null>(null);
  const [compareMessage, setCompareMessage] = useState("");
  const [compareLoading, setCompareLoading] = useState(false);
  const [pathOpen, setPathOpen] = useState(false);
  const [pathFromId, setPathFromId] = useState("");
  const [pathToId, setPathToId] = useState("");
  const [pathExplanation, setPathExplanation] = useState<TopologyPathExplanation | null>(null);
  const [pathMessage, setPathMessage] = useState("");
  const [pathLoading, setPathLoading] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [focusedLayer, setFocusedLayer] = useState<TopologyDisplayLayer | null>(null);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sourceNodes.some((node) => node.id === selectedId)) {
      setSelectedId(sourceNodes[0]?.id || "");
    }
  }, [selectedId, sourceNodes]);

  useEffect(() => {
    setPathOpen(false);
    setPathFromId("");
    setPathToId("");
    setPathExplanation(null);
    setPathMessage("");
  }, [topology?.snapshot_id]);

  useEffect(() => {
    const snapshots = topologySnapshots?.items || [];
    if (snapshots.length < 2) {
      setFromSnapshotId("");
      setToSnapshotId("");
      setTopologyDiff(null);
      return;
    }
    const current = snapshots.find((item) => item.is_current) || snapshots[0];
    const baseline = snapshots.find((item) => item.snapshot_id !== current.snapshot_id) || snapshots[1];
    setFromSnapshotId(baseline.snapshot_id);
    setToSnapshotId(current.snapshot_id);
    setTopologyDiff(null);
    setCompareMessage("");
  }, [topologySnapshots]);

  useEffect(() => {
    if (!flowInstance || !mapRef.current) return undefined;
    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(() => flowInstance.fitView({ padding: 0.08, duration: 0 }));
    });
    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, [flowInstance]);

  useEffect(() => {
    if (!focusLayer) return;
    const displayLayer = topologyLayerForWiki(focusLayer.layer);
    if (!displayLayer) return;
    const matches = sourceNodes.filter((node) => node.data.layer === displayLayer);
    setFocusedLayer(displayLayer);
    setQuery("");
    setFilter("all");
    if (matches[0]) setSelectedId(matches[0].id);
    if (flowInstance && matches.length) {
      window.requestAnimationFrame(() => flowInstance.fitView({ nodes: matches, padding: 0.28, duration: 240 }));
    }
  }, [flowInstance, focusLayer, sourceNodes]);

  const diffByNode = useMemo(
    () => new Map(topologyDiff?.node_changes.map((item) => [item.node_id, item]) || []),
    [topologyDiff],
  );
  const pathNodeIds = useMemo(
    () => new Set(pathExplanation?.nodes.map((node) => node.node_id) || []),
    [pathExplanation],
  );
  const pathEdgeIds = useMemo(
    () => new Set(pathExplanation?.steps.map((step) => step.edge_id) || []),
    [pathExplanation],
  );
  const nodes = useMemo(() => sourceNodes.map((node) => {
    const searchable = `${node.data.label} ${node.data.subtitle} ${node.data.layer}`.toLowerCase();
    const queryMatch = !query || searchable.includes(query.toLowerCase());
    const statusMatch = filter === "all" || node.data.status === filter;
    const contextMatch = !focusedLayer || node.data.layer === focusedLayer;
    const change = diffByNode.get(node.id);
    return {
      ...node,
      selected: node.id === selectedId,
      className: pathNodeIds.has(node.id) ? "topology-path-node" : change ? `topology-diff-node diff-${change.change.toLowerCase()}` : node.className,
      style: { opacity: queryMatch && statusMatch && contextMatch && (!pathExplanation?.found || pathNodeIds.has(node.id)) ? 1 : 0.18 },
    };
  }), [selectedId, query, filter, focusedLayer, sourceNodes, diffByNode, pathExplanation, pathNodeIds]);
  const edges = useMemo(() => sourceEdges.map((edge) => ({
    ...edge,
    className: pathEdgeIds.has(edge.id) ? "topology-path-edge" : edge.className,
    style: pathExplanation?.found && !pathEdgeIds.has(edge.id) ? { opacity: 0.12 } : edge.style,
  })), [sourceEdges, pathEdgeIds, pathExplanation]);

  const loadComparison = useCallback(async () => {
    if (!robotId || !fromSnapshotId || !toSnapshotId || fromSnapshotId === toSnapshotId) {
      setCompareMessage("Choose two different verified snapshots.");
      return;
    }
    setCompareLoading(true);
    setCompareMessage("");
    try {
      setTopologyDiff(await roloClient.topologyDiff(robotId, fromSnapshotId, toSnapshotId));
    } catch (error) {
      setTopologyDiff(null);
      setCompareMessage(error instanceof Error ? error.message : "Snapshot comparison is unavailable.");
    } finally {
      setCompareLoading(false);
    }
  }, [fromSnapshotId, robotId, toSnapshotId]);

  const openPathExplorer = useCallback((fromId = selectedId) => {
    const fallbackTarget = sourceNodes.find((node) => node.id !== fromId)?.id || fromId;
    setPathFromId(fromId);
    setPathToId((current) => current && current !== fromId ? current : fallbackTarget);
    setPathExplanation(null);
    setPathMessage("");
    setCompare(false);
    setPathOpen(true);
  }, [selectedId, sourceNodes]);

  const loadPath = useCallback(async () => {
    if (!robotId || !topology || !pathFromId || !pathToId || pathFromId === pathToId) {
      setPathMessage("Choose two different topology components.");
      return;
    }
    setPathLoading(true);
    setPathMessage("");
    try {
      setPathExplanation(await roloClient.topologyPath(robotId, pathFromId, pathToId));
    } catch (error) {
      setPathExplanation(null);
      setPathMessage(error instanceof Error ? error.message : "Topology path explanation is unavailable.");
    } finally {
      setPathLoading(false);
    }
  }, [pathFromId, pathToId, robotId, topology]);

  const handleNodeClick: NodeMouseHandler = useCallback((_, node) => setSelectedId(node.id), []);
  const selectedNode = sourceNodes.find((node) => node.id === selectedId) || sourceNodes[0];
  if (!selectedNode) {
    return <ReadModelUnavailableView title="Stack Map" description="The topology read model contains no nodes." />;
  }
  const details = selectedNode.data;
  const connected = sourceEdges.filter((edge) => edge.source === selectedId || edge.target === selectedId);
  const selectedChange = diffByNode.get(selectedId);
  const selectedWikiLayer = wikiLayerForTopology(details.layer);
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
        <button className={`secondary-button ${compare ? "is-active" : ""}`} disabled={Boolean(topology && (topologySnapshots?.items.length || 0) < 2)} onClick={() => { setPathOpen(false); setPathExplanation(null); setCompare((value) => !value); }} title={topology && (topologySnapshots?.items.length || 0) < 2 ? "Two verified snapshots are required" : undefined}>
          <GitBranch size={17} /> Compare snapshot
        </button>
        <button className={`secondary-button ${pathOpen ? "is-active" : ""}`} disabled={!topology || sourceNodes.length < 2} onClick={() => openPathExplorer()} title={!topology ? "A live topology read model is required" : undefined}>
          <Path size={17} /> Explain path
        </button>
      </div>}

      {compare && !topology && (
        <div className="compare-banner">
          <Info size={18} weight="fill" />
          <span>Comparing Aug 20 against Aug 18: 2 bindings changed, 1 node disappeared.</span>
          <button onClick={() => setCompare(false)}><X size={16} /></button>
        </div>
      )}

      {compare && topology && (
        <div className="snapshot-compare-panel" aria-label="Verified topology snapshot comparison">
          <div className="snapshot-compare-heading">
            <div><span>Verified history</span><strong>Compare gated snapshots</strong></div>
            <button onClick={() => setCompare(false)} aria-label="Close snapshot comparison"><X size={16} /></button>
          </div>
          <div className="snapshot-selectors">
            <label><span>Baseline</span><select value={fromSnapshotId} onChange={(event) => { setFromSnapshotId(event.target.value); setTopologyDiff(null); }} aria-label="Baseline topology snapshot">{topologySnapshots?.items.map((item) => <option key={item.snapshot_id} value={item.snapshot_id}>{new Date(item.published_at).toLocaleString()} · {item.release_id}</option>)}</select></label>
            <ArrowRight size={16} />
            <label><span>Target</span><select value={toSnapshotId} onChange={(event) => { setToSnapshotId(event.target.value); setTopologyDiff(null); }} aria-label="Target topology snapshot">{topologySnapshots?.items.map((item) => <option key={item.snapshot_id} value={item.snapshot_id}>{new Date(item.published_at).toLocaleString()} · {item.release_id}{item.is_current ? " · current" : ""}</option>)}</select></label>
          </div>
          <button className="primary-button snapshot-compare-action" disabled={compareLoading || fromSnapshotId === toSnapshotId} onClick={() => void loadComparison()}>{compareLoading ? "Comparing…" : "Compare verified evidence"}</button>
          {compareMessage && <small role="alert" className="snapshot-compare-message">{compareMessage}</small>}
          {topologyDiff && <div className="snapshot-diff-summary">
            <span className="diff-added"><strong>+{topologyDiff.added_nodes}</strong> nodes</span>
            <span className="diff-removed"><strong>−{topologyDiff.removed_nodes}</strong> nodes</span>
            <span className="diff-changed"><strong>{topologyDiff.changed_nodes}</strong> changed</span>
            <span><strong>{topologyDiff.added_edges + topologyDiff.removed_edges + topologyDiff.changed_edges}</strong> relationships</span>
          </div>}
          <p>{topologyDiff?.limitations[0] || topologySnapshots?.limitations[0]}</p>
        </div>
      )}

      {pathOpen && topology && (
        <div className="path-explain-panel" aria-label="Explain topology path">
          <div className="snapshot-compare-heading">
            <div><span>Bounded topology projection</span><strong>Explain component path</strong></div>
            <button onClick={() => { setPathOpen(false); setPathExplanation(null); }} aria-label="Close path explanation"><X size={16} /></button>
          </div>
          <div className="snapshot-selectors">
            <label><span>From</span><select value={pathFromId} onChange={(event) => { setPathFromId(event.target.value); setPathExplanation(null); }} aria-label="Path source component">{sourceNodes.map((node) => <option key={node.id} value={node.id}>{node.data.label} · {node.data.layer}</option>)}</select></label>
            <ArrowRight size={16} />
            <label><span>To</span><select value={pathToId} onChange={(event) => { setPathToId(event.target.value); setPathExplanation(null); }} aria-label="Path target component">{sourceNodes.map((node) => <option key={node.id} value={node.id}>{node.data.label} · {node.data.layer}</option>)}</select></label>
          </div>
          <button className="primary-button snapshot-compare-action" disabled={pathLoading || pathFromId === pathToId} onClick={() => void loadPath()}>{pathLoading ? "Explaining…" : "Explain trusted relationships"}</button>
          {pathMessage && <small role="alert" className="snapshot-compare-message">{pathMessage}</small>}
          {pathExplanation && <div className="path-explanation-result">
            <div className={`path-result-heading ${pathExplanation.found ? "is-found" : ""}`}><span><strong>{pathExplanation.found ? `${pathExplanation.hop_count} hop connection` : "No bounded path"}</strong><small>{pathExplanation.summary}</small></span><em>{pathExplanation.integrity_status}</em></div>
            {pathExplanation.steps.map((step, index) => {
              const fromNode = pathExplanation.nodes[index];
              const toNode = pathExplanation.nodes[index + 1];
              return <div className="path-step" key={step.edge_id}><button onClick={() => setSelectedId(step.to_node_id)}><span>{index + 1}</span><span><strong>{fromNode.label} → {toNode.label}</strong><small>{step.direction === "FORWARD" ? step.relation : `reverse of ${step.relation}`} · {step.state.toLowerCase()}</small></span></button><button disabled={!step.evidence_ids.length} onClick={() => step.evidence_ids[0] && onOpenEvidence(step.evidence_ids[0])} aria-label={`Open evidence for ${step.relation}`}><ShieldCheck size={15} /></button></div>;
            })}
            <p>{pathExplanation.limitations[0]}</p>
          </div>}
        </div>
      )}

      <div className="map-stage" ref={mapRef}>
        {focusedLayer && <div className="map-context-banner"><BookOpenText size={16} /><span><strong>Wiki context</strong><small>{focusedLayer} lane · {sourceNodes.filter((node) => node.data.layer === focusedLayer).length} topology nodes</small></span><button onClick={() => setFocusedLayer(null)} aria-label="Clear Wiki layer focus"><X size={15} /></button></div>}
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
          edges={edges}
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

        {selectedChange && <div className="inspector-section topology-change-section">
          <div className="section-title-row"><h4>Snapshot change</h4><strong className={`diff-label diff-${selectedChange.change.toLowerCase()}`}>{selectedChange.change}</strong></div>
          <p>{selectedChange.change === "CHANGED" ? `Changed fields: ${selectedChange.changed_fields.join(", ")}.` : `${details.label} was ${selectedChange.change.toLowerCase()} between the selected gated releases.`}</p>
        </div>}

        <div className="inspector-actions">
          <button className="primary-button" disabled={Boolean(topology && !details.evidenceIds?.length)} onClick={() => onOpenEvidence(topology ? details.evidenceIds?.[0] || "" : EVIDENCE[0])}>Open evidence</button>
          {selectedWikiLayer && onOpenWikiLayer && <button className="secondary-button" onClick={() => onOpenWikiLayer(selectedWikiLayer)}><BookOpenText size={15} /> Open related Wiki layer</button>}
          <button className="secondary-button" disabled={!topology || sourceNodes.length < 2} onClick={() => openPathExplorer(selectedId)}>Explain path from here</button>
          <button className="secondary-button" disabled={Boolean(topology && (topologySnapshots?.items.length || 0) < 2)} onClick={() => { setPathOpen(false); setPathExplanation(null); setCompare(true); }} title={topology && (topologySnapshots?.items.length || 0) < 2 ? "Two verified snapshots are required" : undefined}>Compare snapshot</button>
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

function ContractSchemaPanel({
  label,
  schema,
  semanticUnits,
}: {
  label: string;
  schema: Record<string, unknown>;
  semanticUnits: Record<string, string>;
}) {
  const projection = useMemo(
    () => projectContractSchema(schema, semanticUnits),
    [schema, semanticUnits],
  );
  return (
    <section className="contract-schema-panel">
      <header>
        <div><span>{label}</span><strong>{projection.fields.length} fields · {projection.rootType}</strong></div>
        <small>{projection.allowsAdditionalProperties === false ? "Closed schema" : projection.allowsAdditionalProperties ? "Additional fields allowed" : "Additional fields unspecified"}</small>
      </header>
      <div className="contract-field-heading"><span>Field</span><span>Type</span><span>Requirement</span><span>Semantics</span></div>
      {projection.fields.map((field) => (
        <div className="contract-field-row" key={field.path}>
          <code style={{ paddingLeft: `${field.depth * 12}px` }}>{field.path}</code>
          <span>{field.type}</span>
          <strong className={field.required ? "is-required" : ""}>{field.required ? "Required" : "Optional"}</strong>
          <small>{[field.unit ? `unit: ${field.unit}` : "", ...field.constraints, field.description || ""].filter(Boolean).join(" · ") || "—"}</small>
        </div>
      ))}
      {!projection.fields.length && <p className="contract-schema-empty">No fields declared.</p>}
      {projection.truncated && <p className="contract-schema-warning">Field projection is bounded; inspect the raw schema for remaining nested fields.</p>}
      <details><summary>Raw JSON schema</summary><pre>{JSON.stringify(schema, null, 2)}</pre></details>
    </section>
  );
}

function ContractRuleGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <strong>{label}</strong>
      {values.length ? values.map((value) => <p key={value}>{value}</p>) : <p>None declared.</p>}
    </div>
  );
}

function BindingTrustPanel({
  bindings,
  onOpenEvidence,
}: {
  bindings: CapabilityBinding[];
  onOpenEvidence: OpenEvidence;
}) {
  const summary = useMemo(() => summarizeBindingTrust(bindings), [bindings]);
  if (!bindings.length) {
    return <div className="empty-state"><Network size={26} /><strong>No observed binding</strong><span>This contract is not bound to a current robot endpoint.</span></div>;
  }
  return (
    <div className="binding-trust-inspector">
      <div className="binding-trust-summary">
        <div><span>Total routes</span><strong>{summary.total}</strong></div>
        <div><span>Gated</span><strong>{summary.gated}</strong></div>
        <div><span>Observed</span><strong>{summary.observed}</strong></div>
        <div><span>Declared</span><strong>{summary.declared}</strong></div>
        <div><span>Evidence-linked</span><strong>{summary.evidenceLinked}</strong></div>
      </div>
      <div className="capability-binding-list">
        {bindings.map((binding) => (
          <article className={`binding-card binding-authority-${binding.authority.toLowerCase()}`} key={binding.binding_id}>
            <header>
              <div><span className={`mini-chip authority-${binding.authority.toLowerCase()}`}>{binding.authority}</span><small>{binding.source.replace("_", " ")}</small></div>
              <code>{binding.binding_id}</code>
            </header>
            <div className="binding-endpoint"><span>Endpoint</span><code>{binding.endpoint}</code></div>
            <dl>
              <div><dt>Kind</dt><dd>{binding.kind.replace("_", " ")}</dd></div>
              <div><dt>Interface</dt><dd>{binding.interface_type || "Not collected"}</dd></div>
              <div><dt>Adapter</dt><dd>{binding.adapter || "Not gated"}</dd></div>
              <div><dt>Observed</dt><dd>{binding.observed_at ? new Date(binding.observed_at).toLocaleString() : "Not observed"}</dd></div>
            </dl>
            <div className="binding-verdict"><ShieldCheck size={16} /><span>{bindingTrustStatement(binding)}</span></div>
            <div className="binding-digest"><span>Reference digest</span><code title={binding.reference_digest}>{binding.reference_digest}</code></div>
            {binding.evidence_ids.length > 0 && <div className="binding-evidence-links"><span>Binding evidence</span>{binding.evidence_ids.map((id) => <button key={id} onClick={() => onOpenEvidence(id)}><FileText size={14} /><code>{id}</code><ArrowRight size={13} /></button>)}</div>}
            {binding.limitations.length > 0 && <div className="binding-limitations"><span>Known limits</span>{binding.limitations.map((limitation) => <p key={limitation}>{limitation}</p>)}</div>}
          </article>
        ))}
      </div>
      <footer><Info size={15} /><span>{summary.limitations} declared limitations. Endpoint presence and binding authority do not prove task or physical outcome success.</span></footer>
    </div>
  );
}

function CapabilityReadinessPanel({
  capability,
  bindings,
}: {
  capability: CapabilitySummary;
  bindings: CapabilityBinding[];
}) {
  const signals = useMemo(
    () => capabilityReadinessSignals(capability, bindings),
    [bindings, capability],
  );
  return (
    <section className="capability-readiness-panel">
      <header><div><span>Independent read-model signals</span><h4>Capability readiness lens</h4></div><small>{signals.filter((signal) => signal.state === "established").length} of {signals.length} established</small></header>
      <div className="capability-readiness-signals">
        {signals.map((signal, index) => {
          const SignalIcon = signal.state === "established" ? CheckCircle : signal.state === "missing" ? X : signal.state === "partial" ? WarningCircle : Info;
          return <div className={`readiness-signal readiness-${signal.state}`} key={signal.id}><span className="readiness-index">{index + 1}</span><SignalIcon size={17} weight={signal.state === "established" ? "fill" : "regular"} /><span><strong>{signal.label}</strong><small>{signal.statement}</small></span><em>{signal.value}</em></div>;
        })}
      </div>
      <footer><Info size={15} /><span>Signals are independent read-model facts, not a causal workflow. AVAILABLE, endpoint presence, and gated acknowledgement do not prove task or physical outcome success.</span></footer>
    </section>
  );
}

function LiveCapabilityView({
  robotId,
  items,
  limitations,
  apiFeatures,
  onOpenEvidence,
}: {
  robotId: string;
  items: CapabilitySummary[];
  limitations: string[];
  apiFeatures: string[];
  onOpenEvidence: OpenEvidence;
}) {
  const [selectedOperation, setSelectedOperation] = useState(items[0]?.operation || "");
  const [detail, setDetail] = useState<CapabilityDetail | null>(null);
  const [detailMessage, setDetailMessage] = useState("");
  const [query, setQuery] = useState("");
  const [layer, setLayer] = useState<CapabilityFilterState["layer"]>("ALL");
  const [availabilityFilter, setAvailabilityFilter] = useState<CapabilityFilterState["availability"]>("ALL");
  const [riskFilter, setRiskFilter] = useState<CapabilityFilterState["risk"]>("ALL");
  const [accessFilter, setAccessFilter] = useState<CapabilityFilterState["access"]>("ALL");
  const [lifecycleFilter, setLifecycleFilter] = useState<CapabilityFilterState["lifecycle"]>("ALL");
  const [classificationFilter, setClassificationFilter] = useState<CapabilityFilterState["classification"]>("ALL");
  const [governanceOpen, setGovernanceOpen] = useState(false);
  const [adaptOpen, setAdaptOpen] = useState(false);
  const [adaptLoading, setAdaptLoading] = useState(false);
  const [adaptMessage, setAdaptMessage] = useState("");
  const [targetSlice, setTargetSlice] = useState<TargetOperationSlice | null>(null);
  const [operationGovernance, setOperationGovernance] = useState<OperationDisposition[]>([]);
  const adaptRequest = useRef<AbortController | null>(null);
  const [tab, setTab] = useState<"overview" | "contract" | "binding" | "evidence">("overview");
  const coverage = useMemo(() => summarizeCapabilityCoverage(items), [items]);
  const allFamilies = useMemo(() => groupCapabilitiesByFamily(items), [items]);
  const filters = useMemo<CapabilityFilterState>(() => ({
    query,
    layer,
    availability: availabilityFilter,
    risk: riskFilter,
    access: accessFilter,
    lifecycle: lifecycleFilter,
    classification: classificationFilter,
  }), [accessFilter, availabilityFilter, classificationFilter, layer, lifecycleFilter, query, riskFilter]);
  const visible = useMemo(() => filterCapabilities(items, filters), [filters, items]);
  const visibleFamilies = useMemo(() => groupCapabilitiesByFamily(visible), [visible]);
  const governanceFilterCount = activeGovernanceFilterCount(filters);
  const targetSliceSupported = apiFeatures.includes(ROLO_API_FEATURES.targetOperationSlice);
  const operationGovernanceSupported = apiFeatures.includes(ROLO_API_FEATURES.operationGovernance);
  const adaptContextSupported = targetSliceSupported;
  const adaptLens = useMemo(
    () => targetSlice ? buildAdaptContextLens(targetSlice, operationGovernance) : null,
    [operationGovernance, targetSlice],
  );

  const loadAdaptContext = useCallback(() => {
    adaptRequest.current?.abort();
    const controller = new AbortController();
    adaptRequest.current = controller;
    setAdaptLoading(true);
    setAdaptMessage("");
    const sliceRequest = targetSliceSupported
      ? roloClient.targetOperationSlice(robotId, { signal: controller.signal })
      : Promise.resolve(null);
    const governanceRequest = operationGovernanceSupported
      ? roloClient.operationGovernance({ signal: controller.signal })
      : Promise.resolve(null);
    void Promise.allSettled([sliceRequest, governanceRequest]).then(([sliceResult, governanceResult]) => {
      if (controller.signal.aborted) return;
      const messages: string[] = [];
      if (sliceResult.status === "fulfilled") setTargetSlice(sliceResult.value);
      else messages.push(sliceResult.reason instanceof Error ? sliceResult.reason.message : "Target operation slice is unavailable.");
      if (governanceResult.status === "fulfilled") setOperationGovernance(governanceResult.value?.items || []);
      else messages.push(governanceResult.reason instanceof Error ? governanceResult.reason.message : "Operation governance is unavailable.");
      setAdaptMessage(messages.join(" "));
    }).finally(() => {
      if (!controller.signal.aborted) setAdaptLoading(false);
      if (adaptRequest.current === controller) adaptRequest.current = null;
    });
  }, [operationGovernanceSupported, robotId, targetSliceSupported]);

  const closeAdaptContext = () => {
    adaptRequest.current?.abort();
    adaptRequest.current = null;
    setAdaptLoading(false);
    setAdaptOpen(false);
  };
  const toggleAdaptContext = () => {
    if (adaptOpen) {
      closeAdaptContext();
      return;
    }
    setAdaptOpen(true);
    if ((!targetSlice || adaptMessage) && !adaptLoading) loadAdaptContext();
  };

  useEffect(() => () => adaptRequest.current?.abort(), []);
  useEffect(() => {
    adaptRequest.current?.abort();
    setAdaptOpen(false);
    setAdaptLoading(false);
    setAdaptMessage("");
    setTargetSlice(null);
    setOperationGovernance([]);
  }, [robotId]);

  useEffect(() => {
    if (!visible.some((item) => item.operation === selectedOperation)) {
      setSelectedOperation(visible[0]?.operation || "");
    }
  }, [selectedOperation, visible]);

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

  const selected = items.find((item) => item.operation === selectedOperation);
  const detailItem = detail?.capability || selected;
  const relations = useMemo(
    () => detailItem ? getCapabilityRelations(detailItem, items) : [],
    [detailItem, items],
  );
  const selectCoverageLayer = (selectedLayer: typeof CAPABILITY_LAYERS[number]) => {
    const nextLayer: CapabilityFilterState["layer"] = layer === selectedLayer ? "ALL" : selectedLayer;
    setLayer(nextLayer);
    setQuery("");
    const firstMatch = filterCapabilities(items, { ...filters, query: "", layer: nextLayer })[0];
    if (firstMatch) {
      setSelectedOperation(firstMatch.operation);
      setTab("overview");
    }
  };
  const openRelatedOperation = (operation: string) => {
    const related = items.find((item) => item.operation === operation);
    if (!related) return;
    setLayer(related.layer);
    setAvailabilityFilter("ALL");
    setRiskFilter("ALL");
    setAccessFilter("ALL");
    setLifecycleFilter("ALL");
    setClassificationFilter("ALL");
    setQuery("");
    setSelectedOperation(related.operation);
    setTab("overview");
  };

  return (
    <section className="content-view capabilities-view">
      <PageTitle
        title="Capabilities"
        description="Canonical contracts joined with current robot applicability, bindings, and evidence."
        action={<div className="coverage-summary"><strong>{coverage.total} operations · {allFamilies.length} families · {coverage.availability.VERIFIED} verified</strong><span><i style={{ width: capabilityCoveragePercent(coverage.availability.VERIFIED, coverage.total) }} /><i style={{ width: capabilityCoveragePercent(coverage.availability.AVAILABLE, coverage.total) }} /><i style={{ width: capabilityCoveragePercent(coverage.availability.UNAVAILABLE, coverage.total) }} /><i style={{ width: capabilityCoveragePercent(coverage.availability.UNKNOWN, coverage.total) }} /></span></div>}
      />
      <section className="panel capability-coverage-map" aria-label="Capability coverage by product layer">
        <header><div><span>Validated capability summaries</span><h3>Coverage by product layer</h3></div><div className="capability-coverage-actions">{adaptContextSupported && <button className={`secondary-button ${adaptOpen ? "is-active" : ""}`} aria-expanded={adaptOpen} onClick={toggleAdaptContext}><Target size={15} />Adapt context</button>}<button className="secondary-button" disabled={layer === "ALL" && availabilityFilter === "ALL"} onClick={() => { setLayer("ALL"); setAvailabilityFilter("ALL"); }}>Clear coverage filters</button></div></header>
        <div className="capability-coverage-grid">
          {coverage.layers.map((item) => (
            <button key={item.layer} className={layer === item.layer ? "is-active" : ""} onClick={() => selectCoverageLayer(item.layer)} aria-pressed={layer === item.layer}>
              <span className="coverage-card-heading"><strong>{item.layer}</strong><em>{item.total} operations</em></span>
              <span className="coverage-layer-bar" aria-label={`${item.layer}: ${item.availability.VERIFIED} verified, ${item.availability.AVAILABLE} available, ${item.availability.UNAVAILABLE} unavailable, ${item.availability.UNKNOWN} unknown`}><i className="is-verified" style={{ width: capabilityCoveragePercent(item.availability.VERIFIED, item.total) }} /><i className="is-available" style={{ width: capabilityCoveragePercent(item.availability.AVAILABLE, item.total) }} /><i className="is-unavailable" style={{ width: capabilityCoveragePercent(item.availability.UNAVAILABLE, item.total) }} /><i className="is-unknown" style={{ width: capabilityCoveragePercent(item.availability.UNKNOWN, item.total) }} /></span>
              <dl><div><dt>Applicable</dt><dd>{item.applicable}</dd></div><div><dt>Bindings</dt><dd>{item.withBindings}</dd></div><div><dt>Released</dt><dd>{item.released}</dd></div><div><dt>R2 / R3</dt><dd>{item.elevatedRisk}</dd></div></dl>
            </button>
          ))}
        </div>
        <footer><Info size={15} /><span>Verified, available, unavailable, and unknown remain separate trust states. Coverage does not imply task or physical outcome success.</span></footer>
      </section>
      {adaptOpen && <section className="panel adapt-context-lens" aria-label="Adapt target operation context" aria-live="polite">
        <header><div><span>Shadow planning read model</span><h3>Adapt context lens</h3><p>Bounded target work for this robot, separated from Registry capability availability.</p></div><div><small>On demand · read only</small><button className="icon-button" aria-label="Close Adapt context" onClick={closeAdaptContext}><X size={16} /></button></div></header>
        {adaptLoading ? <div className="adapt-context-state"><Pulse size={24} /><span><strong>Resolving bounded workset</strong><small>The optional Adapt read models are loaded outside workbench bootstrap.</small></span></div> : adaptLens && targetSlice ? <>
          <div className="adapt-context-summary">
            <div><span>Current workset</span><strong>{adaptLens.worksetCount}</strong><small>primary + dependency</small></div>
            <div><span>Target adapter</span><strong>{adaptLens.executionCounts.TARGET_ADAPTER}</strong><small>implementation surface</small></div>
            <div><span>Agent native</span><strong>{adaptLens.executionCounts.AGENT_NATIVE}</strong><small>evidence and discovery</small></div>
            <div><span>Product built-in</span><strong>{adaptLens.executionCounts.PRODUCT_BUILTIN}</strong><small>no adapter required</small></div>
            <div><span>Deferred</span><strong>{adaptLens.deferredCount}</strong><small>grouped by reason</small></div>
          </div>
          <div className="adapt-context-body">
            <section className="adapt-target-list">
              <header><div><span>Target adapter operations</span><h4>Current implementation surface</h4></div><small>{adaptLens.governedTargetCount} / {adaptLens.targetOperations.length} governance records joined</small></header>
              {adaptLens.targetOperations.length ? adaptLens.targetOperations.map((item) => <div className="adapt-target-row" key={item.operation}>
                <span className={`adapt-role role-${item.role.toLowerCase()}`}>{item.role}</span>
                <span><code>{item.operation}</code><small>{item.governance ? `${item.governance.semantic_layer} · ${item.governance.migration_status}` : "Governance record unavailable"}</small></span>
                <span><small>Future capability</small><code>{item.governance?.future_capability || "Not mapped"}</code></span>
              </div>) : <div className="adapt-context-empty"><CheckCircle size={20} /><span><strong>No target-adapter operations</strong><small>The current slice does not request adapter implementation work.</small></span></div>}
            </section>
            <aside className="adapt-context-meta">
              <section><span>Deferred reasons</span>{adaptLens.deferred.length ? adaptLens.deferred.map((item) => <div key={item.reason}><code>{item.reason.replaceAll("_", " ")}</code><strong>{item.count}</strong></div>) : <p>No deferred operations are reported.</p>}</section>
              <dl><div><dt>Discovery</dt><dd>{targetSlice.discovery_id}</dd></div><div><dt>Slice digest</dt><dd><code>{targetSlice.slice_sha256.slice(0, 12)}…</code></dd></div><div><dt>Registry digest</dt><dd><code>{targetSlice.registry_sha256.slice(0, 12)}…</code></dd></div><div><dt>Governance ledger</dt><dd>{operationGovernance.length ? `${operationGovernance.length} operations` : "Not available"}</dd></div></dl>
            </aside>
          </div>
        </> : <div className="adapt-context-state is-warning"><WarningCircle size={24} /><span><strong>Adapt context is unavailable</strong><small>{adaptMessage || "The advertised optional read model did not return a target slice."}</small></span>{adaptContextSupported && <button className="secondary-button" onClick={loadAdaptContext}>Retry</button>}</div>}
        {adaptMessage && adaptLens && <div className="adapt-context-warning"><WarningCircle size={15} /><span>{adaptMessage}</span><button className="secondary-button" disabled={adaptLoading} onClick={loadAdaptContext}>Retry optional data</button></div>}
        <footer><Info size={15} /><span>This shadow view narrows agent work. It does not change the 294-operation Registry, capability availability, policy, conformance, or release gates.</span></footer>
      </section>}
      <div className="capability-layout">
        <div className="capability-list panel">
          <div className="capability-toolbar">
            <div className="capability-search search-box"><MagnifyingGlass size={18} /><input aria-label="Search canonical operations" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search operations" /></div>
            <label className="capability-layer-filter"><span>Layer</span><select value={layer} onChange={(event) => setLayer(event.target.value as CapabilityFilterState["layer"])}><option value="ALL">All layers</option>{CAPABILITY_LAYERS.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="capability-layer-filter"><span>Availability</span><select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value as CapabilityFilterState["availability"])}><option value="ALL">All availability</option>{CAPABILITY_AVAILABILITY.map((value) => <option key={value}>{value}</option>)}</select></label>
            <button className={`secondary-button capability-governance-toggle ${governanceFilterCount ? "is-active" : ""}`} aria-expanded={governanceOpen} onClick={() => setGovernanceOpen((value) => !value)}><Funnel size={15} />Governance{governanceFilterCount ? ` · ${governanceFilterCount}` : ""}</button>
          </div>
          {governanceOpen && <div className="capability-governance-panel">
            <label><span>Risk</span><select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as CapabilityFilterState["risk"])}><option value="ALL">All risk</option>{CAPABILITY_RISKS.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Access</span><select value={accessFilter} onChange={(event) => setAccessFilter(event.target.value as CapabilityFilterState["access"])}><option value="ALL">All access</option>{CAPABILITY_ACCESS.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Lifecycle</span><select value={lifecycleFilter} onChange={(event) => setLifecycleFilter(event.target.value as CapabilityFilterState["lifecycle"])}><option value="ALL">All lifecycle</option>{CAPABILITY_LIFECYCLES.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Classification</span><select value={classificationFilter} onChange={(event) => setClassificationFilter(event.target.value as CapabilityFilterState["classification"])}><option value="ALL">All classification</option>{CAPABILITY_CLASSIFICATIONS.map((value) => <option key={value}>{value}</option>)}</select></label>
            <button className="secondary-button" disabled={!governanceFilterCount} onClick={() => { setRiskFilter("ALL"); setAccessFilter("ALL"); setLifecycleFilter("ALL"); setClassificationFilter("ALL"); }}>Clear governance</button>
          </div>}
          <div className="layer-summary-row"><span>Operation</span><span>Lifecycle</span><span>Availability</span></div>
          {visibleFamilies.map((family) => (
            <section className="capability-family" key={family.family} aria-label={`${family.family} operation family`}>
              <header><code>{family.family}</code><span>{family.items.length} {family.items.length === 1 ? "operation" : "operations"}</span></header>
              {family.items.map((item) => (
                <button key={item.operation} className={`operation-row ${selected?.operation === item.operation ? "is-selected" : ""}`} onClick={() => { setSelectedOperation(item.operation); setTab("overview"); }}>
                  <span className="operation-main"><code>{item.operation}</code><small>{item.layer} · {item.applicability.replace("_", " ")}</small><small className="operation-governance-line">{item.access} · {item.risk} · {item.data_classification}</small></span>
                  <span className={`mini-chip lifecycle-${item.lifecycle.toLowerCase()}`}>{item.lifecycle}</span>
                  <span className={`mini-chip availability-${item.availability.toLowerCase()}`}>{item.availability}</span>
                  <ArrowRight size={15} />
                </button>
              ))}
            </section>
          ))}
          {!visible.length && <div className="empty-state"><MagnifyingGlass size={28} /><strong>No operations found</strong><span>Change the query, layer, or availability filter.</span></div>}
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
              <div className="capability-relations">
                <header><div><span>Declared operation links</span><h4>Related operations</h4></div><small>{relations.length ? `${relations.length} canonical ${relations.length === 1 ? "link" : "links"}` : "No links declared"}</small></header>
                {relations.length ? relations.map((relation) => (
                  <button key={`${relation.kind}-${relation.operation}`} disabled={!relation.capability} onClick={() => openRelatedOperation(relation.operation)}>
                    <span className={`relation-kind relation-${relation.kind}`}>{relation.kind}</span>
                    <code>{relation.operation}</code>
                    {relation.capability ? <ArrowRight size={14} /> : <small>Not in registry</small>}
                  </button>
                )) : <p>No paired, replacement, or compensation operation is declared for this contract.</p>}
              </div>
              {detail && <CapabilityReadinessPanel capability={detail.capability} bindings={detail.bindings} />}
              {(detailItem.limitations.length || limitations.length) > 0 && <div className="capability-limitations"><strong>Known limits</strong>{[...new Set([...detailItem.limitations, ...limitations])].map((value) => <p key={value}>{value}</p>)}</div>}
            </>}
            {tab === "contract" && detail && <div className="capability-contract-view">
              <div className="contract-semantics-grid">
                <div><span>Execution</span><strong>{detail.contract.execution_mode.replace("_", " ")}</strong></div>
                <div><span>Result</span><strong className={detail.contract.result_semantics === "ACKNOWLEDGEMENT_ONLY" ? "is-caution" : ""}>{detail.contract.result_semantics.replaceAll("_", " ")}</strong></div>
                <div><span>Maximum duration</span><strong>{detail.contract.max_duration_s}s</strong></div>
                <div><span>Control</span><strong>{detail.contract.cancelable ? "Cancelable" : "Not cancelable"} · {detail.contract.idempotent ? "Idempotent" : "Non-idempotent"}</strong></div>
              </div>
              <ContractSchemaPanel label="Input schema" schema={detail.contract.input_schema} semanticUnits={detail.contract.semantic_units} />
              <ContractSchemaPanel label="Output schema" schema={detail.contract.output_schema} semanticUnits={detail.contract.semantic_units} />
              <div className="contract-context-grid">
                <ContractRuleGroup label="Capability requirements" values={detail.contract.capability_requirements} />
                <ContractRuleGroup label="Preconditions" values={detail.contract.preconditions} />
                <ContractRuleGroup label="Postconditions" values={detail.contract.postconditions} />
                <ContractRuleGroup label="Side effects" values={detail.contract.side_effects} />
                <ContractRuleGroup label="Resource locks" values={detail.contract.resource_locks} />
                <ContractRuleGroup label="Coordinate frames" values={detail.contract.coordinate_frames} />
              </div>
              <div className="contract-time-semantics"><Clock size={16} /><span><strong>Time semantics</strong>{detail.contract.time_semantics}</span></div>
            </div>}
            {tab === "binding" && detail && <BindingTrustPanel bindings={detail.bindings} onOpenEvidence={onOpenEvidence} />}
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

function LiveLifecycleView({
  pipeline,
  runs,
  robotId,
  onOpenEvidence,
}: {
  pipeline: PipelineRow[];
  runs: LifecycleRunCollection;
  robotId: string;
  onOpenEvidence: OpenEvidence;
}) {
  const [active, setActive] = useState("adapt");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [runDetail, setRunDetail] = useState<LifecycleRunDetail | null>(null);
  const [runMessage, setRunMessage] = useState("");
  const assessment = useMemo(
    () => summarizeLifecycleAssessment(pipeline, runs.items),
    [pipeline, runs.items],
  );
  const selected = pipeline.find((item) => item.stage === active) || pipeline[0];
  const stageRuns = runs.items.filter((item) => item.stage === active);

  useEffect(() => {
    if (pipeline.length && !pipeline.some((item) => item.stage === active)) {
      setActive(pipeline[0].stage);
    }
  }, [active, pipeline]);

  useEffect(() => {
    if (!stageRuns.some((item) => item.run_id === selectedRunId)) {
      setSelectedRunId(stageRuns[0]?.run_id || "");
    }
  }, [selectedRunId, stageRuns]);

  useEffect(() => {
    if (!selectedRunId) {
      setRunDetail(null);
      setRunMessage("");
      return;
    }
    const controller = new AbortController();
    setRunDetail(null);
    setRunMessage("Loading bounded run metadata…");
    void roloClient.run(robotId, selectedRunId, { signal: controller.signal })
      .then((result) => {
        setRunDetail(result);
        setRunMessage("");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setRunMessage(error instanceof Error ? error.message : "Lifecycle run detail is unavailable.");
      });
    return () => controller.abort();
  }, [robotId, selectedRunId]);

  if (!selected) {
    return <ReadModelUnavailableView title="Lifecycle" description="The live pipeline contains no stage assessments." />;
  }
  const prerequisites = selected.prerequisites || [];
  const artifacts = selected.artifactRefs || [];
  const blockers = selected.blockerMessages || [];
  return (
    <section className="content-view">
      <PageTitle title="Lifecycle" description="Read-only pipeline facts; a stage status is not physical outcome evidence." />
      <section className="panel lifecycle-assessment-matrix">
        <header><div><span>Current assessment snapshot</span><h3>Lifecycle stage matrix</h3></div><dl><div><dt>Stages</dt><dd>{assessment.stages}</dd></div><div><dt>Blocked</dt><dd>{assessment.blocked}</dd></div><div><dt>Degraded</dt><dd>{assessment.degraded}</dd></div><div><dt>Blockers</dt><dd>{assessment.blockers}</dd></div><div><dt>Supported runs</dt><dd>{assessment.supportedRuns}</dd></div></dl></header>
        <div className="lifecycle-assessment-grid" role="tablist" aria-label="Lifecycle stage assessments">
          {assessment.rows.map((row, index) => (
            <button key={row.stage} role="tab" aria-selected={active === row.stage} className={active === row.stage ? "is-active" : ""} onClick={() => setActive(row.stage)}>
              <span className="assessment-stage-heading"><em>{index + 1}</em><strong>{row.stage}</strong><small className={`stage-status status-${row.status.toLowerCase().replaceAll("_", "-")}`}>{row.status.replaceAll("_", " ")}</small></span>
              <dl><div><dt>Blockers</dt><dd>{row.blockers}</dd></div><div><dt>Prerequisites</dt><dd>{row.prerequisites}</dd></div><div><dt>Artifacts</dt><dd>{row.artifacts}</dd></div><div><dt>Runs</dt><dd>{row.supportedRuns}</dd></div></dl>
              <span className="assessment-stage-meta"><small>{row.owner.replaceAll("_", " ")}</small><em>{row.optional ? "Optional" : "Required"}</em></span>
            </button>
          ))}
        </div>
        <footer><Info size={15} /><span>Rows are independent current assessments. Stage order does not establish a verified handoff, historical run, or physical outcome.</span></footer>
      </section>
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
      <div className="lifecycle-run-heading"><div><span>Immutable run history</span><h3>{stageRuns.length} supported {active} runs</h3></div><small>Agent acknowledgement, gate result, and physical outcome remain separate.</small></div>
      <div className="lifecycle-run-grid">
        <div className="panel lifecycle-run-list">
          {stageRuns.map((run) => <button key={run.run_id} className={selectedRunId === run.run_id ? "is-selected" : ""} onClick={() => setSelectedRunId(run.run_id)}>
            <span className={`run-status run-status-${run.status.toLowerCase()}`}><StatusDot status={run.status === "GATED" ? "observed" : run.status === "FAILED" ? "failed" : "partial"} />{run.status}</span>
            <code>{run.run_id}</code>
            <small>{run.completed_at ? new Date(run.completed_at).toLocaleString() : "Completion time unavailable"}</small>
            <span>{run.gate_check_count} checks · {run.handoff_status.toLowerCase()}</span>
          </button>)}
          {!stageRuns.length && <div className="empty-state"><Clock size={27} /><strong>No supported immutable run</strong><span>{runs.limitations[0] || `No ${active} run artifact is available.`}</span></div>}
        </div>
        <div className="panel lifecycle-run-detail" aria-live="polite">
          {runMessage && !runDetail && <div className="capability-detail-message"><Info size={18} /><span>{runMessage}</span></div>}
          {runDetail ? <>
            <div className="run-detail-header"><div><span>{runDetail.run.stage} run</span><code>{runDetail.run.run_id}</code></div><strong className={`run-status run-status-${runDetail.run.status.toLowerCase()}`}>{runDetail.run.status}</strong></div>
            <div className="run-facts"><div><span>Provider</span><strong>{runDetail.run.provider || "Unknown"}</strong></div><div><span>Duration</span><strong>{runDetail.run.duration_s === null ? "Unknown" : `${runDetail.run.duration_s.toFixed(1)} s`}</strong></div><div><span>Integrity</span><strong>{runDetail.run.integrity_status}</strong></div></div>
            <div className="run-gate-section"><h4>Independent gate</h4>{runDetail.gate_checks.length ? runDetail.gate_checks.map((check) => <button key={check.check_id} disabled={!check.evidence_id} onClick={() => check.evidence_id && onOpenEvidence(check.evidence_id)} className={check.status === "PASSED" ? "is-passed" : "is-pending"}>{check.status === "PASSED" ? <CheckCircle size={18} weight="fill" /> : <Warning size={18} weight="fill" />}<span><strong>{check.label}</strong><small>{check.authority} evidence</small></span>{check.evidence_id && <ArrowRight size={14} />}</button>) : <p>No independent gate check is available.</p>}</div>
            <div className="run-handoff-section"><div><span>Handoff</span><strong className={`handoff-status handoff-${runDetail.handoff.status.toLowerCase()}`}>{runDetail.handoff.status}</strong></div><code>{runDetail.handoff.digest ? `sha256:${runDetail.handoff.digest.slice(0, 16)}…` : "No verified digest"}</code>{runDetail.handoff.evidence_id && <button className="secondary-button" onClick={() => onOpenEvidence(runDetail.handoff.evidence_id!)}>Inspect handoff evidence</button>}</div>
            <div className="run-artifact-list"><h4>Bounded artifacts</h4>{runDetail.artifacts.map((artifact) => <button key={artifact.name} disabled={!artifact.evidence_id} onClick={() => artifact.evidence_id && onOpenEvidence(artifact.evidence_id)}><FileText size={17} /><span><strong>{artifact.name}</strong><small>{artifact.kind} · {artifact.integrity_status}</small></span>{artifact.evidence_id && <ArrowRight size={14} />}</button>)}</div>
          </> : !runMessage && <div className="empty-state"><GitBranch size={27} /><strong>Select a lifecycle run</strong><span>Gate and handoff evidence will appear here.</span></div>}
        </div>
      </div>
    </section>
  );
}

function WikiView({
  wiki,
  history,
  focusLayer,
  onOpenStackLayer,
  onClearFocus,
  onOpenEvidence,
}: {
  wiki: RobotWikiSnapshot;
  history: DiscoverySnapshotCollection;
  focusLayer?: WikiLayer | null;
  onOpenStackLayer: (layer: ContextWikiLayer) => void;
  onClearFocus: () => void;
  onOpenEvidence: OpenEvidence;
}) {
  const [selectedHeading, setSelectedHeading] = useState(wiki.sections[0]?.heading || "");
  const initialDiscoveryId = history.items.find((item) => item.is_latest)?.discovery_id
    || history.items[0]?.discovery_id
    || "";
  const [selectedDiscoveryId, setSelectedDiscoveryId] = useState(initialDiscoveryId);
  useEffect(() => {
    setSelectedHeading(wiki.sections[0]?.heading || "");
  }, [wiki.discovery_id, wiki.sections]);
  useEffect(() => {
    setSelectedDiscoveryId(initialDiscoveryId);
  }, [history.observed_at, initialDiscoveryId]);
  const selectedSection = wiki.sections.find((section) => section.heading === selectedHeading) || wiki.sections[0];
  const selectedDiscovery = history.items.find((item) => item.discovery_id === selectedDiscoveryId)
    || history.items[0];
  const narrativeLabel = wiki.content_origin === "GENERATED_MATCH"
    ? "Generated text matches snapshot"
    : wiki.content_origin === "HUMAN_EDITED" ? "Human-maintained text" : "Narrative unavailable";
  return (
    <section className="content-view wiki-view">
      <PageTitle
        eyebrow="Verified discovery knowledge"
        title="Robot Wiki"
        description="A human-readable robot model with machine observations, advisory insights, and discovery changes kept in separate trust lanes."
      />
      <div className="wiki-trust-strip panel">
        <div><ShieldCheck size={23} weight="fill" /><span><strong>Manifest-verified snapshot</strong><small>{wiki.discovery_id}</small></span></div>
        <dl>
          <div><dt>Discovery</dt><dd>{wiki.discovery_status}</dd></div>
          <div><dt>Observed</dt><dd>{new Date(wiki.observed_at).toLocaleString()}</dd></div>
          <div><dt>Narrative</dt><dd className={`wiki-integrity-${wiki.content_integrity}`}>{narrativeLabel} · {wiki.content_integrity}</dd></div>
        </dl>
      </div>

      <section className="panel wiki-history-panel">
        <header>
          <div><span>Verified discovery history</span><h3>Observation snapshots</h3></div>
          <small>{history.total} verified · {history.excluded_unverified} excluded</small>
        </header>
        {selectedDiscovery ? <div className="wiki-history-layout">
          <div className="wiki-history-list" role="list" aria-label="Verified discovery snapshots">
            {history.items.map((item) => (
              <button key={item.discovery_id} role="listitem" className={item.discovery_id === selectedDiscovery.discovery_id ? "is-active" : ""} onClick={() => setSelectedDiscoveryId(item.discovery_id)}>
                <Clock size={16} /><span><strong>{new Date(item.created_at).toLocaleString()}</strong><small>{item.discovery_id}</small></span><em className={`wiki-status-${item.status.toLowerCase()}`}>{item.is_latest ? "CURRENT" : item.status}</em>
              </button>
            ))}
          </div>
          <article className="wiki-history-detail" aria-live="polite">
            <div className="wiki-history-detail-heading"><div><span>{selectedDiscovery.is_latest ? "Current committed snapshot" : "Verified historical snapshot"}</span><h4>{selectedDiscovery.status}</h4></div><strong>{Math.round(selectedDiscovery.confidence * 100)}% confidence</strong></div>
            <dl>
              <div><dt>Probe coverage</dt><dd>{selectedDiscovery.observed_probes} / {selectedDiscovery.probe_total} observed</dd></div>
              <div><dt>Partial</dt><dd>{selectedDiscovery.partial_probes}</dd></div>
              <div><dt>Unavailable</dt><dd>{selectedDiscovery.unavailable_probes}</dd></div>
              <div><dt>Operation candidates</dt><dd>{selectedDiscovery.operation_candidates}</dd></div>
              <div><dt>Semantic bindings</dt><dd>{selectedDiscovery.semantic_bindings}</dd></div>
              <div><dt>Warnings</dt><dd>{selectedDiscovery.warning_count}</dd></div>
            </dl>
            <p><ShieldCheck size={14} /> Manifest verified · {selectedDiscovery.discovery_mode.replaceAll("_", " ").toLowerCase()}</p>
          </article>
        </div> : <div className="wiki-empty-copy">No manifest-verified discovery history is available.</div>}
        <footer><Info size={15} /><span>{history.limitations.join(" ")}</span></footer>
      </section>

      {focusLayer && <div className="wiki-context-banner panel"><GitBranch size={17} /><span><strong>Stack Map context</strong><small>{focusLayer} knowledge layer · layer-level navigation only</small></span><button onClick={onClearFocus} aria-label="Clear Stack Map context"><X size={15} /></button></div>}
      <div className="wiki-layer-grid">
        {wiki.layers.map((layer) => {
          const topologyLayer = topologyLayerForWiki(layer.layer);
          return <article className={`panel wiki-layer-card ${focusLayer === layer.layer ? "is-context-focus" : ""}`} key={layer.layer}>
            <header><span>{layer.layer}</span><strong className={`wiki-status-${layer.status.toLowerCase()}`}>{layer.status}</strong></header>
            <p>{layer.summary}</p>
            <dl>{Object.entries(layer.facts).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{String(value)}</dd></div>)}</dl>
            {topologyLayer ? <button className="wiki-layer-link" onClick={() => onOpenStackLayer(layer.layer as ContextWikiLayer)}><GitBranch size={14} /> Locate related topology lane <ArrowRight size={13} /></button> : <span className="wiki-layer-link is-unavailable"><Info size={14} /> No dedicated topology lane</span>}
          </article>;
        })}
      </div>

      <div className="wiki-layout">
        <nav className="panel wiki-section-nav" aria-label="Wiki sections">
          <header><span>Human-readable Wiki</span><small>{wiki.sections.length} sections</small></header>
          {wiki.sections.map((section) => (
            <button key={section.heading} className={section.heading === selectedSection?.heading ? "is-active" : ""} onClick={() => setSelectedHeading(section.heading)}>
              <BookOpenText size={17} /><span>{section.heading}</span><ArrowRight size={13} />
            </button>
          ))}
          {!wiki.sections.length && <p>No human-readable Wiki text is available.</p>}
        </nav>
        <article className="panel wiki-document">
          <header><span>{wiki.content_origin === "HUMAN_EDITED" ? "Human-maintained · unverified" : "Generated narrative · validated"}</span><h3>{selectedSection?.heading || "Narrative unavailable"}</h3></header>
          {selectedSection ? <div>{selectedSection.lines.map((line, index) => <p key={`${selectedSection.heading}-${index}`}>{line}</p>)}</div> : <div className="empty-state"><BookOpenText size={27} /><strong>No narrative content</strong><span>Machine observations remain available in the verified panels.</span></div>}
        </article>
        <aside className="panel wiki-insights">
          <header><span>Advisory insights</span><small>{wiki.insights.length} manifest-verified records</small></header>
          {wiki.insights.map((insight) => (
            <button key={insight.evidence_id} onClick={() => onOpenEvidence(insight.evidence_id)}>
              <span className="wiki-insight-meta"><strong>{insight.category}</strong><em>{insight.confidence} confidence</em></span>
              <p>{insight.statement}</p>
              <small>Verify: {insight.verification}</small>
              <span className="wiki-evidence-link"><ShieldCheck size={14} /> Open evidence</span>
            </button>
          ))}
          {!wiki.insights.length && <p className="wiki-empty-copy">No advisory insight was produced for this discovery.</p>}
        </aside>
      </div>

      <section className="panel wiki-change-panel">
        <header><div><span>Discovery change set</span><h3>{wiki.diff_status.replaceAll("_", " ")}</h3></div><small>{wiki.baseline_discovery_id ? `Baseline ${wiki.baseline_discovery_id}` : "No previous verified baseline"}</small></header>
        <div className="wiki-change-grid">
          {wiki.changes.map((change) => (
            <button key={change.evidence_id} onClick={() => onOpenEvidence(change.evidence_id)}>
              <span><strong>{change.category}</strong><ShieldCheck size={15} /></span>
              <dl><div><dt>Added</dt><dd>{change.added.length}</dd></div><div><dt>Removed</dt><dd>{change.removed.length}</dd></div><div><dt>Changed</dt><dd>{change.changed.length}</dd></div></dl>
              {[...change.added, ...change.removed, ...change.changed].slice(0, 3).map((item) => <small key={item}>{item}</small>)}
            </button>
          ))}
          {!wiki.changes.length && <p className="wiki-empty-copy">No domain-level changes were reported.</p>}
        </div>
      </section>
      {wiki.limitations.length > 0 && <div className="wiki-limitations"><Info size={17} /><p>{wiki.limitations.join(" ")}</p></div>}
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
  const [stackContextFocus, setStackContextFocus] = useState<StackContextFocus | null>(null);
  const [wikiContextFocus, setWikiContextFocus] = useState<WikiLayer | null>(null);
  const [mode, setMode] = useState<WorkbenchMode>("connecting");
  const [robots, setRobots] = useState<RobotOption[]>([]);
  const [robot, setRobot] = useState<ViewRobot | null>(null);
  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  const [overview, setOverview] = useState<RobotOverview | null>(null);
  const [topology, setTopology] = useState<RobotTopology | null>(null);
  const [topologySnapshots, setTopologySnapshots] = useState<TopologySnapshotCollection | null>(null);
  const [evidenceList, setEvidenceList] = useState<EvidenceCollection | null>(null);
  const [capabilityList, setCapabilityList] = useState<CapabilitySummary[] | null>(null);
  const [capabilityLimitations, setCapabilityLimitations] = useState<string[]>([]);
  const [apiFeatures, setApiFeatures] = useState<string[]>([]);
  const [lifecycleRuns, setLifecycleRuns] = useState<LifecycleRunCollection | null>(null);
  const [wiki, setWiki] = useState<RobotWikiSnapshot | null>(null);
  const [discoveryHistory, setDiscoveryHistory] = useState<DiscoverySnapshotCollection | null>(null);
  const [wikiRequestRobotId, setWikiRequestRobotId] = useState("");
  const [wikiLoading, setWikiLoading] = useState(false);
  const [wikiMessage, setWikiMessage] = useState("");
  const [fleet, setFleet] = useState<FleetCollection | null>(null);
  const [fleetBlockers, setFleetBlockers] = useState<FleetBlockerCollection | null>(null);
  const [fleetRequested, setFleetRequested] = useState(false);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [fleetMessage, setFleetMessage] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [evidence, setEvidence] = useState<EvidenceItem | null>(null);

  const connect = useCallback(async (requestedRobotId?: string) => {
    setMode("connecting");
    setStackContextFocus(null);
    setWikiContextFocus(null);
    setConnectionMessage("");
    setWiki(null);
    setDiscoveryHistory(null);
    setWikiRequestRobotId("");
    setWikiLoading(false);
    setWikiMessage("");
    setFleet(null);
    setFleetBlockers(null);
    setFleetRequested(false);
    setFleetLoading(false);
    setFleetMessage("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const result = await roloClient.bootstrap({ signal: controller.signal }, requestedRobotId);
      setRobots(result.robots);
      setRobot(result.robot ? { ...result.robot, status: "online" } : null);
      setOverview(result.overview);
      setTopology(result.topology);
      setTopologySnapshots(result.topologySnapshots);
      setEvidenceList(result.evidence);
      setCapabilityList(result.capabilities);
      setCapabilityLimitations(result.capabilityLimitations);
      setApiFeatures(result.health.api_features);
      setLifecycleRuns(result.runs);
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
      setTopologySnapshots(null);
      setEvidenceList(null);
      setCapabilityList(null);
      setCapabilityLimitations([]);
      setApiFeatures([]);
      setLifecycleRuns(null);
      setWiki(null);
      setDiscoveryHistory(null);
      setConnectionMessage(error instanceof RoloApiError ? `${error.message}${error.path ? ` (${error.path})` : ""}` : "The rolo control plane could not be read.");
      setMode("unavailable");
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  const useDemo = useCallback(() => {
    setStackContextFocus(null);
    setWikiContextFocus(null);
    setRobot(DEMO_ROBOT);
    setRobots([DEMO_ROBOT]);
    setPipeline(DEMO_PIPELINE);
    setOverview(null);
    setTopology(null);
    setTopologySnapshots(null);
    setEvidenceList(null);
    setCapabilityList(null);
    setCapabilityLimitations([]);
    setApiFeatures([]);
    setLifecycleRuns(null);
    setWiki(null);
    setDiscoveryHistory(null);
    setWikiRequestRobotId("");
    setWikiLoading(false);
    setWikiMessage("");
    setFleet(null);
    setFleetBlockers(null);
    setFleetRequested(false);
    setFleetLoading(false);
    setFleetMessage("");
    setConnectionMessage("Explicit fixture mode; no values on this screen are live robot observations.");
    setMode("demo");
  }, []);

  useEffect(() => { void connect(); }, [connect]);
  useEffect(() => {
    if (active !== "wiki" || !robot || (wiki && discoveryHistory) || wikiLoading || wikiRequestRobotId === robot.robot_id || !["live", "partial"].includes(mode)) return;
    let current = true;
    const controller = new AbortController();
    const requestedRobotId = robot.robot_id;
    setWikiLoading(true);
    setWikiRequestRobotId(requestedRobotId);
    setWikiMessage("");
    void Promise.all([
      roloClient.wiki(requestedRobotId, { signal: controller.signal }),
      roloClient.discoveries(requestedRobotId, { signal: controller.signal }),
    ]).then(([snapshot, history]) => {
      if (!current) return;
      setWiki(snapshot);
      setDiscoveryHistory(history);
    }).catch((error: unknown) => {
      if (!current) return;
      if (error instanceof RoloApiError && error.status === 404) {
        setWikiMessage("No verified discovery Wiki is available for this robot yet.");
      } else {
        setWikiMessage(error instanceof Error ? error.message : "The robot Wiki could not be read.");
      }
    }).finally(() => { if (current) setWikiLoading(false); });
    return () => {
      current = false;
      controller.abort();
      setWikiLoading(false);
      setWikiRequestRobotId((value) => value === requestedRobotId ? "" : value);
    };
  }, [active, mode, robot, wiki, discoveryHistory]);
  useEffect(() => {
    if (active !== "fleet" || fleetRequested || (fleet && fleetBlockers) || !["live", "partial"].includes(mode)) return;
    let current = true;
    const controller = new AbortController();
    setFleetRequested(true);
    setFleetLoading(true);
    setFleetMessage("");
    void Promise.all([
      roloClient.fleet({ signal: controller.signal }),
      roloClient.blockers({ signal: controller.signal }),
    ]).then(([fleetSnapshot, blockerSnapshot]) => {
      if (!current) return;
      setFleet(fleetSnapshot);
      setFleetBlockers(blockerSnapshot);
    }).catch((error: unknown) => {
      if (current) setFleetMessage(error instanceof Error ? error.message : "The Fleet workspace could not be read.");
    }).finally(() => { if (current) setFleetLoading(false); });
    return () => {
      current = false;
      controller.abort();
      setFleetRequested(false);
      setFleetLoading(false);
    };
  }, [active, mode, fleet, fleetBlockers]);
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
  const selectFleetRobot = useCallback((robotId: string) => {
    setStackContextFocus(null);
    setWikiContextFocus(null);
    setActive("overview");
    void connect(robotId);
  }, [connect]);
  const navigate = useCallback((view: NavId) => {
    setStackContextFocus(null);
    setWikiContextFocus(null);
    setActive(view);
  }, []);
  const openStackLayer = useCallback((layer: ContextWikiLayer) => {
    setWikiContextFocus(null);
    setStackContextFocus((current) => ({
      layer,
      requestId: (current?.requestId || 0) + 1,
    }));
    setActive("stack");
  }, []);
  const openWikiLayer = useCallback((layer: ContextWikiLayer) => {
    setStackContextFocus(null);
    setWikiContextFocus(layer);
    setActive("wiki");
  }, []);

  const activeLabel = NAV_ITEMS.find((item) => item.id === active)?.label || "Stack Map";
  const evidenceItems = useMemo(
    () => evidenceList?.items.map(evidenceRecordToItem) || [],
    [evidenceList],
  );
  const stackSource = getSurfaceSource(mode, "stack", { stack: Boolean(topology) });
  const evidenceSource = getSurfaceSource(mode, "evidence", { evidence: Boolean(evidenceList) });
  const lifecycleSource = getSurfaceSource(mode, "lifecycle", { lifecycle: Boolean(pipeline.length && lifecycleRuns) });
  const capabilitySource = getSurfaceSource(mode, "capabilities", { capabilities: Boolean(capabilityList) });
  return (
    <div className="app-shell">
      <Sidebar active={active} onChange={navigate} />
      <Topbar robot={robot} robots={robots} activeLabel={activeLabel} mode={mode} snapshot={overview?.observed_at} onRetry={() => connect(robot?.robot_id)} onRobotChange={connect} />
      <main className="app-main">
        {(["connecting", "unavailable"].includes(mode) || !robot) ? <ConnectionStateView mode={mode} message={connectionMessage} onRetry={() => connect()} onUseDemo={useDemo} /> : <>
          {active === "stack" && (stackSource === "demo" ? <StackMapView focusLayer={stackContextFocus} onOpenWikiLayer={openWikiLayer} onOpenEvidence={openEvidence} /> : stackSource === "live" ? <StackMapView topology={topology} topologySnapshots={topologySnapshots} robotId={robot.robot_id} focusLayer={stackContextFocus} onOpenWikiLayer={openWikiLayer} onOpenEvidence={openEvidence} /> : <ReadModelUnavailableView title="Stack Map" description="Live topology needs a versioned rolo topology read model." />)}
          {active === "fleet" && (mode === "demo" ? <ReadModelUnavailableView title="Fleet" description="The labeled demo fixture represents one robot and does not include a fleet aggregate." /> : fleet && fleetBlockers ? <FleetView fleet={fleet} blockers={fleetBlockers} onSelectRobot={selectFleetRobot} onOpenEvidence={openEvidence} /> : fleetLoading ? <section className="content-view"><PageTitle title="Fleet" description="Aggregating validated robot overviews and pipeline blockers…" /><div className="panel read-model-unavailable" role="status"><Pulse size={26} /><div><strong>Loading Fleet</strong><p>No runtime telemetry is inferred while this read model is loading.</p></div></div></section> : <ReadModelUnavailableView title="Fleet" description={fleetMessage || "Open this surface to read the validated Fleet aggregate."} />)}
          {active === "overview" && <OverviewView robot={robot} pipeline={pipeline} overview={overview} mode={mode} evidenceItems={evidenceItems} onOpenEvidence={openEvidence} onNavigate={navigate} />}
          {active === "capabilities" && (capabilitySource === "demo" ? <DemoCapabilityView onOpenEvidence={setEvidence} /> : capabilitySource === "live" && capabilityList ? <LiveCapabilityView robotId={robot.robot_id} items={capabilityList} limitations={capabilityLimitations} apiFeatures={apiFeatures} onOpenEvidence={openEvidence} /> : <ReadModelUnavailableView title="Capabilities" description="Live capability coverage needs a versioned rolo capability read model." />)}
          {active === "lifecycle" && (lifecycleSource === "demo" ? <DemoLifecycleView pipeline={pipeline} onOpenEvidence={setEvidence} /> : lifecycleSource === "live" && lifecycleRuns ? <LiveLifecycleView pipeline={pipeline} runs={lifecycleRuns} robotId={robot.robot_id} onOpenEvidence={openEvidence} /> : <ReadModelUnavailableView title="Lifecycle" description="Live lifecycle requires trusted stage and run read models." />)}
          {active === "wiki" && (mode === "demo" ? <ReadModelUnavailableView title="Robot Wiki" description="The labeled demo fixture does not include discovery Wiki evidence." /> : wiki && discoveryHistory ? <WikiView wiki={wiki} history={discoveryHistory} focusLayer={wikiContextFocus} onOpenStackLayer={openStackLayer} onClearFocus={() => setWikiContextFocus(null)} onOpenEvidence={openEvidence} /> : wikiLoading ? <section className="content-view"><PageTitle title="Robot Wiki" description="Reading manifest-verified discovery snapshots…" /><div className="panel read-model-unavailable" role="status"><Pulse size={26} /><div><strong>Loading Robot Wiki</strong><p>Current knowledge and verified history are being resolved independently.</p></div></div></section> : <ReadModelUnavailableView title="Robot Wiki" description={wikiMessage || "Open this surface to read a verified discovery Wiki."} />)}
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
