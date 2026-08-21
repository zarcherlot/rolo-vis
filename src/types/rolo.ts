export type ConnectionMode = "live" | "partial";

export interface HealthResponse {
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  service: string;
  version: string;
  robots: number;
  robot_use_backend: string;
  openai_key_configured: boolean;
  api_features: string[];
  timestamp: string;
}

export type AdaptSemanticLayer = "product_control" | "hardware" | "os" | "middleware" | "application";
export type AdaptExecutionClass = "AGENT_NATIVE" | "PRODUCT_BUILTIN" | "TARGET_ADAPTER" | "PLATFORM_SPECIFIC";
export type AdaptMigrationStatus = "PLANNED" | "RETAINED" | "DEFERRED";

export interface OperationDisposition {
  current_operation: string;
  current_layer: "control" | "hw" | "linux" | "middleware" | "ros" | "app";
  semantic_layer: AdaptSemanticLayer;
  execution_class: AdaptExecutionClass;
  portable_semantics: boolean;
  future_capability: string | null;
  migration_status: AdaptMigrationStatus;
  migration_reason: string;
  current_registry_action: "KEEP";
}

export interface OperationGovernanceCollection {
  schema_version: "rolo-operation-governance-collection/v1";
  items: OperationDisposition[];
  total: number;
  limit: number;
  offset: number;
  next_offset: number | null;
  source_kind: "operation_disposition_ledger";
  influences_registry: false;
  limitations: string[];
}

export interface TargetOperationSlice {
  schema_version: "robot-target-operation-slice/v1";
  robot_id: string;
  discovery_id: string;
  registry_sha256: string;
  slice_sha256: string;
  primary_operations: string[];
  dependency_operations: string[];
  agent_native_operations: string[];
  builtin_operations: string[];
  target_adapter_operations: string[];
  platform_specific_operations: string[];
  deferred_summary: Record<string, number>;
}

export type SliceActivationOutcome = "SHADOW_ONLY" | "NOT_SELECTED" | "ACTIVATED" | "FALLBACK";
export type SliceStabilityRecommendation = "INSUFFICIENT_DATA" | "HOLD" | "READY_FOR_REVIEW";

export interface SliceRunObservation {
  run_id: string;
  decision_ref: string;
  mode: "SHADOW" | "CANARY";
  outcome: SliceActivationOutcome;
  selected: boolean;
  affects_agent_context: boolean;
  agent_run_status: string | null;
  gate_status: string | null;
  authoritative_operation_count: number;
  requested_operation_count: number;
  effective_operation_count: number;
  potential_context_reduction_ratio: number;
  effective_context_reduction_ratio: number;
  prompt_token_estimate: number | null;
  boot_context_token_estimate: number | null;
  boot_context_budget_tokens: number | null;
  context_budget_exceeded: boolean;
  alert_codes: string[];
  fallback_reason: string | null;
}

