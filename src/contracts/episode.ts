import type {
  EpisodeAssetSummary,
  EpisodeAuthority,
  EpisodeCollection,
  EpisodeDetail,
  EpisodeFindingKind,
  EpisodeFindingSummary,
  EpisodeOutcome,
  EpisodeState,
  EpisodeSummary,
  EpisodeTimelineEvent,
  EpisodeTimelineLane,
  EpisodeTimelinePage,
  EpisodeVerification,
} from "../types/rolo.ts";
import {
  isConfidence,
  isRecord,
  isStringArray,
  requireContract,
} from "./guards.ts";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const MEDIA_TYPE = /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/;
const METRIC_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const AWARE_TIMESTAMP = /(?:Z|[+-]\d{2}:\d{2})$/;
const FORBIDDEN_KEYS = new Set([
  "artifact_ref", "artifact_path", "local_path", "remote_path", "source_path",
  "signed_url", "collector_identity", "credential", "credentials", "password",
  "secret", "token", "command_payload", "command_output", "model_prompt",
  "model_response", "prompt", "payload", "path", "raw_payload", "hostname",
  "uri", "url",
]);
const UNSAFE_STRING = /(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/)|(?:[A-Za-z]:[\\/])|(?:\\\\[^\\\s]+\\[^\\\s]+)|(?:\/(?:home|Users|tmp|var|etc|opt|srv|mnt|Volumes)\/)/;

const EPISODE_STATES: EpisodeState[] = ["RUNNING", "COMPLETED", "FAILED", "CANCELLED", "PARTIAL"];
const EPISODE_OUTCOMES: EpisodeOutcome[] = ["SUCCEEDED", "FAILED", "CANCELLED", "UNKNOWN"];
const EPISODE_VERIFICATIONS: EpisodeVerification[] = ["VERIFIED", "UNVERIFIED", "NOT_AVAILABLE"];
const EPISODE_LANES: EpisodeTimelineLane[] = ["COMMAND", "STATE", "TELEMETRY", "OBSERVATION", "ALERT", "AGENT", "CONFIGURATION", "CHECKPOINT", "GATE", "OUTCOME"];
const EPISODE_AUTHORITIES: EpisodeAuthority[] = ["DECLARED", "OBSERVED", "INFERRED", "HUMAN_CONFIRMED", "VERIFIED"];
const FINDING_AUTHORITIES: Record<EpisodeFindingKind, EpisodeAuthority> = {
  OBSERVED_FACT: "OBSERVED",
  CANDIDATE_CAUSE: "INFERRED",
  HUMAN_CONFIRMATION: "HUMAN_CONFIRMED",
  VERIFIED_OUTCOME: "VERIFIED",
};

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function isAwareTimestamp(value: unknown): value is string {
  return typeof value === "string" && AWARE_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value));
}

function isNullableIdentifier(value: unknown): value is string | null {
  return value === null || isIdentifier(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isIdentifierArray(value: unknown, max = 256): value is string[] {
  return isStringArray(value) && value.length <= max && value.every(isIdentifier);
}

function requireOnlyKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  requireContract(extras.length === 0, `unexpected Episode field: ${extras[0] || "unknown"}`, path);
}

function requireSafePublicContent(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => requireSafePublicContent(item, `${path}/${index}`));
    return;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      requireContract(!FORBIDDEN_KEYS.has(key.toLowerCase()), `unsafe public Episode field: ${key}`, path);
      requireSafePublicContent(child, `${path}/${key}`);
    }
    return;
  }
  if (typeof value === "string") {
    requireContract(!UNSAFE_STRING.test(value), "unsafe public Episode string", path);
  }
}

const SUMMARY_KEYS = [
  "schema_version", "robot_id", "episode_id", "revision", "task_label", "state",
  "outcome", "verification", "coverage", "started_at", "ended_at", "execution_id",
  "test_case_id", "lifecycle_run_id", "operation", "event_count", "asset_count",
  "finding_count", "evidence_ids", "source_kind", "limitations",
] as const;

