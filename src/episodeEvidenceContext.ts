import type {
  EpisodeAuthority,
  EpisodeAssetAvailability,
  EpisodeDetail,
  EpisodeTimelineEvent,
  EpisodeTimelineLane,
  EpisodeVerification,
} from "./types/rolo.ts";
import type {
  EpisodeEvidenceSource,
  EpisodePairComparison,
  EpisodePairCoverage,
} from "./episodeComparison.ts";

export const EPISODE_EVIDENCE_OCCURRENCE_LIMIT_PER_SIDE = 20;

export type EpisodeEvidenceOccurrenceRole = "REFERENCE" | "SUPPORTING" | "CONTRADICTING";

export interface EpisodeEvidenceOccurrence {
  source: EpisodeEvidenceSource;
  role: EpisodeEvidenceOccurrenceRole;
  contextId: string;
  label: string;
  offsetMs: number | null;
  endOffsetMs: number | null;
  lane: EpisodeTimelineLane | null;
  authority: EpisodeAuthority | null;
  verification: EpisodeVerification | null;
  availability: EpisodeAssetAvailability | null;
}

export interface EpisodeEvidenceOccurrenceLane {
  items: EpisodeEvidenceOccurrence[];
  totalCount: number;
  visibleCount: number;
  truncatedCount: number;
  visibleLimit: number;
}

export interface EpisodeEvidenceReferenceContextItem {
  evidenceId: string;
  left: EpisodeEvidenceOccurrenceLane;
  right: EpisodeEvidenceOccurrenceLane;
}

export interface EpisodeEvidenceReferenceContext {
  schemaVersion: "rolo-vis-episode-evidence-reference-context/v1";
  authority: "REFERENCE_OCCURRENCE_ONLY";
  items: EpisodeEvidenceReferenceContextItem[];
  timelineCoverage: { left: EpisodePairCoverage; right: EpisodePairCoverage };
  occurrenceLimitPerSide: number;
  supportsEvidenceContent: false;
  supportsSemanticEquivalence: false;
  supportsEvidenceQuality: false;
  supportsVerification: false;
  supportsCausalAttribution: false;
}

type OccurrenceMap = Map<string, EpisodeEvidenceOccurrence[]>;

const SOURCE_ORDER: EpisodeEvidenceSource[] = ["EPISODE", "TIMELINE", "FINDING_SUPPORTING", "FINDING_CONTRADICTING", "ASSET"];

function occurrenceKey(occurrence: EpisodeEvidenceOccurrence): string {
  return `${occurrence.source}\u0000${occurrence.role}\u0000${occurrence.contextId}`;
}

function addOccurrence(index: OccurrenceMap, visibleEvidenceIds: Set<string>, evidenceId: string, occurrence: EpisodeEvidenceOccurrence): void {
  if (!visibleEvidenceIds.has(evidenceId)) return;
  const occurrences = index.get(evidenceId) || [];
  const key = occurrenceKey(occurrence);
  if (!occurrences.some((item) => occurrenceKey(item) === key)) occurrences.push(occurrence);
  index.set(evidenceId, occurrences);
}

function buildSideOccurrences(detail: EpisodeDetail, events: EpisodeTimelineEvent[], visibleEvidenceIds: Set<string>): OccurrenceMap {
  const index: OccurrenceMap = new Map();
  detail.evidence_ids.forEach((evidenceId) => addOccurrence(index, visibleEvidenceIds, evidenceId, {
    source: "EPISODE",
    role: "REFERENCE",
    contextId: `${detail.episode_id}@${detail.revision}`,
    label: detail.task_label,
    offsetMs: null,
    endOffsetMs: null,
    lane: null,
    authority: null,
    verification: detail.verification,
    availability: null,
  }));
  events.forEach((event) => event.evidence_ids.forEach((evidenceId) => addOccurrence(index, visibleEvidenceIds, evidenceId, {
    source: "TIMELINE",
    role: "REFERENCE",
    contextId: event.event_id,
    label: event.title,
    offsetMs: event.offset_ms,
    endOffsetMs: event.duration_ms === null ? null : event.offset_ms + event.duration_ms,
    lane: event.lane,
    authority: event.authority,
    verification: null,
    availability: null,
  })));
  detail.findings.forEach((finding) => finding.supporting_evidence_ids.forEach((evidenceId) => addOccurrence(index, visibleEvidenceIds, evidenceId, {
    source: "FINDING_SUPPORTING",
    role: "SUPPORTING",
    contextId: finding.finding_id,
    label: finding.title,
    offsetMs: finding.start_offset_ms,
    endOffsetMs: finding.end_offset_ms,
    lane: null,
    authority: finding.authority,
    verification: finding.verification,
    availability: null,
  })));
  detail.findings.forEach((finding) => finding.contradicting_evidence_ids.forEach((evidenceId) => addOccurrence(index, visibleEvidenceIds, evidenceId, {
    source: "FINDING_CONTRADICTING",
    role: "CONTRADICTING",
    contextId: finding.finding_id,
    label: finding.title,
    offsetMs: finding.start_offset_ms,
    endOffsetMs: finding.end_offset_ms,
    lane: null,
    authority: finding.authority,
    verification: finding.verification,
    availability: null,
  })));
  detail.assets.forEach((asset) => {
    if (!asset.evidence_id) return;
    addOccurrence(index, visibleEvidenceIds, asset.evidence_id, {
      source: "ASSET",
      role: "REFERENCE",
      contextId: asset.asset_id,
      label: asset.source_label,
      offsetMs: asset.offset_ms,
      endOffsetMs: asset.offset_ms,
      lane: null,
      authority: null,
      verification: null,
      availability: asset.availability,
    });
  });
  return index;
}

