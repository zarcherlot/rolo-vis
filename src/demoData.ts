import type { Edge, Node } from "@xyflow/react";

export type TopologyStatus = "observed" | "partial" | "failed" | "unobserved";
export type TopologyIcon = "sensor" | "pulse" | "target" | "camera" | "cpu" | "network" | "clock" | "storage" | "cube" | "radio" | "crosshair" | "tree" | "route" | "nodes" | "shield";

export interface DemoRobot {
  robot_id: string;
  model: string;
  adapter: string;
  environment: string;
  status: "online";
  observed_at: string;
  discovery_id: string;
}

export interface PipelineRow {
  stage: string;
  status: string;
  summary: string;
  artifacts: number;
  blockers: number;
  optional?: boolean;
  prerequisites?: string[];
  artifactRefs?: Array<{ name: string; reference: string }>;
  blockerMessages?: string[];
  agentRequirement?: string;
  observedAt?: string;
}

export interface TopologyNodeData extends Record<string, unknown> {
  label: string;
  subtitle: string;
  layer: string;
  status: TopologyStatus;
  icon: TopologyIcon;
  evidence: number;
  confidence?: number;
  kind?: string;
  evidenceIds?: string[];
  integrityStatus?: "validated" | "verified";
  attributes?: Record<string, string | number | boolean>;
}

export interface CapabilityItem {
  id: string;
  layer: string;
  title: string;
  lifecycle: string;
  availability: string;
  access: string;
  risk: string;
  classification: string;
  binding: string;
  version: string;
  evidence: number;
}

export interface EvidenceItem {
  id: string;
  title: string;
  source: string;
  kind: string;
  integrity: "verified" | "validated" | "unresolved";
  time: string;
  ref: string;
  digest?: string;
  summary?: string;
  confidence?: number;
  classification?: string;
  limitations?: string[];
}

export const DEMO_ROBOT: DemoRobot = {
  robot_id: "nav2-wsl2-hardening",
  model: "Nav2 · ROS 2 Humble",
  adapter: "discovery-only · no promoted adapter",
  environment: "WSL2 Ubuntu 22.04 · ROS 2 Humble",
  status: "online",
  observed_at: "2026-08-29T02:31:36.190654Z",
  discovery_id: "disc-20260829T023206-4a9523a1",
};

export const DEMO_PIPELINE: PipelineRow[] = [
  { stage: "adapt", status: "BLOCKED", summary: "Dry-run blocked; the unstable ROS graph leaves zero eligible operations.", artifacts: 0, blockers: 9, blockerMessages: ["ROS graph samples are unstable.", "Six candidates are semantically ambiguous and three target routes were not observed."], observedAt: "2026-08-29T02:39:03.575115Z" },
  { stage: "diagnose", status: "NOT_STARTED", summary: "Waiting for a verified Adapt handoff.", artifacts: 0, blockers: 0, prerequisites: ["Validated Adapt handoff"] },
  { stage: "verify", status: "NOT_STARTED", summary: "Acceptance is withheld until route identity, schema, and runtime revision are verified.", artifacts: 0, blockers: 0, optional: true, prerequisites: ["Validated Diagnosis handoff"] },
];

