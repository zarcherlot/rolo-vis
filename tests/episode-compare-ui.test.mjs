import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const studioPath = new URL("../src/EpisodeStudio.tsx", import.meta.url);
const viewPath = new URL("../src/EpisodeComparisonView.tsx", import.meta.url);
const clientPath = new URL("../src/roloClient.ts", import.meta.url);

test("Episode pair UI derives from two existing read surfaces without a compare endpoint", async () => {
  const [studio, client] = await Promise.all([readFile(studioPath, "utf8"), readFile(clientPath, "utf8")]);
  assert.match(studio, /Promise\.all\(\[/);
  assert.match(studio, /readComparisonSide\(robotId, detail\.episode_id/);
  assert.match(studio, /readComparisonSide\(robotId, compareEpisodeId/);
  assert.doesNotMatch(client, /episodeCompare|episodeComparison/);
});

test("Episode pair UI keeps deltas, authority, and bounded coverage neutral", async () => {
  const view = await readFile(viewPath, "utf8");
  assert.match(view, /Right minus left deltas are neutral/);
  assert.match(view, /cannot establish improvement, regression, safety, success, or cause/);
  assert.match(view, /No outcome verdict/);
  assert.match(view, /INFERRED · unverified/);
  assert.match(view, /Timeline input/);
  assert.doesNotMatch(view, /better|worse|passed|failed comparison/i);
});

test("Episode pair loading and URL state are explicitly bounded and revision-pinned", async () => {
  const studio = await readFile(studioPath, "utf8");
  assert.match(studio, /EPISODE_COMPARE_PAGE_BUDGET = 5/);
  assert.match(studio, /EPISODE_VISIBLE_EVENT_LIMIT/);
  assert.match(studio, /moved from pinned revision/);
  assert.match(studio, /compareRevision !== detail\.revision/);
  assert.match(studio, /Same Episode · rev/);
  assert.match(studio, /episodeRevisions/);
  assert.match(studio, /timeline cursor repeated/);
});
