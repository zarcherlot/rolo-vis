import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Episode consumer design pins the proposed public contract family", async () => {
  const design = await read("../docs/EPISODE_STUDIO_CONSUMER_CONTRACT.md");
  for (const schema of [
    "rolo-episode-collection/v1",
    "rolo-episode-summary/v1",
    "rolo-episode-detail/v1",
    "rolo-episode-timeline-page/v1",
    "rolo-episode-timeline-event/v1",
    "rolo-episode-asset-summary/v1",
    "rolo-episode-finding-summary/v1",
  ]) assert.match(design, new RegExp(schema.replace("/", "\\/")));
  assert.match(design, /workbench\.episode-read-model\/v1/);
});

test("Episode design keeps outcome, verification, and authority independent", async () => {
  const design = await read("../docs/EPISODE_STUDIO_CONSUMER_CONTRACT.md");
  assert.match(design, /State does not choose[\s\S]+outcome color/);
  assert.match(design, /outcome does not choose[\s\S]+verification badge/);
  for (const authority of ["DECLARED", "OBSERVED", "INFERRED", "HUMAN_CONFIRMED", "VERIFIED"]) {
    assert.ok(design.includes(`\`${authority}\``));
  }
});

test("Episode Studio is exposed only through the negotiated feature and successor compatibility boundary", async () => {
  const app = await read("../src/App.tsx");
  const client = await read("../src/roloClient.ts");
  const compatibility = await read("../src/contracts/compatibility.ts");
  assert.match(app, /feature: ROLO_API_FEATURES\.episodeReadModel/);
  assert.match(app, /<EpisodeStudio/);
  assert.match(client, /episodeReadModel: "workbench\.episode-read-model\/v1"/);
  assert.match(client, /episodeCollection|episodeTimelinePage|\/episodes/);
  assert.match(compatibility, /EPISODE_SCHEMA_COMPATIBILITY/);
  assert.match(compatibility, /status: "candidate"/);
});

test("Episode v1 explicitly defers media and write-side surfaces", async () => {
  const design = await read("../docs/EPISODE_STUDIO_CONSUMER_CONTRACT.md");
  assert.match(design, /does not render image\/video bytes/);
  assert.match(design, /No export, replay, recollection, invoke, cancel, or remediation/);
  assert.match(design, /never substitutes demo data automatically/);
});

test("Episode Studio keeps authority language explicit and read-only", async () => {
  const studio = await read("../src/EpisodeStudio.tsx");
  const app = await read("../src/App.tsx");
  assert.match(studio, /Agent inference · unverified/);
  assert.match(studio, /Verify-stage result/);
  assert.match(studio, /No Lifecycle or fixture data was substituted/);
  assert.match(studio, /bytes and storage locations withheld/);
  assert.match(app, /bounded observation was validated, but it is not an independent Verify-stage result/);
  assert.doesNotMatch(studio, /roloClient\.(invoke|cancel|replay|export|collect|recollect)/);
});
