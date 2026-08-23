import type {
  DiscoverySnapshotCollection,
  DiscoverySnapshotSummary,
  DiscoverySnapshotSummaryV1,
  DiscoverySnapshotSummaryV2,
  DiscoverySnapshotSummaryV3,
} from "../types/rolo.ts";
import { MVP_SCHEMA_COMPATIBILITY } from "./compatibility.ts";
import {
  containsUnsafeReference,
  isConfidence,
  isRecord,
  isStringArray,
  isTimestamp,
  requireContract,
} from "./guards.ts";

function parseDiscoveryHeuristicSummary(value: unknown, path: string) {
  requireContract(isRecord(value) && value.schema_version === "rolo-discovery-heuristic-summary/v1", "invalid discovery heuristic summary", path);
  requireContract(["disabled", "shadow", "enabled"].includes(String(value.mode)), "invalid discovery heuristic mode", path);
  requireContract(["AGENT_COMPLETED", "FALLBACK", "DISABLED"].includes(String(value.status)), "invalid discovery heuristic status", path);
  requireContract(Number.isInteger(value.inferred_operation_count) && Number(value.inferred_operation_count) >= 0, "invalid inferred Operation count", path);
  requireContract(Number.isInteger(value.missing_evidence_count) && Number(value.missing_evidence_count) >= 0, "invalid missing evidence count", path);
  requireContract(value.influences_release === false, "heuristic summary cannot influence release", path);
  if (value.mode === "disabled") {
    requireContract(value.status === "DISABLED" && value.inferred_operation_count === 0 && value.missing_evidence_count === 0, "inconsistent disabled heuristic summary", path);
  } else {
    requireContract(value.status !== "DISABLED", "active heuristic mode cannot be disabled", path);
  }
  requireContract(!containsUnsafeReference(value), "heuristic summary contains an unsafe reference", path);
}

function parseDiscoveryTargetEvidenceSummary(value: unknown, path: string) {
  requireContract(isRecord(value) && value.schema_version === "rolo-discovery-target-evidence-summary/v1", "invalid target evidence summary", path);
  const allowedKeys = new Set(["schema_version", "deployment_scope", "freshness", "collected_at", "refresh_required", "refresh_reason"]);
  requireContract(Object.keys(value).every((key) => allowedKeys.has(key)), "target evidence summary contains unsupported metadata", path);
  requireContract(["LOCAL", "REMOTE"].includes(String(value.deployment_scope)), "invalid target evidence scope", path);
  requireContract(["FRESH", "STALE"].includes(String(value.freshness)) && isTimestamp(value.collected_at), "invalid target evidence freshness", path);
  requireContract(typeof value.refresh_required === "boolean" && (value.refresh_reason === null || typeof value.refresh_reason === "string"), "invalid target evidence refresh metadata", path);
  if (value.freshness === "FRESH") {
    requireContract(value.refresh_required === false && value.refresh_reason === null, "fresh target evidence cannot require recollection", path);
  } else {
    requireContract(value.refresh_required === true && typeof value.refresh_reason === "string" && Boolean(value.refresh_reason), "stale target evidence must require recollection", path);
  }
  requireContract(!containsUnsafeReference(value), "target evidence summary contains an unsafe reference", path);
}

function parseDiscoverySnapshotSummary(value: unknown, path: string, robotId: string): DiscoverySnapshotSummary {
  requireContract(isRecord(value) && MVP_SCHEMA_COMPATIBILITY.discovery.summary.includes(String(value.schema_version) as never), "invalid discovery snapshot summary", path);
  requireContract(value.robot_id === robotId && typeof value.discovery_id === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value.discovery_id), "invalid discovery snapshot identity", path);
  requireContract(["SUCCEEDED", "PARTIAL", "UNAVAILABLE", "FAILED"].includes(String(value.status)), "invalid discovery snapshot status", path);
  requireContract(typeof value.discovery_mode === "string" && /^[A-Za-z0-9._-]{1,48}$/.test(value.discovery_mode), "invalid discovery mode", path);
  requireContract(isTimestamp(value.created_at) && typeof value.is_latest === "boolean", "invalid discovery snapshot metadata", path);
  const counts = [value.probe_total, value.observed_probes, value.partial_probes, value.unavailable_probes, value.operation_candidates, value.semantic_bindings, value.warning_count];
  requireContract(counts.every((item) => Number.isInteger(item) && Number(item) >= 0), "invalid discovery snapshot counts", path);
  requireContract(Number(value.observed_probes) + Number(value.partial_probes) + Number(value.unavailable_probes) === Number(value.probe_total), "inconsistent discovery probe coverage", path);
  requireContract(isConfidence(value.confidence) && value.integrity_status === "verified" && isStringArray(value.limitations), "invalid discovery snapshot trust metadata", path);
  if (value.schema_version === "rolo-discovery-snapshot-summary/v1") {
    requireContract(!containsUnsafeReference(value), "discovery snapshot contains an unsafe reference", path);
    return value as unknown as DiscoverySnapshotSummaryV1;
  }
  parseDiscoveryHeuristicSummary(value.heuristic_summary, `${path}/heuristic_summary`);
  if (value.schema_version === "rolo-discovery-snapshot-summary/v3") {
    if (value.target_evidence !== null) parseDiscoveryTargetEvidenceSummary(value.target_evidence, `${path}/target_evidence`);
    requireContract(!containsUnsafeReference(value), "discovery snapshot contains an unsafe reference", path);
    return value as unknown as DiscoverySnapshotSummaryV3;
  }
  requireContract(!containsUnsafeReference(value), "discovery snapshot contains an unsafe reference", path);
  return value as unknown as DiscoverySnapshotSummaryV2;
}

export function parseDiscoverySnapshotCollection(value: unknown, path: string, robotId: string): DiscoverySnapshotCollection {
  requireContract(isRecord(value) && MVP_SCHEMA_COMPATIBILITY.discovery.collection.includes(String(value.schema_version) as never), "unsupported discovery history schema", path);
  requireContract(value.robot_id === robotId && Array.isArray(value.items), "discovery history identity does not match request", path);
  const items = value.items.map((item, index) => parseDiscoverySnapshotSummary(item, `${path}/items/${index}`, robotId));
  const expectedItemSchema = value.schema_version === "rolo-discovery-snapshot-collection/v3"
    ? "rolo-discovery-snapshot-summary/v3"
    : value.schema_version === "rolo-discovery-snapshot-collection/v2"
      ? "rolo-discovery-snapshot-summary/v2"
      : "rolo-discovery-snapshot-summary/v1";
  requireContract(items.every((item) => item.schema_version === expectedItemSchema), "discovery history item schema does not match collection", path);
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
