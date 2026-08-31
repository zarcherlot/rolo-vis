import {
  containsUnsafeReference,
  isRecord,
  isStringArray,
  isTimestamp,
  requireContract,
} from "./guards.ts";

export type ArtifactAnalysisStageStatus = "passed" | "partial" | "blocked" | "pending";
export type ArtifactAnalysisRouteStatus = "observed" | "unresolved" | "deferred";
export type ArtifactAnalysisTone = "blue" | "slate" | "violet" | "amber" | "green";

export interface ArtifactAnalysisMetric {
  label: string;
  value: number;
  display: string;
  tone: ArtifactAnalysisTone;
}

export interface ArtifactAnalysisOperation {
  name: string;
  route: string;
  routeStatus: ArtifactAnalysisRouteStatus;
  checks: string[];
  contract: string;
}

export interface ArtifactAnalysisStage {
  label: string;
  status: ArtifactAnalysisStageStatus;
  timestamp: string;
  detail: string;
}

export interface ArtifactAnalysisFinding {
  tone: ArtifactAnalysisTone;
  title: string;
  body: string;
}

export interface ArtifactAnalysisSummary {
  schema_version: "rolo-artifact-analysis-summary/v1";
  analysis_id: string;
  target_id: string;
  robot_id: string;
  job_id: string | null;
  run_id: string | null;
  discovery_id: string;
  source_kind: "rolo_api" | "demo_fixture";
  source_label: string;
  observed_at: string;
  freshness: "fresh" | "stale" | "unknown";
  contains_secret_payloads: false;
  kind: string;
  run_status: string;
  title: string;
  description: string;
  gate_status: "PASSED" | "BLOCKED" | "NOT_AVAILABLE";
  gate_label: string;
  gate_tone: ArtifactAnalysisTone;
  release_status: string;
  release_label: string;
  release_tone: ArtifactAnalysisTone;
  run_duration: string;
  event_count: number;
  eligible_operation_count: number;
  route_review_flags: string;
  context_bars: ArtifactAnalysisMetric[];
  evidence_note: string;
  operations: ArtifactAnalysisOperation[];
  graph_nodes: Array<{ label: string; state: string; tone: ArtifactAnalysisTone }>;
  stages: ArtifactAnalysisStage[];
  findings: ArtifactAnalysisFinding[];
  hashes: Array<[string, string]>;
  limitations: string[];
}

const MAX_TEXT = 240;
const MAX_ID = 128;
const MAX_ITEMS = 40;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_HASH = /^[0-9a-f]{8,64}(?:…[0-9a-f]{8,64})?$/;

function text(value: unknown, path: string, max = MAX_TEXT): string {
  requireContract(typeof value === "string" && value.length > 0 && value.length <= max, "bounded text is invalid", path);
  return value;
}

function id(value: unknown, path: string): string {
  requireContract(typeof value === "string" && value.length <= MAX_ID && SAFE_ID.test(value), "safe identity is invalid", path);
  return value;
}

function number(value: unknown, path: string): number {
  requireContract(typeof value === "number" && Number.isFinite(value) && value >= 0, "non-negative number is invalid", path);
  return value;
}

function tone(value: unknown, path: string): ArtifactAnalysisTone {
  requireContract(["blue", "slate", "violet", "amber", "green"].includes(String(value)), "analysis tone is invalid", path);
  return value as ArtifactAnalysisTone;
}

function parseMetric(value: unknown, path: string): ArtifactAnalysisMetric {
  requireContract(isRecord(value), "analysis metric must be an object", path);
  return {
    label: text(value.label, `${path}/label`),
    value: number(value.value, `${path}/value`),
    display: text(value.display, `${path}/display`),
    tone: tone(value.tone, `${path}/tone`),
  };
}

function parseOperation(value: unknown, path: string): ArtifactAnalysisOperation {
  requireContract(isRecord(value), "analysis operation must be an object", path);
  requireContract(["observed", "unresolved", "deferred"].includes(String(value.route_status)), "analysis route status is invalid", path);
  requireContract(Array.isArray(value.checks) && value.checks.length <= 8 && value.checks.every((item) => typeof item === "string" && item.length <= MAX_TEXT), "analysis checks are invalid", path);
  return {
    name: text(value.name, `${path}/name`, 128),
    route: text(value.route, `${path}/route`, 160),
    routeStatus: value.route_status as ArtifactAnalysisRouteStatus,
    checks: value.checks as string[],
    contract: text(value.contract, `${path}/contract`, 160),
  };
}

function parseStage(value: unknown, path: string): ArtifactAnalysisStage {
  requireContract(isRecord(value), "analysis stage must be an object", path);
  requireContract(["passed", "partial", "blocked", "pending"].includes(String(value.status)), "analysis stage status is invalid", path);
  return {
    label: text(value.label, `${path}/label`, 80),
    status: value.status as ArtifactAnalysisStageStatus,
    timestamp: text(value.timestamp, `${path}/timestamp`, 64),
    detail: text(value.detail, `${path}/detail`),
  };
}

function parseFinding(value: unknown, path: string): ArtifactAnalysisFinding {
  requireContract(isRecord(value), "analysis finding must be an object", path);
  return {
    tone: tone(value.tone, `${path}/tone`),
    title: text(value.title, `${path}/title`),
    body: text(value.body, `${path}/body`),
  };
}

/**
 * Parses the rolo artifact-analysis read model. The browser only accepts
 * bounded, sanitized summaries and never receives artifact bytes or paths.
 */
