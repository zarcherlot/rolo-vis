import type {
  AdaptBaselineSnapshot,
  AdaptBaselineStatus,
  BootstrapResult,
  CapabilityCollection,
  CapabilityDetail,
  CapabilitySummary,
  CapabilitySummaryV1,
  CapabilitySummaryV2,
  DiscoverySnapshotCollection,
  DiscoverySnapshotSummary,
  DiscoverySnapshotSummaryV1,
  DiscoverySnapshotSummaryV2,
  DiscoverySnapshotSummaryV3,
  EvidenceAuthority,
  EvidenceCollection,
  EvidenceRecord,
  EpisodeCohort,
  EpisodeObservationBundleCollection,
  EpisodeState,
  FleetSliceStability,
  FleetBlockerCollection,
  FleetBlockerDetail,
  FleetBlockerSummary,
  FleetBlockerSummaryV1,
  FleetBlockerSummaryV2,
  FleetCollection,
  FleetRobotSummary,
  HealthResponse,
  LifecycleRunCollection,
  LifecycleRunDetail,
  LifecycleRunSummary,
  Job,
  JobCheckpoint,
  JobEvent,
  JobEventPage,
  JobPage,
  JobRecovery,
  JobStatus,
  JobSummary,
  OperationGovernanceCollection,
  OperationDisposition,
  PipelineAssessment,
  RobotCapability,
  RobotOverview,
  RobotTopology,
  RobotWikiSnapshot,
  SliceActivationDecision,
  SliceRunDetail,
  SliceRunObservation,
  SliceReviewPacket,
  SliceStabilityComparison,
  SliceStabilityReport,
  StageAssessment,
  TargetOperationSlice,
  TargetOperationSliceShadowReport,
  TopologyDiff,
  TopologyEdge,
  TopologyNode,
  TopologyPathExplanation,
  TopologySnapshotCollection,
  TopologySnapshotSummary,
  TargetReadinessCollection,
  TargetReadinessSummary,
  ApprovalGateCollection,
  ApprovalGateSummary,
} from "./types/rolo";
import { parseCapabilityCollection, parseCapabilityDetail } from "./contracts/capability.ts";
import { parseDiscoverySnapshotCollection } from "./contracts/discovery.ts";
import { parseEpisodeCohort, parseEpisodeCollection, parseEpisodeDetail, parseEpisodeRevisionCollection, parseEpisodeTimelinePage } from "./contracts/episode.ts";
import { parseEpisodeObservationBundleCollection, type EpisodeObservationValidationContext } from "./contracts/episodeObservation.ts";
export { parseApprovalGateSummary, parseApprovalGateCollection, parseTargetReadinessSummary, parseTargetReadinessCollection } from "./contracts/targetReadiness.ts";
import { parseApprovalGateCollection, parseApprovalGateSummary, parseTargetReadinessCollection, parseTargetReadinessSummary } from "./contracts/targetReadiness.ts";
import {
  containsUnsafeReference,
  isConfidence,
  isRecord,
  isStringArray,
  isTimestamp,
  requireContract,
  RoloContractError,
} from "./contracts/guards.ts";

export { RoloContractError } from "./contracts/guards.ts";

const DEFAULT_BASE = "/rolo-api";

export const ROLO_API_FEATURES = {
  adaptBaselineStatus: "adapt.baseline-status/v1",
  fleetSliceStability: "adapt.fleet-slice-stability/v1",
  operationGovernance: "adapt.operation-governance/v1",
  sliceReviewPacket: "adapt.slice-review-packet/v1",
  sliceRunDetail: "adapt.slice-run-detail/v1",
  sliceStabilityComparison: "adapt.slice-stability-comparison/v1",
  sliceStability: "adapt.slice-stability/v1",
  targetOperationSlice: "adapt.target-operation-slice/v1",
  blockerDetail: "workbench.blocker-detail/v1",
  jobReadModel: "workbench.job-read-model/v1",
  targetReadiness: "workbench.target-readiness/v1",
  approvalGateReadModel: "workbench.approval-gate-read-model/v1",
  episodeReadModel: "workbench.episode-read-model/v1",
  episodeRevisionHistory: "workbench.episode-revision-history/v1",
  episodeCohortReadModel: "workbench.episode-cohort-read-model/v1",
  episodeObservationBundle: "workbench.episode-observation-bundle/v1",
} as const;

export function supportsApiFeature(health: HealthResponse, feature: string): boolean {
  return health.api_features.includes(feature);
}

export class RoloApiError extends Error {
  status: number | null;
  path: string;
  code: "HTTP" | "NETWORK" | "ABORTED" | "HEALTH";

