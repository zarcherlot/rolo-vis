import type {
  EpisodeCohort,
  EpisodeCohortMember,
  EpisodeDetail,
} from "./types/rolo.ts";

export type EpisodeCohortMetric =
  | "duration_ms"
  | "event_count"
  | "finding_count"
  | "asset_count"
  | "evidence_count";

export interface EpisodeCohortDistribution {
  metric: EpisodeCohortMetric;
  count: number;
  minimum: number | null;
  median: number | null;
  maximum: number | null;
  reference: number | null;
  authority: "DESCRIPTIVE_ONLY";
}

export interface EpisodeCohortReview {
  authority: "DESCRIPTIVE_ONLY";
  distributions: EpisodeCohortDistribution[];
  outcomes: Record<EpisodeCohortMember["outcome"], number>;
  verifications: Record<EpisodeCohortMember["verification"], number>;
  publicationCoverage: Record<EpisodeCohortMember["coverage"], number>;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function distribution(
  metric: EpisodeCohortMetric,
  members: EpisodeCohortMember[],
  reference: number | null,
): EpisodeCohortDistribution {
  const values = members.map((member) => member[metric]);
  return {
    metric,
    count: values.length,
    minimum: values.length ? Math.min(...values) : null,
    median: median(values),
    maximum: values.length ? Math.max(...values) : null,
    reference,
    authority: "DESCRIPTIVE_ONLY",
  };
}

function counts<T extends string>(values: T[], keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(
    keys.map((key) => [key, values.filter((value) => value === key).length]),
  ) as Record<T, number>;
}

export function buildEpisodeCohortReview(
  cohort: EpisodeCohort,
  reference: EpisodeDetail,
): EpisodeCohortReview {
  if (
    cohort.robot_id !== reference.robot_id
    || cohort.reference_episode_id !== reference.episode_id
    || cohort.reference_revision !== reference.revision
  ) {
    throw new Error("Episode cohort does not match the pinned Studio reference.");
  }
  const duration = reference.ended_at === null
    ? null
    : Date.parse(reference.ended_at) - Date.parse(reference.started_at);
  const references: Record<EpisodeCohortMetric, number | null> = {
    duration_ms: duration,
    event_count: reference.event_count,
    finding_count: reference.finding_count,
    asset_count: reference.asset_count,
    evidence_count: reference.evidence_ids.length,
  };
  const metrics: EpisodeCohortMetric[] = [
    "duration_ms", "event_count", "finding_count", "asset_count", "evidence_count",
  ];
  return {
    authority: "DESCRIPTIVE_ONLY",
    distributions: metrics.map((metric) => (
      distribution(metric, cohort.items, references[metric])
    )),
    outcomes: counts(
      cohort.items.map((member) => member.outcome),
      ["SUCCEEDED", "FAILED", "CANCELLED", "UNKNOWN"],
    ),
    verifications: counts(
      cohort.items.map((member) => member.verification),
      ["VERIFIED", "UNVERIFIED", "NOT_AVAILABLE"],
    ),
    publicationCoverage: counts(
      cohort.items.map((member) => member.coverage),
      ["METADATA_ONLY", "PARTIAL", "COMPLETE"],
    ),
  };
}
