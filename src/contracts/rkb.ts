import type { MhsInventory, RkbProjection, ToolSurfaceReadModel } from "../types/rolo.ts";
import { containsUnsafeReference, isRecord, isStringArray, isTimestamp, requireContract } from "./guards.ts";

function base(value: unknown, schema: string, path: string): Record<string, unknown> {
  requireContract(isRecord(value) && value.schema_version === schema, `invalid ${schema}`, path);
  requireContract(typeof value.robot_id === "string" && typeof value.snapshot_digest === "string", "invalid read-model identity", path);
  requireContract(!containsUnsafeReference(value), "read-model contains unsafe reference", path);
  return value;
}

function queryResult(value: unknown, path: string): Record<string, unknown> {
  requireContract(isRecord(value) && value.schema_version === "rkb-typed-query-result/v1", "invalid typed query result", path);
  requireContract(["FRESH", "STALE", "UNKNOWN", "DISCOVERED_UNVERIFIED", "ELIGIBLE", "VERIFIED", "UNAVAILABLE"].includes(String(value.status)), "invalid typed query status", path);
  requireContract(value.value === null || isRecord(value.value) || Array.isArray(value.value), "invalid typed query value", path);
  requireContract(isStringArray(value.evidence_ids) && isStringArray(value.limitations) && typeof value.status_reason === "string", "invalid typed query metadata", path);
  if (value.observed_at !== undefined && value.observed_at !== null) requireContract(isTimestamp(value.observed_at), "invalid typed query observation", path);
  if (value.fresh_until !== undefined && value.fresh_until !== null) requireContract(isTimestamp(value.fresh_until), "invalid typed query freshness", path);
  return value;
}

export function parseRkbProjection(value: unknown, path = "rkb"): RkbProjection {
  const record = base(value, "rkb-robot-knowledge-base/v1", path);
  requireContract(isTimestamp(record.observed_at) && isTimestamp(record.fresh_until) && record.access === "READ_ONLY", "invalid RKB envelope metadata", path);
  requireContract(isRecord(record.sections), "missing RKB sections", path);
  for (const section of ["identity", "os_runtime", "hardware", "middleware", "application", "episodes", "capabilities", "state_safety"]) queryResult(record.sections[section], `${path}/sections/${section}`);
  requireContract(isRecord(record.provenance) && isStringArray(record.provenance.evidence_ids) && isStringArray(record.provenance.limitations), "invalid RKB provenance", `${path}/provenance`);
  return record as unknown as RkbProjection;
}

export function parseMhsInventory(value: unknown, path = "mhs"): MhsInventory {
  const record = base(value, "rolo-mhs-inventory/v1", path);
  requireContract(Array.isArray(record.items) && Number.isInteger(record.total) && Number.isInteger(record.offset) && Number.isInteger(record.limit), "invalid MHS collection", path);
  requireContract(isStringArray(record.limitations), "invalid MHS limitations", path);
  for (const [index, item] of record.items.entries()) {
    requireContract(isRecord(item) && item.schema_version === "rolo-mhs-device-read-model/v1", "invalid MHS device", `${path}/items/${index}`);
    requireContract(typeof item.device_id === "string" && typeof item.route === "string" && typeof item.callable === "boolean", "invalid MHS identity", `${path}/items/${index}`);
    requireContract(["REGISTERED", "UNREGISTERED", "REJECTED", "PENDING"].includes(String(item.registration)), "invalid MHS registration state", `${path}/items/${index}`);
    requireContract(["DISCOVERED_UNVERIFIED", "VERIFIED", "UNAVAILABLE", "STALE"].includes(String(item.tool_state)), "invalid MHS tool state", `${path}/items/${index}`);
    requireContract(item.callable === (item.tool_state === "VERIFIED"), "MHS callable state must be verification-bound", `${path}/items/${index}`);
  }
  return record as unknown as MhsInventory;
}

export function parseToolSurface(value: unknown, path = "tools"): ToolSurfaceReadModel {
  const record = base(value, "rolo-tool-surface/v1", path);
  requireContract(Array.isArray(record.items) && Number.isInteger(record.total) && Number.isInteger(record.offset) && Number.isInteger(record.limit), "invalid Tool Surface collection", path);
  requireContract(isStringArray(record.limitations), "invalid Tool Surface limitations", path);
  for (const [index, item] of record.items.entries()) {
    requireContract(isRecord(item) && item.schema_version === "rolo-tool-verification-read-model/v1", "invalid Tool verification record", `${path}/items/${index}`);
    requireContract(typeof item.operation_id === "string" && typeof item.reason === "string" && typeof item.verified === "boolean" && typeof item.agent_callable === "boolean", "invalid Tool verification identity", `${path}/items/${index}`);
    requireContract(item.verified === item.agent_callable, "Tool verification and callability diverged", `${path}/items/${index}`);
    if (item.conformance_status !== undefined) requireContract(["PASS", "FAIL", "MISSING"].includes(String(item.conformance_status)), "invalid Tool conformance status", `${path}/items/${index}`);
    requireContract(item.verified !== true || item.conformance_status === "PASS", "verified Tool has no passing conformance artifact", `${path}/items/${index}`);
    requireContract(isStringArray(item.evidence_ids) && isStringArray(item.limitations), "invalid Tool verification metadata", `${path}/items/${index}`);
  }
  return record as unknown as ToolSurfaceReadModel;
}
