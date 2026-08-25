import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  EPISODE_BASELINE,
  EPISODE_ASSET_FOCUS_BASELINE,
  EPISODE_COHORT_BASELINE,
  EPISODE_COHORT_INVESTIGATION_BASELINE,
  EPISODE_COMPARISON_EVIDENCE_BASELINE,
  EPISODE_CONTEXT_NAVIGATION_BASELINE,
  EPISODE_EVIDENCE_CONTEXT_BASELINE,
  EPISODE_OCCURRENCE_FOCUS_BASELINE,
  EPISODE_NAVIGATION_REHYDRATION_BASELINE,
  EPISODE_REVIEW_LINK_HANDOFF_BASELINE,
  EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE,
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
  assert.equal(EPISODE_COHORT_INVESTIGATION_BASELINE.status, "baseline");
  assert.equal(EPISODE_COHORT_INVESTIGATION_BASELINE.mode, "read-only");
  assert.equal(EPISODE_COHORT_INVESTIGATION_BASELINE.extends, EPISODE_COHORT_BASELINE.id);
  assert.equal(EPISODE_COHORT_INVESTIGATION_BASELINE.release, "0.24.0");
  assert.equal(EPISODE_COHORT_INVESTIGATION_BASELINE.frontendMinimum, "858c824");
  assert.equal(EPISODE_COHORT_INVESTIGATION_BASELINE.frontendMainMerge, "a42adeb");
  assert.equal(EPISODE_COHORT_INVESTIGATION_BASELINE.producerMinimum, "463d501");
  assert.equal(EPISODE_COHORT_INVESTIGATION_BASELINE.requiredCohortFeature, "workbench.episode-cohort-read-model/v1");
  assert.equal(EPISODE_COMPARISON_EVIDENCE_BASELINE.status, "baseline");
  assert.equal(EPISODE_COMPARISON_EVIDENCE_BASELINE.mode, "read-only");
  assert.equal(EPISODE_COMPARISON_EVIDENCE_BASELINE.extends, EPISODE_COHORT_INVESTIGATION_BASELINE.id);
  assert.equal(EPISODE_COMPARISON_EVIDENCE_BASELINE.release, "0.25.0");
  assert.equal(EPISODE_COMPARISON_EVIDENCE_BASELINE.frontendMinimum, "e756702");
  assert.equal(EPISODE_COMPARISON_EVIDENCE_BASELINE.frontendMainMerge, "0dd4fec");
  assert.equal(EPISODE_COMPARISON_EVIDENCE_BASELINE.producerMinimum, "463d501");
  assert.equal(EPISODE_COMPARISON_EVIDENCE_BASELINE.derivedComparisonSchema, "rolo-vis-episode-pair-comparison/v2");
  assert.equal(EPISODE_COMPARISON_EVIDENCE_BASELINE.evidenceTraceAuthority, "REFERENCE_PRESENCE_ONLY");
  assert.equal(EPISODE_EVIDENCE_CONTEXT_BASELINE.status, "baseline");
  assert.equal(EPISODE_EVIDENCE_CONTEXT_BASELINE.mode, "read-only");
  assert.equal(EPISODE_EVIDENCE_CONTEXT_BASELINE.extends, EPISODE_COMPARISON_EVIDENCE_BASELINE.id);
  assert.equal(EPISODE_EVIDENCE_CONTEXT_BASELINE.release, "0.26.0");
  assert.equal(EPISODE_EVIDENCE_CONTEXT_BASELINE.frontendMinimum, "e863266");
  assert.equal(EPISODE_EVIDENCE_CONTEXT_BASELINE.frontendMainMerge, "838e2c2");
  assert.equal(EPISODE_EVIDENCE_CONTEXT_BASELINE.producerMinimum, "463d501");
  assert.equal(EPISODE_EVIDENCE_CONTEXT_BASELINE.derivedContextSchema, "rolo-vis-episode-evidence-reference-context/v1");
  assert.equal(EPISODE_EVIDENCE_CONTEXT_BASELINE.referenceContextAuthority, "REFERENCE_OCCURRENCE_ONLY");
  assert.equal(EPISODE_CONTEXT_NAVIGATION_BASELINE.status, "baseline");
  assert.equal(EPISODE_CONTEXT_NAVIGATION_BASELINE.mode, "read-only");
  assert.equal(EPISODE_CONTEXT_NAVIGATION_BASELINE.extends, EPISODE_EVIDENCE_CONTEXT_BASELINE.id);
  assert.equal(EPISODE_CONTEXT_NAVIGATION_BASELINE.release, "0.27.0");
  assert.equal(EPISODE_CONTEXT_NAVIGATION_BASELINE.frontendMinimum, "e2e8302");
  assert.equal(EPISODE_CONTEXT_NAVIGATION_BASELINE.frontendMainMerge, "2263cd8");
  assert.equal(EPISODE_CONTEXT_NAVIGATION_BASELINE.producerMinimum, "463d501");
  assert.equal(EPISODE_CONTEXT_NAVIGATION_BASELINE.selectedReferenceParameter, "compare_evidence");
  assert.equal(EPISODE_CONTEXT_NAVIGATION_BASELINE.selectionAuthority, "CONTEXT_SELECTION_ONLY");
  assert.equal(EPISODE_CONTEXT_NAVIGATION_BASELINE.opensEvidenceRecord, false);
  assert.equal(EPISODE_OCCURRENCE_FOCUS_BASELINE.status, "baseline");
  assert.equal(EPISODE_OCCURRENCE_FOCUS_BASELINE.mode, "read-only");
  assert.equal(EPISODE_OCCURRENCE_FOCUS_BASELINE.extends, EPISODE_CONTEXT_NAVIGATION_BASELINE.id);
  assert.equal(EPISODE_OCCURRENCE_FOCUS_BASELINE.release, "0.28.0");
  assert.equal(EPISODE_OCCURRENCE_FOCUS_BASELINE.frontendMinimum, "508c6d2");
  assert.equal(EPISODE_OCCURRENCE_FOCUS_BASELINE.frontendMainMerge, "57e3aaf");
  assert.equal(EPISODE_OCCURRENCE_FOCUS_BASELINE.producerMinimum, "463d501");
  assert.deepEqual(EPISODE_OCCURRENCE_FOCUS_BASELINE.sourceParameters, ["event", "finding"]);
  assert.equal(EPISODE_OCCURRENCE_FOCUS_BASELINE.focusAuthority, "SOURCE_FOCUS_ONLY");
  assert.equal(EPISODE_OCCURRENCE_FOCUS_BASELINE.focusSide, "LEFT_ONLY");
  assert.equal(EPISODE_OCCURRENCE_FOCUS_BASELINE.opensEvidenceRecord, false);
  assert.equal(EPISODE_OCCURRENCE_FOCUS_BASELINE.supportsWrite, false);
  assert.equal(EPISODE_ASSET_FOCUS_BASELINE.status, "baseline");
  assert.equal(EPISODE_ASSET_FOCUS_BASELINE.mode, "read-only");
  assert.equal(EPISODE_ASSET_FOCUS_BASELINE.extends, EPISODE_OCCURRENCE_FOCUS_BASELINE.id);
  assert.equal(EPISODE_ASSET_FOCUS_BASELINE.release, "0.29.0");
  assert.equal(EPISODE_ASSET_FOCUS_BASELINE.frontendMinimum, "7123f01");
  assert.equal(EPISODE_ASSET_FOCUS_BASELINE.frontendMainMerge, "4578788");
  assert.equal(EPISODE_ASSET_FOCUS_BASELINE.producerMinimum, "463d501");
  assert.equal(EPISODE_ASSET_FOCUS_BASELINE.selectedReferenceParameter, "compare_evidence");
  assert.equal(EPISODE_ASSET_FOCUS_BASELINE.assetParameter, "asset");
  assert.equal(EPISODE_ASSET_FOCUS_BASELINE.focusAuthority, "ASSET_METADATA_FOCUS_ONLY");
  assert.equal(EPISODE_ASSET_FOCUS_BASELINE.focusSide, "LEFT_ONLY");
  assert.equal(EPISODE_ASSET_FOCUS_BASELINE.opensEvidenceRecord, false);
  assert.equal(EPISODE_ASSET_FOCUS_BASELINE.readsAssetBytes, false);
  assert.equal(EPISODE_ASSET_FOCUS_BASELINE.supportsWrite, false);
  assert.equal(EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.status, "baseline");
  assert.equal(EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.mode, "read-only");
  assert.equal(EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.extends, EPISODE_ASSET_FOCUS_BASELINE.id);
  assert.equal(EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.release, "0.30.0");
  assert.equal(EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.frontendMinimum, "801231f");
  assert.equal(EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.frontendMainMerge, "b487b01");
  assert.equal(EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.producerMinimum, "463d501");
  assert.deepEqual(EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.sourceParameters, ["event", "finding", "asset"]);
  assert.equal(EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.orientationAuthority, "PAIR_ORIENTATION_HANDOFF_ONLY");
  assert.equal(EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.sourceTransition, "RIGHT_SELECTED_THEN_LEFT_REVALIDATED");
  assert.equal(EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.addsSideParameter, false);
  assert.equal(EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.opensEvidenceRecord, false);
  assert.equal(EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.readsAssetBytes, false);
  assert.equal(EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.supportsWrite, false);
  assert.equal(EPISODE_NAVIGATION_REHYDRATION_BASELINE.status, "baseline");
  assert.equal(EPISODE_NAVIGATION_REHYDRATION_BASELINE.mode, "read-only");
  assert.equal(EPISODE_NAVIGATION_REHYDRATION_BASELINE.extends, EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.id);
  assert.equal(EPISODE_NAVIGATION_REHYDRATION_BASELINE.release, "0.31.0");
  assert.equal(EPISODE_NAVIGATION_REHYDRATION_BASELINE.frontendMinimum, "5776492");
  assert.equal(EPISODE_NAVIGATION_REHYDRATION_BASELINE.frontendMainMerge, "5776492");
  assert.equal(EPISODE_NAVIGATION_REHYDRATION_BASELINE.producerMinimum, "463d501");
  assert.equal(EPISODE_NAVIGATION_REHYDRATION_BASELINE.navigationAuthority, "NAVIGATION_REHYDRATION_ONLY");
  assert.deepEqual(EPISODE_NAVIGATION_REHYDRATION_BASELINE.historyEvents, ["popstate"]);
  assert.equal(EPISODE_NAVIGATION_REHYDRATION_BASELINE.invalidTarget, "STACK_NORMALIZED");
  assert.equal(EPISODE_NAVIGATION_REHYDRATION_BASELINE.reconnectPolicy, "ROBOT_IDENTITY_CHANGE_ONLY");
  assert.equal(EPISODE_NAVIGATION_REHYDRATION_BASELINE.addsEndpoint, false);
  assert.equal(EPISODE_NAVIGATION_REHYDRATION_BASELINE.supportsWrite, false);
  assert.equal(EPISODE_REVIEW_LINK_HANDOFF_BASELINE.status, "baseline");
  assert.equal(EPISODE_REVIEW_LINK_HANDOFF_BASELINE.mode, "read-only");
  assert.equal(EPISODE_REVIEW_LINK_HANDOFF_BASELINE.extends, EPISODE_NAVIGATION_REHYDRATION_BASELINE.id);
  assert.equal(EPISODE_REVIEW_LINK_HANDOFF_BASELINE.release, "0.32.0");
  assert.equal(EPISODE_REVIEW_LINK_HANDOFF_BASELINE.frontendMinimum, "92689a9");
  assert.equal(EPISODE_REVIEW_LINK_HANDOFF_BASELINE.frontendMainMerge, "92689a9");
  assert.equal(EPISODE_REVIEW_LINK_HANDOFF_BASELINE.producerMinimum, "463d501");
  assert.equal(EPISODE_REVIEW_LINK_HANDOFF_BASELINE.handoffAuthority, "READ_ONLY_REVIEW_HANDOFF_ONLY");
  assert.equal(EPISODE_REVIEW_LINK_HANDOFF_BASELINE.linkPolicy, "STRICT_ALLOWLIST_ROUND_TRIP");
  assert.equal(EPISODE_REVIEW_LINK_HANDOFF_BASELINE.clipboardInitiation, "USER_ONLY");
  assert.equal(EPISODE_REVIEW_LINK_HANDOFF_BASELINE.addsEndpoint, false);
  assert.equal(EPISODE_REVIEW_LINK_HANDOFF_BASELINE.exportsContent, false);
  assert.equal(EPISODE_REVIEW_LINK_HANDOFF_BASELINE.supportsWrite, false);
});

