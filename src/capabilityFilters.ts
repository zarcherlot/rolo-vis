import type {
  CapabilityAvailability,
  CapabilityLayer,
  CapabilitySummary,
} from "./types/rolo";

export type CapabilityRisk = CapabilitySummary["risk"];
export type CapabilityAccess = CapabilitySummary["access"];
export type CapabilityLifecycle = CapabilitySummary["lifecycle"];
export type CapabilityClassification = CapabilitySummary["data_classification"];

export interface CapabilityFilterState {
  query: string;
  layer: CapabilityLayer | "ALL";
  availability: CapabilityAvailability | "ALL";
  risk: CapabilityRisk | "ALL";
  access: CapabilityAccess | "ALL";
  lifecycle: CapabilityLifecycle | "ALL";
  classification: CapabilityClassification | "ALL";
}

export const CAPABILITY_RISKS: CapabilityRisk[] = ["R0", "R1", "R2", "R3"];
export const CAPABILITY_ACCESS: CapabilityAccess[] = ["read", "write"];
export const CAPABILITY_LIFECYCLES: CapabilityLifecycle[] = ["DRAFT", "GATEABLE", "RELEASED", "DEPRECATED"];
export const CAPABILITY_CLASSIFICATIONS: CapabilityClassification[] = ["PUBLIC", "INTERNAL", "SENSITIVE", "SECRET"];

export function capabilityMatchesFilters(
  item: CapabilitySummary,
  filters: CapabilityFilterState,
): boolean {
  const query = filters.query.trim().toLowerCase();
  const searchable = `${item.operation} ${item.description} ${item.layer}`.toLowerCase();
  return (!query || searchable.includes(query))
    && (filters.layer === "ALL" || item.layer === filters.layer)
    && (filters.availability === "ALL" || item.availability === filters.availability)
    && (filters.risk === "ALL" || item.risk === filters.risk)
    && (filters.access === "ALL" || item.access === filters.access)
    && (filters.lifecycle === "ALL" || item.lifecycle === filters.lifecycle)
    && (filters.classification === "ALL" || item.data_classification === filters.classification);
}

export function filterCapabilities(
  items: CapabilitySummary[],
  filters: CapabilityFilterState,
): CapabilitySummary[] {
  return items.filter((item) => capabilityMatchesFilters(item, filters));
}

export function activeGovernanceFilterCount(filters: CapabilityFilterState): number {
  return [filters.risk, filters.access, filters.lifecycle, filters.classification]
    .filter((value) => value !== "ALL").length;
}
