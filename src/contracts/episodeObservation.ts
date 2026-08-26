import type {
  EpisodeObservationBundleCollection,
  EpisodeObservationBundleStatus,
  EpisodeObservationBundleSummary,
  EpisodeObservationSourceAvailability,
  EpisodeObservationSourceCoverage,
  EpisodeObservationSourceKind,
  EpisodeObservationSpatialAlignment,
  EpisodeObservationWorldScope,
  EpisodeSynchronization,
  EpisodeWorldKind,
} from "../types/rolo.ts";
import { isRecord, isStringArray, requireContract } from "./guards.ts";
import { supportsEpisodeSchema } from "./compatibility.ts";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const AWARE_TIMESTAMP = /(?:Z|[+-]\d{2}:\d{2})$/;
const CURSOR = /^epobcur_[0-9a-f]{40}$/;
const UNSAFE_STRING = /(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/)|(?:[A-Za-z]:[\\/])|(?:\\\\[^\\\s]+\\[^\\\s]+)|(?:\/(?:home|Users|tmp|var|etc|opt|srv|mnt|Volumes|dev)\/)/;

const SYNCHRONIZATION: EpisodeSynchronization[] = ["SYNCED", "DEGRADED", "UNSYNCED", "UNKNOWN"];
const SPATIAL_ALIGNMENT: EpisodeObservationSpatialAlignment[] = ["ALIGNED", "DEGRADED", "UNALIGNED", "UNKNOWN"];
const WORLD_KINDS: EpisodeWorldKind[] = ["PHYSICAL", "SIMULATED", "REPLAYED"];
const WORLD_SCOPES: EpisodeObservationWorldScope[] = ["NONE", "PHYSICAL_ONLY", "SIMULATED_ONLY", "REPLAYED_ONLY", "MIXED"];
const SOURCE_KINDS: EpisodeObservationSourceKind[] = [
  "ONBOARD_SENSOR",
  "EXTERNAL_MEASUREMENT",
  "ROBOT_STATE",
  "SPATIAL_MODEL",
  "DETERMINISTIC_RENDER",
  "TRUSTED_GUI_CAPTURE",
  "SIMULATION",
];
const AVAILABILITY: EpisodeObservationSourceAvailability[] = ["AVAILABLE", "MISSING", "STALE", "REJECTED", "UNAVAILABLE"];
const BUNDLE_STATUS: EpisodeObservationBundleStatus[] = ["COMPLETE", "PARTIAL", "UNAVAILABLE"];

interface EpisodeObservationIdentity {
  robotId: string;
  episodeId: string;
  revision: number;
}

export interface EpisodeObservationValidationContext extends EpisodeObservationIdentity {
  episodeDurationMs: number;
  assetIds: ReadonlySet<string>;
  evidenceIds: ReadonlySet<string>;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function isAwareTimestamp(value: unknown): value is string {
  return typeof value === "string" && AWARE_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value));
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1;
}

function isIdentifierArray(value: unknown, max = 256): value is string[] {
  return isStringArray(value)
    && value.length <= max
    && value.every(isIdentifier)
    && new Set(value).size === value.length;
}

function isLimitationArray(value: unknown): value is string[] {
  return isStringArray(value)
    && value.length <= 32
    && value.every((item) => item.length >= 1 && item.length <= 2_048 && !UNSAFE_STRING.test(item));
}

function requireOnlyKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  requireContract(extras.length === 0, `unexpected Observation Bundle field: ${extras[0] || "unknown"}`, path);
}

function requireSafePublicContent(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => requireSafePublicContent(item, `${path}/${index}`));
    return;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      requireContract(!/(?:artifact|path|uri|url|provider|collector|topic|device|host|credential|secret|token|command|payload|telemetry|calibration|renderer|prompt|model_response|raw_context|internal_metadata)/i.test(key), `unsafe Observation Bundle field: ${key}`, path);
      requireSafePublicContent(child, `${path}/${key}`);
    }
    return;
  }
  if (typeof value === "string") requireContract(!UNSAFE_STRING.test(value), "unsafe Observation Bundle string", path);
}

