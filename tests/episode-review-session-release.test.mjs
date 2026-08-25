import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { EPISODE_REVIEW_SESSION_RELEASE_BASELINE } from "../src/contracts/compatibility.ts";
import { buildEpisodeReviewHandoffLink, readEpisodeDeepLink, readEpisodeReviewHandoff } from "../src/episodeNavigation.ts";
import {
  advanceEpisodeReviewSession,
  buildEpisodeReviewSessionReleaseNavigation,
  releaseEpisodeReviewSession,
} from "../src/episodeReviewSession.ts";

const target = {
  robotId: "mentorpi",
  episodeId: "ep-reference",
  revision: 3,
  eventId: "evt-outcome",
  findingId: null,
  assetId: null,
  compareEpisodeId: "ep-candidate",
  compareRevision: 7,
  compareEvidenceId: "ev-shared",
  cohortDays: 30,
};
const canonical = buildEpisodeReviewHandoffLink("https://workbench.test/console", target);

test("E21A activates only after acceptance and keeps release terminal", () => {
  for (const receipt of ["NONE", "VALIDATING", "REJECTED"]) {
    assert.equal(advanceEpisodeReviewSession("PENDING", receipt), "PENDING");
  }
  assert.equal(advanceEpisodeReviewSession("PENDING", "ACCEPTED"), "ACTIVE");
  assert.equal(advanceEpisodeReviewSession("ACTIVE", "REJECTED"), "ACTIVE");
  assert.equal(releaseEpisodeReviewSession("PENDING"), "PENDING");
  assert.equal(releaseEpisodeReviewSession("ACTIVE"), "RELEASED");
  assert.equal(advanceEpisodeReviewSession("RELEASED", "ACCEPTED"), "RELEASED");
  assert.equal(releaseEpisodeReviewSession("RELEASED"), "RELEASED");
  assert.equal(EPISODE_REVIEW_SESSION_RELEASE_BASELINE.extends, "rolo-vis-episode-review-marker-lifecycle/2026-08");
  assert.equal(EPISODE_REVIEW_SESSION_RELEASE_BASELINE.persistsState, false);
  assert.equal(EPISODE_REVIEW_SESSION_RELEASE_BASELINE.supportsWrite, false);
});

test("E21B removes only the marker and preserves the current navigation context", () => {
  const current = `${canonical}&panel=timeline#event-inspector`;
  const released = buildEpisodeReviewSessionReleaseNavigation(current);
  const parsed = new URL(released, "https://workbench.test");
  assert.equal(parsed.searchParams.has("review_handoff"), false);
  assert.equal(parsed.searchParams.get("panel"), "timeline");
  assert.equal(parsed.hash, "#event-inspector");
  assert.deepEqual(readEpisodeDeepLink(parsed.href), target);
  assert.deepEqual(readEpisodeReviewHandoff(parsed.href), { kind: "NONE" });
  assert.deepEqual(readEpisodeReviewHandoff(canonical), { kind: "VALID", target });
});

test("E21B exposes an explicit end action at anchored and exploring surfaces", async () => {
  const studio = await readFile(new URL("../src/EpisodeStudio.tsx", import.meta.url), "utf8");
  assert.match(studio, /End anchored review/g);
  assert.match(studio, /onClick=\{endAnchoredReview\}/);
  assert.match(studio, /Anchored review ended for this tab/);
  assert.match(studio, /No review state was written back/);
  assert.match(studio, /reviewSessionState === "RELEASED"/);
  assert.match(studio, /buildEpisodeReviewSessionReleaseNavigation\(window\.location\.href\)/);
});

test("E21 remains component-memory session control without new authority", async () => {
  const [session, studio] = await Promise.all([
    readFile(new URL("../src/episodeReviewSession.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/EpisodeStudio.tsx", import.meta.url), "utf8"),
  ]);
  const source = `${session}\n${studio.slice(studio.indexOf("const endAnchoredReview"), studio.indexOf("const diagnosticFocus"))}`;
  assert.doesNotMatch(source, /fetch\(|roloClient|localStorage|sessionStorage|BroadcastChannel|document\.cookie/);
  assert.doesNotMatch(source, /POST|PUT|PATCH|DELETE|artifact|raw_path|storage_location/);
  assert.doesNotMatch(source, /location\.(assign|replace)|history\.pushState|clipboard/);
});

test("E21C live gate covers release, ordinary reload, and fresh canonical reopening", async () => {
  const gate = await readFile(new URL("../scripts/check-episode-review-session-release.mjs", import.meta.url), "utf8");
  assert.match(gate, /accepted_session_activated: true/);
  assert.match(gate, /explicit_release_terminal: true/);
  assert.match(gate, /marker_only_removed: true/);
  assert.match(gate, /released_reload_is_ordinary_navigation: true/);
  assert.match(gate, /canonical_reopen_requires_fresh_validation: true/);
  assert.match(gate, /supports_write: false/);
});
