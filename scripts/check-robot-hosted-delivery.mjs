import assert from "node:assert/strict";

const origin = (process.env.ROLO_ORIGIN || "http://127.0.0.1:8080").replace(/\/$/, "");
const robotId = process.env.ROLO_ROBOT_ID || "mentorpi";
const workbenchBase = `${origin}/workbench/`;
const apiBase = `${origin}/rolo-api`;

async function response(path, options) {
  const result = await fetch(`${origin}${path}`, options);
  assert.equal(result.status, 200, `${path} returned ${result.status}`);
  return result;
}

async function json(path, options) {
  return (await response(path, options)).json();
}

const index = await response("/workbench/");
const indexHtml = await index.text();
assert.equal(index.headers.get("cache-control"), "no-store");
assert.match(index.headers.get("content-security-policy") || "", /connect-src 'self'/);
assert.doesNotMatch(indexHtml, /https?:\/\//i);

const assetReferences = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((value) => !value.startsWith("data:"));
assert.ok(assetReferences.length > 0, "Workbench index exposes no local assets");
for (const relative of assetReferences) {
  const assetUrl = new URL(relative, workbenchBase);
  assert.equal(assetUrl.origin, origin);
  assert.ok(assetUrl.pathname.startsWith("/workbench/assets/"), `asset escaped package mount: ${assetUrl}`);
  assert.equal((await fetch(assetUrl)).status, 200);
}

const deepLink = await response("/workbench/review?robot=mentorpi");
assert.match(await deepLink.text(), /<div id="root"><\/div>/);
const forwarded = await response("/workbench/", {
  headers: {
    "x-forwarded-host": "robot.example",
    "x-forwarded-proto": "https",
  },
});
assert.doesNotMatch(forwarded.headers.get("location") || "", /robot\.example/);

const [health, legacyHealth, robots, overview, topology, wiki, discoveries, capabilities, evidence, episodes] =
  await Promise.all([
    json("/rolo-api/health"),
    json("/health"),
    json(`/rolo-api/v1/robots`),
    json(`/rolo-api/v1/robots/${encodeURIComponent(robotId)}/overview`),
    json(`/rolo-api/v1/robots/${encodeURIComponent(robotId)}/topology`),
    json(`/rolo-api/v1/robots/${encodeURIComponent(robotId)}/wiki`),
    json(`/rolo-api/v1/robots/${encodeURIComponent(robotId)}/discoveries`),
    json(`/rolo-api/v1/robots/${encodeURIComponent(robotId)}/capabilities?limit=100&offset=0`),
    json(`/rolo-api/v1/robots/${encodeURIComponent(robotId)}/evidence?limit=25&offset=0`),
    json(`/rolo-api/v1/robots/${encodeURIComponent(robotId)}/episodes?limit=1&offset=0`),
  ]);

assert.equal(health.status, "HEALTHY");
assert.equal(legacyHealth.status, health.status);
assert.ok(robots.some((robot) => robot.robot_id === robotId));
assert.equal(overview.robot_id, robotId);
assert.equal(topology.robot_id, robotId);
assert.equal(wiki.robot_id, robotId);
assert.equal(discoveries.robot_id, robotId);
assert.equal(capabilities.robot_id, robotId);
assert.equal(evidence.robot_id, robotId);
assert.equal(episodes.robot_id, robotId);
assert.ok(health.api_features.includes("workbench.episode-observation-bundle/v1"));
assert.ok(discoveries.items.length > 0);
assert.ok(discoveries.items.every((item) => item.integrity_status === "verified"));
assert.ok(discoveries.items.every((item) => item.limitations.length > 0));
assert.ok(wiki.limitations.length > 0);
assert.ok(capabilities.total > 0);
assert.ok(capabilities.items.every((item) => item.last_verified_at === null));
assert.ok(evidence.total > 0);

const publicPayload = JSON.stringify({ wiki, discoveries, capabilities, evidence });
for (const unsafe of ["artifact://", "C:\\\\Users\\\\", "/home/", "provider_identity", "raw_context"]) {
  assert.equal(publicPayload.includes(unsafe), false, `public payload leaked ${unsafe}`);
}

console.log(JSON.stringify({
  status: "passed",
  origin,
  robot_id: robotId,
  device_local_assets: assetReferences.length,
  same_origin_api: true,
  legacy_api_preserved: true,
  trusted_proxy_headers_do_not_expand_authority: true,
  discovery_snapshots: discoveries.total,
  discovery_limitations_visible: true,
  capabilities: capabilities.total,
  verified_capabilities_in_first_page: capabilities.items.filter((item) => item.last_verified_at).length,
  evidence_records: evidence.total,
  observation_bundle_feature: true,
  live_episode_count: episodes.total,
  source_data_mutated: false,
  requires_internet: false,
  supports_write: false,
}, null, 2));
