import assert from "node:assert/strict";
import test from "node:test";

import { parseEpisodeCohort } from "../src/contracts/episode.ts";
import { buildEpisodeCohortReview } from "../src/episodeCohort.ts";
import { RoloClient, ROLO_API_FEATURES } from "../src/roloClient.ts";

function member(id, startedAt, durationMs = 4000) {
  return {
    schema_version: "rolo-episode-cohort-member/v1",
    robot_id: "demo_diff",
    episode_id: id,
    revision: 1,
    task_label: `Run ${id}`,
    started_at: startedAt,
    ended_at: new Date(Date.parse(startedAt) + durationMs).toISOString(),
    duration_ms: durationMs,
    state: "COMPLETED",
    outcome: "SUCCEEDED",
    verification: "UNVERIFIED",
    coverage: "METADATA_ONLY",
    immutable: true,
    is_current: true,
    event_count: 2,
    asset_count: 0,
    finding_count: 0,
    evidence_count: 1,
    source_kind: "current_episode_publication",
    limitations: [],
  };
}

function cohort() {
  return {
    schema_version: "rolo-episode-cohort/v1",
    robot_id: "demo_diff",
    reference_episode_id: "ep-reference",
    reference_revision: 2,
    operation: "nav.execute",
    test_case_id: "navigation-smoke",
    expected_behavior_sha256: "1".repeat(64),
    window_days: 7,
    window_started_at: "2026-08-16T03:00:00Z",
    window_ended_at: "2026-08-23T03:00:00Z",
    items: [
      member("ep-newer", "2026-08-22T03:00:00Z", 6000),
      { ...member("ep-older", "2026-08-21T03:00:00Z", 2000), outcome: "FAILED", verification: "VERIFIED", finding_count: 2 },
    ],
    population_count: 3,
    included_count: 2,
    excluded_count: 1,
    truncated_count: 0,
    exclusions: {
      schema_version: "rolo-episode-cohort-exclusions/v1",
      running: 1,
      mutable: 0,
    },
    coverage: "COMPLETE",
    limit: 100,
    as_of: "2026-08-24T00:00:00Z",
    source_kind: "published_episode_cohort",
    limitations: [],
  };
}

function detail() {
  return {
    robot_id: "demo_diff",
    episode_id: "ep-reference",
    revision: 2,
    started_at: "2026-08-23T03:00:00Z",
    ended_at: "2026-08-23T03:00:04Z",
    event_count: 3,
    asset_count: 1,
    finding_count: 1,
    evidence_ids: ["ev-1", "ev-2"],
  };
}

test("strict cohort parser validates bounds, arithmetic, order, and current publications", () => {
  const parsed = parseEpisodeCohort(
    cohort(), "/cohort", "demo_diff", "ep-reference", 2,
    { windowDays: 7, limit: 100 },
  );
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.exclusions.running, 1);

  assert.throws(() => parseEpisodeCohort(
    { ...cohort(), population_count: 4 }, "/cohort", "demo_diff", "ep-reference", 2,
    { windowDays: 7, limit: 100 },
  ), /arithmetic/);
  assert.throws(() => parseEpisodeCohort(
    { ...cohort(), items: [...cohort().items].reverse() }, "/cohort", "demo_diff", "ep-reference", 2,
    { windowDays: 7, limit: 100 },
  ), /newest-first/);
  assert.throws(() => parseEpisodeCohort(
    { ...cohort(), artifact_path: "C:\\private\\episode.json" }, "/cohort", "demo_diff", "ep-reference", 2,
    { windowDays: 7, limit: 100 },
  ), /unsafe public Episode field/);
});

test("cohort review publishes neutral five-number summaries without deltas", () => {
  const review = buildEpisodeCohortReview(cohort(), detail());
  assert.equal(review.authority, "DESCRIPTIVE_ONLY");
  assert.deepEqual(review.distributions[0], {
    metric: "duration_ms",
    count: 2,
    minimum: 2000,
    median: 4000,
    maximum: 6000,
    reference: 4000,
    authority: "DESCRIPTIVE_ONLY",
  });
  assert.deepEqual(review.outcomes, { SUCCEEDED: 1, FAILED: 1, CANCELLED: 0, UNKNOWN: 0 });
  assert.equal(Object.hasOwn(review.distributions[0], "delta"), false);
});

test("client requests only the feature-negotiated bounded cohort endpoint", async () => {
  assert.equal(ROLO_API_FEATURES.episodeCohortReadModel, "workbench.episode-cohort-read-model/v1");
  const originalFetch = globalThis.fetch;
  let requested = "";
  globalThis.fetch = async (input) => {
    requested = String(input);
    return new Response(JSON.stringify(cohort()), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const client = new RoloClient("https://rolo.test");
    const result = await client.episodeCohort("demo_diff", "ep-reference", 2, undefined, { windowDays: 7 });
    assert.equal(result.reference_revision, 2);
    assert.match(requested, /episode-cohorts\?reference_episode_id=ep-reference&reference_revision=2&window_days=7&limit=100$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
