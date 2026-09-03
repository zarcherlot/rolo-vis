import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("v2 manifest requires the RKB, MHS, Tool, and Episode read models", async () => {
  const manifest = JSON.parse(await readFile(new URL("rolo.plugin.json", root), "utf8"));
  assert.equal(manifest.schema_version, "rolo-plugin/v2");
  assert.deepEqual(manifest.api.required_features.slice(0, 4), [
    "rkb.read-model/v1",
    "mhs.inventory-read-model/v1",
    "tool.verification-read-model/v1",
    "rkb.episodes-read-model/v1",
  ]);
  assert.deepEqual(manifest.api.required_features.slice(-4), [
    "probe.evidence-view/v1",
    "association.report/v1",
    "probe.evidence-request/v1",
    "confirmation.user-intent-receipt/v1",
  ]);
  for (const endpoint of [
    "/v1/robots/{robot_id}/rkb",
    "/v1/robots/{robot_id}/mhs",
    "/v1/robots/{robot_id}/tools",
    "/v1/robots/{robot_id}/episodes",
    "/v1/robots/{robot_id}/episodes/{episode_id}",
    "/v1/probe/{robot_id}/evidence-view",
    "/v1/probe/evidence-requests",
    "/v1/associations/{robot_id}",
    "/v1/associations/{robot_id}/{association_id}",
    "/v1/confirmations",
  ]) assert.ok((manifest.api.v2_endpoints || []).includes(endpoint), `missing ${endpoint}`);
});

test("v2 surfaces keep verification and callability separate", async () => {
  const [view, parser, client] = await Promise.all([
    readFile(new URL("src/WorkbenchV2.tsx", root), "utf8"),
    readFile(new URL("src/contracts/rkb.ts", root), "utf8"),
    readFile(new URL("src/roloClient.ts", root), "utf8"),
  ]);
  assert.match(view, /MHS discovered/);
  assert.match(view, /Tools Verified/);
  assert.match(view, /Agent-callable/);
  assert.match(view, /rkbProjection/);
  assert.match(parser, /item\.callable === \(item\.tool_state === "VERIFIED"\)/);
  assert.match(parser, /item\.verified === item\.agent_callable/);
  assert.match(client, /async rkb\(robotId/);
  assert.match(client, /async mhs\(robotId/);
  assert.match(client, /async tools\(robotId/);
  assert.match(client, /async bootstrapV2\(/);
});

test("v2 Episode surface keeps evidence references and degraded states explicit", async () => {
  const [view, fixture] = await Promise.all([
    readFile(new URL("src/WorkbenchV2.tsx", root), "utf8"),
    readFile(new URL("tests/fixtures/workbench-v2-degradation.json", root), "utf8"),
  ]);
  const degradation = JSON.parse(fixture);
  assert.deepEqual(degradation.tool_states, ["STALE", "UNKNOWN", "UNAVAILABLE"]);
  assert.match(view, /Assets \(\{detail\.assets\.length\}\)/);
  assert.match(view, /Findings \(\{detail\.findings\.length\}\)/);
  assert.match(view, /onEvidence\(asset\.evidence_id/);
  assert.match(view, /Revision comparison/);
  assert.match(view, /Timeline truncated at the read-model page boundary/);
});

test("association contracts are versioned and fail closed around evidence and writes", async () => {
  const [types, contract, fixture, view, client] = await Promise.all([
    readFile(new URL("src/types/rolo.ts", root), "utf8"),
    readFile(new URL("src/contracts/association.ts", root), "utf8"),
    readFile(new URL("src/associationData.ts", root), "utf8"),
    readFile(new URL("src/WorkbenchV2.tsx", root), "utf8"),
    readFile(new URL("src/roloClient.ts", root), "utf8"),
  ]);
  assert.match(types, /ProbeEvidenceView/);
  assert.match(types, /AssociationReport/);
  assert.match(types, /EvidenceRequest/);
  assert.match(types, /UserIntentReceipt/);
  assert.match(contract, /PROPOSED.*UNKNOWN.*UNSUPPORTED/s);
  assert.match(contract, /PROPOSED proposal must cite evidence/);
  assert.match(contract, /prohibited operation/);
  assert.match(contract, /createUserIntentReceipt/);
  assert.match(fixture, /association-report\/v1/);
  assert.match(view, /Create UserIntentReceipt/);
  assert.match(view, /never invokes a device or Write Execution/);
  assert.match(client, /async associationReport\(/);
  assert.match(client, /async createConfirmation\(/);
});
