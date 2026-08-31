import { containsUnsafeReference, isRecord, requireContract, isTimestamp } from "./guards.ts";
import { type DeviceHardeningEvidence } from "./deviceHardening.ts";

export type DeviceHardeningEvidenceStatus = "PENDING_EXTERNAL" | "BLOCKED" | "VERIFIED";
export type DeviceHardeningTargetKind = "local" | "ssh";

export interface DeviceHardeningEvidenceItem {
  scenario_id: string;
  status: DeviceHardeningEvidenceStatus;
  evidence?: DeviceHardeningEvidence;
}

export interface DeviceHardeningEvidenceBundle {
  schema_version: "rolo-vis-device-hardening-evidence/v1";
  release_line: string;
  rolo_revision: string;
  producer_revision: string;
  target_id: string;
  target_kind: DeviceHardeningTargetKind;
  evidence: DeviceHardeningEvidenceItem[];
}

const ID = /^[a-z][a-z0-9_-]{2,63}$/;
const REVISION = /^[0-9a-f]{7,64}$/i;
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const EXTERNAL_SCENARIOS = new Set([
  "linux-arm64", "linux-x86_64", "offline-install", "non-root-sudo",
  "ssh-jump-host", "host-key-rotation", "network-interruption", "restart-resume",
  "upgrade-rollback", "enrollment-rotation",
]);
const PRODUCER_RESTRICTED_REFERENCE = /artifact:\/\/|(?:ssh|https?):\/\/|known[_ -]?hosts?|private key|credential|password|secret|token|command|shell|argv|raw[_ -]?path|local[_ -]?path|remote[_ -]?path/i;

function containsProducerRestrictedReference(value: unknown): boolean {
  return PRODUCER_RESTRICTED_REFERENCE.test(JSON.stringify(value));
}

function boundedText(value: unknown, path: string, max = 160): string {
  requireContract(typeof value === "string" && value.length > 0 && value.length <= max, "device hardening evidence bundle text is invalid", path);
  return value;
}

function parseEvidence(value: unknown, path: string): DeviceHardeningEvidence {
  requireContract(isRecord(value), "device hardening evidence must be an object", path);
  requireContract(!containsUnsafeReference(value) && !containsProducerRestrictedReference(value), "device hardening evidence contains an unsafe reference", path);
  const packageDigest = boundedText(value.package_digest, `${path}/package_digest`);
  requireContract(/^[0-9a-f]{8,64}(?:…[0-9a-f]{8,64})?$/.test(packageDigest), "device hardening package digest is invalid", `${path}/package_digest`);
  requireContract(isTimestamp(value.observed_at), "device hardening evidence timestamp is invalid", `${path}/observed_at`);
  return {
    os: boundedText(value.os, `${path}/os`, 80),
    architecture: boundedText(value.architecture, `${path}/architecture`, 40),
    package_digest: packageDigest,
    job_id: boundedText(value.job_id, `${path}/job_id`, 128),
    gate_result: boundedText(value.gate_result, `${path}/gate_result`, 80),
    observed_at: String(value.observed_at),
    summary: boundedText(value.summary, `${path}/summary`, 240),
  };
}

export function parseDeviceHardeningEvidenceBundle(value: unknown, path = "device_hardening_evidence"): DeviceHardeningEvidenceBundle {
  requireContract(isRecord(value), "device hardening evidence bundle must be an object", path);
  requireContract(value.schema_version === "rolo-vis-device-hardening-evidence/v1", "unsupported device hardening evidence schema", path);
  requireContract(!containsUnsafeReference(value) && !containsProducerRestrictedReference(value), "device hardening evidence bundle contains an unsafe reference", path);
  requireContract(REVISION.test(String(value.rolo_revision)), "rolo revision is invalid", `${path}/rolo_revision`);
  requireContract(REVISION.test(String(value.producer_revision)), "producer revision is invalid", `${path}/producer_revision`);
  requireContract(OPAQUE_ID.test(String(value.target_id)), "target identity is invalid", `${path}/target_id`);
  requireContract(value.target_kind === "local" || value.target_kind === "ssh", "target kind is invalid", `${path}/target_kind`);
  requireContract(Array.isArray(value.evidence) && value.evidence.length > 0 && value.evidence.length <= EXTERNAL_SCENARIOS.size, "device hardening evidence items are invalid", `${path}/evidence`);
  const evidence = value.evidence.map((candidate, index) => {
    const itemPath = `${path}/evidence/${index}`;
    requireContract(isRecord(candidate), "device hardening evidence item must be an object", itemPath);
    const scenarioId = boundedText(candidate.scenario_id, `${itemPath}/scenario_id`, 64);
    requireContract(ID.test(scenarioId) && EXTERNAL_SCENARIOS.has(scenarioId), "unknown external hardening scenario", `${itemPath}/scenario_id`);
    const status = String(candidate.status) as DeviceHardeningEvidenceStatus;
    requireContract(["PENDING_EXTERNAL", "BLOCKED", "VERIFIED"].includes(status), "device hardening evidence status is invalid", `${itemPath}/status`);
    const rawEvidence = candidate.evidence;
    if (status === "VERIFIED") requireContract(rawEvidence !== undefined && rawEvidence !== null, "verified evidence item requires evidence", itemPath);
    return {
      scenario_id: scenarioId,
      status,
      ...(rawEvidence === undefined || rawEvidence === null ? {} : { evidence: parseEvidence(rawEvidence, `${itemPath}/evidence`) }),
    };
  });
  requireContract(new Set(evidence.map((item) => item.scenario_id)).size === evidence.length, "device hardening evidence scenarios must be unique", `${path}/evidence`);
  return {
    schema_version: "rolo-vis-device-hardening-evidence/v1",
    release_line: boundedText(value.release_line, `${path}/release_line`, 64),
    rolo_revision: String(value.rolo_revision),
    producer_revision: String(value.producer_revision),
    target_id: String(value.target_id),
    target_kind: value.target_kind as DeviceHardeningTargetKind,
    evidence,
  };
}