function requireIdentity(value: Record<string, unknown>, identity: EpisodeObservationIdentity, path: string): void {
  requireContract(
    value.robot_id === identity.robotId
      && value.episode_id === identity.episodeId
      && value.episode_revision === identity.revision,
    "Observation Bundle identity or revision does not match the pinned Episode",
    path,
  );
}

function deriveWorldScope(sources: EpisodeObservationSourceCoverage[]): EpisodeObservationWorldScope {
  const worldKinds = new Set(sources.filter((source) => source.asset_ids.length > 0).map((source) => source.world_kind));
  if (worldKinds.size === 0) return "NONE";
  if (worldKinds.size > 1) return "MIXED";
  const [worldKind] = worldKinds;
  if (worldKind === "PHYSICAL") return "PHYSICAL_ONLY";
  if (worldKind === "SIMULATED") return "SIMULATED_ONLY";
  return "REPLAYED_ONLY";
}

function parseSource(
  value: unknown,
  path: string,
  identity: EpisodeObservationIdentity & { bundleId: string },
  allowedAssetIds: ReadonlySet<string>,
): EpisodeObservationSourceCoverage {
  requireContract(isRecord(value), "Observation source must be an object", path);
  requireOnlyKeys(value, [
    "schema_version", "robot_id", "episode_id", "episode_revision", "bundle_id",
    "source_id", "label", "source_kind", "modality", "world_kind", "availability",
    "synchronization", "spatial_alignment", "asset_ids", "limitations",
  ], path);
  requireContract(supportsEpisodeSchema("observationSourceCoverage", value.schema_version), "unsupported Observation source schema", path);
  requireIdentity(value, identity, path);
  requireContract(value.bundle_id === identity.bundleId && isIdentifier(value.source_id), "invalid Observation source identity", path);
  requireContract(typeof value.label === "string" && value.label.length >= 1 && value.label.length <= 256, "invalid Observation source label", path);
  requireContract(SOURCE_KINDS.includes(value.source_kind as EpisodeObservationSourceKind) && isIdentifier(value.modality), "invalid Observation source kind or modality", path);
  requireContract(WORLD_KINDS.includes(value.world_kind as EpisodeWorldKind), "invalid Observation source world kind", path);
  requireContract(AVAILABILITY.includes(value.availability as EpisodeObservationSourceAvailability), "invalid Observation source availability", path);
  requireContract(SYNCHRONIZATION.includes(value.synchronization as EpisodeSynchronization), "invalid Observation source synchronization", path);
  requireContract(SPATIAL_ALIGNMENT.includes(value.spatial_alignment as EpisodeObservationSpatialAlignment), "invalid Observation source spatial alignment", path);
  requireContract(isIdentifierArray(value.asset_ids) && value.asset_ids.every((assetId) => allowedAssetIds.has(assetId)), "Observation source references an unknown Episode asset", path);
  requireContract(isLimitationArray(value.limitations), "invalid Observation source limitations", path);
  if (["MISSING", "REJECTED", "UNAVAILABLE"].includes(String(value.availability))) {
    requireContract(value.asset_ids.length === 0, "non-bearing Observation source cannot reference assets", path);
  }
  const degraded = value.availability !== "AVAILABLE" || value.synchronization !== "SYNCED" || value.spatial_alignment !== "ALIGNED";
  if (degraded) requireContract(value.limitations.length > 0, "degraded Observation source requires a limitation", path);
  return value as unknown as EpisodeObservationSourceCoverage;
}

