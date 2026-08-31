import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { assertDeploymentIdentityMatches, parseDeploymentIdentityManifest } from "../src/deploymentIdentity.ts";
import { RoloContractError } from "../src/contracts/guards.ts";

const fixture = async () => JSON.parse(await readFile(new URL("./fixtures/deployment-identity.json", import.meta.url), "utf8"));

test("deployment identity manifest parses as a bounded, opaque record", async () => {
  const manifest = parseDeploymentIdentityManifest(await fixture());
  assert.equal(manifest.target_id, "ready-local");
  assert.equal(manifest.plugin_digest.startsWith("sha256:"), true);
});

test("deployment identity rejects raw paths, malformed digest, and revision drift", async () => {
  const value = await fixture();
  assert.throws(() => parseDeploymentIdentityManifest({ ...value, workspace_id: "C:\\workspace\\robot" }), RoloContractError);
  assert.throws(() => parseDeploymentIdentityManifest({ ...value, plugin_digest: "sha256:bad" }), RoloContractError);
  const manifest = parseDeploymentIdentityManifest(value);
  assert.throws(() => assertDeploymentIdentityMatches(manifest, { rolo_revision: "deadbeef" }), RoloContractError);
});

test("deployment identity matching allows optional expected fields only", async () => {
  const manifest = parseDeploymentIdentityManifest(JSON.parse(await readFile(new URL("./fixtures/deployment-identity.json", import.meta.url), "utf8")));
  assert.doesNotThrow(() => assertDeploymentIdentityMatches(manifest, { target_id: "ready-local", workspace_id: "workspace-ready-local" }));
});
