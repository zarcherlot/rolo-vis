import { containsUnsafeReference, isRecord, isTimestamp, requireContract } from "./guards.ts";

export type DeviceHardeningScenarioClass = "local" | "external";
export type DeviceHardeningScenarioStatus = "AUTOMATED_CHECKED" | "PENDING_EXTERNAL" | "BLOCKED" | "VERIFIED";

export interface DeviceHardeningEvidence {
  os: string;
  architecture: string;
  package_digest: string;
  job_id: string;
  gate_result: string;
  observed_at: string;
  summary: string;
}

export interface DeviceHardeningScenario {
  id: string;
  class: DeviceHardeningScenarioClass;
  status: DeviceHardeningScenarioStatus;
  evidence?: DeviceHardeningEvidence;
}

export interface DeviceHardeningMatrix {
  schema_version: "rolo-vis-device-hardening-matrix/v1";
  release_line: string;
  scenarios: DeviceHardeningScenario[];
}

const ID = /^[a-z][a-z0-9_-]{2,63}$/;
const DIGEST = /^[0-9a-f]{8,64}(?:…[0-9a-f]{8,64})?$/;
const MAX_SCENARIOS = 40;

function boundedText(value: unknown, path: string, max = 240): string {
  requireContract(typeof value === "string" && value.length > 0 && value.length <= max, "device hardening text is invalid", path);
  return value;
}

function parseEvidence(value: unknown, path: string): DeviceHardeningEvidence {
  requireContract(isRecord(value), "device hardening evidence must be an object", path);
  const packageDigest = boundedText(value.package_digest, `${path}/package_digest`, 160);
  requireContract(DIGEST.test(packageDigest), "device hardening package digest is invalid", `${path}/package_digest`);
  requireContract(isTimestamp(value.observed_at), "device hardening evidence timestamp is invalid", `${path}/observed_at`);
  requireContract(!containsUnsafeReference(value), "device hardening evidence contains an unsafe reference", path);
  return {
    os: boundedText(value.os, `${path}/os`, 80),
    architecture: boundedText(value.architecture, `${path}/architecture`, 40),
    package_digest: packageDigest,
    job_id: boundedText(value.job_id, `${path}/job_id`, 128),
    gate_result: boundedText(value.gate_result, `${path}/gate_result`, 80),
    observed_at: String(value.observed_at),
    summary: boundedText(value.summary, `${path}/summary`),
  };
}

export function parseDeviceHardeningMatrix(value: unknown, path = "device_hardening"): DeviceHardeningMatrix {
  requireContract(isRecord(value), "device hardening matrix must be an object", path);
  requireContract(value.schema_version === "rolo-vis-device-hardening-matrix/v1", "unsupported device hardening schema", path);
  requireContract(Array.isArray(value.scenarios) && value.scenarios.length > 0 && value.scenarios.length <= MAX_SCENARIOS, "device hardening scenarios are invalid", path);
  const scenarios = value.scenarios.map((candidate, index) => {
    const scenarioPath = `${path}/scenarios/${index}`;
    requireContract(isRecord(candidate), "device hardening scenario must be an object", scenarioPath);
    const id = boundedText(candidate.id, `${scenarioPath}/id`, 64);
    requireContract(ID.test(id), "device hardening scenario identity is invalid", `${scenarioPath}/id`);
    requireContract(candidate.class === "local" || candidate.class === "external", "device hardening scenario class is invalid", scenarioPath);
    requireContract(["AUTOMATED_CHECKED", "PENDING_EXTERNAL", "BLOCKED", "VERIFIED"].includes(String(candidate.status)), "device hardening scenario status is invalid", scenarioPath);
    if (candidate.class === "external") requireContract(candidate.status !== "AUTOMATED_CHECKED", "external scenario cannot be marked automated", scenarioPath);
    if (candidate.status === "VERIFIED") requireContract(candidate.evidence !== undefined, "verified scenario requires evidence", scenarioPath);
    return {
      id,
      class: candidate.class as DeviceHardeningScenarioClass,
      status: candidate.status as DeviceHardeningScenarioStatus,
      ...(candidate.evidence === undefined ? {} : { evidence: parseEvidence(candidate.evidence, `${scenarioPath}/evidence`) }),
    };
  });
  requireContract(new Set(scenarios.map((scenario) => scenario.id)).size === scenarios.length, "device hardening scenarios must be unique", path);
  return {
    schema_version: "rolo-vis-device-hardening-matrix/v1",
    release_line: boundedText(value.release_line, `${path}/release_line`, 64),
    scenarios,
  };
}

export function summarizeDeviceHardening(matrix: DeviceHardeningMatrix) {
  return matrix.scenarios.reduce((summary, scenario) => {
    summary.total += 1;
    summary[scenario.status] += 1;
    if (scenario.class === "external") summary.external += 1;
    return summary;
  }, {
    total: 0,
    external: 0,
    AUTOMATED_CHECKED: 0,
    PENDING_EXTERNAL: 0,
    BLOCKED: 0,
    VERIFIED: 0,
  });
}