function parseBundle(
  value: unknown,
  path: string,
  context: EpisodeObservationValidationContext,
): EpisodeObservationBundleSummary {
  requireContract(isRecord(value), "Observation Bundle must be an object", path);
  requireOnlyKeys(value, [
    "schema_version", "robot_id", "episode_id", "episode_revision", "bundle_id",
    "sequence", "parent_bundle_id", "trigger_kind", "status", "created_at",
    "window_start_offset_ms", "window_end_offset_ms", "synchronization",
    "spatial_alignment", "world_scope", "sources", "asset_ids", "evidence_ids",
    "limitations", "influences_verification",
  ], path);
  requireContract(supportsEpisodeSchema("observationBundleSummary", value.schema_version), "unsupported Observation Bundle schema", path);
  requireIdentity(value, context, path);
  requireContract(isIdentifier(value.bundle_id) && isPositiveInteger(value.sequence), "invalid Observation Bundle identity or sequence", path);
  requireContract(value.parent_bundle_id === null || isIdentifier(value.parent_bundle_id), "invalid Observation Bundle parent", path);
  requireContract(["INITIAL", "SUPPLEMENTARY"].includes(String(value.trigger_kind)), "invalid Observation Bundle trigger", path);
  requireContract(BUNDLE_STATUS.includes(value.status as EpisodeObservationBundleStatus), "invalid Observation Bundle status", path);
  requireContract(isAwareTimestamp(value.created_at), "invalid Observation Bundle timestamp", path);
  requireContract(
    isNonNegativeInteger(value.window_start_offset_ms)
      && isPositiveInteger(value.window_end_offset_ms)
      && Number(value.window_end_offset_ms) > Number(value.window_start_offset_ms)
      && Number(value.window_end_offset_ms) <= context.episodeDurationMs,
    "Observation Bundle window is outside the pinned Episode",
    path,
  );
  requireContract(SYNCHRONIZATION.includes(value.synchronization as EpisodeSynchronization), "invalid Observation Bundle synchronization", path);
  requireContract(SPATIAL_ALIGNMENT.includes(value.spatial_alignment as EpisodeObservationSpatialAlignment), "invalid Observation Bundle spatial alignment", path);
  requireContract(WORLD_SCOPES.includes(value.world_scope as EpisodeObservationWorldScope), "invalid Observation Bundle world scope", path);
  requireContract(Array.isArray(value.sources) && value.sources.length <= 64, "invalid Observation Bundle sources", path);
  const sources = value.sources.map((source, index) => parseSource(source, `${path}/sources/${index}`, { ...context, bundleId: value.bundle_id as string }, context.assetIds));
  requireContract(new Set(sources.map((source) => source.source_id)).size === sources.length, "duplicate Observation source identity", path);
  requireContract(isIdentifierArray(value.asset_ids) && value.asset_ids.every((assetId) => context.assetIds.has(assetId)), "Observation Bundle references an unknown Episode asset", path);
  requireContract(isIdentifierArray(value.evidence_ids) && value.evidence_ids.every((evidenceId) => context.evidenceIds.has(evidenceId)), "Observation Bundle references unknown Evidence", path);
  requireContract(isLimitationArray(value.limitations), "invalid Observation Bundle limitations", path);
  requireContract(value.influences_verification === false, "Observation Bundle must not influence verification", path);
  const assetIds = value.asset_ids as string[];
  const sourceAssets = sources.flatMap((source) => source.asset_ids);
  requireContract(new Set(sourceAssets).size === sourceAssets.length, "an Episode asset belongs to multiple Observation sources", path);
  requireContract(sourceAssets.length === assetIds.length && sourceAssets.every((assetId) => assetIds.includes(assetId)), "Observation Bundle assets do not match source coverage", path);
  requireContract(value.world_scope === deriveWorldScope(sources), "Observation Bundle world scope is inconsistent", path);
  if (value.status === "UNAVAILABLE") requireContract(value.asset_ids.length === 0, "unavailable Observation Bundle cannot reference assets", path);
  if (value.status === "COMPLETE") requireContract(sources.every((source) => !["MISSING", "REJECTED", "UNAVAILABLE"].includes(source.availability)), "complete Observation Bundle contains an absent source", path);
  const degraded = value.status !== "COMPLETE" || value.synchronization !== "SYNCED" || value.spatial_alignment !== "ALIGNED" || value.world_scope === "MIXED";
  if (degraded) requireContract(value.limitations.length > 0, "degraded Observation Bundle requires a limitation", path);
  return { ...value, sources } as unknown as EpisodeObservationBundleSummary;
}