function parseEpisodeSummaryBase(
  value: unknown,
  path: string,
  schemaVersion: "rolo-episode-summary/v1" | "rolo-episode-detail/v1",
): EpisodeSummary {
  requireContract(isRecord(value) && value.schema_version === schemaVersion, "unsupported Episode summary schema", path);
  requireContract(isIdentifier(value.robot_id) && isIdentifier(value.episode_id), "invalid Episode identity", path);
  requireContract(Number.isInteger(value.revision) && Number(value.revision) >= 1, "invalid Episode revision", path);
  requireContract(typeof value.task_label === "string" && value.task_label.length >= 1 && value.task_label.length <= 256, "invalid Episode task label", path);
  requireContract(EPISODE_STATES.includes(value.state as EpisodeState), "invalid Episode state", path);
  requireContract(EPISODE_OUTCOMES.includes(value.outcome as EpisodeOutcome), "invalid Episode outcome", path);
  requireContract(EPISODE_VERIFICATIONS.includes(value.verification as EpisodeVerification), "invalid Episode verification", path);
  requireContract(["METADATA_ONLY", "PARTIAL", "COMPLETE"].includes(String(value.coverage)), "invalid Episode coverage", path);
  requireContract(isAwareTimestamp(value.started_at) && (value.ended_at === null || isAwareTimestamp(value.ended_at)), "invalid Episode time range", path);
  requireContract(isNullableIdentifier(value.execution_id) && isNullableIdentifier(value.test_case_id) && isNullableIdentifier(value.lifecycle_run_id) && isNullableIdentifier(value.operation), "invalid Episode producer identity", path);
  requireContract(isNonNegativeInteger(value.event_count) && isNonNegativeInteger(value.asset_count) && isNonNegativeInteger(value.finding_count), "invalid Episode counts", path);
  requireContract(isIdentifierArray(value.evidence_ids), "invalid Episode evidence IDs", path);
  requireContract(value.source_kind === "published_episode_projection" && isStringArray(value.limitations) && value.limitations.length <= 32, "invalid Episode source metadata", path);
  const startedAt = Date.parse(value.started_at);
  if (value.ended_at !== null) requireContract(Date.parse(value.ended_at) >= startedAt, "Episode ended before it started", path);
  if (value.state === "RUNNING") {
    requireContract(value.ended_at === null && value.outcome === "UNKNOWN", "RUNNING Episode has terminal metadata", path);
  } else {
    requireContract(value.ended_at !== null, "terminal Episode has no end time", path);
  }
  requireContract(value.verification !== "VERIFIED" || value.evidence_ids.length > 0, "VERIFIED Episode has no evidence", path);
  return value as unknown as EpisodeSummary;
}

function parseEpisodeSummary(value: unknown, path: string): EpisodeSummary {
  requireContract(isRecord(value), "Episode summary must be an object", path);
  requireOnlyKeys(value, SUMMARY_KEYS, path);
  return parseEpisodeSummaryBase(value, path, "rolo-episode-summary/v1");
}

function parseEpisodeAsset(value: unknown, path: string, identity: EpisodeIdentity): EpisodeAssetSummary {
  requireContract(isRecord(value), "Episode asset must be an object", path);
  requireOnlyKeys(value, [
    "schema_version", "robot_id", "episode_id", "revision", "asset_id", "modality",
    "source_label", "captured_at", "offset_ms", "world_kind", "evidence_kind", "frame",
    "clock_domain", "synchronization", "media_type", "byte_count", "digest",
    "data_classification", "evidence_id", "availability", "limitations",
  ], path);
  requireContract(value.schema_version === "rolo-episode-asset-summary/v1", "unsupported Episode asset schema", path);
  requireIdentity(value, identity, path);
  requireContract(isIdentifier(value.asset_id) && isIdentifier(value.modality) && typeof value.source_label === "string" && value.source_label.length > 0, "invalid Episode asset identity", path);
  requireContract(isAwareTimestamp(value.captured_at) && isNonNegativeInteger(value.offset_ms), "invalid Episode asset time", path);
  requireContract(["PHYSICAL", "SIMULATED", "REPLAYED"].includes(String(value.world_kind)), "invalid Episode world kind", path);
  requireContract(["RAW", "NORMALIZED", "RENDERED", "GUI_SCREENSHOT"].includes(String(value.evidence_kind)), "invalid Episode evidence kind", path);
  requireContract(value.frame === null || isIdentifier(value.frame), "invalid Episode asset frame", path);
  requireContract(isIdentifier(value.clock_domain) && ["SYNCED", "DEGRADED", "UNSYNCED", "UNKNOWN"].includes(String(value.synchronization)), "invalid Episode asset clock metadata", path);
  requireContract(typeof value.media_type === "string" && MEDIA_TYPE.test(value.media_type), "invalid Episode asset media type", path);
  requireContract(value.byte_count === null || isNonNegativeInteger(value.byte_count), "invalid Episode asset byte count", path);
  requireContract(value.digest === null || (typeof value.digest === "string" && DIGEST.test(value.digest)), "invalid Episode asset digest", path);
  requireContract(["PUBLIC", "INTERNAL", "SENSITIVE", "SECRET"].includes(String(value.data_classification)), "invalid Episode asset classification", path);
  requireContract(value.evidence_id === null || isIdentifier(value.evidence_id), "invalid Episode asset evidence", path);
  requireContract(["AVAILABLE", "MISSING", "REDACTED"].includes(String(value.availability)), "invalid Episode asset availability", path);
  requireContract(isStringArray(value.limitations) && value.limitations.length <= 32, "invalid Episode asset limitations", path);
  requireContract(value.data_classification !== "SECRET" || (value.availability === "REDACTED" && value.digest === null), "SECRET Episode asset metadata is not redacted", path);
  requireContract(value.availability !== "AVAILABLE" || value.digest !== null, "available Episode asset has no digest", path);
  return value as unknown as EpisodeAssetSummary;
}

