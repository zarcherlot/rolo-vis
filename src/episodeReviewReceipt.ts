import type { EpisodePairComparison } from "./episodeComparison.ts";
import type { EpisodeEvidenceReferenceContext } from "./episodeEvidenceContext.ts";
import type { EpisodeReviewHandoffIntent } from "./episodeNavigation.ts";
import { resolveEpisodeOccurrenceFocus } from "./episodeOccurrenceFocus.ts";
import type { EpisodeDetail, EpisodeTimelineEvent } from "./types/rolo.ts";

export type EpisodeReviewReceiptAssessment =
  | { status: "NONE" }
  | { status: "VALIDATING"; title: string; detail: string }
  | { status: "ACCEPTED"; title: string; detail: string; targetLabel: string; comparison: boolean }
  | { status: "REJECTED"; title: string; detail: string };

export interface EpisodeReviewReceiptInputs {
  intent: EpisodeReviewHandoffIntent;
  robotId: string;
  detail: EpisodeDetail | null;
  events: EpisodeTimelineEvent[];
  detailLoading: boolean;
  detailError: string;
  comparison: EpisodePairComparison | null;
  evidenceContext: EpisodeEvidenceReferenceContext | null;
  comparisonLoading: boolean;
  comparisonError: string;
}

const validating = (): EpisodeReviewReceiptAssessment => ({
  status: "VALIDATING",
  title: "Re-reading the shared review context",
  detail: "The link identifiers are being checked against independently loaded, revision-pinned rolo publications.",
});

const rejected = (detail: string): EpisodeReviewReceiptAssessment => ({
  status: "REJECTED",
  title: "Review handoff was not accepted",
  detail,
});

export function assessEpisodeReviewReceipt(inputs: EpisodeReviewReceiptInputs): EpisodeReviewReceiptAssessment {
  if (inputs.intent.kind === "NONE") return { status: "NONE" };
  if (inputs.intent.kind === "INVALID") {
    return rejected("The review marker or URL shape was not canonical. Ordinary Episode navigation may continue, but no handoff receipt is asserted.");
  }
  const target = inputs.intent.target;
  if (target.robotId !== inputs.robotId) {
    return rejected("The connected robot does not match the robot identity pinned by the handoff.");
  }
  if (inputs.detailError) return rejected("The pinned Episode publication could not be independently read and validated.");
  if (inputs.detailLoading || !inputs.detail) return validating();
  const detail = inputs.detail;
  if (detail.robot_id !== target.robotId || detail.episode_id !== target.episodeId || detail.revision !== target.revision || !detail.immutable) {
    return rejected("The loaded Episode does not match the immutable identity and revision pinned by the handoff.");
  }
  if (target.eventId && !inputs.events.some((event) => event.event_id === target.eventId)) {
    return rejected("The focused Event is absent from the bounded, revision-pinned timeline.");
  }
  if (target.findingId && !detail.findings.some((finding) => finding.finding_id === target.findingId)) {
    return rejected("The focused Finding is not attached to the pinned Episode publication.");
  }
  if (target.assetId && !detail.assets.some((asset) => asset.asset_id === target.assetId)) {
    return rejected("The focused Asset metadata is not attached to the pinned Episode publication.");
  }
  if (target.compareEpisodeId !== null) {
    if (inputs.comparisonError) return rejected("The second pinned publication could not be independently read and compared.");
    if (inputs.comparisonLoading || !inputs.comparison) return validating();
    const comparison = inputs.comparison;
    const pairMatches = comparison.left.robotId === target.robotId
      && comparison.left.episodeId === target.episodeId
      && comparison.left.revision === target.revision
      && comparison.right.robotId === target.robotId
      && comparison.right.episodeId === target.compareEpisodeId
      && comparison.right.revision === target.compareRevision
      && comparison.publication.left.immutable
      && comparison.publication.right.immutable;
    if (!pairMatches) return rejected("The independently loaded comparison pair does not match the two revisions pinned by the handoff.");
    if (target.compareEvidenceId) {
      if (!inputs.evidenceContext) return validating();
      const selectedContext = inputs.evidenceContext.items.find((item) => item.evidenceId === target.compareEvidenceId);
      if (!selectedContext) return rejected("The selected Evidence context is not visible in the independently derived comparison.");
      if (target.assetId) {
        const occurrence = selectedContext.left.items.find((item) => item.source === "ASSET"
          && item.role === "REFERENCE"
          && item.contextId === target.assetId);
        const focus = occurrence
          ? resolveEpisodeOccurrenceFocus(target.compareEvidenceId, occurrence, detail, inputs.events)
          : null;
        if (focus?.kind !== "ASSET" || focus.assetId !== target.assetId) {
          return rejected("The focused Asset is no longer attached to the selected Evidence context.");
        }
      }
    }
  }
  return {
    status: "ACCEPTED",
    title: "Read-only review handoff restored",
    detail: "The identifiers were independently re-read from rolo. This receipt does not prove sender identity, Evidence quality, outcome, or release authority.",
    targetLabel: `${target.episodeId}@${target.revision}`,
    comparison: target.compareEpisodeId !== null,
  };
}
