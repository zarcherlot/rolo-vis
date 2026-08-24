import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  EPISODE_BASELINE,
  EPISODE_COHORT_BASELINE,
  EPISODE_READONLY_BASELINE,
  EPISODE_REVISION_BASELINE,
  EPISODE_SCHEMA_COMPATIBILITY,
  MVP_SCHEMA_COMPATIBILITY,
  supportsEpisodeSchema,
} from "../src/contracts/compatibility.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Episode diagnostic baseline succeeds v0.20 without mutating the v0.19 MVP matrix", () => {
  assert.equal("episode" in MVP_SCHEMA_COMPATIBILITY, false);
  assert.equal(EPISODE_READONLY_BASELINE.release, "0.20.0");
  assert.equal(EPISODE_READONLY_BASELINE.frontendMinimum, "cb09340");
  assert.equal(EPISODE_READONLY_BASELINE.producerMinimum, "e2217bb");
  assert.equal(EPISODE_BASELINE.status, "baseline");
  assert.equal(EPISODE_BASELINE.mode, "read-only");
  assert.equal(EPISODE_BASELINE.extends, EPISODE_READONLY_BASELINE.id);
  assert.equal(EPISODE_BASELINE.release, "0.21.0");
  assert.equal(EPISODE_BASELINE.frontendMinimum, "118173f");
  assert.equal(EPISODE_BASELINE.producerMinimum, "570bad0");
  assert.equal(EPISODE_BASELINE.producerMainMerge, "4cac539");
  assert.equal(EPISODE_BASELINE.requiredFeature, "workbench.episode-read-model/v1");
  assert.deepEqual(EPISODE_SCHEMA_COMPATIBILITY.timelineEvent, ["rolo-episode-timeline-event/v1"]);
  assert.deepEqual(EPISODE_SCHEMA_COMPATIBILITY.revisionCollection, ["rolo-episode-revision-collection/v1"]);
  assert.equal(EPISODE_REVISION_BASELINE.status, "baseline");
  assert.equal(EPISODE_REVISION_BASELINE.extends, EPISODE_BASELINE.id);
  assert.equal(EPISODE_REVISION_BASELINE.release, "0.22.0");
  assert.equal(EPISODE_REVISION_BASELINE.frontendMinimum, "b836dcd");
  assert.equal(EPISODE_REVISION_BASELINE.producerMinimum, "48da032");
  assert.equal(EPISODE_REVISION_BASELINE.producerMainMerge, "4efd11df");
  assert.equal(EPISODE_REVISION_BASELINE.requiredRevisionFeature, "workbench.episode-revision-history/v1");
  assert.equal(EPISODE_COHORT_BASELINE.status, "baseline");
  assert.equal(EPISODE_COHORT_BASELINE.mode, "read-only");
  assert.equal(EPISODE_COHORT_BASELINE.extends, EPISODE_REVISION_BASELINE.id);
  assert.equal(EPISODE_COHORT_BASELINE.release, "0.23.0");
  assert.equal(EPISODE_COHORT_BASELINE.frontendMinimum, "2c2967f");
  assert.equal(EPISODE_COHORT_BASELINE.frontendMainMerge, "3f18124");
  assert.equal(EPISODE_COHORT_BASELINE.producerMinimum, "463d501");
  assert.equal(EPISODE_COHORT_BASELINE.producerMainMerge, "891cbf1");
  assert.equal(EPISODE_COHORT_BASELINE.requiredCohortFeature, "workbench.episode-cohort-read-model/v1");
});

test("Episode compatibility accepts only the reviewed v1 family", () => {
  for (const [model, versions] of Object.entries(EPISODE_SCHEMA_COMPATIBILITY)) {
    assert.equal(versions.length, 1, `${model} must stay pinned to one reviewed version`);
    assert.equal(supportsEpisodeSchema(model, versions[0]), true);
    assert.equal(supportsEpisodeSchema(model, versions[0].replace("/v1", "/v2")), false);
  }
});

test("Episode Cohort baseline keeps verdict, media, and write surfaces outside the plugin", async () => {
  const [baseline, manifest, studio] = await Promise.all([
    read("../docs/EPISODE_COHORT_REVIEW_BASELINE.md"),
    read("../rolo.plugin.json"),
    read("../src/EpisodeStudio.tsx"),
  ]);
  assert.match(baseline, /Version: `0\.23\.0`/);
  assert.match(baseline, /exact-match current publications/);
  assert.match(baseline, /DESCRIPTIVE_ONLY/);
  assert.doesNotMatch(manifest, /episode\.(media|replay|export|write)/);
  assert.doesNotMatch(studio, /roloClient\.(invoke|cancel|replay|export|collect|recollect)/);
});
