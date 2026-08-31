import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertDeploymentIdentityMatches, parseDeploymentIdentityManifest } from "../src/deploymentIdentity.ts";

const manifestPath = process.argv[2] || process.env.ROLO_DEPLOYMENT_IDENTITY;
assert.ok(manifestPath, "pass a deployment identity manifest path or set ROLO_DEPLOYMENT_IDENTITY");
const manifest = parseDeploymentIdentityManifest(JSON.parse(await readFile(manifestPath, "utf8")));
const expected = Object.fromEntries([
  ["release_line", process.env.ROLO_EXPECTED_RELEASE_LINE],
  ["rolo_revision", process.env.ROLO_EXPECTED_ROLO_REVISION],
  ["rolo_vis_revision", process.env.ROLO_EXPECTED_ROLO_VIS_REVISION],
  ["plugin_digest", process.env.ROLO_EXPECTED_PLUGIN_DIGEST],
  ["target_id", process.env.ROLO_EXPECTED_TARGET_ID],
  ["machine_id", process.env.ROLO_EXPECTED_MACHINE_ID],
  ["workspace_id", process.env.ROLO_EXPECTED_WORKSPACE_ID],
  ["host_key_fingerprint", process.env.ROLO_EXPECTED_HOST_KEY],
].filter(([, value]) => value));
assertDeploymentIdentityMatches(manifest, expected);
console.log(JSON.stringify({
  status: "PASSED",
  schema_version: manifest.schema_version,
  release_line: manifest.release_line,
  rolo_revision: manifest.rolo_revision,
  rolo_vis_revision: manifest.rolo_vis_revision,
  plugin_digest: manifest.plugin_digest,
  target_id: manifest.target_id,
  target_kind: manifest.target_kind,
  machine_id: manifest.machine_id,
  workspace_id: manifest.workspace_id,
  platform: manifest.platform,
  architecture: manifest.architecture,
  ros_domain: manifest.ros_domain,
  rmw: manifest.rmw,
  host_key_fingerprint: manifest.host_key_fingerprint,
  deployment_observed_at: manifest.deployment_observed_at,
  reads_only: true,
}, null, 2));
