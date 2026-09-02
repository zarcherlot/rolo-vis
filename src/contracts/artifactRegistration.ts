import {
  containsUnsafeReference,
  isRecord,
  isStringArray,
  isTimestamp,
  requireContract,
} from "./guards.ts";
import type { ArtifactAnalysisSummary } from "./artifactAnalysis.ts";

export interface ArtifactRegistrationRequest {
  schema_version: "rolo-artifact-registration-request/v1";
  kind: "analysis_summary";
  idempotency_key: string;
  target_id: string;
  summary: ArtifactAnalysisSummary;
}

export interface ArtifactRegistrationReceipt {
  schema_version: "rolo-artifact-registration-receipt/v1";
  registration_id: string;
  idempotency_key: string;
  kind: "analysis_summary";
  target_id: string;
  job_id: string | null;
  status: "REGISTERED" | "REPLAYED";
  producer_revision: string;
  registered_at: string;
  limitations: string[];
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_KEY = /^[a-z][a-z0-9._-]{0,127}$/;

function safeId(value: unknown, path: string): string {
  requireContract(typeof value === "string" && SAFE_ID.test(value), "registration identity is invalid", path);
  return value;
}

/** Parse the receipt returned by the authenticated, idempotent registration endpoint. */
export function parseArtifactRegistrationReceipt(
  value: unknown,
  path = "artifact_registration",
): ArtifactRegistrationReceipt {
  requireContract(isRecord(value), "artifact registration receipt must be an object", path);
  requireContract(value.schema_version === "rolo-artifact-registration-receipt/v1", "unsupported artifact registration schema", path);
  requireContract(value.kind === "analysis_summary", "unsupported artifact registration kind", path);
  requireContract(value.status === "REGISTERED" || value.status === "REPLAYED", "invalid artifact registration status", path);
  requireContract(isTimestamp(value.registered_at), "artifact registration timestamp is invalid", path);
  requireContract(/^[0-9a-f]{64}$/.test(String(value.producer_revision)), "artifact registration producer revision is invalid", path);
  requireContract(isStringArray(value.limitations) && value.limitations.length <= 8 && value.limitations.every((item) => item.length <= 400), "artifact registration limitations are invalid", path);
  requireContract(!containsUnsafeReference(value), "artifact registration receipt contains an unsafe reference", path);
  requireContract(typeof value.idempotency_key === "string" && SAFE_KEY.test(value.idempotency_key), "artifact registration idempotency key is invalid", path);
  return {
    schema_version: "rolo-artifact-registration-receipt/v1",
    registration_id: safeId(value.registration_id, `${path}/registration_id`),
    idempotency_key: value.idempotency_key,
    kind: "analysis_summary",
    target_id: safeId(value.target_id, `${path}/target_id`),
    job_id: value.job_id === null ? null : safeId(value.job_id, `${path}/job_id`),
    status: value.status,
    producer_revision: value.producer_revision as string,
    registered_at: value.registered_at,
    limitations: value.limitations,
  };
}
