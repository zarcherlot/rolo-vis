import type {
  AssociationProposal,
  AssociationReport,
  EvidenceRequest,
  ProbeEvidenceView,
  UserIntentReceipt,
} from "../types/rolo.ts";
import { containsUnsafeReference, isConfidence, isRecord, isStringArray, isTimestamp, requireContract } from "./guards.ts";

const DIGEST = /^(?:sha256:)?[0-9a-f]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const FORBIDDEN_KEYS = new Set(["token", "secret", "password", "credential", "command", "shell", "payload", "prompt"]);

function identifier(value: unknown): value is string { return typeof value === "string" && ID.test(value); }
function digest(value: unknown): value is string { return typeof value === "string" && DIGEST.test(value); }
function safePublic(value: unknown, path: string): void {
  if (Array.isArray(value)) { value.forEach((item, index) => safePublic(item, `${path}/${index}`)); return; }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      requireContract(!FORBIDDEN_KEYS.has(key.toLowerCase()), `unsafe public field: ${key}`, `${path}/${key}`);
      safePublic(child, `${path}/${key}`);
    }
    return;
  }
  if (typeof value === "string") {
    requireContract(!/(?:(?:artifact|file|ssh|https?):\/\/)|(?:[A-Za-z]:[\\/])|(?:\/(?:home|Users|tmp|var|etc|opt|srv|mnt)\/)/i.test(value), "unsafe public reference", path);
  }
}
function list(value: unknown, path: string, max = 256): string[] {
  requireContract(isStringArray(value) && value.length <= max && value.every(identifier), "invalid identifier list", path);
  return value;
}

export function parseProbeEvidenceView(value: unknown, path = "probe_evidence_view"): ProbeEvidenceView {
  requireContract(isRecord(value) && value.schema_version === "probe-evidence-view/v1", "invalid ProbeEvidenceView schema", path);
  requireContract(identifier(value.view_id) && isRecord(value.target) && isRecord(value.snapshot), "invalid ProbeEvidenceView identity", path);
  const target = value.target; const snapshot = value.snapshot;
  requireContract(identifier(target.robot_id) && identifier(target.collector_id) && digest(target.target_fingerprint), "invalid target envelope", `${path}/target`);
  requireContract(identifier(snapshot.snapshot_id) && isTimestamp(snapshot.observed_at) && isTimestamp(snapshot.fresh_until) && digest(snapshot.digest), "invalid snapshot envelope", `${path}/snapshot`);
  requireContract(Array.isArray(value.facts) && Array.isArray(value.resources) && Array.isArray(value.routes) && Array.isArray(value.candidate_operations), "invalid ProbeEvidenceView collections", path);
  for (const [index, fact] of value.facts.entries()) {
    requireContract(isRecord(fact) && identifier(fact.fact_id) && ["Hardware", "Linux", "Middleware", "Application"].includes(String(fact.layer)), "invalid Probe fact", `${path}/facts/${index}`);
    requireContract(["DECLARED", "OBSERVED", "VERIFIED", "INFERRED"].includes(String(fact.source_kind)) && typeof fact.value_summary === "string" && typeof fact.value_type === "string", "invalid Probe fact content", `${path}/facts/${index}`);
    requireContract(isTimestamp(fact.observed_at) && isTimestamp(fact.fresh_until) && isConfidence(fact.confidence) && ["FRESH", "STALE", "UNKNOWN", "UNAVAILABLE"].includes(String(fact.status)), "invalid Probe fact freshness", `${path}/facts/${index}`);
    list(fact.limitations, `${path}/facts/${index}/limitations`, 24);
  }
  for (const [index, resource] of value.resources.entries()) {
    requireContract(isRecord(resource) && identifier(resource.resource_id) && typeof resource.kind === "string" && typeof resource.identity === "string" && digest(resource.digest), "invalid Probe resource", `${path}/resources/${index}`);
    requireContract(["STABLE", "DYNAMIC", "UNKNOWN"].includes(String(resource.stability)), "invalid Probe resource stability", `${path}/resources/${index}`);
  }
  for (const [index, route] of value.routes.entries()) {
    requireContract(isRecord(route) && identifier(route.route_id) && typeof route.endpoint === "string" && typeof route.interface === "string" && digest(route.schema_digest) && typeof route.provider === "string" && Number.isInteger(route.revision) && Number(route.revision) >= 0, "invalid Probe route", `${path}/routes/${index}`);
  }
  for (const [index, candidate] of value.candidate_operations.entries()) {
    requireContract(isRecord(candidate) && identifier(candidate.operation_id) && candidate.access === "READ_ONLY" && ["R0", "R1", "R2"].includes(String(candidate.risk)), "invalid candidate operation", `${path}/candidate_operations/${index}`);
    list(candidate.matched_fact_ids, `${path}/candidate_operations/${index}/matched_fact_ids`); list(candidate.missing_fact_ids, `${path}/candidate_operations/${index}/missing_fact_ids`);
  }
  list(value.restrictions, `${path}/restrictions`, 64); list(value.artifact_refs, `${path}/artifact_refs`, 128);
  safePublic(value, path); requireContract(!containsUnsafeReference(value), "ProbeEvidenceView contains unsafe reference", path);
  return value as unknown as ProbeEvidenceView;
}

