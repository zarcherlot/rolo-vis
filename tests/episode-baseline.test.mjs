import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  EPISODE_BASELINE_CANDIDATE,
  EPISODE_SCHEMA_COMPATIBILITY,
  MVP_SCHEMA_COMPATIBILITY,
  supportsEpisodeSchema,
} from "../src/contracts/compatibility.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Episode v1 is pinned as a successor candidate without mutating the v0.19 MVP matrix", () => {
  assert.equal("episode" in MVP_SCHEMA_COMPATIBILITY, false);
  assert.equal(EPISODE_BASELINE_CANDIDATE.status, "candidate");
  assert.equal(EPISODE_BASELINE_CANDIDATE.mode, "read-only");
  assert.equal(EPISODE_BASELINE_CANDIDATE.frontendMinimum, "d712f32");
  assert.equal(EPISODE_BASELINE_CANDIDATE.producerMinimum, "e2217bb");
  assert.equal(EPISODE_BASELINE_CANDIDATE.requiredFeature, "workbench.episode-read-model/v1");
  assert.deepEqual(EPISODE_SCHEMA_COMPATIBILITY.timelineEvent, ["rolo-episode-timeline-event/v1"]);
});

test("Episode compatibility accepts only the reviewed v1 family", () => {
  for (const [model, versions] of Object.entries(EPISODE_SCHEMA_COMPATIBILITY)) {
    assert.equal(versions.length, 1, `${model} must stay pinned to one reviewed version`);
    assert.equal(supportsEpisodeSchema(model, versions[0]), true);
    assert.equal(supportsEpisodeSchema(model, versions[0].replace("/v1", "/v2")), false);
  }
});

test("Episode baseline candidate keeps media and write surfaces outside the plugin", async () => {
  const [candidate, manifest, studio] = await Promise.all([
    read("../docs/EPISODE_READONLY_BASELINE_CANDIDATE.md"),
    read("../rolo.plugin.json"),
    read("../src/EpisodeStudio.tsx"),
  ]);
  assert.match(candidate, /does not itself create `v0\.20\.0`/);
  assert.match(candidate, /Episode pair comparison should be the next read-only contract design/);
  assert.doesNotMatch(manifest, /episode\.(media|replay|export|write)/);
  assert.doesNotMatch(studio, /roloClient\.(invoke|cancel|replay|export|collect|recollect)/);
});