interface EpisodeIdentity { robotId: string; episodeId: string; revision: number }

function requireIdentity(value: Record<string, unknown>, identity: EpisodeIdentity, path: string): void {
  requireContract(value.robot_id === identity.robotId && value.episode_id === identity.episodeId && value.revision === identity.revision, "Episode child identity or revision does not match", path);
}

function parseEpisodeFinding(value: unknown, path: string, identity: EpisodeIdentity): EpisodeFindingSummary {
  requireContract(isRecord(value), "Episode finding must be an object", path);
  requireOnlyKeys(value, [
    "schema_version", "robot_id", "episode_id", "revision", "finding_id", "kind",
    "authority", "title", "summary", "start_offset_ms", "end_offset_ms",
    "supporting_evidence_ids", "supporting_asset_ids", "contradicting_evidence_ids",
    "confidence", "verification", "limitations",
  ], path);
  requireContract(value.schema_version === "rolo-episode-finding-summary/v1", "unsupported Episode finding schema", path);
  requireIdentity(value, identity, path);
  requireContract(isIdentifier(value.finding_id) && typeof value.title === "string" && typeof value.summary === "string", "invalid Episode finding identity", path);
  requireContract(Object.hasOwn(FINDING_AUTHORITIES, String(value.kind)), "invalid Episode finding kind", path);
  requireContract(value.authority === FINDING_AUTHORITIES[value.kind as EpisodeFindingKind], "Episode finding authority does not match its kind", path);
  requireContract(isNonNegativeInteger(value.start_offset_ms) && isNonNegativeInteger(value.end_offset_ms) && Number(value.end_offset_ms) >= Number(value.start_offset_ms), "invalid Episode finding interval", path);
  requireContract(isIdentifierArray(value.supporting_evidence_ids) && isIdentifierArray(value.supporting_asset_ids) && isIdentifierArray(value.contradicting_evidence_ids), "invalid Episode finding references", path);
  requireContract(value.supporting_evidence_ids.length + value.supporting_asset_ids.length > 0, "Episode finding has no supporting evidence", path);
  requireContract(value.confidence === null || isConfidence(value.confidence), "invalid Episode finding confidence", path);
  requireContract(EPISODE_VERIFICATIONS.includes(value.verification as EpisodeVerification), "invalid Episode finding verification", path);
  requireContract(isStringArray(value.limitations) && value.limitations.length <= 32, "invalid Episode finding limitations", path);
  requireContract(value.kind !== "CANDIDATE_CAUSE" || value.verification !== "VERIFIED", "candidate cause cannot be VERIFIED", path);
  requireContract(value.kind !== "VERIFIED_OUTCOME" || value.verification === "VERIFIED", "verified outcome is not VERIFIED", path);
  return value as unknown as EpisodeFindingSummary;
}

