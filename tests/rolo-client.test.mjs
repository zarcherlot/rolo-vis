import assert from "node:assert/strict";
import test from "node:test";

import { TOPOLOGY_EDGES, TOPOLOGY_NODES } from "../src/demoData.js";
import { RoloApiError, RoloClient } from "../src/roloClient.js";

test("RoloClient bootstraps the read-only control-plane surface", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    const payload = url.endsWith("/health")
      ? { status: "HEALTHY" }
      : url.endsWith("/v1/robots")
        ? [{ robot_id: "AMR-07" }]
        : { robot_id: "AMR-07", stages: [{ stage: "adapt", status: "READY" }] };
    return { ok: true, json: async () => payload };
  };

  try {
    const result = await new RoloClient("http://rolo.test/").bootstrap();
    assert.equal(result.health.status, "HEALTHY");
    assert.equal(result.robots[0].robot_id, "AMR-07");
    assert.equal(result.pipeline.stages[0].stage, "adapt");
    assert.deepEqual(requests, [
      "http://rolo.test/health",
      "http://rolo.test/v1/robots",
      "http://rolo.test/v1/robots/AMR-07/pipeline",
    ]);
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
