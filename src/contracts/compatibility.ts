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
  observationBundleCollection: ["rolo-episode-observation-bundle-collection/v1"],
  observationBundleSummary: ["rolo-episode-observation-bundle-summary/v1"],
  observationSourceCoverage: ["rolo-episode-observation-source-coverage/v1"],
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

export const EPISODE_EVIDENCE_CONTEXT_BASELINE = {
  id: "rolo-vis-episode-evidence-reference-context/2026-08",
  status: "baseline",
  mode: "read-only",
  extends: EPISODE_COMPARISON_EVIDENCE_BASELINE.id,
  release: "0.26.0",
  frontendMinimum: "e863266",
  frontendMainMerge: "838e2c2",
  producerMinimum: "463d501",
  producerMainMerge: "891cbf1",
  requiredFeature: "workbench.episode-read-model/v1",
  requiredRevisionFeature: "workbench.episode-revision-history/v1",
  requiredCohortFeature: "workbench.episode-cohort-read-model/v1",
  derivedContextSchema: "rolo-vis-episode-evidence-reference-context/v1",
  referenceContextAuthority: "REFERENCE_OCCURRENCE_ONLY",
} as const;

export const EPISODE_CONTEXT_NAVIGATION_BASELINE = {
  id: "rolo-vis-episode-evidence-context-navigation/2026-08",
  status: "baseline",
  mode: "read-only",
  extends: EPISODE_EVIDENCE_CONTEXT_BASELINE.id,
  release: "0.27.0",
  frontendMinimum: "e2e8302",
  frontendMainMerge: "2263cd8",
  producerMinimum: "463d501",
  producerMainMerge: "891cbf1",
  requiredFeature: "workbench.episode-read-model/v1",
  requiredRevisionFeature: "workbench.episode-revision-history/v1",
  requiredCohortFeature: "workbench.episode-cohort-read-model/v1",
  derivedContextSchema: "rolo-vis-episode-evidence-reference-context/v1",
  referenceContextAuthority: "REFERENCE_OCCURRENCE_ONLY",
  selectedReferenceParameter: "compare_evidence",
  selectionAuthority: "CONTEXT_SELECTION_ONLY",
  opensEvidenceRecord: false,
} as const;

export const EPISODE_OCCURRENCE_FOCUS_BASELINE = {
  id: "rolo-vis-episode-evidence-occurrence-focus/2026-08",
  status: "baseline",
  mode: "read-only",
  extends: EPISODE_CONTEXT_NAVIGATION_BASELINE.id,
  release: "0.28.0",
  frontendMinimum: "508c6d2",
  frontendMainMerge: "57e3aaf",
  producerMinimum: "463d501",
  producerMainMerge: "891cbf1",
  requiredFeature: "workbench.episode-read-model/v1",
  requiredRevisionFeature: "workbench.episode-revision-history/v1",
  requiredCohortFeature: "workbench.episode-cohort-read-model/v1",
  selectedReferenceParameter: "compare_evidence",
  sourceParameters: ["event", "finding"],
  focusAuthority: "SOURCE_FOCUS_ONLY",
  focusSide: "LEFT_ONLY",
  opensEvidenceRecord: false,
  supportsWrite: false,
} as const;

export const EPISODE_ASSET_FOCUS_BASELINE = {
  id: "rolo-vis-episode-asset-occurrence-focus/2026-08",
  status: "baseline",
  mode: "read-only",
  extends: EPISODE_OCCURRENCE_FOCUS_BASELINE.id,
  release: "0.29.0",
  frontendMinimum: "7123f01",
  frontendMainMerge: "4578788",
  producerMinimum: "463d501",
  producerMainMerge: "891cbf1",
  requiredFeature: "workbench.episode-read-model/v1",
  requiredRevisionFeature: "workbench.episode-revision-history/v1",
  requiredCohortFeature: "workbench.episode-cohort-read-model/v1",
  selectedReferenceParameter: "compare_evidence",
  assetParameter: "asset",
  focusAuthority: "ASSET_METADATA_FOCUS_ONLY",
  focusSide: "LEFT_ONLY",
  opensEvidenceRecord: false,
  readsAssetBytes: false,
  supportsWrite: false,
} as const;

