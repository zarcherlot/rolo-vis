import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const studioPath = new URL("../src/EpisodeStudio.tsx", import.meta.url);
const viewPath = new URL("../src/EpisodeComparisonView.tsx", import.meta.url);
const clientPath = new URL("../src/roloClient.ts", import.meta.url);
const evidenceContractPath = new URL("../docs/EPISODE_COMPARISON_EVIDENCE_TRACE_CONTRACT.md", import.meta.url);
const contextContractPath = new URL("../docs/EPISODE_EVIDENCE_REFERENCE_CONTEXT_CONTRACT.md", import.meta.url);

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

test("Episode pair evidence trace reuses the validated Evidence drawer and keeps reference presence non-authoritative", async () => {
  const [studio, view, contract] = await Promise.all([readFile(studioPath, "utf8"), readFile(viewPath, "utf8"), readFile(evidenceContractPath, "utf8")]);
  assert.match(studio, /<EpisodeComparisonView comparison=\{comparison\} evidenceContext=\{evidenceContext\} selectedEvidenceId=\{selectedComparisonEvidenceId \|\| null\}/);
  assert.match(view, /Reference presence across both sides/);
  assert.match(view, /evidenceTrace\.authority/);
  assert.match(view, /do not establish evidence quality, verification, or causal support/);
  assert.match(view, /Finding · supporting/);
  assert.match(view, /Finding · contradicting/);
  assert.match(view, /LEFT ONLY/);
  assert.match(view, /RIGHT ONLY/);
  assert.match(view, /onOpenEvidence\(item\.evidenceId\)/);
  assert.match(view, /bounded partial, so event-level references may be absent/);
  assert.match(contract, /At most 100 unique Evidence IDs are rendered/);
  assert.match(contract, /does not assert that the record exists/);
  assert.match(contract, /supportsEvidenceQuality/);
  assert.doesNotMatch(view, /evidence score|evidence verdict|verified by presence/i);
});

test("E11 occurrence context is derived from the same pair inputs and keeps the Evidence drawer separate", async () => {
  const [studio, view, contract] = await Promise.all([
    readFile(studioPath, "utf8"),
    readFile(viewPath, "utf8"),
    readFile(contextContractPath, "utf8"),
  ]);
  assert.match(studio, /buildEpisodeEvidenceReferenceContext\(pair, left\.detail, left\.events, right\.detail, right\.events\)/);
  assert.match(view, /evidenceContext\.authority/);
  assert.match(view, /bounded attachment points, not Evidence content or proof of semantic equivalence/);
  assert.match(view, /LEFT OCCURRENCES/);
  assert.match(view, /RIGHT OCCURRENCES/);
  assert.match(view, /onOpenEvidence\(item\.evidenceId\)/);
  assert.match(contract, /at most 20 occurrences per side/i);
  assert.match(contract, /supportsEvidenceContent/);
  assert.doesNotMatch(view, /content match|equivalent evidence|quality score|sufficient evidence/i);
});

test("E10D live check validates bounded reference authority and unresolved records", async () => {
  const check = await readFile(new URL("../scripts/check-episode-comparison-evidence.mjs", import.meta.url), "utf8");
  assert.match(check, /rolo-vis-episode-pair-comparison\/v2/);
  assert.match(check, /REFERENCE_PRESENCE_ONLY/);
  assert.match(check, /supportsEvidenceQuality/);
  assert.match(check, /trace\.visibleCount \+ trace\.truncatedCount/);
  assert.match(check, /error\.status === 404/);
  assert.match(check, /supports_write: false/);
});

test("E11D live check preserves bounded occurrence authority across dense and partial projections", async () => {
  const check = await readFile(new URL("../scripts/check-episode-evidence-reference-context.mjs", import.meta.url), "utf8");
  assert.match(check, /rolo-vis-episode-evidence-reference-context\/v1/);
  assert.match(check, /REFERENCE_OCCURRENCE_ONLY/);
  assert.match(check, /EPISODE_EVIDENCE_OCCURRENCE_LIMIT_PER_SIDE/);
  assert.match(check, /FINDING_SUPPORTING/);
  assert.match(check, /FINDING_CONTRADICTING/);
  assert.match(check, /BOUNDED_PARTIAL/);
  assert.match(check, /error instanceof RoloApiError && error\.status === 404/);
  assert.match(check, /supports_write: false/);
});

test("E12 comparison context selection is URL-pinned, controlled by Studio, and rejected when stale", async () => {
  const [studio, view, contract] = await Promise.all([
    readFile(studioPath, "utf8"),
    readFile(viewPath, "utf8"),
    readFile(new URL("../docs/EPISODE_EVIDENCE_CONTEXT_NAVIGATION_CONTRACT.md", import.meta.url), "utf8"),
  ]);
  assert.match(studio, /initialTarget\.compareEvidenceId/);
  assert.match(studio, /context\.items\.some\(\(item\) => item\.evidenceId === current\)/);
  assert.match(studio, /compareEvidenceId:.*selectedComparisonEvidenceId \|\| null/);
  assert.match(view, /onSelectEvidenceContext\(selectedEvidenceId === item\.evidenceId \? null : item\.evidenceId\)/);
  assert.doesNotMatch(view, /useState<string \| null>/);
  assert.match(contract, /must exist in the visible, validated v0\.26 context/i);
  assert.match(contract, /does not open the\s+Evidence drawer/i);
});
