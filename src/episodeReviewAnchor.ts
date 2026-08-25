import {
  buildEpisodeReviewHandoffLink,
  type EpisodeDeepLinkTarget,
  type EpisodeReviewHandoffIntent,
} from "./episodeNavigation.ts";

export const EPISODE_REVIEW_ANCHOR_FIELDS = [
  ["robotId", "Robot"],
  ["episodeId", "Episode"],
  ["revision", "Revision"],
  ["eventId", "Event focus"],
  ["findingId", "Finding focus"],
  ["assetId", "Asset focus"],
  ["compareEpisodeId", "Comparison Episode"],
  ["compareRevision", "Comparison revision"],
  ["compareEvidenceId", "Evidence context"],
  ["cohortDays", "Cohort window"],
] as const satisfies ReadonlyArray<readonly [keyof EpisodeDeepLinkTarget, string]>;

export type EpisodeReviewAnchorContinuity =
  | { status: "NONE" }
  | { status: "ANCHORED"; target: EpisodeDeepLinkTarget }
  | {
    status: "EXPLORING";
    target: EpisodeDeepLinkTarget;
    current: EpisodeDeepLinkTarget;
    differences: string[];
    returnLink: string;
  };

export function deriveEpisodeReviewAnchorContinuity({
  intent,
  anchorAccepted,
  current,
  workbenchUrl,
}: {
  intent: EpisodeReviewHandoffIntent;
  anchorAccepted: boolean;
  current: EpisodeDeepLinkTarget | null;
  workbenchUrl: string;
}): EpisodeReviewAnchorContinuity {
  if (intent.kind !== "VALID" || !anchorAccepted || current === null) return { status: "NONE" };
  const differences = EPISODE_REVIEW_ANCHOR_FIELDS
    .filter(([field]) => intent.target[field] !== current[field])
    .map(([, label]) => label);
  if (!differences.length) return { status: "ANCHORED", target: intent.target };
  return {
    status: "EXPLORING",
    target: intent.target,
    current,
    differences,
    returnLink: buildEpisodeReviewHandoffLink(workbenchUrl, intent.target),
  };
}