export const EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE = {
  id: "rolo-vis-episode-right-context-handoff/2026-08",
  status: "baseline",
  mode: "read-only",
  extends: EPISODE_ASSET_FOCUS_BASELINE.id,
  release: "0.30.0",
  frontendMinimum: "801231f",
  frontendMainMerge: "b487b01",
  producerMinimum: "463d501",
  producerMainMerge: "891cbf1",
  requiredFeature: "workbench.episode-read-model/v1",
  requiredRevisionFeature: "workbench.episode-revision-history/v1",
  requiredCohortFeature: "workbench.episode-cohort-read-model/v1",
  selectedReferenceParameter: "compare_evidence",
  sourceParameters: ["event", "finding", "asset"],
  orientationAuthority: "PAIR_ORIENTATION_HANDOFF_ONLY",
  sourceTransition: "RIGHT_SELECTED_THEN_LEFT_REVALIDATED",
  addsSideParameter: false,
  opensEvidenceRecord: false,
  readsAssetBytes: false,
  supportsWrite: false,
} as const;

export const EPISODE_NAVIGATION_REHYDRATION_BASELINE = {
  id: "rolo-vis-episode-navigation-rehydration/2026-08",
  status: "baseline",
  mode: "read-only",
  extends: EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.id,
  release: "0.31.0",
  frontendMinimum: "5776492",
  frontendMainMerge: "5776492",
  producerMinimum: "463d501",
  producerMainMerge: "891cbf1",
  requiredFeature: "workbench.episode-read-model/v1",
  requiredRevisionFeature: "workbench.episode-revision-history/v1",
  requiredCohortFeature: "workbench.episode-cohort-read-model/v1",
  navigationAuthority: "NAVIGATION_REHYDRATION_ONLY",
  historyEvents: ["popstate"],
  invalidTarget: "STACK_NORMALIZED",
  reconnectPolicy: "ROBOT_IDENTITY_CHANGE_ONLY",
  addsEndpoint: false,
  supportsWrite: false,
} as const;

export const EPISODE_REVIEW_LINK_HANDOFF_BASELINE = {
  id: "rolo-vis-episode-review-link-handoff/2026-08",
  status: "baseline",
  mode: "read-only",
  extends: EPISODE_NAVIGATION_REHYDRATION_BASELINE.id,
  release: "0.32.0",
  frontendMinimum: "92689a9",
  frontendMainMerge: "92689a9",
  producerMinimum: "463d501",
  producerMainMerge: "891cbf1",
  requiredFeature: "workbench.episode-read-model/v1",
  requiredRevisionFeature: "workbench.episode-revision-history/v1",
  requiredCohortFeature: "workbench.episode-cohort-read-model/v1",
  handoffAuthority: "READ_ONLY_REVIEW_HANDOFF_ONLY",
  linkPolicy: "STRICT_ALLOWLIST_ROUND_TRIP",
  clipboardInitiation: "USER_ONLY",
  addsEndpoint: false,
  exportsContent: false,
  supportsWrite: false,
} as const;

export const EPISODE_REVIEW_HANDOFF_RECEIPT_BASELINE = {
  id: "rolo-vis-episode-review-handoff-receipt/2026-08",
  status: "baseline",
  mode: "read-only",
  extends: EPISODE_REVIEW_LINK_HANDOFF_BASELINE.id,
  release: "0.33.0",
  frontendMinimum: "347abd8",
  frontendMainMerge: "347abd8",
  producerMinimum: "463d501",
  producerMainMerge: "891cbf1",
  requiredFeature: "workbench.episode-read-model/v1",
  requiredRevisionFeature: "workbench.episode-revision-history/v1",
  requiredCohortFeature: "workbench.episode-cohort-read-model/v1",
  marker: "review_handoff=1",
  receiptAuthority: "NAVIGATION_RESTORATION_RECEIPT_ONLY",
  validationPolicy: "INDEPENDENT_PUBLIC_READ_REVALIDATION",
  authenticatesSender: false,
  addsEndpoint: false,
  exportsContent: false,
  supportsWrite: false,
} as const;