function parseProposal(value: unknown, path: string): AssociationProposal {
  requireContract(isRecord(value) && identifier(value.operation_id) && (value.resource_id === null || identifier(value.resource_id)), "invalid proposal identity", path);
  requireContract(["PROPOSED", "UNKNOWN", "UNSUPPORTED"].includes(String(value.decision)) && isConfidence(value.confidence), "invalid proposal decision", path);
  const evidenceIds = list(value.evidence_ids, `${path}/evidence_ids`); list(value.missing_evidence, `${path}/missing_evidence`); list(value.limitations, `${path}/limitations`, 24);
  requireContract(typeof value.rationale === "string" && value.rationale.length <= 1000 && typeof value.requires_user_confirmation === "boolean", "invalid proposal explanation", path);
  requireContract(value.decision !== "PROPOSED" || evidenceIds.length > 0, "PROPOSED proposal must cite evidence", path);
  return value as unknown as AssociationProposal;
}

export function parseAssociationReport(value: unknown, path = "association_report"): AssociationReport {
  requireContract(isRecord(value) && value.schema_version === "association-report/v1", "invalid AssociationReport schema", path);
  requireContract(identifier(value.association_id) && (value.parent_association_id === null || identifier(value.parent_association_id)), "invalid association identity", path);
  requireContract(identifier(value.robot_id) && digest(value.target_fingerprint) && identifier(value.snapshot_id) && digest(value.evidence_view_digest) && (value.evidence_delta_digest === null || digest(value.evidence_delta_digest)), "invalid association binding", path);
  requireContract(Array.isArray(value.proposals), "invalid association proposals", path);
  const proposals = value.proposals.map((item, index) => parseProposal(item, `${path}/proposals/${index}`));
  requireContract(new Set(proposals.map((item) => item.operation_id)).size === proposals.length, "duplicate operation proposal", path);
  list(value.unresolved, `${path}/unresolved`); requireContract(typeof value.model_ref === "string" && value.model_ref.length <= 256 && digest(value.prompt_digest) && isTimestamp(value.generated_at), "invalid association audit metadata", path); list(value.limitations, `${path}/limitations`, 24);
  safePublic(value, path); requireContract(!containsUnsafeReference(value), "AssociationReport contains unsafe reference", path);
  return { ...value, proposals } as unknown as AssociationReport;
}