test("Episode Comparison Evidence baseline freezes v0.25 without adding producer or write authority", async () => {
  const [baseline, contract, manifest, packageJson] = await Promise.all([
    read("../docs/EPISODE_COMPARISON_EVIDENCE_BASELINE.md"),
    read("../docs/EPISODE_COMPARISON_EVIDENCE_TRACE_CONTRACT.md"),
    read("../rolo.plugin.json"),
    read("../package.json"),
  ]);
  assert.match(baseline, /Version: `0\.25\.0`/);
  assert.match(baseline, /Frontend minimum: `e756702` \(merged to main by `0dd4fec`\)/);
  assert.match(baseline, /REFERENCE_PRESENCE_ONLY/);
  assert.match(baseline, /rejected the unresolved referenced record with HTTP\s+404/i);
  assert.match(contract, /approved and promoted as the `v0\.25\.0` read-only baseline/i);
  assert.equal(JSON.parse(manifest).version, "0.32.0");
  assert.equal(JSON.parse(packageJson).version, "0.32.0");
  assert.doesNotMatch(manifest, /episode\.(media|replay|export|write)/);
});

test("Episode Evidence reference context baseline freezes v0.26 without content or write authority", async () => {
  const [baseline, contract, manifest, packageJson] = await Promise.all([
    read("../docs/EPISODE_EVIDENCE_REFERENCE_CONTEXT_BASELINE.md"),
    read("../docs/EPISODE_EVIDENCE_REFERENCE_CONTEXT_CONTRACT.md"),
    read("../rolo.plugin.json"),
    read("../package.json"),
  ]);
  assert.match(baseline, /Version: `0\.26\.0`/);
  assert.match(baseline, /Frontend minimum: `e863266` \(merged to main by `838e2c2`\)/);
  assert.match(baseline, /REFERENCE_OCCURRENCE_ONLY/);
  assert.match(baseline, /20 visible occurrences per side/i);
  assert.match(baseline, /unresolved Evidence record remained rejected with HTTP 404/i);
  assert.match(contract, /approved and promoted as the `v0\.26\.0` read-only baseline/i);
  assert.equal(JSON.parse(manifest).version, "0.32.0");
  assert.equal(JSON.parse(packageJson).version, "0.32.0");
  assert.doesNotMatch(manifest, /episode\.(media|replay|export|write)/);
});

