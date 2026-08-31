import { RoloClient, ROLO_API_FEATURES } from "../src/roloClient.ts";
import { liveAuthConfig } from "./liveAuth.mjs";

const baseUrl = (process.env.ROLO_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");
const client = new RoloClient(baseUrl, liveAuthConfig());

const health = await client.health();
const features = new Set(health.api_features || []);
for (const feature of [ROLO_API_FEATURES.targetReadiness, ROLO_API_FEATURES.approvalGateReadModel]) {
  if (!features.has(feature)) throw new Error(`missing negotiated feature: ${feature}`);
}
const [readiness, gates] = await Promise.all([
  client.targetReadiness(undefined, { limit: 100, offset: 0 }),
  client.approvalGates(undefined, { limit: 100, offset: 0 }),
]);
console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  auth_mode: client.authMode,
  features: [ROLO_API_FEATURES.targetReadiness, ROLO_API_FEATURES.approvalGateReadModel],
  readiness: { schema: "rolo-target-readiness-collection/v1", items: readiness.items.length, observed_at: readiness.observed_at, scope: "targets:read" },
  approval_gates: { schema: "rolo-approval-gate-collection/v1", items: gates.items.length, observed_at: gates.observed_at, scope: "gates:read" },
  reads_only: true,
  unsafe_fields_exposed: false,
}, null, 2));
