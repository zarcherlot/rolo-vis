import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  EPISODE_OBSERVATION_BUNDLE_CONSUMER_CANDIDATE,
  EPISODE_REVIEW_SESSION_RELEASE_BASELINE,
} from "../src/contracts/compatibility.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("E22A is a design-only exact-revision successor to the v0.36 baseline", async () => {
  const [contract, manifest, packageJson] = await Promise.all([
    read("../docs/EPISODE_OBSERVATION_BUNDLE_CONSUMER_CONTRACT.md"),
    read("../rolo.plugin.json"),
    read("../package.json"),
  ]);
  assert.equal(EPISODE_OBSERVATION_BUNDLE_CONSUMER_CANDIDATE.status, "candidate");
  assert.equal(EPISODE_OBSERVATION_BUNDLE_CONSUMER_CANDIDATE.extends, EPISODE_REVIEW_SESSION_RELEASE_BASELINE.id);
  assert.equal(EPISODE_OBSERVATION_BUNDLE_CONSUMER_CANDIDATE.targetRelease, "0.37.0");
  assert.equal(EPISODE_OBSERVATION_BUNDLE_CONSUMER_CANDIDATE.contractPhase, "DESIGN_ONLY");
  assert.equal(EPISODE_OBSERVATION_BUNDLE_CONSUMER_CANDIDATE.clientEndpointImplemented, false);
  assert.match(contract, /EXACT_IMMUTABLE_EPISODE_REVISION|exact immutable revision/i);
  assert.equal(JSON.parse(manifest).version, "0.36.0");
  assert.equal(JSON.parse(packageJson).version, "0.36.0");
  assert.doesNotMatch(manifest, /episode-observation-bundle/);
});

test("E22A keeps source availability time spatial and world semantics independent", async () => {
  const contract = await read("../docs/EPISODE_OBSERVATION_BUNDLE_CONSUMER_CONTRACT.md");
  assert.match(contract, /PHYSICAL.*SIMULATED.*REPLAYED/s);
  assert.match(contract, /NONE.*no asset-bearing source/s);
  assert.match(contract, /SYNCED.*DEGRADED.*UNSYNCED.*UNKNOWN/s);
  assert.match(contract, /ALIGNED.*DEGRADED.*UNALIGNED.*UNKNOWN/s);
  assert.match(contract, /MISSING.*STALE.*REJECTED.*UNAVAILABLE/s);
  assert.match(contract, /COMPLETE.*never upgrades/s);
  assert.match(contract, /color alone is insufficient/i);
  assert.match(contract, /newest-first with strictly descending sequences/i);
});

test("E22A reuses existing asset and Evidence authority without content delivery", async () => {
  const contract = await read("../docs/EPISODE_OBSERVATION_BUNDLE_CONSUMER_CONTRACT.md");
  assert.match(contract, /rolo-episode-asset-summary\/v1/);
  assert.match(contract, /sanitized Evidence/);
  assert.match(contract, /must\s+not construct a content URL/i);
  assert.equal(EPISODE_OBSERVATION_BUNDLE_CONSUMER_CANDIDATE.mediaDelivery, false);
  assert.equal(EPISODE_OBSERVATION_BUNDLE_CONSUMER_CANDIDATE.supportsCapture, false);
  assert.equal(EPISODE_OBSERVATION_BUNDLE_CONSUMER_CANDIDATE.supportsRecollection, false);
  assert.equal(EPISODE_OBSERVATION_BUNDLE_CONSUMER_CANDIDATE.supportsReplay, false);
  assert.equal(EPISODE_OBSERVATION_BUNDLE_CONSUMER_CANDIDATE.supportsExport, false);
  assert.equal(EPISODE_OBSERVATION_BUNDLE_CONSUMER_CANDIDATE.supportsWrite, false);
});

test("E22A adds no runtime endpoint persistence or feature advertisement", async () => {
  const [client, studio, contract] = await Promise.all([
    read("../src/roloClient.ts"),
    read("../src/EpisodeStudio.tsx"),
    read("../docs/EPISODE_OBSERVATION_BUNDLE_CONSUMER_CONTRACT.md"),
  ]);
  assert.doesNotMatch(client, /observation-bundles|observationBundles/);
  assert.doesNotMatch(studio, /Perspective Tray|Observation Bundle/);
  assert.doesNotMatch(`${client}\n${studio}`, /localStorage|sessionStorage|BroadcastChannel/);
  assert.match(contract, /E22A is design-only/);
  assert.match(contract, /no filesystem dependency, raw TCP connection, hosted\s+secret, durable state, upload/s);
});
