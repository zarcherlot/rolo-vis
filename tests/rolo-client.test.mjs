import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { TOPOLOGY_EDGES, TOPOLOGY_NODES } from "../src/demoData.ts";
import {
  ROLO_API_FEATURES,
  RoloApiError,
  RoloClient,
  RoloContractError,
  supportsApiFeature,
} from "../src/roloClient.ts";
import { getOverviewPresentation, getSurfaceSource } from "../src/workbenchPolicy.ts";

const HEALTH = {
  status: "HEALTHY",
  service: "rolo-control-plane",
  version: "0.1.0",
  robots: 1,
  robot_use_backend: "offline",
  openai_key_configured: false,
  timestamp: "2026-08-20T00:00:00Z",
};

const TARGET_OPERATION_SLICE = {
  schema_version: "robot-target-operation-slice/v1",
  robot_id: "AMR-07",
  discovery_id: "discovery-1",
  registry_sha256: "a".repeat(64),
  slice_sha256: "b".repeat(64),
  primary_operations: ["app.navigation.start"],
  dependency_operations: ["app.navigation.cancel"],
  agent_native_operations: ["app.navigation.start"],
  builtin_operations: ["app.navigation.cancel"],
  target_adapter_operations: [],
  platform_specific_operations: [],
  deferred_summary: { NO_ROUTE: 2 },
};

const SLICE_STABILITY = {
  schema_version: "robot-target-operation-slice-stability/v1",
  robot_id: "AMR-07",
  max_runs: 50,
  min_successful_canary_runs: 10,
  observation_count: 1,
  selected_canary_count: 1,
  activated_count: 1,
  fallback_count: 0,
  successful_canary_count: 1,
  agent_failed_count: 0,
  gate_failed_count: 0,
  context_budget_exceeded_count: 0,
  average_potential_context_reduction_ratio: 0.5,
  average_effective_context_reduction_ratio: 0.5,
  outcome_counts: { ACTIVATED: 1 },
  alert_counts: { ELIGIBLE_NOT_IN_SLICE: 1 },
  recommendation: "INSUFFICIENT_DATA",
  recommendation_reasons: ["MINIMUM_SUCCESSFUL_CANARY_RUNS_NOT_MET"],
  observations: [{
    run_id: "run-20260821-001",
    decision_ref: "artifact://adapt/AMR-07/runs/run-20260821-001/slice-activation-decision.json",
    mode: "CANARY",
    outcome: "ACTIVATED",
    selected: true,
    affects_agent_context: true,
    agent_run_status: "SUCCEEDED",
    gate_status: "PASSED",
    authoritative_operation_count: 20,
    requested_operation_count: 10,
    effective_operation_count: 10,
    potential_context_reduction_ratio: 0.5,
    effective_context_reduction_ratio: 0.5,
    prompt_token_estimate: 2000,
    boot_context_token_estimate: 4000,
    boot_context_budget_tokens: 8000,
    context_budget_exceeded: false,
    alert_codes: ["ELIGIBLE_NOT_IN_SLICE"],
    fallback_reason: null,
  }],
  influences_release: false,
};

const ADAPT_BASELINE = {
  schema_version: "rolo-adapt-baseline-status/v1",
  status: "MATCHED",
  pinned: {
    schema_version: "robot-adapt-baseline-snapshot/v1",
    operation_count: 294,
    disposition_count: 294,
    contract_catalog_sha256: "1".repeat(64),
    registry_sha256: "2".repeat(64),
    operation_identity_sha256: "3".repeat(64),
  },
  current: {
    schema_version: "robot-adapt-baseline-snapshot/v1",
    operation_count: 294,
    disposition_count: 294,
    contract_catalog_sha256: "1".repeat(64),
    registry_sha256: "2".repeat(64),
    operation_identity_sha256: "3".repeat(64),
  },
  changed_fields: [],
  source_kind: "protected_product_baseline",
  influences_release: false,
  limitations: ["Product baseline only."],
};

const SLICE_RUN_DETAIL = {
  schema_version: "rolo-adapt-slice-run-detail/v1",
  robot_id: "AMR-07",
  run_id: "run-20260821-001",
  observation: SLICE_STABILITY.observations[0],
  activation: {
    schema_version: "robot-target-operation-slice-activation/v1",
    robot_id: "AMR-07",
    run_id: "run-20260821-001",
    slice_sha256: "b".repeat(64),
    mode: "CANARY",
    selected: true,
    selected_by: ["run_id"],
    outcome: "ACTIVATED",
    authoritative_eligible_operations: ["app.agent-native", "app.target"],
    requested_context_operations: ["app.target"],
    effective_context_operations: ["app.target"],
    release_authority_operations: ["app.agent-native", "app.target"],
    max_context_operations: 20,
    alerts: [{
      code: "ELIGIBLE_NOT_IN_SLICE",
      severity: "WARNING",
      message: "One eligible operation is outside the Slice.",
      operations: ["app.agent-native"],
    }],
    fallback_reason: null,
    affects_agent_context: true,
    influences_release: false,
  },
  shadow: {
    schema_version: "robot-target-operation-slice-shadow/v1",
    robot_id: "AMR-07",
    discovery_id: "discovery-1",
    slice_sha256: "b".repeat(64),
    authoritative_eligible_operations: ["app.agent-native", "app.target"],
    shadow_target_adapter_operations: ["app.target"],
    eligible_not_in_shadow: ["app.agent-native"],
    shadow_not_in_eligible: [],
    influences_release: false,
  },
  source_kind: "immutable_adapt_run_artifacts",
  integrity_status: "validated",
  influences_release: false,
  limitations: ["Agent context only."],
};

const SLICE_COMPARISON = {
  schema_version: "rolo-adapt-slice-stability-comparison/v1",
  robot_id: "AMR-07",
  status: "PARTIAL",
  recent: { label: "RECENT", requested_observations: 2, observation_count: 1, newest_run_id: "run-2", oldest_run_id: "run-2", successful_canary_count: 1, fallback_count: 0, agent_failed_count: 0, gate_failed_count: 0, context_budget_exceeded_count: 0, average_effective_context_reduction_ratio: 0.5 },
  previous: { label: "PREVIOUS", requested_observations: 2, observation_count: 1, newest_run_id: "run-1", oldest_run_id: "run-1", successful_canary_count: 0, fallback_count: 1, agent_failed_count: 0, gate_failed_count: 0, context_budget_exceeded_count: 0, average_effective_context_reduction_ratio: 0.4 },
  delta: { successful_canary_count: 1, fallback_count: -1, agent_failed_count: 0, gate_failed_count: 0, context_budget_exceeded_count: 0, average_effective_context_reduction_ratio: 0.1 },
  regression_signals: [],
  source_kind: "immutable_adapt_run_artifacts",
  influences_release: false,
  limitations: ["Descriptive only."],
};

const FLEET_SLICE = {
  schema_version: "rolo-adapt-fleet-slice-stability/v1",
  max_runs_per_robot: 20,
  min_successful_canary_runs: 10,
  robot_count: 1,
  observed_robot_count: 1,
  recommendation_counts: { INSUFFICIENT_DATA: 1 },
  items: [{ robot_id: "AMR-07", recommendation: "INSUFFICIENT_DATA", observation_count: 1, successful_canary_count: 1, fallback_count: 0, diagnostic_count: 0 }],
  source_kind: "immutable_adapt_run_artifacts",
  influences_release: false,
  limitations: ["Human review required."],
};

const SLICE_REVIEW_PACKET = {
  schema_version: "rolo-adapt-slice-review-packet/v1",
  robot_id: "AMR-07",
  status: "INCOMPLETE",
  baseline_status: "MATCHED",
  stability_recommendation: "INSUFFICIENT_DATA",
  checks: [{ check_id: "human_rollout_decision", label: "Human rollout decision", status: "HUMAN_REQUIRED", summary: "Review required." }],
  evidence_run_ids: ["run-20260821-001"],
  evidence_refs: ["artifact://adapt/AMR-07/runs/run-20260821-001/slice-activation-decision.json"],
  contains_secret_payloads: false,
  influences_release: false,
  limitations: ["Summary only."],
};

