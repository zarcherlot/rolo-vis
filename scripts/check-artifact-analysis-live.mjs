import { parseArtifactAnalysisSummary } from "../src/contracts/artifactAnalysis.ts";

const baseUrl = (process.env.ROLO_API_BASE || "http://127.0.0.1:8765").replace(/\/$/, "");
const targetId = process.env.ROLO_ARTIFACT_TARGET_ID || "ready-local";
const jobId = process.env.ROLO_ARTIFACT_JOB_ID || "";
const apiToken = process.env.ROLO_API_TOKEN?.trim();
const headers = { Accept: "application/json", ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}) };

async function read(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

const health = await read("/health");
const feature = "workbench.artifact-analysis-read-model/v1";
if (!(health.api_features || []).includes(feature)) throw new Error(`missing negotiated feature: ${feature}`);

const targetPath = `/v1/targets/${encodeURIComponent(targetId)}/artifact-analysis`;
const target = await read(targetPath);
const targetSummary = parseArtifactAnalysisSummary(target, targetPath);
if (targetSummary.source_kind !== "rolo_api") throw new Error("producer source_kind is not rolo_api");
if (targetSummary.contains_secret_payloads || targetSummary.target_id !== targetId) throw new Error("producer target binding failed");

let jobSummary = null;
if (jobId) {
  const jobPath = `/v1/jobs/${encodeURIComponent(jobId)}/artifact-analysis`;
  jobSummary = parseArtifactAnalysisSummary(await read(jobPath), jobPath);
  if (jobSummary.source_kind !== "rolo_api" || jobSummary.contains_secret_payloads || jobSummary.job_id !== jobId) throw new Error("producer job binding failed");
  if (targetSummary.analysis_id !== jobSummary.analysis_id) throw new Error("target and job projections diverged");
}

console.log(JSON.stringify({ baseUrl, feature, target: targetId, job: jobId || null, analysisId: targetSummary.analysis_id, schema: targetSummary.schema_version, sourceKind: targetSummary.source_kind }, null, 2));