export function parseArtifactAnalysisSummary(value: unknown, path = "artifact_analysis"): ArtifactAnalysisSummary {
  requireContract(isRecord(value), "artifact analysis must be an object", path);
  requireContract(value.schema_version === "rolo-artifact-analysis-summary/v1", "unsupported artifact analysis schema", path);
  requireContract(value.contains_secret_payloads === false, "artifact analysis must not contain secrets", path);
  requireContract(!containsUnsafeReference(value), "artifact analysis contains an unsafe reference", path);
  const sourceKind = value.source_kind;
  requireContract(sourceKind === "rolo_api" || sourceKind === "demo_fixture", "artifact analysis source is invalid", path);
  requireContract(isTimestamp(value.observed_at), "artifact analysis timestamp is invalid", path);
  requireContract(["fresh", "stale", "unknown"].includes(String(value.freshness)), "artifact analysis freshness is invalid", path);
  requireContract(["PASSED", "BLOCKED", "NOT_AVAILABLE"].includes(String(value.gate_status)), "artifact analysis gate status is invalid", path);
  requireContract(value.run_id === null || (typeof value.run_id === "string" && SAFE_ID.test(value.run_id)), "artifact analysis run identity is invalid", path);
  requireContract(Array.isArray(value.context_bars) && value.context_bars.length <= MAX_ITEMS, "analysis metrics are invalid", path);
  requireContract(Array.isArray(value.operations) && value.operations.length <= MAX_ITEMS, "analysis operations are invalid", path);
  requireContract(Array.isArray(value.graph_nodes) && value.graph_nodes.length <= MAX_ITEMS, "analysis graph nodes are invalid", path);
  requireContract(Array.isArray(value.stages) && value.stages.length <= MAX_ITEMS, "analysis stages are invalid", path);
  requireContract(Array.isArray(value.findings) && value.findings.length <= MAX_ITEMS, "analysis findings are invalid", path);
  requireContract(Array.isArray(value.hashes) && value.hashes.length <= MAX_ITEMS, "analysis hashes are invalid", path);
  requireContract(isStringArray(value.limitations) && value.limitations.length <= MAX_ITEMS && value.limitations.every((item) => item.length <= MAX_TEXT), "analysis limitations are invalid", path);

  const hashes = value.hashes.map((item, index) => {
    const hashPath = `${path}/hashes/${index}`;
    requireContract(Array.isArray(item) && item.length === 2, "analysis hash entry is invalid", hashPath);
    requireContract(typeof item[0] === "string" && item[0].length <= 80 && typeof item[1] === "string" && SAFE_HASH.test(item[1]), "analysis hash value is invalid", hashPath);
    return [item[0], item[1]] as [string, string];
  });
  const graphNodes = value.graph_nodes.map((item, index) => {
    const nodePath = `${path}/graph_nodes/${index}`;
    requireContract(isRecord(item), "analysis graph node is invalid", nodePath);
    return {
      label: text(item.label, `${nodePath}/label`, 80),
      state: text(item.state, `${nodePath}/state`),
      tone: tone(item.tone, `${nodePath}/tone`),
    };
  });
  return {
    schema_version: "rolo-artifact-analysis-summary/v1",
    analysis_id: id(value.analysis_id, `${path}/analysis_id`),
    target_id: id(value.target_id, `${path}/target_id`),
    robot_id: id(value.robot_id, `${path}/robot_id`),
    job_id: value.job_id === null || value.job_id === undefined ? null : id(value.job_id, `${path}/job_id`),
    run_id: value.run_id === null ? null : String(value.run_id),
    discovery_id: id(value.discovery_id, `${path}/discovery_id`),
    source_kind: sourceKind,
    source_label: text(value.source_label, `${path}/source_label`),
    observed_at: value.observed_at,
    freshness: value.freshness as ArtifactAnalysisSummary["freshness"],
    contains_secret_payloads: false,
    kind: text(value.kind, `${path}/kind`),
    run_status: text(value.run_status, `${path}/run_status`),
    title: text(value.title, `${path}/title`),
    description: text(value.description, `${path}/description`),
    gate_status: value.gate_status as ArtifactAnalysisSummary["gate_status"],
    gate_label: text(value.gate_label, `${path}/gate_label`),
    gate_tone: tone(value.gate_tone, `${path}/gate_tone`),
    release_status: text(value.release_status, `${path}/release_status`),
    release_label: text(value.release_label, `${path}/release_label`),
    release_tone: tone(value.release_tone, `${path}/release_tone`),
    run_duration: text(value.run_duration, `${path}/run_duration`, 64),
    event_count: number(value.event_count, `${path}/event_count`),
    eligible_operation_count: number(value.eligible_operation_count, `${path}/eligible_operation_count`),
    route_review_flags: text(value.route_review_flags, `${path}/route_review_flags`, 64),
    context_bars: value.context_bars.map((item, index) => parseMetric(item, `${path}/context_bars/${index}`)),
    evidence_note: text(value.evidence_note, `${path}/evidence_note`),
    operations: value.operations.map((item, index) => parseOperation(item, `${path}/operations/${index}`)),
    graph_nodes: graphNodes,
    stages: value.stages.map((item, index) => parseStage(item, `${path}/stages/${index}`)),
    findings: value.findings.map((item, index) => parseFinding(item, `${path}/findings/${index}`)),
    hashes,
    limitations: value.limitations,
  };
}
