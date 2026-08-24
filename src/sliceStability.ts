import type { SliceActivationOutcome, SliceRunObservation } from "./types/rolo";

export interface SliceObservationFilters {
  outcome: SliceActivationOutcome | "ALL";
  diagnosticsOnly: boolean;
}

export function hasSliceDiagnostics(observation: SliceRunObservation): boolean {
  return observation.outcome === "FALLBACK"
    || observation.alert_codes.length > 0
    || Boolean(observation.fallback_reason)
    || observation.agent_run_status === "FAILED"
    || observation.agent_run_status === "TIMED_OUT"
    || observation.gate_status === "FAILED"
    || observation.context_budget_exceeded;
}

export function filterSliceObservations(
  observations: SliceRunObservation[],
  filters: SliceObservationFilters,
): SliceRunObservation[] {
  return observations.filter((observation) => {
    if (filters.outcome !== "ALL" && observation.outcome !== filters.outcome) return false;
    if (filters.diagnosticsOnly && !hasSliceDiagnostics(observation)) return false;
    return true;
  });
}