const OPERATION_GOVERNANCE_COLLECTION = {
  schema_version: "rolo-operation-governance-collection/v1",
  items: [{
    current_operation: "linux.service.inspect",
    current_layer: "linux",
    semantic_layer: "os",
    execution_class: "TARGET_ADAPTER",
    portable_semantics: true,
    future_capability: "os.workload.inspect",
    migration_status: "PLANNED",
    migration_reason: "Portable workload inspection is planned.",
    current_registry_action: "KEEP",
  }],
  total: 1,
  limit: 1,
  offset: 0,
  next_offset: null,
  source_kind: "operation_disposition_ledger",
  influences_registry: false,
  limitations: ["External governance metadata only."],
};

const ROBOT = {
  schema_version: "robot-capability/v1",
  robot_id: "AMR-07",
  adapter: "test-adapter",
  platform: {},
  geometry: {},
  sensors: {},
  features: {},
};

const PIPELINE = {
  schema_version: "robot-three-stage-pipeline/v1",
  robot_id: "AMR-07",
  observed_at: "2026-08-20T00:00:00Z",
  stages: [{
    schema_version: "robot-stage-assessment/v1",
    stage: "adapt",
    robot_id: "AMR-07",
    status: "READY",
    summary: "Ready",
    optional: false,
    prerequisites: [],
    artifacts: {},
    blockers: [],
    agent_requirement: "adapter_agent",
    observed_at: "2026-08-20T00:00:00Z",
  }],
};

const OVERVIEW = {
  schema_version: "rolo-robot-overview/v2",
  robot_id: "AMR-07",
  state: "READY",
  summary: "Ready",
  next_action: "Continue",
  blockers: [],
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
  source_kind: "computed_read_model",
  confidence: 1,
  integrity_status: "validated",
  pipeline: PIPELINE,
};

const EVIDENCE_RECORD = {
  schema_version: "rolo-evidence-record/v1",
  evidence_id: "ev_1234567890abcdef12",
  robot_id: "AMR-07",
  title: "Declared robot",
  summary: "Declared by the robot manifest.",
  authority: "DECLARED",
  source_kind: "robot_manifest",
  integrity_status: "validated",
  classification: "INTERNAL",
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
  confidence: 1,
  reference_hint: "robot-manifest:AMR-07:robot",
  reference_digest: "a".repeat(64),
  related_node_ids: ["robot_1"],
  limitations: ["Declaration only"],
};

const TOPOLOGY = {
  schema_version: "rolo-robot-topology/v1",
  robot_id: "AMR-07",
  snapshot_id: "topology_1",
  coverage: "REGISTRY_ONLY",
  nodes: [{
    schema_version: "rolo-topology-node/v1",
    node_id: "robot_1",
    kind: "robot",
    label: "AMR-07",
    subtitle: "differential",
    layer: "Hardware",
    state: "DECLARED",
    confidence: 1,
    integrity_status: "validated",
    evidence_ids: [EVIDENCE_RECORD.evidence_id],
    attributes: {},
  }],
  edges: [],
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
  source_kind: "robot_registry",
  confidence: 0.7,
  integrity_status: "validated",
  limitations: ["Registry only"],
};

const TOPOLOGY_SNAPSHOTS = {
  schema_version: "rolo-topology-snapshot-collection/v1",
  robot_id: "AMR-07",
  items: [{
    schema_version: "rolo-topology-snapshot-summary/v1",
    snapshot_id: "topology_snapshot_1",
    release_id: "release-1",
    published_at: "2026-08-19T00:00:00Z",
    node_count: 1,
    edge_count: 0,
    coverage: "GATED_RELEASE",
    integrity_status: "verified",
    is_current: false,
  }, {
    schema_version: "rolo-topology-snapshot-summary/v1",
    snapshot_id: "topology_snapshot_2",
    release_id: "release-2",
    published_at: "2026-08-20T00:00:00Z",
    node_count: 1,
    edge_count: 0,
    coverage: "GATED_RELEASE",
    integrity_status: "verified",
    is_current: true,
  }],
  total: 2,
  observed_at: "2026-08-20T00:00:01Z",
  freshness: "unknown",
  limitations: ["Verified releases only"],
};

const TOPOLOGY_DIFF = {
  schema_version: "rolo-topology-diff/v1",
  robot_id: "AMR-07",
  from_snapshot: TOPOLOGY_SNAPSHOTS.items[0],
  to_snapshot: TOPOLOGY_SNAPSHOTS.items[1],
  added_nodes: 0,
  removed_nodes: 0,
  changed_nodes: 1,
  added_edges: 0,
  removed_edges: 0,
  changed_edges: 0,
  node_changes: [{
    schema_version: "rolo-topology-node-change/v1",
    node_id: "robot_1",
    change: "CHANGED",
    changed_fields: ["state"],
    before: TOPOLOGY.nodes[0],
    after: { ...TOPOLOGY.nodes[0], state: "GATED", integrity_status: "verified" },
  }],
  edge_changes: [],
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "unknown",
  integrity_status: "verified",
  limitations: ["Gated declarations only"],
};

const TOPOLOGY_PATH = {
  schema_version: "rolo-topology-path-explanation/v1",
  robot_id: "AMR-07",
  snapshot_id: "topology_1",
  from_node_id: "robot_1",
  to_node_id: "adapter_1",
  found: true,
  hop_count: 1,
  nodes: [TOPOLOGY.nodes[0], {
    ...TOPOLOGY.nodes[0],
    node_id: "adapter_1",
    kind: "adapter",
    label: "Adapter",
    layer: "Application",
  }],
  steps: [{
    schema_version: "rolo-topology-path-step/v1",
    index: 0,
    from_node_id: "robot_1",
    to_node_id: "adapter_1",
    edge_id: "edge_path_1",
    relation: "hosts",
    direction: "FORWARD",
    state: "DECLARED",
    confidence: 1,
    integrity_status: "validated",
    evidence_ids: [EVIDENCE_RECORD.evidence_id],
  }],
  summary: "A 1-hop topology connection was found.",
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
  source_kind: "topology_path_projection",
  confidence: 1,
  integrity_status: "validated",
  limitations: ["This path does not prove physical reachability."],
};

const WIKI = {
  schema_version: "rolo-robot-wiki/v1",
  robot_id: "AMR-07",
  discovery_id: "discovery-20260820",
  discovery_status: "SUCCEEDED",
  created_at: "2026-08-20T00:00:00Z",
  content_origin: "HUMAN_EDITED",
  content_integrity: "unverified",
  sections: [{
    schema_version: "rolo-wiki-section/v1",
    heading: "Architecture",
    lines: ["The robot uses a bounded navigation stack."],
  }],
  layers: ["Hardware", "Linux", "Middleware", "Application", "Dependencies"].map((layer) => ({
    schema_version: "rolo-wiki-layer-summary/v1",
    layer,
    status: "OBSERVED",
    summary: `Observed ${layer} facts.`,
    facts: { count: 1 },
  })),
  insights: [{
    schema_version: "rolo-wiki-insight-summary/v1",
    category: "ARCHITECTURE",
    statement: "Navigation depends on middleware discovery.",
    confidence: "MEDIUM",
    verification: "Verify against the active graph.",
    source: "DETERMINISTIC_RULE",
    evidence_id: "ev_abcdef123456789012",
  }],
  diff_status: "CHANGED",
  baseline_discovery_id: "discovery-20260819",
  changes: [{
    schema_version: "rolo-wiki-change-summary/v1",
    category: "ROS",
    added: ["topic /map"],
    removed: [],
    changed: [],
    evidence_id: "ev_1234567890abcdef12",
  }],
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "unknown",
  source_kind: "verified_discovery_snapshot",
  confidence: 1,
  integrity_status: "verified",
  limitations: ["Insights remain advisory."],
};

const DISCOVERY_HISTORY = {
  schema_version: "rolo-discovery-snapshot-collection/v2",
  robot_id: "AMR-07",
  items: [{
    schema_version: "rolo-discovery-snapshot-summary/v2",
    robot_id: "AMR-07",
    discovery_id: "discovery-20260820",
    status: "PARTIAL",
    discovery_mode: "ARTIFACT_DOC",
    created_at: "2026-08-20T00:00:00Z",
    is_latest: true,
    probe_total: 4,
    observed_probes: 2,
    partial_probes: 1,
    unavailable_probes: 1,
    operation_candidates: 14,
    semantic_bindings: 3,
    warning_count: 2,
    confidence: 0.8,
    integrity_status: "verified",
    limitations: ["Discovery coverage does not prove task success."],
    heuristic_summary: {
      schema_version: "rolo-discovery-heuristic-summary/v1",
      mode: "shadow",
      status: "AGENT_COMPLETED",
      inferred_operation_count: 4,
      missing_evidence_count: 2,
      influences_release: false,
    },
  }],
  total: 1,
  limit: 100,
  offset: 0,
  next_offset: null,
  excluded_unverified: 0,
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "unknown",
  source_kind: "verified_discovery_history",
  integrity_status: "verified",
  limitations: ["Only manifest-verified discovery reports are included."],
};

