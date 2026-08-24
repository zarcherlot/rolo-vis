import assert from "node:assert/strict";
import test from "node:test";

import { RoloClient, RoloContractError } from "../src/roloClient.ts";
import { parseEpisodeDetail, parseEpisodeTimelinePage } from "../src/contracts/episode.ts";

const SUMMARY = {
  schema_version: "rolo-episode-summary/v1",
  robot_id: "mentorpi",
  episode_id: "ep-discovery-001",
  revision: 2,
  task_label: "Discover ROS graph",
  state: "COMPLETED",
  outcome: "SUCCEEDED",
  verification: "UNVERIFIED",
  coverage: "PARTIAL",
  started_at: "2026-08-23T03:00:00Z",
  ended_at: "2026-08-23T03:00:04Z",
  execution_id: "exec-discovery-001",
  test_case_id: "ros-discovery",
  lifecycle_run_id: "run-discovery-001",
  operation: "ros.graph.discover",
  event_count: 2,
  asset_count: 1,
  finding_count: 1,
  evidence_ids: ["ev_episode_outcome"],
  source_kind: "published_episode_projection",
  limitations: ["ROS CLI access was sandbox-limited."],
};

const ASSET = {
  schema_version: "rolo-episode-asset-summary/v1",
  robot_id: "mentorpi",
  episode_id: "ep-discovery-001",
  revision: 2,
  asset_id: "asset-graph-summary",
  modality: "ros-graph",
  source_label: "Sanitized graph summary",
  captured_at: "2026-08-23T03:00:02Z",
  offset_ms: 2000,
  world_kind: "PHYSICAL",
  evidence_kind: "NORMALIZED",
  frame: null,
  clock_domain: "robot-monotonic",
  synchronization: "DEGRADED",
  media_type: "application/json",
  byte_count: 824,
  digest: "a".repeat(64),
  data_classification: "INTERNAL",
  evidence_id: "ev_graph_summary",
  availability: "AVAILABLE",
  limitations: ["Raw ROS names are withheld."],
};

const FINDING = {
  schema_version: "rolo-episode-finding-summary/v1",
  robot_id: "mentorpi",
  episode_id: "ep-discovery-001",
  revision: 2,
  finding_id: "finding-sandbox",
  kind: "CANDIDATE_CAUSE",
  authority: "INFERRED",
  title: "Sandbox may have limited ROS CLI access",
  summary: "The advisory Agent associated missing graph evidence with sandbox restrictions.",
  start_offset_ms: 1200,
  end_offset_ms: 2600,
  supporting_evidence_ids: ["ev_graph_summary"],
  supporting_asset_ids: [],
  contradicting_evidence_ids: [],
  confidence: 0.76,
  verification: "UNVERIFIED",
  limitations: ["Candidate cause is not an observed fact."],
};

const DETAIL = {
  ...SUMMARY,
  schema_version: "rolo-episode-detail/v1",
  as_of: "2026-08-23T03:00:05Z",
  immutable: true,
  clock_domain: "robot-monotonic",
  synchronization: "DEGRADED",
  available_lanes: ["COMMAND", "AGENT"],
  expected_behavior: "A bounded ROS graph summary is produced.",
  observed_behavior: "The producer returned a partial graph summary.",
  assets: [ASSET],
  findings: [FINDING],
};

const EVENTS = [
  {
    schema_version: "rolo-episode-timeline-event/v1",
    robot_id: "mentorpi",
    episode_id: "ep-discovery-001",
    revision: 2,
    event_id: "event-intent",
    sequence: 0,
    offset_ms: 0,
    occurred_at: "2026-08-23T03:00:00Z",
    duration_ms: null,
    clock_domain: "robot-monotonic",
    synchronization: "DEGRADED",
    lane: "COMMAND",
    title: "Discovery intent declared",
    summary: "A bounded graph discovery was requested.",
    severity: "INFO",
    authority: "DECLARED",
    evidence_ids: [],
    asset_ids: [],
    related_event_ids: [],
    metrics: {},
    limitations: [],
  },
  {
    schema_version: "rolo-episode-timeline-event/v1",
    robot_id: "mentorpi",
    episode_id: "ep-discovery-001",
    revision: 2,
    event_id: "event-agent",
    sequence: 1,
    offset_ms: 2400,
    occurred_at: "2026-08-23T03:00:02.400Z",
    duration_ms: 200,
    clock_domain: "robot-monotonic",
    synchronization: "DEGRADED",
    lane: "AGENT",
    title: "Candidate cause proposed",
    summary: "The Agent proposed a sandbox-related cause.",
    severity: "WARNING",
    authority: "INFERRED",
    evidence_ids: ["ev_graph_summary"],
    asset_ids: [],
    related_event_ids: ["event-intent"],
    metrics: { confidence: 0.76 },
    limitations: ["This is not a verified explanation."],
  },
];