export interface SliceStabilityReport {
  schema_version: "robot-target-operation-slice-stability/v1";
  robot_id: string;
  max_runs: number;
  min_successful_canary_runs: number;
  observation_count: number;
  selected_canary_count: number;
  activated_count: number;
  fallback_count: number;
  successful_canary_count: number;
  agent_failed_count: number;
  gate_failed_count: number;
  context_budget_exceeded_count: number;
  average_potential_context_reduction_ratio: number;
  average_effective_context_reduction_ratio: number;
  outcome_counts: Record<string, number>;
  alert_counts: Record<string, number>;
  recommendation: SliceStabilityRecommendation;
  recommendation_reasons: string[];
  observations: SliceRunObservation[];
  influences_release: false;
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
  freshness: "fresh" | "unknown";
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
  source_kind: "robot_manifest" | "gated_artifact" | "pipeline_artifact" | "lifecycle_run" | "lifecycle_gate" | "lifecycle_handoff" | "wiki_insight" | "wiki_diff";
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

export interface TopologySnapshotSummary {
  schema_version: "rolo-topology-snapshot-summary/v1";
  snapshot_id: string;
  release_id: string;
  published_at: string;
  node_count: number;
  edge_count: number;
  coverage: "GATED_RELEASE";
  integrity_status: "verified";
  is_current: boolean;
}

export interface TopologySnapshotCollection {
  schema_version: "rolo-topology-snapshot-collection/v1";
  robot_id: string;
  items: TopologySnapshotSummary[];
  total: number;
  observed_at: string;
  freshness: "unknown";
  limitations: string[];
}

export type TopologyChangeKind = "ADDED" | "REMOVED" | "CHANGED";

export interface TopologyNodeChange {
  schema_version: "rolo-topology-node-change/v1";
  node_id: string;
  change: TopologyChangeKind;
  changed_fields: string[];
  before: TopologyNode | null;
  after: TopologyNode | null;
}

export interface TopologyEdgeChange {
  schema_version: "rolo-topology-edge-change/v1";
  edge_id: string;
  change: TopologyChangeKind;
  changed_fields: string[];
  before: TopologyEdge | null;
  after: TopologyEdge | null;
}

export interface TopologyDiff {
  schema_version: "rolo-topology-diff/v1";
  robot_id: string;
  from_snapshot: TopologySnapshotSummary;
  to_snapshot: TopologySnapshotSummary;
  added_nodes: number;
  removed_nodes: number;
  changed_nodes: number;
  added_edges: number;
  removed_edges: number;
  changed_edges: number;
  node_changes: TopologyNodeChange[];
  edge_changes: TopologyEdgeChange[];
  observed_at: string;
  freshness: "unknown";
  integrity_status: "verified";
  limitations: string[];
}

export interface TopologyPathStep {
  schema_version: "rolo-topology-path-step/v1";
  index: number;
  from_node_id: string;
  to_node_id: string;
  edge_id: string;
  relation: string;
  direction: "FORWARD" | "REVERSE";
  state: TopologyState;
  confidence: number;
  integrity_status: "validated" | "verified";
  evidence_ids: string[];
}

export interface TopologyPathExplanation {
  schema_version: "rolo-topology-path-explanation/v1";
  robot_id: string;
  snapshot_id: string;
  from_node_id: string;
  to_node_id: string;
  found: boolean;
  hop_count: number;
  nodes: TopologyNode[];
  steps: TopologyPathStep[];
  summary: string;
  observed_at: string;
  freshness: "fresh" | "unknown";
  source_kind: "topology_path_projection";
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

export type WikiLayer = "Hardware" | "Linux" | "Middleware" | "Application" | "Dependencies";

export interface WikiLayerSummary {
  schema_version: "rolo-wiki-layer-summary/v1";
  layer: WikiLayer;
  status: "OBSERVED" | "PARTIAL" | "UNAVAILABLE" | "UNKNOWN";
  summary: string;
  facts: Record<string, string | number | boolean>;
}

export interface WikiSection {
  schema_version: "rolo-wiki-section/v1";
  heading: string;
  lines: string[];
}

export interface WikiInsightSummary {
  schema_version: "rolo-wiki-insight-summary/v1";
  category: "SAFETY" | "ARCHITECTURE" | "HARDWARE" | "OPERATIONS" | "MAINTENANCE";
  statement: string;
  confidence: "LOW" | "MEDIUM";
  verification: string;
  source: "DETERMINISTIC_RULE" | "ADAPT_AGENT_SKILL";
  evidence_id: string;
}

export interface WikiChangeSummary {
  schema_version: "rolo-wiki-change-summary/v1";
  category: "PLATFORM" | "ROS" | "APPLICATION" | "HARDWARE" | "OPERATION" | "UNKNOWN";
  added: string[];
  removed: string[];
  changed: string[];
  evidence_id: string;
}

export interface RobotWikiSnapshot {
  schema_version: "rolo-robot-wiki/v1";
  robot_id: string;
  discovery_id: string;
  discovery_status: string;
  created_at: string;
  content_origin: "GENERATED_MATCH" | "HUMAN_EDITED" | "MISSING";
  content_integrity: "validated" | "unverified" | "unavailable";
  sections: WikiSection[];
  layers: WikiLayerSummary[];
  insights: WikiInsightSummary[];
  diff_status: "NO_BASELINE" | "UNCHANGED" | "CHANGED";
  baseline_discovery_id: string | null;
  changes: WikiChangeSummary[];
  observed_at: string;
  freshness: "unknown";
  source_kind: "verified_discovery_snapshot";
  confidence: number;
  integrity_status: "verified";
  limitations: string[];
}

export interface DiscoverySnapshotSummary {
  schema_version: "rolo-discovery-snapshot-summary/v1";
  robot_id: string;
  discovery_id: string;
  status: "SUCCEEDED" | "PARTIAL" | "UNAVAILABLE" | "FAILED";
  discovery_mode: string;
  created_at: string;
  is_latest: boolean;
  probe_total: number;
  observed_probes: number;
  partial_probes: number;
  unavailable_probes: number;
  operation_candidates: number;
  semantic_bindings: number;
  warning_count: number;
  confidence: number;
  integrity_status: "verified";
  limitations: string[];
}

export interface DiscoverySnapshotCollection {
  schema_version: "rolo-discovery-snapshot-collection/v1";
  robot_id: string;
  items: DiscoverySnapshotSummary[];
  total: number;
  limit: number;
  offset: number;
  next_offset: number | null;
  excluded_unverified: number;
  observed_at: string;
  freshness: "unknown";
  source_kind: "verified_discovery_history";
  integrity_status: "verified";
  limitations: string[];
}

export interface FleetRobotSummary {
  schema_version: "rolo-fleet-robot-summary/v1";
  robot_id: string;
  adapter: string;
  architecture: string;
  ros_distro: string;
  state: "READY" | "ATTENTION" | "DEGRADED" | "NOT_READY";
  active_stage: "adapt" | "diagnose" | "verify" | null;
  active_status: StageStatus | null;
  blocker_count: number;
  next_action: string;
  observed_at: string;
  freshness: "fresh";
  source_kind: "computed_robot_overview";
  confidence: number;
  integrity_status: "validated";
}

export interface FleetCollection {
  schema_version: "rolo-fleet-collection/v1";
  items: FleetRobotSummary[];
  total: number;
  limit: number;
  offset: number;
  next_offset: number | null;
  ready: number;
  attention: number;
  degraded: number;
  not_ready: number;
  blocker_count: number;
  observed_at: string;
  freshness: "fresh";
  source_kind: "computed_fleet_overviews";
  confidence: number;
  integrity_status: "validated";
}

export interface FleetBlockerSummary {
  schema_version: "rolo-fleet-blocker-summary/v1";
  blocker_id: string;
  robot_id: string;
  stage: "adapt" | "diagnose" | "verify";
  message: string;
  recommended_action: string;
  owner: string;
  evidence_ids: string[];
  observed_at: string;
  freshness: "fresh";
  source_kind: "pipeline_assessment";
  confidence: number;
  integrity_status: "validated";
}

export interface FleetBlockerCollection {
  schema_version: "rolo-fleet-blocker-collection/v1";
  items: FleetBlockerSummary[];
  total: number;
  limit: number;
  offset: number;
  next_offset: number | null;
  observed_at: string;
  freshness: "fresh";
  source_kind: "computed_pipeline_blockers";
  confidence: number;
  integrity_status: "validated";
}

export interface BootstrapResult {
  mode: ConnectionMode;
  health: HealthResponse;
  robots: RobotCapability[];
  robot: RobotCapability | null;
  overview: RobotOverview | null;
  pipeline: PipelineAssessment | null;
  topology: RobotTopology | null;
  topologySnapshots: TopologySnapshotCollection | null;
  evidence: EvidenceCollection | null;
  capabilities: CapabilitySummary[] | null;
  capabilityLimitations: string[];
  runs: LifecycleRunCollection | null;
  issues: string[];
}