const { heuristic_summary: _ignoredHeuristic, ...DISCOVERY_SUMMARY_V1 } = DISCOVERY_HISTORY.items[0];
const DISCOVERY_HISTORY_V1 = {
  ...DISCOVERY_HISTORY,
  schema_version: "rolo-discovery-snapshot-collection/v1",
  items: [{ ...DISCOVERY_SUMMARY_V1, schema_version: "rolo-discovery-snapshot-summary/v1" }],
};

const DISCOVERY_HISTORY_V3 = {
  ...DISCOVERY_HISTORY,
  schema_version: "rolo-discovery-snapshot-collection/v3",
  items: [{
    ...DISCOVERY_HISTORY.items[0],
    schema_version: "rolo-discovery-snapshot-summary/v3",
    target_evidence: {
      schema_version: "rolo-discovery-target-evidence-summary/v1",
      deployment_scope: "REMOTE",
      freshness: "STALE",
      collected_at: "2026-08-19T23:50:00Z",
      refresh_required: true,
      refresh_reason: "Verified target evidence is older than the collector replay window.",
    },
  }],
};

const FLEET = {
  schema_version: "rolo-fleet-collection/v1",
  items: [{
    schema_version: "rolo-fleet-robot-summary/v1",
    robot_id: "AMR-07",
    adapter: "test-adapter",
    architecture: "arm64",
    ros_distro: "humble",
    state: "ATTENTION",
    active_stage: "adapt",
    active_status: "BLOCKED",
    blocker_count: 1,
    next_action: "Run adapt discovery",
    observed_at: "2026-08-20T00:00:00Z",
    freshness: "fresh",
    source_kind: "computed_robot_overview",
    confidence: 1,
    integrity_status: "validated",
  }],
  total: 1,
  limit: 100,
  offset: 0,
  next_offset: null,
  ready: 0,
  attention: 1,
  degraded: 0,
  not_ready: 0,
  blocker_count: 1,
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
  source_kind: "computed_fleet_overviews",
  confidence: 1,
  integrity_status: "validated",
};

const FLEET_BLOCKERS = {
  schema_version: "rolo-fleet-blocker-collection/v2",
  items: [{
    schema_version: "rolo-fleet-blocker-summary/v2",
    blocker_id: "blocker_123",
    robot_id: "AMR-07",
    stage: "adapt",
    message: "Run adapt discovery",
    recommended_action: "Resolve the reported Adapt blocker, then reassess the pipeline.",
    owner: "adapter_agent",
    category: "PIPELINE_BLOCKER",
    classification_basis: "normalized_pipeline_message",
    impact: "Prevents Adapt from advancing while the validated pipeline assessment reports this blocker.",
    resolution_requirement_count: 1,
    evidence_ids: [],
    observed_at: "2026-08-20T00:00:00Z",
    freshness: "fresh",
    source_kind: "pipeline_assessment",
    confidence: 1,
    integrity_status: "validated",
  }],
  total: 1,
  limit: 100,
  offset: 0,
  next_offset: null,
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
  source_kind: "computed_pipeline_blockers",
  confidence: 1,
  integrity_status: "validated",
  limitations: ["Normalized triage only."],
};

const FLEET_BLOCKERS_V1 = {
  schema_version: "rolo-fleet-blocker-collection/v1",
  items: [{
    schema_version: "rolo-fleet-blocker-summary/v1",
    blocker_id: "blocker_legacy",
    robot_id: "AMR-07",
    stage: "adapt",
    message: "Run adapt discovery",
    recommended_action: "Inspect the validated pipeline assessment.",
    owner: "adapter_agent",
    evidence_ids: [],
    observed_at: "2026-08-20T00:00:00Z",
    freshness: "fresh",
    source_kind: "pipeline_assessment",
    confidence: 1,
    integrity_status: "validated",
  }],
  total: 1,
  limit: 100,
  offset: 0,
  next_offset: null,
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
  source_kind: "computed_pipeline_blockers",
  confidence: 1,
  integrity_status: "validated",
};

const FLEET_BLOCKER_DETAIL = {
  schema_version: "rolo-fleet-blocker-detail/v1",
  blocker: FLEET_BLOCKERS.items[0],
  stage_status: "BLOCKED",
  stage_summary: "Adapt is blocked",
  expected_stage_statuses: ["READY", "COMPLETE"],
  resolution_requirements: [{
    requirement_id: "fresh_pipeline_assessment",
    kind: "FRESH_ASSESSMENT",
    statement: "A newer Adapt assessment must no longer report this blocker.",
    evidence_id: null,
    status: "REQUIRED",
  }],
  canonical_cli_argv: ["robotctl", "pipeline-status", "--robot", "AMR-07"],
  resolution_state: "OPEN",
  contains_secret_payloads: false,
  source_kind: "pipeline_assessment",
  integrity_status: "validated",
  limitations: ["No remediation is executed."],
};

const EVIDENCE_COLLECTION = {
  schema_version: "rolo-evidence-collection/v1",
  robot_id: "AMR-07",
  items: [EVIDENCE_RECORD],
  total: 1,
  limit: 25,
  offset: 0,
  next_offset: null,
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
};

const CAPABILITY_SUMMARY = {
  schema_version: "rolo-capability-summary/v1",
  operation: "tool.catalog",
  layer: "Application",
  description: "Read the active gated Tool Catalog for one robot identity.",
  lifecycle: "RELEASED",
  applicability: "APPLICABLE",
  availability: "AVAILABLE",
  registration: "BUILTIN",
  access: "read",
  risk: "R0",
  data_classification: "INTERNAL",
  contract_version: "1.1.0",
  contract_digest: "b".repeat(64),
  paired_operation: null,
  replacement_operation: null,
  compensation_operation: null,
  binding_count: 0,
  last_verified_at: null,
  evidence_ids: [],
  confidence: 0.9,
  integrity_status: "validated",
  limitations: ["Built-in availability is not outcome evidence."],
};

const CAPABILITY_COLLECTION = {
  schema_version: "rolo-capability-collection/v1",
  robot_id: "AMR-07",
  items: [CAPABILITY_SUMMARY],
  total: 1,
  limit: 100,
  offset: 0,
  next_offset: null,
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
  source_kind: "product_registry",
  limitations: ["Applicability is unknown until discovery."],
};

const CAPABILITY_DETAIL = {
  schema_version: "rolo-capability-detail/v1",
  robot_id: "AMR-07",
  capability: CAPABILITY_SUMMARY,
  contract: {
    schema_version: "rolo-capability-contract/v1",
    input_schema: { type: "object" },
    output_schema: { type: "object" },
    capability_requirements: [],
    preconditions: [],
    postconditions: [],
    semantic_units: {},
    coordinate_frames: [],
    time_semantics: "UTC",
    result_semantics: "OBSERVATION",
    execution_mode: "REQUEST_RESPONSE",
    idempotent: true,
    cancelable: false,
    max_duration_s: 5,
    side_effects: [],
    resource_locks: [],
    requires_quiescence: false,
  },
  bindings: [],
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
};

const CAPABILITY_SUMMARY_V2 = {
  ...CAPABILITY_SUMMARY,
  schema_version: "rolo-capability-summary/v2",
  applicability: "NOT_OBSERVED",
  availability: "UNAVAILABLE",
  registration: "NOT_REGISTERED",
  inferred_binding_count: 1,
  candidate_origin: "HEURISTIC_AGENT",
  candidate_verification_status: "DISCOVERED_UNVERIFIED",
};

const CAPABILITY_COLLECTION_V2 = {
  ...CAPABILITY_COLLECTION,
  schema_version: "rolo-capability-collection/v2",
  items: [CAPABILITY_SUMMARY_V2],
};

