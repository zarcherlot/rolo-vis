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