function parseEpisodeEvent(value: unknown, path: string, identity: EpisodeIdentity): EpisodeTimelineEvent {
  requireContract(isRecord(value), "Episode event must be an object", path);
  requireOnlyKeys(value, [
    "schema_version", "robot_id", "episode_id", "revision", "event_id", "sequence",
    "offset_ms", "occurred_at", "duration_ms", "clock_domain", "synchronization", "lane",
    "title", "summary", "severity", "authority", "evidence_ids", "asset_ids",
    "related_event_ids", "metrics", "limitations",
  ], path);
  requireContract(value.schema_version === "rolo-episode-timeline-event/v1", "unsupported Episode event schema", path);
  requireIdentity(value, identity, path);
  requireContract(isIdentifier(value.event_id) && isNonNegativeInteger(value.sequence) && isNonNegativeInteger(value.offset_ms), "invalid Episode event order", path);
  requireContract(isAwareTimestamp(value.occurred_at) && (value.duration_ms === null || isNonNegativeInteger(value.duration_ms)), "invalid Episode event time", path);
  requireContract(isIdentifier(value.clock_domain) && ["SYNCED", "DEGRADED", "UNSYNCED", "UNKNOWN"].includes(String(value.synchronization)), "invalid Episode event clock metadata", path);
  requireContract(EPISODE_LANES.includes(value.lane as EpisodeTimelineLane), "invalid Episode event lane", path);
  requireContract(typeof value.title === "string" && typeof value.summary === "string" && ["INFO", "WARNING", "ERROR", "CRITICAL"].includes(String(value.severity)), "invalid Episode event presentation", path);
  requireContract(EPISODE_AUTHORITIES.includes(value.authority as EpisodeAuthority), "invalid Episode event authority", path);
  requireContract(isIdentifierArray(value.evidence_ids) && isIdentifierArray(value.asset_ids) && isIdentifierArray(value.related_event_ids), "invalid Episode event references", path);
  requireContract(isRecord(value.metrics) && Object.entries(value.metrics).every(([name, number]) => METRIC_NAME.test(name) && typeof number === "number" && Number.isFinite(number)), "invalid Episode event metrics", path);
  requireContract(Object.keys(value.metrics).length <= 32 && isStringArray(value.limitations) && value.limitations.length <= 32, "Episode event exceeds bounded metadata", path);
  requireContract(value.authority === "DECLARED" || value.evidence_ids.length + value.asset_ids.length > 0, "non-declared Episode event has no evidence", path);
  return value as unknown as EpisodeTimelineEvent;
}

export function parseEpisodeCollection(
  value: unknown,
  path: string,
  robotId: string,
  expected: { limit: number; offset: number },
): EpisodeCollection {
  requireSafePublicContent(value, path);
  requireContract(isRecord(value), "Episode collection must be an object", path);
  requireOnlyKeys(value, ["schema_version", "robot_id", "items", "total", "limit", "offset", "next_offset", "as_of", "source_kind", "limitations"], path);
  requireContract(value.schema_version === "rolo-episode-collection/v1" && value.robot_id === robotId, "unsupported Episode collection or robot identity", path);
  requireContract(Array.isArray(value.items), "invalid Episode collection items", path);
  const items = value.items.map((item, index) => parseEpisodeSummary(item, `${path}/items/${index}`));
  requireContract(items.every((item) => item.robot_id === robotId) && new Set(items.map((item) => item.episode_id)).size === items.length, "invalid or duplicate Episode collection identity", path);
  requireContract(isNonNegativeInteger(value.total) && Number(value.total) >= items.length, "invalid Episode collection total", path);
  requireContract(value.limit === expected.limit && value.offset === expected.offset && items.length <= expected.limit, "Episode collection does not match the requested page", path);
  requireContract(value.next_offset === null || (Number.isInteger(value.next_offset) && Number(value.next_offset) > expected.offset && Number(value.next_offset) <= Number(value.total)), "invalid Episode next offset", path);
  requireContract(isAwareTimestamp(value.as_of) && value.source_kind === "published_episode_projection" && isStringArray(value.limitations) && value.limitations.length <= 32, "invalid Episode collection metadata", path);
  return { ...value, items } as unknown as EpisodeCollection;
}

