import {
  parseDeviceHardeningEvidenceBundle,
  type DeviceHardeningEvidenceBundle,
} from "./contracts/deviceHardeningEvidence.ts";
import {
  parseDeviceHardeningMatrix,
  type DeviceHardeningMatrix,
  type DeviceHardeningScenario,
} from "./contracts/deviceHardening.ts";
import { RoloContractError } from "./contracts/guards.ts";

export interface DeviceHardeningEvidenceImport {
  matrix: DeviceHardeningMatrix;
  bundle: DeviceHardeningEvidenceBundle;
  external_complete: boolean;
  promotion_status: "PENDING_EXTERNAL" | "BLOCKED" | "REVIEW_REQUIRED";
  limitations: string[];
}

/** Merge bounded producer evidence without granting baseline authority. */
export function importDeviceHardeningEvidence(rawMatrix: unknown, rawBundle: unknown): DeviceHardeningEvidenceImport {
  const matrix = parseDeviceHardeningMatrix(rawMatrix, "device_hardening_matrix");
  const bundle = parseDeviceHardeningEvidenceBundle(rawBundle, "device_hardening_bundle");
  if (bundle.release_line !== matrix.release_line) {
    throw new RoloContractError("device hardening release line does not match matrix", "device_hardening_bundle/release_line");
  }
  const byScenario = new Map(bundle.evidence.map((item) => [item.scenario_id, item]));
  const scenarios: DeviceHardeningScenario[] = matrix.scenarios.map((scenario) => {
    if (scenario.class !== "external") return scenario;
    const item = byScenario.get(scenario.id);
    if (!item) return scenario;
    if (item.status === "VERIFIED" && item.evidence) return { ...scenario, status: "VERIFIED", evidence: item.evidence };
    return { ...scenario, status: item.status, ...(item.evidence ? { evidence: item.evidence } : {}) };
  });
  const unresolved = scenarios.filter((scenario) => scenario.class === "external" && scenario.status !== "VERIFIED");
  const blocked = unresolved.some((scenario) => scenario.status === "BLOCKED");
  return {
    matrix: { ...matrix, scenarios },
    bundle,
    external_complete: unresolved.length === 0,
    promotion_status: blocked ? "BLOCKED" : unresolved.length > 0 ? "PENDING_EXTERNAL" : "REVIEW_REQUIRED",
    limitations: [
      "Producer evidence is imported as a bounded summary; artifact bytes and raw transport details remain unavailable.",
      "Candidate-to-baseline promotion is not automatic and requires human review even when all external scenarios are VERIFIED.",
      ...unresolved.map((scenario) => `${scenario.id}: ${scenario.status}`),
    ],
  };
}
