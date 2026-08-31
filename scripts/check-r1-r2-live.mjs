const baseUrl = (process.env.ROLO_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

async function read(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

const health = await read("/health");
const features = new Set(health.api_features || []);
for (const feature of ["workbench.target-readiness/v1", "workbench.approval-gate-read-model/v1"]) {
  if (!features.has(feature)) throw new Error(`missing negotiated feature: ${feature}`);
}
const [readiness, gates] = await Promise.all([read("/v1/targets/readiness?limit=100&offset=0"), read("/v1/approval-gates?limit=100&offset=0")]);
if (readiness.schema_version !== "rolo-target-readiness-collection/v1") throw new Error("R1 collection schema mismatch");
if (gates.schema_version !== "rolo-approval-gate-collection/v1") throw new Error("R2 collection schema mismatch");
if (readiness.contains_secret_payloads === true || gates.contains_secret_payloads === true) throw new Error("producer returned secret-bearing payloads");
console.log(JSON.stringify({ baseUrl, features: [...features].filter((feature) => feature.includes("target-readiness") || feature.includes("approval-gate")), readiness: readiness.items?.length ?? 0, approvalGates: gates.items?.length ?? 0 }, null, 2));
