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
  assert.equal(manifest.schema_version, "rolo-plugin/v2");
  assert.equal(manifest.entry, "dist/client/index.html");
  assert.equal(manifest.api.base_path, "/rolo-api");
  assert.equal(manifest.security.mode, "read-only");
  assert.match(contract, /upgrades `rolo\.plugin\.json` from the historical v1 shape to\s+`rolo-plugin\/v2`/);
  assert.match(contract, /delivery\.mode: device-local/);
  assert.match(contract, /delivery\.mount_path: \/workbench\//);
  assert.match(contract, /integrity\.algorithm: sha256/);
  assert.match(contract, /`SHA256SUMS` covers the manifest and every served file/);
});

test("E23C removes Sites delivery and keeps robot-hosted instructions authoritative", async () => {
  const [contract, packageJson, agents, app, viteConfig] = await Promise.all([
    read("../docs/ROBOT_HOSTED_DELIVERY_CONTRACT.md"),
    read("../package.json").then(JSON.parse),
    read("../AGENTS.md"),
    read("../src/App.tsx"),
    read("../vite.config.mjs"),
  ]);
  assert.equal(packageJson.version, "0.38.0");
  assert.doesNotMatch(packageJson.scripts.build, /prepare-sites-build|sites/i);
  assert.equal(packageJson.scripts["package:plugin"], "node scripts/package-plugin.mjs");
  assert.equal(packageJson.scripts["test:plugin"], "node --test tests/plugin-package.test.mjs");
  assert.match(contract, /Those files are removed by the E23C implementation/);
  assert.match(contract, /deleted Sites project is not\s+recreated, saved, previewed, or deployed/);
  assert.match(agents, /Production delivery is robot-hosted and device-local/);
  assert.match(agents, /Do not create or deploy a public Sites project/);
  assert.match(viteConfig, /base:\s*"\.\/"/);
  assert.match(app, /import\.meta\.env\.BASE_URL.*assets\/rolo-mark\.png/);
  assert.doesNotMatch(app, /src=["{]"?\/assets\//);
});

test("E23D candidate pins the device gate without claiming an unrun robot promotion", async () => {
  const [candidate, install, gate, packageJson, manifest] = await Promise.all([
    read("../docs/ROBOT_HOSTED_DELIVERY_BASELINE_CANDIDATE.md"),
    read("../docs/ROBOT_HOSTED_INSTALLATION.md"),
    read("../scripts/check-robot-hosted-delivery.mjs"),
    read("../package.json").then(JSON.parse),
    read("../rolo.plugin.json").then(JSON.parse),
  ]);
  assert.equal(packageJson.version, "0.38.0");
  assert.equal(manifest.version, "0.38.0");
  assert.match(candidate, /Status: E23D validation candidate/);
  assert.match(candidate, /Linux\/robot gate: pending/);
  assert.match(candidate, /Source tree SHA-256:\s+`30503fa0/);
  assert.match(candidate, /No `v0\.38\.0` tag may be created/i);
  assert.match(install, /robotctl runtime serve --host 127\.0\.0\.1/);
  assert.match(install, /Rollback/);
  assert.match(gate, /trusted_proxy_headers_do_not_expand_authority/);
  assert.match(gate, /workbench\.episode-observation-bundle\/v1/);
  assert.doesNotMatch(`\${candidate}\n\${install}`, /public hosted deployment|Sites deployment/i);
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
  assert.match(contract, /no teleoperation, shell command, arbitrary filesystem access/i);
});
