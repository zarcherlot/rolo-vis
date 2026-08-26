import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("E23A freezes robot-owned same-origin delivery without a public site", async () => {
  const contract = await read("../docs/ROBOT_HOSTED_DELIVERY_CONTRACT.md");
  assert.match(contract, /browser entry point is `\/workbench\/`/);
  assert.match(contract, /same-origin API base remains\s+`\/rolo-api`/);
  assert.match(contract, /does not require or advertise a public production site/);
  assert.match(contract, /trusted robot-owned reverse proxy/);
  assert.match(contract, /No browser code receives a bearer token/);
});

test("E23A freezes the v2 package and deterministic integrity boundary", async () => {
  const [contract, manifest] = await Promise.all([
    read("../docs/ROBOT_HOSTED_DELIVERY_CONTRACT.md"),
    read("../rolo.plugin.json").then(JSON.parse),
  ]);
  assert.equal(manifest.schema_version, "rolo-plugin/v1");
  assert.equal(manifest.entry, "dist/client/index.html");
  assert.equal(manifest.api.base_path, "/rolo-api");
  assert.equal(manifest.security.mode, "read-only");
  assert.match(contract, /upgrades `rolo\.plugin\.json` from the historical v1 shape to\s+`rolo-plugin\/v2`/);
  assert.match(contract, /delivery\.mode: device-local/);
  assert.match(contract, /delivery\.mount_path: \/workbench\//);
  assert.match(contract, /integrity\.algorithm: sha256/);
  assert.match(contract, /`SHA256SUMS` covers the manifest and every served file/);
});

test("E23A defers Sites removal and runtime implementation to reviewed slices", async () => {
  const [contract, packageJson, agents] = await Promise.all([
    read("../docs/ROBOT_HOSTED_DELIVERY_CONTRACT.md"),
    read("../package.json").then(JSON.parse),
    read("../AGENTS.md"),
  ]);
  assert.equal(packageJson.version, "0.37.0");
  assert.match(packageJson.scripts.build, /prepare-sites-build/);
  assert.match(contract, /Removing those files is an implementation slice, not an E23A design mutation/);
  assert.match(contract, /deleted Sites project is not recreated, saved, previewed, or deployed/);
  assert.match(agents, /Production delivery is robot-hosted and device-local/);
  assert.match(agents, /Do not create or deploy a public Sites project/);
});

test("E23A preserves read-only failure and authority boundaries", async () => {
  const [contract, client, app] = await Promise.all([
    read("../docs/ROBOT_HOSTED_DELIVERY_CONTRACT.md"),
    read("../src/roloClient.ts"),
    read("../src/App.tsx"),
  ]);
  assert.match(client, /DEFAULT_BASE = "\/rolo-api"/);
  assert.match(app, /The workbench will not substitute fixture data automatically/);
  assert.match(contract, /no demo fallback unless the user explicitly selects labeled demo data/i);
  assert.match(contract, /no teleoperation, shell command, arbitrary filesystem access/i);
  assert.match(contract, /add no product source, manifest v2, package script, or server change/);
});

