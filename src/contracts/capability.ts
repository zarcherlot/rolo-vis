import type {
  CapabilityCollection,
  CapabilityDetail,
  CapabilitySummary,
  CapabilitySummaryV1,
  CapabilitySummaryV2,
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

function parseCapabilitySummary(value: unknown, path: string): CapabilitySummary {
  requireContract(isRecord(value), "capability summary must be an object", path);
  requireContract(MVP_SCHEMA_COMPATIBILITY.capability.summary.includes(String(value.schema_version) as never), "unsupported capability summary schema", path);
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
  if (value.schema_version === "rolo-capability-summary/v1") return value as unknown as CapabilitySummaryV1;
  requireContract(Number.isInteger(value.inferred_binding_count) && Number(value.inferred_binding_count) >= 0, "invalid inferred binding count", path);
  requireContract(value.candidate_origin === null || ["DETERMINISTIC", "HEURISTIC_AGENT"].includes(String(value.candidate_origin)), "invalid candidate origin", path);
  requireContract(value.candidate_verification_status === null || value.candidate_verification_status === "DISCOVERED_UNVERIFIED", "invalid candidate verification status", path);
  requireContract((value.candidate_origin === null) === (value.candidate_verification_status === null), "inconsistent candidate provenance", path);
  return value as unknown as CapabilitySummaryV2;
}

export function parseCapabilityCollection(
  value: unknown,
  path: string,
  robotId: string,
  expectedPage: { limit: number; offset: number },
): CapabilityCollection {
  requireContract(isRecord(value), "capability collection must be an object", path);
  requireContract(MVP_SCHEMA_COMPATIBILITY.capability.collection.includes(String(value.schema_version) as never), "unsupported capability collection schema", path);
  requireContract(value.robot_id === robotId && Array.isArray(value.items), "invalid capability collection identity or items", path);
  const items = value.items.map((item, index) => parseCapabilitySummary(item, `${path}/items/${index}`));
  const expectedItemSchema = value.schema_version === "rolo-capability-collection/v2" ? "rolo-capability-summary/v2" : "rolo-capability-summary/v1";
  requireContract(items.every((item) => item.schema_version === expectedItemSchema), "capability item schema does not match collection", path);
  requireContract(new Set(items.map((item) => item.operation)).size === items.length, "capability page contains duplicate operations", path);
  requireContract(Number.isInteger(value.total) && Number(value.total) >= items.length, "invalid capability collection total", path);
  requireContract(value.limit === expectedPage.limit && value.offset === expectedPage.offset && items.length <= expectedPage.limit, "capability collection does not match the requested page", path);
  requireContract(value.next_offset === null || (Number.isInteger(value.next_offset) && Number(value.next_offset) > Number(value.offset)), "invalid capability next offset", path);
  requireContract(isTimestamp(value.observed_at) && ["fresh", "unknown"].includes(String(value.freshness)), "invalid capability observation metadata", path);
  requireContract(["product_registry", "discovery", "gated_release"].includes(String(value.source_kind)) && isStringArray(value.limitations), "invalid capability source metadata", path);
  return { ...value, items } as unknown as CapabilityCollection;
}

export function parseCapabilityDetail(value: unknown, path: string, robotId: string, operation: string): CapabilityDetail {
  requireContract(isRecord(value), "capability detail must be an object", path);
  requireContract(MVP_SCHEMA_COMPATIBILITY.capability.detail.includes(String(value.schema_version) as never) && value.robot_id === robotId, "invalid capability detail identity", path);
  const capability = parseCapabilitySummary(value.capability, `${path}/capability`);
  const expectedSummarySchema = value.schema_version === "rolo-capability-detail/v2" ? "rolo-capability-summary/v2" : "rolo-capability-summary/v1";
  requireContract(capability.schema_version === expectedSummarySchema, "capability summary schema does not match detail", path);
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
  if (value.schema_version === "rolo-capability-detail/v2") {
    requireContract(Array.isArray(value.inferred_bindings), "inferred capability bindings must be an array", path);
    for (const [index, inference] of value.inferred_bindings.entries()) {
      const inferencePath = `${path}/inferred_bindings/${index}`;
      requireContract(isRecord(inference) && inference.schema_version === "rolo-capability-inferred-binding/v1", "invalid inferred capability binding", inferencePath);
      requireContract(typeof inference.inference_id === "string" && typeof inference.endpoint === "string" && typeof inference.kind === "string", "invalid inferred binding identity", inferencePath);
      requireContract(inference.origin === "HEURISTIC_AGENT" && inference.verification_status === "DISCOVERED_UNVERIFIED", "invalid inferred binding provenance", inferencePath);
      requireContract(["OBSERVED", "DECLARED"].includes(String(inference.authority)), "invalid inferred route authority", inferencePath);
      requireContract(inference.observed_at === null || isTimestamp(inference.observed_at), "invalid inferred binding observation time", inferencePath);
      requireContract(/^[0-9a-f]{64}$/.test(String(inference.reference_digest)) && isStringArray(inference.limitations), "invalid inferred binding evidence", inferencePath);
      requireContract(!containsUnsafeReference(inference), "inferred binding contains an unsafe reference", inferencePath);
    }
    requireContract(value.inferred_bindings.length === (capability as CapabilitySummaryV2).inferred_binding_count, "inferred binding count does not match detail", path);
  }
  requireContract(isTimestamp(value.observed_at) && ["fresh", "unknown"].includes(String(value.freshness)), "invalid capability detail observation metadata", path);
  return { ...value, capability } as unknown as CapabilityDetail;
}
