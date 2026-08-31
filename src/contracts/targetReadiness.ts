import type {
  ApprovalGateSummary,
  ApprovalStatus,
  BootstrapAction,
  BootstrapPlanStatus,
  BootstrapRisk,
  GateStatus,
  TargetCompanionStatus,
  TargetConnectionState,
  TargetReadinessSummary,
  TargetReadinessCollection,
  ApprovalGateCollection,
} from "../types/rolo";
import { containsUnsafeReference, isRecord, isStringArray, isTimestamp, requireContract } from "./guards.ts";

const TARGET_STATES: TargetConnectionState[] = ["READY", "HOST_KEY_REQUIRED", "UNREACHABLE", "WORKSPACE_MISSING", "UNSUPPORTED"];
const COMPANION_STATES: TargetCompanionStatus[] = ["NOT_REQUIRED", "AVAILABLE", "MISSING", "UNKNOWN"];
const PLAN_STATES: BootstrapPlanStatus[] = ["READY", "APPROVAL_REQUIRED", "BLOCKED"];
const APPROVAL_STATES: ApprovalStatus[] = ["PENDING", "APPROVED", "REJECTED", "EXPIRED"];
const GATE_STATES: GateStatus[] = ["PENDING", "PASSED", "FAILED", "BLOCKED"];
const RECOVERY_STATES = ["NOT_REQUIRED", "AVAILABLE", "BLOCKED", "UNKNOWN"] as const;
const BOOTSTRAP_ACTIONS: BootstrapAction[] = ["VERIFY_PLATFORM", "VERIFY_WORKSPACE", "INSTALL_COMPANION", "HEALTH_CHECK"];
const BOOTSTRAP_RISKS: BootstrapRisk[] = ["READ_ONLY", "HOST_MUTATION"];

function isNullableBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === "boolean";
}

function requireSafeTextArray(value: unknown, message: string, path: string, maxItems = 10, maxLength = 256): asserts value is string[] {
  requireContract(isStringArray(value) && value.length <= maxItems && value.every((item) => item.length >= 1 && item.length <= maxLength) && !containsUnsafeReference(value), message, path);
}

function parseCommonObservation(value: Record<string, unknown>, path: string): void {
  requireContract(isTimestamp(value.observed_at), "invalid observation timestamp", path);
  requireContract(["fresh", "stale", "unknown"].includes(String(value.freshness)), "invalid freshness", path);
  requireContract(typeof value.producer_revision === "string" && /^[a-f0-9]{64}$/.test(value.producer_revision), "invalid producer revision", path);
  requireContract(value.contains_secret_payloads === false, "read model must not contain secrets", path);
}

/** Parse the sanitized E24C projection without accepting producer-side paths or secrets. */
export function parseTargetReadinessSummary(value: unknown, path: string): TargetReadinessSummary {
  requireContract(isRecord(value), "target readiness summary must be an object", path);
  requireContract(value.schema_version === "rolo-target-readiness-summary/v1", "unsupported target readiness schema", path);
  requireContract(typeof value.target_id === "string" && /^[a-z][a-z0-9_-]{2,63}$/.test(value.target_id), "invalid target identity", path);
  requireContract(value.target_kind === "local" || value.target_kind === "ssh", "invalid target kind", path);
  requireContract(TARGET_STATES.includes(value.state as TargetConnectionState), "invalid target readiness state", path);
  requireContract(typeof value.reachable === "boolean", "invalid target reachability", path);
  requireContract(isNullableBoolean(value.host_key_pinned), "invalid target host-key state", path);
  requireContract(value.platform === null || typeof value.platform === "string", "invalid target platform", path);
  requireContract(value.architecture === null || typeof value.architecture === "string", "invalid target architecture", path);
  requireContract(typeof value.workspace_accessible === "boolean", "invalid workspace accessibility", path);
  requireContract(COMPANION_STATES.includes(value.companion as TargetCompanionStatus), "invalid companion state", path);
  requireSafeTextArray(value.blockers, "invalid target readiness blockers", `${path}/blockers`);
  requireSafeTextArray(value.diagnostics, "invalid target readiness diagnostics", `${path}/diagnostics`);
  requireSafeTextArray(value.limitations, "invalid target readiness limitations", `${path}/limitations`);
  requireContract(value.platform === null || (typeof value.platform === "string" && value.platform.length <= 256), "invalid target platform", path);
  requireContract(value.architecture === null || (typeof value.architecture === "string" && value.architecture.length <= 256), "invalid target architecture", path);
  parseCommonObservation(value, path);
  requireContract(!containsUnsafeReference(value), "target readiness contains an unsafe reference", path);
  return value as unknown as TargetReadinessSummary;
}

export function parseTargetReadinessCollection(value: unknown, path: string, expectedPage?: { limit: number; offset: number }): TargetReadinessCollection {
  requireContract(isRecord(value), "target readiness collection must be an object", path);
  requireContract(value.schema_version === "rolo-target-readiness-collection/v1", "unsupported target readiness collection schema", path);
  requireContract(Array.isArray(value.items), "invalid target readiness items", path);
  const items = value.items.map((item, index) => parseTargetReadinessSummary(item, `${path}/items/${index}`));
  requireContract(new Set(items.map((item) => item.target_id)).size === items.length, "target readiness collection contains duplicates", path);
  requireContract(Number.isInteger(value.total) && Number(value.total) >= items.length, "invalid target readiness total", path);
  requireContract(Number.isInteger(value.limit) && Number(value.limit) >= 1 && Number(value.limit) <= 100 && items.length <= Number(value.limit), "invalid target readiness limit", path);
  requireContract(Number.isInteger(value.offset) && Number(value.offset) >= 0, "invalid target readiness offset", path);
  requireContract(!expectedPage || (value.limit === expectedPage.limit && value.offset === expectedPage.offset), "target readiness page does not match request", path);
  requireContract(value.next_offset === null || (Number.isInteger(value.next_offset) && Number(value.next_offset) > Number(value.offset) && Number(value.next_offset) <= Number(value.total)), "invalid target readiness next offset", path);
  parseCommonObservation(value, path);
  requireContract(!containsUnsafeReference(value), "target readiness collection contains an unsafe reference", path);
  return { ...value, items } as unknown as TargetReadinessCollection;
}

