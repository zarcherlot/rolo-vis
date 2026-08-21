import type { CapabilityBinding, CapabilitySummary } from "./types/rolo";

export type ReadinessSignalState = "established" | "partial" | "missing" | "unknown";

export interface CapabilityReadinessSignal {
  id: "contract" | "applicability" | "registration" | "binding" | "availability" | "verification";
  label: string;
  value: string;
  state: ReadinessSignalState;
  statement: string;
}

function bindingSignal(bindings: CapabilityBinding[]): CapabilityReadinessSignal {
  const gated = bindings.filter((binding) => binding.authority === "GATED").length;
  const observed = bindings.filter((binding) => binding.authority === "OBSERVED").length;
  const declared = bindings.filter((binding) => binding.authority === "DECLARED").length;
  if (gated) return { id: "binding", label: "Binding authority", value: `${gated} gated`, state: "established", statement: "A release-gated adapter binding is present; this is not task outcome evidence." };
  if (observed) return { id: "binding", label: "Binding authority", value: `${observed} observed`, state: "partial", statement: "A runtime route was observed without a gated adapter release." };
  if (declared) return { id: "binding", label: "Binding authority", value: `${declared} declared`, state: "partial", statement: "A discovery candidate is declared but runtime availability is not established." };
  return { id: "binding", label: "Binding authority", value: "No binding", state: "missing", statement: "No endpoint binding is included in the trusted capability detail." };
}

export function capabilityReadinessSignals(
  capability: CapabilitySummary,
  bindings: CapabilityBinding[],
): CapabilityReadinessSignal[] {
  const contract: CapabilityReadinessSignal = capability.integrity_status === "verified"
    ? { id: "contract", label: "Contract integrity", value: "Verified", state: "established", statement: "The canonical contract is backed by verified integrity evidence." }
    : { id: "contract", label: "Contract integrity", value: "Validated", state: "partial", statement: "The canonical contract is structurally validated; this is not runtime verification." };

  const applicability: CapabilityReadinessSignal = capability.applicability === "APPLICABLE"
    ? { id: "applicability", label: "Applicability", value: "Applicable", state: "established", statement: "The operation is explicitly applicable to this robot read model." }
    : capability.applicability === "NOT_OBSERVED"
      ? { id: "applicability", label: "Applicability", value: "Not observed", state: "missing", statement: "Robot applicability was not observed; this is distinct from a failed invocation." }
      : { id: "applicability", label: "Applicability", value: "Unknown", state: "unknown", statement: "The read model does not establish applicability." };

  const registration: CapabilityReadinessSignal = capability.registration === "BUILTIN" || capability.registration === "REGISTERED"
    ? { id: "registration", label: "Registration", value: capability.registration, state: "established", statement: "The operation has an explicit product or adapter registration state." }
    : capability.registration === "STALE"
      ? { id: "registration", label: "Registration", value: "Stale", state: "partial", statement: "A registration exists but is marked stale by the read model." }
      : { id: "registration", label: "Registration", value: "Not registered", state: "missing", statement: "No current operation registration is established." };

  const availability: CapabilityReadinessSignal = capability.availability === "VERIFIED"
    ? { id: "availability", label: "Availability", value: "Verified", state: "established", statement: "The capability read model reports verified availability; physical outcome remains separate." }
    : capability.availability === "AVAILABLE"
      ? { id: "availability", label: "Availability", value: "Available", state: "partial", statement: "The capability is available but not reported as verified." }
      : capability.availability === "UNAVAILABLE"
        ? { id: "availability", label: "Availability", value: "Unavailable", state: "missing", statement: "The current capability read model reports this operation unavailable." }
        : { id: "availability", label: "Availability", value: "Unknown", state: "unknown", statement: "Availability is not established by the current read model." };

  const verification: CapabilityReadinessSignal = capability.last_verified_at && capability.evidence_ids.length
    ? { id: "verification", label: "Verification record", value: `${capability.evidence_ids.length} evidence`, state: "established", statement: "Verification time and opaque evidence references are both present." }
    : capability.last_verified_at || capability.evidence_ids.length
      ? { id: "verification", label: "Verification record", value: capability.last_verified_at ? "Timestamp only" : `${capability.evidence_ids.length} evidence`, state: "partial", statement: "The verification record is incomplete in this read model." }
      : { id: "verification", label: "Verification record", value: "Not verified", state: "missing", statement: "No verification timestamp or capability evidence reference is present." };

  return [contract, applicability, registration, bindingSignal(bindings), availability, verification];
}
