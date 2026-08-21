import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { TOPOLOGY_EDGES, TOPOLOGY_NODES } from "../src/demoData.ts";
import { RoloApiError, RoloClient, RoloContractError } from "../src/roloClient.ts";
import { getOverviewPresentation, getSurfaceSource } from "../src/workbenchPolicy.ts";

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
  schema_version: "rolo-robot-overview/v2",
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

const EVIDENCE_RECORD = {
  schema_version: "rolo-evidence-record/v1",
  evidence_id: "ev_1234567890abcdef12",
  robot_id: "AMR-07",
  title: "Declared robot",
  summary: "Declared by the robot manifest.",
  authority: "DECLARED",
  source_kind: "robot_manifest",
  integrity_status: "validated",
  classification: "INTERNAL",
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
  confidence: 1,
  reference_hint: "robot-manifest:AMR-07:robot",
  reference_digest: "a".repeat(64),
  related_node_ids: ["robot_1"],
  limitations: ["Declaration only"],
};

const TOPOLOGY = {
  schema_version: "rolo-robot-topology/v1",
  robot_id: "AMR-07",
  snapshot_id: "topology_1",
  coverage: "REGISTRY_ONLY",
  nodes: [{
    schema_version: "rolo-topology-node/v1",
    node_id: "robot_1",
    kind: "robot",
    label: "AMR-07",
    subtitle: "differential",
    layer: "Hardware",
    state: "DECLARED",
    confidence: 1,
    integrity_status: "validated",
    evidence_ids: [EVIDENCE_RECORD.evidence_id],
    attributes: {},
  }],
  edges: [],
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
  source_kind: "robot_registry",
  confidence: 0.7,
  integrity_status: "validated",
  limitations: ["Registry only"],
};

const TOPOLOGY_SNAPSHOTS = {
  schema_version: "rolo-topology-snapshot-collection/v1",
  robot_id: "AMR-07",
  items: [{
    schema_version: "rolo-topology-snapshot-summary/v1",
    snapshot_id: "topology_snapshot_1",
    release_id: "release-1",
    published_at: "2026-08-19T00:00:00Z",
    node_count: 1,
    edge_count: 0,
    coverage: "GATED_RELEASE",
    integrity_status: "verified",
    is_current: false,
  }, {
    schema_version: "rolo-topology-snapshot-summary/v1",
    snapshot_id: "topology_snapshot_2",
    release_id: "release-2",
    published_at: "2026-08-20T00:00:00Z",
    node_count: 1,
    edge_count: 0,
    coverage: "GATED_RELEASE",
    integrity_status: "verified",
    is_current: true,
  }],
  total: 2,
  observed_at: "2026-08-20T00:00:01Z",
  freshness: "unknown",
  limitations: ["Verified releases only"],
};

const TOPOLOGY_DIFF = {
  schema_version: "rolo-topology-diff/v1",
  robot_id: "AMR-07",
  from_snapshot: TOPOLOGY_SNAPSHOTS.items[0],
  to_snapshot: TOPOLOGY_SNAPSHOTS.items[1],
  added_nodes: 0,
  removed_nodes: 0,
  changed_nodes: 1,
  added_edges: 0,
  removed_edges: 0,
  changed_edges: 0,
  node_changes: [{
    schema_version: "rolo-topology-node-change/v1",
    node_id: "robot_1",
    change: "CHANGED",
    changed_fields: ["state"],
    before: TOPOLOGY.nodes[0],
    after: { ...TOPOLOGY.nodes[0], state: "GATED", integrity_status: "verified" },
  }],
  edge_changes: [],
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "unknown",
  integrity_status: "verified",
  limitations: ["Gated declarations only"],
};

const TOPOLOGY_PATH = {
  schema_version: "rolo-topology-path-explanation/v1",
  robot_id: "AMR-07",
  snapshot_id: "topology_1",
  from_node_id: "robot_1",
  to_node_id: "adapter_1",
  found: true,
  hop_count: 1,
  nodes: [TOPOLOGY.nodes[0], {
    ...TOPOLOGY.nodes[0],
    node_id: "adapter_1",
    kind: "adapter",
    label: "Adapter",
    layer: "Application",
  }],
  steps: [{
    schema_version: "rolo-topology-path-step/v1",
    index: 0,
    from_node_id: "robot_1",
    to_node_id: "adapter_1",
    edge_id: "edge_path_1",
    relation: "hosts",
    direction: "FORWARD",
    state: "DECLARED",
    confidence: 1,
    integrity_status: "validated",
    evidence_ids: [EVIDENCE_RECORD.evidence_id],
  }],
  summary: "A 1-hop topology connection was found.",
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
  source_kind: "topology_path_projection",
  confidence: 1,
  integrity_status: "validated",
  limitations: ["This path does not prove physical reachability."],
};

