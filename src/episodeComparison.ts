import { EPISODE_VISIBLE_EVENT_LIMIT } from "./episodeNavigation.ts";
import type {
  EpisodeAssetAvailability,
  EpisodeAuthority,
  EpisodeDetail,
  EpisodeFindingKind,
  EpisodeSeverity,
  EpisodeTimelineEvent,
  EpisodeTimelineLane,
} from "./types/rolo.ts";

export type EpisodePairComparability = "COMPARABLE" | "DESCRIPTIVE_ONLY";
export type EpisodePairCoverage = "COMPLETE" | "BOUNDED_PARTIAL";
export type EpisodeEvidenceRelation = "SHARED" | "LEFT_ONLY" | "RIGHT_ONLY";
export type EpisodeEvidenceSource = "EPISODE" | "TIMELINE" | "FINDING_SUPPORTING" | "FINDING_CONTRADICTING" | "ASSET";

export const EPISODE_COMPARISON_EVIDENCE_LIMIT = 100;

interface EpisodePairIdentity {
  robotId: string;
  episodeId: string;
  revision: number;
  taskLabel: string;
  operation: string | null;
  testCaseId: string | null;
}

export interface EpisodePairMetric {
  key: "duration_ms" | "event_count" | "finding_count" | "asset_count" | "evidence_count";
  label: string;
  left: number | null;
  right: number | null;
  delta: number | null;
  interpretation: "UNINTERPRETED_DELTA";
}

interface EpisodePairDistribution<T extends string> {
  left: Partial<Record<T, number>>;
  right: Partial<Record<T, number>>;
}

export interface EpisodeComparisonEvidenceItem {
  evidenceId: string;
  relation: EpisodeEvidenceRelation;
  leftSources: EpisodeEvidenceSource[];
  rightSources: EpisodeEvidenceSource[];
}

export interface EpisodeComparisonEvidenceTrace {
  authority: "REFERENCE_PRESENCE_ONLY";
  items: EpisodeComparisonEvidenceItem[];
  leftUniqueCount: number;
  rightUniqueCount: number;
  sharedCount: number;
  leftOnlyCount: number;
  rightOnlyCount: number;
  totalUniqueCount: number;
  visibleCount: number;
  truncatedCount: number;
  visibleLimit: number;
  timelineCoverage: { left: EpisodePairCoverage; right: EpisodePairCoverage };
  supportsEvidenceQuality: false;
  supportsVerification: false;
  supportsCausalAttribution: false;
}

export interface EpisodePairComparison {
  schemaVersion: "rolo-vis-episode-pair-comparison/v2";
  left: EpisodePairIdentity;
  right: EpisodePairIdentity;
  comparability: EpisodePairComparability;
  comparabilityReasons: string[];
  timelineCoverage: { left: EpisodePairCoverage; right: EpisodePairCoverage; visibleLimit: number };
  publication: {
    left: Pick<EpisodeDetail, "state" | "coverage" | "synchronization" | "immutable">;
    right: Pick<EpisodeDetail, "state" | "coverage" | "synchronization" | "immutable">;
  };
  outcome: { left: EpisodeDetail["outcome"]; right: EpisodeDetail["outcome"] };
  verification: { left: EpisodeDetail["verification"]; right: EpisodeDetail["verification"] };
  metrics: EpisodePairMetric[];
  lanes: EpisodePairDistribution<EpisodeTimelineLane>;
  authorities: EpisodePairDistribution<EpisodeAuthority>;
  severities: EpisodePairDistribution<EpisodeSeverity>;
  assetAvailability: EpisodePairDistribution<EpisodeAssetAvailability>;
  findingKinds: EpisodePairDistribution<EpisodeFindingKind>;
  evidenceTrace: EpisodeComparisonEvidenceTrace;
  limitations: string[];
  supportsOutcomeVerdict: false;
  supportsCausalAttribution: false;
}

const EVIDENCE_SOURCE_ORDER: EpisodeEvidenceSource[] = ["EPISODE", "TIMELINE", "FINDING_SUPPORTING", "FINDING_CONTRADICTING", "ASSET"];

