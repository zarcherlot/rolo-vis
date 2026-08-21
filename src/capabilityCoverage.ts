import type {
  CapabilityAvailability,
  CapabilityLayer,
  CapabilitySummary,
} from "./types/rolo";

export const CAPABILITY_LAYERS: CapabilityLayer[] = [
  "Hardware",
  "Linux",
  "Middleware",
  "Application",
];

export const CAPABILITY_AVAILABILITY: CapabilityAvailability[] = [
  "VERIFIED",
  "AVAILABLE",
  "UNAVAILABLE",
  "UNKNOWN",
];

export interface CapabilityLayerCoverage {
  layer: CapabilityLayer;
  total: number;
  applicable: number;
  withBindings: number;
  released: number;
  elevatedRisk: number;
  availability: Record<CapabilityAvailability, number>;
}

export interface CapabilityCoverage {
  total: number;
  availability: Record<CapabilityAvailability, number>;
  layers: CapabilityLayerCoverage[];
}

function emptyAvailability(): Record<CapabilityAvailability, number> {
  return { VERIFIED: 0, AVAILABLE: 0, UNAVAILABLE: 0, UNKNOWN: 0 };
}

export function summarizeCapabilityCoverage(items: CapabilitySummary[]): CapabilityCoverage {
  const availability = emptyAvailability();
  for (const item of items) availability[item.availability] += 1;

  const layers = CAPABILITY_LAYERS.map((layer) => {
    const layerItems = items.filter((item) => item.layer === layer);
    const layerAvailability = emptyAvailability();
    for (const item of layerItems) layerAvailability[item.availability] += 1;
    return {
      layer,
      total: layerItems.length,
      applicable: layerItems.filter((item) => item.applicability === "APPLICABLE").length,
      withBindings: layerItems.filter((item) => item.binding_count > 0).length,
      released: layerItems.filter((item) => item.lifecycle === "RELEASED").length,
      elevatedRisk: layerItems.filter((item) => item.risk === "R2" || item.risk === "R3").length,
      availability: layerAvailability,
    } satisfies CapabilityLayerCoverage;
  });

  return { total: items.length, availability, layers };
}

export function capabilityCoveragePercent(count: number, total: number): string {
  return `${total > 0 ? (count / total) * 100 : 0}%`;
}
