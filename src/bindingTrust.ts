import type { CapabilityBinding } from "./types/rolo";

export interface BindingTrustSummary {
  total: number;
  gated: number;
  observed: number;
  declared: number;
  evidenceLinked: number;
  limitations: number;
}

export function summarizeBindingTrust(bindings: CapabilityBinding[]): BindingTrustSummary {
  return {
    total: bindings.length,
    gated: bindings.filter((binding) => binding.authority === "GATED").length,
    observed: bindings.filter((binding) => binding.authority === "OBSERVED").length,
    declared: bindings.filter((binding) => binding.authority === "DECLARED").length,
    evidenceLinked: bindings.filter((binding) => binding.evidence_ids.length > 0).length,
    limitations: bindings.reduce((count, binding) => count + binding.limitations.length, 0),
  };
}

export function bindingTrustStatement(binding: CapabilityBinding): string {
  if (binding.authority === "GATED") {
    return "Release-gated binding; task and physical outcome still require separate evidence.";
  }
  if (binding.authority === "OBSERVED") {
    return "Runtime route observed, but no gated adapter release is established by this binding.";
  }
  return "Declared discovery candidate; this does not establish runtime availability.";
}
