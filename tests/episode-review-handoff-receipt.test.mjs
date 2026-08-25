import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildEpisodeReviewHandoffLink,
  buildEpisodeReviewLink,
  buildWorkbenchViewLink,
  readEpisodeReviewHandoff,
  writeEpisodeReviewHandoffLink,
} from "../src/episodeNavigation.ts";
import { assessEpisodeReviewReceipt } from "../src/episodeReviewReceipt.ts";
import { EPISODE_REVIEW_HANDOFF_RECEIPT_BASELINE } from "../src/contracts/compatibility.ts";

const target = {
  robotId: "mentorpi",
  episodeId: "ep-reference",
  revision: 3,
  eventId: "evt-outcome",
  findingId: "finding-1",
  assetId: null,
  compareEpisodeId: null,
  compareRevision: null,
  compareEvidenceId: null,
  cohortDays: 30,
};

const detail = {
  robot_id: target.robotId,
  episode_id: target.episodeId,
  revision: target.revision,
  immutable: true,
  findings: [{ finding_id: target.findingId }],
  assets: [{ asset_id: "asset-1", evidence_id: "ev-shared" }],
};
const events = [{ event_id: target.eventId }];

function assess(intent, overrides = {}) {
  return assessEpisodeReviewReceipt({
    intent,
    robotId: target.robotId,
    detail,
    events,
    detailLoading: false,
    detailError: "",
    comparison: null,
    evidenceContext: null,
    comparisonLoading: false,
    comparisonError: "",
    ...overrides,
  });
}

test("E18A adds one canonical receipt marker without mutating the frozen E17 builder", () => {
  const source = "https://workbench.test/console?theme=dark&token=secret#drawer";
  const e17 = buildEpisodeReviewLink(source, target);
  const e18 = buildEpisodeReviewHandoffLink(source, target);
  assert.equal(e17, "https://workbench.test/console?view=episode&robot=mentorpi&episode=ep-reference&revision=3&event=evt-outcome&finding=finding-1&cohort_days=30");
  assert.equal(e18, `${e17}&review_handoff=1`);
  assert.deepEqual(readEpisodeReviewHandoff(e18), { kind: "VALID", target });
  assert.deepEqual(readEpisodeReviewHandoff(e17), { kind: "NONE" });
  assert.equal(buildWorkbenchViewLink(e18, "wiki"), "/console?view=wiki");
  assert.equal(EPISODE_REVIEW_HANDOFF_RECEIPT_BASELINE.extends, "rolo-vis-episode-review-link-handoff/2026-08");
  assert.equal(EPISODE_REVIEW_HANDOFF_RECEIPT_BASELINE.authenticatesSender, false);
  assert.equal(EPISODE_REVIEW_HANDOFF_RECEIPT_BASELINE.supportsWrite, false);
});

test("E18A rejects non-canonical receipt claims while ordinary navigation remains separate", () => {
  const canonical = buildEpisodeReviewHandoffLink("https://workbench.test/", target);
  for (const value of [
    `${canonical}&review_handoff=1`,
    canonical.replace("review_handoff=1", "review_handoff=yes"),
    `${canonical}&tracking=campaign`,
    `${canonical}#drawer`,
    canonical.replace("view=episode&", "view=episode&view=episode&"),
  ]) {
    assert.deepEqual(readEpisodeReviewHandoff(value), { kind: "INVALID", reason: "NON_CANONICAL_REVIEW_HANDOFF" });
  }
  assert.throws(() => buildEpisodeReviewHandoffLink("https://user:secret@workbench.test/", target), /without embedded credentials/);
  assert.throws(() => buildEpisodeReviewHandoffLink("file:///tmp/workbench.html", target), /HTTP\(S\)/);
});

test("E18B accepts only after the pinned public context is independently re-read", () => {
  const intent = readEpisodeReviewHandoff(buildEpisodeReviewHandoffLink("https://workbench.test/", target));
  assert.equal(assess(intent, { detail: null, detailLoading: true }).status, "VALIDATING");
  assert.deepEqual(assess(intent), {
    status: "ACCEPTED",
    title: "Read-only review handoff restored",
    detail: "The identifiers were independently re-read from rolo. This receipt does not prove sender identity, Evidence quality, outcome, or release authority.",
    targetLabel: "ep-reference@3",
    comparison: false,
  });
});