function visibleOccurrences(occurrences: EpisodeEvidenceOccurrence[]): EpisodeEvidenceOccurrence[] {
  if (occurrences.length <= EPISODE_EVIDENCE_OCCURRENCE_LIMIT_PER_SIDE) return occurrences;
  const selected: EpisodeEvidenceOccurrence[] = [];
  const selectedKeys = new Set<string>();
  for (const source of SOURCE_ORDER) {
    const first = occurrences.find((item) => item.source === source);
    if (!first) continue;
    selected.push(first);
    selectedKeys.add(occurrenceKey(first));
  }
  for (const occurrence of occurrences) {
    if (selected.length >= EPISODE_EVIDENCE_OCCURRENCE_LIMIT_PER_SIDE) break;
    const key = occurrenceKey(occurrence);
    if (!selectedKeys.has(key)) {
      selected.push(occurrence);
      selectedKeys.add(key);
    }
  }
  return selected;
}

function lane(occurrences: EpisodeEvidenceOccurrence[] | undefined): EpisodeEvidenceOccurrenceLane {
  const all = occurrences || [];
  const items = visibleOccurrences(all);
  return {
    items,
    totalCount: all.length,
    visibleCount: items.length,
    truncatedCount: all.length - items.length,
    visibleLimit: EPISODE_EVIDENCE_OCCURRENCE_LIMIT_PER_SIDE,
  };
}

function sources(occurrences: EpisodeEvidenceOccurrence[] | undefined): EpisodeEvidenceSource[] {
  const values = new Set((occurrences || []).map((item) => item.source));
  return SOURCE_ORDER.filter((source) => values.has(source));
}

function assertSideIdentity(side: "left" | "right", detail: EpisodeDetail, events: EpisodeTimelineEvent[], comparison: EpisodePairComparison): void {
  const expected = comparison[side];
  if (detail.robot_id !== expected.robotId || detail.episode_id !== expected.episodeId || detail.revision !== expected.revision) {
    throw new Error(`Episode Evidence context ${side} detail does not match the validated comparison identity.`);
  }
  if (events.some((event) => event.robot_id !== detail.robot_id || event.episode_id !== detail.episode_id || event.revision !== detail.revision)) {
    throw new Error(`Episode Evidence context ${side} timeline does not match its pinned detail.`);
  }
}

export function buildEpisodeEvidenceReferenceContext(
  comparison: EpisodePairComparison,
  left: EpisodeDetail,
  leftEvents: EpisodeTimelineEvent[],
  right: EpisodeDetail,
  rightEvents: EpisodeTimelineEvent[],
): EpisodeEvidenceReferenceContext {
  assertSideIdentity("left", left, leftEvents, comparison);
  assertSideIdentity("right", right, rightEvents, comparison);
  const visibleEvidenceIds = new Set(comparison.evidenceTrace.items.map((item) => item.evidenceId));
  const leftOccurrences = buildSideOccurrences(left, leftEvents, visibleEvidenceIds);
  const rightOccurrences = buildSideOccurrences(right, rightEvents, visibleEvidenceIds);

  const items = comparison.evidenceTrace.items.map((traceItem): EpisodeEvidenceReferenceContextItem => {
    const leftItems = leftOccurrences.get(traceItem.evidenceId);
    const rightItems = rightOccurrences.get(traceItem.evidenceId);
    if (JSON.stringify(sources(leftItems)) !== JSON.stringify(traceItem.leftSources)
      || JSON.stringify(sources(rightItems)) !== JSON.stringify(traceItem.rightSources)) {
      throw new Error(`Episode Evidence context sources do not match the validated trace for ${traceItem.evidenceId}.`);
    }
    return { evidenceId: traceItem.evidenceId, left: lane(leftItems), right: lane(rightItems) };
  });

  return {
    schemaVersion: "rolo-vis-episode-evidence-reference-context/v1",
    authority: "REFERENCE_OCCURRENCE_ONLY",
    items,
    timelineCoverage: comparison.evidenceTrace.timelineCoverage,
    occurrenceLimitPerSide: EPISODE_EVIDENCE_OCCURRENCE_LIMIT_PER_SIDE,
    supportsEvidenceContent: false,
    supportsSemanticEquivalence: false,
    supportsEvidenceQuality: false,
    supportsVerification: false,
    supportsCausalAttribution: false,
  };
}

