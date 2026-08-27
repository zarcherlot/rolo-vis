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

export type JobStatus = "CREATED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "BLOCKED";

export interface JobEvent {
  schema_version: "rolo-job-event/v1";
  event_id: string;
  job_id: string;
  sequence: number;
  event_type: string;
  status: JobStatus;
  occurred_at: string;
  payload: Record<string, unknown>;
}

export interface JobCheckpoint {
  schema_version: "rolo-job-checkpoint/v1";
  checkpoint_id: string;
  job_id: string;
  sequence: number;
  state: Record<string, unknown>;
  created_at: string;
}

export interface Job {
  schema_version: "rolo-job/v1";
  job_id: string;
  operation: string;
  target: string;
  status: JobStatus;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface JobSummary {
  schema_version: "rolo-job-summary/v1";
  job_id: string;
  operation: string;
  target: string;
  status: JobStatus;
  revision: number;
  updated_at: string;
}

export interface JobRecovery {
  schema_version: "rolo-job-recovery/v1";
  job: Job;
  latest_event: JobEvent | null;
  latest_checkpoint: JobCheckpoint | null;
  resumable: boolean;
  limitations: string[];
}

export interface JobPage {
  schema_version: "rolo-job-page/v1";
  items: JobSummary[];
  total: number;
  limit: number;
  offset: number;
  next_offset: number | null;
}

export interface JobEventPage {
  schema_version: "rolo-job-event-page/v1";
  job_id: string;
  items: JobEvent[];
  total: number;
  limit: number;
  offset: number;
  next_offset: number | null;
}

export type TargetConnectionState = "READY" | "HOST_KEY_REQUIRED" | "UNREACHABLE" | "WORKSPACE_MISSING" | "UNSUPPORTED";
export type TargetCompanionStatus = "NOT_REQUIRED" | "AVAILABLE" | "MISSING" | "UNKNOWN";

/** Sanitized target readiness summary; raw SSH/workspace references stay producer-side. */
export interface TargetReadinessSummary {
  schema_version: "rolo-target-readiness-summary/v1";
  target_id: string;
  target_kind: "local" | "ssh";
  state: TargetConnectionState;
  reachable: boolean;
  host_key_pinned: boolean | null;
  platform: string | null;
  architecture: string | null;
  workspace_accessible: boolean;
  companion: TargetCompanionStatus;
  blockers: string[];
  diagnostics: string[];
  limitations: string[];
  contains_secret_payloads: false;
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

export interface SliceObservationWindow {
  label: "RECENT" | "PREVIOUS";
  requested_observations: number;
  observation_count: number;
  newest_run_id: string | null;
  oldest_run_id: string | null;
  successful_canary_count: number;
  fallback_count: number;
  agent_failed_count: number;
  gate_failed_count: number;
  context_budget_exceeded_count: number;
  average_effective_context_reduction_ratio: number;
}

export interface SliceStabilityComparison {
  schema_version: "rolo-adapt-slice-stability-comparison/v1";
  robot_id: string;
  status: "NO_PREVIOUS_WINDOW" | "PARTIAL" | "COMPARABLE";
  recent: SliceObservationWindow;
  previous: SliceObservationWindow;
  delta: {
    successful_canary_count: number;
    fallback_count: number;
    agent_failed_count: number;
    gate_failed_count: number;
    context_budget_exceeded_count: number;
    average_effective_context_reduction_ratio: number;
  };
  regression_signals: string[];
  source_kind: "immutable_adapt_run_artifacts";
  influences_release: false;
  limitations: string[];
}

export interface FleetSliceRobotSummary {
  robot_id: string;
  recommendation: SliceStabilityRecommendation;
  observation_count: number;
  successful_canary_count: number;
  fallback_count: number;
  diagnostic_count: number;
}

export interface FleetSliceStability {
  schema_version: "rolo-adapt-fleet-slice-stability/v1";
  max_runs_per_robot: number;
  min_successful_canary_runs: number;
  robot_count: number;
  observed_robot_count: number;
  recommendation_counts: Record<string, number>;
  items: FleetSliceRobotSummary[];
  source_kind: "immutable_adapt_run_artifacts";
  influences_release: false;
  limitations: string[];
}

export interface SliceReviewCheck {
  check_id: string;
  label: string;
  status: "PASS" | "PENDING" | "BLOCKING" | "HUMAN_REQUIRED";
  summary: string;
}

export interface SliceReviewPacket {
  schema_version: "rolo-adapt-slice-review-packet/v1";
  robot_id: string;
  status: "BLOCKED" | "INCOMPLETE" | "READY_FOR_HUMAN_REVIEW";
  baseline_status: "MATCHED" | "DRIFTED";
  stability_recommendation: SliceStabilityRecommendation;
  checks: SliceReviewCheck[];
  evidence_run_ids: string[];
  evidence_refs: string[];
  contains_secret_payloads: false;
  influences_release: false;
  limitations: string[];
}

export interface AdaptBaselineSnapshot {
  schema_version: "robot-adapt-baseline-snapshot/v1";
  operation_count: number;
  disposition_count: number;
  contract_catalog_sha256: string;
  registry_sha256: string;
  operation_identity_sha256: string;
}

export interface AdaptBaselineStatus {
  schema_version: "rolo-adapt-baseline-status/v1";
  status: "MATCHED" | "DRIFTED";
  pinned: AdaptBaselineSnapshot;
  current: AdaptBaselineSnapshot;
  changed_fields: string[];
  source_kind: "protected_product_baseline";
  influences_release: false;
  limitations: string[];
}

export interface SliceActivationAlert {
  code: string;
  severity: "WARNING" | "BLOCKING";
  message: string;
  operations: string[];
}

export interface SliceActivationDecision {
  schema_version: "robot-target-operation-slice-activation/v1";
  robot_id: string;
  run_id: string | null;
  slice_sha256: string;
  mode: "SHADOW" | "CANARY";
  selected: boolean;
  selected_by: string[];
  outcome: SliceActivationOutcome;
  authoritative_eligible_operations: string[];
  requested_context_operations: string[];
  effective_context_operations: string[];
  release_authority_operations: string[];
  max_context_operations: number;
  alerts: SliceActivationAlert[];
  fallback_reason: string | null;
  affects_agent_context: boolean;
  influences_release: false;
}

export interface TargetOperationSliceShadowReport {
  schema_version: "robot-target-operation-slice-shadow/v1";
  robot_id: string;
  discovery_id: string;
  slice_sha256: string;
  authoritative_eligible_operations: string[];
  shadow_target_adapter_operations: string[];
  eligible_not_in_shadow: string[];
  shadow_not_in_eligible: string[];
  influences_release: false;
}

export interface SliceRunDetail {
  schema_version: "rolo-adapt-slice-run-detail/v1";
  robot_id: string;
  run_id: string;
  observation: SliceRunObservation;
  activation: SliceActivationDecision;
  shadow: TargetOperationSliceShadowReport | null;
  source_kind: "immutable_adapt_run_artifacts";
  integrity_status: "validated";
  influences_release: false;
  limitations: string[];
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
  source_kind: "robot_manifest" | "gated_artifact" | "pipeline_artifact" | "lifecycle_run" | "lifecycle_gate" | "lifecycle_handoff" | "wiki_insight" | "wiki_diff" | "episode_record" | "episode_event" | "episode_asset" | "episode_finding";
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

interface CapabilitySummaryBase {
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

interface CapabilityCollectionBase {
  robot_id: string;
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

interface CapabilityDetailBase {
  robot_id: string;
  contract: CapabilityContract;
  bindings: CapabilityBinding[];
  observed_at: string;
  freshness: "fresh" | "unknown";
}

export interface CapabilityDetailV1 extends CapabilityDetailBase {
  schema_version: "rolo-capability-detail/v1";
  capability: CapabilitySummaryV1;
}

export interface CapabilityDetailV2 extends CapabilityDetailBase {
  schema_version: "rolo-capability-detail/v2";
  capability: CapabilitySummaryV2;
  inferred_bindings: CapabilityInferredBinding[];
}

export type CapabilityDetail = CapabilityDetailV1 | CapabilityDetailV2;

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

export interface DiscoveryHeuristicSummary {
  schema_version: "rolo-discovery-heuristic-summary/v1";
  mode: "disabled" | "shadow" | "enabled";
  status: "AGENT_COMPLETED" | "FALLBACK" | "DISABLED";
  inferred_operation_count: number;
  missing_evidence_count: number;
  influences_release: false;
}

export interface DiscoveryTargetEvidenceSummary {
  schema_version: "rolo-discovery-target-evidence-summary/v1";
  deployment_scope: "LOCAL" | "REMOTE";
  freshness: "FRESH" | "STALE";
  collected_at: string;
  refresh_required: boolean;
  refresh_reason: string | null;
}

interface DiscoverySnapshotSummaryBase {
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

export interface CapabilityInferredBinding {
  schema_version: "rolo-capability-inferred-binding/v1";
  inference_id: string;
  origin: "HEURISTIC_AGENT";
  verification_status: "DISCOVERED_UNVERIFIED";
  authority: "OBSERVED" | "DECLARED";
  kind: string;
  endpoint: string;
  interface_type: string | null;
  observed_at: string | null;
  reference_digest: string;
  limitations: string[];
}

export interface CapabilityCollectionV1 extends CapabilityCollectionBase {
  schema_version: "rolo-capability-collection/v1";
  items: CapabilitySummaryV1[];
}

export interface CapabilityCollectionV2 extends CapabilityCollectionBase {
  schema_version: "rolo-capability-collection/v2";
  items: CapabilitySummaryV2[];
}

export type CapabilityCollection = CapabilityCollectionV1 | CapabilityCollectionV2;

export interface CapabilitySummaryV1 extends CapabilitySummaryBase {
  schema_version: "rolo-capability-summary/v1";
}

export interface CapabilitySummaryV2 extends CapabilitySummaryBase {
  schema_version: "rolo-capability-summary/v2";
  inferred_binding_count: number;
  candidate_origin: "DETERMINISTIC" | "HEURISTIC_AGENT" | null;
  candidate_verification_status: "DISCOVERED_UNVERIFIED" | null;
}

export type CapabilitySummary = CapabilitySummaryV1 | CapabilitySummaryV2;

export interface DiscoverySnapshotSummaryV1 extends DiscoverySnapshotSummaryBase {
  schema_version: "rolo-discovery-snapshot-summary/v1";
}

export interface DiscoverySnapshotSummaryV2 extends DiscoverySnapshotSummaryBase {
  schema_version: "rolo-discovery-snapshot-summary/v2";
  heuristic_summary: DiscoveryHeuristicSummary;
}

export interface DiscoverySnapshotSummaryV3 extends DiscoverySnapshotSummaryBase {
  schema_version: "rolo-discovery-snapshot-summary/v3";
  heuristic_summary: DiscoveryHeuristicSummary;
  target_evidence: DiscoveryTargetEvidenceSummary | null;
}

export type DiscoverySnapshotSummary = DiscoverySnapshotSummaryV1 | DiscoverySnapshotSummaryV2 | DiscoverySnapshotSummaryV3;

interface DiscoverySnapshotCollectionBase {
  robot_id: string;
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

export interface DiscoverySnapshotCollectionV1 extends DiscoverySnapshotCollectionBase {
  schema_version: "rolo-discovery-snapshot-collection/v1";
  items: DiscoverySnapshotSummaryV1[];
}

export interface DiscoverySnapshotCollectionV2 extends DiscoverySnapshotCollectionBase {
  schema_version: "rolo-discovery-snapshot-collection/v2";
  items: DiscoverySnapshotSummaryV2[];
}

export interface DiscoverySnapshotCollectionV3 extends DiscoverySnapshotCollectionBase {
  schema_version: "rolo-discovery-snapshot-collection/v3";
  items: DiscoverySnapshotSummaryV3[];
}

export type DiscoverySnapshotCollection = DiscoverySnapshotCollectionV1 | DiscoverySnapshotCollectionV2 | DiscoverySnapshotCollectionV3;

export type EpisodeState = "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "PARTIAL";
export type EpisodeOutcome = "SUCCEEDED" | "FAILED" | "CANCELLED" | "UNKNOWN";
export type EpisodeVerification = "VERIFIED" | "UNVERIFIED" | "NOT_AVAILABLE";
export type EpisodeCoverage = "METADATA_ONLY" | "PARTIAL" | "COMPLETE";
export type EpisodeTimelineLane = "COMMAND" | "STATE" | "TELEMETRY" | "OBSERVATION" | "ALERT" | "AGENT" | "CONFIGURATION" | "CHECKPOINT" | "GATE" | "OUTCOME";
export type EpisodeAuthority = "DECLARED" | "OBSERVED" | "INFERRED" | "HUMAN_CONFIRMED" | "VERIFIED";
export type EpisodeSynchronization = "SYNCED" | "DEGRADED" | "UNSYNCED" | "UNKNOWN";
export type EpisodeWorldKind = "PHYSICAL" | "SIMULATED" | "REPLAYED";
export type EpisodeEvidenceKind = "RAW" | "NORMALIZED" | "RENDERED" | "GUI_SCREENSHOT";
export type EpisodeFindingKind = "OBSERVED_FACT" | "CANDIDATE_CAUSE" | "HUMAN_CONFIRMATION" | "VERIFIED_OUTCOME";
export type EpisodeSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";
export type EpisodeAssetAvailability = "AVAILABLE" | "MISSING" | "REDACTED";

interface EpisodeSummaryBase {
  robot_id: string;
  episode_id: string;
  revision: number;
  task_label: string;
  state: EpisodeState;
  outcome: EpisodeOutcome;
  verification: EpisodeVerification;
  coverage: EpisodeCoverage;
  started_at: string;
  ended_at: string | null;
  execution_id: string | null;
  test_case_id: string | null;
  lifecycle_run_id: string | null;
  operation: string | null;
  event_count: number;
  asset_count: number;
  finding_count: number;
  evidence_ids: string[];
  source_kind: "published_episode_projection";
  limitations: string[];
}

export interface EpisodeSummary extends EpisodeSummaryBase {
  schema_version: "rolo-episode-summary/v1";
}

export interface EpisodeAssetSummary {
  schema_version: "rolo-episode-asset-summary/v1";
  robot_id: string;
  episode_id: string;
  revision: number;
  asset_id: string;
  modality: string;
  source_label: string;
  captured_at: string;
  offset_ms: number;
  world_kind: EpisodeWorldKind;
  evidence_kind: EpisodeEvidenceKind;
  frame: string | null;
  clock_domain: string;
  synchronization: EpisodeSynchronization;
  media_type: string;
  byte_count: number | null;
  digest: string | null;
  data_classification: "PUBLIC" | "INTERNAL" | "SENSITIVE" | "SECRET";
  evidence_id: string | null;
  availability: EpisodeAssetAvailability;
  limitations: string[];
}

export interface EpisodeFindingSummary {
  schema_version: "rolo-episode-finding-summary/v1";
  robot_id: string;
  episode_id: string;
  revision: number;
  finding_id: string;
  kind: EpisodeFindingKind;
  authority: EpisodeAuthority;
  title: string;
  summary: string;
  start_offset_ms: number;
  end_offset_ms: number;
  supporting_evidence_ids: string[];
  supporting_asset_ids: string[];
  contradicting_evidence_ids: string[];
  confidence: number | null;
  verification: EpisodeVerification;
  limitations: string[];
}

export interface EpisodeTimelineEvent {
  schema_version: "rolo-episode-timeline-event/v1";
  robot_id: string;
  episode_id: string;
  revision: number;
  event_id: string;
  sequence: number;
  offset_ms: number;
  occurred_at: string;
  duration_ms: number | null;
  clock_domain: string;
  synchronization: EpisodeSynchronization;
  lane: EpisodeTimelineLane;
  title: string;
  summary: string;
  severity: EpisodeSeverity;
  authority: EpisodeAuthority;
  evidence_ids: string[];
  asset_ids: string[];
  related_event_ids: string[];
  metrics: Record<string, number>;
  limitations: string[];
}

export interface EpisodeDetail extends EpisodeSummaryBase {
  schema_version: "rolo-episode-detail/v1";
  as_of: string;
  immutable: boolean;
  clock_domain: string;
  synchronization: EpisodeSynchronization;
  available_lanes: EpisodeTimelineLane[];
  expected_behavior: string | null;
  observed_behavior: string | null;
  assets: EpisodeAssetSummary[];
  findings: EpisodeFindingSummary[];
}

export interface EpisodeCollection {
  schema_version: "rolo-episode-collection/v1";
  robot_id: string;
  items: EpisodeSummary[];
  total: number;
  limit: number;
  offset: number;
  next_offset: number | null;
  as_of: string;
  source_kind: "published_episode_projection";
  limitations: string[];
}

export interface EpisodeRevisionSummary {
  schema_version: "rolo-episode-revision-summary/v1";
  robot_id: string;
  episode_id: string;
  revision: number;
  parent_revision: number | null;
  committed_at: string;
  state: EpisodeState;
  outcome: EpisodeOutcome;
  verification: EpisodeVerification;
  coverage: EpisodeCoverage;
  immutable: boolean;
  event_count: number;
  asset_count: number;
  finding_count: number;
  is_current: boolean;
  source_kind: "committed_episode_record" | "published_episode_projection";
  limitations: string[];
}

export interface EpisodeRevisionCollection {
  schema_version: "rolo-episode-revision-collection/v1";
  robot_id: string;
  episode_id: string;
  current_revision: number;
  items: EpisodeRevisionSummary[];
  total: number;
  limit: number;
  offset: number;
  next_offset: number | null;
  as_of: string;
  source_kind: "episode_revision_history";
  limitations: string[];
}

export interface EpisodeCohortMember {
  schema_version: "rolo-episode-cohort-member/v1";
  robot_id: string;
  episode_id: string;
  revision: number;
  task_label: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  state: Exclude<EpisodeState, "RUNNING">;
  outcome: EpisodeOutcome;
  verification: EpisodeVerification;
  coverage: EpisodeCoverage;
  immutable: true;
  is_current: true;
  event_count: number;
  asset_count: number;
  finding_count: number;
  evidence_count: number;
  source_kind: "current_episode_publication";
  limitations: string[];
}

export interface EpisodeCohortExclusions {
  schema_version: "rolo-episode-cohort-exclusions/v1";
  running: number;
  mutable: number;
}

export interface EpisodeCohort {
  schema_version: "rolo-episode-cohort/v1";
  robot_id: string;
  reference_episode_id: string;
  reference_revision: number;
  operation: string;
  test_case_id: string;
  expected_behavior_sha256: string;
  window_days: 7 | 30 | 90;
  window_started_at: string;
  window_ended_at: string;
  items: EpisodeCohortMember[];
  population_count: number;
  included_count: number;
  excluded_count: number;
  truncated_count: number;
  exclusions: EpisodeCohortExclusions;
  coverage: "COMPLETE" | "BOUNDED_PARTIAL";
  limit: number;
  as_of: string;
  source_kind: "published_episode_cohort";
  limitations: string[];
}

export interface EpisodeTimelinePage {
  schema_version: "rolo-episode-timeline-page/v1";
  robot_id: string;
  episode_id: string;
  revision: number;
  items: EpisodeTimelineEvent[];
  limit: number;
  cursor: string | null;
  next_cursor: string | null;
  as_of: string;
  immutable: boolean;
  limitations: string[];
}

export type EpisodeObservationBundleTrigger = "INITIAL" | "SUPPLEMENTARY";
export type EpisodeObservationBundleStatus = "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
export type EpisodeObservationSourceKind =
  | "ONBOARD_SENSOR"
  | "EXTERNAL_MEASUREMENT"
  | "ROBOT_STATE"
  | "SPATIAL_MODEL"
  | "DETERMINISTIC_RENDER"
  | "TRUSTED_GUI_CAPTURE"
  | "SIMULATION";
export type EpisodeObservationSourceAvailability = "AVAILABLE" | "MISSING" | "STALE" | "REJECTED" | "UNAVAILABLE";
export type EpisodeObservationSpatialAlignment = "ALIGNED" | "DEGRADED" | "UNALIGNED" | "UNKNOWN";
export type EpisodeObservationWorldScope = "NONE" | "PHYSICAL_ONLY" | "SIMULATED_ONLY" | "REPLAYED_ONLY" | "MIXED";

export interface EpisodeObservationSourceCoverage {
  schema_version: "rolo-episode-observation-source-coverage/v1";
  robot_id: string;
  episode_id: string;
  episode_revision: number;
  bundle_id: string;
  source_id: string;
  label: string;
  source_kind: EpisodeObservationSourceKind;
  modality: string;
  world_kind: EpisodeWorldKind;
  availability: EpisodeObservationSourceAvailability;
  synchronization: EpisodeSynchronization;
  spatial_alignment: EpisodeObservationSpatialAlignment;
  asset_ids: string[];
  limitations: string[];
}

export interface EpisodeObservationBundleSummary {
  schema_version: "rolo-episode-observation-bundle-summary/v1";
  robot_id: string;
  episode_id: string;
  episode_revision: number;
  bundle_id: string;
  sequence: number;
  parent_bundle_id: string | null;
  trigger_kind: EpisodeObservationBundleTrigger;
  status: EpisodeObservationBundleStatus;
  created_at: string;
  window_start_offset_ms: number;
  window_end_offset_ms: number;
  synchronization: EpisodeSynchronization;
  spatial_alignment: EpisodeObservationSpatialAlignment;
  world_scope: EpisodeObservationWorldScope;
  sources: EpisodeObservationSourceCoverage[];
  asset_ids: string[];
  evidence_ids: string[];
  limitations: string[];
  influences_verification: false;
}

export interface EpisodeObservationBundleCollection {
  schema_version: "rolo-episode-observation-bundle-collection/v1";
  robot_id: string;
  episode_id: string;
  episode_revision: number;
  items: EpisodeObservationBundleSummary[];
  limit: number;
  cursor: string | null;
  next_cursor: string | null;
  as_of: string;
  immutable: true;
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

interface FleetBlockerSummaryBase {
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

export interface FleetBlockerSummaryV1 extends FleetBlockerSummaryBase {
  schema_version: "rolo-fleet-blocker-summary/v1";
}

export interface FleetBlockerSummaryV2 extends FleetBlockerSummaryBase {
  schema_version: "rolo-fleet-blocker-summary/v2";
  category: "MISSING_VERIFIED_EVIDENCE" | "EVIDENCE_UNAVAILABLE_OR_INVALID" | "POLICY_OR_AUTHORIZATION" | "DEPENDENCY_OR_PREREQUISITE" | "PIPELINE_BLOCKER";
  classification_basis: "normalized_pipeline_message";
  impact: string;
  resolution_requirement_count: number;
}

export type FleetBlockerSummary = FleetBlockerSummaryV1 | FleetBlockerSummaryV2;

interface FleetBlockerCollectionBase {
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

export interface FleetBlockerCollectionV1 extends FleetBlockerCollectionBase {
  schema_version: "rolo-fleet-blocker-collection/v1";
  items: FleetBlockerSummaryV1[];
}

export interface FleetBlockerCollectionV2 extends FleetBlockerCollectionBase {
  schema_version: "rolo-fleet-blocker-collection/v2";
  items: FleetBlockerSummaryV2[];
  limitations: string[];
}

export type FleetBlockerCollection = FleetBlockerCollectionV1 | FleetBlockerCollectionV2;

export interface BlockerResolutionRequirement {
  requirement_id: string;
  kind: "FRESH_ASSESSMENT" | "VALIDATED_EVIDENCE";
  statement: string;
  evidence_id: string | null;
  status: "REQUIRED";
}

export interface FleetBlockerDetail {
  schema_version: "rolo-fleet-blocker-detail/v1";
  blocker: FleetBlockerSummaryV2;
  stage_status: "NOT_STARTED" | "BLOCKED" | "DEGRADED" | "READY" | "COMPLETE";
  stage_summary: string;
  expected_stage_statuses: ["READY", "COMPLETE"];
  resolution_requirements: BlockerResolutionRequirement[];
  canonical_cli_argv: string[];
  resolution_state: "OPEN";
  contains_secret_payloads: false;
  source_kind: "pipeline_assessment";
  integrity_status: "validated";
  limitations: string[];
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