const WIKI = {
  schema_version: "rolo-robot-wiki/v1",
  robot_id: "AMR-07",
  discovery_id: "discovery-20260820",
  discovery_status: "SUCCEEDED",
  created_at: "2026-08-20T00:00:00Z",
  content_origin: "HUMAN_EDITED",
  content_integrity: "unverified",
  sections: [{
    schema_version: "rolo-wiki-section/v1",
    heading: "Architecture",
    lines: ["The robot uses a bounded navigation stack."],
  }],
  layers: ["Hardware", "Linux", "Middleware", "Application", "Dependencies"].map((layer) => ({
    schema_version: "rolo-wiki-layer-summary/v1",
    layer,
    status: "OBSERVED",
    summary: `Observed ${layer} facts.`,
    facts: { count: 1 },
  })),
  insights: [{
    schema_version: "rolo-wiki-insight-summary/v1",
    category: "ARCHITECTURE",
    statement: "Navigation depends on middleware discovery.",
    confidence: "MEDIUM",
    verification: "Verify against the active graph.",
    source: "DETERMINISTIC_RULE",
    evidence_id: "ev_abcdef123456789012",
  }],
  diff_status: "CHANGED",
  baseline_discovery_id: "discovery-20260819",
  changes: [{
    schema_version: "rolo-wiki-change-summary/v1",
    category: "ROS",
    added: ["topic /map"],
    removed: [],
    changed: [],
    evidence_id: "ev_1234567890abcdef12",
  }],
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "unknown",
  source_kind: "verified_discovery_snapshot",
  confidence: 1,
  integrity_status: "verified",
  limitations: ["Insights remain advisory."],
};

const DISCOVERY_HISTORY = {
  schema_version: "rolo-discovery-snapshot-collection/v1",
  robot_id: "AMR-07",
  items: [{
    schema_version: "rolo-discovery-snapshot-summary/v1",
    robot_id: "AMR-07",
    discovery_id: "discovery-20260820",
    status: "PARTIAL",
    discovery_mode: "ARTIFACT_DOC",
    created_at: "2026-08-20T00:00:00Z",
    is_latest: true,
    probe_total: 4,
    observed_probes: 2,
    partial_probes: 1,
    unavailable_probes: 1,
    operation_candidates: 14,
    semantic_bindings: 3,
    warning_count: 2,
    confidence: 0.8,
    integrity_status: "verified",
    limitations: ["Discovery coverage does not prove task success."],
  }],
  total: 1,
  limit: 100,
  offset: 0,
  next_offset: null,
  excluded_unverified: 0,
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "unknown",
  source_kind: "verified_discovery_history",
  integrity_status: "verified",
  limitations: ["Only manifest-verified discovery reports are included."],
};

const FLEET = {
  schema_version: "rolo-fleet-collection/v1",
  items: [{
    schema_version: "rolo-fleet-robot-summary/v1",
    robot_id: "AMR-07",
    adapter: "test-adapter",
    architecture: "arm64",
    ros_distro: "humble",
    state: "ATTENTION",
    active_stage: "adapt",
    active_status: "BLOCKED",
    blocker_count: 1,
    next_action: "Run adapt discovery",
    observed_at: "2026-08-20T00:00:00Z",
    freshness: "fresh",
    source_kind: "computed_robot_overview",
    confidence: 1,
    integrity_status: "validated",
  }],
  total: 1,
  limit: 100,
  offset: 0,
  next_offset: null,
  ready: 0,
  attention: 1,
  degraded: 0,
  not_ready: 0,
  blocker_count: 1,
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
  source_kind: "computed_fleet_overviews",
  confidence: 1,
  integrity_status: "validated",
};