function collectEvidenceSources(detail: EpisodeDetail, events: EpisodeTimelineEvent[]): Map<string, Set<EpisodeEvidenceSource>> {
  const references = new Map<string, Set<EpisodeEvidenceSource>>();
  const add = (evidenceId: string, source: EpisodeEvidenceSource) => {
    const sources = references.get(evidenceId) || new Set<EpisodeEvidenceSource>();
    sources.add(source);
    references.set(evidenceId, sources);
  };

  detail.evidence_ids.forEach((evidenceId) => add(evidenceId, "EPISODE"));
  events.forEach((event) => event.evidence_ids.forEach((evidenceId) => add(evidenceId, "TIMELINE")));
  detail.findings.forEach((finding) => {
    finding.supporting_evidence_ids.forEach((evidenceId) => add(evidenceId, "FINDING_SUPPORTING"));
    finding.contradicting_evidence_ids.forEach((evidenceId) => add(evidenceId, "FINDING_CONTRADICTING"));
  });
  detail.assets.forEach((asset) => {
    if (asset.evidence_id) add(asset.evidence_id, "ASSET");
  });
  return references;
}

function orderedSources(sources: Set<EpisodeEvidenceSource> | undefined): EpisodeEvidenceSource[] {
  if (!sources) return [];
  return EVIDENCE_SOURCE_ORDER.filter((source) => sources.has(source));
}

function buildEvidenceTrace(
  left: EpisodeDetail,
  leftEvents: EpisodeTimelineEvent[],
  right: EpisodeDetail,
  rightEvents: EpisodeTimelineEvent[],
  leftCoverage: EpisodePairCoverage,
  rightCoverage: EpisodePairCoverage,
): EpisodeComparisonEvidenceTrace {
  const leftReferences = collectEvidenceSources(left, leftEvents);
  const rightReferences = collectEvidenceSources(right, rightEvents);
  const orderedIds = [...new Set([...leftReferences.keys(), ...rightReferences.keys()])];
  const sharedCount = orderedIds.filter((evidenceId) => leftReferences.has(evidenceId) && rightReferences.has(evidenceId)).length;
  const allItems = orderedIds.map((evidenceId): EpisodeComparisonEvidenceItem => {
    const onLeft = leftReferences.has(evidenceId);
    const onRight = rightReferences.has(evidenceId);
    return {
      evidenceId,
      relation: onLeft && onRight ? "SHARED" : onLeft ? "LEFT_ONLY" : "RIGHT_ONLY",
      leftSources: orderedSources(leftReferences.get(evidenceId)),
      rightSources: orderedSources(rightReferences.get(evidenceId)),
    };
  });
  const items = allItems.slice(0, EPISODE_COMPARISON_EVIDENCE_LIMIT);

  return {
    authority: "REFERENCE_PRESENCE_ONLY",
    items,
    leftUniqueCount: leftReferences.size,
    rightUniqueCount: rightReferences.size,
    sharedCount,
    leftOnlyCount: leftReferences.size - sharedCount,
    rightOnlyCount: rightReferences.size - sharedCount,
    totalUniqueCount: allItems.length,
    visibleCount: items.length,
    truncatedCount: allItems.length - items.length,
    visibleLimit: EPISODE_COMPARISON_EVIDENCE_LIMIT,
    timelineCoverage: { left: leftCoverage, right: rightCoverage },
    supportsEvidenceQuality: false,
    supportsVerification: false,
    supportsCausalAttribution: false,
  };
}

function identity(detail: EpisodeDetail): EpisodePairIdentity {
  return {
    robotId: detail.robot_id,
    episodeId: detail.episode_id,
    revision: detail.revision,
    taskLabel: detail.task_label,
    operation: detail.operation,
    testCaseId: detail.test_case_id,
  };
}

function durationMs(detail: EpisodeDetail): number | null {
  if (!detail.ended_at) return null;
  return Math.max(0, Date.parse(detail.ended_at) - Date.parse(detail.started_at));
}

function metric(key: EpisodePairMetric["key"], label: string, left: number | null, right: number | null): EpisodePairMetric {
  return { key, label, left, right, delta: left === null || right === null ? null : right - left, interpretation: "UNINTERPRETED_DELTA" };
}

function countBy<T extends string>(values: T[]): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {};
  for (const value of values) counts[value] = (counts[value] || 0) + 1;
  return counts;
}

function assertBoundedEvents(detail: EpisodeDetail, events: EpisodeTimelineEvent[]): void {
  if (events.length > EPISODE_VISIBLE_EVENT_LIMIT) throw new Error(`Episode comparison exceeds the ${EPISODE_VISIBLE_EVENT_LIMIT}-event visible limit.`);
  if (events.length > detail.event_count) throw new Error("Episode comparison received more timeline events than the publication declares.");
  if (events.some((event) => event.robot_id !== detail.robot_id || event.episode_id !== detail.episode_id || event.revision !== detail.revision)) {
    throw new Error("Episode comparison received timeline events from another identity or revision.");
  }
  if (events.some((event, index) => index > 0 && event.sequence <= events[index - 1].sequence)) {
    throw new Error("Episode comparison requires strictly sequence-ordered timeline events.");
  }
}

