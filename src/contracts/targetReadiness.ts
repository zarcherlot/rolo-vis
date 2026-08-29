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
} from "../types/rolo";
import { containsUnsafeReference, isRecord, isStringArray, requireContract } from "./guards.ts";

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

function requireSafeTextArray(value: unknown, message: string, path: string): asserts value is string[] {
  requireContract(isStringArray(value) && !containsUnsafeReference(value), message, path);
}

/** Parse the sanitized E24C projection without accepting producer-side paths or secrets. */
export function parseTargetReadinessSummary(value: unknown, path: string): TargetReadinessSummary {
  requireContract(isRecord(value), "target readiness summary must be an object", path);
  requireContract(value.schema_version === "rolo-target-readiness-summary/v1", "unsupported target readiness schema", path);
  requireContract(typeof value.target_id === "string" && value.target_id.length > 0, "missing target identity", path);
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
  requireContract(value.contains_secret_payloads === false, "target readiness must not contain secrets", path);
  requireContract(!containsUnsafeReference(value), "target readiness contains an unsafe reference", path);
  return value as unknown as TargetReadinessSummary;
}

/** Parse the sanitized E25 approval/gate/recovery projection. This is display-only. */
export function parseApprovalGateSummary(value: unknown, path: string): ApprovalGateSummary {
  requireContract(isRecord(value), "approval gate summary must be an object", path);
  requireContract(value.schema_version === "rolo-approval-gate-summary/v1", "unsupported approval gate schema", path);
  requireContract(typeof value.job_id === "string" && value.job_id.length > 0, "missing approval job identity", path);
  requireContract(typeof value.target_id === "string" && value.target_id.length > 0, "missing approval target identity", path);
  requireContract(PLAN_STATES.includes(value.plan_status as BootstrapPlanStatus), "invalid bootstrap plan status", path);
  requireContract(Array.isArray(value.steps), "invalid bootstrap plan steps", path);
  for (const [index, step] of value.steps.entries()) {
    const stepPath = `${path}/steps/${index}`;
    requireContract(isRecord(step), "bootstrap step must be an object", stepPath);
    requireContract(BOOTSTRAP_ACTIONS.includes(step.action as BootstrapAction), "invalid bootstrap action", stepPath);
    requireContract(BOOTSTRAP_RISKS.includes(step.risk as BootstrapRisk), "invalid bootstrap risk", stepPath);
    requireContract(typeof step.approval_required === "boolean" && typeof step.description === "string", "invalid bootstrap step metadata", stepPath);
    requireContract(!containsUnsafeReference(step), "bootstrap step contains an unsafe reference", stepPath);
  }
  requireSafeTextArray(value.required_approvals, "invalid required approval scopes", `${path}/required_approvals`);
  requireContract(value.approval_status === null || APPROVAL_STATES.includes(value.approval_status as ApprovalStatus), "invalid approval status", path);
  requireContract(GATE_STATES.includes(value.gate_status as GateStatus), "invalid gate status", path);
  requireSafeTextArray(value.gate_checks, "invalid gate checks", `${path}/gate_checks`);
  requireContract(RECOVERY_STATES.includes(value.recovery_state as typeof RECOVERY_STATES[number]), "invalid recovery state", path);
  requireSafeTextArray(value.blockers, "invalid approval gate blockers", `${path}/blockers`);
  requireSafeTextArray(value.limitations, "invalid approval gate limitations", `${path}/limitations`);
  requireContract(value.contains_secret_payloads === false, "approval gate must not contain secrets", path);
  requireContract(!containsUnsafeReference(value), "approval gate contains an unsafe reference", path);
  return value as unknown as ApprovalGateSummary;
}
