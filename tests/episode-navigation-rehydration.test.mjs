import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildEpisodeDeepLink,
  planWorkbenchNavigationReplay,
  readWorkbenchNavigationIntent,
  shouldRejectEpisodeNavigation,
} from "../src/episodeNavigation.ts";

const target = {
  robotId: "mentorpi",
  episodeId: "ep-regression",
  revision: 3,
  eventId: "event-42",
  findingId: null,
  assetId: null,
  compareEpisodeId: "ep-candidate",
  compareRevision: 7,
  compareEvidenceId: "ev-shared",
  cohortDays: 30,
};

test("E16A classifies restorable Episode and ordinary workbench history entries", () => {
  const link = buildEpisodeDeepLink("https://workbench.test/?theme=dark", target);
  assert.deepEqual(readWorkbenchNavigationIntent(`https://workbench.test${link}`), {
    kind: "EPISODE",
    view: "episode",
    target,
  });
  assert.deepEqual(readWorkbenchNavigationIntent("https://workbench.test/?view=wiki"), {
    kind: "VIEW",
    view: "wiki",
  });
  assert.deepEqual(readWorkbenchNavigationIntent("https://workbench.test/?view=deployment"), {
    kind: "VIEW",
    view: "deployment",
  });
  assert.deepEqual(readWorkbenchNavigationIntent("https://workbench.test/?theme=dark"), {
    kind: "VIEW",
    view: "stack",
  });
});

test("E16A distinguishes invalid Episode state from unsupported workbench state", () => {
  assert.deepEqual(readWorkbenchNavigationIntent("https://workbench.test/?view=episode&robot=mentorpi&episode=../unsafe"), {
    kind: "INVALID",
    view: "stack",
    reason: "INVALID_EPISODE",
  });
  assert.deepEqual(readWorkbenchNavigationIntent("https://workbench.test/?view=teleop"), {
    kind: "INVALID",
    view: "stack",
    reason: "UNSUPPORTED_VIEW",
  });
  assert.deepEqual(readWorkbenchNavigationIntent("https://workbench.test/?view=episode"), {
    kind: "INVALID",
    view: "stack",
    reason: "INVALID_EPISODE",
  });
});

test("E16B rehydrates browser history through the strict parser and remount boundary", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /window\.addEventListener\("popstate", handlePopState\)/);
  assert.match(app, /window\.removeEventListener\("popstate", handlePopState\)/);
  assert.match(app, /const intent = readWorkbenchNavigationIntent\(window\.location\.href\)/);
  assert.match(app, /setEpisodeNavigationRevision\(\(revision\) => revision \+ 1\)/);
  assert.match(app, /key=\{`episode-navigation-\$\{episodeNavigationRevision\}`\}/);
  assert.match(app, /planWorkbenchNavigationReplay\(intent, robot\?\.robot_id \|\| null\)/);
  assert.match(app, /buildWorkbenchViewLink\(window\.location\.href, "stack"\)/);
});

test("E16B remains read-only and introduces no navigation-side API operation", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const handler = app.slice(app.indexOf("const handlePopState"), app.indexOf("window.addEventListener(\"popstate\""));
  assert.match(handler, /connect\(replay\.reconnectRobotId\)/);
  assert.doesNotMatch(handler, /roloClient\./);
  assert.doesNotMatch(handler, /fetch\(|POST|PUT|PATCH|DELETE/);
});

test("E16C reconnects only when a replay crosses robot identity", () => {
  const intent = readWorkbenchNavigationIntent(`https://workbench.test${buildEpisodeDeepLink("https://workbench.test/", target)}`);
  assert.equal(intent.kind, "EPISODE");
  assert.deepEqual(planWorkbenchNavigationReplay(intent, "mentorpi"), {
    view: "episode",
    episodeTarget: target,
    reconnectRobotId: null,
    normalizeToStack: false,
  });
  assert.deepEqual(planWorkbenchNavigationReplay(intent, "another-robot"), {
    view: "episode",
    episodeTarget: target,
    reconnectRobotId: "mentorpi",
    normalizeToStack: false,
  });
});

test("E16C normalizes invalid history and waits for settled feature negotiation", () => {
  const invalid = readWorkbenchNavigationIntent("https://workbench.test/?view=episode&robot=mentorpi&episode=../unsafe");
  assert.deepEqual(planWorkbenchNavigationReplay(invalid, "mentorpi"), {
    view: "stack",
    episodeTarget: null,
    reconnectRobotId: null,
    normalizeToStack: true,
  });
  assert.equal(shouldRejectEpisodeNavigation("episode", false, false), false);
  assert.equal(shouldRejectEpisodeNavigation("episode", false, true), true);
  assert.equal(shouldRejectEpisodeNavigation("episode", true, true), false);
  assert.equal(shouldRejectEpisodeNavigation("stack", false, true), false);
});

test("E16C App consumes the replay plan and existing feature negotiation boundary", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /planWorkbenchNavigationReplay\(intent, robot\?\.robot_id \|\| null\)/);
  assert.match(app, /if \(replay\.reconnectRobotId\) void connect\(replay\.reconnectRobotId\)/);
  assert.match(app, /if \(replay\.normalizeToStack\)/);
  assert.match(app, /shouldRejectEpisodeNavigation\(/);
  assert.match(app, /setEvidence\(null\)/);
  assert.match(app, /setStackContextFocus\(null\)/);
  assert.match(app, /setWikiContextFocus\(null\)/);
});
