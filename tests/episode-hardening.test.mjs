import assert from "node:assert/strict";
import test from "node:test";

import {
  appendTimelineEvents,
  buildEpisodeDeepLink,
  buildWorkbenchViewLink,
  EPISODE_TIMELINE_PROJECTION_BUDGET_MS,
  EPISODE_VISIBLE_EVENT_LIMIT,
  nextTimelineEventId,
  projectTimelineLayout,
  readEpisodeDeepLink,
} from "../src/episodeNavigation.ts";

function event(sequence, lane = "STATE") {
  return {
    schema_version: "rolo-episode-timeline-event/v1",
    robot_id: "mentorpi",
    episode_id: "ep-regression",
    revision: 3,
    event_id: `event-${sequence}`,
    sequence,
    offset_ms: sequence * 10,
    occurred_at: "2026-08-24T00:00:00Z",
    duration_ms: null,
    clock_domain: "robot-monotonic",
    synchronization: "SYNCED",
    lane,
    title: `Event ${sequence}`,
    summary: "Bounded regression event.",
    severity: "INFO",
    authority: "DECLARED",
    evidence_ids: [],
    asset_ids: [],
    related_event_ids: [],
    metrics: {},
    limitations: [],
  };
}

test("Episode deep links pin robot, Episode, revision, and event while preserving unrelated query state", () => {
  const link = buildEpisodeDeepLink("https://workbench.test/?theme=dark", {
    robotId: "mentorpi",
    episodeId: "ep-regression",
    revision: 3,
    eventId: "event-42",
  });
  assert.equal(link, "/?theme=dark&view=episode&robot=mentorpi&episode=ep-regression&revision=3&event=event-42");
  assert.deepEqual(readEpisodeDeepLink(`https://workbench.test${link}`), {
    robotId: "mentorpi",
    episodeId: "ep-regression",
    revision: 3,
    eventId: "event-42",
  });
  assert.equal(buildWorkbenchViewLink(`https://workbench.test${link}`, "wiki"), "/?theme=dark&view=wiki");
});

test("Episode deep links fail closed on malformed identity or revision", () => {
  assert.equal(readEpisodeDeepLink("https://workbench.test/?view=episode&robot=../secret&episode=ep-1&revision=1"), null);
  assert.equal(readEpisodeDeepLink("https://workbench.test/?view=episode&robot=r1&episode=ep-1&revision=0"), null);
});

test("timeline keyboard navigation follows sequence order across visible lanes", () => {
  const events = [event(0, "COMMAND"), event(1, "AGENT"), event(2, "OUTCOME")];
  const lanes = new Set(["COMMAND", "OUTCOME"]);
  assert.equal(nextTimelineEventId(events, lanes, "event-0", "ArrowRight"), "event-2");
  assert.equal(nextTimelineEventId(events, lanes, "event-2", "ArrowLeft"), "event-0");
  assert.equal(nextTimelineEventId(events, lanes, "event-0", "End"), "event-2");
  assert.equal(nextTimelineEventId(events, lanes, "event-2", "Home"), "event-0");
});

test("timeline accumulation rejects overlap and never exceeds the 500-event display budget", () => {
  let accumulated = [];
  for (let page = 0; page < 5; page += 1) {
    accumulated = appendTimelineEvents(accumulated, Array.from({ length: 100 }, (_, index) => event(page * 100 + index)));
  }
  assert.equal(accumulated.length, EPISODE_VISIBLE_EVENT_LIMIT);
  assert.throws(() => appendTimelineEvents(accumulated, [event(499)]), /overlap/);
  assert.equal(appendTimelineEvents(accumulated, [event(500)]).length, EPISODE_VISIBLE_EVENT_LIMIT);
});

test("500-event timeline projection stays inside the synchronous layout budget", () => {
  const events = Array.from({ length: EPISODE_VISIBLE_EVENT_LIMIT }, (_, index) => event(index, index % 2 ? "STATE" : "OBSERVATION"));
  const started = performance.now();
  const layout = projectTimelineLayout(events, ["STATE", "OBSERVATION"], new Set(["STATE", "OBSERVATION"]));
  const elapsed = performance.now() - started;
  assert.equal(layout.lanes.reduce((count, lane) => count + lane.items.length, 0), EPISODE_VISIBLE_EVENT_LIMIT);
  assert.ok(elapsed < EPISODE_TIMELINE_PROJECTION_BUDGET_MS, `timeline projection took ${elapsed.toFixed(2)} ms`);
});
