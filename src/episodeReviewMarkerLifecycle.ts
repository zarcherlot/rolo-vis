import { buildEpisodeDeepLink, type EpisodeDeepLinkTarget, type EpisodeReviewHandoffIntent } from "./episodeNavigation.ts";
import { EPISODE_REVIEW_ANCHOR_FIELDS } from "./episodeReviewAnchor.ts";

const REVIEW_HANDOFF_KEY = "review_handoff";

function sameTarget(left: EpisodeDeepLinkTarget, right: EpisodeDeepLinkTarget): boolean {
  return EPISODE_REVIEW_ANCHOR_FIELDS.every(([field]) => left[field] === right[field]);
}

export function buildEpisodeReviewMarkerSafeNavigation({
  url,
  intent,
  current,
}: {
  url: string;
  intent: EpisodeReviewHandoffIntent;
  current: EpisodeDeepLinkTarget;
}): string {
  const next = buildEpisodeDeepLink(url, current);
  if (intent.kind !== "VALID" || sameTarget(intent.target, current)) return next;
  const parsed = new URL(next, "http://rolo-vis.local");
  parsed.searchParams.delete(REVIEW_HANDOFF_KEY);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
