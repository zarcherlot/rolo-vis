import type {
  BootstrapResult,
  CapabilityCollection,
  CapabilityDetail,
  CapabilitySummary,
  EvidenceAuthority,
  EvidenceCollection,
  EvidenceRecord,
  HealthResponse,
  LifecycleRunCollection,
  LifecycleRunDetail,
  LifecycleRunSummary,
  PipelineAssessment,
  RobotCapability,
  RobotOverview,
  RobotTopology,
  StageAssessment,
} from "./types/rolo";

const DEFAULT_BASE = "/rolo-api";

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

export class RoloContractError extends Error {
  path: string;

  constructor(message: string, path: string) {
    super(message);
    this.name = "RoloContractError";
    this.path = path;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireContract(condition: boolean, message: string, path: string): asserts condition {
  if (!condition) throw new RoloContractError(message, path);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isConfidence(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 1;
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
  requireContract(isTimestamp(value.timestamp), "invalid health observation time", path);
  return value as unknown as HealthResponse;
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
  requireContract(["robot_manifest", "gated_artifact", "pipeline_artifact", "lifecycle_run", "lifecycle_gate", "lifecycle_handoff"].includes(String(value.source_kind)), "invalid evidence source", path);
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

function parseCapabilitySummary(value: unknown, path: string): CapabilitySummary {
  requireContract(isRecord(value), "capability summary must be an object", path);
  requireContract(value.schema_version === "rolo-capability-summary/v1", "unsupported capability summary schema", path);
  requireContract(typeof value.operation === "string" && value.operation.length > 0, "missing canonical operation", path);
  requireContract(["Hardware", "Linux", "Middleware", "Application"].includes(String(value.layer)), "invalid capability layer", path);
  requireContract(typeof value.description === "string", "invalid capability description", path);
  requireContract(["DRAFT", "GATEABLE", "RELEASED", "DEPRECATED"].includes(String(value.lifecycle)), "invalid capability lifecycle", path);
  requireContract(["APPLICABLE", "NOT_OBSERVED", "UNKNOWN"].includes(String(value.applicability)), "invalid capability applicability", path);
  requireContract(["VERIFIED", "AVAILABLE", "UNAVAILABLE", "UNKNOWN"].includes(String(value.availability)), "invalid capability availability", path);
  requireContract(["BUILTIN", "REGISTERED", "NOT_REGISTERED", "STALE"].includes(String(value.registration)), "invalid capability registration", path);
  requireContract(["read", "write"].includes(String(value.access)) && ["R0", "R1", "R2", "R3"].includes(String(value.risk)), "invalid capability access or risk", path);
  requireContract(["PUBLIC", "INTERNAL", "SENSITIVE", "SECRET"].includes(String(value.data_classification)), "invalid capability classification", path);
  requireContract(typeof value.contract_version === "string" && /^[0-9a-f]{64}$/.test(String(value.contract_digest)), "invalid capability contract identity", path);
  requireContract(Number.isInteger(value.binding_count) && Number(value.binding_count) >= 0, "invalid capability binding count", path);
  requireContract(value.last_verified_at === null || isTimestamp(value.last_verified_at), "invalid capability verification time", path);
  requireContract(isStringArray(value.evidence_ids) && isConfidence(value.confidence), "invalid capability evidence or confidence", path);
  requireContract(["validated", "verified"].includes(String(value.integrity_status)) && isStringArray(value.limitations), "invalid capability integrity or limitations", path);
  return value as unknown as CapabilitySummary;
}

function parseCapabilityCollection(
  value: unknown,
  path: string,
  robotId: string,
  expectedPage: { limit: number; offset: number },
): CapabilityCollection {
  requireContract(isRecord(value), "capability collection must be an object", path);
  requireContract(value.schema_version === "rolo-capability-collection/v1", "unsupported capability collection schema", path);
  requireContract(value.robot_id === robotId && Array.isArray(value.items), "invalid capability collection identity or items", path);
  const items = value.items.map((item, index) => parseCapabilitySummary(item, `${path}/items/${index}`));
  requireContract(new Set(items.map((item) => item.operation)).size === items.length, "capability page contains duplicate operations", path);
  requireContract(Number.isInteger(value.total) && Number(value.total) >= items.length, "invalid capability collection total", path);
  requireContract(value.limit === expectedPage.limit && value.offset === expectedPage.offset && items.length <= expectedPage.limit, "capability collection does not match the requested page", path);
  requireContract(value.next_offset === null || (Number.isInteger(value.next_offset) && Number(value.next_offset) > Number(value.offset)), "invalid capability next offset", path);
  requireContract(isTimestamp(value.observed_at) && ["fresh", "unknown"].includes(String(value.freshness)), "invalid capability observation metadata", path);
  requireContract(["product_registry", "discovery", "gated_release"].includes(String(value.source_kind)) && isStringArray(value.limitations), "invalid capability source metadata", path);
  return { ...value, items } as unknown as CapabilityCollection;
}

function parseCapabilityDetail(value: unknown, path: string, robotId: string, operation: string): CapabilityDetail {
  requireContract(isRecord(value), "capability detail must be an object", path);
  requireContract(value.schema_version === "rolo-capability-detail/v1" && value.robot_id === robotId, "invalid capability detail identity", path);
  const capability = parseCapabilitySummary(value.capability, `${path}/capability`);
  requireContract(capability.operation === operation, "capability operation does not match request", path);
  requireContract(isRecord(value.contract) && value.contract.schema_version === "rolo-capability-contract/v1", "invalid capability contract", path);
  requireContract(isRecord(value.contract.input_schema) && isRecord(value.contract.output_schema), "invalid capability schemas", path);
  requireContract(Array.isArray(value.bindings), "capability bindings must be an array", path);
  for (const [index, binding] of value.bindings.entries()) {
    const bindingPath = `${path}/bindings/${index}`;
    requireContract(isRecord(binding) && binding.schema_version === "rolo-capability-binding/v1", "invalid capability binding", bindingPath);
    requireContract(typeof binding.binding_id === "string" && typeof binding.endpoint === "string", "invalid capability binding identity", bindingPath);
    requireContract(["gated_release", "discovery_candidate"].includes(String(binding.source)) && ["GATED", "OBSERVED", "DECLARED"].includes(String(binding.authority)), "invalid capability binding authority", bindingPath);
    requireContract(/^[0-9a-f]{64}$/.test(String(binding.reference_digest)) && isStringArray(binding.evidence_ids) && isStringArray(binding.limitations), "invalid capability binding evidence", bindingPath);
  }
  requireContract(isTimestamp(value.observed_at) && ["fresh", "unknown"].includes(String(value.freshness)), "invalid capability detail observation metadata", path);
  return { ...value, capability } as unknown as CapabilityDetail;
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
    const items = [first, ...remaining].flatMap((page) => page.items);
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
      if (!(error instanceof RoloApiError) || error.status !== 404) throw error;
      pipeline = await this.pipeline(robot.robot_id, options);
      issues.push("The overview read model is unavailable; showing the compatible pipeline view.");
    }

    const [topologyResult, evidenceResult, capabilitiesResult, runsResult] = await Promise.allSettled([
      this.topology(robot.robot_id, options),
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
      evidence,
      capabilities,
      capabilityLimitations: capabilityResult?.limitations || [],
      runs,
      issues,
    };
  }
}

export const roloClient = new RoloClient();
