import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("MVP baseline pins the reviewed capability and discovery compatibility ranges", async () => {
  const source = await read("../src/contracts/compatibility.ts");
  for (const version of [
    "rolo-capability-collection/v1",
    "rolo-capability-collection/v2",
    "rolo-capability-summary/v1",
    "rolo-capability-summary/v2",
    "rolo-capability-detail/v1",
    "rolo-capability-detail/v2",
    "rolo-discovery-snapshot-collection/v1",
    "rolo-discovery-snapshot-collection/v2",
    "rolo-discovery-snapshot-collection/v3",
    "rolo-discovery-snapshot-summary/v1",
    "rolo-discovery-snapshot-summary/v2",
    "rolo-discovery-snapshot-summary/v3",
  ]) assert.match(source, new RegExp(version.replace("/", "\\/")));
  assert.match(source, /status: "baseline"/);
  assert.match(source, /mode: "read-only"/);
});

test("contract parsers are isolated from transport orchestration", async () => {
  const client = await read("../src/roloClient.ts");
  assert.match(client, /from "\.\/contracts\/capability\.ts"/);
  assert.match(client, /from "\.\/contracts\/discovery\.ts"/);
  assert.doesNotMatch(client, /function parseCapabilitySummary/);
  assert.doesNotMatch(client, /function parseDiscoverySnapshotSummary/);
});

test("review trust-lane fixtures cover advisory and freshness states without production imports", async () => {
  const fixture = JSON.parse(await read("./fixtures/mvp-baseline-trust-lanes.json"));
  assert.deepEqual(fixture.heuristic_states.map(({ status }) => status), ["AGENT_COMPLETED", "FALLBACK", "DISABLED"]);
  assert.deepEqual(fixture.target_evidence_states.map(({ freshness }) => freshness), ["FRESH", "STALE"]);
  assert.equal(fixture.inferred_capability.availability_credit, false);
  assert.equal(fixture.inferred_capability.verified_credit, false);

  for (const sourcePath of ["../src/App.tsx", "../src/roloClient.ts", "../src/demoData.ts"]) {
    assert.doesNotMatch(await read(sourcePath), /tests[\\/]fixtures|mvp-baseline-trust-lanes/);
  }
});

test("baseline trust prompts remain accessible and read-only", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /aria-label="Unverified Agent inferences"/);
  assert.match(app, /aria-label="Capability readiness"/);
  assert.match(app, /outside this read-only workbench/);
  assert.doesNotMatch(app, /roloClient\.(collect|recollect|targetEvidence)/);
});

test("E24B Job Inbox remains feature-gated and read-only", async () => {
  const app = await read("../src/App.tsx");
  const navigation = await read("../src/episodeNavigation.ts");
  assert.match(navigation, /"jobs"/);
  assert.match(app, /function JobInboxView/);
  assert.match(app, /ROLO_API_FEATURES\.jobReadModel/);
  assert.match(app, /roloClient\.jobs/);
  assert.match(app, /roloClient\.job\(/);
  assert.match(app, /roloClient\.jobEvents/);
  assert.match(app, /onLoadMoreEvents/);
  assert.match(app, /events\.next_offset/);
  assert.match(app, /Read-only view/);
  assert.doesNotMatch(app, /roloClient\.(bootstrapExecute|resumeJob|retryJob|cancelJob)/);
});

test("E24C Target Readiness stays blocked until a sanitized producer contract exists", async () => {
  const compatibility = await read("../src/contracts/compatibility.ts");
  const contract = await read("../docs/TARGET_READINESS_CONTRACT.md");
  assert.match(compatibility, /workbench\.target-readiness\/v1/);
  assert.match(compatibility, /status: "blocked-upstream"/);
  assert.match(contract, /rolo-target-readiness-summary\/v1/);
  assert.match(contract, /does not provide a safe GET endpoint/);
  assert.match(contract, /bootstrap-execute/);
  assert.match(contract, /private keys/i);
  assert.match(contract, /browser contract/i);
});

test("E25 Approval/Gate/Recovery keeps governance and execution authority separate", async () => {
  const compatibility = await read("../src/contracts/compatibility.ts");
  const contract = await read("../docs/APPROVAL_GATE_RECOVERY_CONTRACT.md");
  assert.match(compatibility, /workbench\.approval-gate-read-model\/v1/);
  assert.match(compatibility, /status: "blocked-upstream"/);
  assert.match(contract, /rolo-approval-gate-summary\/v1/);
  assert.match(contract, /Approval must remain separate from Gate outcome/);
  assert.match(contract, /bootstrap-execute/);
  assert.match(contract, /may not/);
  assert.match(contract, /resume\/retry\/cancel/);
});

test("E26 device hardening keeps external evidence pending and browser read-only", async () => {
  const matrix = JSON.parse(await readFile(new URL("./fixtures/device-hardening-matrix.json", import.meta.url), "utf8"));
  const plan = await read("../docs/DEVICE_HARDENING_VERIFICATION_PLAN.md");
  assert.equal(matrix.schema_version, "rolo-vis-device-hardening-matrix/v1");
  assert.equal(matrix.scenarios.find(({ id }) => id === "windows-development").status, "AUTOMATED_CHECKED");
  assert.ok(matrix.scenarios.filter(({ class: scenarioClass }) => scenarioClass === "external").every(({ status }) => status === "PENDING_EXTERNAL"));
  assert.match(plan, /No evidence includes private keys/);
  assert.match(plan, /does not add a hosted site/);
});
