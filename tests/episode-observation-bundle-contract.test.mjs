import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  appendObservationBundlePage,
  parseEpisodeObservationBundleCollection,
  validateCompleteObservationBundleHistory,
} from "../src/contracts/episodeObservation.ts";
import {
  EPISODE_OBSERVATION_BUNDLE_BASELINE,
  EPISODE_REVIEW_SESSION_RELEASE_BASELINE,
  EPISODE_SCHEMA_COMPATIBILITY,
} from "../src/contracts/compatibility.ts";
import { RoloClient, ROLO_API_FEATURES } from "../src/roloClient.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const validation = {
  robotId: "demo_diff",
  episodeId: "ep-observed",
  revision: 2,
  episodeDurationMs: 3000,
  assetIds: new Set(["asset-camera"]),
  evidenceIds: new Set(["ev-observation"]),
};

function source(overrides = {}) {
  return {
    schema_version: "rolo-episode-observation-source-coverage/v1",
    robot_id: "demo_diff",
    episode_id: "ep-observed",
    episode_revision: 2,
    bundle_id: "bundle-initial",
    source_id: "source-camera",
    label: "Front camera",
    source_kind: "ONBOARD_SENSOR",
    modality: "camera",
    world_kind: "PHYSICAL",
    availability: "AVAILABLE",
    synchronization: "SYNCED",
    spatial_alignment: "ALIGNED",
    asset_ids: ["asset-camera"],
    limitations: [],
    ...overrides,
  };
}

function bundle(overrides = {}) {
  return {
    schema_version: "rolo-episode-observation-bundle-summary/v1",
    robot_id: "demo_diff",
    episode_id: "ep-observed",
    episode_revision: 2,
    bundle_id: "bundle-initial",
    sequence: 1,
    parent_bundle_id: null,
    trigger_kind: "INITIAL",
    status: "COMPLETE",
    created_at: "2026-08-20T11:57:05Z",
    window_start_offset_ms: 0,
    window_end_offset_ms: 3000,
    synchronization: "SYNCED",
    spatial_alignment: "ALIGNED",
    world_scope: "PHYSICAL_ONLY",
    sources: [source()],
    asset_ids: ["asset-camera"],
    evidence_ids: ["ev-observation"],
    limitations: [],
    influences_verification: false,
    ...overrides,
  };
}

function supplementary(overrides = {}) {
  return bundle({
    bundle_id: "bundle-supplementary",
    sequence: 2,
    parent_bundle_id: "bundle-initial",
    trigger_kind: "SUPPLEMENTARY",
    status: "PARTIAL",
    window_start_offset_ms: 1500,
    synchronization: "UNKNOWN",
    spatial_alignment: "UNKNOWN",
    world_scope: "NONE",
    sources: [source({
      bundle_id: "bundle-supplementary",
      source_id: "source-gui",
      label: "Registered engineering view",
      source_kind: "TRUSTED_GUI_CAPTURE",
      modality: "engineering-view",
      availability: "REJECTED",
      synchronization: "UNKNOWN",
      spatial_alignment: "UNKNOWN",
      asset_ids: [],
      limitations: ["The registered view was rejected by bounded policy."],
    })],
    asset_ids: [],
    evidence_ids: [],
    limitations: ["The supplementary input remains unavailable."],
    ...overrides,
  });
}

function collection(overrides = {}) {
  return {
    schema_version: "rolo-episode-observation-bundle-collection/v1",
    robot_id: "demo_diff",
    episode_id: "ep-observed",
    episode_revision: 2,
    items: [supplementary(), bundle()],
    limit: 20,
    cursor: null,
    next_cursor: null,
    as_of: "2026-08-20T11:57:06Z",
    immutable: true,
    limitations: ["Coverage is bounded to safe published metadata."],
    ...overrides,
  };
}

