import type { EpisodeEvidenceOccurrence } from "./episodeEvidenceContext.ts";
import type { EpisodeDetail, EpisodeTimelineEvent, EpisodeTimelineLane } from "./types/rolo.ts";

export type EpisodeOccurrenceFocus =
  | { kind: "EVENT"; eventId: string; lane: EpisodeTimelineLane }
  | { kind: "FINDING"; findingId: string; role: "SUPPORTING" | "CONTRADICTING" }
  | { kind: "ASSET"; assetId: string };

export function resolveEpisodeOccurrenceFocus(
  evidenceId: string,
  occurrence: EpisodeEvidenceOccurrence,
  detail: EpisodeDetail,
  events: EpisodeTimelineEvent[],
): EpisodeOccurrenceFocus | null {
  if (occurrence.source === "TIMELINE" && occurrence.role === "REFERENCE") {
    const event = events.find((item) => item.event_id === occurrence.contextId);
    if (!event || !event.evidence_ids.includes(evidenceId)) return null;
    return { kind: "EVENT", eventId: event.event_id, lane: event.lane };
  }

  if (occurrence.source === "FINDING_SUPPORTING" && occurrence.role === "SUPPORTING") {
    const finding = detail.findings.find((item) => item.finding_id === occurrence.contextId);
    if (!finding || !finding.supporting_evidence_ids.includes(evidenceId)) return null;
    return { kind: "FINDING", findingId: finding.finding_id, role: "SUPPORTING" };
  }

  if (occurrence.source === "FINDING_CONTRADICTING" && occurrence.role === "CONTRADICTING") {
    const finding = detail.findings.find((item) => item.finding_id === occurrence.contextId);
    if (!finding || !finding.contradicting_evidence_ids.includes(evidenceId)) return null;
    return { kind: "FINDING", findingId: finding.finding_id, role: "CONTRADICTING" };
  }

  if (occurrence.source === "ASSET" && occurrence.role === "REFERENCE") {
    const asset = detail.assets.find((item) => item.asset_id === occurrence.contextId);
    if (!asset || asset.evidence_id !== evidenceId) return null;
    return { kind: "ASSET", assetId: asset.asset_id };
  }

  return null;
}