/** Parse the sanitized E25 approval/gate/recovery projection. This is display-only. */
export function parseApprovalGateSummary(value: unknown, path: string): ApprovalGateSummary {
  requireContract(isRecord(value), "approval gate summary must be an object", path);
  requireContract(value.schema_version === "rolo-approval-gate-summary/v1", "unsupported approval gate schema", path);
  requireContract(typeof value.job_id === "string" && value.job_id.length > 0 && value.job_id.length <= 128, "missing approval job identity", path);
  requireContract(typeof value.target_id === "string" && value.target_id.length > 0 && value.target_id.length <= 128, "missing approval target identity", path);
  requireContract(typeof value.producer_revision === "string" && /^[a-f0-9]{64}$/.test(value.producer_revision), "invalid producer revision", path);
  requireContract(PLAN_STATES.includes(value.plan_status as BootstrapPlanStatus), "invalid bootstrap plan status", path);
  requireContract(Array.isArray(value.steps) && value.steps.length >= 1 && value.steps.length <= 8, "invalid bootstrap plan steps", path);
  for (const [index, step] of value.steps.entries()) {
    const stepPath = `${path}/steps/${index}`;
    requireContract(isRecord(step), "bootstrap step must be an object", stepPath);
    requireContract(BOOTSTRAP_ACTIONS.includes(step.action as BootstrapAction), "invalid bootstrap action", stepPath);
    requireContract(BOOTSTRAP_RISKS.includes(step.risk as BootstrapRisk), "invalid bootstrap risk", stepPath);
    requireContract(typeof step.approval_required === "boolean" && typeof step.description === "string" && step.description.length >= 1 && step.description.length <= 240, "invalid bootstrap step metadata", stepPath);
    requireContract(!containsUnsafeReference(step), "bootstrap step contains an unsafe reference", stepPath);
  }
  requireContract(new Set(value.steps.map((step) => isRecord(step) ? step.action : "")).size === value.steps.length, "duplicate bootstrap actions", path);
  requireSafeTextArray(value.required_approvals, "invalid required approval scopes", `${path}/required_approvals`, 8, 240);
  requireContract(value.approval_status === null || APPROVAL_STATES.includes(value.approval_status as ApprovalStatus), "invalid approval status", path);
  requireContract(GATE_STATES.includes(value.gate_status as GateStatus), "invalid gate status", path);
  requireContract(isStringArray(value.gate_checks) && value.gate_checks.length >= 1 && value.gate_checks.length <= 16 && value.gate_checks.every((item) => item.length >= 1 && item.length <= 240), "invalid gate checks", `${path}/gate_checks`);
  requireContract(new Set(value.gate_checks).size === value.gate_checks.length, "duplicate gate checks", path);
  requireContract(RECOVERY_STATES.includes(value.recovery_state as typeof RECOVERY_STATES[number]), "invalid recovery state", path);
  requireSafeTextArray(value.blockers, "invalid approval gate blockers", `${path}/blockers`, 10, 240);
  requireSafeTextArray(value.limitations, "invalid approval gate limitations", `${path}/limitations`, 10, 240);
  parseCommonObservation(value, path);
  requireContract(!containsUnsafeReference(value), "approval gate contains an unsafe reference", path);
  return value as unknown as ApprovalGateSummary;
}

export function parseApprovalGateCollection(value: unknown, path: string, expectedPage?: { limit: number; offset: number }): ApprovalGateCollection {
  requireContract(isRecord(value), "approval gate collection must be an object", path);
  requireContract(value.schema_version === "rolo-approval-gate-collection/v1", "unsupported approval gate collection schema", path);
  requireContract(Array.isArray(value.items), "invalid approval gate items", path);
  const items = value.items.map((item, index) => parseApprovalGateSummary(item, `${path}/items/${index}`));
  requireContract(new Set(items.map((item) => item.job_id)).size === items.length, "approval gate collection contains duplicates", path);
  requireContract(Number.isInteger(value.total) && Number(value.total) >= items.length, "invalid approval gate total", path);
  requireContract(Number.isInteger(value.limit) && Number(value.limit) >= 1 && Number(value.limit) <= 100 && items.length <= Number(value.limit), "invalid approval gate limit", path);
  requireContract(Number.isInteger(value.offset) && Number(value.offset) >= 0, "invalid approval gate offset", path);
  requireContract(!expectedPage || (value.limit === expectedPage.limit && value.offset === expectedPage.offset), "approval gate page does not match request", path);
  requireContract(value.next_offset === null || (Number.isInteger(value.next_offset) && Number(value.next_offset) > Number(value.offset) && Number(value.next_offset) <= Number(value.total)), "invalid approval gate next offset", path);
  parseCommonObservation(value, path);
  requireContract(!containsUnsafeReference(value), "approval gate collection contains an unsafe reference", path);
  return { ...value, items } as unknown as ApprovalGateCollection;
}
