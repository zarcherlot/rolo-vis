import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const matrix = JSON.parse(await readFile(new URL("../tests/fixtures/device-hardening-matrix.json", import.meta.url), "utf8"));
assert.equal(matrix.schema_version, "rolo-vis-device-hardening-matrix/v1");
assert.ok(Array.isArray(matrix.scenarios) && matrix.scenarios.length >= 10);
const required = new Set([
  "windows-development", "linux-arm64", "linux-x86_64", "offline-install",
  "non-root-sudo", "ssh-jump-host", "host-key-rotation", "network-interruption",
  "restart-resume", "upgrade-rollback", "enrollment-rotation",
]);
const ids = new Set(matrix.scenarios.map((scenario) => scenario.id));
assert.deepEqual(ids, required);
for (const scenario of matrix.scenarios) {
  assert.ok(["local", "external"].includes(scenario.class));
  assert.ok(["AUTOMATED_CHECKED", "PENDING_EXTERNAL"].includes(scenario.status));
  if (scenario.class === "external") assert.equal(scenario.status, "PENDING_EXTERNAL");
}
assert.equal(matrix.scenarios.find((scenario) => scenario.id === "windows-development").status, "AUTOMATED_CHECKED");
console.log(`device hardening matrix: ${matrix.scenarios.length} scenarios; external validation remains pending`);
