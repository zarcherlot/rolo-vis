import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const studioPath = new URL("../src/EpisodeStudio.tsx", import.meta.url);
const viewPath = new URL("../src/EpisodeDiagnosticFocusView.tsx", import.meta.url);
const modelPath = new URL("../src/episodeDiagnosticFocus.ts", import.meta.url);
const clientPath = new URL("../src/roloClient.ts", import.meta.url);

test("diagnostic focus is derived locally without adding a backend action", async () => {
  const [studio, model, client] = await Promise.all([readFile(studioPath, "utf8"), readFile(modelPath, "utf8"), readFile(clientPath, "utf8")]);
  assert.match(studio, /buildEpisodeDiagnosticFocus\(detail, events, selectedFindingId\)/);
  assert.doesNotMatch(model, /roloClient|fetch\(/);
  assert.doesNotMatch(client, /diagnosticFocus|remediateEpisode|recollectEpisode/);
});

test("diagnostic UI preserves evidence lanes and withholds causal or write authority", async () => {
  const view = await readFile(viewPath, "utf8");
  assert.match(view, /Proximity does not make them supporting evidence or a cause/);
  assert.match(view, /Supporting evidence/);
  assert.match(view, /Contradicting evidence/);
  assert.match(view, /No recollection, remediation, verification promotion, or write action/);
  assert.doesNotMatch(view, /Retry operation|Collect now|Mark verified|Resolve finding/);
});

test("Finding focus is URL-pinned and dims only out-of-window timeline context", async () => {
  const studio = await readFile(studioPath, "utf8");
  assert.match(studio, /findingId: selectedFindingId \|\| null/);
  assert.match(studio, /is-outside-diagnostic/);
  assert.match(studio, /Focus diagnostic window/);
  assert.match(studio, /setSelectedEventId\(first\.eventId\)/);
  assert.match(studio, /prefers-reduced-motion: reduce/);
  assert.match(studio, /scrollIntoView/);
});