test("E18B revalidates comparison Evidence and Asset attachment without raising authority", () => {
  const comparisonTarget = {
    ...target,
    assetId: "asset-1",
    compareEpisodeId: "ep-candidate",
    compareRevision: 7,
    compareEvidenceId: "ev-shared",
  };
  const intent = readEpisodeReviewHandoff(buildEpisodeReviewHandoffLink("https://workbench.test/", comparisonTarget));
  const comparison = {
    left: { robotId: target.robotId, episodeId: target.episodeId, revision: target.revision },
    right: { robotId: target.robotId, episodeId: "ep-candidate", revision: 7 },
    publication: { left: { immutable: true }, right: { immutable: true } },
  };
  const evidenceContext = {
    items: [{
      evidenceId: "ev-shared",
      left: { items: [{ source: "ASSET", role: "REFERENCE", contextId: "asset-1" }] },
      right: { items: [] },
    }],
  };
  assert.equal(assess(intent, { comparison, evidenceContext }).status, "ACCEPTED");
  assert.equal(assess(intent, { comparison: { ...comparison, right: { ...comparison.right, revision: 8 } }, evidenceContext }).status, "REJECTED");
  assert.equal(assess(intent, { comparison, evidenceContext: { items: [] } }).status, "REJECTED");
  assert.equal(assess(intent, { comparison, evidenceContext: { items: [{ ...evidenceContext.items[0], left: { items: [] } }] } }).status, "REJECTED");
});

test("E18B rejects stale publication focus and malformed receipt claims", () => {
  const intent = readEpisodeReviewHandoff(buildEpisodeReviewHandoffLink("https://workbench.test/", target));
  assert.equal(assess(intent, { detail: { ...detail, immutable: false } }).status, "REJECTED");
  assert.equal(assess(intent, { events: [] }).status, "REJECTED");
  assert.equal(assess({ kind: "INVALID", reason: "NON_CANONICAL_REVIEW_HANDOFF" }).status, "REJECTED");
});

test("E18 clipboard denial propagates without navigation or persistence fallback", async () => {
  let attempted = "";
  await assert.rejects(() => writeEpisodeReviewHandoffLink({
    writeText: async (value) => {
      attempted = value;
      throw new Error("clipboard denied");
    },
  }, "https://workbench.test/?token=secret", target), /clipboard denied/);
  assert.equal(attempted, buildEpisodeReviewHandoffLink("https://workbench.test/", target));
});

test("E18 recipient UI is explicit and remains navigation-only", async () => {
  const [studio, navigation, receipt] = await Promise.all([
    readFile(new URL("../src/EpisodeStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/episodeNavigation.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/episodeReviewReceipt.ts", import.meta.url), "utf8"),
  ]);
  assert.match(studio, /Review handoff receipt · navigation only/);
  assert.match(studio, /No sender authentication/);
  assert.match(studio, /writeEpisodeReviewHandoffLink\(navigator\.clipboard, window\.location\.href, target\)/);
  const source = `${navigation}\n${receipt}`;
  assert.doesNotMatch(source, /fetch\(|roloClient|localStorage|sessionStorage|BroadcastChannel/);
  assert.doesNotMatch(source, /POST|PUT|PATCH|DELETE|artifact|raw_path|storage_location/);
  assert.match(receipt, /does not prove sender identity, Evidence quality, outcome, or release authority/);
});

test("E18C live gate keeps receipt authority and negative capabilities explicit", async () => {
  const gate = await readFile(new URL("../scripts/check-episode-review-handoff-receipt.mjs", import.meta.url), "utf8");
  assert.match(gate, /canonical_receipt_round_trip: true/);
  assert.match(gate, /independent_publication_validation: true/);
  assert.match(gate, /stale_or_noncanonical_receipt_rejected: true/);
  assert.match(gate, /receipt_authority: "NAVIGATION_RESTORATION_RECEIPT_ONLY"/);
  assert.match(gate, /authenticates_sender: false/);
  assert.match(gate, /adds_endpoint: false/);
  assert.match(gate, /supports_write: false/);
});