export const TOPOLOGY_NODES: Node<TopologyNodeData>[] = [
  { id: "lidar", type: "rolo", position: { x: 30, y: 64 }, data: { label: "LiDAR", subtitle: "Ouster OS1-64", layer: "Hardware", status: "observed", icon: "sensor", evidence: 6 } },
  { id: "imu", type: "rolo", position: { x: 30, y: 190 }, data: { label: "IMU", subtitle: "VectorNav VN-300", layer: "Hardware", status: "observed", icon: "pulse", evidence: 4 } },
  { id: "encoders", type: "rolo", position: { x: 30, y: 316 }, data: { label: "Wheel Encoders", subtitle: "x2", layer: "Hardware", status: "observed", icon: "target", evidence: 3 } },
  { id: "camera", type: "rolo", position: { x: 30, y: 442 }, data: { label: "Camera", subtitle: "Intel RealSense D455", layer: "Hardware", status: "unobserved", icon: "camera", evidence: 2 } },
  { id: "battery", type: "rolo", position: { x: 30, y: 568 }, data: { label: "Battery", subtitle: "48 V · 30 Ah", layer: "Hardware", status: "observed", icon: "storage", evidence: 5 } },
  { id: "jetson", type: "rolo", position: { x: 304, y: 64 }, data: { label: "Jetson Orin NX", subtitle: "Ubuntu 22.04", layer: "Linux", status: "observed", icon: "cpu", evidence: 9 } },
  { id: "network", type: "rolo", position: { x: 304, y: 190 }, data: { label: "Network", subtitle: "eth0 · 1 Gbps", layer: "Linux", status: "observed", icon: "network", evidence: 4 } },
  { id: "timesync", type: "rolo", position: { x: 304, y: 316 }, data: { label: "Time Sync", subtitle: "chrony", layer: "Linux", status: "observed", icon: "clock", evidence: 5 } },
  { id: "storage", type: "rolo", position: { x: 304, y: 442 }, data: { label: "Storage", subtitle: "NVMe 512 GB", layer: "Linux", status: "observed", icon: "storage", evidence: 3 } },
  { id: "services", type: "rolo", position: { x: 304, y: 568 }, data: { label: "System Services", subtitle: "systemd · 14 units", layer: "Linux", status: "observed", icon: "cube", evidence: 9 } },
  { id: "agentd", type: "rolo", position: { x: 578, y: 64 }, data: { label: "robot-agentd", subtitle: "Lifecycle", layer: "ROS / Middleware", status: "observed", icon: "cube", evidence: 11 } },
  { id: "scan", type: "rolo", position: { x: 578, y: 190 }, data: { label: "/scan", subtitle: "sensor_msgs/LaserScan", layer: "ROS / Middleware", status: "observed", icon: "radio", evidence: 8 } },
  { id: "localization", type: "rolo", position: { x: 578, y: 316 }, data: { label: "Localization", subtitle: "robot_localization", layer: "ROS / Middleware", status: "partial", icon: "crosshair", evidence: 12, confidence: 78 } },
  { id: "tftree", type: "rolo", position: { x: 578, y: 442 }, data: { label: "TF Tree", subtitle: "tf2", layer: "ROS / Middleware", status: "observed", icon: "tree", evidence: 7 } },
  { id: "mapserver", type: "rolo", position: { x: 578, y: 568 }, data: { label: "Map Server", subtitle: "nav2_map_server", layer: "ROS / Middleware", status: "observed", icon: "cube", evidence: 6 } },
  { id: "navigation", type: "rolo", position: { x: 852, y: 64 }, data: { label: "Navigation", subtitle: "nav2_bringup", layer: "Application", status: "partial", icon: "route", evidence: 8 } },
  { id: "controller", type: "rolo", position: { x: 852, y: 190 }, data: { label: "nav2_controller", subtitle: "DWB", layer: "Application", status: "failed", icon: "crosshair", evidence: 7 } },
  { id: "behavior", type: "rolo", position: { x: 852, y: 316 }, data: { label: "Behavior Server", subtitle: "nav2_behavior_tree", layer: "Application", status: "unobserved", icon: "nodes", evidence: 2 } },
  { id: "mission", type: "rolo", position: { x: 852, y: 442 }, data: { label: "Mission Executor", subtitle: "robot_mission", layer: "Application", status: "unobserved", icon: "nodes", evidence: 3 } },
  { id: "safety", type: "rolo", position: { x: 852, y: 568 }, data: { label: "Safety Monitor", subtitle: "safety_monitor", layer: "Application", status: "observed", icon: "shield", evidence: 10 } },
];

export const TOPOLOGY_EDGES: Edge[] = [
  ["lidar", "jetson", "observed"], ["imu", "jetson", "observed"], ["encoders", "network", "observed"], ["camera", "storage", "declared"], ["battery", "services", "observed"],
  ["jetson", "agentd", "observed"], ["network", "scan", "observed"], ["timesync", "localization", "observed"], ["storage", "tftree", "declared"], ["services", "mapserver", "observed"],
  ["agentd", "navigation", "declared"], ["scan", "localization", "observed"], ["tftree", "localization", "observed"],
  ["localization", "controller", "observed"], ["navigation", "controller", "observed"], ["localization", "behavior", "declared"], ["mapserver", "mission", "declared"], ["tftree", "safety", "declared"],
].map(([source, target, state], index) => ({
  id: `edge-${index}`,
  source,
  target,
  type: "smoothstep",
  animated: source === "localization" || target === "localization",
  className: `edge-${state}`,
}));

