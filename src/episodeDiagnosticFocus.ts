import type {
  EpisodeAssetAvailability,
  EpisodeAuthority,
  EpisodeDetail,
  EpisodeFindingKind,
  EpisodeSeverity,
  EpisodeTimelineEvent,
  EpisodeTimelineLane,
  EpisodeVerification,
} from "./types/rolo.ts";
import { EPISODE_VISIBLE_EVENT_LIMIT } from "./episodeNavigation.ts";

export type EpisodeDiagnosticCoverage = "COMPLETE" | "BOUNDED_PARTIAL";

export interface EpisodeDiagnosticEvent {
  eventId: string;
  sequence: number;
  offsetMs: number;
  lane: EpisodeTimelineLane;
  authority: EpisodeAuthority;
  severity: EpisodeSeverity;
  title: string;
}

export interface EpisodeDiagnosticAsset {
  assetId: string;
  sourceLabel: string;
  availability: EpisodeAssetAvailability;
  evidenceId: string | null;
}

export interface EpisodeDiagnosticFocus {
  schemaVersion: "rolo-vis-episode-diagnostic-focus/v1";
  robotId: string;
  episodeId: string;
  revision: number;
  findingId: string;
  title: string;
  summary: string;
  kind: EpisodeFindingKind;
  authority: EpisodeAuthority;
  verification: EpisodeVerification;
  confidence: number | null;
  window: { startOffsetMs: number; endOffsetMs: number };
  timelineCoverage: EpisodeDiagnosticCoverage;
  coincidentEvents: EpisodeDiagnosticEvent[];
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  supportingAssets: EpisodeDiagnosticAsset[];
  limitations: string[];
  supportsCausalAttribution: false;
  supportsRemediation: false;
  supportsVerificationPromotion: false;
}

function overlapsFindingWindow(event: EpisodeTimelineEvent, startOffsetMs: number, endOffsetMs: number): boolean {
  const eventEnd = event.offset_ms + (event.duration_ms || 0);
  return event.offset_ms <= endOffsetMs && eventEnd >= startOffsetMs;
}

export function buildEpisodeDiagnosticFocus(detail: EpisodeDetail, events: EpisodeTimelineEvent[], findingId: string): EpisodeDiagnosticFocus {
  const finding = detail.findings.find((item) => item.finding_id === findingId);
  if (!finding) throw new Error("Episode diagnostic focus references an unknown finding.");
  if (events.some((event) => event.robot_id !== detail.robot_id || event.episode_id !== detail.episode_id || event.revision !== detail.revision)) {
    throw new Error("Episode diagnostic focus received timeline events from another identity or revision.");
  }
  if (events.length > EPISODE_VISIBLE_EVENT_LIMIT) throw new Error(`Episode diagnostic focus exceeds the ${EPISODE_VISIBLE_EVENT_LIMIT}-event visible limit.`);
  if (events.some((event, index) => index > 0 && event.sequence <= events[index - 1].sequence)) {
    throw new Error("Episode diagnostic focus requires strictly sequence-ordered timeline events.");
  }
  if (events.length > detail.event_count) throw new Error("Episode diagnostic focus received more events than the publication declares.");
  if (finding.kind === "CANDIDATE_CAUSE" && (finding.authority !== "INFERRED" || finding.verification !== "UNVERIFIED")) {
    throw new Error("Candidate causes must remain inferred and unverified.");
  }

  const coincidentEvents = events
    .filter((event) => overlapsFindingWindow(event, finding.start_offset_ms, finding.end_offset_ms))
    .map((event) => ({
      eventId: event.event_id,
      sequence: event.sequence,
      offsetMs: event.offset_ms,
      lane: event.lane,
      authority: event.authority,
      severity: event.severity,
      title: event.title,
    }));
  const assetById = new Map(detail.assets.map((asset) => [asset.asset_id, asset]));
  const supportingAssets = finding.supporting_asset_ids.map((assetId) => {
    const asset = assetById.get(assetId);
    if (!asset) throw new Error("Episode diagnostic focus references an unknown supporting asset.");
    return { assetId, sourceLabel: asset.source_label, availability: asset.availability, evidenceId: asset.evidence_id };
  });
  const timelineCoverage: EpisodeDiagnosticCoverage = events.length === detail.event_count ? "COMPLETE" : "BOUNDED_PARTIAL";

  return {
    schemaVersion: "rolo-vis-episode-diagnostic-focus/v1",
    robotId: detail.robot_id,
    episodeId: detail.episode_id,
    revision: detail.revision,
    findingId: finding.finding_id,
    title: finding.title,
    summary: finding.summary,
    kind: finding.kind,
    authority: finding.authority,
    verification: finding.verification,
    confidence: finding.confidence,
    window: { startOffsetMs: finding.start_offset_ms, endOffsetMs: finding.end_offset_ms },
    timelineCoverage,
    coincidentEvents,
    supportingEvidenceIds: [...finding.supporting_evidence_ids],
    contradictingEvidenceIds: [...finding.contradicting_evidence_ids],
    supportingAssets,
    limitations: [...new Set([
      ...finding.limitations,
      ...(timelineCoverage === "BOUNDED_PARTIAL" ? ["The loaded timeline is partial; additional events may intersect this finding window."] : []),
      "Events in the same time window are contextual and do not establish evidentiary support or causation.",
    ])],
    supportsCausalAttribution: false,
    supportsRemediation: false,
    supportsVerificationPromotion: false,
  };
}
