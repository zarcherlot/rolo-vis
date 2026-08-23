export const MVP_SCHEMA_COMPATIBILITY = {
  capability: {
    collection: ["rolo-capability-collection/v1", "rolo-capability-collection/v2"],
    summary: ["rolo-capability-summary/v1", "rolo-capability-summary/v2"],
    detail: ["rolo-capability-detail/v1", "rolo-capability-detail/v2"],
  },
  discovery: {
    collection: [
      "rolo-discovery-snapshot-collection/v1",
      "rolo-discovery-snapshot-collection/v2",
      "rolo-discovery-snapshot-collection/v3",
    ],
    summary: [
      "rolo-discovery-snapshot-summary/v1",
      "rolo-discovery-snapshot-summary/v2",
      "rolo-discovery-snapshot-summary/v3",
    ],
  },
} as const;

export const MVP_BASELINE = {
  id: "rolo-vis-mvp-readonly/2026-08",
  status: "baseline",
  mode: "read-only",
  backendMinimum: "ce735a8",
  frontendMinimum: "d5d856e",
} as const;

export function supportsSchema(
  family: keyof typeof MVP_SCHEMA_COMPATIBILITY,
  model: "collection" | "summary" | "detail",
  schemaVersion: unknown,
): boolean {
  const versions = MVP_SCHEMA_COMPATIBILITY[family][model as keyof (typeof MVP_SCHEMA_COMPATIBILITY)[typeof family]];
  return Array.isArray(versions) && versions.includes(schemaVersion as never);
}