const FLEET_BLOCKERS = {
  schema_version: "rolo-fleet-blocker-collection/v1",
  items: [{
    schema_version: "rolo-fleet-blocker-summary/v1",
    blocker_id: "blocker_123",
    robot_id: "AMR-07",
    stage: "adapt",
    message: "Run adapt discovery",
    recommended_action: "Run adapt discovery",
    owner: "adapter_agent",
    evidence_ids: [],
    observed_at: "2026-08-20T00:00:00Z",
    freshness: "fresh",
    source_kind: "pipeline_assessment",
    confidence: 1,
    integrity_status: "validated",
  }],
  total: 1,
  limit: 100,
  offset: 0,
  next_offset: null,
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
  source_kind: "computed_pipeline_blockers",
  confidence: 1,
  integrity_status: "validated",
};

const EVIDENCE_COLLECTION = {
  schema_version: "rolo-evidence-collection/v1",
  robot_id: "AMR-07",
  items: [EVIDENCE_RECORD],
  total: 1,
  limit: 25,
  offset: 0,
  next_offset: null,
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
};

const CAPABILITY_SUMMARY = {
  schema_version: "rolo-capability-summary/v1",
  operation: "tool.catalog",
  layer: "Application",
  description: "Read the active gated Tool Catalog for one robot identity.",
  lifecycle: "RELEASED",
  applicability: "APPLICABLE",
  availability: "AVAILABLE",
  registration: "BUILTIN",
  access: "read",
  risk: "R0",
  data_classification: "INTERNAL",
  contract_version: "1.1.0",
  contract_digest: "b".repeat(64),
  paired_operation: null,
  replacement_operation: null,
  compensation_operation: null,
  binding_count: 0,
  last_verified_at: null,
  evidence_ids: [],
  confidence: 0.9,
  integrity_status: "validated",
  limitations: ["Built-in availability is not outcome evidence."],
};

const CAPABILITY_COLLECTION = {
  schema_version: "rolo-capability-collection/v1",
  robot_id: "AMR-07",
  items: [CAPABILITY_SUMMARY],
  total: 1,
  limit: 100,
  offset: 0,
  next_offset: null,
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
  source_kind: "product_registry",
  limitations: ["Applicability is unknown until discovery."],
};

const CAPABILITY_DETAIL = {
  schema_version: "rolo-capability-detail/v1",
  robot_id: "AMR-07",
  capability: CAPABILITY_SUMMARY,
  contract: {
    schema_version: "rolo-capability-contract/v1",
    input_schema: { type: "object" },
    output_schema: { type: "object" },
    capability_requirements: [],
    preconditions: [],
    postconditions: [],
    semantic_units: {},
    coordinate_frames: [],
    time_semantics: "UTC",
    result_semantics: "OBSERVATION",
    execution_mode: "REQUEST_RESPONSE",
    idempotent: true,
    cancelable: false,
    max_duration_s: 5,
    side_effects: [],
    resource_locks: [],
    requires_quiescence: false,
  },
  bindings: [],
  observed_at: "2026-08-20T00:00:00Z",
  freshness: "fresh",
};

const RUN_SUMMARY = {
  schema_version: "rolo-lifecycle-run-summary/v1",
  robot_id: "AMR-07",
  run_id: "run-1",
  stage: "adapt",
  status: "FAILED",
  gate_status: "FAILED",
  handoff_status: "MISSING",
  provider: "codex",
  model: "test-model",
  started_at: "2026-08-20T00:00:00Z",
  completed_at: "2026-08-20T00:00:02Z",
  duration_s: 2,
  gate_check_count: 1,
  evidence_ids: ["ev_run123456789012345"],
  confidence: 0.8,
  integrity_status: "validated",
  limitations: ["No handoff was published."],
};

const RUN_COLLECTION = {
  schema_version: "rolo-lifecycle-run-collection/v1",
  robot_id: "AMR-07",
  items: [RUN_SUMMARY],
  total: 1,
  limit: 50,
  offset: 0,
  next_offset: null,
  observed_at: "2026-08-20T00:00:03Z",
  freshness: "unknown",
  source_kind: "lifecycle_artifacts",
  limitations: [],
};