test("Episode Observation Bundle baseline freezes the feature-negotiated v0.37 consumer", async () => {
  const [contract, manifest, packageJson] = await Promise.all([
    read("../docs/EPISODE_OBSERVATION_BUNDLE_CONSUMER_CONTRACT.md"),
    read("../rolo.plugin.json"),
    read("../package.json"),
  ]);
  assert.equal(EPISODE_OBSERVATION_BUNDLE_BASELINE.status, "baseline");
  assert.equal(EPISODE_OBSERVATION_BUNDLE_BASELINE.extends, EPISODE_REVIEW_SESSION_RELEASE_BASELINE.id);
  assert.equal(EPISODE_OBSERVATION_BUNDLE_BASELINE.release, "0.37.0");
  assert.equal(EPISODE_OBSERVATION_BUNDLE_BASELINE.frontendMinimum, "a76801b");
  assert.equal(EPISODE_OBSERVATION_BUNDLE_BASELINE.frontendMainMerge, "5453aa5");
  assert.equal(EPISODE_OBSERVATION_BUNDLE_BASELINE.producerMinimum, "a75ea0b");
  assert.equal(EPISODE_OBSERVATION_BUNDLE_BASELINE.producerMainMerge, "a75ea0b");
  assert.equal(EPISODE_OBSERVATION_BUNDLE_BASELINE.clientEndpointImplemented, true);
  assert.equal(ROLO_API_FEATURES.episodeObservationBundle, "workbench.episode-observation-bundle/v1");
  assert.deepEqual(EPISODE_SCHEMA_COMPATIBILITY.observationBundleCollection, ["rolo-episode-observation-bundle-collection/v1"]);
  assert.match(contract, /EXACT_IMMUTABLE_EPISODE_REVISION|exact immutable revision/i);
  assert.equal(JSON.parse(manifest).version, "0.37.0");
  assert.equal(JSON.parse(packageJson).version, "0.37.0");
  assert.ok(JSON.parse(manifest).api.required_endpoints.includes("/v1/robots/{robot_id}/episodes/{episode_id}/observation-bundles"));
});

test("strict Observation Bundle parser keeps trust dimensions independent", () => {
  const parsed = parseEpisodeObservationBundleCollection(collection(), "/observation-bundles", validation, { limit: 20 });
  assert.deepEqual(parsed.items.map((item) => item.sequence), [2, 1]);
  assert.equal(parsed.items[0].world_scope, "NONE");
  assert.equal(parsed.items[0].sources[0].availability, "REJECTED");
  assert.equal(parsed.items[1].world_scope, "PHYSICAL_ONLY");
  validateCompleteObservationBundleHistory(parsed.items);

  const wrongScope = collection();
  wrongScope.items[0].world_scope = "PHYSICAL_ONLY";
  assert.throws(() => parseEpisodeObservationBundleCollection(wrongScope, "/observation-bundles", validation, { limit: 20 }), /world scope is inconsistent/);

  const unknownAvailability = collection();
  unknownAvailability.items[0].sources[0].availability = "OFFLINE";
  assert.throws(() => parseEpisodeObservationBundleCollection(unknownAvailability, "/observation-bundles", validation, { limit: 20 }), /availability/);
});

test("Observation Bundle parser rejects unsafe fields stale references and verification influence", () => {
  const unsafe = collection();
  unsafe.items[0].sources[0].provider_identity = "internal-collector";
  assert.throws(() => parseEpisodeObservationBundleCollection(unsafe, "/observation-bundles", validation, { limit: 20 }), /unsafe Observation Bundle field|unexpected Observation Bundle field/);

  const staleAsset = collection();
  staleAsset.items[1].sources[0].asset_ids = ["asset-unknown"];
  staleAsset.items[1].asset_ids = ["asset-unknown"];
  assert.throws(() => parseEpisodeObservationBundleCollection(staleAsset, "/observation-bundles", validation, { limit: 20 }), /unknown Episode asset/);

  const staleEvidence = collection();
  staleEvidence.items[1].evidence_ids = ["ev-unknown"];
  assert.throws(() => parseEpisodeObservationBundleCollection(staleEvidence, "/observation-bundles", validation, { limit: 20 }), /unknown Evidence/);

  const authorityEscalation = collection();
  authorityEscalation.items[1].influences_verification = true;
  assert.throws(() => parseEpisodeObservationBundleCollection(authorityEscalation, "/observation-bundles", validation, { limit: 20 }), /must not influence verification/);
});

test("complete Observation Bundle traversal rejects overlaps and dangling parent lineage", () => {
  const first = [supplementary()];
  const complete = appendObservationBundlePage(first, [bundle()]);
  validateCompleteObservationBundleHistory(complete);
  assert.throws(() => appendObservationBundlePage(first, [supplementary()]), /repeat/);
  assert.throws(() => validateCompleteObservationBundleHistory(first), /dangling parent/);
});

