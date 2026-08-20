import type {
  BootstrapResult,
  CapabilityCollection,
  CapabilityDetail,
  CapabilitySummary,
  DiscoverySnapshotCollection,
  DiscoverySnapshotSummary,
  EvidenceAuthority,
  EvidenceCollection,
  EvidenceRecord,
  FleetBlockerCollection,
  FleetBlockerSummary,
  FleetCollection,
  FleetRobotSummary,
  HealthResponse,
  LifecycleRunCollection,
  LifecycleRunDetail,
  LifecycleRunSummary,
  PipelineAssessment,
  RobotCapability,
  RobotOverview,
  RobotTopology,
  RobotWikiSnapshot,
  StageAssessment,
  TopologyDiff,
  TopologyEdge,
  TopologyNode,
  TopologyPathExplanation,
  TopologySnapshotCollection,
  TopologySnapshotSummary,
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

function containsUnsafeReference(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return serialized.includes("artifact://")
    || /[A-Za-z]:\\\\/.test(serialized)
    || /\/(?:home|root|etc|var|tmp|workspace|mnt|Users)\//i.test(serialized);
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
  requireContract(["robot_manifest", "gated_artifact", "pipeline_artifact", "lifecycle_run", "lifecycle_gate", "lifecycle_handoff", "wiki_insight", "wiki_diff"].includes(String(value.source_kind)), "invalid evidence source", path);
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

function parseDiscoverySnapshotSummary(
  value: unknown,
  path: string,
  robotId: string,
): DiscoverySnapshotSummary {
  requireContract(isRecord(value) && value.schema_version === "rolo-discovery-snapshot-summary/v1", "invalid discovery snapshot summary", path);
  requireContract(value.robot_id === robotId && typeof value.discovery_id === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value.discovery_id), "invalid discovery snapshot identity", path);
  requireContract(["SUCCEEDED", "PARTIAL", "UNAVAILABLE", "FAILED"].includes(String(value.status)), "invalid discovery snapshot status", path);
  requireContract(typeof value.discovery_mode === "string" && /^[A-Za-z0-9._-]{1,48}$/.test(value.discovery_mode), "invalid discovery mode", path);
  requireContract(isTimestamp(value.created_at) && typeof value.is_latest === "boolean", "invalid discovery snapshot metadata", path);
  const counts = [
    value.probe_total,
    value.observed_probes,
    value.partial_probes,
    value.unavailable_probes,
    value.operation_candidates,
    value.semantic_bindings,
    value.warning_count,
  ];
  requireContract(counts.every((item) => Number.isInteger(item) && Number(item) >= 0), "invalid discovery snapshot counts", path);
  requireContract(Number(value.observed_probes) + Number(value.partial_probes) + Number(value.unavailable_probes) === Number(value.probe_total), "inconsistent discovery probe coverage", path);
  requireContract(isConfidence(value.confidence) && value.integrity_status === "verified" && isStringArray(value.limitations), "invalid discovery snapshot trust metadata", path);
  requireContract(!containsUnsafeReference(value), "discovery snapshot contains an unsafe reference", path);
  return value as unknown as DiscoverySnapshotSummary;
}

function parseDiscoverySnapshotCollection(
  value: unknown,
  path: string,
  robotId: string,
): DiscoverySnapshotCollection {
  requireContract(isRecord(value) && value.schema_version === "rolo-discovery-snapshot-collection/v1", "unsupported discovery history schema", path);
  requireContract(value.robot_id === robotId && Array.isArray(value.items), "discovery history identity does not match request", path);
  const items = value.items.map((item, index) => parseDiscoverySnapshotSummary(item, `${path}/items/${index}`, robotId));
  requireContract(new Set(items.map((item) => item.discovery_id)).size === items.length, "duplicate discovery snapshot identity", path);
  requireContract(items.filter((item) => item.is_latest).length <= 1, "multiple latest discovery snapshots", path);
  requireContract(Number.isInteger(value.total) && Number(value.total) >= items.length, "invalid discovery history total", path);
  requireContract(Number.isInteger(value.limit) && Number(value.limit) >= 1 && Number(value.limit) <= 100 && items.length <= Number(value.limit), "invalid discovery history page limit", path);
  requireContract(Number.isInteger(value.offset) && Number(value.offset) >= 0, "invalid discovery history page offset", path);
  requireContract(value.next_offset === null || (Number.isInteger(value.next_offset) && Number(value.next_offset) > Number(value.offset)), "invalid discovery history next offset", path);
  requireContract(Number.isInteger(value.excluded_unverified) && Number(value.excluded_unverified) >= 0, "invalid excluded discovery count", path);
  requireContract(isTimestamp(value.observed_at) && value.freshness === "unknown", "invalid discovery history observation metadata", path);
  requireContract(value.source_kind === "verified_discovery_history" && value.integrity_status === "verified" && isStringArray(value.limitations), "invalid discovery history trust metadata", path);
  requireContract(!containsUnsafeReference(value), "discovery history contains an unsafe reference", path);
  return { ...value, items } as unknown as DiscoverySnapshotCollection;
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
  requireContract(isRecord(value) && value.schema_version === "rolo-fleet-blocker-summary/v1", "invalid fleet blocker", path);
  requireContract(typeof value.blocker_id === "string" && Boolean(value.blocker_id) && typeof value.robot_id === "string" && Boolean(value.robot_id), "invalid fleet blocker identity", path);
  requireContract(["adapt", "diagnose", "verify"].includes(String(value.stage)), "invalid fleet blocker stage", path);
  requireContract(typeof value.message === "string" && typeof value.recommended_action === "string" && typeof value.owner === "string", "invalid fleet blocker guidance", path);
  requireContract(isStringArray(value.evidence_ids) && value.evidence_ids.every((item) => item.startsWith("ev_")), "invalid fleet blocker evidence", path);
  requireContract(isTimestamp(value.observed_at) && value.freshness === "fresh" && value.source_kind === "pipeline_assessment", "invalid fleet blocker observation metadata", path);
  requireContract(isConfidence(value.confidence) && value.integrity_status === "validated", "invalid fleet blocker trust metadata", path);
  return value as unknown as FleetBlockerSummary;
}

function parseFleetBlockerCollection(value: unknown, path: string): FleetBlockerCollection {
  requireContract(isRecord(value) && value.schema_version === "rolo-fleet-blocker-collection/v1" && Array.isArray(value.items), "invalid fleet blocker collection", path);
  const items = value.items.map((item, index) => parseFleetBlockerSummary(item, `${path}/items/${index}`));
  requireContract(new Set(items.map((item) => item.blocker_id)).size === items.length, "duplicate blocker in fleet collection", path);
  requireContract(Number.isInteger(value.total) && Number(value.total) >= items.length, "invalid fleet blocker total", path);
  requireContract(Number.isInteger(value.limit) && Number(value.limit) >= 1 && Number(value.limit) <= 100 && items.length <= Number(value.limit), "invalid fleet blocker page limit", path);
  requireContract(Number.isInteger(value.offset) && Number(value.offset) >= 0 && (value.next_offset === null || (Number.isInteger(value.next_offset) && Number(value.next_offset) > Number(value.offset))), "invalid fleet blocker page offset", path);
  requireContract(isTimestamp(value.observed_at) && value.freshness === "fresh" && value.source_kind === "computed_pipeline_blockers", "invalid fleet blocker collection metadata", path);
  requireContract(isConfidence(value.confidence) && value.integrity_status === "validated", "invalid fleet blocker collection trust", path);
  requireContract(!containsUnsafeReference(value), "fleet blocker collection contains an unsafe reference", path);
  return { ...value, items } as unknown as FleetBlockerCollection;
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
      if (!(error instanceof RoloApiError) || error.status !== 404) throw error;
      pipeline = await this.pipeline(robot.robot_id, options);
      issues.push("The overview read model is unavailable; showing the compatible pipeline view.");
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
