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

export const EPISODE_SCHEMA_COMPATIBILITY = {
  collection: ["rolo-episode-collection/v1"],
  summary: ["rolo-episode-summary/v1"],
  detail: ["rolo-episode-detail/v1"],
  timelinePage: ["rolo-episode-timeline-page/v1"],
  timelineEvent: ["rolo-episode-timeline-event/v1"],
  assetSummary: ["rolo-episode-asset-summary/v1"],
  findingSummary: ["rolo-episode-finding-summary/v1"],
  revisionCollection: ["rolo-episode-revision-collection/v1"],
  revisionSummary: ["rolo-episode-revision-summary/v1"],
  cohort: ["rolo-episode-cohort/v1"],
  cohortMember: ["rolo-episode-cohort-member/v1"],
  cohortExclusions: ["rolo-episode-cohort-exclusions/v1"],
} as const;

export const EPISODE_READONLY_BASELINE = {
  id: "rolo-vis-episode-readonly/2026-08",
  status: "baseline",
  mode: "read-only",
  extends: MVP_BASELINE.id,
  release: "0.20.0",
  frontendMinimum: "cb09340",
  producerMinimum: "e2217bb",
  requiredFeature: "workbench.episode-read-model/v1",
} as const;

export const EPISODE_BASELINE = {
  id: "rolo-vis-episode-diagnostic/2026-08",
  status: "baseline",
  mode: "read-only",
  extends: EPISODE_READONLY_BASELINE.id,
  release: "0.21.0",
  frontendMinimum: "118173f",
  producerMinimum: "570bad0",
  producerMainMerge: "4cac539",
  requiredFeature: "workbench.episode-read-model/v1",
} as const;

export const EPISODE_REVISION_BASELINE = {
  id: "rolo-vis-episode-revision-history/2026-08",
  status: "baseline",
  mode: "read-only",
  extends: EPISODE_BASELINE.id,
  release: "0.22.0",
  frontendMinimum: "b836dcd",
  producerMinimum: "48da032",
  producerMainMerge: "4efd11df",
  requiredFeature: "workbench.episode-read-model/v1",
  requiredRevisionFeature: "workbench.episode-revision-history/v1",
} as const;

export const EPISODE_COHORT_BASELINE = {
  id: "rolo-vis-episode-cohort-review/2026-08",
  status: "baseline",
  mode: "read-only",
  extends: EPISODE_REVISION_BASELINE.id,
  release: "0.23.0",
  frontendMinimum: "2c2967f",
  frontendMainMerge: "3f18124",
  producerMinimum: "463d501",
  producerMainMerge: "891cbf1",
  requiredFeature: "workbench.episode-read-model/v1",
  requiredRevisionFeature: "workbench.episode-revision-history/v1",
  requiredCohortFeature: "workbench.episode-cohort-read-model/v1",
} as const;

export const EPISODE_COHORT_INVESTIGATION_BASELINE = {
  id: "rolo-vis-episode-cohort-investigation/2026-08",
  status: "baseline",
  mode: "read-only",
  extends: EPISODE_COHORT_BASELINE.id,
  release: "0.24.0",
  frontendMinimum: "858c824",
  frontendMainMerge: "a42adeb",
  producerMinimum: "463d501",
  producerMainMerge: "891cbf1",
  requiredFeature: "workbench.episode-read-model/v1",
  requiredRevisionFeature: "workbench.episode-revision-history/v1",
  requiredCohortFeature: "workbench.episode-cohort-read-model/v1",
} as const;

export const EPISODE_COMPARISON_EVIDENCE_BASELINE = {
  id: "rolo-vis-episode-comparison-evidence/2026-08",
  status: "baseline",
  mode: "read-only",
  extends: EPISODE_COHORT_INVESTIGATION_BASELINE.id,
  release: "0.25.0",
  frontendMinimum: "e756702",
  frontendMainMerge: "0dd4fec",
  producerMinimum: "463d501",
  producerMainMerge: "891cbf1",
  requiredFeature: "workbench.episode-read-model/v1",
  requiredRevisionFeature: "workbench.episode-revision-history/v1",
  requiredCohortFeature: "workbench.episode-cohort-read-model/v1",
  derivedComparisonSchema: "rolo-vis-episode-pair-comparison/v2",
  evidenceTraceAuthority: "REFERENCE_PRESENCE_ONLY",
} as const;

export function supportsSchema(
  family: keyof typeof MVP_SCHEMA_COMPATIBILITY,
  model: "collection" | "summary" | "detail",
  schemaVersion: unknown,
): boolean {
  const versions = MVP_SCHEMA_COMPATIBILITY[family][model as keyof (typeof MVP_SCHEMA_COMPATIBILITY)[typeof family]];
  return Array.isArray(versions) && versions.includes(schemaVersion as never);
}

export function supportsEpisodeSchema(
  model: keyof typeof EPISODE_SCHEMA_COMPATIBILITY,
  schemaVersion: unknown,
): boolean {
  return EPISODE_SCHEMA_COMPATIBILITY[model].includes(schemaVersion as never);
}
