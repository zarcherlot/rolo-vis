import assert from "node:assert/strict";
import test from "node:test";

import { parseEpisodeRevisionCollection } from "../src/contracts/episode.ts";
import { ROLO_API_FEATURES, RoloClient, RoloContractError } from "../src/roloClient.ts";

function revision(revisionNumber, overrides = {}) {
  return {
    schema_version: "rolo-episode-revision-summary/v1",
    robot_id: "mentorpi",
    episode_id: "ep-history",
    revision: revisionNumber,
    parent_revision: revisionNumber === 1 ? null : revisionNumber - 1,
    committed_at: `2026-08-24T00:00:0${revisionNumber}Z`,
    state: "COMPLETED",
    outcome: "SUCCEEDED",
    verification: "UNVERIFIED",
    coverage: "COMPLETE",
    immutable: true,
    event_count: 2,
    asset_count: 0,
    finding_count: 0,
    is_current: revisionNumber === 2,
    source_kind: "committed_episode_record",
    limitations: [],
    ...overrides,
  };
}

const HISTORY = {
  schema_version: "rolo-episode-revision-collection/v1",
  robot_id: "mentorpi",
  episode_id: "ep-history",
  current_revision: 2,
  items: [revision(2), revision(1)],
  total: 2,
  limit: 100,
  offset: 0,
  next_offset: null,
  as_of: "2026-08-24T00:00:03Z",
  source_kind: "episode_revision_history",
  limitations: [],
};

test("Episode revision history accepts a safe contiguous newest-first chain", () => {
  const value = parseEpisodeRevisionCollection(HISTORY, "/revisions", "mentorpi", "ep-history", { limit: 100, offset: 0 });
  assert.deepEqual(value.items.map((item) => item.revision), [2, 1]);
  assert.equal(value.items[0].is_current, true);
});

test("Episode revision history rejects lineage drift, unsafe fields, and false legacy history", () => {
  assert.throws(
    () => parseEpisodeRevisionCollection({ ...HISTORY, items: [revision(2, { parent_revision: null }), revision(1)] }, "/revisions", "mentorpi", "ep-history", { limit: 100, offset: 0 }),
    RoloContractError,
  );
  assert.throws(
    () => parseEpisodeRevisionCollection({ ...HISTORY, current_revision: 3, items: [revision(3, { is_current: true }), revision(1, { is_current: false })] }, "/revisions", "mentorpi", "ep-history", { limit: 100, offset: 0 }),
    RoloContractError,
  );
  assert.throws(
    () => parseEpisodeRevisionCollection({ ...HISTORY, artifact_path: "C:\\secret\\episode.json" }, "/revisions", "mentorpi", "ep-history", { limit: 100, offset: 0 }),
    RoloContractError,
  );
  assert.throws(
    () => parseEpisodeRevisionCollection({ ...HISTORY, items: [revision(1, { source_kind: "published_episode_projection", is_current: false })] }, "/revisions", "mentorpi", "ep-history", { limit: 100, offset: 0 }),
    RoloContractError,
  );
});

test("RoloClient negotiates the E7 feature and pins historical detail explicitly", async () => {
  assert.equal(ROLO_API_FEATURES.episodeRevisionHistory, "workbench.episode-revision-history/v1");
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    if (url.includes("/revisions?")) return { ok: true, json: async () => HISTORY };
    return { ok: true, json: async () => ({
      schema_version: "rolo-episode-detail/v1",
      robot_id: "mentorpi", episode_id: "ep-history", revision: 1,
      task_label: "History", state: "COMPLETED", outcome: "SUCCEEDED", verification: "UNVERIFIED", coverage: "COMPLETE",
      started_at: "2026-08-24T00:00:00Z", ended_at: "2026-08-24T00:00:01Z",
      execution_id: null, test_case_id: null, lifecycle_run_id: null, operation: null,
      event_count: 0, asset_count: 0, finding_count: 0, evidence_ids: [], source_kind: "published_episode_projection", limitations: [],
      as_of: "2026-08-24T00:00:02Z", immutable: true, clock_domain: "robot-monotonic", synchronization: "SYNCED",
      available_lanes: [], expected_behavior: null, observed_behavior: null, assets: [], findings: [],
    }) };
  };
  try {
    const client = new RoloClient("http://rolo.test");
    await client.episodeRevisions("mentorpi", "ep-history");
    await client.episode("mentorpi", "ep-history", undefined, 1);
    assert.deepEqual(requests, [
      "http://rolo.test/v1/robots/mentorpi/episodes/ep-history/revisions?limit=100&offset=0",
      "http://rolo.test/v1/robots/mentorpi/episodes/ep-history?revision=1",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
