export type ConnectionMode = "live" | "partial";

export interface HealthResponse {
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  service: string;
  version: string;
  robots: number;
  robot_use_backend: string;
  openai_key_configured: boolean;
  timestamp: string;
}

export interface RobotCapability {
  schema_version: string;
  robot_id: string;
  adapter: string;
  platform: Record<string, unknown>;
  geometry: Record<string, unknown>;
  sensors: Record<string, unknown>;
  features: Record<string, unknown>;
}

export type StageStatus = "NOT_STARTED" | "BLOCKED" | "DEGRADED" | "READY" | "COMPLETE";

export interface StageAssessment {
  schema_version: "robot-stage-assessment/v1";
  stage: "adapt" | "diagnose" | "verify";
  robot_id: string;
  status: StageStatus;
  summary: string;
  optional: boolean;
  prerequisites: string[];
  artifacts: Record<string, string>;
  blockers: string[];
  agent_requirement: string;
  observed_at: string;
}

export interface PipelineAssessment {
  schema_version: "robot-three-stage-pipeline/v1";
  robot_id: string;
  stages: StageAssessment[];
  observed_at: string;
}

export interface OverviewBlocker {
  schema_version: "rolo-blocker-summary/v1" | "rolo-blocker-summary/v2";
  blocker_id: string;
  stage: string;
  message: string;
  recommended_action: string;
  owner: string;
  observed_at: string;
  freshness: "fresh" | "unknown";
  source_kind: "pipeline_assessment";
  confidence: number;
  integrity_status: "validated";
  evidence_ids: string[];
}

export interface RobotOverview {
  schema_version: "rolo-robot-overview/v1" | "rolo-robot-overview/v2";
  robot_id: string;
  state: "READY" | "ATTENTION" | "DEGRADED" | "NOT_READY";
  summary: string;
  next_action: string;
  blockers: OverviewBlocker[];
  pipeline: PipelineAssessment;
  observed_at: string;
  freshness: "fresh";
  source_kind: "computed_read_model";
  confidence: number;
  integrity_status: "validated";
}

export type TopologyLayer = "Hardware" | "Linux" | "Middleware" | "Application";
export type TopologyState = "DECLARED" | "OBSERVED" | "GATED" | "PARTIAL" | "FAILED";

export interface TopologyNode {
  schema_version: "rolo-topology-node/v1";
  node_id: string;
  kind: string;
  label: string;
  subtitle: string;
  layer: TopologyLayer;
  state: TopologyState;
  confidence: number;
  integrity_status: "validated" | "verified";
  evidence_ids: string[];
  attributes: Record<string, string | number | boolean>;
}

export interface TopologyEdge {
  schema_version: "rolo-topology-edge/v1";
  edge_id: string;
  source: string;
  target: string;
  relation: string;
  state: TopologyState;
  confidence: number;
  integrity_status: "validated" | "verified";
  evidence_ids: string[];
}

export interface RobotTopology {
  schema_version: "rolo-robot-topology/v1";
  robot_id: string;
  snapshot_id: string;
  coverage: "REGISTRY_ONLY" | "GATED_RELEASE";
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  observed_at: string;
  freshness: "fresh";
  source_kind: "robot_registry" | "gated_state_graph";
  confidence: number;
  integrity_status: "validated" | "verified";
  limitations: string[];
}

export type EvidenceAuthority = "DECLARED" | "OBSERVED" | "GATED";

export interface EvidenceRecord {
  schema_version: "rolo-evidence-record/v1";
  evidence_id: string;
  robot_id: string;
  title: string;
  summary: string;
  authority: EvidenceAuthority;
  source_kind: "robot_manifest" | "gated_artifact" | "pipeline_artifact";
  integrity_status: "validated" | "verified";
  classification: "INTERNAL";
  observed_at: string;
  freshness: "fresh" | "unknown";
  confidence: number;
  reference_hint: string;
  reference_digest: string;
  related_node_ids: string[];
  limitations: string[];
}

export interface EvidenceCollection {
  schema_version: "rolo-evidence-collection/v1";
  robot_id: string;
  items: EvidenceRecord[];
  total: number;
  limit: number;
  offset: number;
  next_offset: number | null;
  observed_at: string;
  freshness: "fresh" | "unknown";
}

export interface BootstrapResult {
  mode: ConnectionMode;
  health: HealthResponse;
  robots: RobotCapability[];
  robot: RobotCapability | null;
  overview: RobotOverview | null;
  pipeline: PipelineAssessment | null;
  topology: RobotTopology | null;
  evidence: EvidenceCollection | null;
  issues: string[];
}
