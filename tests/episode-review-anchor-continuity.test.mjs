import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { EPISODE_REVIEW_ANCHOR_CONTINUITY_BASELINE } from "../src/contracts/compatibility.ts";
import { buildEpisodeReviewHandoffLink, readEpisodeReviewHandoff } from "../src/episodeNavigation.ts";
import { deriveEpisodeReviewAnchorContinuity, EPISODE_REVIEW_ANCHOR_FIELDS } from "../src/episodeReviewAnchor.ts";

const anchor = {
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
const anchorLink = buildEpisodeReviewHandoffLink("https://workbench.test/console?theme=dark", anchor);
const intent = readEpisodeReviewHandoff(anchorLink);

test("E19A establishes continuity only after an E18 receipt was accepted", () => {
  assert.deepEqual(deriveEpisodeReviewAnchorContinuity({ intent, anchorAccepted: false, current: anchor, workbenchUrl: anchorLink }), { status: "NONE" });
  assert.deepEqual(deriveEpisodeReviewAnchorContinuity({ intent: { kind: "NONE" }, anchorAccepted: true, current: anchor, workbenchUrl: anchorLink }), { status: "NONE" });
  assert.deepEqual(deriveEpisodeReviewAnchorContinuity({ intent, anchorAccepted: true, current: null, workbenchUrl: anchorLink }), { status: "NONE" });
  assert.deepEqual(deriveEpisodeReviewAnchorContinuity({ intent, anchorAccepted: true, current: anchor, workbenchUrl: anchorLink }), { status: "ANCHORED", target: anchor });
  assert.equal(EPISODE_REVIEW_ANCHOR_CONTINUITY_BASELINE.extends, "rolo-vis-episode-review-handoff-receipt/2026-08");
  assert.equal(EPISODE_REVIEW_ANCHOR_CONTINUITY_BASELINE.persistsAnchor, false);
  assert.equal(EPISODE_REVIEW_ANCHOR_CONTINUITY_BASELINE.supportsWrite, false);
});

test("E19A reports exact changed fields in stable contract order", () => {
  const current = { ...anchor, eventId: "evt-later", compareEvidenceId: null, cohortDays: 90 };
  const continuity = deriveEpisodeReviewAnchorContinuity({
    intent,
    anchorAccepted: true,
    current,
    workbenchUrl: `${anchorLink}&tracking=discarded#drawer`,
  });
  assert.equal(continuity.status, "EXPLORING");
  assert.deepEqual(continuity.differences, ["Event focus", "Evidence context", "Cohort window"]);
  assert.deepEqual(EPISODE_REVIEW_ANCHOR_FIELDS.map(([, label]) => label), [
    "Robot", "Episode", "Revision", "Event focus", "Finding focus", "Asset focus",
    "Comparison Episode", "Comparison revision", "Evidence context", "Cohort window",
  ]);
  assert.deepEqual(readEpisodeReviewHandoff(continuity.returnLink), { kind: "VALID", target: anchor });
  assert.doesNotMatch(continuity.returnLink, /tracking|discarded|drawer/);
});

test("E19B exposes an explicit return link without automatic navigation", async () => {
  const studio = await readFile(new URL("../src/EpisodeStudio.tsx", import.meta.url), "utf8");
  assert.match(studio, /Exploring beyond the restored handoff/);
  assert.match(studio, /Shared anchor active for this tab/);
  assert.match(studio, /Return to shared anchor/);
  assert.match(studio, /href=\{reviewAnchorContinuity\.returnLink\}/);
  const returnLinkStart = studio.indexOf('<a className="secondary-button episode-review-anchor-return"');
  const returnLink = studio.slice(returnLinkStart, studio.indexOf("</a>", returnLinkStart) + 4);
  assert.doesNotMatch(returnLink, /onClick|location\.(assign|replace)|history\.(pushState|replaceState)|dispatchEvent/);
});

test("E19 remains tab-memory navigation continuity without new authority", async () => {
  const source = await readFile(new URL("../src/episodeReviewAnchor.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\(|roloClient|localStorage|sessionStorage|BroadcastChannel|document\.cookie/);
  assert.doesNotMatch(source, /POST|PUT|PATCH|DELETE|artifact|raw_path|storage_location/);
  assert.doesNotMatch(source, /verification|verdict|outcome|release|sender|userId/);
});

test("E19C live gate covers accepted anchor divergence and exact return", async () => {
  const gate = await readFile(new URL("../scripts/check-episode-review-anchor-continuity.mjs", import.meta.url), "utf8");
  assert.match(gate, /accepted_anchor_established: true/);
  assert.match(gate, /local_exploration_distinguished: true/);
  assert.match(gate, /canonical_return_round_trip: true/);
  assert.match(gate, /automatic_navigation: false/);
  assert.match(gate, /anchor_persisted: false/);
  assert.match(gate, /adds_endpoint: false/);
  assert.match(gate, /supports_write: false/);
});
