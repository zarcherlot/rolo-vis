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
