import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseArtifactAnalysisSummary } from "../src/contracts/artifactAnalysis.ts";
import { parseTargetReadinessSummary } from "../src/contracts/targetReadiness.ts";
import { RoloApiError, RoloClient } from "../src/roloClient.ts";

test("real read-model freshness states remain explicit", () => {
  const baseTarget = {
    schema_version: "rolo-target-readiness-summary/v1", target_id: "target-1", target_kind: "local", state: "READY",
    reachable: true, host_key_pinned: true, platform: "linux", architecture: "x86_64", workspace_accessible: true,
    companion: "NOT_REQUIRED", blockers: [], diagnostics: [], limitations: [], observed_at: "2026-08-31T03:00:00Z",
    producer_revision: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", contains_secret_payloads: false,
  };
  assert.equal(parseTargetReadinessSummary({ ...baseTarget, freshness: "fresh" }, "/target").freshness, "fresh");
  assert.equal(parseTargetReadinessSummary({ ...baseTarget, freshness: "stale" }, "/target").freshness, "stale");
  assert.equal(parseTargetReadinessSummary({ ...baseTarget, freshness: "unknown" }, "/target").freshness, "unknown");
});

test("artifact analysis stale and unknown states do not become release readiness", async () => {
  const source = await readFile(new URL("../tests/artifact-analysis-contract.test.mjs", import.meta.url), "utf8");
  assert.match(source, /freshness: "stale"/);
  assert.match(source, /gate_status: "BLOCKED"/);
  const minimal = {
    schema_version: "rolo-artifact-analysis-summary/v1", analysis_id: "analysis-1", target_id: "target-1", robot_id: "target-1",
    run_id: "run-1", discovery_id: "discovery-1", source_kind: "rolo_api", source_label: "Bounded summary", observed_at: "2026-08-31T03:00:00Z",
    freshness: "unknown", contains_secret_payloads: false, kind: "Artifact analysis", run_status: "NOT_AVAILABLE", title: "Unavailable",
    description: "No release effect.", gate_status: "NOT_AVAILABLE", gate_label: "Not available", gate_tone: "amber", release_status: "SHADOW_ONLY",
    release_label: "No release effect", release_tone: "amber", run_duration: "unknown", event_count: 0, eligible_operation_count: 0,
    route_review_flags: "0 / 0", context_bars: [], evidence_note: "Read-only summary.", operations: [], graph_nodes: [], stages: [], findings: [], hashes: [], limitations: [],
  };
  assert.equal(parseArtifactAnalysisSummary(minimal).freshness, "unknown");
  assert.equal(parseArtifactAnalysisSummary(minimal).release_status, "SHADOW_ONLY");
});

test("404 and 409 API failures stay visible instead of falling back to fixtures", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const status of [404, 409]) {
      globalThis.fetch = async () => ({ ok: false, status, headers: new Headers() });
      await assert.rejects(
        () => new RoloClient("https://staging.example.test").targetReadinessDetail("target-1"),
        (error) => error instanceof RoloApiError && error.status === status && error.path.includes("target-1"),
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("live UI keeps demo opt-in and all control-plane surfaces read-only", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /The workbench will not substitute fixture data automatically/);
  assert.match(app, /Demo data is opt-in; no fixture has been substituted automatically/);
  assert.match(app, /No approval or recovery actions/);
  assert.match(app, /Retry connection/);
  assert.match(app, /active === "overview" && \(connectionUnavailable \?/);
  assert.doesNotMatch(app, /bootstrap-execute|resumeJob|retryJob|cancelJob|rollbackJob/);
});