test("Episode Evidence context navigation baseline freezes v0.27 without record or write authority", async () => {
  const [baseline, contract, manifest, packageJson] = await Promise.all([
    read("../docs/EPISODE_CONTEXT_NAVIGATION_BASELINE.md"),
    read("../docs/EPISODE_EVIDENCE_CONTEXT_NAVIGATION_CONTRACT.md"),
    read("../rolo.plugin.json"),
    read("../package.json"),
  ]);
  assert.match(baseline, /Version: `0\.27\.0`/);
  assert.match(baseline, /Frontend minimum: `e2e8302` \(merged to main by `2263cd8`\)/);
  assert.match(baseline, /CONTEXT_SELECTION_ONLY/);
  assert.match(baseline, /does not request, open, or infer an Evidence record/i);
  assert.match(baseline, /stale ID\s+was removed, malformed input was rejected/i);
  assert.match(contract, /approved and promoted as the `v0\.27\.0` read-only baseline/i);
  assert.equal(JSON.parse(manifest).version, "0.32.0");
  assert.equal(JSON.parse(packageJson).version, "0.32.0");
  assert.doesNotMatch(manifest, /episode\.(media|replay|export|write)/);
});

test("Episode occurrence focus baseline freezes v0.28 without right-side or write authority", async () => {
  const [baseline, contract, manifest, packageJson] = await Promise.all([
    read("../docs/EPISODE_OCCURRENCE_FOCUS_BASELINE.md"),
    read("../docs/EPISODE_EVIDENCE_OCCURRENCE_FOCUS_CONTRACT.md"),
    read("../rolo.plugin.json"),
    read("../package.json"),
  ]);
  assert.match(baseline, /Version: `0\.28\.0`/);
  assert.match(baseline, /Frontend minimum: `508c6d2` \(merged to main by `57e3aaf`\)/);
  assert.match(baseline, /SOURCE_FOCUS_ONLY/);
  assert.match(baseline, /right-side.*remain context only/i);
  assert.match(baseline, /live fixture exposes no Finding occurrence/i);
  assert.match(contract, /approved and promoted as the `v0\.28\.0` read-only baseline/i);
  assert.equal(JSON.parse(manifest).version, "0.32.0");
  assert.equal(JSON.parse(packageJson).version, "0.32.0");
  assert.doesNotMatch(manifest, /episode\.(media|replay|export|write)/);
});

