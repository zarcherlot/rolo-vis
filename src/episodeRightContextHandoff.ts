import type { EpisodePairComparison } from "./episodeComparison.ts";
import type { EpisodeEvidenceOccurrence, EpisodeEvidenceReferenceContext } from "./episodeEvidenceContext.ts";
import { isEpisodeIdentifier, type EpisodeDeepLinkTarget } from "./episodeNavigation.ts";
import { resolveEpisodeOccurrenceFocus } from "./episodeOccurrenceFocus.ts";
import type { EpisodeDetail, EpisodeTimelineEvent } from "./types/rolo.ts";

export interface EpisodeComparisonInputs {
  left: { detail: EpisodeDetail; events: EpisodeTimelineEvent[] };
  right: { detail: EpisodeDetail; events: EpisodeTimelineEvent[] };
}

function sameOccurrence(left: EpisodeEvidenceOccurrence, right: EpisodeEvidenceOccurrence): boolean {
  return left.source === right.source && left.role === right.role && left.contextId === right.contextId;
}

function sideMatches(
  side: EpisodePairComparison["right"],
  detail: EpisodeDetail,
  events: EpisodeTimelineEvent[],
): boolean {
  return detail.robot_id === side.robotId
    && detail.episode_id === side.episodeId
    && detail.revision === side.revision
    && events.every((event) => event.robot_id === detail.robot_id
      && event.episode_id === detail.episode_id
      && event.revision === detail.revision);
}

export function buildEpisodeRightContextHandoffTarget({
  comparison,
  evidenceContext,
  evidenceId,
  occurrence,
  rightDetail,
  rightEvents,
  cohortDays,
}: {
  comparison: EpisodePairComparison;
  evidenceContext: EpisodeEvidenceReferenceContext;
  evidenceId: string;
  occurrence: EpisodeEvidenceOccurrence;
  rightDetail: EpisodeDetail;
  rightEvents: EpisodeTimelineEvent[];
  cohortDays: 7 | 30 | 90 | null;
}): EpisodeDeepLinkTarget | null {
  if (!isEpisodeIdentifier(evidenceId) || evidenceContext.authority !== "REFERENCE_OCCURRENCE_ONLY") return null;
  if (!sideMatches(comparison.right, rightDetail, rightEvents)) return null;
  const contextItem = evidenceContext.items.find((item) => item.evidenceId === evidenceId);
  if (!contextItem || !contextItem.right.items.some((item) => sameOccurrence(item, occurrence))) return null;

  const focus = resolveEpisodeOccurrenceFocus(evidenceId, occurrence, rightDetail, rightEvents);
  if (!focus) return null;
  const target: EpisodeDeepLinkTarget = {
    robotId: comparison.right.robotId,
    episodeId: comparison.right.episodeId,
    revision: comparison.right.revision,
    eventId: focus.kind === "EVENT" ? focus.eventId : null,
    findingId: focus.kind === "FINDING" ? focus.findingId : null,
    assetId: focus.kind === "ASSET" ? focus.assetId : null,
    compareEpisodeId: comparison.left.episodeId,
    compareRevision: comparison.left.revision,
    compareEvidenceId: evidenceId,
    cohortDays,
  };
  if (![target.robotId, target.episodeId, target.compareEpisodeId].every(isEpisodeIdentifier)) return null;
  return target;
}