test("client reads only the exact bounded Observation Bundle endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let requested = "";
  globalThis.fetch = async (input) => {
    requested = String(input);
    return new Response(JSON.stringify(collection()), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const client = new RoloClient("https://rolo.test");
    const result = await client.episodeObservationBundlePage(
      "demo_diff",
      "ep-observed",
      2,
      { episodeDurationMs: 3000, assetIds: validation.assetIds, evidenceIds: validation.evidenceIds },
    );
    assert.equal(result.episode_revision, 2);
    assert.match(requested, /episodes\/ep-observed\/observation-bundles\?revision=2&limit=20$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("E22C exposes non-color source semantics without storage media or write authority", async () => {
  const [contract, app, studio, tray, client] = await Promise.all([
    read("../docs/EPISODE_OBSERVATION_BUNDLE_CONSUMER_CONTRACT.md"),
    read("../src/App.tsx"),
    read("../src/EpisodeStudio.tsx"),
    read("../src/EpisodeObservationTray.tsx"),
    read("../src/roloClient.ts"),
  ]);
  assert.match(app, /ROLO_API_FEATURES\.episodeObservationBundle/);
  assert.match(studio, /observationBundleSupported.*EpisodeObservationTray/s);
  assert.match(studio, /rejectObservationEpisodeIdentity.*setDetail\(null\)/s);
  assert.match(tray, /RoloApiError.*status === 404/s);
  assert.match(tray, /Missing declaration/);
  assert.match(tray, /Stale publication/);
  assert.match(tray, /Rejected by policy/);
  assert.match(tray, /Source unavailable/);
  assert.match(tray, /Physical only/);
  assert.match(tray, /Simulated only/);
  assert.match(tray, /Replayed only/);
  assert.match(tray, /Mixed input/);
  assert.match(tray, /not outcome, cause, confirmation, readiness, or verification/i);
  assert.doesNotMatch(`${client}\n${studio}\n${tray}`, /localStorage|sessionStorage|BroadcastChannel|signed_url|content_url|media player/i);
  assert.equal(EPISODE_OBSERVATION_BUNDLE_BASELINE.mediaDelivery, false);
  assert.equal(EPISODE_OBSERVATION_BUNDLE_BASELINE.supportsCapture, false);
  assert.equal(EPISODE_OBSERVATION_BUNDLE_BASELINE.supportsRecollection, false);
  assert.equal(EPISODE_OBSERVATION_BUNDLE_BASELINE.supportsReplay, false);
  assert.equal(EPISODE_OBSERVATION_BUNDLE_BASELINE.supportsExport, false);
  assert.equal(EPISODE_OBSERVATION_BUNDLE_BASELINE.supportsWrite, false);
  assert.match(contract, /no filesystem dependency, raw TCP connection, hosted\s+secret, durable state, upload/s);
});

test("E22D baseline preserves source rolo-data and records approved v0.37.0 promotion", async () => {
  const [baseline, prepare, gate, packageJson, manifest] = await Promise.all([
    read("../docs/EPISODE_OBSERVATION_BUNDLE_BASELINE.md"),
    read("../scripts/prepare-episode-observation-live-data.mjs"),
    read("../scripts/check-episode-observation-bundles.mjs"),
    read("../package.json"),
    read("../rolo.plugin.json"),
  ]);
  assert.match(baseline, /Status: established baseline/);
  assert.match(baseline, /Version: `0\.37\.0`/);
  assert.match(baseline, /Frontend minimum: `a76801b`/);
  assert.match(baseline, /Producer minimum: rolo `a75ea0b`/);
  assert.match(prepare, /source_preserved: true/);
  assert.match(prepare, /refusing to overwrite/);
  assert.match(prepare, /must be outside the source rolo-data root/);
  assert.match(gate, /invalidCursorStatus, 422/);
  assert.match(gate, /missingRevisionStatus, 409/);
  assert.match(gate, /unsafe_internal_fields_exposed: false/);
  assert.match(gate, /influences_verification: false/);
  assert.equal(JSON.parse(packageJson).version, "0.37.0");
  assert.equal(JSON.parse(manifest).version, "0.37.0");
});