export function parseEpisodeObservationBundleCollection(
  value: unknown,
  path: string,
  context: EpisodeObservationValidationContext,
  expected: { limit: number; cursor?: string },
): EpisodeObservationBundleCollection {
  requireSafePublicContent(value, path);
  requireContract(isRecord(value), "Observation Bundle collection must be an object", path);
  requireOnlyKeys(value, [
    "schema_version", "robot_id", "episode_id", "episode_revision", "items", "limit",
    "cursor", "next_cursor", "as_of", "immutable", "limitations",
  ], path);
  requireContract(supportsEpisodeSchema("observationBundleCollection", value.schema_version), "unsupported Observation Bundle collection schema", path);
  requireIdentity(value, context, path);
  requireContract(expected.limit >= 1 && expected.limit <= 20 && value.limit === expected.limit, "Observation Bundle page limit does not match the request", path);
  requireContract(value.cursor === (expected.cursor ?? null), "Observation Bundle cursor does not match the request", path);
  requireContract(Array.isArray(value.items) && value.items.length <= expected.limit, "Observation Bundle page exceeds its bound", path);
  const items = value.items.map((item, index) => parseBundle(item, `${path}/items/${index}`, context));
  requireContract(items.every((item, index) => index === 0 || item.sequence < items[index - 1].sequence), "Observation Bundle page is not newest-first", path);
  requireContract(new Set(items.map((item) => item.bundle_id)).size === items.length && new Set(items.map((item) => item.sequence)).size === items.length, "duplicate Observation Bundle identity or sequence", path);
  requireContract(value.next_cursor === null || (typeof value.next_cursor === "string" && CURSOR.test(value.next_cursor)), "invalid Observation Bundle next cursor", path);
  requireContract(value.next_cursor === null || value.next_cursor !== value.cursor, "Observation Bundle cursor did not advance", path);
  requireContract(isAwareTimestamp(value.as_of) && value.immutable === true && isLimitationArray(value.limitations), "invalid Observation Bundle collection metadata", path);
  return { ...value, items } as unknown as EpisodeObservationBundleCollection;
}

export function appendObservationBundlePage(
  current: EpisodeObservationBundleSummary[],
  incoming: EpisodeObservationBundleSummary[],
): EpisodeObservationBundleSummary[] {
  const combined = [...current, ...incoming];
  requireContract(new Set(combined.map((item) => item.bundle_id)).size === combined.length, "Observation Bundle pages repeat a bundle identity", "/observation-bundles");
  requireContract(new Set(combined.map((item) => item.sequence)).size === combined.length, "Observation Bundle pages repeat a sequence", "/observation-bundles");
  requireContract(combined.every((item, index) => index === 0 || item.sequence < combined[index - 1].sequence), "Observation Bundle pages are not globally newest-first", "/observation-bundles");
  return combined;
}

export function validateCompleteObservationBundleHistory(items: EpisodeObservationBundleSummary[]): void {
  const byId = new Map(items.map((item) => [item.bundle_id, item]));
  for (const item of items) {
    if (item.trigger_kind === "SUPPLEMENTARY") requireContract(item.parent_bundle_id !== null, "supplementary Observation Bundle requires a parent", "/observation-bundles");
    if (item.parent_bundle_id === null) continue;
    const parent = byId.get(item.parent_bundle_id);
    requireContract(Boolean(parent), "Observation Bundle history contains a dangling parent", "/observation-bundles");
    requireContract(Number(parent?.sequence) < item.sequence, "Observation Bundle parent must have a lower sequence", "/observation-bundles");
    const seen = new Set([item.bundle_id]);
    let cursor: EpisodeObservationBundleSummary | undefined = parent;
    while (cursor) {
      requireContract(!seen.has(cursor.bundle_id), "Observation Bundle history contains a parent cycle", "/observation-bundles");
      seen.add(cursor.bundle_id);
      cursor = cursor.parent_bundle_id ? byId.get(cursor.parent_bundle_id) : undefined;
    }
  }
}