const CAPABILITY_DETAIL_V2 = {
  ...CAPABILITY_DETAIL,
  schema_version: "rolo-capability-detail/v2",
  capability: CAPABILITY_SUMMARY_V2,
  inferred_bindings: [{
    schema_version: "rolo-capability-inferred-binding/v1",
    inference_id: "inference_123",
    origin: "HEURISTIC_AGENT",
    verification_status: "DISCOVERED_UNVERIFIED",
    authority: "OBSERVED",
    kind: "ros_topic",
    endpoint: "/agent_route",
    interface_type: "geometry_msgs/msg/Twist",
    observed_at: "2026-08-20T00:00:00Z",
    reference_digest: "c".repeat(64),
    limitations: ["Operation mapping remains unverified."],
  }],
};

const RUN_SUMMARY = {
  schema_version: "rolo-lifecycle-run-summary/v1",
  robot_id: "AMR-07",
  run_id: "run-1",
  stage: "adapt",
  status: "FAILED",
  gate_status: "FAILED",
  handoff_status: "MISSING",
  provider: "codex",
  model: "test-model",
  started_at: "2026-08-20T00:00:00Z",
  completed_at: "2026-08-20T00:00:02Z",
  duration_s: 2,
  gate_check_count: 1,
  evidence_ids: ["ev_run123456789012345"],
  confidence: 0.8,
  integrity_status: "validated",
  limitations: ["No handoff was published."],
};

const RUN_COLLECTION = {
  schema_version: "rolo-lifecycle-run-collection/v1",
  robot_id: "AMR-07",
  items: [RUN_SUMMARY],
  total: 1,
  limit: 50,
  offset: 0,
  next_offset: null,
  observed_at: "2026-08-20T00:00:03Z",
  freshness: "unknown",
  source_kind: "lifecycle_artifacts",
  limitations: [],
};

const RUN_DETAIL = {
  schema_version: "rolo-lifecycle-run-detail/v1",
  run: RUN_SUMMARY,
  gate_checks: [{
    schema_version: "rolo-lifecycle-gate-check/v1",
    check_id: "check-1",
    label: "Independent gate result",
    status: "FAILED",
    authority: "OBSERVED",
    evidence_id: "ev_run123456789012345",
  }],
  handoff: {
    schema_version: "rolo-lifecycle-handoff-summary/v1",
    status: "MISSING",
    authority: "NONE",
    promoted_at: null,
    artifact_count: 2,
    digest: null,
    evidence_id: null,
    limitations: ["No handoff was published."],
  },
  artifacts: [{
    schema_version: "rolo-lifecycle-artifact-summary/v1",
    name: "Independent gate report",
    kind: "gate",
    integrity_status: "validated",
    evidence_id: "ev_run123456789012345",
    reference_digest: "c".repeat(64),
  }],
  observed_at: "2026-08-20T00:00:03Z",
  freshness: "unknown",
};

