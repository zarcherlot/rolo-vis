export type DeploymentPermission = "target:write" | "approval:write";
export type WorkbenchPage = "fleet" | "target" | "job" | "approval" | "blocker";

export type DeploymentSession = {
  schema_version: "rolo-deployment-api-session/v1";
  principal: string;
  permissions: DeploymentPermission[];
  authentication: "bearer";
  token_persistence: "client-memory-only";
};

export type WorkbenchField = { name: string; value: string };
export type WorkbenchRow = {
  kind: "TARGET" | "JOB" | "APPROVAL" | "BLOCKER";
  identity: string;
  status: string;
  summary: string;
  fields: WorkbenchField[];
  canonical_cli: string | null;
};
export type WorkbenchSnapshot = {
  schema_version: "rolo-target-deployment-workbench-snapshot/v1";
  page: WorkbenchPage;
  title: string;
  captured_at: string;
  rows: WorkbenchRow[];
};

export type TargetRegistrationInput = {
  target: Record<string, unknown>;
  connection: Record<string, unknown> | null;
};

export type TargetRuntimeRollbackInput = {
  package_id: string;
  expected_current_manifest_sha256: string;
  expected_previous_manifest_sha256: string;
  approver_principal: string;
  approval_ttl_s: number;
  timeout_s: number;
};

export type TargetHostProvisioningInput = {
  bootstrap_public_key: string;
  runtime_public_key: string;
  approver_principal: string;
  approval_ttl_s: number;
  expected_current_plan_sha256?: string;
};

export type TargetEvidenceApprovalInput = {
  approver_principal: string;
  approval_ttl_s: number;
  timeout_s: number;
};

export type TargetAdaptInput = {
  active_probe: "none" | "help" | "runtime-readonly";
  run_adapter_agent: false;
  timeout_s: number;
  project_evidence_job_id?: string;
  project_evidence_max_age_s?: number;
  source_discovery_job_id?: string;
  source_discovery_max_age_s?: number;
  runtime_evidence_job_id?: string;
  runtime_evidence_max_age_s?: number;
};

export type ActionReceipt = {
  status: string;
  targetId?: string;
  jobId?: string;
  approvalId?: string;
  commandSha256?: string;
  packageRef?: string;
  packageId?: string;
  manifestSha256?: string;
  planSha256?: string;
  expectedCurrentManifestSha256?: string;
  expectedPreviousManifestSha256?: string;
};

export type SessionAgentReceipt = {
  sequence: number;
  action: string;
  status: string;
  summary: string;
  target_id: string | null;
  job_id: string | null;
  approval_id: string | null;
  command_sha256: string;
  deployment_command_sha256: string | null;
  canonical_cli: string | null;
};

export type SessionAgentTurnResult = {
  schema_version: "rolo-session-agent-turn-result/v2";
  session_id: string;
  status: "COMPLETED" | "NEEDS_CLARIFICATION" | "APPROVAL_REQUIRED" | "BLOCKED" | "FAILED" | "ACTION_BUDGET_EXHAUSTED" | "CANCELLED";
  response: string;
  catalog_sha256: string;
  receipts: SessionAgentReceipt[];
  provider_calls: number;
  provider_error_code: string | null;
};

export type SessionAgentReadinessGate = {
  gate_id: string;
  status: "PASSED" | "BLOCKED" | "NOT_VERIFIED";
  evidence_kind: "CONFIGURATION" | "COMMAND_CONTRACT" | "EXTERNAL_ACCEPTANCE_REQUIRED";
  summary: string;
  evidence_sha256: string | null;
};

export type SessionAgentProductionReadiness = {
  schema_version: "rolo-session-agent-production-readiness/v1";
  generated_at: string;
  host_class: "LINUX_X86_64" | "LINUX_ARM64" | "WINDOWS_X86_64" | "OTHER";
  catalog_sha256: string;
  provider_configuration_sha256: string;
  gates: SessionAgentReadinessGate[];
  production_ready: boolean;
};

