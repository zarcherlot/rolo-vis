import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { EPISODE_REVIEW_MARKER_LIFECYCLE_CANDIDATE } from "../src/contracts/compatibility.ts";
import { buildEpisodeReviewHandoffLink, readEpisodeReviewHandoff } from "../src/episodeNavigation.ts";
import { EPISODE_REVIEW_ANCHOR_FIELDS } from "../src/episodeReviewAnchor.ts";
import { buildEpisodeReviewMarkerSafeNavigation } from "../src/episodeReviewMarkerLifecycle.ts";

const anchor = {
  robotId: "mentorpi",
  episodeId: "ep-reference",
  revision: 3,
  eventId: "evt-outcome",
  findingId: "finding-1",
  assetId: null,
  compareEpisodeId: "ep-candidate",
  compareRevision: 7,
  compareEvidenceId: "ev-shared",
  cohortDays: 30,
};
const anchorLink = buildEpisodeReviewHandoffLink("https://workbench.test/console", anchor);
const intent = readEpisodeReviewHandoff(anchorLink);

test("E20A retains the handoff marker only at the exact inbound target", () => {
  const exact = buildEpisodeReviewMarkerSafeNavigation({ url: anchorLink, intent, current: anchor });
  assert.deepEqual(readEpisodeReviewHandoff(new URL(exact, "https://workbench.test").href), { kind: "VALID", target: anchor });
  assert.equal(EPISODE_REVIEW_MARKER_LIFECYCLE_CANDIDATE.extends, "rolo-vis-episode-review-anchor-continuity/2026-08");
  assert.equal(EPISODE_REVIEW_MARKER_LIFECYCLE_CANDIDATE.persistsState, false);
  assert.equal(EPISODE_REVIEW_MARKER_LIFECYCLE_CANDIDATE.supportsWrite, false);
});

test("E20A removes marker ownership for every reviewed navigation difference", () => {
  const alternatives = {
    robotId: "mentorpi-2",
    episodeId: "ep-other",
    revision: 4,
    eventId: null,
    findingId: null,
    assetId: "asset-2",
    compareEpisodeId: "ep-other-candidate",
    compareRevision: 8,
    compareEvidenceId: null,
    cohortDays: 90,
  };
  for (const [field, label] of EPISODE_REVIEW_ANCHOR_FIELDS) {
    const current = { ...anchor, [field]: alternatives[field] };
    if (field === "compareEpisodeId") current.compareRevision = anchor.compareRevision;
    const next = buildEpisodeReviewMarkerSafeNavigation({ url: anchorLink, intent, current });
    assert.equal(new URL(next, "https://workbench.test").searchParams.has("review_handoff"), false, label);
  }
});

test("E20A makes explored reloads ordinary while preserving canonical return authority", () => {
  const explored = buildEpisodeReviewMarkerSafeNavigation({
    url: `${anchorLink}&panel=timeline#event`,
    intent,
    current: { ...anchor, eventId: null, compareEvidenceId: null },
  });
  const absolute = new URL(explored, "https://workbench.test").href;
  assert.deepEqual(readEpisodeReviewHandoff(absolute), { kind: "NONE" });
  assert.equal(new URL(absolute).searchParams.get("panel"), "timeline");
  assert.equal(new URL(absolute).hash, "#event");
  assert.deepEqual(readEpisodeReviewHandoff(anchorLink), { kind: "VALID", target: anchor });
});

test("E20B discloses URL provenance without automatic navigation", async () => {
  const studio = await readFile(new URL("../src/EpisodeStudio.tsx", import.meta.url), "utf8");
  assert.match(studio, /buildEpisodeReviewMarkerSafeNavigation/);
  assert.match(studio, /Current address is ordinary navigation/);
  assert.match(studio, /Return to shared anchor/);
  const continuityBlock = studio.slice(studio.indexOf("reviewAnchorContinuity.status === \"EXPLORING\""), studio.indexOf("reviewReceipt.status !== \"NONE\""));
  assert.doesNotMatch(continuityBlock, /location\.(assign|replace)|history\.(pushState|replaceState)|dispatchEvent/);
});

test("E20C remains local URL hygiene without new authority", async () => {
  const [source, gate] = await Promise.all([
    readFile(new URL("../src/episodeReviewMarkerLifecycle.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/check-episode-review-marker-lifecycle.mjs", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(source, /fetch\(|roloClient|localStorage|sessionStorage|BroadcastChannel|document\.cookie/);
  assert.doesNotMatch(source, /POST|PUT|PATCH|DELETE|artifact|raw_path|storage_location/);
  assert.match(gate, /exact_target_marker_retained: true/);
  assert.match(gate, /explored_reload_is_ordinary_navigation: true/);
  assert.match(gate, /canonical_return_restores_marker: true/);
  assert.match(gate, /automatic_navigation: false/);
  assert.match(gate, /supports_write: false/);
});