test("RoloClient bootstraps the read-only control-plane surface", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    const payload = url.endsWith("/health")
      ? HEALTH
      : url.endsWith("/v1/robots")
        ? [ROBOT]
        : url.endsWith("/overview")
          ? OVERVIEW
          : url.endsWith("/topology/snapshots")
            ? TOPOLOGY_SNAPSHOTS
          : url.endsWith("/topology")
            ? TOPOLOGY
            : url.includes("/runs?limit=")
              ? RUN_COLLECTION
            : url.includes("/capabilities?limit=")
              ? CAPABILITY_COLLECTION
            : url.includes("/evidence?limit=")
              ? EVIDENCE_COLLECTION
              : PIPELINE;
    return { ok: true, json: async () => payload };
  };

  try {
    const result = await new RoloClient("http://rolo.test/").bootstrap();
    assert.equal(result.health.status, "HEALTHY");
    assert.deepEqual(result.health.api_features, []);
    assert.equal(result.robots[0].robot_id, "AMR-07");
    assert.equal(result.mode, "live");
    assert.equal(result.overview.schema_version, "rolo-robot-overview/v2");
    assert.equal(result.pipeline.stages[0].stage, "adapt");
    assert.equal(result.topology.schema_version, "rolo-robot-topology/v1");
    assert.equal(result.topologySnapshots.total, 2);
    assert.equal(result.evidence.items[0].evidence_id, EVIDENCE_RECORD.evidence_id);
    assert.equal(result.capabilities[0].operation, "tool.catalog");
    assert.equal(result.runs.items[0].run_id, "run-1");
    assert.deepEqual(requests, [
      "http://rolo.test/health",
      "http://rolo.test/v1/robots",
      "http://rolo.test/v1/robots/AMR-07/overview",
      "http://rolo.test/v1/robots/AMR-07/topology",
      "http://rolo.test/v1/robots/AMR-07/topology/snapshots",
      "http://rolo.test/v1/robots/AMR-07/evidence?limit=25&offset=0",
      "http://rolo.test/v1/robots/AMR-07/capabilities?limit=100&offset=0",
      "http://rolo.test/v1/robots/AMR-07/runs?limit=50&offset=0",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient reads governance metadata without changing Registry capability data", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = url;
    return { ok: true, json: async () => OPERATION_GOVERNANCE_COLLECTION };
  };

  try {
    const result = await new RoloClient("http://rolo.test").operationGovernancePage(
      undefined,
      { limit: 1, offset: 0 },
    );
    assert.equal(
      requestedUrl,
      "http://rolo.test/v1/operations/governance?limit=1&offset=0",
    );
    assert.equal(result.items[0].semantic_layer, "os");
    assert.equal(result.items[0].current_registry_action, "KEEP");
    assert.equal(result.influences_registry, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient reads the complete governance ledger only when requested", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const entries = Array.from({ length: 51 }, (_, index) => ({
    ...OPERATION_GOVERNANCE_COLLECTION.items[0],
    current_operation: `linux.test.operation_${String(index).padStart(2, "0")}`,
    future_capability: `os.test.operation_${String(index).padStart(2, "0")}`,
  }));
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    const parsed = new URL(String(url));
    const limit = Number(parsed.searchParams.get("limit"));
    const offset = Number(parsed.searchParams.get("offset"));
    return {
      ok: true,
      json: async () => ({
        ...OPERATION_GOVERNANCE_COLLECTION,
        items: entries.slice(offset, offset + limit),
        total: entries.length,
        limit,
        offset,
        next_offset: offset + limit < entries.length ? offset + limit : null,
      }),
    };
  };

  try {
    const result = await new RoloClient("http://rolo.test").operationGovernance();
    assert.equal(result.items.length, 51);
    assert.equal(result.items.at(-1).current_operation, "linux.test.operation_50");
    assert.deepEqual(requests, [
      "http://rolo.test/v1/operations/governance?limit=50&offset=0",
      "http://rolo.test/v1/operations/governance?limit=50&offset=50",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient keeps the optional Adapt slice out of bootstrap and loads it on demand", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    const payload = url.endsWith("/health")
      ? { ...HEALTH, api_features: ["adapt.target-operation-slice/v1"] }
      : url.endsWith("/v1/robots")
        ? [ROBOT]
        : url.endsWith("/overview")
          ? OVERVIEW
          : url.endsWith("/topology/snapshots")
            ? TOPOLOGY_SNAPSHOTS
            : url.endsWith("/topology")
              ? TOPOLOGY
              : url.endsWith("/adapt/operation-slice")
                ? TARGET_OPERATION_SLICE
                : url.includes("/runs?limit=")
                  ? RUN_COLLECTION
                  : url.includes("/capabilities?limit=")
                    ? CAPABILITY_COLLECTION
                    : EVIDENCE_COLLECTION;
    return { ok: true, json: async () => payload };
  };

  try {
    const client = new RoloClient("http://rolo.test");
    const result = await client.bootstrap();
    assert.deepEqual(result.health.api_features, ["adapt.target-operation-slice/v1"]);
    assert.equal(
      supportsApiFeature(result.health, ROLO_API_FEATURES.targetOperationSlice),
      true,
    );
    assert.equal(requests.includes(
      "http://rolo.test/v1/robots/AMR-07/adapt/operation-slice",
    ), false);

    const slice = await client.targetOperationSlice("AMR-07");
    assert.equal(slice.slice_sha256, "b".repeat(64));
    assert.equal(requests.at(-1),
      "http://rolo.test/v1/robots/AMR-07/adapt/operation-slice",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient loads and validates Slice stability only on demand", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return { ok: true, json: async () => SLICE_STABILITY };
  };

  try {
    const report = await new RoloClient("http://rolo.test").sliceStability("AMR-07");
    assert.equal(report.recommendation, "INSUFFICIENT_DATA");
    assert.equal(
      report.observations[0].decision_ref,
      "artifact://adapt/AMR-07/runs/run-20260821-001/slice-activation-decision.json",
    );
    assert.equal(report.influences_release, false);
    assert.deepEqual(requests, [
      "http://rolo.test/v1/robots/AMR-07/adapt/slice-stability",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects Slice stability that claims release authority", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ...SLICE_STABILITY, influences_release: true }),
  });

  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").sliceStability("AMR-07"),
      RoloContractError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient validates the protected Adapt baseline independently of robot state", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return { ok: true, json: async () => ADAPT_BASELINE };
  };

  try {
    const baseline = await new RoloClient("http://rolo.test").adaptBaseline();
    assert.equal(baseline.status, "MATCHED");
    assert.equal(baseline.current.operation_count, 294);
    assert.deepEqual(requests, ["http://rolo.test/v1/adapt/baseline"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient joins one immutable Slice decision with its Shadow divergence", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return { ok: true, json: async () => SLICE_RUN_DETAIL };
  };

  try {
    const detail = await new RoloClient("http://rolo.test").sliceRunDetail(
      "AMR-07",
      "run-20260821-001",
    );
    assert.equal(detail.activation.affects_agent_context, true);
    assert.deepEqual(detail.activation.release_authority_operations, ["app.agent-native", "app.target"]);
    assert.deepEqual(detail.shadow.eligible_not_in_shadow, ["app.agent-native"]);
    assert.deepEqual(requests, [
      "http://rolo.test/v1/robots/AMR-07/adapt/slice-runs/run-20260821-001",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects a Slice decision that changes release authority", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      ...SLICE_RUN_DETAIL,
      activation: {
        ...SLICE_RUN_DETAIL.activation,
        release_authority_operations: ["app.target"],
      },
    }),
  });

  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").sliceRunDetail("AMR-07", "run-20260821-001"),
      RoloContractError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient validates Fleet, window comparison, and human review summaries", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    if (url.endsWith("/v1/adapt/slice-fleet")) return { ok: true, json: async () => FLEET_SLICE };
    if (url.endsWith("/slice-stability/comparison")) return { ok: true, json: async () => SLICE_COMPARISON };
    return { ok: true, json: async () => SLICE_REVIEW_PACKET };
  };

  try {
    const client = new RoloClient("http://rolo.test");
    const fleet = await client.fleetSliceStability();
    const comparison = await client.sliceStabilityComparison("AMR-07");
    const packet = await client.sliceReviewPacket("AMR-07");
    assert.equal(fleet.observed_robot_count, 1);
    assert.equal(comparison.recent.newest_run_id, "run-2");
    assert.equal(packet.contains_secret_payloads, false);
    assert.equal(packet.checks[0].status, "HUMAN_REQUIRED");
    assert.deepEqual(requests, [
      "http://rolo.test/v1/adapt/slice-fleet",
      "http://rolo.test/v1/robots/AMR-07/adapt/slice-stability/comparison",
      "http://rolo.test/v1/robots/AMR-07/adapt/slice-review",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient reports a partial connection when overview is not available", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.endsWith("/health")) return { ok: true, json: async () => HEALTH };
    if (url.endsWith("/v1/robots")) return { ok: true, json: async () => [ROBOT] };
    if (url.endsWith("/overview")) return { ok: false, status: 404 };
    if (url.endsWith("/topology") || url.endsWith("/topology/snapshots") || url.includes("/evidence?limit=")) return { ok: false, status: 404 };
    if (url.includes("/capabilities?limit=")) return { ok: true, json: async () => CAPABILITY_COLLECTION };
    if (url.includes("/runs?limit=")) return { ok: true, json: async () => RUN_COLLECTION };
    return {
      ok: true,
      json: async () => ({ ...PIPELINE, stages: [{ ...PIPELINE.stages[0], status: "BLOCKED", blockers: ["Blocked"] }] }),
    };
  };
  try {
    const result = await new RoloClient("http://rolo.test").bootstrap();
    assert.equal(result.mode, "partial");
    assert.equal(result.overview, null);
    assert.equal(result.pipeline.stages[0].status, "BLOCKED");
    assert.match(result.issues[0], /overview read model/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient downgrades a degraded control plane to partial", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const payload = url.endsWith("/health")
      ? { ...HEALTH, status: "DEGRADED" }
      : url.endsWith("/v1/robots")
        ? [ROBOT]
        : url.endsWith("/overview")
          ? OVERVIEW
          : url.endsWith("/topology/snapshots")
            ? TOPOLOGY_SNAPSHOTS
          : url.endsWith("/topology")
            ? TOPOLOGY
            : url.includes("/runs?limit=")
              ? RUN_COLLECTION
            : url.includes("/capabilities?limit=")
              ? CAPABILITY_COLLECTION
              : EVIDENCE_COLLECTION;
    return { ok: true, json: async () => payload };
  };
  try {
    const result = await new RoloClient("http://rolo.test").bootstrap();
    assert.equal(result.mode, "partial");
    assert.match(result.issues[0], /degraded health/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient keeps trusted overview data partial when topology fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.endsWith("/health")) return { ok: true, json: async () => HEALTH };
    if (url.endsWith("/v1/robots")) return { ok: true, json: async () => [ROBOT] };
    if (url.endsWith("/overview")) return { ok: true, json: async () => OVERVIEW };
    if (url.endsWith("/topology/snapshots")) return { ok: true, json: async () => TOPOLOGY_SNAPSHOTS };
    if (url.endsWith("/topology")) return { ok: false, status: 503 };
    if (url.includes("/capabilities?limit=")) return { ok: true, json: async () => CAPABILITY_COLLECTION };
    if (url.includes("/runs?limit=")) return { ok: true, json: async () => RUN_COLLECTION };
    return { ok: true, json: async () => EVIDENCE_COLLECTION };
  };
  try {
    const result = await new RoloClient("http://rolo.test").bootstrap();
    assert.equal(result.mode, "partial");
    assert.equal(result.overview.schema_version, "rolo-robot-overview/v2");
    assert.equal(result.topology, null);
    assert.match(result.issues.join(" "), /topology.*HTTP 503/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects an unhealthy control plane", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ...HEALTH, status: "UNHEALTHY" }) });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").bootstrap(),
      (error) => error instanceof RoloApiError && error.code === "HEALTH" && error.path === "/health",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient preserves HTTP failure status", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").health(),
      (error) => error instanceof RoloApiError && error.status === 503,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient requests bounded evidence pages with an authority filter", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      json: async () => ({
        ...EVIDENCE_COLLECTION,
        items: [{ ...EVIDENCE_RECORD, evidence_id: "ev_gated123456789012", authority: "GATED" }],
        total: 5,
        limit: 2,
        offset: 4,
      }),
    };
  };
  try {
    const page = await new RoloClient("http://rolo.test").evidenceCollection(
      "AMR-07",
      undefined,
      { limit: 2, offset: 4, authority: "GATED" },
    );
    assert.equal(requestedUrl, "http://rolo.test/v1/robots/AMR-07/evidence?limit=2&offset=4&authority=GATED");
    assert.equal(page.offset, 4);
    assert.equal(page.items[0].authority, "GATED");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient reads capability coverage and a contract-bound detail", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return { ok: true, json: async () => url.includes("/capabilities/tool.catalog") ? CAPABILITY_DETAIL : CAPABILITY_COLLECTION };
  };
  try {
    const client = new RoloClient("http://rolo.test");
    const coverage = await client.capabilities("AMR-07");
    const detail = await client.capability("AMR-07", "tool.catalog");
    assert.equal(coverage.items[0].availability, "AVAILABLE");
    assert.equal(detail.contract.result_semantics, "OBSERVATION");
    assert.deepEqual(requests, [
      "http://rolo.test/v1/robots/AMR-07/capabilities?limit=100&offset=0",
      "http://rolo.test/v1/robots/AMR-07/capabilities/tool.catalog",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient reads lifecycle runs without raw artifact payloads", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return { ok: true, json: async () => url.endsWith("/runs/run-1") ? RUN_DETAIL : RUN_COLLECTION };
  };
  try {
    const client = new RoloClient("http://rolo.test");
    const collection = await client.runs("AMR-07");
    const detail = await client.run("AMR-07", "run-1");
    assert.equal(collection.items[0].gate_status, "FAILED");
    assert.equal(detail.handoff.status, "MISSING");
    assert.equal(detail.artifacts[0].kind, "gate");
    assert.deepEqual(requests, [
      "http://rolo.test/v1/robots/AMR-07/runs?limit=50&offset=0",
      "http://rolo.test/v1/robots/AMR-07/runs/run-1",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects evidence pages containing another robot", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      ...EVIDENCE_COLLECTION,
      items: [{ ...EVIDENCE_RECORD, robot_id: "OTHER-ROBOT" }],
    }),
  });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").evidenceCollection("AMR-07"),
      (error) => error instanceof RoloContractError && error.path.endsWith("/items/0"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient strips legacy raw blocker evidence references", async () => {
  const originalFetch = globalThis.fetch;
  const rawPath = "C:\\private\\artifacts\\adapter-output.json";
  const escapedPath = rawPath.replaceAll("\\", "\\\\");
  const legacyOverview = {
    ...OVERVIEW,
    schema_version: "rolo-robot-overview/v1",
    pipeline: {
      ...PIPELINE,
      stages: [{
        ...PIPELINE.stages[0],
        prerequisites: [rawPath],
        artifacts: { output: rawPath },
        blockers: [`Adapter output is missing at ${escapedPath}`],
      }],
    },
    blockers: [{
      schema_version: "rolo-blocker-summary/v1",
      blocker_id: "adapt-blocked",
      stage: "adapt",
      message: `Adapter output is missing at ${escapedPath}`,
      recommended_action: `Generate the adapter output at ${escapedPath}`,
      owner: "adapter_agent",
      observed_at: "2026-08-20T00:00:00Z",
      freshness: "fresh",
      source_kind: "pipeline_assessment",
      confidence: 1,
      integrity_status: "validated",
      evidence_refs: [rawPath],
    }],
  };
  globalThis.fetch = async () => ({ ok: true, json: async () => legacyOverview });
  try {
    const result = await new RoloClient("http://rolo.test").overview("AMR-07");
    assert.deepEqual(result.blockers[0].evidence_ids, []);
    assert.equal(result.blockers[0].message, "Adapter output is missing at artifact:adapter-output.json");
    assert.deepEqual(result.pipeline.stages[0].prerequisites, ["artifact:adapter-output.json"]);
    assert.deepEqual(result.pipeline.stages[0].artifacts, { output: "artifact:adapter-output.json" });
    assert.doesNotMatch(JSON.stringify(result), /private/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects an incompatible overview contract", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ schema_version: "unknown/v9" }) });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").overview("AMR-07"),
      (error) => error instanceof RoloContractError && error.path.endsWith("/overview"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects a malformed nested pipeline contract", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ...OVERVIEW, pipeline: { ...PIPELINE, schema_version: "pipeline/v9" } }),
  });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").overview("AMR-07"),
      (error) => error instanceof RoloContractError && error.path.endsWith("/pipeline"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient reads verified topology history and a contract-bound diff", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return {
      ok: true,
      json: async () => url.endsWith("/topology/snapshots") ? TOPOLOGY_SNAPSHOTS : TOPOLOGY_DIFF,
    };
  };
  try {
    const client = new RoloClient("http://rolo.test");
    const snapshots = await client.topologySnapshots("AMR-07");
    const diff = await client.topologyDiff("AMR-07", "topology_snapshot_1", "topology_snapshot_2");
    assert.equal(snapshots.items[1].is_current, true);
    assert.equal(diff.changed_nodes, 1);
    assert.equal(diff.node_changes[0].changed_fields[0], "state");
    assert.deepEqual(requests, [
      "http://rolo.test/v1/robots/AMR-07/topology/snapshots",
      "http://rolo.test/v1/robots/AMR-07/topology/diff?from=topology_snapshot_1&to=topology_snapshot_2",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient reads a contiguous evidence-bound topology path", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return { ok: true, json: async () => TOPOLOGY_PATH };
  };
  try {
    const path = await new RoloClient("http://rolo.test").topologyPath("AMR-07", "robot_1", "adapter_1");
    assert.equal(path.hop_count, 1);
    assert.equal(path.steps[0].evidence_ids[0], EVIDENCE_RECORD.evidence_id);
    assert.deepEqual(urls, ["http://rolo.test/v1/robots/AMR-07/topology/path?from=robot_1&to=adapter_1&max_hops=8"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects a non-contiguous topology path", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ...TOPOLOGY_PATH, steps: [{ ...TOPOLOGY_PATH.steps[0], to_node_id: "robot_1" }] }) });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").topologyPath("AMR-07", "robot_1", "adapter_1"),
      (error) => error instanceof RoloContractError && error.path.includes("/topology/path"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient reads a trust-separated Robot Wiki", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return { ok: true, json: async () => WIKI };
  };
  try {
    const wiki = await new RoloClient("http://rolo.test").wiki("AMR-07");
    assert.equal(wiki.content_origin, "HUMAN_EDITED");
    assert.equal(wiki.content_integrity, "unverified");
    assert.equal(wiki.insights[0].evidence_id, "ev_abcdef123456789012");
    assert.equal(wiki.insights[0].source, "DETERMINISTIC_RULE");
    assert.deepEqual(urls, ["http://rolo.test/v1/robots/AMR-07/wiki"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient preserves Agent Wiki provenance as unverified advisory content", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      ...WIKI,
      insights: [{ ...WIKI.insights[0], source: "ADAPT_AGENT_SKILL" }],
    }),
  });
  try {
    const wiki = await new RoloClient("http://rolo.test").wiki("AMR-07");
    assert.equal(wiki.content_integrity, "unverified");
    assert.equal(wiki.insights[0].source, "ADAPT_AGENT_SKILL");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient reads manifest-verified discovery history", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return { ok: true, json: async () => DISCOVERY_HISTORY };
  };
  try {
    const history = await new RoloClient("http://rolo.test").discoveries("AMR-07");
    assert.equal(history.items[0].is_latest, true);
    assert.equal(history.items[0].operation_candidates, 14);
    assert.equal(history.items[0].heuristic_summary.status, "AGENT_COMPLETED");
    assert.equal(history.items[0].heuristic_summary.influences_release, false);
    assert.deepEqual(urls, ["http://rolo.test/v1/robots/AMR-07/discoveries?limit=100&offset=0"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient preserves discovery history v1 without inventing Agent state", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => DISCOVERY_HISTORY_V1 });
  try {
    const history = await new RoloClient("http://rolo.test").discoveries("AMR-07");
    assert.equal(history.schema_version, "rolo-discovery-snapshot-collection/v1");
    assert.equal(history.items[0].schema_version, "rolo-discovery-snapshot-summary/v1");
    assert.equal("heuristic_summary" in history.items[0], false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient reads bounded target evidence freshness without collector metadata", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => DISCOVERY_HISTORY_V3 });
  try {
    const history = await new RoloClient("http://rolo.test").discoveries("AMR-07");
    const target = history.items[0].target_evidence;
    assert.equal(target.deployment_scope, "REMOTE");
    assert.equal(target.freshness, "STALE");
    assert.equal(target.refresh_required, true);
    assert.equal("collector_id" in target, false);
    assert.equal("expires_at" in target, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects unsafe or inconsistent target evidence summaries", async () => {
  const originalFetch = globalThis.fetch;
  const unsafeOverrides = [
    { collector_id: "private-collector" },
    { expires_at: "2026-08-20T00:05:00Z" },
    { freshness: "FRESH", refresh_required: true },
    { deployment_scope: "CLOUD" },
  ];
  try {
    for (const override of unsafeOverrides) {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          ...DISCOVERY_HISTORY_V3,
          items: [{
            ...DISCOVERY_HISTORY_V3.items[0],
            target_evidence: {
              ...DISCOVERY_HISTORY_V3.items[0].target_evidence,
              ...override,
            },
          }],
        }),
      });
      await assert.rejects(
        () => new RoloClient("http://rolo.test").discoveries("AMR-07"),
        (error) => error instanceof RoloContractError && error.path.includes("/target_evidence"),
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient keeps Agent candidate routes in an unverified capability lane", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () => url.includes("/capabilities/tool.catalog") ? CAPABILITY_DETAIL_V2 : CAPABILITY_COLLECTION_V2,
  });
  try {
    const client = new RoloClient("http://rolo.test");
    const coverage = await client.capabilities("AMR-07");
    const detail = await client.capability("AMR-07", "tool.catalog");
    assert.equal(coverage.items[0].binding_count, 0);
    assert.equal(coverage.items[0].inferred_binding_count, 1);
    assert.equal(coverage.items[0].availability, "UNAVAILABLE");
    assert.equal(detail.bindings.length, 0);
    assert.equal(detail.inferred_bindings[0].verification_status, "DISCOVERED_UNVERIFIED");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects unsafe Agent candidate provenance", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      ...CAPABILITY_COLLECTION_V2,
      items: [{ ...CAPABILITY_SUMMARY_V2, candidate_origin: "AGENT_VERIFIED" }],
    }),
  });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").capabilities("AMR-07"),
      (error) => error instanceof RoloContractError && error.path.includes("/items/0"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient accepts every bounded heuristic discovery status", async () => {
  const originalFetch = globalThis.fetch;
  const summaries = [
    { mode: "shadow", status: "AGENT_COMPLETED", inferred_operation_count: 4, missing_evidence_count: 2 },
    { mode: "enabled", status: "FALLBACK", inferred_operation_count: 1, missing_evidence_count: 3 },
    { mode: "disabled", status: "DISABLED", inferred_operation_count: 0, missing_evidence_count: 0 },
  ];
  try {
    for (const summary of summaries) {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          ...DISCOVERY_HISTORY,
          items: [{
            ...DISCOVERY_HISTORY.items[0],
            heuristic_summary: {
              ...DISCOVERY_HISTORY.items[0].heuristic_summary,
              ...summary,
            },
          }],
        }),
      });
      const history = await new RoloClient("http://rolo.test").discoveries("AMR-07");
      assert.equal(history.items[0].heuristic_summary.status, summary.status);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient fails closed on unsafe heuristic discovery authority", async () => {
  const originalFetch = globalThis.fetch;
  const invalidSummaries = [
    { status: "MODEL_GUESS" },
    { mode: "experimental" },
    { influences_release: true },
    { inferred_operation_count: -1 },
    { heuristic_analysis_ref: "artifact://private/summary.json" },
  ];
  try {
    for (const override of invalidSummaries) {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          ...DISCOVERY_HISTORY,
          items: [{
            ...DISCOVERY_HISTORY.items[0],
            heuristic_summary: {
              ...DISCOVERY_HISTORY.items[0].heuristic_summary,
              ...override,
            },
          }],
        }),
      });
      await assert.rejects(
        () => new RoloClient("http://rolo.test").discoveries("AMR-07"),
        (error) => error instanceof RoloContractError && error.path.includes("/heuristic_summary"),
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects mixed discovery collection and item schemas", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ...DISCOVERY_HISTORY_V1, items: DISCOVERY_HISTORY.items }),
  });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").discoveries("AMR-07"),
      (error) => error instanceof RoloContractError && error.path.includes("/discoveries"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects inconsistent discovery probe coverage", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      ...DISCOVERY_HISTORY,
      items: [{ ...DISCOVERY_HISTORY.items[0], observed_probes: 4 }],
    }),
  });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").discoveries("AMR-07"),
      (error) => error instanceof RoloContractError
        && error.path.includes("/discoveries")
        && error.path.includes("/items/0"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient reads validated Fleet and Blocker Inbox aggregates", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return { ok: true, json: async () => String(url).includes("/blockers") ? FLEET_BLOCKERS : FLEET };
  };
  try {
    const client = new RoloClient("http://rolo.test");
    const [fleet, blockers] = await Promise.all([client.fleet(), client.blockers()]);
    assert.equal(fleet.items[0].state, "ATTENTION");
    assert.equal(blockers.items[0].owner, "adapter_agent");
    assert.deepEqual(urls.sort(), [
      "http://rolo.test/v1/blockers?limit=100&offset=0",
      "http://rolo.test/v1/fleet?limit=100&offset=0",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient preserves Fleet blocker v1 as an explicit basic compatibility contract", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => FLEET_BLOCKERS_V1 });
  try {
    const blockers = await new RoloClient("http://rolo.test").blockers();
    assert.equal(blockers.schema_version, "rolo-fleet-blocker-collection/v1");
    assert.equal(blockers.items[0].schema_version, "rolo-fleet-blocker-summary/v1");
    assert.equal("category" in blockers.items[0], false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects mixed Fleet blocker collection and item schemas", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ...FLEET_BLOCKERS_V1, items: FLEET_BLOCKERS.items }),
  });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").blockers(),
      (error) => error instanceof RoloContractError && error.path.startsWith("/v1/blockers"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects raw paths in the Blocker Inbox", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      ...FLEET_BLOCKERS,
      items: [{ ...FLEET_BLOCKERS.items[0], message: String.raw`Inspect C:\private\adapt.json` }],
    }),
  });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").blockers(),
      (error) => error instanceof RoloContractError && error.path.startsWith("/v1/blockers"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects unsafe Robot Wiki references", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ...WIKI, sections: [{ ...WIKI.sections[0], lines: ["artifact://private/report.json"] }] }) });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").wiki("AMR-07"),
      (error) => error instanceof RoloContractError && error.path.endsWith("/wiki"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects an unknown Robot Wiki insight source", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      ...WIKI,
      insights: [{ ...WIKI.insights[0], source: "MODEL_GUESS" }],
    }),
  });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").wiki("AMR-07"),
      (error) => error instanceof RoloContractError && error.path.includes("/insights/0"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects a dangling topology edge", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      ...TOPOLOGY,
      edges: [{
        schema_version: "rolo-topology-edge/v1",
        edge_id: "edge_1",
        source: "robot_1",
        target: "missing_node",
        relation: "routes_to",
        state: "GATED",
        confidence: 1,
        integrity_status: "verified",
        evidence_ids: [],
      }],
    }),
  });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").topology("AMR-07"),
      (error) => error instanceof RoloContractError && error.path.endsWith("/edges/0"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects a registry payload without versioned capability data", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => [{ robot_id: "AMR-07" }] });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").robots(),
      (error) => error instanceof RoloContractError && error.path.endsWith("/0"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("demo topology is internally connected and spans every product layer", () => {
  const nodeIds = new Set(TOPOLOGY_NODES.map((node) => node.id));
  assert.equal(nodeIds.size, TOPOLOGY_NODES.length);
  assert.deepEqual(
    new Set(TOPOLOGY_NODES.map((node) => node.data.layer)),
    new Set(["Hardware", "Linux", "ROS / Middleware", "Application"]),
  );
  for (const edge of TOPOLOGY_EDGES) {
    assert.ok(nodeIds.has(edge.source), `missing source node ${edge.source}`);
    assert.ok(nodeIds.has(edge.target), `missing target node ${edge.target}`);
  }
});

test("live modes never expose fixture-only workbench surfaces", () => {
  for (const mode of ["live", "partial"]) {
    assert.equal(getSurfaceSource(mode, "overview"), "live");
    assert.equal(getSurfaceSource(mode, "lifecycle"), "live");
    assert.equal(getSurfaceSource(mode, "stack"), "unavailable");
    assert.equal(getSurfaceSource(mode, "capabilities"), "unavailable");
    assert.equal(getSurfaceSource(mode, "evidence"), "unavailable");
    assert.equal(getSurfaceSource(mode, "wiki"), "unavailable");
    assert.equal(getSurfaceSource(mode, "fleet"), "unavailable");
    assert.equal(getSurfaceSource(mode, "stack", { stack: true }), "live");
    assert.equal(getSurfaceSource(mode, "evidence", { evidence: true }), "live");
    assert.equal(getSurfaceSource(mode, "capabilities", { capabilities: true }), "live");
    assert.equal(getSurfaceSource(mode, "wiki", { wiki: true }), "live");
    assert.equal(getSurfaceSource(mode, "fleet", { fleet: true }), "live");
  }
  assert.equal(getSurfaceSource("demo", "stack"), "demo");
  assert.equal(getSurfaceSource("unavailable", "overview"), "unavailable");
});

test("partial overview compatibility copy comes only from trusted pipeline data", () => {
  const partial = getOverviewPresentation("partial", null, "Live pipeline summary");
  const demo = getOverviewPresentation("demo", null, "Ignored live summary");

  assert.deepEqual(partial, {
    title: "Pipeline compatibility",
    summary: "Live pipeline summary",
  });
  assert.doesNotMatch(JSON.stringify(partial), /demo|dependency mismatch/i);
  assert.match(demo.title, /demo/i);
  assert.match(demo.summary, /demo data/i);
});

test("live lifecycle component has no fixture evidence or fabricated handoff", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const start = source.indexOf("function LiveLifecycleView");
  const end = source.indexOf("function EvidenceRow", start);
  assert.ok(start >= 0 && end > start);
  const liveLifecycle = source.slice(start, end);

  assert.doesNotMatch(liveLifecycle, /\bEVIDENCE\b|\bDEMO_|sha256:82f3|adapt-20260820/);
  assert.match(liveLifecycle, /selected\.blockerMessages|selected\.artifactRefs|selected\.observedAt/);
  assert.match(liveLifecycle, /runDetail\.gate_checks|runDetail\.handoff|runDetail\.artifacts/);
});