  constructor(
    message: string,
    status: number | null,
    path = "",
    code: RoloApiError["code"] = "HTTP",
  ) {
    super(message);
    this.name = "RoloApiError";
    this.status = status;
    this.path = path;
    this.code = code;
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

function isNonNegativeIntegerRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(
    (item) => Number.isInteger(item) && Number(item) >= 0,
  );
}

function isSafeAttributes(value: unknown): value is Record<string, string | number | boolean> {
  return isRecord(value) && Object.values(value).every((item) =>
    typeof item === "string" || typeof item === "number" || typeof item === "boolean"
  );
}

function safeReferenceHint(reference: string): string {
  if (reference.startsWith("artifact:") || reference.startsWith("ev_")) return reference;
  const normalized = reference.replaceAll("\\", "/").replace(/\/+$/, "");
  const basename = normalized.split("/").at(-1) || "withheld";
  return `artifact:${basename}`;
}

function sanitizeArtifactText(text: string, references: string[]): string {
  let sanitized = text;
  const sortedReferences = [...new Set(references)]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  for (const reference of sortedReferences) {
    const candidates = [...new Set([reference.replaceAll("\\", "\\\\"), reference])]
      .sort((left, right) => right.length - left.length);
    for (const candidate of candidates) {
      sanitized = sanitized.replaceAll(candidate, safeReferenceHint(reference));
    }
  }
  return sanitized;
}

function rawStageReferences(pipeline: unknown, stageName: string): string[] {
  if (!isRecord(pipeline) || !Array.isArray(pipeline.stages)) return [];
  const stage = pipeline.stages.find(
    (candidate) => isRecord(candidate) && candidate.stage === stageName,
  );
  if (!isRecord(stage)) return [];
  const prerequisites = isStringArray(stage.prerequisites) ? stage.prerequisites : [];
  const artifacts = isStringRecord(stage.artifacts) ? Object.values(stage.artifacts) : [];
  return [...prerequisites, ...artifacts];
}

function parseHealthResponse(value: unknown, path: string): HealthResponse {
  requireContract(isRecord(value), "health response must be an object", path);
  requireContract(["HEALTHY", "DEGRADED", "UNHEALTHY"].includes(String(value.status)), "invalid health status", path);
  requireContract(typeof value.service === "string" && typeof value.version === "string", "invalid health service identity", path);
  requireContract(Number.isInteger(value.robots) && Number(value.robots) >= 0, "invalid registered robot count", path);
  requireContract(typeof value.robot_use_backend === "string", "missing robot-use backend", path);
  requireContract(typeof value.openai_key_configured === "boolean", "invalid OpenAI key status", path);
  requireContract(value.api_features === undefined || isStringArray(value.api_features), "invalid API feature catalog", path);
  requireContract(isTimestamp(value.timestamp), "invalid health observation time", path);
  return { ...value, api_features: value.api_features || [] } as unknown as HealthResponse;
}

const JOB_STATUSES: JobStatus[] = ["CREATED", "RUNNING", "SUCCEEDED", "FAILED", "BLOCKED"];
const JOB_OPAQUE_MAX_BYTES = 16_384;

function validateJobOpaqueRecord(value: unknown, path: string, label: string): asserts value is Record<string, unknown> {
  requireContract(isRecord(value), `invalid ${label}`, path);
  let serialized = "";
  try {
    serialized = JSON.stringify(value);
  } catch {
    requireContract(false, `invalid ${label}`, path);
  }
  requireContract(new TextEncoder().encode(serialized).length <= JOB_OPAQUE_MAX_BYTES, `${label} exceeds the bounded payload size`, path);
  requireContract(!containsUnsafeReference(value), `${label} contains an unsafe reference`, path);
}

function parseJobEvent(value: unknown, path: string, expectedJobId?: string): JobEvent {
  requireContract(isRecord(value), "job event must be an object", path);
  requireContract(value.schema_version === "rolo-job-event/v1", "unsupported job event schema", path);
  requireContract(typeof value.event_id === "string" && value.event_id.length > 0, "missing job event identity", path);
  requireContract(typeof value.job_id === "string" && (!expectedJobId || value.job_id === expectedJobId), "job event identity does not match request", path);
  requireContract(Number.isInteger(value.sequence) && Number(value.sequence) >= 0, "invalid job event sequence", path);
  requireContract(typeof value.event_type === "string" && value.event_type.length > 0, "invalid job event type", path);
  requireContract(JOB_STATUSES.includes(value.status as JobStatus), "invalid job event status", path);
  requireContract(isTimestamp(value.occurred_at), "invalid job event observation", path);
  validateJobOpaqueRecord(value.payload, `${path}/payload`, "job event payload");
  requireContract(!containsUnsafeReference(value), "job event contains an unsafe reference", path);
  return value as unknown as JobEvent;
}

function parseJobCheckpoint(value: unknown, path: string, expectedJobId?: string): JobCheckpoint {
  requireContract(isRecord(value), "job checkpoint must be an object", path);
  requireContract(value.schema_version === "rolo-job-checkpoint/v1", "unsupported job checkpoint schema", path);
  requireContract(typeof value.checkpoint_id === "string" && value.checkpoint_id.length > 0, "missing job checkpoint identity", path);
  requireContract(typeof value.job_id === "string" && (!expectedJobId || value.job_id === expectedJobId), "job checkpoint identity does not match request", path);
  requireContract(Number.isInteger(value.sequence) && Number(value.sequence) >= 0, "invalid job checkpoint sequence", path);
  validateJobOpaqueRecord(value.state, `${path}/state`, "job checkpoint state");
  requireContract(isTimestamp(value.created_at), "invalid job checkpoint timestamp", path);
  requireContract(!containsUnsafeReference(value), "job checkpoint contains an unsafe reference", path);
  return value as unknown as JobCheckpoint;
}

function parseJob(value: unknown, path: string, expectedJobId?: string): Job {
  requireContract(isRecord(value), "job must be an object", path);
  requireContract(value.schema_version === "rolo-job/v1", "unsupported job schema", path);
  requireContract(typeof value.job_id === "string" && (!expectedJobId || value.job_id === expectedJobId), "job identity does not match request", path);
  requireContract(typeof value.operation === "string" && value.operation.length > 0, "invalid job operation", path);
  requireContract(typeof value.target === "string" && value.target.length > 0, "invalid job target", path);
  requireContract(JOB_STATUSES.includes(value.status as JobStatus), "invalid job status", path);
  requireContract(Number.isInteger(value.revision) && Number(value.revision) >= 0, "invalid job revision", path);
  requireContract(isTimestamp(value.created_at) && isTimestamp(value.updated_at), "invalid job timestamps", path);
  requireContract(!containsUnsafeReference(value), "job contains an unsafe reference", path);
  return value as unknown as Job;
}

function parseJobSummary(value: unknown, path: string): JobSummary {
  requireContract(isRecord(value), "job summary must be an object", path);
  requireContract(value.schema_version === "rolo-job-summary/v1", "unsupported job summary schema", path);
  requireContract(typeof value.job_id === "string" && value.job_id.length > 0, "missing job summary identity", path);
  requireContract(typeof value.operation === "string" && value.operation.length > 0, "invalid job summary operation", path);
  requireContract(typeof value.target === "string" && value.target.length > 0, "invalid job summary target", path);
  requireContract(JOB_STATUSES.includes(value.status as JobStatus), "invalid job summary status", path);
  requireContract(Number.isInteger(value.revision) && Number(value.revision) >= 0, "invalid job summary revision", path);
  requireContract(isTimestamp(value.updated_at), "invalid job summary timestamp", path);
  requireContract(!containsUnsafeReference(value), "job summary contains an unsafe reference", path);
  return value as unknown as JobSummary;
}

function parseJobPage(value: unknown, path: string): JobPage {
  requireContract(isRecord(value), "job page must be an object", path);
  requireContract(value.schema_version === "rolo-job-page/v1", "unsupported job page schema", path);
  requireContract(Array.isArray(value.items), "invalid job page items", path);
  const items = value.items.map((item, index) => parseJobSummary(item, `${path}/items/${index}`));
  requireContract(new Set(items.map((item) => item.job_id)).size === items.length, "job page contains duplicate identities", path);
  requireContract(Number.isInteger(value.total) && Number(value.total) >= items.length, "invalid job page total", path);
  requireContract(Number.isInteger(value.limit) && Number(value.limit) >= 1 && Number(value.limit) <= 100 && items.length <= Number(value.limit), "invalid job page limit", path);
  requireContract(Number.isInteger(value.offset) && Number(value.offset) >= 0, "invalid job page offset", path);
  requireContract(value.next_offset === null || (Number.isInteger(value.next_offset) && Number(value.next_offset) > Number(value.offset) && Number(value.next_offset) <= Number(value.total)), "invalid job page next offset", path);
  requireContract(!containsUnsafeReference(value), "job page contains an unsafe reference", path);
  return { ...value, items } as unknown as JobPage;
}

function parseJobRecovery(value: unknown, path: string, expectedJobId: string): JobRecovery {
  requireContract(isRecord(value), "job recovery must be an object", path);
  requireContract(value.schema_version === "rolo-job-recovery/v1", "unsupported job recovery schema", path);
  const job = parseJob(value.job, `${path}/job`, expectedJobId);
  const latestEvent = value.latest_event === null ? null : parseJobEvent(value.latest_event, `${path}/latest_event`, expectedJobId);
  const latestCheckpoint = value.latest_checkpoint === null ? null : parseJobCheckpoint(value.latest_checkpoint, `${path}/latest_checkpoint`, expectedJobId);
  requireContract(latestEvent === null || latestEvent.sequence <= job.revision, "job recovery event revision exceeds the Job revision", path);
  requireContract(latestCheckpoint === null || latestCheckpoint.sequence <= job.revision, "job recovery checkpoint revision exceeds the Job revision", path);
  requireContract(typeof value.resumable === "boolean" && isStringArray(value.limitations) && value.limitations.length <= 24 && value.limitations.every((item) => item.length <= 400), "invalid job recovery metadata", path);
  requireContract(!containsUnsafeReference(value), "job recovery contains an unsafe reference", path);
  return { ...value, job, latest_event: latestEvent, latest_checkpoint: latestCheckpoint } as unknown as JobRecovery;
}

function parseJobEventPage(value: unknown, path: string, expectedJobId: string): JobEventPage {
  requireContract(isRecord(value), "job event page must be an object", path);
  requireContract(value.schema_version === "rolo-job-event-page/v1" && value.job_id === expectedJobId, "invalid job event page identity", path);
  requireContract(Array.isArray(value.items), "invalid job event page items", path);
  const items = value.items.map((item, index) => parseJobEvent(item, `${path}/items/${index}`, expectedJobId));
  requireContract(new Set(items.map((item) => item.event_id)).size === items.length, "job event page contains duplicate identities", path);
  requireContract(items.every((item, index) => index === 0 || item.sequence >= items[index - 1].sequence), "job event page sequence regressed", path);
  requireContract(Number.isInteger(value.total) && Number(value.total) >= items.length, "invalid job event page total", path);
  requireContract(Number.isInteger(value.limit) && Number(value.limit) >= 1 && Number(value.limit) <= 100 && items.length <= Number(value.limit), "invalid job event page limit", path);
  requireContract(Number.isInteger(value.offset) && Number(value.offset) >= 0, "invalid job event page offset", path);
  requireContract(value.next_offset === null || (Number.isInteger(value.next_offset) && Number(value.next_offset) > Number(value.offset) && Number(value.next_offset) <= Number(value.total)), "invalid job event page next offset", path);
  requireContract(!containsUnsafeReference(value), "job event page contains an unsafe reference", path);
  return { ...value, items } as unknown as JobEventPage;
}

function parseOperationDisposition(value: unknown, path: string): OperationDisposition {
  requireContract(isRecord(value), "operation disposition must be an object", path);
  requireContract(typeof value.current_operation === "string" && value.current_operation.length > 0, "missing current operation", path);
  requireContract(["control", "hw", "linux", "middleware", "ros", "app"].includes(String(value.current_layer)), "invalid current operation layer", path);
  requireContract(["product_control", "hardware", "os", "middleware", "application"].includes(String(value.semantic_layer)), "invalid semantic layer", path);
  requireContract(["AGENT_NATIVE", "PRODUCT_BUILTIN", "TARGET_ADAPTER", "PLATFORM_SPECIFIC"].includes(String(value.execution_class)), "invalid execution class", path);
  requireContract(typeof value.portable_semantics === "boolean", "invalid portable semantics flag", path);
  requireContract(value.future_capability === null || typeof value.future_capability === "string", "invalid future capability", path);
  requireContract(["PLANNED", "RETAINED", "DEFERRED"].includes(String(value.migration_status)), "invalid migration status", path);
  requireContract(typeof value.migration_reason === "string" && value.current_registry_action === "KEEP", "invalid migration metadata", path);
  return value as unknown as OperationDisposition;
}

function parseOperationGovernanceCollection(
  value: unknown,
  path: string,
  expectedPage: { limit: number; offset: number },
): OperationGovernanceCollection {
  requireContract(isRecord(value), "operation governance collection must be an object", path);
  requireContract(value.schema_version === "rolo-operation-governance-collection/v1", "unsupported operation governance schema", path);
  requireContract(Array.isArray(value.items), "invalid operation governance items", path);
  const items = value.items.map((item, index) => parseOperationDisposition(item, `${path}/items/${index}`));
  requireContract(new Set(items.map((item) => item.current_operation)).size === items.length, "operation governance page contains duplicate operations", path);
  requireContract(Number.isInteger(value.total) && Number(value.total) >= items.length, "invalid operation governance total", path);
  requireContract(value.limit === expectedPage.limit && value.offset === expectedPage.offset && items.length <= expectedPage.limit, "operation governance collection does not match the requested page", path);
  requireContract(value.next_offset === null || (Number.isInteger(value.next_offset) && Number(value.next_offset) > Number(value.offset) && Number(value.next_offset) <= Number(value.total)), "invalid operation governance next offset", path);
  requireContract(value.source_kind === "operation_disposition_ledger" && value.influences_registry === false, "invalid operation governance authority", path);
  requireContract(isStringArray(value.limitations), "invalid operation governance limitations", path);
  return { ...value, items } as unknown as OperationGovernanceCollection;
}

function parseTargetOperationSlice(value: unknown, path: string, robotId: string): TargetOperationSlice {
  requireContract(isRecord(value), "target operation slice must be an object", path);
  requireContract(value.schema_version === "robot-target-operation-slice/v1", "unsupported target operation slice schema", path);
  requireContract(value.robot_id === robotId && typeof value.discovery_id === "string", "target operation slice identity does not match", path);
  requireContract(/^[0-9a-f]{64}$/.test(String(value.registry_sha256)) && /^[0-9a-f]{64}$/.test(String(value.slice_sha256)), "invalid target operation slice digest", path);
  for (const key of ["primary_operations", "dependency_operations", "agent_native_operations", "builtin_operations", "target_adapter_operations", "platform_specific_operations"] as const) {
    requireContract(isStringArray(value[key]), `invalid target operation slice ${key}`, path);
  }
  requireContract(isNonNegativeIntegerRecord(value.deferred_summary), "invalid target operation deferred summary", path);
  return value as unknown as TargetOperationSlice;
}

function parseSliceRunObservation(value: unknown, path: string): SliceRunObservation {
  requireContract(isRecord(value), "Slice run observation must be an object", path);
  requireContract(typeof value.run_id === "string" && value.run_id.length > 0, "missing Slice run identity", path);
  requireContract(
    typeof value.decision_ref === "string"
      && /^artifact:\/\/adapt\/[^/]+\/runs\/[^/]+\/slice-activation-decision\.json$/.test(value.decision_ref),
    "invalid Slice decision reference",
    path,
  );
  requireContract(["SHADOW", "CANARY"].includes(String(value.mode)), "invalid Slice activation mode", path);
  requireContract(["SHADOW_ONLY", "NOT_SELECTED", "ACTIVATED", "FALLBACK"].includes(String(value.outcome)), "invalid Slice activation outcome", path);
  requireContract(typeof value.selected === "boolean" && typeof value.affects_agent_context === "boolean", "invalid Slice selection state", path);
  requireContract(value.agent_run_status === null || typeof value.agent_run_status === "string", "invalid Slice agent status", path);
  requireContract(value.gate_status === null || typeof value.gate_status === "string", "invalid Slice gate status", path);
  for (const key of ["authoritative_operation_count", "requested_operation_count", "effective_operation_count"] as const) {
    requireContract(Number.isInteger(value[key]) && Number(value[key]) >= 0, `invalid Slice ${key}`, path);
  }
  for (const key of ["potential_context_reduction_ratio", "effective_context_reduction_ratio"] as const) {
    requireContract(typeof value[key] === "number" && value[key] >= 0 && value[key] <= 1, `invalid Slice ${key}`, path);
  }
  for (const key of ["prompt_token_estimate", "boot_context_token_estimate"] as const) {
    requireContract(value[key] === null || (Number.isInteger(value[key]) && Number(value[key]) >= 0), `invalid Slice ${key}`, path);
  }
  requireContract(value.boot_context_budget_tokens === null || (Number.isInteger(value.boot_context_budget_tokens) && Number(value.boot_context_budget_tokens) > 0), "invalid Slice context budget", path);
  requireContract(typeof value.context_budget_exceeded === "boolean" && isStringArray(value.alert_codes), "invalid Slice alerts or budget state", path);
  requireContract(value.fallback_reason === null || typeof value.fallback_reason === "string", "invalid Slice fallback reason", path);
  return { ...value, decision_ref: safeReferenceHint(value.decision_ref) } as unknown as SliceRunObservation;
}

function parseSliceStabilityReport(value: unknown, path: string, robotId: string): SliceStabilityReport {
  requireContract(isRecord(value), "Slice stability report must be an object", path);
  requireContract(value.schema_version === "robot-target-operation-slice-stability/v1", "unsupported Slice stability schema", path);
  requireContract(value.robot_id === robotId, "Slice stability robot identity does not match", path);
  requireContract(Number.isInteger(value.max_runs) && Number(value.max_runs) > 0 && Number(value.max_runs) <= 100, "invalid Slice observation window", path);
  requireContract(Number.isInteger(value.min_successful_canary_runs) && Number(value.min_successful_canary_runs) > 0 && Number(value.min_successful_canary_runs) <= 100, "invalid Slice Canary threshold", path);
  requireContract(Array.isArray(value.observations), "invalid Slice observations", path);
  const observations = value.observations.map((item, index) => parseSliceRunObservation(item, `${path}/observations/${index}`));
  for (const key of ["observation_count", "selected_canary_count", "activated_count", "fallback_count", "successful_canary_count", "agent_failed_count", "gate_failed_count", "context_budget_exceeded_count"] as const) {
    requireContract(Number.isInteger(value[key]) && Number(value[key]) >= 0, `invalid Slice ${key}`, path);
  }
  requireContract(value.observation_count === observations.length, "Slice observation summary is inconsistent", path);
  requireContract(new Set(observations.map((item) => item.run_id)).size === observations.length, "duplicate Slice run observations", path);
  for (const key of ["average_potential_context_reduction_ratio", "average_effective_context_reduction_ratio"] as const) {
    requireContract(typeof value[key] === "number" && value[key] >= 0 && value[key] <= 1, `invalid Slice ${key}`, path);
  }
  requireContract(isNonNegativeIntegerRecord(value.outcome_counts) && isNonNegativeIntegerRecord(value.alert_counts), "invalid Slice aggregate counts", path);
  requireContract(["INSUFFICIENT_DATA", "HOLD", "READY_FOR_REVIEW"].includes(String(value.recommendation)), "invalid Slice stability recommendation", path);
  requireContract(isStringArray(value.recommendation_reasons), "invalid Slice recommendation reasons", path);
  requireContract(value.influences_release === false, "Slice stability must not influence release", path);
  return { ...value, observations } as unknown as SliceStabilityReport;
}

function parseSliceObservationWindow(value: unknown, path: string, label: "RECENT" | "PREVIOUS") {
  requireContract(isRecord(value) && value.label === label, "invalid Slice comparison window", path);
  for (const key of ["requested_observations", "observation_count", "successful_canary_count", "fallback_count", "agent_failed_count", "gate_failed_count", "context_budget_exceeded_count"] as const) {
    requireContract(Number.isInteger(value[key]) && Number(value[key]) >= (key === "requested_observations" ? 1 : 0), `invalid Slice window ${key}`, path);
  }
  requireContract(Number(value.observation_count) <= Number(value.requested_observations), "Slice comparison window exceeds its bound", path);
  requireContract(value.newest_run_id === null || typeof value.newest_run_id === "string", "invalid newest Slice run", path);
  requireContract(value.oldest_run_id === null || typeof value.oldest_run_id === "string", "invalid oldest Slice run", path);
  requireContract((value.observation_count === 0) === (value.newest_run_id === null && value.oldest_run_id === null), "inconsistent Slice comparison identity", path);
  requireContract(typeof value.average_effective_context_reduction_ratio === "number" && value.average_effective_context_reduction_ratio >= 0 && value.average_effective_context_reduction_ratio <= 1, "invalid Slice reduction ratio", path);
  return value;
}

function parseSliceStabilityComparison(value: unknown, path: string, robotId: string): SliceStabilityComparison {
  requireContract(isRecord(value) && value.schema_version === "rolo-adapt-slice-stability-comparison/v1", "unsupported Slice comparison schema", path);
  requireContract(value.robot_id === robotId && ["NO_PREVIOUS_WINDOW", "PARTIAL", "COMPARABLE"].includes(String(value.status)), "invalid Slice comparison identity or status", path);
  const recent = parseSliceObservationWindow(value.recent, `${path}/recent`, "RECENT");
  const previous = parseSliceObservationWindow(value.previous, `${path}/previous`, "PREVIOUS");
  requireContract(isRecord(value.delta), "invalid Slice comparison delta", path);
  for (const key of ["successful_canary_count", "fallback_count", "agent_failed_count", "gate_failed_count", "context_budget_exceeded_count", "average_effective_context_reduction_ratio"] as const) {
    requireContract(typeof value.delta[key] === "number" && Number.isFinite(value.delta[key]), `invalid Slice delta ${key}`, path);
  }
  requireContract(isStringArray(value.regression_signals) && isStringArray(value.limitations), "invalid Slice comparison signals or limitations", path);
  requireContract(value.source_kind === "immutable_adapt_run_artifacts" && value.influences_release === false, "invalid Slice comparison authority", path);
  return { ...value, recent, previous } as unknown as SliceStabilityComparison;
}

function parseFleetSliceStability(value: unknown, path: string): FleetSliceStability {
  requireContract(isRecord(value) && value.schema_version === "rolo-adapt-fleet-slice-stability/v1", "unsupported Fleet Slice schema", path);
  requireContract(Array.isArray(value.items) && isNonNegativeIntegerRecord(value.recommendation_counts), "invalid Fleet Slice aggregate", path);
  for (const key of ["max_runs_per_robot", "min_successful_canary_runs", "robot_count", "observed_robot_count"] as const) {
    requireContract(Number.isInteger(value[key]) && Number(value[key]) >= (key.includes("runs") ? 1 : 0), `invalid Fleet Slice ${key}`, path);
  }
  for (const [index, item] of value.items.entries()) {
    const itemPath = `${path}/items/${index}`;
    requireContract(isRecord(item) && typeof item.robot_id === "string", "invalid Fleet Slice robot", itemPath);
    requireContract(["INSUFFICIENT_DATA", "HOLD", "READY_FOR_REVIEW"].includes(String(item.recommendation)), "invalid Fleet Slice recommendation", itemPath);
    for (const key of ["observation_count", "successful_canary_count", "fallback_count", "diagnostic_count"] as const) requireContract(Number.isInteger(item[key]) && Number(item[key]) >= 0, `invalid Fleet Slice ${key}`, itemPath);
  }
  requireContract(value.robot_count === value.items.length && value.observed_robot_count === value.items.filter((item) => isRecord(item) && Number(item.observation_count) > 0).length, "inconsistent Fleet Slice counts", path);
  requireContract(value.source_kind === "immutable_adapt_run_artifacts" && value.influences_release === false && isStringArray(value.limitations), "invalid Fleet Slice authority", path);
  return value as unknown as FleetSliceStability;
}

function parseSliceReviewPacket(value: unknown, path: string, robotId: string): SliceReviewPacket {
  requireContract(isRecord(value) && value.schema_version === "rolo-adapt-slice-review-packet/v1", "unsupported Slice review schema", path);
  requireContract(value.robot_id === robotId && ["BLOCKED", "INCOMPLETE", "READY_FOR_HUMAN_REVIEW"].includes(String(value.status)), "invalid Slice review identity or status", path);
  requireContract(["MATCHED", "DRIFTED"].includes(String(value.baseline_status)) && ["INSUFFICIENT_DATA", "HOLD", "READY_FOR_REVIEW"].includes(String(value.stability_recommendation)), "invalid Slice review recommendation", path);
  requireContract(Array.isArray(value.checks), "invalid Slice review checks", path);
  for (const [index, check] of value.checks.entries()) {
    const checkPath = `${path}/checks/${index}`;
    requireContract(isRecord(check) && typeof check.check_id === "string" && typeof check.label === "string" && typeof check.summary === "string", "invalid Slice review check", checkPath);
    requireContract(["PASS", "PENDING", "BLOCKING", "HUMAN_REQUIRED"].includes(String(check.status)), "invalid Slice review check status", checkPath);
  }
  requireContract(isStringArray(value.evidence_run_ids) && isStringArray(value.evidence_refs) && value.evidence_run_ids.length === value.evidence_refs.length, "invalid Slice review evidence", path);
  requireContract(value.evidence_refs.every((reference) => /^artifact:\/\/adapt\/[^/]+\/runs\/[^/]+\/slice-activation-decision\.json$/.test(reference)), "invalid Slice review evidence reference", path);
  const evidenceRefs = value.evidence_refs.map((reference) => safeReferenceHint(reference));
  requireContract(value.contains_secret_payloads === false && value.influences_release === false && isStringArray(value.limitations), "unsafe Slice review packet", path);
  return { ...value, evidence_refs: evidenceRefs } as unknown as SliceReviewPacket;
}

function parseAdaptBaselineSnapshot(value: unknown, path: string): AdaptBaselineSnapshot {
  requireContract(isRecord(value), "Adapt baseline snapshot must be an object", path);
  requireContract(value.schema_version === "robot-adapt-baseline-snapshot/v1", "unsupported Adapt baseline snapshot schema", path);
  requireContract(Number.isInteger(value.operation_count) && Number(value.operation_count) > 0, "invalid Adapt baseline operation count", path);
  requireContract(Number.isInteger(value.disposition_count) && Number(value.disposition_count) > 0, "invalid Adapt baseline disposition count", path);
  for (const key of ["contract_catalog_sha256", "registry_sha256", "operation_identity_sha256"] as const) {
    requireContract(/^[0-9a-f]{64}$/.test(String(value[key])), `invalid Adapt baseline ${key}`, path);
  }
  return value as unknown as AdaptBaselineSnapshot;
}

function parseAdaptBaselineStatus(value: unknown, path: string): AdaptBaselineStatus {
  requireContract(isRecord(value), "Adapt baseline status must be an object", path);
  requireContract(value.schema_version === "rolo-adapt-baseline-status/v1", "unsupported Adapt baseline status schema", path);
  const pinned = parseAdaptBaselineSnapshot(value.pinned, `${path}/pinned`);
  const current = parseAdaptBaselineSnapshot(value.current, `${path}/current`);
  requireContract(["MATCHED", "DRIFTED"].includes(String(value.status)), "invalid Adapt baseline status", path);
  requireContract(isStringArray(value.changed_fields), "invalid Adapt baseline changed fields", path);
  const expected = ["operation_count", "disposition_count", "contract_catalog_sha256", "registry_sha256", "operation_identity_sha256"]
    .filter((key) => pinned[key as keyof AdaptBaselineSnapshot] !== current[key as keyof AdaptBaselineSnapshot])
    .sort();
  requireContract(JSON.stringify(value.changed_fields) === JSON.stringify(expected), "inconsistent Adapt baseline drift", path);
  requireContract(value.status === (expected.length ? "DRIFTED" : "MATCHED"), "inconsistent Adapt baseline status", path);
  requireContract(value.source_kind === "protected_product_baseline" && value.influences_release === false, "invalid Adapt baseline authority", path);
  requireContract(isStringArray(value.limitations), "invalid Adapt baseline limitations", path);
  return { ...value, pinned, current } as unknown as AdaptBaselineStatus;
}

function parseSliceActivationDecision(value: unknown, path: string, robotId: string, runId: string): SliceActivationDecision {
  requireContract(isRecord(value), "Slice activation decision must be an object", path);
  requireContract(value.schema_version === "robot-target-operation-slice-activation/v1", "unsupported Slice activation schema", path);
  requireContract(value.robot_id === robotId && (value.run_id === null || value.run_id === runId), "Slice activation identity does not match", path);
  requireContract(/^[0-9a-f]{64}$/.test(String(value.slice_sha256)), "invalid Slice activation digest", path);
  requireContract(["SHADOW", "CANARY"].includes(String(value.mode)) && ["SHADOW_ONLY", "NOT_SELECTED", "ACTIVATED", "FALLBACK"].includes(String(value.outcome)), "invalid Slice activation state", path);
  requireContract(typeof value.selected === "boolean" && typeof value.affects_agent_context === "boolean", "invalid Slice activation selection", path);
  for (const key of ["selected_by", "authoritative_eligible_operations", "requested_context_operations", "effective_context_operations", "release_authority_operations"] as const) {
    requireContract(isStringArray(value[key]), `invalid Slice activation ${key}`, path);
  }
  requireContract(JSON.stringify(value.release_authority_operations) === JSON.stringify(value.authoritative_eligible_operations), "Slice activation changed release authority", path);
  requireContract(Number.isInteger(value.max_context_operations) && Number(value.max_context_operations) > 0, "invalid Slice context operation limit", path);
  requireContract(Array.isArray(value.alerts), "invalid Slice activation alerts", path);
  for (const [index, alert] of value.alerts.entries()) {
    const alertPath = `${path}/alerts/${index}`;
    requireContract(isRecord(alert), "Slice activation alert must be an object", alertPath);
    requireContract(typeof alert.code === "string" && alert.code.length > 0, "missing Slice alert code", alertPath);
    requireContract(["WARNING", "BLOCKING"].includes(String(alert.severity)) && typeof alert.message === "string", "invalid Slice alert severity or message", alertPath);
    requireContract(isStringArray(alert.operations), "invalid Slice alert operations", alertPath);
  }
  requireContract(value.fallback_reason === null || typeof value.fallback_reason === "string", "invalid Slice fallback reason", path);
  requireContract(value.influences_release === false, "Slice activation must not influence release", path);
  return value as unknown as SliceActivationDecision;
}

function parseSliceShadow(value: unknown, path: string, robotId: string, sliceDigest: string): TargetOperationSliceShadowReport {
  requireContract(isRecord(value), "Slice shadow report must be an object", path);
  requireContract(value.schema_version === "robot-target-operation-slice-shadow/v1", "unsupported Slice shadow schema", path);
  requireContract(value.robot_id === robotId && typeof value.discovery_id === "string", "Slice shadow identity does not match", path);
  requireContract(value.slice_sha256 === sliceDigest, "Slice shadow digest does not match activation", path);
  for (const key of ["authoritative_eligible_operations", "shadow_target_adapter_operations", "eligible_not_in_shadow", "shadow_not_in_eligible"] as const) {
    requireContract(isStringArray(value[key]), `invalid Slice shadow ${key}`, path);
  }
  requireContract(value.influences_release === false, "Slice shadow must not influence release", path);
  return value as unknown as TargetOperationSliceShadowReport;
}

function parseSliceRunDetail(value: unknown, path: string, robotId: string, runId: string): SliceRunDetail {
  requireContract(isRecord(value), "Slice run detail must be an object", path);
  requireContract(value.schema_version === "rolo-adapt-slice-run-detail/v1", "unsupported Slice run detail schema", path);
  requireContract(value.robot_id === robotId && value.run_id === runId, "Slice run detail identity does not match", path);
  const observation = parseSliceRunObservation(value.observation, `${path}/observation`);
  requireContract(observation.run_id === runId, "Slice observation run identity does not match", path);
  const activation = parseSliceActivationDecision(value.activation, `${path}/activation`, robotId, runId);
  const shadow = value.shadow === null ? null : parseSliceShadow(value.shadow, `${path}/shadow`, robotId, activation.slice_sha256);
  requireContract(value.source_kind === "immutable_adapt_run_artifacts" && value.integrity_status === "validated", "invalid Slice run evidence source", path);
  requireContract(value.influences_release === false && isStringArray(value.limitations), "invalid Slice run authority or limitations", path);
  return { ...value, observation, activation, shadow } as unknown as SliceRunDetail;
}

function parseRobotCapabilities(value: unknown, path: string): RobotCapability[] {
  requireContract(Array.isArray(value), "robot registry must be an array", path);
  const robotIds = new Set<string>();
  for (const [index, robot] of value.entries()) {
    const itemPath = `${path}/${index}`;
    requireContract(isRecord(robot), "robot capability must be an object", itemPath);
    requireContract(typeof robot.schema_version === "string" && robot.schema_version.length > 0, "missing robot capability schema", itemPath);
    requireContract(typeof robot.robot_id === "string" && robot.robot_id.length > 0, "missing robot identity", itemPath);
    requireContract(!robotIds.has(robot.robot_id), "duplicate robot identity", itemPath);
    robotIds.add(robot.robot_id);
    requireContract(typeof robot.adapter === "string", "missing robot adapter", itemPath);
    requireContract(isRecord(robot.platform) && isRecord(robot.geometry), "invalid robot platform or geometry", itemPath);
    requireContract(isRecord(robot.sensors) && isRecord(robot.features), "invalid robot sensors or features", itemPath);
  }
  return value as RobotCapability[];
}

function parseStageAssessment(value: unknown, path: string, robotId: string): StageAssessment {
  requireContract(isRecord(value), "stage assessment must be an object", path);
  requireContract(value.schema_version === "robot-stage-assessment/v1", "unsupported stage assessment schema", path);
  requireContract(["adapt", "diagnose", "verify"].includes(String(value.stage)), "invalid pipeline stage", path);
  requireContract(value.robot_id === robotId, "stage robot identity does not match pipeline", path);
  requireContract(["NOT_STARTED", "BLOCKED", "DEGRADED", "READY", "COMPLETE"].includes(String(value.status)), "invalid stage status", path);
  requireContract(typeof value.summary === "string" && typeof value.optional === "boolean", "invalid stage summary or optional flag", path);
  requireContract(isStringArray(value.prerequisites) && isStringRecord(value.artifacts), "invalid stage prerequisites or artifacts", path);
  requireContract(isStringArray(value.blockers), "invalid stage blockers", path);
  requireContract(["adapter_agent", "diagnosis_agent", "verification_agent"].includes(String(value.agent_requirement)), "invalid stage owner", path);
  requireContract(isTimestamp(value.observed_at), "invalid stage observation time", path);
  const references = [...value.prerequisites, ...Object.values(value.artifacts)];
  return {
    ...value,
    summary: sanitizeArtifactText(value.summary, references),
    prerequisites: value.prerequisites.map(safeReferenceHint),
    artifacts: Object.fromEntries(
      Object.entries(value.artifacts).map(([name, reference]) => [name, safeReferenceHint(reference)]),
    ),
    blockers: value.blockers.map((blocker) => sanitizeArtifactText(blocker, references)),
  } as unknown as StageAssessment;
}

function parsePipelineAssessment(value: unknown, path: string, expectedRobotId?: string): PipelineAssessment {
  requireContract(isRecord(value), "pipeline assessment must be an object", path);
  requireContract(value.schema_version === "robot-three-stage-pipeline/v1", "unsupported pipeline schema", path);
  requireContract(typeof value.robot_id === "string" && value.robot_id.length > 0, "missing pipeline robot identity", path);
  requireContract(!expectedRobotId || value.robot_id === expectedRobotId, "pipeline robot identity does not match request", path);
  requireContract(Array.isArray(value.stages), "pipeline stages must be an array", path);
  const stages = value.stages.map((stage, index) => parseStageAssessment(stage, `${path}/stages/${index}`, value.robot_id as string));
  requireContract(new Set(stages.map((stage) => stage.stage)).size === stages.length, "pipeline contains duplicate stages", path);
  requireContract(isTimestamp(value.observed_at), "invalid pipeline observation time", path);
  return { ...value, stages } as unknown as PipelineAssessment;
}

function parseRobotOverview(value: unknown, path: string, expectedRobotId?: string): RobotOverview {
  requireContract(isRecord(value), "robot overview must be an object", path);
  if (!["rolo-robot-overview/v1", "rolo-robot-overview/v2"].includes(String(value.schema_version))) {
    throw new RoloContractError("unsupported or missing robot overview schema", path);
  }
  requireContract(typeof value.robot_id === "string" && value.robot_id.length > 0, "missing robot overview identity", path);
  requireContract(!expectedRobotId || value.robot_id === expectedRobotId, "overview robot identity does not match request", path);
  requireContract(["READY", "ATTENTION", "DEGRADED", "NOT_READY"].includes(String(value.state)), "invalid overview state", path);
  requireContract(typeof value.summary === "string" && typeof value.next_action === "string", "invalid overview summary or action", path);
  requireContract(Array.isArray(value.blockers), "overview blockers must be an array", path);
  const pipeline = parsePipelineAssessment(value.pipeline, `${path}/pipeline`, value.robot_id);
  const blockers = value.blockers.map((blocker, index) => {
    const blockerPath = `${path}/blockers/${index}`;
    requireContract(isRecord(blocker), "overview blocker must be an object", blockerPath);
    requireContract(["rolo-blocker-summary/v1", "rolo-blocker-summary/v2"].includes(String(blocker.schema_version)), "unsupported blocker schema", blockerPath);
    requireContract(typeof blocker.blocker_id === "string" && typeof blocker.stage === "string", "invalid blocker identity", blockerPath);
    requireContract(typeof blocker.message === "string" && typeof blocker.recommended_action === "string", "invalid blocker guidance", blockerPath);
    requireContract(typeof blocker.owner === "string" && isTimestamp(blocker.observed_at), "invalid blocker ownership or time", blockerPath);
    requireContract(blocker.freshness === "fresh" && blocker.source_kind === "pipeline_assessment", "invalid blocker provenance", blockerPath);
    requireContract(typeof blocker.confidence === "number" && blocker.confidence >= 0 && blocker.confidence <= 1, "invalid blocker confidence", blockerPath);
    const evidenceIds = blocker.schema_version === "rolo-blocker-summary/v2"
      ? blocker.evidence_ids
      : [];
    requireContract(blocker.integrity_status === "validated" && isStringArray(evidenceIds), "invalid blocker integrity or evidence", blockerPath);
    const references = [
      ...(isStringArray(blocker.evidence_refs) ? blocker.evidence_refs : []),
      ...rawStageReferences(value.pipeline, blocker.stage),
    ];
    const safeBlocker = { ...blocker };
    delete safeBlocker.evidence_refs;
    return {
      ...safeBlocker,
      message: sanitizeArtifactText(blocker.message, references),
      recommended_action: sanitizeArtifactText(blocker.recommended_action, references),
      evidence_ids: evidenceIds,
    };
  });
  requireContract(isTimestamp(value.observed_at), "invalid overview observation time", path);
  requireContract(value.freshness === "fresh" && value.source_kind === "computed_read_model", "invalid overview provenance", path);
  requireContract(typeof value.confidence === "number" && value.confidence >= 0 && value.confidence <= 1, "invalid overview confidence", path);
  requireContract(value.integrity_status === "validated", "invalid overview integrity", path);
  return { ...value, blockers, pipeline } as unknown as RobotOverview;
}

function parseRobotTopology(value: unknown, path: string, expectedRobotId: string): RobotTopology {
  requireContract(isRecord(value), "robot topology must be an object", path);
  requireContract(value.schema_version === "rolo-robot-topology/v1", "unsupported robot topology schema", path);
  requireContract(value.robot_id === expectedRobotId, "topology robot identity does not match request", path);
  requireContract(typeof value.snapshot_id === "string" && value.snapshot_id.length > 0, "missing topology snapshot identity", path);
  requireContract(["REGISTRY_ONLY", "GATED_RELEASE"].includes(String(value.coverage)), "invalid topology coverage", path);
  requireContract(Array.isArray(value.nodes) && Array.isArray(value.edges), "topology nodes and edges must be arrays", path);
  const nodeIds = new Set<string>();
  for (const [index, node] of value.nodes.entries()) {
    const nodePath = `${path}/nodes/${index}`;
    requireContract(isRecord(node), "topology node must be an object", nodePath);
    requireContract(node.schema_version === "rolo-topology-node/v1", "unsupported topology node schema", nodePath);
    requireContract(typeof node.node_id === "string" && !nodeIds.has(node.node_id), "invalid or duplicate topology node identity", nodePath);
    nodeIds.add(node.node_id);
    requireContract(typeof node.kind === "string" && typeof node.label === "string" && typeof node.subtitle === "string", "invalid topology node presentation", nodePath);
    requireContract(["Hardware", "Linux", "Middleware", "Application"].includes(String(node.layer)), "invalid topology layer", nodePath);
    requireContract(["DECLARED", "OBSERVED", "GATED", "PARTIAL", "FAILED"].includes(String(node.state)), "invalid topology node state", nodePath);
    requireContract(isConfidence(node.confidence), "invalid topology node confidence", nodePath);
    requireContract(["validated", "verified"].includes(String(node.integrity_status)), "invalid topology node integrity", nodePath);
    requireContract(isStringArray(node.evidence_ids) && isSafeAttributes(node.attributes), "invalid topology node evidence or attributes", nodePath);
  }
  for (const [index, edge] of value.edges.entries()) {
    const edgePath = `${path}/edges/${index}`;
    requireContract(isRecord(edge), "topology edge must be an object", edgePath);
    requireContract(edge.schema_version === "rolo-topology-edge/v1", "unsupported topology edge schema", edgePath);
    requireContract(typeof edge.edge_id === "string" && typeof edge.relation === "string", "invalid topology edge identity", edgePath);
    requireContract(typeof edge.source === "string" && nodeIds.has(edge.source), "topology edge source is missing", edgePath);
    requireContract(typeof edge.target === "string" && nodeIds.has(edge.target), "topology edge target is missing", edgePath);
    requireContract(["DECLARED", "OBSERVED", "GATED", "PARTIAL", "FAILED"].includes(String(edge.state)), "invalid topology edge state", edgePath);
    requireContract(isConfidence(edge.confidence) && isStringArray(edge.evidence_ids), "invalid topology edge confidence or evidence", edgePath);
    requireContract(["validated", "verified"].includes(String(edge.integrity_status)), "invalid topology edge integrity", edgePath);
  }
  requireContract(isTimestamp(value.observed_at) && ["fresh", "unknown"].includes(String(value.freshness)), "invalid topology observation metadata", path);
  requireContract(["robot_registry", "gated_state_graph"].includes(String(value.source_kind)), "invalid topology source", path);
  requireContract(isConfidence(value.confidence) && ["validated", "verified"].includes(String(value.integrity_status)), "invalid topology trust metadata", path);
  requireContract(isStringArray(value.limitations), "invalid topology limitations", path);
  return value as unknown as RobotTopology;
}

function parseTopologySnapshotSummary(value: unknown, path: string): TopologySnapshotSummary {
  requireContract(isRecord(value), "topology snapshot summary must be an object", path);
  requireContract(value.schema_version === "rolo-topology-snapshot-summary/v1", "unsupported topology snapshot summary schema", path);
  requireContract(typeof value.snapshot_id === "string" && value.snapshot_id.length > 0, "missing topology snapshot identity", path);
  requireContract(typeof value.release_id === "string" && value.release_id.length > 0, "missing topology release identity", path);
  requireContract(isTimestamp(value.published_at), "invalid topology snapshot time", path);
  requireContract(Number.isInteger(value.node_count) && Number(value.node_count) >= 0, "invalid topology snapshot node count", path);
  requireContract(Number.isInteger(value.edge_count) && Number(value.edge_count) >= 0, "invalid topology snapshot edge count", path);
  requireContract(value.coverage === "GATED_RELEASE" && value.integrity_status === "verified", "topology snapshot is not verified", path);
  requireContract(typeof value.is_current === "boolean", "invalid current topology marker", path);
  return value as unknown as TopologySnapshotSummary;
}

function parseTopologySnapshotCollection(value: unknown, path: string, robotId: string): TopologySnapshotCollection {
  requireContract(isRecord(value), "topology snapshot collection must be an object", path);
  requireContract(value.schema_version === "rolo-topology-snapshot-collection/v1", "unsupported topology snapshot collection schema", path);
  requireContract(value.robot_id === robotId && Array.isArray(value.items), "invalid topology snapshot collection identity or items", path);
  const items = value.items.map((item, index) => parseTopologySnapshotSummary(item, `${path}/items/${index}`));
  requireContract(new Set(items.map((item) => item.snapshot_id)).size === items.length, "duplicate topology snapshot identity", path);
  requireContract(Number.isInteger(value.total) && Number(value.total) === items.length, "invalid topology snapshot total", path);
  requireContract(isTimestamp(value.observed_at) && value.freshness === "unknown", "invalid topology snapshot observation metadata", path);
  requireContract(isStringArray(value.limitations), "invalid topology snapshot limitations", path);
  return { ...value, items } as unknown as TopologySnapshotCollection;
}

function parseDiffNode(value: unknown, path: string): TopologyNode {
  requireContract(isRecord(value), "topology diff node must be an object", path);
  requireContract(value.schema_version === "rolo-topology-node/v1" && typeof value.node_id === "string", "invalid topology diff node identity", path);
  requireContract(typeof value.kind === "string" && typeof value.label === "string" && typeof value.subtitle === "string", "invalid topology diff node presentation", path);
  requireContract(["Hardware", "Linux", "Middleware", "Application"].includes(String(value.layer)), "invalid topology diff node layer", path);
  requireContract(["DECLARED", "OBSERVED", "GATED", "PARTIAL", "FAILED"].includes(String(value.state)), "invalid topology diff node state", path);
  requireContract(isConfidence(value.confidence) && ["validated", "verified"].includes(String(value.integrity_status)), "invalid topology diff node trust metadata", path);
  requireContract(isStringArray(value.evidence_ids) && isSafeAttributes(value.attributes), "invalid topology diff node evidence or attributes", path);
  return value as unknown as TopologyNode;
}

function parseDiffEdge(value: unknown, path: string): TopologyEdge {
  requireContract(isRecord(value), "topology diff edge must be an object", path);
  requireContract(value.schema_version === "rolo-topology-edge/v1" && typeof value.edge_id === "string", "invalid topology diff edge identity", path);
  requireContract(typeof value.source === "string" && typeof value.target === "string" && typeof value.relation === "string", "invalid topology diff edge relationship", path);
  requireContract(["DECLARED", "OBSERVED", "GATED", "PARTIAL", "FAILED"].includes(String(value.state)), "invalid topology diff edge state", path);
  requireContract(isConfidence(value.confidence) && ["validated", "verified"].includes(String(value.integrity_status)), "invalid topology diff edge trust metadata", path);
  requireContract(isStringArray(value.evidence_ids), "invalid topology diff edge evidence", path);
  return value as unknown as TopologyEdge;
}

function parseTopologyDiff(
  value: unknown,
  path: string,
  robotId: string,
  fromSnapshotId: string,
  toSnapshotId: string,
): TopologyDiff {
  requireContract(isRecord(value), "topology diff must be an object", path);
  requireContract(value.schema_version === "rolo-topology-diff/v1" && value.robot_id === robotId, "invalid topology diff identity", path);
  const fromSnapshot = parseTopologySnapshotSummary(value.from_snapshot, `${path}/from_snapshot`);
  const toSnapshot = parseTopologySnapshotSummary(value.to_snapshot, `${path}/to_snapshot`);
  requireContract(fromSnapshot.snapshot_id === fromSnapshotId && toSnapshot.snapshot_id === toSnapshotId, "topology diff does not match requested snapshots", path);
  const countKeys = ["added_nodes", "removed_nodes", "changed_nodes", "added_edges", "removed_edges", "changed_edges"] as const;
  requireContract(countKeys.every((key) => Number.isInteger(value[key]) && Number(value[key]) >= 0), "invalid topology diff counts", path);
  requireContract(Array.isArray(value.node_changes) && Array.isArray(value.edge_changes), "invalid topology diff changes", path);
  const changes = ["ADDED", "REMOVED", "CHANGED"];
  const nodeChanges = value.node_changes.map((item, index) => {
    const itemPath = `${path}/node_changes/${index}`;
    requireContract(isRecord(item) && item.schema_version === "rolo-topology-node-change/v1", "invalid topology node change", itemPath);
    requireContract(typeof item.node_id === "string" && changes.includes(String(item.change)), "invalid topology node change identity", itemPath);
    requireContract(isStringArray(item.changed_fields), "invalid topology node changed fields", itemPath);
    const before = item.before === null ? null : parseDiffNode(item.before, `${itemPath}/before`);
    const after = item.after === null ? null : parseDiffNode(item.after, `${itemPath}/after`);
    requireContract((item.change === "ADDED" && before === null && after?.node_id === item.node_id) || (item.change === "REMOVED" && before?.node_id === item.node_id && after === null) || (item.change === "CHANGED" && before?.node_id === item.node_id && after?.node_id === item.node_id && item.changed_fields.length > 0), "inconsistent topology node change", itemPath);
    return { ...item, before, after };
  });
  const edgeChanges = value.edge_changes.map((item, index) => {
    const itemPath = `${path}/edge_changes/${index}`;
    requireContract(isRecord(item) && item.schema_version === "rolo-topology-edge-change/v1", "invalid topology edge change", itemPath);
    requireContract(typeof item.edge_id === "string" && changes.includes(String(item.change)), "invalid topology edge change identity", itemPath);
    requireContract(isStringArray(item.changed_fields), "invalid topology edge changed fields", itemPath);
    const before = item.before === null ? null : parseDiffEdge(item.before, `${itemPath}/before`);
    const after = item.after === null ? null : parseDiffEdge(item.after, `${itemPath}/after`);
    requireContract((item.change === "ADDED" && before === null && after?.edge_id === item.edge_id) || (item.change === "REMOVED" && before?.edge_id === item.edge_id && after === null) || (item.change === "CHANGED" && before?.edge_id === item.edge_id && after?.edge_id === item.edge_id && item.changed_fields.length > 0), "inconsistent topology edge change", itemPath);
    return { ...item, before, after };
  });
  requireContract(isTimestamp(value.observed_at) && value.freshness === "unknown" && value.integrity_status === "verified", "invalid topology diff trust metadata", path);
  requireContract(isStringArray(value.limitations), "invalid topology diff limitations", path);
  return { ...value, from_snapshot: fromSnapshot, to_snapshot: toSnapshot, node_changes: nodeChanges, edge_changes: edgeChanges } as unknown as TopologyDiff;
}

function parseTopologyPath(
  value: unknown,
  path: string,
  robotId: string,
  fromNodeId: string,
  toNodeId: string,
): TopologyPathExplanation {
  requireContract(isRecord(value) && value.schema_version === "rolo-topology-path-explanation/v1", "invalid topology path explanation", path);
  requireContract(value.robot_id === robotId && typeof value.snapshot_id === "string" && Boolean(value.snapshot_id), "topology path robot or snapshot does not match request", path);
  requireContract(value.from_node_id === fromNodeId && value.to_node_id === toNodeId, "topology path endpoints do not match request", path);
  requireContract(typeof value.found === "boolean" && Number.isInteger(value.hop_count) && Number(value.hop_count) >= 0 && Number(value.hop_count) <= 12, "invalid topology path result", path);
  requireContract(Array.isArray(value.nodes) && value.nodes.length <= 13 && Array.isArray(value.steps) && value.steps.length <= 12, "invalid topology path bounds", path);
  const pathNodes = value.nodes;
  const pathSteps = value.steps;
  const nodeIds = new Set<string>();
  for (const [index, node] of pathNodes.entries()) {
    const nodePath = `${path}/nodes/${index}`;
    requireContract(isRecord(node) && node.schema_version === "rolo-topology-node/v1", "invalid topology path node", nodePath);
    requireContract(typeof node.node_id === "string" && !nodeIds.has(node.node_id), "invalid or duplicate topology path node", nodePath);
    nodeIds.add(node.node_id);
    requireContract(typeof node.kind === "string" && typeof node.label === "string" && typeof node.subtitle === "string", "invalid topology path node presentation", nodePath);
    requireContract(["Hardware", "Linux", "Middleware", "Application"].includes(String(node.layer)) && ["DECLARED", "OBSERVED", "GATED", "PARTIAL", "FAILED"].includes(String(node.state)), "invalid topology path node state", nodePath);
    requireContract(isConfidence(node.confidence) && ["validated", "verified"].includes(String(node.integrity_status)), "invalid topology path node trust", nodePath);
    requireContract(isStringArray(node.evidence_ids) && isSafeAttributes(node.attributes), "invalid topology path node evidence", nodePath);
  }
  for (const [index, step] of pathSteps.entries()) {
    const stepPath = `${path}/steps/${index}`;
    requireContract(isRecord(step) && step.schema_version === "rolo-topology-path-step/v1" && step.index === index, "invalid topology path step", stepPath);
    requireContract(typeof step.from_node_id === "string" && typeof step.to_node_id === "string" && nodeIds.has(step.from_node_id) && nodeIds.has(step.to_node_id), "topology path step references an unknown node", stepPath);
    requireContract(typeof step.edge_id === "string" && typeof step.relation === "string" && ["FORWARD", "REVERSE"].includes(String(step.direction)), "invalid topology path relationship", stepPath);
    requireContract(["DECLARED", "OBSERVED", "GATED", "PARTIAL", "FAILED"].includes(String(step.state)) && isConfidence(step.confidence), "invalid topology path relationship state", stepPath);
    requireContract(["validated", "verified"].includes(String(step.integrity_status)) && isStringArray(step.evidence_ids), "invalid topology path relationship evidence", stepPath);
  }
  requireContract(value.found ? pathSteps.length === value.hop_count && pathNodes.length === value.hop_count + 1 : pathSteps.length === 0 && pathNodes.length === 0, "inconsistent topology path result", path);
  if (value.found) {
    requireContract(isRecord(pathNodes[0]) && pathNodes[0].node_id === fromNodeId && isRecord(pathNodes.at(-1)) && pathNodes.at(-1)?.node_id === toNodeId, "topology path nodes do not bind the requested endpoints", path);
    requireContract(pathSteps.every((step, index) => isRecord(step) && isRecord(pathNodes[index]) && isRecord(pathNodes[index + 1]) && step.from_node_id === pathNodes[index].node_id && step.to_node_id === pathNodes[index + 1].node_id), "topology path steps are not contiguous", path);
  }
  requireContract(typeof value.summary === "string" && isTimestamp(value.observed_at) && ["fresh", "unknown"].includes(String(value.freshness)), "invalid topology path observation metadata", path);
  requireContract(value.source_kind === "topology_path_projection" && isConfidence(value.confidence) && ["validated", "verified"].includes(String(value.integrity_status)), "invalid topology path trust metadata", path);
  requireContract(isStringArray(value.limitations) && !containsUnsafeReference(value), "invalid topology path limitations or references", path);
  return value as unknown as TopologyPathExplanation;
}

function parseEvidenceRecord(
  value: unknown,
  path: string,
  expectedId?: string,
  expectedRobotId?: string,
): EvidenceRecord {
  requireContract(isRecord(value), "evidence record must be an object", path);
  requireContract(value.schema_version === "rolo-evidence-record/v1", "unsupported evidence record schema", path);
  requireContract(typeof value.evidence_id === "string" && (!expectedId || value.evidence_id === expectedId), "evidence identity does not match request", path);
  requireContract(typeof value.robot_id === "string" && (!expectedRobotId || value.robot_id === expectedRobotId), "evidence robot identity does not match request", path);
  requireContract(typeof value.title === "string" && typeof value.summary === "string", "invalid evidence title or summary", path);
  requireContract(["DECLARED", "OBSERVED", "GATED"].includes(String(value.authority)), "invalid evidence authority", path);
  requireContract(["robot_manifest", "gated_artifact", "pipeline_artifact", "lifecycle_run", "lifecycle_gate", "lifecycle_handoff", "wiki_insight", "wiki_diff", "episode_record", "episode_event", "episode_asset", "episode_finding"].includes(String(value.source_kind)), "invalid evidence source", path);
  requireContract(["validated", "verified"].includes(String(value.integrity_status)) && value.classification === "INTERNAL", "invalid evidence integrity or classification", path);
  requireContract(isTimestamp(value.observed_at) && ["fresh", "unknown"].includes(String(value.freshness)) && isConfidence(value.confidence), "invalid evidence observation metadata", path);
  requireContract(typeof value.reference_hint === "string" && /^[0-9a-f]{64}$/.test(String(value.reference_digest)), "invalid evidence reference metadata", path);
  requireContract(isStringArray(value.related_node_ids) && isStringArray(value.limitations), "invalid evidence relationships or limitations", path);
  return value as unknown as EvidenceRecord;
}

function parseEvidenceCollection(
  value: unknown,
  path: string,
  robotId: string,
  expectedPage?: { limit: number; offset: number; authority?: EvidenceAuthority },
): EvidenceCollection {
  requireContract(isRecord(value), "evidence collection must be an object", path);
  requireContract(value.schema_version === "rolo-evidence-collection/v1", "unsupported evidence collection schema", path);
  requireContract(value.robot_id === robotId && Array.isArray(value.items), "invalid evidence collection identity or items", path);
  const items = value.items.map((item, index) => parseEvidenceRecord(item, `${path}/items/${index}`, undefined, robotId));
  requireContract(new Set(items.map((item) => item.evidence_id)).size === items.length, "evidence collection contains duplicate identities", path);
  requireContract(Number.isInteger(value.total) && Number(value.total) >= items.length, "invalid evidence collection total", path);
  requireContract(Number.isInteger(value.limit) && Number(value.limit) >= 1 && Number(value.limit) <= 100, "invalid evidence collection limit", path);
  requireContract(items.length <= Number(value.limit), "evidence collection exceeds its page limit", path);
  requireContract(Number.isInteger(value.offset) && Number(value.offset) >= 0, "invalid evidence collection offset", path);
  requireContract(!expectedPage || (value.limit === expectedPage.limit && value.offset === expectedPage.offset), "evidence collection does not match the requested page", path);
  requireContract(!expectedPage?.authority || items.every((item) => item.authority === expectedPage.authority), "evidence collection does not match the requested authority", path);
  requireContract(value.next_offset === null || (Number.isInteger(value.next_offset) && Number(value.next_offset) > Number(value.offset) && Number(value.next_offset) <= Number(value.total)), "invalid evidence collection next offset", path);
  requireContract(isTimestamp(value.observed_at) && ["fresh", "unknown"].includes(String(value.freshness)), "invalid evidence collection observation metadata", path);
  return { ...value, items } as unknown as EvidenceCollection;
}

function parseLifecycleRunSummary(value: unknown, path: string, robotId: string): LifecycleRunSummary {
  requireContract(isRecord(value), "lifecycle run summary must be an object", path);
  requireContract(value.schema_version === "rolo-lifecycle-run-summary/v1", "unsupported lifecycle run schema", path);
  requireContract(value.robot_id === robotId && typeof value.run_id === "string", "invalid lifecycle run identity", path);
  requireContract(["adapt", "diagnose", "verify"].includes(String(value.stage)), "invalid lifecycle run stage", path);
  requireContract(["RUNNING", "SUCCEEDED", "FAILED", "GATED", "UNKNOWN"].includes(String(value.status)), "invalid lifecycle run status", path);
  requireContract(["PASSED", "FAILED", "NOT_AVAILABLE"].includes(String(value.gate_status)), "invalid lifecycle gate status", path);
  requireContract(["VERIFIED", "INVALID", "MISSING"].includes(String(value.handoff_status)), "invalid lifecycle handoff status", path);
  requireContract(value.started_at === null || isTimestamp(value.started_at), "invalid lifecycle start time", path);
  requireContract(value.completed_at === null || isTimestamp(value.completed_at), "invalid lifecycle completion time", path);
  requireContract(value.duration_s === null || (typeof value.duration_s === "number" && value.duration_s >= 0), "invalid lifecycle duration", path);
  requireContract(Number.isInteger(value.gate_check_count) && Number(value.gate_check_count) >= 0, "invalid lifecycle gate count", path);
  requireContract(isStringArray(value.evidence_ids) && isConfidence(value.confidence), "invalid lifecycle evidence or confidence", path);
  requireContract(["validated", "verified", "unresolved"].includes(String(value.integrity_status)) && isStringArray(value.limitations), "invalid lifecycle integrity or limitations", path);
  return value as unknown as LifecycleRunSummary;
}

function parseLifecycleRunCollection(value: unknown, path: string, robotId: string): LifecycleRunCollection {
  requireContract(isRecord(value), "lifecycle run collection must be an object", path);
  requireContract(value.schema_version === "rolo-lifecycle-run-collection/v1", "unsupported lifecycle collection schema", path);
  requireContract(value.robot_id === robotId && Array.isArray(value.items), "invalid lifecycle collection identity or items", path);
  const items = value.items.map((item, index) => parseLifecycleRunSummary(item, `${path}/items/${index}`, robotId));
  requireContract(new Set(items.map((item) => `${item.stage}:${item.run_id}`)).size === items.length, "duplicate lifecycle run identity", path);
  requireContract(Number.isInteger(value.total) && Number(value.total) >= items.length, "invalid lifecycle collection total", path);
  requireContract(Number.isInteger(value.limit) && Number(value.limit) >= 1 && Number(value.limit) <= 100 && items.length <= Number(value.limit), "invalid lifecycle page limit", path);
  requireContract(Number.isInteger(value.offset) && Number(value.offset) >= 0, "invalid lifecycle page offset", path);
  requireContract(value.next_offset === null || (Number.isInteger(value.next_offset) && Number(value.next_offset) > Number(value.offset)), "invalid lifecycle next offset", path);
  requireContract(isTimestamp(value.observed_at) && ["fresh", "unknown"].includes(String(value.freshness)), "invalid lifecycle observation metadata", path);
  requireContract(value.source_kind === "lifecycle_artifacts" && isStringArray(value.limitations), "invalid lifecycle source metadata", path);
  return { ...value, items } as unknown as LifecycleRunCollection;
}

function parseLifecycleRunDetail(value: unknown, path: string, robotId: string, runId: string): LifecycleRunDetail {
  requireContract(isRecord(value) && value.schema_version === "rolo-lifecycle-run-detail/v1", "unsupported lifecycle detail schema", path);
  const run = parseLifecycleRunSummary(value.run, `${path}/run`, robotId);
  requireContract(run.run_id === runId, "lifecycle detail does not match requested run", path);
  requireContract(Array.isArray(value.gate_checks) && Array.isArray(value.artifacts), "invalid lifecycle detail collections", path);
  for (const [index, check] of value.gate_checks.entries()) {
    const checkPath = `${path}/gate_checks/${index}`;
    requireContract(isRecord(check) && check.schema_version === "rolo-lifecycle-gate-check/v1", "invalid lifecycle gate check", checkPath);
    requireContract(typeof check.check_id === "string" && typeof check.label === "string", "invalid lifecycle gate check identity", checkPath);
    requireContract(["PASSED", "FAILED", "UNKNOWN"].includes(String(check.status)) && ["OBSERVED", "GATED"].includes(String(check.authority)), "invalid lifecycle gate check state", checkPath);
  }
  requireContract(isRecord(value.handoff) && value.handoff.schema_version === "rolo-lifecycle-handoff-summary/v1", "invalid lifecycle handoff", path);
  requireContract(["VERIFIED", "INVALID", "MISSING"].includes(String(value.handoff.status)) && ["GATED", "OBSERVED", "NONE"].includes(String(value.handoff.authority)), "invalid lifecycle handoff state", path);
  requireContract(value.handoff.digest === null || /^[0-9a-f]{64}$/.test(String(value.handoff.digest)), "invalid lifecycle handoff digest", path);
  requireContract(isStringArray(value.handoff.limitations), "invalid lifecycle handoff limitations", path);
  for (const [index, artifact] of value.artifacts.entries()) {
    const artifactPath = `${path}/artifacts/${index}`;
    requireContract(isRecord(artifact) && artifact.schema_version === "rolo-lifecycle-artifact-summary/v1", "invalid lifecycle artifact", artifactPath);
    requireContract(typeof artifact.name === "string" && ["agent_run", "gate", "handoff", "summary"].includes(String(artifact.kind)), "invalid lifecycle artifact identity", artifactPath);
    requireContract(["validated", "verified", "unresolved"].includes(String(artifact.integrity_status)), "invalid lifecycle artifact integrity", artifactPath);
    requireContract(/^[0-9a-f]{64}$/.test(String(artifact.reference_digest)), "invalid lifecycle artifact digest", artifactPath);
  }
  requireContract(isTimestamp(value.observed_at) && ["fresh", "unknown"].includes(String(value.freshness)), "invalid lifecycle detail observation metadata", path);
  return { ...value, run } as unknown as LifecycleRunDetail;
}

function parseRobotWiki(value: unknown, path: string, robotId: string): RobotWikiSnapshot {
  requireContract(isRecord(value), "robot Wiki must be an object", path);
  requireContract(value.schema_version === "rolo-robot-wiki/v1", "unsupported robot Wiki schema", path);
  requireContract(value.robot_id === robotId && typeof value.discovery_id === "string" && Boolean(value.discovery_id), "robot Wiki identity does not match request", path);
  requireContract(typeof value.discovery_status === "string" && Boolean(value.discovery_status), "invalid robot Wiki discovery status", path);
  requireContract(isTimestamp(value.created_at) && isTimestamp(value.observed_at), "invalid robot Wiki timestamps", path);
  requireContract(["GENERATED_MATCH", "HUMAN_EDITED", "MISSING"].includes(String(value.content_origin)), "invalid robot Wiki content origin", path);
  requireContract(["validated", "unverified", "unavailable"].includes(String(value.content_integrity)), "invalid robot Wiki content integrity", path);
  const expectedIntegrity = value.content_origin === "GENERATED_MATCH"
    ? "validated"
    : value.content_origin === "HUMAN_EDITED" ? "unverified" : "unavailable";
  requireContract(value.content_integrity === expectedIntegrity, "inconsistent robot Wiki narrative trust", path);

  requireContract(Array.isArray(value.sections) && value.sections.length <= 24, "invalid robot Wiki sections", path);
  for (const [index, section] of value.sections.entries()) {
    const sectionPath = `${path}/sections/${index}`;
    requireContract(isRecord(section) && section.schema_version === "rolo-wiki-section/v1", "invalid robot Wiki section", sectionPath);
    requireContract(typeof section.heading === "string" && Boolean(section.heading), "invalid robot Wiki section heading", sectionPath);
    requireContract(isStringArray(section.lines) && section.lines.length <= 30 && section.lines.every((line) => line.length <= 400), "invalid robot Wiki section lines", sectionPath);
  }

  requireContract(Array.isArray(value.layers) && value.layers.length === 5, "invalid robot Wiki layer summaries", path);
  const layerNames = ["Hardware", "Linux", "Middleware", "Application", "Dependencies"];
  for (const [index, layer] of value.layers.entries()) {
    const layerPath = `${path}/layers/${index}`;
    requireContract(isRecord(layer) && layer.schema_version === "rolo-wiki-layer-summary/v1", "invalid robot Wiki layer", layerPath);
    requireContract(layerNames.includes(String(layer.layer)) && ["OBSERVED", "PARTIAL", "UNAVAILABLE", "UNKNOWN"].includes(String(layer.status)), "invalid robot Wiki layer state", layerPath);
    requireContract(typeof layer.summary === "string" && isSafeAttributes(layer.facts), "invalid robot Wiki layer facts", layerPath);
  }
  requireContract(new Set(value.layers.map((layer) => isRecord(layer) ? layer.layer : null)).size === value.layers.length, "duplicate robot Wiki layers", path);

  requireContract(Array.isArray(value.insights) && value.insights.length <= 40, "invalid robot Wiki insights", path);
  for (const [index, insight] of value.insights.entries()) {
    const insightPath = `${path}/insights/${index}`;
    requireContract(isRecord(insight) && insight.schema_version === "rolo-wiki-insight-summary/v1", "invalid robot Wiki insight", insightPath);
    requireContract(["SAFETY", "ARCHITECTURE", "HARDWARE", "OPERATIONS", "MAINTENANCE"].includes(String(insight.category)), "invalid robot Wiki insight category", insightPath);
    requireContract(typeof insight.statement === "string" && typeof insight.verification === "string", "invalid robot Wiki insight text", insightPath);
    requireContract(["LOW", "MEDIUM"].includes(String(insight.confidence)) && ["DETERMINISTIC_RULE", "ADAPT_AGENT_SKILL"].includes(String(insight.source)), "invalid robot Wiki insight provenance", insightPath);
    requireContract(typeof insight.evidence_id === "string" && insight.evidence_id.startsWith("ev_"), "invalid robot Wiki insight evidence", insightPath);
  }

  requireContract(["NO_BASELINE", "UNCHANGED", "CHANGED"].includes(String(value.diff_status)), "invalid robot Wiki diff status", path);
  requireContract(value.baseline_discovery_id === null || typeof value.baseline_discovery_id === "string", "invalid robot Wiki baseline", path);
  requireContract(Array.isArray(value.changes) && value.changes.length <= 12, "invalid robot Wiki changes", path);
  for (const [index, change] of value.changes.entries()) {
    const changePath = `${path}/changes/${index}`;
    requireContract(isRecord(change) && change.schema_version === "rolo-wiki-change-summary/v1", "invalid robot Wiki change", changePath);
    requireContract(["PLATFORM", "ROS", "APPLICATION", "HARDWARE", "OPERATION", "UNKNOWN"].includes(String(change.category)), "invalid robot Wiki change category", changePath);
    requireContract(isStringArray(change.added) && change.added.length <= 40 && isStringArray(change.removed) && change.removed.length <= 40 && isStringArray(change.changed) && change.changed.length <= 20, "invalid robot Wiki change values", changePath);
    requireContract(typeof change.evidence_id === "string" && change.evidence_id.startsWith("ev_"), "invalid robot Wiki change evidence", changePath);
  }

  requireContract(value.freshness === "unknown" && value.source_kind === "verified_discovery_snapshot" && value.integrity_status === "verified", "invalid robot Wiki trust metadata", path);
  requireContract(isConfidence(value.confidence) && isStringArray(value.limitations), "invalid robot Wiki confidence or limitations", path);
  requireContract(!containsUnsafeReference(value), "robot Wiki contains an unsafe reference", path);
  return value as unknown as RobotWikiSnapshot;
}

function parseFleetRobotSummary(value: unknown, path: string): FleetRobotSummary {
  requireContract(isRecord(value) && value.schema_version === "rolo-fleet-robot-summary/v1", "invalid fleet robot summary", path);
  requireContract(typeof value.robot_id === "string" && Boolean(value.robot_id) && typeof value.adapter === "string", "invalid fleet robot identity", path);
  requireContract(typeof value.architecture === "string" && typeof value.ros_distro === "string", "invalid fleet robot platform", path);
  requireContract(["READY", "ATTENTION", "DEGRADED", "NOT_READY"].includes(String(value.state)), "invalid fleet robot state", path);
  requireContract(value.active_stage === null || ["adapt", "diagnose", "verify"].includes(String(value.active_stage)), "invalid fleet active stage", path);
  requireContract(value.active_status === null || ["NOT_STARTED", "BLOCKED", "DEGRADED", "READY", "COMPLETE"].includes(String(value.active_status)), "invalid fleet active status", path);
  requireContract(Number.isInteger(value.blocker_count) && Number(value.blocker_count) >= 0 && typeof value.next_action === "string", "invalid fleet blocker summary", path);
  requireContract(isTimestamp(value.observed_at) && value.freshness === "fresh" && value.source_kind === "computed_robot_overview", "invalid fleet robot observation metadata", path);
  requireContract(isConfidence(value.confidence) && value.integrity_status === "validated", "invalid fleet robot trust metadata", path);
  return value as unknown as FleetRobotSummary;
}

function parseFleetCollection(value: unknown, path: string): FleetCollection {
  requireContract(isRecord(value) && value.schema_version === "rolo-fleet-collection/v1" && Array.isArray(value.items), "invalid fleet collection", path);
  const items = value.items.map((item, index) => parseFleetRobotSummary(item, `${path}/items/${index}`));
  requireContract(new Set(items.map((item) => item.robot_id)).size === items.length, "duplicate robot in fleet collection", path);
  requireContract(Number.isInteger(value.total) && Number(value.total) >= items.length, "invalid fleet total", path);
  requireContract(Number.isInteger(value.limit) && Number(value.limit) >= 1 && Number(value.limit) <= 100 && items.length <= Number(value.limit), "invalid fleet page limit", path);
  requireContract(Number.isInteger(value.offset) && Number(value.offset) >= 0 && (value.next_offset === null || (Number.isInteger(value.next_offset) && Number(value.next_offset) > Number(value.offset))), "invalid fleet page offset", path);
  const countKeys = ["ready", "attention", "degraded", "not_ready", "blocker_count"] as const;
  requireContract(countKeys.every((key) => Number.isInteger(value[key]) && Number(value[key]) >= 0), "invalid fleet counts", path);
  requireContract(Number(value.ready) + Number(value.attention) + Number(value.degraded) + Number(value.not_ready) >= items.length, "fleet state counts do not cover the page", path);
  requireContract(isTimestamp(value.observed_at) && value.freshness === "fresh" && value.source_kind === "computed_fleet_overviews", "invalid fleet observation metadata", path);
  requireContract(isConfidence(value.confidence) && value.integrity_status === "validated", "invalid fleet trust metadata", path);
  requireContract(!containsUnsafeReference(value), "fleet collection contains an unsafe reference", path);
  return { ...value, items } as unknown as FleetCollection;
}

function parseFleetBlockerSummary(value: unknown, path: string): FleetBlockerSummary {
  requireContract(isRecord(value) && ["rolo-fleet-blocker-summary/v1", "rolo-fleet-blocker-summary/v2"].includes(String(value.schema_version)), "invalid fleet blocker", path);
  requireContract(typeof value.blocker_id === "string" && Boolean(value.blocker_id) && typeof value.robot_id === "string" && Boolean(value.robot_id), "invalid fleet blocker identity", path);
  requireContract(["adapt", "diagnose", "verify"].includes(String(value.stage)), "invalid fleet blocker stage", path);
  requireContract(typeof value.message === "string" && typeof value.recommended_action === "string" && typeof value.owner === "string", "invalid fleet blocker guidance", path);
  requireContract(isStringArray(value.evidence_ids) && value.evidence_ids.every((item) => item.startsWith("ev_")), "invalid fleet blocker evidence", path);
  requireContract(isTimestamp(value.observed_at) && value.freshness === "fresh" && value.source_kind === "pipeline_assessment", "invalid fleet blocker observation metadata", path);
  requireContract(isConfidence(value.confidence) && value.integrity_status === "validated", "invalid fleet blocker trust metadata", path);
  if (value.schema_version === "rolo-fleet-blocker-summary/v1") return value as unknown as FleetBlockerSummaryV1;
  requireContract(["MISSING_VERIFIED_EVIDENCE", "EVIDENCE_UNAVAILABLE_OR_INVALID", "POLICY_OR_AUTHORIZATION", "DEPENDENCY_OR_PREREQUISITE", "PIPELINE_BLOCKER"].includes(String(value.category)), "invalid fleet blocker category", path);
  requireContract(value.classification_basis === "normalized_pipeline_message" && typeof value.impact === "string", "invalid fleet blocker classification", path);
  requireContract(Number.isInteger(value.resolution_requirement_count) && Number(value.resolution_requirement_count) >= 1, "invalid blocker resolution count", path);
  return value as unknown as FleetBlockerSummaryV2;
}

function parseFleetBlockerCollection(value: unknown, path: string): FleetBlockerCollection {
  requireContract(isRecord(value) && ["rolo-fleet-blocker-collection/v1", "rolo-fleet-blocker-collection/v2"].includes(String(value.schema_version)) && Array.isArray(value.items), "invalid fleet blocker collection", path);
  const items = value.items.map((item, index) => parseFleetBlockerSummary(item, `${path}/items/${index}`));
  const expectedItemSchema = value.schema_version === "rolo-fleet-blocker-collection/v2" ? "rolo-fleet-blocker-summary/v2" : "rolo-fleet-blocker-summary/v1";
  requireContract(items.every((item) => item.schema_version === expectedItemSchema), "fleet blocker item schema does not match collection", path);
  requireContract(new Set(items.map((item) => item.blocker_id)).size === items.length, "duplicate blocker in fleet collection", path);
  requireContract(Number.isInteger(value.total) && Number(value.total) >= items.length, "invalid fleet blocker total", path);
  requireContract(Number.isInteger(value.limit) && Number(value.limit) >= 1 && Number(value.limit) <= 100 && items.length <= Number(value.limit), "invalid fleet blocker page limit", path);
  requireContract(Number.isInteger(value.offset) && Number(value.offset) >= 0 && (value.next_offset === null || (Number.isInteger(value.next_offset) && Number(value.next_offset) > Number(value.offset))), "invalid fleet blocker page offset", path);
  requireContract(isTimestamp(value.observed_at) && value.freshness === "fresh" && value.source_kind === "computed_pipeline_blockers", "invalid fleet blocker collection metadata", path);
  requireContract(isConfidence(value.confidence) && value.integrity_status === "validated", "invalid fleet blocker collection trust", path);
  if (value.schema_version === "rolo-fleet-blocker-collection/v2") requireContract(isStringArray(value.limitations), "invalid fleet blocker limitations", path);
  requireContract(!containsUnsafeReference(value), "fleet blocker collection contains an unsafe reference", path);
  return { ...value, items } as unknown as FleetBlockerCollection;
}

function parseFleetBlockerDetail(value: unknown, path: string, blockerId: string): FleetBlockerDetail {
  requireContract(isRecord(value) && value.schema_version === "rolo-fleet-blocker-detail/v1", "invalid fleet blocker detail", path);
  const blocker = parseFleetBlockerSummary(value.blocker, `${path}/blocker`);
  requireContract(blocker.schema_version === "rolo-fleet-blocker-summary/v2", "blocker detail requires triage v2", path);
  requireContract(blocker.blocker_id === blockerId, "fleet blocker detail identity does not match", path);
  requireContract(["NOT_STARTED", "BLOCKED", "DEGRADED", "READY", "COMPLETE"].includes(String(value.stage_status)) && typeof value.stage_summary === "string", "invalid blocker stage context", path);
  requireContract(JSON.stringify(value.expected_stage_statuses) === JSON.stringify(["READY", "COMPLETE"]), "invalid blocker resolution target", path);
  requireContract(Array.isArray(value.resolution_requirements) && value.resolution_requirements.length === blocker.resolution_requirement_count, "invalid blocker resolution requirements", path);
  for (const [index, requirement] of value.resolution_requirements.entries()) {
    const requirementPath = `${path}/resolution_requirements/${index}`;
    requireContract(isRecord(requirement) && typeof requirement.requirement_id === "string" && typeof requirement.statement === "string", "invalid blocker resolution requirement", requirementPath);
    requireContract(["FRESH_ASSESSMENT", "VALIDATED_EVIDENCE"].includes(String(requirement.kind)) && requirement.status === "REQUIRED", "invalid blocker resolution requirement state", requirementPath);
    requireContract(requirement.evidence_id === null || (typeof requirement.evidence_id === "string" && requirement.evidence_id.startsWith("ev_")), "invalid blocker resolution evidence", requirementPath);
  }
  requireContract(new Set(value.resolution_requirements.map((item) => isRecord(item) ? item.requirement_id : "")).size === value.resolution_requirements.length, "duplicate blocker resolution requirement", path);
  requireContract(JSON.stringify(value.canonical_cli_argv) === JSON.stringify(["robotctl", "pipeline-status", "--robot", blocker.robot_id]), "invalid blocker reproduction CLI", path);
  requireContract(value.resolution_state === "OPEN" && value.contains_secret_payloads === false, "invalid blocker resolution authority", path);
  requireContract(value.source_kind === "pipeline_assessment" && value.integrity_status === "validated" && isStringArray(value.limitations), "invalid blocker detail trust metadata", path);
  requireContract(!containsUnsafeReference(value), "fleet blocker detail contains an unsafe reference", path);
  return { ...value, blocker } as unknown as FleetBlockerDetail;
}

export class RoloClient {
  baseUrl: string;