export function parseEvidenceRequest(value: unknown, path = "evidence_request"): EvidenceRequest {
  requireContract(isRecord(value) && value.schema_version === "evidence-request/v1" && value.kind === "READ_ONLY_EVIDENCE_REQUEST", "invalid EvidenceRequest schema", path);
  requireContract(identifier(value.request_id) && identifier(value.robot_id) && digest(value.target_fingerprint), "invalid EvidenceRequest identity", path);
  requireContract(typeof value.requested_signal === "string" && value.requested_signal.length > 0 && value.requested_signal.length <= 128 && (value.route_hint === null || typeof value.route_hint === "string"), "invalid EvidenceRequest signal", path);
  requireContract(typeof value.reason === "string" && value.reason.length <= 1000 && Number.isInteger(value.max_calls) && Number(value.max_calls) >= 1 && Number(value.max_calls) <= 5 && Number.isInteger(value.max_bytes) && Number(value.max_bytes) >= 1 && Number(value.max_bytes) <= 1048576 && Number.isInteger(value.freshness_ttl_s) && Number(value.freshness_ttl_s) >= 1 && Number(value.freshness_ttl_s) <= 3600, "invalid EvidenceRequest budget", path);
  requireContract(!/(?:write|reset|calibrate|setpoint|shell|exec|command)/i.test(`${value.requested_signal} ${value.route_hint ?? ""} ${value.reason}`), "EvidenceRequest asks for a prohibited operation", path);
  safePublic(value, path); requireContract(!containsUnsafeReference(value), "EvidenceRequest contains unsafe reference", path);
  return value as unknown as EvidenceRequest;
}

export function createUserIntentReceipt(proposal: AssociationProposal, context: Pick<AssociationReport, "robot_id" | "target_fingerprint" | "snapshot_id" | "association_id">, parameterDigest: string, risk: "R0" | "R1" | "R2", ttlSeconds = 300, now = new Date()): UserIntentReceipt {
  requireContract(proposal.decision === "PROPOSED" && proposal.requires_user_confirmation, "only confirmed PROPOSED proposals can create a receipt", "proposal");
  requireContract(proposal.evidence_ids.length > 0 && digest(parameterDigest), "receipt requires evidence and a parameter digest", "receipt");
  requireContract(Number.isInteger(ttlSeconds) && ttlSeconds >= 1 && ttlSeconds <= 3600, "receipt TTL is outside the bounded window", "receipt");
  const issuedAt = now.toISOString(); const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  return { schema_version: "user-intent-receipt/v1", receipt_id: `receipt-${now.getTime().toString(36)}`, status: "PENDING", robot_id: context.robot_id, target_fingerprint: context.target_fingerprint, snapshot_id: context.snapshot_id, association_id: context.association_id, operation_id: proposal.operation_id, resource_id: proposal.resource_id, parameter_digest: parameterDigest, scope: { kind: "OPERATION_RESOURCE", operation_id: proposal.operation_id, resource_id: proposal.resource_id }, risk, issued_at: issuedAt, expires_at: expiresAt, limitations: ["Receipt is an immutable user-intent artifact; it does not execute a device or Write Execution call."] };
}

export function parseUserIntentReceipt(value: unknown, path = "user_intent_receipt"): UserIntentReceipt {
  requireContract(isRecord(value) && value.schema_version === "user-intent-receipt/v1", "invalid UserIntentReceipt schema", path);
  requireContract(identifier(value.receipt_id) && ["PENDING", "REVOKED", "EXPIRED"].includes(String(value.status)), "invalid receipt identity", path);
  requireContract(identifier(value.robot_id) && digest(value.target_fingerprint) && identifier(value.snapshot_id) && identifier(value.association_id) && identifier(value.operation_id), "invalid receipt binding", path);
  requireContract(value.resource_id === null || identifier(value.resource_id), "invalid receipt resource", path);
  requireContract(digest(value.parameter_digest) && isRecord(value.scope) && value.scope.kind === "OPERATION_RESOURCE" && value.scope.operation_id === value.operation_id && value.scope.resource_id === value.resource_id, "invalid receipt scope", path);
  requireContract(["R0", "R1", "R2"].includes(String(value.risk)) && isTimestamp(value.issued_at) && isTimestamp(value.expires_at) && Date.parse(value.expires_at) > Date.parse(value.issued_at), "invalid receipt lifetime", path);
  list(value.limitations, `${path}/limitations`, 24); safePublic(value, path); requireContract(!containsUnsafeReference(value), "UserIntentReceipt contains unsafe reference", path);
  return value as unknown as UserIntentReceipt;
}