export const EPISODE_REVIEW_ANCHOR_CONTINUITY_BASELINE = {
  id: "rolo-vis-episode-review-anchor-continuity/2026-08",
  status: "baseline",
  mode: "read-only",
  extends: EPISODE_REVIEW_HANDOFF_RECEIPT_BASELINE.id,
  release: "0.34.0",
  frontendMinimum: "55d4968",
  frontendMainMerge: "55d4968",
  producerMinimum: "463d501",
  producerMainMerge: "891cbf1",
  anchorLifetime: "CURRENT_TAB_COMPONENT_MEMORY_ONLY",
  continuityStates: ["ANCHORED", "EXPLORING"],
  comparisonPolicy: "EXACT_FIELD_DIFFERENCE",
  returnPolicy: "USER_INITIATED_CANONICAL_NAVIGATION",
  addsEndpoint: false,
  persistsAnchor: false,
  supportsWrite: false,
} as const;

export const EPISODE_REVIEW_MARKER_LIFECYCLE_BASELINE = {
  id: "rolo-vis-episode-review-marker-lifecycle/2026-08",
  status: "baseline",
  mode: "read-only",
  extends: EPISODE_REVIEW_ANCHOR_CONTINUITY_BASELINE.id,
  release: "0.35.0",
  frontendMinimum: "dbe5028",
  frontendMainMerge: "dbe5028",
  producerMinimum: "463d501",
  producerMainMerge: "891cbf1",
  markerRetentionPolicy: "ORIGINAL_CANONICAL_TARGET_ONLY",
  explorationUrlPolicy: "ORDINARY_EPISODE_NAVIGATION",
  returnPolicy: "USER_INITIATED_CANONICAL_NAVIGATION",
  addsEndpoint: false,
  persistsState: false,
  supportsWrite: false,
} as const;

export const EPISODE_REVIEW_SESSION_RELEASE_BASELINE = {
  id: "rolo-vis-episode-review-session-release/2026-08",
  status: "baseline",
  mode: "read-only",
  extends: EPISODE_REVIEW_MARKER_LIFECYCLE_BASELINE.id,
  release: "0.36.0",
  frontendMinimum: "98d3a38",
  frontendMainMerge: "98d3a38",
  producerMinimum: "463d501",
  producerMainMerge: "891cbf1",
  sessionStates: ["PENDING", "ACTIVE", "RELEASED"],
  activationPolicy: "ACCEPTED_RECEIPT_ONLY",
  releasePolicy: "EXPLICIT_USER_ACTION_ONLY",
  releasedReactivation: "NEW_CANONICAL_NAVIGATION_ONLY",
  markerPolicy: "REMOVE_ON_RELEASE",
  addsEndpoint: false,
  persistsState: false,
  supportsWrite: false,
} as const;

export const EPISODE_OBSERVATION_BUNDLE_CONSUMER_CANDIDATE = {
  id: "rolo-vis-episode-observation-bundle-consumer/candidate-2026-08",
  status: "candidate",
  mode: "read-only",
  extends: EPISODE_REVIEW_SESSION_RELEASE_BASELINE.id,
  targetRelease: "0.37.0",
  contractPhase: "CONSUMER_REVIEW_CANDIDATE",
  requiredFeature: "workbench.episode-observation-bundle/v1",
  requiredSchemas: [
    "rolo-episode-observation-bundle-collection/v1",
    "rolo-episode-observation-bundle-summary/v1",
    "rolo-episode-observation-source-coverage/v1",
  ],
  revisionPolicy: "EXACT_IMMUTABLE_EPISODE_REVISION",
  selectionPolicy: "CURRENT_COMPONENT_MEMORY_ONLY",
  clientEndpointImplemented: true,
  mediaDelivery: false,
  persistsState: false,
  supportsCapture: false,
  supportsRecollection: false,
  supportsReplay: false,
  supportsExport: false,
  supportsWrite: false,
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