type FetchLike = typeof fetch;
const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const JOB = /^deployment-[0-9a-f]{32}$/;
const APPROVAL = /^approval-[0-9a-f]{32}$/;
const PRINCIPAL = /^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,127}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const ED25519_PUBLIC_KEY = /^ssh-ed25519 [A-Za-z0-9+/]{43}=$/;
const FORBIDDEN_RESPONSE_KEYS = ["package_root", "public_key_base64", "private_key", "password", "bearer ", "raw_target_output", "target_output", "credential_ref"];
const AGENT_ACTIONS = new Set(["LIST_TARGETS", "SHOW_TARGET", "ASSESS_CONNECTION", "SUBMIT_PROJECT_EVIDENCE", "SUBMIT_SOURCE_DISCOVERY", "SUBMIT_RUNTIME_EVIDENCE", "SUBMIT_BOOTSTRAP", "SUBMIT_RUNTIME_ROLLBACK", "SUBMIT_ADAPT", "GET_JOB", "RUN_JOB", "CANCEL_JOB", "SHOW_APPROVAL", "LIST_BLOCKERS"]);
const AGENT_STATUSES = new Set(["COMPLETED", "NEEDS_CLARIFICATION", "APPROVAL_REQUIRED", "BLOCKED", "FAILED", "ACTION_BUDGET_EXHAUSTED", "CANCELLED"]);
const READINESS_GATE_IDS = new Set(["FEATURE_ENABLED", "DEDICATED_PROVIDER_CREDENTIAL", "HTTPS_PROVIDER", "CODEX_EXECUTABLE", "CODEX_CONTAINMENT_CONTRACT", "DEDICATED_OS_ISOLATION", "REAL_PROVIDER_ACCEPTANCE", "REAL_SSH_PROMPT_INJECTION", "MULTI_WORKER_FAILURE_INJECTION", "LINUX_X86_64_ACCEPTANCE", "LINUX_ARM64_ACCEPTANCE"]);
const READINESS_STATUSES = new Set(["PASSED", "BLOCKED", "NOT_VERIFIED"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertPublicResponse(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const forbidden of FORBIDDEN_RESPONSE_KEYS) {
    requireValue(!serialized.includes(forbidden), "Controller returned a secret-bearing deployment response");
  }
}

function parseSession(value: unknown): DeploymentSession {
  requireValue(isRecord(value), "Deployment session response must be an object");
  requireValue(value.schema_version === "rolo-deployment-api-session/v1", "Unsupported deployment session contract");
  requireValue(typeof value.principal === "string" && PRINCIPAL.test(value.principal), "Invalid deployment principal");
  requireValue(Array.isArray(value.permissions) && value.permissions.every((item) => item === "target:write" || item === "approval:write"), "Invalid deployment permissions");
  requireValue(value.authentication === "bearer" && value.token_persistence === "client-memory-only", "Unsafe deployment authentication contract");
  return value as DeploymentSession;
}

function parseWorkbench(value: unknown, expectedPage: WorkbenchPage): WorkbenchSnapshot {
  requireValue(isRecord(value), "Deployment workbench response must be an object");
  requireValue(value.schema_version === "rolo-target-deployment-workbench-snapshot/v1", "Unsupported deployment workbench contract");
  requireValue(value.page === expectedPage && typeof value.title === "string", "Deployment workbench page mismatch");
  requireValue(Array.isArray(value.rows) && value.rows.length <= 1000, "Invalid deployment workbench rows");
  for (const row of value.rows) {
    requireValue(isRecord(row), "Invalid deployment workbench row");
    requireValue(typeof row.identity === "string" && typeof row.status === "string" && typeof row.summary === "string", "Invalid deployment row state");
    requireValue(["TARGET", "JOB", "APPROVAL", "BLOCKER"].includes(String(row.kind)), "Invalid deployment row kind");
    requireValue(Array.isArray(row.fields), "Invalid deployment row fields");
  }
  assertPublicResponse(value);
  return value as WorkbenchSnapshot;
}

function extractReceipt(value: unknown): ActionReceipt {
  requireValue(isRecord(value), "Deployment action response must be an object");
  assertPublicResponse(value);
  const jobRecord = isRecord(value.job) ? value.job : null;
  const job = jobRecord && isRecord(jobRecord.job) ? jobRecord.job : jobRecord;
  const command = job && isRecord(job.command) ? job.command : null;
  const approval = isRecord(value.approval) ? value.approval : null;
  return {
    status: typeof value.status === "string" ? value.status : job && typeof job.state === "string" ? job.state : "ACCEPTED",
    targetId: typeof value.target_id === "string" ? value.target_id : command && typeof command.target_id === "string" ? command.target_id : undefined,
    jobId: job && typeof job.job_id === "string" ? job.job_id : undefined,
    approvalId: approval && typeof approval.approval_id === "string" ? approval.approval_id : typeof value.approval_id === "string" ? value.approval_id : undefined,
    commandSha256: job && typeof job.command_sha256 === "string" ? job.command_sha256 : undefined,
    packageRef: typeof value.package_ref === "string" ? value.package_ref : undefined,
    packageId: typeof value.package_id === "string" ? value.package_id : undefined,
    manifestSha256: typeof value.manifest_sha256 === "string" ? value.manifest_sha256 : undefined,
    planSha256: typeof value.plan_sha256 === "string" ? value.plan_sha256 : undefined,
    expectedCurrentManifestSha256: typeof value.expected_current_manifest_sha256 === "string" ? value.expected_current_manifest_sha256 : undefined,
    expectedPreviousManifestSha256: typeof value.expected_previous_manifest_sha256 === "string" ? value.expected_previous_manifest_sha256 : undefined,
  };
}

function parseSessionAgentTurn(value: unknown): SessionAgentTurnResult {
  requireValue(isRecord(value), "Session Agent response must be an object");
  requireValue(value.schema_version === "rolo-session-agent-turn-result/v2", "Unsupported Session Agent result contract");
  requireValue(typeof value.session_id === "string" && /^agent-session-[0-9a-f]{32}$/.test(value.session_id), "Invalid Session Agent session ID");
  requireValue(typeof value.response === "string" && value.response.length > 0, "Invalid Session Agent response");
  requireValue(typeof value.catalog_sha256 === "string" && /^[0-9a-f]{64}$/.test(value.catalog_sha256), "Invalid Session Agent catalog digest");
  requireValue(typeof value.status === "string" && AGENT_STATUSES.has(value.status), "Invalid Session Agent status");
  requireValue(Array.isArray(value.receipts) && value.receipts.length <= 8, "Invalid Session Agent receipts");
  requireValue(typeof value.provider_calls === "number" && value.provider_calls >= 0 && value.provider_calls <= 9, "Invalid Session Agent provider count");
  for (const receipt of value.receipts) {
    requireValue(isRecord(receipt), "Invalid Session Agent receipt");
    requireValue(typeof receipt.sequence === "number" && typeof receipt.action === "string" && AGENT_ACTIONS.has(receipt.action) && typeof receipt.status === "string", "Invalid Session Agent receipt state");
    requireValue(typeof receipt.summary === "string" && typeof receipt.command_sha256 === "string", "Invalid Session Agent receipt digest");
  }
  assertPublicResponse(value);
  return value as SessionAgentTurnResult;
}

function parseSessionAgentReadiness(value: unknown): SessionAgentProductionReadiness {
  requireValue(isRecord(value), "Session Agent readiness response must be an object");
  requireValue(value.schema_version === "rolo-session-agent-production-readiness/v1", "Unsupported Session Agent readiness contract");
  requireValue(typeof value.generated_at === "string" && !Number.isNaN(Date.parse(value.generated_at)), "Invalid readiness timestamp");
  requireValue(["LINUX_X86_64", "LINUX_ARM64", "WINDOWS_X86_64", "OTHER"].includes(String(value.host_class)), "Invalid readiness host class");
  requireValue(typeof value.catalog_sha256 === "string" && /^[0-9a-f]{64}$/.test(value.catalog_sha256), "Invalid readiness catalog digest");
  requireValue(typeof value.provider_configuration_sha256 === "string" && /^[0-9a-f]{64}$/.test(value.provider_configuration_sha256), "Invalid readiness configuration digest");
  requireValue(Array.isArray(value.gates) && value.gates.length === READINESS_GATE_IDS.size, "Invalid readiness gate coverage");
  const observed = new Set<string>();
  for (const gate of value.gates) {
    requireValue(isRecord(gate) && typeof gate.gate_id === "string" && READINESS_GATE_IDS.has(gate.gate_id), "Invalid readiness gate ID");
    requireValue(!observed.has(gate.gate_id), "Duplicate readiness gate");
    observed.add(gate.gate_id);
    requireValue(typeof gate.status === "string" && READINESS_STATUSES.has(gate.status), "Invalid readiness gate status");
    requireValue(["CONFIGURATION", "COMMAND_CONTRACT", "EXTERNAL_ACCEPTANCE_REQUIRED"].includes(String(gate.evidence_kind)), "Invalid readiness evidence kind");
    requireValue(typeof gate.summary === "string" && gate.summary.length > 0, "Invalid readiness gate summary");
    requireValue(gate.evidence_sha256 === null || (typeof gate.evidence_sha256 === "string" && /^[0-9a-f]{64}$/.test(gate.evidence_sha256)), "Invalid readiness evidence digest");
    if (gate.evidence_kind === "EXTERNAL_ACCEPTANCE_REQUIRED") {
      requireValue(gate.status === "NOT_VERIFIED" && gate.evidence_sha256 === null, "External readiness gate was self-attested");
    }
  }
  requireValue([...READINESS_GATE_IDS].every((gateId) => observed.has(gateId)), "Incomplete readiness gate coverage");
  requireValue(typeof value.production_ready === "boolean", "Invalid production readiness state");
  requireValue(value.production_ready === value.gates.every((gate) => isRecord(gate) && gate.status === "PASSED"), "Contradictory production readiness state");
  assertPublicResponse(value);
  return value as SessionAgentProductionReadiness;
}

export function createIdempotencyKey(action: string, randomId = crypto.randomUUID()): string {
  requireValue(/^[a-z][a-z0-9-]{1,31}$/.test(action), "Invalid idempotency action");
  return `gui:${action}:${randomId.replaceAll("-", "")}`;
}

export class DeploymentControlClient {
  readonly base: string;
  readonly principal: string;
  private token: string;
  private readonly fetcher: FetchLike;

  constructor(
    base: string,
    principal: string,
    token: string,
    fetcher: FetchLike = globalThis.fetch.bind(globalThis),
  ) {
    requireValue(PRINCIPAL.test(principal), "Principal is not canonical");
    requireValue(token.length >= 16 && !/[\0\r\n]/.test(token), "Bearer token is invalid");
    this.base = base.replace(/\/$/, "");
    this.principal = principal;
    this.token = token;
    this.fetcher = fetcher;
  }

  dispose(): void {
    this.token = "";
  }

  private async request(path: string, init: RequestInit = {}, permission?: DeploymentPermission, idempotencyKey?: string): Promise<unknown> {
    requireValue(this.token.length > 0, "Deployment session has been disconnected");
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${this.token}`);
    headers.set("X-Rolo-Principal", this.principal);
    if (permission) headers.set("X-Rolo-Permissions", permission);
    if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await this.fetcher(`${this.base}${path}`, { ...init, headers, cache: "no-store", credentials: "omit" });
    const value = await response.json().catch(() => ({ detail: "Controller returned non-JSON data" }));
    if (!response.ok) {
      const detail = isRecord(value) && typeof value.detail === "string" ? value.detail : `HTTP ${response.status}`;
      throw new Error(detail);
    }
    return value;
  }

  async session(): Promise<DeploymentSession> {
    return parseSession(await this.request("/v1/deployment-session"));
  }

  async sessionAgentReadiness(): Promise<SessionAgentProductionReadiness> {
    return parseSessionAgentReadiness(await this.request("/v1/session-agent/readiness"));
  }

  async workbench(page: WorkbenchPage, identity?: string): Promise<WorkbenchSnapshot> {
    const query = new URLSearchParams({ page, limit: "100" });
    if (page === "target" && identity) query.set("target_id", identity);
    if (page === "job" && identity) query.set("job_id", identity);
    if (page === "approval" && identity) query.set("approval_id", identity);
    return parseWorkbench(await this.request(`/v1/deployment-workbench?${query}`), page);
  }

  async registerTarget(input: TargetRegistrationInput, idempotencyKey: string): Promise<ActionReceipt> {
    const value = await this.request("/v1/targets", { method: "POST", body: JSON.stringify(input) }, "target:write", idempotencyKey);
    requireValue(isRecord(value) && typeof value.target_id === "string", "Invalid target registration receipt");
    return { status: String(value.status || "CREATED"), targetId: value.target_id };
  }

  async assessConnection(targetId: string, activeProbe: "none" | "help" | "runtime-readonly", idempotencyKey: string): Promise<ActionReceipt> {
    requireValue(ID.test(targetId), "Invalid target ID");
    return extractReceipt(await this.request(`/v1/targets/${encodeURIComponent(targetId)}/connection-assessments`, { method: "POST", body: JSON.stringify({ active_probe: activeProbe }) }, "target:write", idempotencyKey));
  }

  async submitProjectEvidence(targetId: string, input: TargetEvidenceApprovalInput, idempotencyKey: string): Promise<ActionReceipt> {
    requireValue(ID.test(targetId), "Invalid target ID");
    requireValue(PRINCIPAL.test(input.approver_principal), "Invalid evidence approver");
    requireValue(Number.isInteger(input.approval_ttl_s) && input.approval_ttl_s >= 60 && input.approval_ttl_s <= 86_400, "Invalid evidence approval TTL");
    requireValue(Number.isFinite(input.timeout_s) && input.timeout_s >= 1 && input.timeout_s <= 300, "Invalid evidence timeout");
    return extractReceipt(await this.request(
      `/v1/targets/${encodeURIComponent(targetId)}/project-evidence-jobs`,
      { method: "POST", body: JSON.stringify(input) },
      "target:write",
      idempotencyKey,
    ));
  }

  async submitSourceDiscovery(targetId: string, input: TargetEvidenceApprovalInput, idempotencyKey: string): Promise<ActionReceipt> {
    requireValue(ID.test(targetId), "Invalid target ID");
    requireValue(PRINCIPAL.test(input.approver_principal), "Invalid source-analysis approver");
    requireValue(Number.isInteger(input.approval_ttl_s) && input.approval_ttl_s >= 60 && input.approval_ttl_s <= 86_400, "Invalid source-analysis approval TTL");
    requireValue(Number.isFinite(input.timeout_s) && input.timeout_s >= 1 && input.timeout_s <= 300, "Invalid source-analysis timeout");
    return extractReceipt(await this.request(
      `/v1/targets/${encodeURIComponent(targetId)}/source-discovery-jobs`,
      { method: "POST", body: JSON.stringify({ scan_roots: ["."], ...input }) },
      "target:write",
      idempotencyKey,
    ));
  }

  async submitRuntimeEvidence(targetId: string, input: TargetEvidenceApprovalInput, idempotencyKey: string): Promise<ActionReceipt> {
    requireValue(ID.test(targetId), "Invalid target ID");
    requireValue(PRINCIPAL.test(input.approver_principal), "Invalid runtime-evidence approver");
    requireValue(Number.isInteger(input.approval_ttl_s) && input.approval_ttl_s >= 60 && input.approval_ttl_s <= 300, "Runtime-evidence approval TTL must be 60–300 seconds");
    requireValue(Number.isFinite(input.timeout_s) && input.timeout_s >= 1 && input.timeout_s <= 300, "Invalid runtime-evidence timeout");
    return extractReceipt(await this.request(
      `/v1/targets/${encodeURIComponent(targetId)}/runtime-evidence-jobs`,
      { method: "POST", body: JSON.stringify(input) },
      "target:write",
      idempotencyKey,
    ));
  }

  async submitAdapt(targetId: string, input: TargetAdaptInput, idempotencyKey: string): Promise<ActionReceipt> {
    requireValue(ID.test(targetId), "Invalid target ID");
    requireValue(["none", "help", "runtime-readonly"].includes(input.active_probe), "Invalid Adapt probe");
    requireValue(input.run_adapter_agent === false, "GUI may only submit discovery-only Adapt");
    requireValue(Number.isInteger(input.timeout_s) && input.timeout_s >= 1 && input.timeout_s <= 86_400, "Invalid Adapt timeout");
    if (input.project_evidence_job_id !== undefined) requireValue(JOB.test(input.project_evidence_job_id), "Invalid project-evidence Job ID");
    if (input.source_discovery_job_id !== undefined) requireValue(JOB.test(input.source_discovery_job_id), "Invalid source-discovery Job ID");
    if (input.runtime_evidence_job_id !== undefined) requireValue(JOB.test(input.runtime_evidence_job_id), "Invalid runtime-evidence Job ID");
    requireValue(input.source_discovery_job_id === undefined || input.project_evidence_job_id !== undefined, "Source discovery requires project evidence");
    for (const age of [input.project_evidence_max_age_s, input.source_discovery_max_age_s]) {
      if (age !== undefined) requireValue(Number.isInteger(age) && age >= 60 && age <= 86_400, "Invalid evidence freshness");
    }
    if (input.runtime_evidence_max_age_s !== undefined) requireValue(Number.isInteger(input.runtime_evidence_max_age_s) && input.runtime_evidence_max_age_s >= 60 && input.runtime_evidence_max_age_s <= 300, "Invalid runtime-evidence freshness");
    requireValue(input.active_probe === "runtime-readonly" || input.runtime_evidence_job_id === undefined, "Runtime evidence requires runtime-readonly Adapt");
    return extractReceipt(await this.request(
      `/v1/targets/${encodeURIComponent(targetId)}/adapt-jobs`,
      { method: "POST", body: JSON.stringify(input) },
      "target:write",
      idempotencyKey,
    ));
  }

  async submitBootstrap(targetId: string, input: Record<string, unknown>, idempotencyKey: string): Promise<ActionReceipt> {
    requireValue(ID.test(targetId), "Invalid target ID");
    return extractReceipt(await this.request(`/v1/targets/${encodeURIComponent(targetId)}/bootstrap-jobs`, { method: "POST", body: JSON.stringify(input) }, "target:write", idempotencyKey));
  }

  async submitHostProvisioning(targetId: string, input: TargetHostProvisioningInput, idempotencyKey: string): Promise<ActionReceipt> {
    requireValue(ID.test(targetId), "Invalid target ID");
    requireValue(ED25519_PUBLIC_KEY.test(input.bootstrap_public_key), "Invalid bootstrap Ed25519 public key");
    requireValue(ED25519_PUBLIC_KEY.test(input.runtime_public_key), "Invalid runtime Ed25519 public key");
    requireValue(input.bootstrap_public_key !== input.runtime_public_key, "Bootstrap and runtime public keys must differ");
    requireValue(PRINCIPAL.test(input.approver_principal), "Invalid host provisioning approver");
    requireValue(Number.isInteger(input.approval_ttl_s) && input.approval_ttl_s >= 60 && input.approval_ttl_s <= 86_400, "Invalid host provisioning approval TTL");
    if (input.expected_current_plan_sha256 !== undefined) {
      requireValue(SHA256.test(input.expected_current_plan_sha256), "Invalid current host plan digest");
    }
    return extractReceipt(await this.request(
      `/v1/targets/${encodeURIComponent(targetId)}/host-provisioning-jobs`,
      { method: "POST", body: JSON.stringify(input) },
      "target:write",
      idempotencyKey,
    ));
  }

  async submitRuntimeRollback(targetId: string, input: TargetRuntimeRollbackInput, idempotencyKey: string): Promise<ActionReceipt> {
    requireValue(ID.test(targetId), "Invalid target ID");
    requireValue(ID.test(input.package_id), "Invalid previous package ID");
    requireValue(SHA256.test(input.expected_current_manifest_sha256), "Invalid current manifest digest");
    requireValue(SHA256.test(input.expected_previous_manifest_sha256), "Invalid previous manifest digest");
    requireValue(input.expected_current_manifest_sha256 !== input.expected_previous_manifest_sha256, "Rollback digests must differ");
    requireValue(PRINCIPAL.test(input.approver_principal), "Invalid rollback approver");
    requireValue(Number.isInteger(input.approval_ttl_s) && input.approval_ttl_s >= 60 && input.approval_ttl_s <= 86_400, "Invalid rollback approval TTL");
    requireValue(Number.isFinite(input.timeout_s) && input.timeout_s >= 10 && input.timeout_s <= 1800, "Invalid rollback timeout");
    return extractReceipt(await this.request(
      `/v1/targets/${encodeURIComponent(targetId)}/runtime-rollback-jobs`,
      { method: "POST", body: JSON.stringify(input) },
      "target:write",
      idempotencyKey,
    ));
  }

  async runJob(jobId: string, idempotencyKey: string): Promise<ActionReceipt> {
    requireValue(JOB.test(jobId), "Invalid Job ID");
    return extractReceipt(await this.request(`/v1/jobs/${jobId}/run`, { method: "POST" }, "target:write", idempotencyKey));
  }

  async cancelJob(jobId: string, idempotencyKey: string): Promise<ActionReceipt> {
    requireValue(JOB.test(jobId), "Invalid Job ID");
    return extractReceipt(await this.request(`/v1/jobs/${jobId}/cancel`, { method: "POST" }, "target:write", idempotencyKey));
  }

  async decideApproval(approvalId: string, approve: boolean, reason: string, idempotencyKey: string): Promise<ActionReceipt> {
    requireValue(APPROVAL.test(approvalId), "Invalid Approval ID");
    requireValue(reason.trim().length > 0, "Approval reason is required");
    return extractReceipt(await this.request(`/v1/approvals/${approvalId}/decisions`, { method: "POST", body: JSON.stringify({ approve, reason: reason.trim() }) }, "approval:write", idempotencyKey));
  }

  async runSessionAgent(
    message: string,
    targetIds: string[],
    maxToolCalls: number,
    timeoutS: number,
    idempotencyKey: string,
    writable: boolean,
  ): Promise<SessionAgentTurnResult> {
    requireValue(message.trim().length > 0 && message.length <= 16_384, "Session Agent message is invalid");
    requireValue(targetIds.length > 0 && targetIds.length <= 1000 && targetIds.every((item) => ID.test(item)), "Session Agent target allowlist is invalid");
    requireValue(maxToolCalls >= 1 && maxToolCalls <= 8, "Session Agent action budget is invalid");
    requireValue(timeoutS >= 10 && timeoutS <= 1800, "Session Agent timeout is invalid");
    const value = await this.request(
      "/v1/session-agent/turns",
      {
        method: "POST",
        body: JSON.stringify({
          message: message.trim(),
          allowed_target_ids: [...new Set(targetIds)].sort(),
          max_tool_calls: maxToolCalls,
          timeout_s: timeoutS,
        }),
      },
      writable ? "target:write" : undefined,
      idempotencyKey,
    );
    return parseSessionAgentTurn(value);
  }
}
