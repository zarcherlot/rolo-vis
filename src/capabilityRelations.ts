import type { CapabilitySummary } from "./types/rolo";

export type CapabilityRelationKind = "paired" | "replacement" | "compensation";

export interface CapabilityFamilyGroup {
  family: string;
  items: CapabilitySummary[];
}

export interface CapabilityRelation {
  kind: CapabilityRelationKind;
  operation: string;
  capability: CapabilitySummary | null;
}

export function capabilityFamily(operation: string): string {
  const [namespace, object] = operation.split(".");
  return object ? `${namespace}.${object}` : operation;
}

export function groupCapabilitiesByFamily(items: CapabilitySummary[]): CapabilityFamilyGroup[] {
  const groups = new Map<string, CapabilitySummary[]>();
  for (const item of items) {
    const family = capabilityFamily(item.operation);
    groups.set(family, [...(groups.get(family) || []), item]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([family, familyItems]) => ({
      family,
      items: [...familyItems].sort((left, right) => left.operation.localeCompare(right.operation)),
    }));
}

export function capabilityRelations(
  item: CapabilitySummary,
  registry: CapabilitySummary[],
): CapabilityRelation[] {
  const byOperation = new Map(registry.map((capability) => [capability.operation, capability]));
  const declared: Array<[CapabilityRelationKind, string | null]> = [
    ["paired", item.paired_operation],
    ["replacement", item.replacement_operation],
    ["compensation", item.compensation_operation],
  ];
  return declared.flatMap(([kind, operation]) => operation ? [{
    kind,
    operation,
    capability: byOperation.get(operation) || null,
  }] : []);
}