export function buildEpisodePairComparison(
  left: EpisodeDetail,
  leftEvents: EpisodeTimelineEvent[],
  right: EpisodeDetail,
  rightEvents: EpisodeTimelineEvent[],
): EpisodePairComparison {
  if (left.robot_id !== right.robot_id) throw new Error("Episode comparison is limited to one robot identity.");
  if (left.episode_id === right.episode_id && left.revision === right.revision) throw new Error("Episode comparison requires two distinct published revisions.");
  assertBoundedEvents(left, leftEvents);
  assertBoundedEvents(right, rightEvents);

  const reasons: string[] = [];
  if (!left.immutable || !right.immutable) reasons.push("Both Episodes must be immutable publications for comparable mode.");
  if (left.state === "RUNNING" || right.state === "RUNNING") reasons.push("Running Episodes are descriptive only.");
  if (!left.operation || !right.operation || left.operation !== right.operation) reasons.push("Canonical operations do not match.");
  if (!left.test_case_id || !right.test_case_id || left.test_case_id !== right.test_case_id) reasons.push("Test-case identities do not match.");
  if (!left.expected_behavior || !right.expected_behavior || left.expected_behavior !== right.expected_behavior) reasons.push("Declared expected behavior does not match exactly.");

  const leftCoverage: EpisodePairCoverage = leftEvents.length === left.event_count ? "COMPLETE" : "BOUNDED_PARTIAL";
  const rightCoverage: EpisodePairCoverage = rightEvents.length === right.event_count ? "COMPLETE" : "BOUNDED_PARTIAL";
  const limitations = [...new Set([
    ...left.limitations.map((item) => `Left: ${item}`),
    ...right.limitations.map((item) => `Right: ${item}`),
    ...(leftCoverage === "BOUNDED_PARTIAL" || rightCoverage === "BOUNDED_PARTIAL" ? ["At least one timeline is only partially loaded; event distributions are bounded, not complete."] : []),
    "Numeric deltas are descriptive and carry no improved, regressed, safer, or verified interpretation.",
  ])];

  return {
    schemaVersion: "rolo-vis-episode-pair-comparison/v2",
    left: identity(left),
    right: identity(right),
    comparability: reasons.length ? "DESCRIPTIVE_ONLY" : "COMPARABLE",
    comparabilityReasons: reasons,
    timelineCoverage: { left: leftCoverage, right: rightCoverage, visibleLimit: EPISODE_VISIBLE_EVENT_LIMIT },
    publication: {
      left: { state: left.state, coverage: left.coverage, synchronization: left.synchronization, immutable: left.immutable },
      right: { state: right.state, coverage: right.coverage, synchronization: right.synchronization, immutable: right.immutable },
    },
    outcome: { left: left.outcome, right: right.outcome },
    verification: { left: left.verification, right: right.verification },
    metrics: [
      metric("duration_ms", "Duration", durationMs(left), durationMs(right)),
      metric("event_count", "Published events", left.event_count, right.event_count),
      metric("finding_count", "Published findings", left.finding_count, right.finding_count),
      metric("asset_count", "Published assets", left.asset_count, right.asset_count),
      metric("evidence_count", "Episode evidence references", left.evidence_ids.length, right.evidence_ids.length),
    ],
    lanes: { left: countBy(leftEvents.map((event) => event.lane)), right: countBy(rightEvents.map((event) => event.lane)) },
    authorities: { left: countBy(leftEvents.map((event) => event.authority)), right: countBy(rightEvents.map((event) => event.authority)) },
    severities: { left: countBy(leftEvents.map((event) => event.severity)), right: countBy(rightEvents.map((event) => event.severity)) },
    assetAvailability: { left: countBy(left.assets.map((asset) => asset.availability)), right: countBy(right.assets.map((asset) => asset.availability)) },
    findingKinds: { left: countBy(left.findings.map((finding) => finding.kind)), right: countBy(right.findings.map((finding) => finding.kind)) },
    evidenceTrace: buildEvidenceTrace(left, leftEvents, right, rightEvents, leftCoverage, rightCoverage),
    limitations,
    supportsOutcomeVerdict: false,
    supportsCausalAttribution: false,
  };
}
