import assert from "node:assert/strict";
import test from "node:test";

import { TOPOLOGY_EDGES, TOPOLOGY_NODES } from "../src/demoData.ts";
import { RoloApiError, RoloClient, RoloContractError } from "../src/roloClient.ts";
import { getSurfaceSource } from "../src/workbenchPolicy.ts";

const HEALTH = {
  status: "HEALTHY",
  service: "rolo-control-plane",
  version: "0.1.0",
  robots: 1,
  robot_use_backend: "offline",
  openai_key_configured: false,
  timestamp: "2026-08-20T00:00:00Z",
};

const ROBOT = {
  schema_version: "robot-capability/v1",
  robot_id: "AMR-07",
  adapter: "test-adapter",
  platform: {},
  geometry: {},
  sensors: {},
  features: {},
};

const PIPELINE = {
  schema_version: "robot-three-stage-pipeline/v1",
  robot_id: "AMR-07",
  observed_at: "2026-08-20T00:00:00Z",
  stages: [{
    schema_version: "robot-stage-assessment/v1",
    stage: "adapt",
    robot_id: "AMR-07",
    status: "READY",
    summary: "Ready",
    optional: false,
    prerequisites: [],
    artifacts: {},
    blockers: [],
    agent_requirement: "adapter_agent",
    observed_at: "2026-08-20T00:00:00Z",
  }],
};

const OVERVIEW = {
  schema_version: "rolo-robot-overview/v1",
  robot_id: "AMR-07",
  state: "READY",
  summary: "Ready",
  next_action: "Continue",
  blockers: [],
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
  source_kind: "computed_read_model",
  confidence: 1,
  integrity_status: "validated",
  pipeline: PIPELINE,
};

test("RoloClient bootstraps the read-only control-plane surface", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    const payload = url.endsWith("/health")
      ? HEALTH
      : url.endsWith("/v1/robots")
        ? [ROBOT]
        : url.endsWith("/overview")
          ? OVERVIEW
          : PIPELINE;
    return { ok: true, json: async () => payload };
  };

  try {
    const result = await new RoloClient("http://rolo.test/").bootstrap();
    assert.equal(result.health.status, "HEALTHY");
    assert.equal(result.robots[0].robot_id, "AMR-07");
    assert.equal(result.mode, "live");
    assert.equal(result.overview.schema_version, "rolo-robot-overview/v1");
    assert.equal(result.pipeline.stages[0].stage, "adapt");
    assert.deepEqual(requests, [
      "http://rolo.test/health",
      "http://rolo.test/v1/robots",
      "http://rolo.test/v1/robots/AMR-07/overview",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient reports a partial connection when overview is not available", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.endsWith("/health")) return { ok: true, json: async () => HEALTH };
    if (url.endsWith("/v1/robots")) return { ok: true, json: async () => [ROBOT] };
    if (url.endsWith("/overview")) return { ok: false, status: 404 };
    return {
      ok: true,
      json: async () => ({ ...PIPELINE, stages: [{ ...PIPELINE.stages[0], status: "BLOCKED", blockers: ["Blocked"] }] }),
    };
  };
  try {
    const result = await new RoloClient("http://rolo.test").bootstrap();
    assert.equal(result.mode, "partial");
    assert.equal(result.overview, null);
    assert.equal(result.pipeline.stages[0].status, "BLOCKED");
    assert.match(result.issues[0], /overview read model/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient downgrades a degraded control plane to partial", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const payload = url.endsWith("/health")
      ? { ...HEALTH, status: "DEGRADED" }
      : url.endsWith("/v1/robots")
        ? [ROBOT]
        : OVERVIEW;
    return { ok: true, json: async () => payload };
  };
  try {
    const result = await new RoloClient("http://rolo.test").bootstrap();
    assert.equal(result.mode, "partial");
    assert.match(result.issues[0], /degraded health/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects an unhealthy control plane", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ...HEALTH, status: "UNHEALTHY" }) });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").bootstrap(),
      (error) => error instanceof RoloApiError && error.code === "HEALTH" && error.path === "/health",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient preserves HTTP failure status", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").health(),
      (error) => error instanceof RoloApiError && error.status === 503,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects an incompatible overview contract", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ schema_version: "unknown/v9" }) });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").overview("AMR-07"),
      (error) => error instanceof RoloContractError && error.path.endsWith("/overview"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects a malformed nested pipeline contract", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ...OVERVIEW, pipeline: { ...PIPELINE, schema_version: "pipeline/v9" } }),
  });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").overview("AMR-07"),
      (error) => error instanceof RoloContractError && error.path.endsWith("/pipeline"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects a registry payload without versioned capability data", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => [{ robot_id: "AMR-07" }] });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").robots(),
      (error) => error instanceof RoloContractError && error.path.endsWith("/0"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("demo topology is internally connected and spans every product layer", () => {
  const nodeIds = new Set(TOPOLOGY_NODES.map((node) => node.id));
  assert.equal(nodeIds.size, TOPOLOGY_NODES.length);
  assert.deepEqual(
    new Set(TOPOLOGY_NODES.map((node) => node.data.layer)),
    new Set(["Hardware", "Linux", "ROS / Middleware", "Application"]),
  );
  for (const edge of TOPOLOGY_EDGES) {
    assert.ok(nodeIds.has(edge.source), `missing source node ${edge.source}`);
    assert.ok(nodeIds.has(edge.target), `missing target node ${edge.target}`);
  }
});

test("live modes never expose fixture-only workbench surfaces", () => {
  for (const mode of ["live", "partial"]) {
    assert.equal(getSurfaceSource(mode, "overview"), "live");
    assert.equal(getSurfaceSource(mode, "lifecycle"), "live");
    assert.equal(getSurfaceSource(mode, "stack"), "unavailable");
    assert.equal(getSurfaceSource(mode, "capabilities"), "unavailable");
    assert.equal(getSurfaceSource(mode, "evidence"), "unavailable");
  }
  assert.equal(getSurfaceSource("demo", "stack"), "demo");
  assert.equal(getSurfaceSource("unavailable", "overview"), "unavailable");
});
