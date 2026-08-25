import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Cohort lens is independently feature gated and never synthesized from the Episode list", async () => {
  const [app, studio] = await Promise.all([
    read("../src/App.tsx"),
    read("../src/EpisodeStudio.tsx"),
  ]);
  assert.match(app, /ROLO_API_FEATURES\.episodeCohortReadModel/);
  assert.match(app, /cohortSupported=\{episodeCohortSupported\}/);
  assert.match(studio, /cohortSupported && <EpisodeCohortView/);
  assert.match(studio, /roloClient\.episodeCohort/);
  assert.doesNotMatch(studio, /buildEpisodeCohort.*episodes/);
});

test("Cohort review exposes neutral summaries, explicit partial state, and separate member actions", async () => {
  const view = await read("../src/EpisodeCohortView.tsx");
  assert.match(view, /DESCRIPTIVE ONLY/);
  assert.match(view, /No verdict or release signal is derived/);
  assert.match(view, /BOUNDED_PARTIAL/);
  assert.match(view, /Outcome and verification remain separate/);
  assert.match(view, /aria-label="Episode cohort time window"/);
  assert.match(view, /onOpenMember\(member\)/);
  assert.match(view, /onCompareMember\(member\)/);
  assert.match(view, /Compare .* with pinned reference/);
  assert.doesNotMatch(view, /regression|improvement|pass rate|percentile|significance/i);
});

test("Cohort compare keeps the reference pinned and reuses the independently validated pair loader", async () => {
  const [studio, client, contract] = await Promise.all([
    read("../src/EpisodeStudio.tsx"),
    read("../src/roloClient.ts"),
    read("../docs/EPISODE_COHORT_INVESTIGATION_CONTRACT.md"),
  ]);
  const handler = studio.slice(studio.indexOf("const compareCohortMember"), studio.indexOf("if (collectionLoading"));
  assert.match(handler, /setCompareEpisodeId\(member\.episode_id\)/);
  assert.match(handler, /setCompareRevision\(member\.revision\)/);
  assert.doesNotMatch(handler, /setSelectedEpisodeId|setSelectedRevision/);
  assert.match(studio, /readComparisonSide\(robotId, compareEpisodeId, compareRevision/);
  assert.doesNotMatch(client, /cohortCompare|cohortInvestigation/);
  assert.match(contract, /identity only/i);
  assert.match(contract, /not treated as Episode detail or timeline evidence/i);
});

test("E9D live check covers an off-index member, exact revision rejection, and deep-link continuity", async () => {
  const [check, prepare] = await Promise.all([
    read("../scripts/check-episode-cohort-investigation.mjs"),
    read("../scripts/prepare-episode-investigation-live-data.mjs"),
  ]);
  assert.match(check, /episodeCollection\(robotId, undefined, \{ limit: 1, offset: 0 \}\)/);
  assert.match(check, /Promise\.all\(\[/);
  assert.match(check, /buildEpisodePairComparison/);
  assert.match(check, /readEpisodeDeepLink\(deepLink\)/);
  assert.match(check, /member\.revision \+ 1/);
  assert.match(check, /reference_preserved: true/);
  assert.match(check, /supports_write: false/);
  assert.match(prepare, /refusing to overwrite/);
  assert.match(prepare, /source_preserved: true/);
  assert.match(prepare, /ep-e9-reference/);
});

test("v0.24 promotion preserves the reviewed candidate evidence", async () => {
  const [candidate, baseline] = await Promise.all([
    read("../docs/EPISODE_COHORT_INVESTIGATION_BASELINE_CANDIDATE.md"),
    read("../docs/EPISODE_COHORT_INVESTIGATION_BASELINE.md"),
  ]);
  assert.match(candidate, /Proposed version: `0\.24\.0`/);
  assert.match(candidate, /Reviewed frontend slice: `547134c`/);
  assert.match(candidate, /source directory was not modified/i);
  assert.match(candidate, /member was outside the bounded index page/i);
  assert.match(candidate, /approved and promoted by the `v0\.24\.0` baseline/i);
  assert.match(candidate, /merged to main as `a42adeb`/);
  assert.match(baseline, /Status: established baseline/);
});