test("Episode Asset occurrence focus baseline freezes v0.29 without content or write authority", async () => {
  const [baseline, contract, check, manifest, packageJson] = await Promise.all([
    read("../docs/EPISODE_ASSET_OCCURRENCE_FOCUS_BASELINE.md"),
    read("../docs/EPISODE_ASSET_OCCURRENCE_FOCUS_CONTRACT.md"),
    read("../scripts/check-episode-asset-occurrence-focus.mjs"),
    read("../rolo.plugin.json"),
    read("../package.json"),
  ]);
  assert.match(baseline, /Version: `0\.29\.0`/);
  assert.match(baseline, /Frontend minimum: `7123f01`/);
  assert.match(baseline, /Frontend main merge: `4578788`/);
  assert.match(baseline, /ASSET_METADATA_FOCUS_ONLY/);
  assert.match(baseline, /metadata-only `MISSING` Asset/i);
  assert.match(contract, /approved and promoted as the `v0\.29\.0` read-only baseline/i);
  assert.match(check, /occurrence\.source === "ASSET"/);
  assert.match(check, /reads_asset_bytes: false/);
  assert.match(check, /supports_write: false/);
  assert.doesNotMatch(check, /client\.evidence\(/);
  assert.equal(JSON.parse(manifest).version, "0.32.0");
  assert.equal(JSON.parse(packageJson).version, "0.32.0");
  assert.doesNotMatch(manifest, /episode\.(media|replay|export|write)/);
});

test("Episode right Context handoff freezes v0.30 without ranking or write authority", async () => {
  const [baseline, contract, check, manifest, packageJson] = await Promise.all([
    read("../docs/EPISODE_RIGHT_CONTEXT_HANDOFF_BASELINE.md"),
    read("../docs/EPISODE_RIGHT_CONTEXT_HANDOFF_CONTRACT.md"),
    read("../scripts/check-episode-right-context-handoff.mjs"),
    read("../rolo.plugin.json"),
    read("../package.json"),
  ]);
  assert.match(baseline, /Version: `0\.30\.0`/);
  assert.match(baseline, /Frontend minimum: `801231f`/);
  assert.match(baseline, /Frontend main merge: `b487b01`/);
  assert.match(baseline, /PAIR_ORIENTATION_HANDOFF_ONLY/);
  assert.match(baseline, /deterministic inverse/i);
  assert.match(contract, /approved and promoted as the `v0\.30\.0` read-only baseline/i);
  assert.match(check, /inverse_orientation_restored: true/);
  assert.match(check, /side_parameter_added: false/);
  assert.match(check, /opens_evidence_record: false/);
  assert.match(check, /supports_write: false/);
  assert.doesNotMatch(check, /client\.evidence\(|client\.(invoke|cancel|replay|export|collect|recollect)/);
  assert.equal(JSON.parse(manifest).version, "0.32.0");
  assert.equal(JSON.parse(packageJson).version, "0.32.0");
  assert.doesNotMatch(manifest, /episode\.(media|replay|export|write)/);
});

test("Episode navigation rehydration freezes v0.31 without replay or write authority", async () => {
  const [baseline, contract, check, manifest, packageJson] = await Promise.all([
    read("../docs/EPISODE_NAVIGATION_REHYDRATION_BASELINE.md"),
    read("../docs/EPISODE_NAVIGATION_REHYDRATION_CONTRACT.md"),
    read("../scripts/check-episode-navigation-rehydration.mjs"),
    read("../rolo.plugin.json"),
    read("../package.json"),
  ]);
  assert.match(baseline, /Version: `0\.31\.0`/);
  assert.match(baseline, /Frontend minimum: `5776492`/);
  assert.match(baseline, /Frontend main merge: `5776492`/);
  assert.match(baseline, /NAVIGATION_REHYDRATION_ONLY/);
  assert.match(baseline, /Back restored.*Forward restored/is);
  assert.match(contract, /approved and promoted as the `v0\.31\.0` read-only baseline/i);
  assert.match(check, /same_robot_bootstrap_repeated: false/);
  assert.match(check, /malformed_episode_normalized_to_stack/);
  assert.match(check, /supports_write: false/);
  assert.doesNotMatch(check, /client\.(invoke|cancel|replay|export|collect|recollect)/);
  assert.equal(JSON.parse(manifest).version, "0.32.0");
  assert.equal(JSON.parse(packageJson).version, "0.32.0");
  assert.doesNotMatch(manifest, /episode\.(media|replay|export|write)/);
});

test("Episode review link handoff freezes v0.32 without content export or write authority", async () => {
  const [baseline, contract, check, manifest, packageJson] = await Promise.all([
    read("../docs/EPISODE_REVIEW_LINK_HANDOFF_BASELINE.md"),
    read("../docs/EPISODE_REVIEW_LINK_HANDOFF_CONTRACT.md"),
    read("../scripts/check-episode-review-link-handoff.mjs"),
    read("../rolo.plugin.json"),
    read("../package.json"),
  ]);
  assert.match(baseline, /Version: `0\.32\.0`/);
  assert.match(baseline, /Frontend minimum: `92689a9`/);
  assert.match(baseline, /Frontend main merge: `92689a9`/);
  assert.match(baseline, /READ_ONLY_REVIEW_HANDOFF_ONLY/);
  assert.match(baseline, /stale Evidence selection was removed/i);
  assert.match(contract, /approved and promoted as the `v0\.32\.0` read-only baseline/i);
  assert.match(check, /clipboard_denial_propagated: true/);
  assert.match(check, /supports_content_export: false/);
  assert.match(check, /supports_write: false/);
  assert.doesNotMatch(check, /client\.(invoke|cancel|replay|export|collect|recollect)/);
  assert.equal(JSON.parse(manifest).version, "0.32.0");
  assert.equal(JSON.parse(packageJson).version, "0.32.0");
  assert.doesNotMatch(manifest, /episode\.(media|replay|export|write)/);
});

test("Episode Cohort Investigation baseline freezes reference continuity without new authority", async () => {
  const [baseline, manifest, studio] = await Promise.all([
    read("../docs/EPISODE_COHORT_INVESTIGATION_BASELINE.md"),
    read("../rolo.plugin.json"),
    read("../src/EpisodeStudio.tsx"),
  ]);
  assert.match(baseline, /Version: `0\.24\.0`/);
  assert.match(baseline, /without replacing that reference/i);
  assert.match(baseline, /no new endpoint, producer schema, feature flag, or write authority/i);
  assert.doesNotMatch(manifest, /episode\.(media|replay|export|write)/);
  assert.doesNotMatch(studio, /roloClient\.(invoke|cancel|replay|export|collect|recollect)/);
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