test("live Stack Map delegates path explanation to the trusted API", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const start = source.indexOf("function StackMapView");
  const end = source.indexOf("interface OverviewViewProps", start);
  const stackMap = source.slice(start, end);

  assert.match(stackMap, /roloClient\.topologyPath/);
  assert.match(stackMap, /physical reachability|pathExplanation\.limitations/);
  assert.doesNotMatch(stackMap, /breadth.first|shortestPath|new Map\(sourceEdges/);
});

test("Fleet Blocker Inbox separates triage category from resolution evidence", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const start = source.indexOf("function FleetView");
  const end = source.indexOf("function StackMapView", start);
  assert.ok(start >= 0 && end > start);
  const fleet = source.slice(start, end);

  assert.match(fleet, /All blocker categories|classification|categoryFilter/);
  assert.match(fleet, /Required to clear|resolution_requirements/);
  assert.match(fleet, /Read-only reproduction path|canonical_cli_argv/);
  assert.match(fleet, /Basic blocker compatibility|No triage meaning is inferred/);
  assert.match(fleet, /rolo-fleet-blocker-collection\/v2|triageAvailable/);
  assert.match(fleet, /contains_secret_payloads|limitations\.join/);
  assert.doesNotMatch(fleet, /fetch\([^)]*artifact|invoke|execute remediation/i);
});

