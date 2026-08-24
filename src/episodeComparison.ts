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

export interface EpisodePairComparison {
  schemaVersion: "rolo-vis-episode-pair-comparison/v1";
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
  limitations: string[];
  supportsOutcomeVerdict: false;
  supportsCausalAttribution: false;
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
    schemaVersion: "rolo-vis-episode-pair-comparison/v1",
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
    limitations,
    supportsOutcomeVerdict: false,
    supportsCausalAttribution: false,
  };
}
