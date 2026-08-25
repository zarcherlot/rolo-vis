export type EpisodeReviewSessionState = "PENDING" | "ACTIVE" | "RELEASED";

export type EpisodeReviewReceiptStatus = "NONE" | "VALIDATING" | "ACCEPTED" | "REJECTED";

export function advanceEpisodeReviewSession(
  current: EpisodeReviewSessionState,
  receiptStatus: EpisodeReviewReceiptStatus,
): EpisodeReviewSessionState {
  if (current === "RELEASED" || current === "ACTIVE") return current;
  return receiptStatus === "ACCEPTED" ? "ACTIVE" : "PENDING";
}

export function releaseEpisodeReviewSession(current: EpisodeReviewSessionState): EpisodeReviewSessionState {
  return current === "ACTIVE" ? "RELEASED" : current;
}

export function buildEpisodeReviewSessionReleaseNavigation(url: string): string {
  const parsed = new URL(url, "http://rolo-vis.local");
  parsed.searchParams.delete("review_handoff");
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