test("Wiki insight cards distinguish rule-derived records from unverified Agent suggestions", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const start = source.indexOf("function WikiView");
  const end = source.indexOf("function EvidenceRow", start);
  assert.ok(start >= 0 && end > start);
  const wiki = source.slice(start, end);

  assert.match(wiki, /Rule-derived/);
  assert.match(wiki, /Agent suggestion · unverified/);
  assert.match(wiki, /insight\.source === "ADAPT_AGENT_SKILL"/);
  assert.doesNotMatch(wiki, /Agent verified|Verified Agent/);
});

test("RoloClient reads a blocker resolution detail without remediation authority", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return { ok: true, json: async () => FLEET_BLOCKER_DETAIL };
  };
  try {
    const detail = await new RoloClient("http://rolo.test").blockerDetail("blocker_123");
    assert.equal(detail.blocker.category, "PIPELINE_BLOCKER");
    assert.equal(detail.resolution_requirements[0].status, "REQUIRED");
    assert.equal(detail.contains_secret_payloads, false);
    assert.deepEqual(urls, ["http://rolo.test/v1/blockers/blocker_123"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Wiki snapshot detail exposes every selected discovery limitation", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const start = source.indexOf("function WikiView");
  const end = source.indexOf("function EvidenceRow", start);
  assert.ok(start >= 0 && end > start);
  const liveWiki = source.slice(start, end);

  assert.match(liveWiki, /selectedDiscovery\.limitations\.map/);
  assert.match(liveWiki, /aria-label="Snapshot limitations"/);
  assert.match(liveWiki, /Diagnostic limitations/);
});

test("Wiki snapshot keeps heuristic analysis in an advisory release-neutral lane", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const wikiStart = source.indexOf("function WikiView");
  const wikiEnd = source.indexOf("function EvidenceRow", wikiStart);
  const capabilityStart = source.indexOf("function LiveCapabilityView");
  const capabilityEnd = source.indexOf("function DemoLifecycleView", capabilityStart);
  assert.ok(wikiStart >= 0 && wikiEnd > wikiStart && capabilityStart >= 0 && capabilityEnd > capabilityStart);
  const liveWiki = source.slice(wikiStart, wikiEnd);
  const liveCapabilities = source.slice(capabilityStart, capabilityEnd);

  assert.match(liveWiki, /Heuristic analysis/);
  assert.match(liveWiki, /Agent analysis completed\. This does not verify any Operation/);
  assert.match(liveWiki, /Release influence/);
  assert.match(liveWiki, /influences_release/);
  assert.doesNotMatch(liveCapabilities, /heuristic_summary|heuristicSummary/);
});