export function parseEpisodeDetail(value: unknown, path: string, robotId: string, episodeId: string): EpisodeDetail {
  requireSafePublicContent(value, path);
  requireContract(isRecord(value), "Episode detail must be an object", path);
  requireOnlyKeys(value, [...SUMMARY_KEYS, "as_of", "immutable", "clock_domain", "synchronization", "available_lanes", "expected_behavior", "observed_behavior", "assets", "findings"], path);
  parseEpisodeSummaryBase(value, path, "rolo-episode-detail/v1");
  requireContract(value.robot_id === robotId && value.episode_id === episodeId, "Episode detail identity does not match", path);
  requireContract(isAwareTimestamp(value.as_of) && Date.parse(value.as_of) >= Date.parse(String(value.started_at)), "invalid Episode as-of time", path);
  requireContract(typeof value.immutable === "boolean" && !(value.state === "RUNNING" && value.immutable), "invalid Episode immutability", path);
  requireContract(isIdentifier(value.clock_domain) && ["SYNCED", "DEGRADED", "UNSYNCED", "UNKNOWN"].includes(String(value.synchronization)), "invalid Episode detail clock metadata", path);
  requireContract(Array.isArray(value.available_lanes) && value.available_lanes.length <= 10 && value.available_lanes.every((lane) => EPISODE_LANES.includes(lane as EpisodeTimelineLane)) && new Set(value.available_lanes).size === value.available_lanes.length, "invalid Episode available lanes", path);
  requireContract(value.expected_behavior === null || typeof value.expected_behavior === "string", "invalid expected behavior", path);
  requireContract(value.observed_behavior === null || typeof value.observed_behavior === "string", "invalid observed behavior", path);
  requireContract(Array.isArray(value.assets) && value.assets.length <= 1000 && Array.isArray(value.findings) && value.findings.length <= 1000, "Episode detail children exceed bounds", path);
  const identity = { robotId, episodeId, revision: Number(value.revision) };
  const assets = value.assets.map((item, index) => parseEpisodeAsset(item, `${path}/assets/${index}`, identity));
  const findings = value.findings.map((item, index) => parseEpisodeFinding(item, `${path}/findings/${index}`, identity));
  requireContract(assets.length === value.asset_count && findings.length === value.finding_count, "Episode detail counts do not match", path);
  requireContract(new Set(assets.map((asset) => asset.asset_id)).size === assets.length && new Set(findings.map((finding) => finding.finding_id)).size === findings.length, "duplicate Episode child identity", path);
  const assetIds = new Set(assets.map((asset) => asset.asset_id));
  requireContract(findings.every((finding) => finding.supporting_asset_ids.every((assetId) => assetIds.has(assetId))), "Episode finding references an unknown asset", path);
  return { ...value, assets, findings } as unknown as EpisodeDetail;
}

export function parseEpisodeTimelinePage(
  value: unknown,
  path: string,
  identity: EpisodeIdentity,
  expected: { limit: number; cursor?: string },
): EpisodeTimelinePage {
  requireSafePublicContent(value, path);
  requireContract(isRecord(value), "Episode timeline page must be an object", path);
  requireOnlyKeys(value, ["schema_version", "robot_id", "episode_id", "revision", "items", "limit", "cursor", "next_cursor", "as_of", "immutable", "limitations"], path);
  requireContract(value.schema_version === "rolo-episode-timeline-page/v1", "unsupported Episode timeline schema", path);
  requireIdentity(value, identity, path);
  requireContract(value.limit === expected.limit && value.cursor === (expected.cursor ?? null), "Episode timeline page does not match the pinned request", path);
  requireContract(Array.isArray(value.items) && value.items.length <= expected.limit, "invalid Episode timeline items", path);
  const items = value.items.map((item, index) => parseEpisodeEvent(item, `${path}/items/${index}`, identity));
  requireContract(items.every((item, index) => index === 0 || item.sequence > items[index - 1].sequence), "Episode timeline is not strictly ordered by sequence", path);
  requireContract(new Set(items.map((item) => item.event_id)).size === items.length, "duplicate Episode event identity", path);
  requireContract(value.next_cursor === null || (typeof value.next_cursor === "string" && /^epcur_[0-9a-f]{40}$/.test(value.next_cursor)), "invalid Episode timeline cursor", path);
  requireContract(isAwareTimestamp(value.as_of) && typeof value.immutable === "boolean" && isStringArray(value.limitations) && value.limitations.length <= 32, "invalid Episode timeline metadata", path);
  return { ...value, items } as unknown as EpisodeTimelinePage;
}
