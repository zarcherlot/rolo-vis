import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildEpisodeReviewLink, readEpisodeDeepLink, writeEpisodeReviewLink } from "../src/episodeNavigation.ts";

const target = {
  robotId: "mentorpi",
  episodeId: "ep-reference",
  revision: 3,
  eventId: "evt-outcome",
  findingId: null,
  assetId: "asset-summary",
  compareEpisodeId: "ep-candidate",
  compareRevision: 7,
  compareEvidenceId: "ev-shared",
  cohortDays: 30,
};

test("E17A emits one absolute canonical link containing only reviewed navigation fields", () => {
  const link = buildEpisodeReviewLink("https://workbench.test/console?theme=dark&token=secret#drawer", target);
  assert.equal(link, "https://workbench.test/console?view=episode&robot=mentorpi&episode=ep-reference&revision=3&event=evt-outcome&asset=asset-summary&compare=ep-candidate&compare_revision=7&compare_evidence=ev-shared&cohort_days=30");
  assert.deepEqual(readEpisodeDeepLink(link), target);
  assert.doesNotMatch(link, /theme|token|secret|drawer/);
});

test("E17A rejects unpinned, malformed, credential-bearing, and non-HTTP handoffs", () => {
  assert.throws(() => buildEpisodeReviewLink("https://workbench.test/", { ...target, revision: null }), /exact published revision/);
  assert.throws(() => buildEpisodeReviewLink("https://workbench.test/", { ...target, eventId: "../unsafe" }), /strict canonical validation/);
  assert.throws(() => buildEpisodeReviewLink("https://user:secret@workbench.test/", target), /without embedded credentials/);
  assert.throws(() => buildEpisodeReviewLink("file:///tmp/workbench.html", target), /HTTP\(S\)/);
});

test("E17C propagates clipboard denial without fallback navigation or storage", async () => {
  let attempted = "";
  await assert.rejects(() => writeEpisodeReviewLink({
    writeText: async (value) => {
      attempted = value;
      throw new Error("clipboard denied");
    },
  }, "https://workbench.test/?token=secret", target), /clipboard denied/);
  assert.equal(attempted, buildEpisodeReviewLink("https://workbench.test/", target));
});

test("E17B exposes a user-initiated clipboard action behind immutable publication checks", async () => {
  const studio = await readFile(new URL("../src/EpisodeStudio.tsx", import.meta.url), "utf8");
  assert.match(studio, /Copy review link/);
  assert.match(studio, /!detail\.immutable/);
  assert.match(studio, /navigator\.clipboard\?\.writeText/);
  assert.match(studio, /writeEpisodeReviewLink\(navigator\.clipboard, window\.location\.href, target\)/);
  assert.match(studio, /comparison\.publication\.left\.immutable/);
  assert.match(studio, /comparison\.publication\.right\.immutable/);
  assert.match(studio, /evidenceContext\.items\.find/);
  assert.match(studio, /resolveEpisodeOccurrenceFocus/);
});

test("E17 remains a navigation-only handoff without API, storage, content, or write authority", async () => {
  const [navigation, studio] = await Promise.all([
    readFile(new URL("../src/episodeNavigation.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/EpisodeStudio.tsx", import.meta.url), "utf8"),
  ]);
  const reviewBuilder = navigation.slice(navigation.indexOf("export function buildEpisodeReviewLink"), navigation.indexOf("export function buildWorkbenchViewLink"));
  const copyHandler = studio.slice(studio.indexOf("const copyReviewLink"), studio.indexOf("const loadMoreTimeline"));
  assert.doesNotMatch(reviewBuilder, /fetch\(|roloClient|localStorage|sessionStorage|BroadcastChannel/);
  assert.doesNotMatch(copyHandler, /fetch\(|roloClient\.|localStorage|sessionStorage|BroadcastChannel|POST|PUT|PATCH|DELETE/);
  assert.doesNotMatch(`${reviewBuilder}\n${copyHandler}`, /artifact|raw_path|storage_location|supportsWrite|release/);
});

test("E17C live gate covers canonical, comparison, cross-robot, and fail-closed review handoff", async () => {
  const gate = await readFile(new URL("../scripts/check-episode-review-link-handoff.mjs", import.meta.url), "utf8");
  assert.match(gate, /buildEpisodeReviewLink/);
  assert.match(gate, /simple_link_round_trip: true/);
  assert.match(gate, /comparison_link_round_trip: true/);
  assert.match(gate, /cross_robot_reconnect_target: robotId/);
  assert.match(gate, /stale_or_malformed_state_rejected: true/);
  assert.match(gate, /clipboard_denial_propagated: true/);
  assert.match(gate, /navigation_authority: "READ_ONLY_REVIEW_HANDOFF_ONLY"/);
  assert.match(gate, /adds_endpoint: false/);
  assert.match(gate, /supports_content_export: false/);
  assert.match(gate, /supports_write: false/);
});