  constructor(baseUrl = import.meta.env?.VITE_ROLO_API_BASE || DEFAULT_BASE) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: { Accept: "application/json", ...options.headers },
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      throw new RoloApiError(
        aborted ? "rolo request timed out" : "rolo is unreachable",
        null,
        path,
        aborted ? "ABORTED" : "NETWORK",
      );
    }
    if (!response.ok) {
      throw new RoloApiError(`rolo request failed: ${response.status}`, response.status, path);
    }
    try {
      return await response.json() as T;
    } catch {
      throw new RoloContractError("response is not valid JSON", path);
    }
  }

  async health(options?: RequestInit) {
    const path = "/health";
    return parseHealthResponse(await this.request<unknown>(path, options), path);
  }

  async jobs(
    options?: RequestInit,
    page: { limit?: number; offset?: number } = {},
  ): Promise<JobPage> {
    const limit = page.limit ?? 100;
    const offset = page.offset ?? 0;
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const path = `/v1/jobs?${query.toString()}`;
    return parseJobPage(await this.request<unknown>(path, options), path);
  }

  async job(jobId: string, options?: RequestInit): Promise<JobRecovery> {
    const path = `/v1/jobs/${encodeURIComponent(jobId)}`;
    return parseJobRecovery(await this.request<unknown>(path, options), path, jobId);
  }

  async jobEvents(
    jobId: string,
    options?: RequestInit,
    page: { limit?: number; offset?: number } = {},
  ): Promise<JobEventPage> {
    const limit = page.limit ?? 100;
    const offset = page.offset ?? 0;
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const path = `/v1/jobs/${encodeURIComponent(jobId)}/events?${query.toString()}`;
    return parseJobEventPage(await this.request<unknown>(path, options), path, jobId);
  }

  async targetReadiness(
    options?: RequestInit,
    page: { limit?: number; offset?: number } = {},
  ): Promise<TargetReadinessCollection> {
    const limit = page.limit ?? 100;
    const offset = page.offset ?? 0;
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const path = `/v1/targets/readiness?${query.toString()}`;
    return parseTargetReadinessCollection(await this.request<unknown>(path, options), path, { limit, offset });
  }

  async targetReadinessDetail(targetId: string, options?: RequestInit): Promise<TargetReadinessSummary> {
    const path = `/v1/targets/${encodeURIComponent(targetId)}/readiness`;
    return parseTargetReadinessSummary(await this.request<unknown>(path, options), path);
  }

  async approvalGates(
    options?: RequestInit,
    page: { limit?: number; offset?: number } = {},
  ): Promise<ApprovalGateCollection> {
    const limit = page.limit ?? 100;
    const offset = page.offset ?? 0;
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const path = `/v1/approval-gates?${query.toString()}`;
    return parseApprovalGateCollection(await this.request<unknown>(path, options), path, { limit, offset });
  }

  async jobApprovalGate(jobId: string, options?: RequestInit): Promise<ApprovalGateSummary> {
    const path = `/v1/jobs/${encodeURIComponent(jobId)}/approval-gate`;
    return parseApprovalGateSummary(await this.request<unknown>(path, options), path);
  }

  async robots(options?: RequestInit) {
    const path = "/v1/robots";
    return parseRobotCapabilities(await this.request<unknown>(path, options), path);
  }

  async pipeline(robotId: string, options?: RequestInit) {
    const path = `/v1/robots/${encodeURIComponent(robotId)}/pipeline`;
    return parsePipelineAssessment(await this.request<unknown>(path, options), path, robotId);
  }

  async overview(robotId: string, options?: RequestInit) {
    const path = `/v1/robots/${encodeURIComponent(robotId)}/overview`;
    const payload = await this.request<unknown>(path, options);
    return parseRobotOverview(payload, path, robotId);
  }

  async topology(robotId: string, options?: RequestInit) {
    const path = `/v1/robots/${encodeURIComponent(robotId)}/topology`;
    return parseRobotTopology(await this.request<unknown>(path, options), path, robotId);
  }

  async fleet(options?: RequestInit) {
    const path = "/v1/fleet?limit=100&offset=0";
    return parseFleetCollection(await this.request<unknown>(path, options), path);
  }

  async blockers(options?: RequestInit) {
    const path = "/v1/blockers?limit=100&offset=0";
    return parseFleetBlockerCollection(await this.request<unknown>(path, options), path);
  }

  async topologySnapshots(robotId: string, options?: RequestInit) {
    const path = `/v1/robots/${encodeURIComponent(robotId)}/topology/snapshots`;
    return parseTopologySnapshotCollection(
      await this.request<unknown>(path, options),
      path,
      robotId,
    );
  }

  async topologyDiff(
    robotId: string,
    fromSnapshotId: string,
    toSnapshotId: string,
    options?: RequestInit,
  ) {
    const query = new URLSearchParams({ from: fromSnapshotId, to: toSnapshotId });
    const path = `/v1/robots/${encodeURIComponent(robotId)}/topology/diff?${query.toString()}`;
    return parseTopologyDiff(
      await this.request<unknown>(path, options),
      path,
      robotId,
      fromSnapshotId,
      toSnapshotId,
    );
  }

  async topologyPath(
    robotId: string,
    fromNodeId: string,
    toNodeId: string,
    options?: RequestInit,
  ) {
    const query = new URLSearchParams({ from: fromNodeId, to: toNodeId, max_hops: "8" });
    const path = `/v1/robots/${encodeURIComponent(robotId)}/topology/path?${query.toString()}`;
    return parseTopologyPath(
      await this.request<unknown>(path, options),
      path,
      robotId,
      fromNodeId,
      toNodeId,
    );
  }

  async wiki(robotId: string, options?: RequestInit) {
    const path = `/v1/robots/${encodeURIComponent(robotId)}/wiki`;
    return parseRobotWiki(await this.request<unknown>(path, options), path, robotId);
  }

  async discoveries(robotId: string, options?: RequestInit) {
    const path = `/v1/robots/${encodeURIComponent(robotId)}/discoveries?limit=100&offset=0`;
    return parseDiscoverySnapshotCollection(await this.request<unknown>(path, options), path, robotId);
  }

  async evidenceCollection(
    robotId: string,
    options?: RequestInit,
    page: { limit?: number; offset?: number; authority?: EvidenceAuthority } = {},
  ) {
    const limit = page.limit ?? 25;
    const offset = page.offset ?? 0;
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (page.authority) query.set("authority", page.authority);
    const path = `/v1/robots/${encodeURIComponent(robotId)}/evidence?${query.toString()}`;
    return parseEvidenceCollection(
      await this.request<unknown>(path, options),
      path,
      robotId,
      { limit, offset, authority: page.authority },
    );
  }

  async evidence(evidenceId: string, options?: RequestInit) {
    const path = `/v1/evidence/${encodeURIComponent(evidenceId)}`;
    return parseEvidenceRecord(await this.request<unknown>(path, options), path, evidenceId);
  }

  async episodeCollection(
    robotId: string,
    options?: RequestInit,
    page: { limit?: number; offset?: number; state?: EpisodeState } = {},
  ) {
    const limit = page.limit ?? 50;
    const offset = page.offset ?? 0;
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (page.state) query.set("state", page.state);
    const path = `/v1/robots/${encodeURIComponent(robotId)}/episodes?${query.toString()}`;
    return parseEpisodeCollection(
      await this.request<unknown>(path, options),
      path,
      robotId,
      { limit, offset },
    );
  }

  async episode(robotId: string, episodeId: string, options?: RequestInit, revision?: number) {
    const query = revision === undefined ? "" : `?revision=${encodeURIComponent(String(revision))}`;
    const path = `/v1/robots/${encodeURIComponent(robotId)}/episodes/${encodeURIComponent(episodeId)}${query}`;
    return parseEpisodeDetail(
      await this.request<unknown>(path, options),
      path,
      robotId,
      episodeId,
      revision,
    );
  }

  async episodeRevisions(
    robotId: string,
    episodeId: string,
    options?: RequestInit,
    page: { limit?: number; offset?: number } = {},
  ) {
    const limit = page.limit ?? 100;
    const offset = page.offset ?? 0;
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const path = `/v1/robots/${encodeURIComponent(robotId)}/episodes/${encodeURIComponent(episodeId)}/revisions?${query.toString()}`;
    return parseEpisodeRevisionCollection(
      await this.request<unknown>(path, options), path, robotId, episodeId, { limit, offset },
    );
  }

  async episodeCohort(
    robotId: string,
    referenceEpisodeId: string,
    referenceRevision: number,
    options?: RequestInit,
    bounds: { windowDays?: 7 | 30 | 90; limit?: number } = {},
  ): Promise<EpisodeCohort> {
    const windowDays = bounds.windowDays ?? 30;
    const limit = bounds.limit ?? 100;
    const query = new URLSearchParams({
      reference_episode_id: referenceEpisodeId,
      reference_revision: String(referenceRevision),
      window_days: String(windowDays),
      limit: String(limit),
    });
    const path = `/v1/robots/${encodeURIComponent(robotId)}/episode-cohorts?${query.toString()}`;
    return parseEpisodeCohort(
      await this.request<unknown>(path, options),
      path,
      robotId,
      referenceEpisodeId,
      referenceRevision,
      { windowDays, limit },
    );
  }

  async episodeTimelinePage(
    robotId: string,
    episodeId: string,
    revision: number,
    options?: RequestInit,
    page: { limit?: number; cursor?: string } = {},
  ) {
    const limit = page.limit ?? 100;
    const query = new URLSearchParams({ revision: String(revision), limit: String(limit) });
    if (page.cursor) query.set("cursor", page.cursor);
    const path = `/v1/robots/${encodeURIComponent(robotId)}/episodes/${encodeURIComponent(episodeId)}/timeline?${query.toString()}`;
    return parseEpisodeTimelinePage(
      await this.request<unknown>(path, options),
      path,
      { robotId, episodeId, revision },
      { limit, cursor: page.cursor },
    );
  }

  async episodeObservationBundlePage(
    robotId: string,
    episodeId: string,
    revision: number,
    validation: Omit<EpisodeObservationValidationContext, "robotId" | "episodeId" | "revision">,
    options?: RequestInit,
    page: { limit?: number; cursor?: string } = {},
  ): Promise<EpisodeObservationBundleCollection> {
    const limit = page.limit ?? 20;
    const query = new URLSearchParams({ revision: String(revision), limit: String(limit) });
    if (page.cursor) query.set("cursor", page.cursor);
    const path = `/v1/robots/${encodeURIComponent(robotId)}/episodes/${encodeURIComponent(episodeId)}/observation-bundles?${query.toString()}`;
    return parseEpisodeObservationBundleCollection(
      await this.request<unknown>(path, options),
      path,
      { robotId, episodeId, revision, ...validation },
      { limit, cursor: page.cursor },
    );
  }

  async capabilityPage(
    robotId: string,
    options?: RequestInit,
    page: { limit?: number; offset?: number } = {},
  ) {
    const limit = page.limit ?? 100;
    const offset = page.offset ?? 0;
    const path = `/v1/robots/${encodeURIComponent(robotId)}/capabilities?limit=${limit}&offset=${offset}`;
    return parseCapabilityCollection(
      await this.request<unknown>(path, options),
      path,
      robotId,
      { limit, offset },
    );
  }

  async capabilities(robotId: string, options?: RequestInit) {
    const first = await this.capabilityPage(robotId, options);
    const offsets: number[] = [];
    for (let offset = first.next_offset; offset !== null && offset < first.total; offset += first.limit) {
      offsets.push(offset);
    }
    const remaining = await Promise.all(
      offsets.map((offset) => this.capabilityPage(robotId, options, { limit: first.limit, offset })),
    );
    const items: CapabilitySummary[] = [];
    for (const page of [first, ...remaining] as CapabilityCollection[]) {
      items.push(...page.items);
    }
    requireContract(items.length === first.total, "capability pages do not cover the advertised total", `/v1/robots/${encodeURIComponent(robotId)}/capabilities`);
    requireContract(new Set(items.map((item) => item.operation)).size === items.length, "capability pages contain duplicate operations", `/v1/robots/${encodeURIComponent(robotId)}/capabilities`);
    return { items, limitations: first.limitations };
  }

  async capability(robotId: string, operation: string, options?: RequestInit) {
    const path = `/v1/robots/${encodeURIComponent(robotId)}/capabilities/${encodeURIComponent(operation)}`;
    return parseCapabilityDetail(await this.request<unknown>(path, options), path, robotId, operation);
  }

  async runs(robotId: string, options?: RequestInit) {
    const path = `/v1/robots/${encodeURIComponent(robotId)}/runs?limit=50&offset=0`;
    return parseLifecycleRunCollection(await this.request<unknown>(path, options), path, robotId);
  }

  async run(robotId: string, runId: string, options?: RequestInit) {
    const path = `/v1/robots/${encodeURIComponent(robotId)}/runs/${encodeURIComponent(runId)}`;
    return parseLifecycleRunDetail(await this.request<unknown>(path, options), path, robotId, runId);
  }

  async blockerDetail(blockerId: string, options?: RequestInit) {
    const path = `/v1/blockers/${encodeURIComponent(blockerId)}`;
    return parseFleetBlockerDetail(
      await this.request<unknown>(path, options),
      path,
      blockerId,
    );
  }

  async operationGovernancePage(
    options?: RequestInit,
    page: { limit?: number; offset?: number } = {},
  ) {
    const limit = page.limit ?? 50;
    const offset = page.offset ?? 0;
    const path = `/v1/operations/governance?limit=${limit}&offset=${offset}`;
    return parseOperationGovernanceCollection(
      await this.request<unknown>(path, options),
      path,
      { limit, offset },
    );
  }

  async operationGovernance(options?: RequestInit) {
    const pageSize = 50;
    const first = await this.operationGovernancePage(options, { limit: pageSize, offset: 0 });
    const items = [...first.items];
    let nextOffset = first.next_offset;
    requireContract(nextOffset === null || nextOffset === items.length, "operation governance pagination is not contiguous", "/v1/operations/governance");
    while (nextOffset !== null) {
      const page = await this.operationGovernancePage(options, { limit: pageSize, offset: nextOffset });
      requireContract(page.total === first.total, "operation governance total changed during pagination", "/v1/operations/governance");
      requireContract(page.source_kind === first.source_kind && page.influences_registry === first.influences_registry, "operation governance authority changed during pagination", "/v1/operations/governance");
      items.push(...page.items);
      nextOffset = page.next_offset;
      requireContract(nextOffset === null || nextOffset === items.length, "operation governance pagination is not contiguous", "/v1/operations/governance");
    }
    requireContract(items.length === first.total, "operation governance pages do not cover the advertised total", "/v1/operations/governance");
    requireContract(new Set(items.map((item) => item.current_operation)).size === items.length, "operation governance pages contain duplicate operations", "/v1/operations/governance");
    return { items, limitations: first.limitations };
  }

  async targetOperationSlice(robotId: string, options?: RequestInit) {
    const path = `/v1/robots/${encodeURIComponent(robotId)}/adapt/operation-slice`;
    return parseTargetOperationSlice(
      await this.request<unknown>(path, options),
      path,
      robotId,
    );
  }

  async sliceStability(robotId: string, options?: RequestInit) {
    const path = `/v1/robots/${encodeURIComponent(robotId)}/adapt/slice-stability`;
    return parseSliceStabilityReport(
      await this.request<unknown>(path, options),
      path,
      robotId,
    );
  }

  async fleetSliceStability(options?: RequestInit) {
    const path = "/v1/adapt/slice-fleet";
    return parseFleetSliceStability(await this.request<unknown>(path, options), path);
  }

  async sliceStabilityComparison(robotId: string, options?: RequestInit) {
    const path = `/v1/robots/${encodeURIComponent(robotId)}/adapt/slice-stability/comparison`;
    return parseSliceStabilityComparison(await this.request<unknown>(path, options), path, robotId);
  }

  async sliceReviewPacket(robotId: string, options?: RequestInit) {
    const path = `/v1/robots/${encodeURIComponent(robotId)}/adapt/slice-review`;
    return parseSliceReviewPacket(await this.request<unknown>(path, options), path, robotId);
  }

  async adaptBaseline(options?: RequestInit) {
    const path = "/v1/adapt/baseline";
    return parseAdaptBaselineStatus(await this.request<unknown>(path, options), path);
  }

  async sliceRunDetail(robotId: string, runId: string, options?: RequestInit) {
    const path = `/v1/robots/${encodeURIComponent(robotId)}/adapt/slice-runs/${encodeURIComponent(runId)}`;
    return parseSliceRunDetail(
      await this.request<unknown>(path, options),
      path,
      robotId,
      runId,
    );
  }

  async bootstrap(options: RequestInit = {}, requestedRobotId?: string): Promise<BootstrapResult> {
    const health = await this.health(options);
    if (health.status === "UNHEALTHY") {
      throw new RoloApiError("rolo reports an unhealthy control plane", null, "/health", "HEALTH");
    }
    const healthIssues = health.status === "DEGRADED"
      ? ["The rolo control plane reports degraded health; live data is shown as partial."]
      : [];
    const robots = await this.robots(options);
    const robot = robots.find((item) => item.robot_id === requestedRobotId) || robots[0] || null;
    if (!robot) {
      return {
        mode: "partial",
        health,
        robots,
        robot: null,
        overview: null,
        pipeline: null,
        topology: null,
        topologySnapshots: null,
        evidence: null,
        capabilities: null,
        capabilityLimitations: [],
        runs: null,
        issues: [...healthIssues, "The control plane is reachable but no robots are registered."],
      };
    }

    let overview: RobotOverview | null = null;
    let pipeline: PipelineAssessment | null = null;
    const issues = [...healthIssues];
    try {
      overview = await this.overview(robot.robot_id, options);
      pipeline = overview.pipeline;
    } catch (error) {
      if (!(error instanceof RoloApiError) || ![404, 409, 422].includes(error.status || 0)) throw error;
      try {
        pipeline = await this.pipeline(robot.robot_id, options);
        issues.push(
          error.status === 404
            ? "The overview read model is unavailable; showing the compatible pipeline view."
            : "The overview read model failed evidence validation; showing the safe pipeline assessment.",
        );
      } catch (pipelineError) {
        if (!(pipelineError instanceof RoloApiError)) throw pipelineError;
        pipeline = null;
        issues.push("The overview and pipeline read models are unavailable; live evidence is incomplete.");
      }
    }

    const [topologyResult, snapshotResult, evidenceResult, capabilitiesResult, runsResult] = await Promise.allSettled([
      this.topology(robot.robot_id, options),
      this.topologySnapshots(robot.robot_id, options),
      this.evidenceCollection(robot.robot_id, options),
      this.capabilities(robot.robot_id, options),
      this.runs(robot.robot_id, options),
    ]);
    const optionalReadModel = <T>(
      result: PromiseSettledResult<T>,
      label: string,
    ): T | null => {
      if (result.status === "fulfilled") return result.value;
      if (result.reason instanceof RoloApiError) {
        const suffix = result.reason.status ? ` (HTTP ${result.reason.status})` : "";
        issues.push(`The ${label} read model is unavailable${suffix}.`);
        return null;
      }
      throw result.reason;
    };
    const topology = optionalReadModel(topologyResult, "topology");
    const topologySnapshots = optionalReadModel(snapshotResult, "topology snapshot history");
    const evidence = optionalReadModel(evidenceResult, "evidence");
    const capabilityResult = optionalReadModel(capabilitiesResult, "capability");
    const capabilities = capabilityResult?.items || null;
    const runs = optionalReadModel(runsResult, "lifecycle run");
    const complete = Boolean(
      health.status === "HEALTHY" && overview && topology && evidence && capabilities && runs,
    );
    return {
      mode: complete ? "live" : "partial",
      health,
      robots,
      robot,
      overview,
      pipeline,
      topology,
      topologySnapshots,
      evidence,
      capabilities,
      capabilityLimitations: capabilityResult?.limitations || [],
      runs,
      issues,
    };
  }
}

export const roloClient = new RoloClient();