test("Capability UI keeps Agent inferences outside ordinary readiness and bindings", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const start = source.indexOf("function LiveCapabilityView");
  const end = source.indexOf("function DemoLifecycleView", start);
  const readinessStart = source.indexOf("function CapabilityReadinessPanel");
  assert.ok(start >= 0 && end > start && readinessStart >= 0);
  const liveCapabilities = source.slice(start, end);

  assert.match(liveCapabilities, /Agent inferred · unverified/);
  assert.match(liveCapabilities, /bindings=\{detail\.bindings\}/);
  assert.match(liveCapabilities, /InferredBindingPanel bindings=\{detail\.inferred_bindings\}/);
  assert.doesNotMatch(liveCapabilities, /CapabilityReadinessPanel[^>]+inferred_bindings/);
});

test("Wiki target evidence prompt is read-only and exposes no remediation call", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const start = source.indexOf("function WikiView");
  const end = source.indexOf("function EvidenceRow", start);
  assert.ok(start >= 0 && end > start);
  const liveWiki = source.slice(start, end);

  assert.match(liveWiki, /Target-bound evidence/);
  assert.match(liveWiki, /Recollect evidence/);
  assert.match(liveWiki, /outside this read-only workbench/);
  assert.doesNotMatch(liveWiki, /roloClient\.(collect|recollect|targetEvidence)/);
});

test("Adapt Stability keeps baseline, filtering, and run authority drilldown separate", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const start = source.indexOf("function SliceStabilityView");
  const end = source.indexOf("function LiveCapabilityView", start);
  assert.ok(start >= 0 && end > start);
  const stability = source.slice(start, end);

  assert.match(stability, /Protected product baseline|adaptBaseline/);
  assert.match(stability, /filterSliceObservations|Diagnostics only/);
  assert.match(stability, /roloClient\.sliceRunDetail/);
  assert.match(stability, /Authoritative \/ release operations/);
  assert.match(stability, /Comparison only · never release authority/);
  assert.match(stability, /Non-overlapping windows|Observation change/);
  assert.match(stability, /Secret-free evidence summary|Human review packet/);
  assert.match(stability, /No SECRET payload bodies included/);
});

test("plugin manifest declares every trusted read-model endpoint", async () => {
  const manifest = JSON.parse(await readFile(new URL("../rolo.plugin.json", import.meta.url), "utf8"));
  assert.equal(manifest.version, "0.23.0");
  assert.deepEqual(
    new Set(manifest.api.required_endpoints),
    new Set([
      "/health",
      "/v1/fleet",
      "/v1/blockers",
      "/v1/robots",
      "/v1/robots/{robot_id}/overview",
      "/v1/robots/{robot_id}/pipeline",
      "/v1/robots/{robot_id}/topology",
      "/v1/robots/{robot_id}/topology/snapshots",
      "/v1/robots/{robot_id}/topology/diff",
      "/v1/robots/{robot_id}/topology/path",
      "/v1/robots/{robot_id}/capabilities",
      "/v1/robots/{robot_id}/capabilities/{operation}",
      "/v1/robots/{robot_id}/runs",
      "/v1/robots/{robot_id}/runs/{run_id}",
      "/v1/robots/{robot_id}/wiki",
      "/v1/robots/{robot_id}/discoveries",
      "/v1/robots/{robot_id}/episodes",
      "/v1/robots/{robot_id}/episodes/{episode_id}",
      "/v1/robots/{robot_id}/episodes/{episode_id}/revisions",
      "/v1/robots/{robot_id}/episodes/{episode_id}/timeline",
      "/v1/robots/{robot_id}/episode-cohorts",
      "/v1/robots/{robot_id}/evidence",
      "/v1/evidence/{evidence_id}",
    ]),
  );
});
