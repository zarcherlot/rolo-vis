import { containsUnsafeReference, isRecord, isTimestamp, requireContract, RoloContractError } from "./contracts/guards.ts";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const REVISION = /^[0-9a-f]{40,64}$/i;
const DIGEST = /^sha256:[0-9a-f]{64}$/i;

export interface DeploymentIdentityManifest {
  schema_version: "rolo-vis-deployment-identity/v1";
  release_line: string;
  rolo_revision: string;
  rolo_vis_revision: string;
  plugin_digest: string;
  target_id: string;
  target_kind: "local" | "ssh";
  machine_id: string;
  workspace_id: string;
  platform: string;
  architecture: string;
  ros_domain: string;
  rmw: string;
  host_key_fingerprint: string;
  deployment_observed_at: string;
}

function bounded(value: unknown, path: string, max = 128): string {
  requireContract(typeof value === "string" && value.length > 0 && value.length <= max, "deployment identity text is invalid", path);
  return value;
}

function safeId(value: unknown, path: string): string {
  const result = bounded(value, path);
  requireContract(SAFE_ID.test(result), "deployment identity contains an unsafe identifier", path);
  return result;
}

export function parseDeploymentIdentityManifest(value: unknown, path = "deployment_identity"): DeploymentIdentityManifest {
  requireContract(isRecord(value), "deployment identity must be an object", path);
  requireContract(value.schema_version === "rolo-vis-deployment-identity/v1", "unsupported deployment identity schema", path);
  requireContract(!containsUnsafeReference(value), "deployment identity contains an unsafe reference", path);
  const release_line = bounded(value.release_line, `${path}/release_line`, 32);
  const rolo_revision = bounded(value.rolo_revision, `${path}/rolo_revision`, 64);
  const rolo_vis_revision = bounded(value.rolo_vis_revision, `${path}/rolo_vis_revision`, 64);
  requireContract(REVISION.test(rolo_revision), "rolo revision is invalid", `${path}/rolo_revision`);
  requireContract(REVISION.test(rolo_vis_revision), "rolo-vis revision is invalid", `${path}/rolo_vis_revision`);
  const plugin_digest = bounded(value.plugin_digest, `${path}/plugin_digest`, 80);
  requireContract(DIGEST.test(plugin_digest), "plugin digest is invalid", `${path}/plugin_digest`);
  requireContract(value.target_kind === "local" || value.target_kind === "ssh", "target kind is invalid", `${path}/target_kind`);
  const deployment_observed_at = bounded(value.deployment_observed_at, `${path}/deployment_observed_at`, 64);
  requireContract(isTimestamp(deployment_observed_at), "deployment timestamp is invalid", `${path}/deployment_observed_at`);
  const hostKey = bounded(value.host_key_fingerprint, `${path}/host_key_fingerprint`, 128);
  requireContract(/^SHA256:[A-Za-z0-9+/=._:-]{8,120}$/.test(hostKey), "host-key fingerprint is invalid", `${path}/host_key_fingerprint`);
  return {
    schema_version: "rolo-vis-deployment-identity/v1",
    release_line,
    rolo_revision,
    rolo_vis_revision,
    plugin_digest,
    target_id: safeId(value.target_id, `${path}/target_id`),
    target_kind: value.target_kind,
    machine_id: safeId(value.machine_id, `${path}/machine_id`),
    workspace_id: safeId(value.workspace_id, `${path}/workspace_id`),
    platform: bounded(value.platform, `${path}/platform`, 64),
    architecture: bounded(value.architecture, `${path}/architecture`, 64),
    ros_domain: bounded(value.ros_domain, `${path}/ros_domain`, 64),
    rmw: bounded(value.rmw, `${path}/rmw`, 64),
    host_key_fingerprint: hostKey,
    deployment_observed_at,
  };
}

export function assertDeploymentIdentityMatches(
  manifest: DeploymentIdentityManifest,
  expected: Partial<Pick<DeploymentIdentityManifest, "release_line" | "rolo_revision" | "rolo_vis_revision" | "plugin_digest" | "target_id" | "machine_id" | "workspace_id" | "host_key_fingerprint">>,
): void {
  for (const key of ["release_line", "rolo_revision", "rolo_vis_revision", "plugin_digest", "target_id", "machine_id", "workspace_id", "host_key_fingerprint"] as const) {
    if (expected[key] !== undefined && manifest[key] !== expected[key]) {
      throw new RoloContractError(`deployment identity mismatch for ${key}`, `deployment_identity/${key}`);
    }
  }
}
