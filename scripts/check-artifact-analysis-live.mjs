import { RoloClient, ROLO_API_FEATURES } from "../src/roloClient.ts";
import { liveAuthConfig } from "./liveAuth.mjs";

const baseUrl = (process.env.ROLO_API_BASE || "http://127.0.0.1:8765").replace(/\/$/, "");
const targetId = process.env.ROLO_ARTIFACT_TARGET_ID || "ready-local";
const jobId = process.env.ROLO_ARTIFACT_JOB_ID || "";
const client = new RoloClient(baseUrl, liveAuthConfig());

const health = await client.health();
const feature = ROLO_API_FEATURES.artifactAnalysisReadModel;
if (!(health.api_features || []).includes(feature)) throw new Error(`missing negotiated feature: ${feature}`);

const targetSummary = await client.targetArtifactAnalysis(targetId);
if (targetSummary.source_kind !== "rolo_api") throw new Error("producer source_kind is not rolo_api");
if (targetSummary.contains_secret_payloads || targetSummary.target_id !== targetId) throw new Error("producer target binding failed");

let jobSummary = null;
if (jobId) {
  jobSummary = await client.jobArtifactAnalysis(jobId);
  if (jobSummary.source_kind !== "rolo_api" || jobSummary.contains_secret_payloads || jobSummary.job_id !== jobId) throw new Error("producer job binding failed");
  if (targetSummary.analysis_id !== jobSummary.analysis_id) throw new Error("target and job projections diverged");
}

console.log(JSON.stringify({ baseUrl, feature, target: targetId, job: jobId || null, analysisId: targetSummary.analysis_id, schema: targetSummary.schema_version, sourceKind: targetSummary.source_kind, auth_mode: client.authMode, scope: "artifact-analysis:read", observed_at: targetSummary.observed_at, reads_only: true, unsafe_fields_exposed: false }, null, 2));