export const CAPABILITIES: CapabilityItem[] = [
  { id: "app.navigation.goal.send", layer: "Application", title: "Send navigation goal", lifecycle: "RELEASED", availability: "GATED", access: "write", risk: "R2", classification: "INTERNAL", binding: "ROS 2 action · /navigate_to_pose", version: "1.1.0", evidence: 7 },
  { id: "app.navigation.goal.cancel", layer: "Application", title: "Cancel active navigation goal", lifecycle: "RELEASED", availability: "GATED", access: "write", risk: "R2", classification: "INTERNAL", binding: "ROS 2 action · /navigate_to_pose/_action/cancel", version: "1.1.0", evidence: 8 },
  { id: "ros.topic.list", layer: "Middleware", title: "List observed ROS topics", lifecycle: "RELEASED", availability: "GATED", access: "read", risk: "R0", classification: "INTERNAL", binding: "builtin · ros2 topic list", version: "1.1.0", evidence: 10 },
  { id: "ros.tf.tree", layer: "Middleware", title: "Read the bounded TF frame tree", lifecycle: "GATEABLE", availability: "OBSERVED", access: "read", risk: "R0", classification: "SENSITIVE", binding: "ROS 2 · /tf, /tf_static", version: "1.1.0", evidence: 6 },
  { id: "linux.service.status", layer: "Linux", title: "Read service status", lifecycle: "RELEASED", availability: "GATED", access: "read", risk: "R0", classification: "INTERNAL", binding: "systemd · robot-agentd", version: "1.1.0", evidence: 9 },
  { id: "linux.service.restart", layer: "Linux", title: "Restart an allowlisted service", lifecycle: "GATEABLE", availability: "BLOCKED", access: "write", risk: "R2", classification: "SENSITIVE", binding: "Policy approval required", version: "1.1.0", evidence: 3 },
  { id: "hw.sensor.read", layer: "Hardware", title: "Read bounded sensor metadata", lifecycle: "DRAFT", availability: "DISCOVERED", access: "read", risk: "R1", classification: "SENSITIVE", binding: "semantic://sensor/lidar", version: "0.7.0", evidence: 4 },
];

export const EVIDENCE: EvidenceItem[] = [
  { id: "EV-NAV2-GATE", title: "Adapt dry-run blocked all candidates", source: "adapt dry-run", kind: "Gate result", integrity: "verified", time: "10:39:03", ref: "artifact://discovery/nav2-wsl2-hardening/runs/disc-20260829T023206-4a9523a1/target-operation-slice.json", summary: "Six candidates are semantically ambiguous and three target routes were not observed.", limitations: ["A blocked dry-run does not establish a physical navigation outcome."] },
  { id: "EV-NAV2-ROS", title: "ROS graph samples disagree", source: "discovery runtime probe", kind: "Observed fact", integrity: "verified", time: "10:31:36", ref: "artifact://target-evidence/nav2-wsl2-hardening/target-evidence-current.json", summary: "ROS 2 Humble exposed 17 nodes, 30 topics, and 12 actions; bounded samples are marked stable=false.", limitations: ["The graph included a parallel verification fixture and must not be used as a stable baseline."] },
  { id: "EV-NAV2-ACCEPTANCE", title: "Acceptance pack remains incomplete", source: "acceptance pack", kind: "Limitation", integrity: "validated", time: "10:39:03", ref: "artifact://nav2/rolo-adapt-acceptance.json", summary: "No verified canonical CLI and State Graph handoff is available for promotion." },
  { id: "EV-NAV2-READONLY", title: "No operation was invoked", source: "target validation summary", kind: "Read-only boundary", integrity: "verified", time: "10:39:03", ref: "artifact://target-evidence/nav2-wsl2-hardening/target-evidence-current.json", summary: "The validation performed only bounded read-only evidence collection and did not send motion or executor commands." },
  { id: "EV-NAV2-SEMANTICS", title: "Route semantics remain unresolved", source: "heuristic analysis", kind: "Advisory", integrity: "unresolved", time: "10:39:03", ref: "artifact://discovery/nav2-wsl2-hardening/runs/disc-20260829T023206-4a9523a1/heuristic/summary.json", summary: "Candidate operation mappings remain advisory until provider, schema, revision, and ownership evidence are published." },
];
