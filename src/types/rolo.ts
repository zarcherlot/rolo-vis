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
  source_kind: "robot_manifest" | "gated_artifact" | "pipeline_artifact" | "lifecycle_run" | "lifecycle_gate" | "lifecycle_handoff";
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

export type CapabilityLayer = "Hardware" | "Linux" | "Middleware" | "Application";
export type CapabilityApplicability = "APPLICABLE" | "NOT_OBSERVED" | "UNKNOWN";
export type CapabilityAvailability = "VERIFIED" | "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
export type CapabilityRegistration = "BUILTIN" | "REGISTERED" | "NOT_REGISTERED" | "STALE";

export interface CapabilitySummary {
  schema_version: "rolo-capability-summary/v1";
  operation: string;
  layer: CapabilityLayer;
  description: string;
  lifecycle: "DRAFT" | "GATEABLE" | "RELEASED" | "DEPRECATED";
  applicability: CapabilityApplicability;
  availability: CapabilityAvailability;
  registration: CapabilityRegistration;
  access: "read" | "write";
  risk: "R0" | "R1" | "R2" | "R3";
  data_classification: "PUBLIC" | "INTERNAL" | "SENSITIVE" | "SECRET";
  contract_version: string;
  contract_digest: string;
  paired_operation: string | null;
  replacement_operation: string | null;
  compensation_operation: string | null;
  binding_count: number;
  last_verified_at: string | null;
  evidence_ids: string[];
  confidence: number;
  integrity_status: "validated" | "verified";
  limitations: string[];
}

export interface CapabilityCollection {
  schema_version: "rolo-capability-collection/v1";
  robot_id: string;
  items: CapabilitySummary[];
  total: number;
  limit: number;
  offset: number;
  next_offset: number | null;
  observed_at: string;
  freshness: "fresh" | "unknown";
  source_kind: "product_registry" | "discovery" | "gated_release";
  limitations: string[];
}

export interface CapabilityBinding {
  schema_version: "rolo-capability-binding/v1";
  binding_id: string;
  source: "gated_release" | "discovery_candidate";
  authority: "GATED" | "OBSERVED" | "DECLARED";
  kind: string;
  endpoint: string;
  interface_type: string | null;
  adapter: string | null;
  observed_at: string | null;
  evidence_ids: string[];
  reference_digest: string;
  limitations: string[];
}

export interface CapabilityContract {
  schema_version: "rolo-capability-contract/v1";
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  capability_requirements: string[];
  preconditions: string[];
  postconditions: string[];
  semantic_units: Record<string, string>;
  coordinate_frames: string[];
  time_semantics: string;
  result_semantics: string;
  execution_mode: string;
  idempotent: boolean;
  cancelable: boolean;
  max_duration_s: number;
  side_effects: string[];
  resource_locks: string[];
  requires_quiescence: boolean;
}

export interface CapabilityDetail {
  schema_version: "rolo-capability-detail/v1";
  robot_id: string;
  capability: CapabilitySummary;
  contract: CapabilityContract;
  bindings: CapabilityBinding[];
  observed_at: string;
  freshness: "fresh" | "unknown";
}

export type LifecycleRunStatus = "RUNNING" | "SUCCEEDED" | "FAILED" | "GATED" | "UNKNOWN";
export type LifecycleGateStatus = "PASSED" | "FAILED" | "NOT_AVAILABLE";
export type LifecycleHandoffStatus = "VERIFIED" | "INVALID" | "MISSING";

export interface LifecycleRunSummary {
  schema_version: "rolo-lifecycle-run-summary/v1";
  robot_id: string;
  run_id: string;
  stage: "adapt" | "diagnose" | "verify";
  status: LifecycleRunStatus;
  gate_status: LifecycleGateStatus;
  handoff_status: LifecycleHandoffStatus;
  provider: string | null;
  model: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_s: number | null;
  gate_check_count: number;
  evidence_ids: string[];
  confidence: number;
  integrity_status: "validated" | "verified" | "unresolved";
  limitations: string[];
}

export interface LifecycleRunCollection {
  schema_version: "rolo-lifecycle-run-collection/v1";
  robot_id: string;
  items: LifecycleRunSummary[];
  total: number;
  limit: number;
  offset: number;
  next_offset: number | null;
  observed_at: string;
  freshness: "fresh" | "unknown";
  source_kind: "lifecycle_artifacts";
  limitations: string[];
}

export interface LifecycleGateCheck {
  schema_version: "rolo-lifecycle-gate-check/v1";
  check_id: string;
  label: string;
  status: "PASSED" | "FAILED" | "UNKNOWN";
  authority: "OBSERVED" | "GATED";
  evidence_id: string | null;
}

export interface LifecycleHandoffSummary {
  schema_version: "rolo-lifecycle-handoff-summary/v1";
  status: LifecycleHandoffStatus;
  authority: "GATED" | "OBSERVED" | "NONE";
  promoted_at: string | null;
  artifact_count: number;
  digest: string | null;
  evidence_id: string | null;
  limitations: string[];
}

export interface LifecycleArtifactSummary {
  schema_version: "rolo-lifecycle-artifact-summary/v1";
  name: string;
  kind: "agent_run" | "gate" | "handoff" | "summary";
  integrity_status: "validated" | "verified" | "unresolved";
  evidence_id: string | null;
  reference_digest: string;
}

export interface LifecycleRunDetail {
  schema_version: "rolo-lifecycle-run-detail/v1";
  run: LifecycleRunSummary;
  gate_checks: LifecycleGateCheck[];
  handoff: LifecycleHandoffSummary;
  artifacts: LifecycleArtifactSummary[];
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
  capabilities: CapabilitySummary[] | null;
  capabilityLimitations: string[];
  runs: LifecycleRunCollection | null;
  issues: string[];
}