const TIMELINE = {
  schema_version: "rolo-episode-timeline-page/v1",
  robot_id: "mentorpi",
  episode_id: "ep-discovery-001",
  revision: 2,
  items: EVENTS,
  limit: 100,
  cursor: null,
  next_cursor: null,
  as_of: "2026-08-23T03:00:05Z",
  immutable: true,
  limitations: ["offset_ms remains the ordering authority."],
};

test("Episode v1 parser preserves independent outcome, verification, and inference authority", () => {
  const detail = parseEpisodeDetail(DETAIL, "/episode", "mentorpi", "ep-discovery-001");
  assert.equal(detail.outcome, "SUCCEEDED");
  assert.equal(detail.verification, "UNVERIFIED");
  assert.equal(detail.findings[0].authority, "INFERRED");
  assert.equal(detail.assets[0].world_kind, "PHYSICAL");
});

test("Episode parser rejects unsafe recursive fields and verified candidate causes", () => {
  assert.throws(
    () => parseEpisodeDetail({ ...DETAIL, model_prompt: "hidden" }, "/episode", "mentorpi", "ep-discovery-001"),
    RoloContractError,
  );
  assert.throws(
    () => parseEpisodeDetail({ ...DETAIL, findings: [{ ...FINDING, verification: "VERIFIED" }] }, "/episode", "mentorpi", "ep-discovery-001"),
    RoloContractError,
  );
});

test("Episode timeline parser rejects mixed revisions and unknown authority", () => {
  assert.throws(
    () => parseEpisodeTimelinePage({ ...TIMELINE, revision: 3 }, "/timeline", { robotId: "mentorpi", episodeId: "ep-discovery-001", revision: 2 }, { limit: 100 }),
    RoloContractError,
  );
  assert.throws(
    () => parseEpisodeTimelinePage({ ...TIMELINE, items: [{ ...EVENTS[0], authority: "TRUST_ME" }] }, "/timeline", { robotId: "mentorpi", episodeId: "ep-discovery-001", revision: 2 }, { limit: 100 }),
    RoloContractError,
  );
});

test("RoloClient pins the timeline revision and encodes Episode identities", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    if (url.includes("/timeline?")) return { ok: true, json: async () => TIMELINE };
    if (url.endsWith("/ep-discovery-001")) return { ok: true, json: async () => DETAIL };
    return {
      ok: true,
      json: async () => ({
        schema_version: "rolo-episode-collection/v1",
        robot_id: "mentorpi",
        items: [SUMMARY],
        total: 1,
        limit: 50,
        offset: 0,
        next_offset: null,
        as_of: "2026-08-23T03:00:05Z",
        source_kind: "published_episode_projection",
        limitations: [],
      }),
    };
  };
  try {
    const client = new RoloClient("http://rolo.test");
    await client.episodeCollection("mentorpi");
    await client.episode("mentorpi", "ep-discovery-001");
    await client.episodeTimelinePage("mentorpi", "ep-discovery-001", 2);
    assert.deepEqual(requests, [
      "http://rolo.test/v1/robots/mentorpi/episodes?limit=50&offset=0",
      "http://rolo.test/v1/robots/mentorpi/episodes/ep-discovery-001",
      "http://rolo.test/v1/robots/mentorpi/episodes/ep-discovery-001/timeline?revision=2&limit=100",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Episode evidence source kinds remain resolvable through the shared Evidence drawer", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      schema_version: "rolo-evidence-record/v1",
      evidence_id: "ev_graph_summary",
      robot_id: "mentorpi",
      title: "Episode observation asset",
      summary: "Sanitized Episode evidence metadata.",
      authority: "OBSERVED",
      source_kind: "episode_asset",
      integrity_status: "validated",
      classification: "INTERNAL",
      observed_at: "2026-08-23T03:00:02Z",
      freshness: "unknown",
      confidence: 0.8,
      reference_hint: "artifact:withheld",
      reference_digest: "b".repeat(64),
      related_node_ids: [],
      limitations: ["Asset bytes are withheld."],
    }),
  });
  try {
    const evidence = await new RoloClient("http://rolo.test").evidence("ev_graph_summary");
    assert.equal(evidence.source_kind, "episode_asset");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