const RUN_DETAIL = {
  schema_version: "rolo-lifecycle-run-detail/v1",
  run: RUN_SUMMARY,
  gate_checks: [{
    schema_version: "rolo-lifecycle-gate-check/v1",
    check_id: "check-1",
    label: "Independent gate result",
    status: "FAILED",
    authority: "OBSERVED",
    evidence_id: "ev_run123456789012345",
  }],
  handoff: {
    schema_version: "rolo-lifecycle-handoff-summary/v1",
    status: "MISSING",
    authority: "NONE",
    promoted_at: null,
    artifact_count: 2,
    digest: null,
    evidence_id: null,
    limitations: ["No handoff was published."],
  },
  artifacts: [{
    schema_version: "rolo-lifecycle-artifact-summary/v1",
    name: "Independent gate report",
    kind: "gate",
    integrity_status: "validated",
    evidence_id: "ev_run123456789012345",
    reference_digest: "c".repeat(64),
  }],
  observed_at: "2026-08-20T00:00:03Z",
  freshness: "unknown",
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
          : url.endsWith("/topology/snapshots")
            ? TOPOLOGY_SNAPSHOTS
          : url.endsWith("/topology")
            ? TOPOLOGY
            : url.includes("/runs?limit=")
              ? RUN_COLLECTION
            : url.includes("/capabilities?limit=")
              ? CAPABILITY_COLLECTION
            : url.includes("/evidence?limit=")
              ? EVIDENCE_COLLECTION
              : PIPELINE;
    return { ok: true, json: async () => payload };
  };

  try {
    const result = await new RoloClient("http://rolo.test/").bootstrap();
    assert.equal(result.health.status, "HEALTHY");
    assert.equal(result.robots[0].robot_id, "AMR-07");
    assert.equal(result.mode, "live");
    assert.equal(result.overview.schema_version, "rolo-robot-overview/v2");
    assert.equal(result.pipeline.stages[0].stage, "adapt");
    assert.equal(result.topology.schema_version, "rolo-robot-topology/v1");
    assert.equal(result.topologySnapshots.total, 2);
    assert.equal(result.evidence.items[0].evidence_id, EVIDENCE_RECORD.evidence_id);
    assert.equal(result.capabilities[0].operation, "tool.catalog");
    assert.equal(result.runs.items[0].run_id, "run-1");
    assert.deepEqual(requests, [
      "http://rolo.test/health",
      "http://rolo.test/v1/robots",
      "http://rolo.test/v1/robots/AMR-07/overview",
      "http://rolo.test/v1/robots/AMR-07/topology",
      "http://rolo.test/v1/robots/AMR-07/topology/snapshots",
      "http://rolo.test/v1/robots/AMR-07/evidence?limit=25&offset=0",
      "http://rolo.test/v1/robots/AMR-07/capabilities?limit=100&offset=0",
      "http://rolo.test/v1/robots/AMR-07/runs?limit=50&offset=0",
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
    if (url.endsWith("/topology") || url.endsWith("/topology/snapshots") || url.includes("/evidence?limit=")) return { ok: false, status: 404 };
    if (url.includes("/capabilities?limit=")) return { ok: true, json: async () => CAPABILITY_COLLECTION };
    if (url.includes("/runs?limit=")) return { ok: true, json: async () => RUN_COLLECTION };
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
        : url.endsWith("/overview")
          ? OVERVIEW
          : url.endsWith("/topology/snapshots")
            ? TOPOLOGY_SNAPSHOTS
          : url.endsWith("/topology")
            ? TOPOLOGY
            : url.includes("/runs?limit=")
              ? RUN_COLLECTION
            : url.includes("/capabilities?limit=")
              ? CAPABILITY_COLLECTION
              : EVIDENCE_COLLECTION;
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

test("RoloClient keeps trusted overview data partial when topology fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.endsWith("/health")) return { ok: true, json: async () => HEALTH };
    if (url.endsWith("/v1/robots")) return { ok: true, json: async () => [ROBOT] };
    if (url.endsWith("/overview")) return { ok: true, json: async () => OVERVIEW };
    if (url.endsWith("/topology/snapshots")) return { ok: true, json: async () => TOPOLOGY_SNAPSHOTS };
    if (url.endsWith("/topology")) return { ok: false, status: 503 };
    if (url.includes("/capabilities?limit=")) return { ok: true, json: async () => CAPABILITY_COLLECTION };
    if (url.includes("/runs?limit=")) return { ok: true, json: async () => RUN_COLLECTION };
    return { ok: true, json: async () => EVIDENCE_COLLECTION };
  };
  try {
    const result = await new RoloClient("http://rolo.test").bootstrap();
    assert.equal(result.mode, "partial");
    assert.equal(result.overview.schema_version, "rolo-robot-overview/v2");
    assert.equal(result.topology, null);
    assert.match(result.issues.join(" "), /topology.*HTTP 503/i);
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

test("RoloClient requests bounded evidence pages with an authority filter", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      json: async () => ({
        ...EVIDENCE_COLLECTION,
        items: [{ ...EVIDENCE_RECORD, evidence_id: "ev_gated123456789012", authority: "GATED" }],
        total: 5,
        limit: 2,
        offset: 4,
      }),
    };
  };
  try {
    const page = await new RoloClient("http://rolo.test").evidenceCollection(
      "AMR-07",
      undefined,
      { limit: 2, offset: 4, authority: "GATED" },
    );
    assert.equal(requestedUrl, "http://rolo.test/v1/robots/AMR-07/evidence?limit=2&offset=4&authority=GATED");
    assert.equal(page.offset, 4);
    assert.equal(page.items[0].authority, "GATED");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient reads capability coverage and a contract-bound detail", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return { ok: true, json: async () => url.includes("/capabilities/tool.catalog") ? CAPABILITY_DETAIL : CAPABILITY_COLLECTION };
  };
  try {
    const client = new RoloClient("http://rolo.test");
    const coverage = await client.capabilities("AMR-07");
    const detail = await client.capability("AMR-07", "tool.catalog");
    assert.equal(coverage.items[0].availability, "AVAILABLE");
    assert.equal(detail.contract.result_semantics, "OBSERVATION");
    assert.deepEqual(requests, [
      "http://rolo.test/v1/robots/AMR-07/capabilities?limit=100&offset=0",
      "http://rolo.test/v1/robots/AMR-07/capabilities/tool.catalog",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient reads lifecycle runs without raw artifact payloads", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return { ok: true, json: async () => url.endsWith("/runs/run-1") ? RUN_DETAIL : RUN_COLLECTION };
  };
  try {
    const client = new RoloClient("http://rolo.test");
    const collection = await client.runs("AMR-07");
    const detail = await client.run("AMR-07", "run-1");
    assert.equal(collection.items[0].gate_status, "FAILED");
    assert.equal(detail.handoff.status, "MISSING");
    assert.equal(detail.artifacts[0].kind, "gate");
    assert.deepEqual(requests, [
      "http://rolo.test/v1/robots/AMR-07/runs?limit=50&offset=0",
      "http://rolo.test/v1/robots/AMR-07/runs/run-1",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects evidence pages containing another robot", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      ...EVIDENCE_COLLECTION,
      items: [{ ...EVIDENCE_RECORD, robot_id: "OTHER-ROBOT" }],
    }),
  });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").evidenceCollection("AMR-07"),
      (error) => error instanceof RoloContractError && error.path.endsWith("/items/0"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient strips legacy raw blocker evidence references", async () => {
  const originalFetch = globalThis.fetch;
  const rawPath = "C:\\private\\artifacts\\adapter-output.json";
  const escapedPath = rawPath.replaceAll("\\", "\\\\");
  const legacyOverview = {
    ...OVERVIEW,
    schema_version: "rolo-robot-overview/v1",
    pipeline: {
      ...PIPELINE,
      stages: [{
        ...PIPELINE.stages[0],
        prerequisites: [rawPath],
        artifacts: { output: rawPath },
        blockers: [`Adapter output is missing at ${escapedPath}`],
      }],
    },
    blockers: [{
      schema_version: "rolo-blocker-summary/v1",
      blocker_id: "adapt-blocked",
      stage: "adapt",
      message: `Adapter output is missing at ${escapedPath}`,
      recommended_action: `Generate the adapter output at ${escapedPath}`,
      owner: "adapter_agent",
      observed_at: "2026-08-20T00:00:00Z",
      freshness: "fresh",
      source_kind: "pipeline_assessment",
      confidence: 1,
      integrity_status: "validated",
      evidence_refs: [rawPath],
    }],
  };
  globalThis.fetch = async () => ({ ok: true, json: async () => legacyOverview });
  try {
    const result = await new RoloClient("http://rolo.test").overview("AMR-07");
    assert.deepEqual(result.blockers[0].evidence_ids, []);
    assert.equal(result.blockers[0].message, "Adapter output is missing at artifact:adapter-output.json");
    assert.deepEqual(result.pipeline.stages[0].prerequisites, ["artifact:adapter-output.json"]);
    assert.deepEqual(result.pipeline.stages[0].artifacts, { output: "artifact:adapter-output.json" });
    assert.doesNotMatch(JSON.stringify(result), /private/i);
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

test("RoloClient reads verified topology history and a contract-bound diff", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return {
      ok: true,
      json: async () => url.endsWith("/topology/snapshots") ? TOPOLOGY_SNAPSHOTS : TOPOLOGY_DIFF,
    };
  };
  try {
    const client = new RoloClient("http://rolo.test");
    const snapshots = await client.topologySnapshots("AMR-07");
    const diff = await client.topologyDiff("AMR-07", "topology_snapshot_1", "topology_snapshot_2");
    assert.equal(snapshots.items[1].is_current, true);
    assert.equal(diff.changed_nodes, 1);
    assert.equal(diff.node_changes[0].changed_fields[0], "state");
    assert.deepEqual(requests, [
      "http://rolo.test/v1/robots/AMR-07/topology/snapshots",
      "http://rolo.test/v1/robots/AMR-07/topology/diff?from=topology_snapshot_1&to=topology_snapshot_2",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient reads a contiguous evidence-bound topology path", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return { ok: true, json: async () => TOPOLOGY_PATH };
  };
  try {
    const path = await new RoloClient("http://rolo.test").topologyPath("AMR-07", "robot_1", "adapter_1");
    assert.equal(path.hop_count, 1);
    assert.equal(path.steps[0].evidence_ids[0], EVIDENCE_RECORD.evidence_id);
    assert.deepEqual(urls, ["http://rolo.test/v1/robots/AMR-07/topology/path?from=robot_1&to=adapter_1&max_hops=8"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects a non-contiguous topology path", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ...TOPOLOGY_PATH, steps: [{ ...TOPOLOGY_PATH.steps[0], to_node_id: "robot_1" }] }) });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").topologyPath("AMR-07", "robot_1", "adapter_1"),
      (error) => error instanceof RoloContractError && error.path.includes("/topology/path"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient reads a trust-separated Robot Wiki", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return { ok: true, json: async () => WIKI };
  };
  try {
    const wiki = await new RoloClient("http://rolo.test").wiki("AMR-07");
    assert.equal(wiki.content_origin, "HUMAN_EDITED");
    assert.equal(wiki.content_integrity, "unverified");
    assert.equal(wiki.insights[0].evidence_id, "ev_abcdef123456789012");
    assert.deepEqual(urls, ["http://rolo.test/v1/robots/AMR-07/wiki"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient reads manifest-verified discovery history", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return { ok: true, json: async () => DISCOVERY_HISTORY };
  };
  try {
    const history = await new RoloClient("http://rolo.test").discoveries("AMR-07");
    assert.equal(history.items[0].is_latest, true);
    assert.equal(history.items[0].operation_candidates, 14);
    assert.deepEqual(urls, ["http://rolo.test/v1/robots/AMR-07/discoveries?limit=100&offset=0"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects inconsistent discovery probe coverage", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      ...DISCOVERY_HISTORY,
      items: [{ ...DISCOVERY_HISTORY.items[0], observed_probes: 4 }],
    }),
  });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").discoveries("AMR-07"),
      (error) => error instanceof RoloContractError
        && error.path.includes("/discoveries")
        && error.path.includes("/items/0"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient reads validated Fleet and Blocker Inbox aggregates", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return { ok: true, json: async () => String(url).includes("/blockers") ? FLEET_BLOCKERS : FLEET };
  };
  try {
    const client = new RoloClient("http://rolo.test");
    const [fleet, blockers] = await Promise.all([client.fleet(), client.blockers()]);
    assert.equal(fleet.items[0].state, "ATTENTION");
    assert.equal(blockers.items[0].owner, "adapter_agent");
    assert.deepEqual(urls.sort(), [
      "http://rolo.test/v1/blockers?limit=100&offset=0",
      "http://rolo.test/v1/fleet?limit=100&offset=0",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects raw paths in the Blocker Inbox", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      ...FLEET_BLOCKERS,
      items: [{ ...FLEET_BLOCKERS.items[0], message: String.raw`Inspect C:\private\adapt.json` }],
    }),
  });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").blockers(),
      (error) => error instanceof RoloContractError && error.path.startsWith("/v1/blockers"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects unsafe Robot Wiki references", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ...WIKI, sections: [{ ...WIKI.sections[0], lines: ["artifact://private/report.json"] }] }) });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").wiki("AMR-07"),
      (error) => error instanceof RoloContractError && error.path.endsWith("/wiki"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient rejects a dangling topology edge", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      ...TOPOLOGY,
      edges: [{
        schema_version: "rolo-topology-edge/v1",
        edge_id: "edge_1",
        source: "robot_1",
        target: "missing_node",
        relation: "routes_to",
        state: "GATED",
        confidence: 1,
        integrity_status: "verified",
        evidence_ids: [],
      }],
    }),
  });
  try {
    await assert.rejects(
      () => new RoloClient("http://rolo.test").topology("AMR-07"),
      (error) => error instanceof RoloContractError && error.path.endsWith("/edges/0"),
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
    assert.equal(getSurfaceSource(mode, "wiki"), "unavailable");
    assert.equal(getSurfaceSource(mode, "fleet"), "unavailable");
    assert.equal(getSurfaceSource(mode, "stack", { stack: true }), "live");
    assert.equal(getSurfaceSource(mode, "evidence", { evidence: true }), "live");
    assert.equal(getSurfaceSource(mode, "capabilities", { capabilities: true }), "live");
    assert.equal(getSurfaceSource(mode, "wiki", { wiki: true }), "live");
    assert.equal(getSurfaceSource(mode, "fleet", { fleet: true }), "live");
  }
  assert.equal(getSurfaceSource("demo", "stack"), "demo");
  assert.equal(getSurfaceSource("unavailable", "overview"), "unavailable");
});

test("partial overview compatibility copy comes only from trusted pipeline data", () => {
  const partial = getOverviewPresentation("partial", null, "Live pipeline summary");
  const demo = getOverviewPresentation("demo", null, "Ignored live summary");

  assert.deepEqual(partial, {
    title: "Pipeline compatibility",
    summary: "Live pipeline summary",
  });
  assert.doesNotMatch(JSON.stringify(partial), /demo|dependency mismatch/i);
  assert.match(demo.title, /demo/i);
  assert.match(demo.summary, /demo data/i);
});

test("live lifecycle component has no fixture evidence or fabricated handoff", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const start = source.indexOf("function LiveLifecycleView");
  const end = source.indexOf("function EvidenceRow", start);
  assert.ok(start >= 0 && end > start);
  const liveLifecycle = source.slice(start, end);

  assert.doesNotMatch(liveLifecycle, /\bEVIDENCE\b|\bDEMO_|sha256:82f3|adapt-20260820/);
  assert.match(liveLifecycle, /selected\.blockerMessages|selected\.artifactRefs|selected\.observedAt/);
  assert.match(liveLifecycle, /runDetail\.gate_checks|runDetail\.handoff|runDetail\.artifacts/);
});

test("live Stack Map delegates path explanation to the trusted API", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const start = source.indexOf("function StackMapView");
  const end = source.indexOf("interface OverviewViewProps", start);
  const stackMap = source.slice(start, end);

  assert.match(stackMap, /roloClient\.topologyPath/);
  assert.match(stackMap, /physical reachability|pathExplanation\.limitations/);
  assert.doesNotMatch(stackMap, /breadth.first|shortestPath|new Map\(sourceEdges/);
});

test("plugin manifest declares every trusted read-model endpoint", async () => {
  const manifest = JSON.parse(await readFile(new URL("../rolo.plugin.json", import.meta.url), "utf8"));
  assert.equal(manifest.version, "0.11.0");
  assert.deepEqual(
    new Set(manifest.api.required_endpoints),
    new Set([
      "/health",
      "/v1/fleet",
      "/v1/blockers",
      "/v1/robots",
      "/v1/robots/{robot_id}/overview",
      "/v1/robots/{robot_id}/pipeline",
      "/v1/robots/{robot_id}/topology",
      "/v1/robots/{robot_id}/topology/snapshots",
      "/v1/robots/{robot_id}/topology/diff",
      "/v1/robots/{robot_id}/topology/path",
      "/v1/robots/{robot_id}/capabilities",
      "/v1/robots/{robot_id}/capabilities/{operation}",
      "/v1/robots/{robot_id}/runs",
      "/v1/robots/{robot_id}/runs/{run_id}",
      "/v1/robots/{robot_id}/wiki",
      "/v1/robots/{robot_id}/discoveries",
      "/v1/robots/{robot_id}/evidence",
      "/v1/evidence/{evidence_id}",
    ]),
  );
});
