import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createIdempotencyKey,
  DeploymentControlClient,
} from "../deployment-control/src/api.ts";

const TOKEN = "test-memory-only-token-123456";

test("deployment control is a separate authenticated plugin while rolo-vis stays read-only", async () => {
  const readOnly = JSON.parse(await readFile(new URL("../rolo.plugin.json", import.meta.url), "utf8"));
  const control = JSON.parse(await readFile(new URL("../deployment-control/rolo.plugin.json", import.meta.url), "utf8"));

  assert.equal(readOnly.id, "rolo-vis");
  assert.equal(readOnly.security.mode, "read-only");
  assert.equal(readOnly.capabilities.some((item) => item.endsWith(".write")), false);
  assert.equal(control.id, "rolo-deployment-control");
  assert.equal(control.security.mode, "authenticated-control");
  assert.equal(control.security.authentication, "memory-only-bearer");
  assert.equal(control.security.persists_credentials, false);
  assert.equal(control.security.allows_ssh_private_keys, false);
  assert.equal(control.security.allows_arbitrary_commands, false);
  assert.deepEqual(control.security.required_permissions, ["target:write", "approval:write"]);
  assert.ok(control.api.required_endpoints.includes("/v1/deployment-session"));
  assert.ok(control.api.required_endpoints.includes("/v1/session-agent/turns"));
  assert.ok(control.api.required_endpoints.includes("/v1/session-agent/readiness"));
  assert.ok(control.api.required_endpoints.includes("/v1/targets/{target_id}/project-evidence-jobs"));
  assert.ok(control.api.required_endpoints.includes("/v1/targets/{target_id}/source-discovery-jobs"));
  assert.ok(control.api.required_endpoints.includes("/v1/targets/{target_id}/runtime-evidence-jobs"));
  assert.ok(control.api.required_endpoints.includes("/v1/targets/{target_id}/host-provisioning-jobs"));
  assert.ok(control.api.required_endpoints.includes("/v1/targets/{target_id}/runtime-rollback-jobs"));
});

test("Session Agent readiness cannot self-attest external W10 gates", async () => {
  const external = new Set([
    "DEDICATED_OS_ISOLATION",
    "REAL_PROVIDER_ACCEPTANCE",
    "REAL_SSH_PROMPT_INJECTION",
    "MULTI_WORKER_FAILURE_INJECTION",
    "LINUX_X86_64_ACCEPTANCE",
    "LINUX_ARM64_ACCEPTANCE",
  ]);
  const gateIds = [
    "FEATURE_ENABLED",
    "DEDICATED_PROVIDER_CREDENTIAL",
    "HTTPS_PROVIDER",
    "CODEX_EXECUTABLE",
    "CODEX_CONTAINMENT_CONTRACT",
    ...external,
  ];
  const payload = {
    schema_version: "rolo-session-agent-production-readiness/v1",
    generated_at: "2026-08-26T00:00:00Z",
    host_class: "LINUX_X86_64",
    catalog_sha256: "a".repeat(64),
    provider_configuration_sha256: "b".repeat(64),
    gates: gateIds.map((gate_id) => ({
      gate_id,
      status: external.has(gate_id) ? "NOT_VERIFIED" : "PASSED",
      evidence_kind: external.has(gate_id) ? "EXTERNAL_ACCEPTANCE_REQUIRED" : "CONFIGURATION",
      summary: "bounded readiness evidence",
      evidence_sha256: external.has(gate_id) ? null : "c".repeat(64),
    })),
    production_ready: false,
  };
  const calls = [];
  const client = new DeploymentControlClient("/rolo-api", "operator@example.com", TOKEN, async (url, init) => {
    calls.push({ url, init });
    return Response.json(payload);
  });

  const report = await client.sessionAgentReadiness();

  assert.equal(report.production_ready, false);
  assert.equal(calls[0].url, "/rolo-api/v1/session-agent/readiness");
  assert.equal(calls[0].init.headers.get("X-Rolo-Permissions"), null);
  const unsafe = structuredClone(payload);
  const providerGate = unsafe.gates.find((gate) => gate.gate_id === "REAL_PROVIDER_ACCEPTANCE");
  providerGate.status = "PASSED";
  providerGate.evidence_sha256 = "d".repeat(64);
  const unsafeClient = new DeploymentControlClient("/rolo-api", "operator@example.com", TOKEN, async () => Response.json(unsafe));
  await assert.rejects(unsafeClient.sessionAgentReadiness(), /self-attested/);
});

test("deployment session verifies the bound principal without an idempotency or permission claim", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return Response.json({
      schema_version: "rolo-deployment-api-session/v1",
      principal: "operator@example.com",
      permissions: ["approval:write", "target:write"],
      authentication: "bearer",
      token_persistence: "client-memory-only",
    });
  };
  const client = new DeploymentControlClient("/rolo-api/", "operator@example.com", TOKEN, fetcher);

  const session = await client.session();

  assert.equal(session.principal, "operator@example.com");
  assert.equal(calls[0].url, "/rolo-api/v1/deployment-session");
  assert.equal(calls[0].init.headers.get("Authorization"), `Bearer ${TOKEN}`);
  assert.equal(calls[0].init.headers.get("X-Rolo-Principal"), "operator@example.com");
  assert.equal(calls[0].init.headers.has("X-Rolo-Permissions"), false);
  assert.equal(calls[0].init.headers.has("Idempotency-Key"), false);
  assert.equal(calls[0].init.cache, "no-store");
  assert.equal(calls[0].init.credentials, "omit");
});

test("mutations use exact permissions, strict JSON and caller-owned idempotency", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return Response.json({
      schema_version: "rolo-deployment-job-record/v1",
      job: {
        job_id: "deployment-0123456789abcdef0123456789abcdef",
        state: "CREATED",
        command_sha256: "a".repeat(64),
        command: { target_id: "wheeltec" },
      },
    });
  };
  const client = new DeploymentControlClient("/rolo-api", "operator@example.com", TOKEN, fetcher);
  const key = createIdempotencyKey("adapt", "123e4567-e89b-12d3-a456-426614174000");

  const projectJobId = "deployment-11111111111111111111111111111111";
  const sourceJobId = "deployment-22222222222222222222222222222222";
  const receipt = await client.submitAdapt("wheeltec", {
    active_probe: "none",
    run_adapter_agent: false,
    timeout_s: 1800,
    project_evidence_job_id: projectJobId,
    project_evidence_max_age_s: 900,
    source_discovery_job_id: sourceJobId,
    source_discovery_max_age_s: 900,
  }, key);

  assert.equal(receipt.jobId, "deployment-0123456789abcdef0123456789abcdef");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.get("X-Rolo-Permissions"), "target:write");
  assert.equal(calls[0].init.headers.get("Idempotency-Key"), key);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    active_probe: "none",
    run_adapter_agent: false,
    timeout_s: 1800,
    project_evidence_job_id: projectJobId,
    project_evidence_max_age_s: 900,
    source_discovery_job_id: sourceJobId,
    source_discovery_max_age_s: 900,
  });
  assert.doesNotMatch(calls[0].init.body, /shell|argv|private.key/i);
});

test("target evidence submissions create separate approvals and keep scopes fixed", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return Response.json({
      job: { job: { job_id: "deployment-0123456789abcdef0123456789abcdef", state: "CREATED" } },
      approval: { approval_id: "approval-0123456789abcdef0123456789abcdef" },
    });
  };
  const client = new DeploymentControlClient("/rolo-api", "operator@example.com", TOKEN, fetcher);
  const input = {
    approver_principal: "reviewer@example.com",
    approval_ttl_s: 900,
    timeout_s: 120,
  };

  const project = await client.submitProjectEvidence("wheeltec", input, "gui:project-evidence:12345678");
  const source = await client.submitSourceDiscovery("wheeltec", input, "gui:source-discovery:12345678");
  const runtimeInput = { ...input, approval_ttl_s: 300, timeout_s: 45 };
  const runtime = await client.submitRuntimeEvidence("wheeltec", runtimeInput, "gui:runtime-evidence:12345678");

  assert.equal(project.approvalId, "approval-0123456789abcdef0123456789abcdef");
  assert.equal(source.jobId, "deployment-0123456789abcdef0123456789abcdef");
  assert.equal(runtime.jobId, "deployment-0123456789abcdef0123456789abcdef");
  assert.equal(calls[0].url, "/rolo-api/v1/targets/wheeltec/project-evidence-jobs");
  assert.equal(calls[1].url, "/rolo-api/v1/targets/wheeltec/source-discovery-jobs");
  assert.equal(calls[2].url, "/rolo-api/v1/targets/wheeltec/runtime-evidence-jobs");
  assert.deepEqual(JSON.parse(calls[0].init.body), input);
  assert.deepEqual(JSON.parse(calls[1].init.body), { scan_roots: ["."], ...input });
  assert.deepEqual(JSON.parse(calls[2].init.body), runtimeInput);
  assert.equal(calls[0].init.headers.get("X-Rolo-Permissions"), "target:write");
  assert.equal(calls[1].init.headers.get("X-Rolo-Permissions"), "target:write");
  assert.equal(calls[2].init.headers.get("X-Rolo-Permissions"), "target:write");
  assert.doesNotMatch(calls[1].init.body, /source_text|readme_text|shell|argv|private.key/i);
});

test("bootstrap rejects an internal Controller-path response", async () => {
  const fetcher = async () => Response.json({
    job: { job: { job_id: "deployment-0123456789abcdef0123456789abcdef", state: "CREATED" } },
    package_root: "C:/controller/private/package",
  });
  const client = new DeploymentControlClient("/rolo-api", "operator@example.com", TOKEN, fetcher);

  await assert.rejects(
    client.submitBootstrap("wheeltec", { package_ref: `rolo-target@${"a".repeat(64)}` }, "gui:bootstrap:12345678"),
    /secret-bearing deployment response/,
  );
});

test("host provisioning submits only distinct public identities and exact CAS", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return Response.json({
      schema_version: "rolo-target-host-provisioning-api-result/v1",
      job: { job: { job_id: "deployment-0123456789abcdef0123456789abcdef", state: "CREATED" } },
      approval: { approval_id: "approval-0123456789abcdef0123456789abcdef" },
      plan_sha256: "d".repeat(64),
    });
  };
  const client = new DeploymentControlClient("/rolo-api", "operator@example.com", TOKEN, fetcher);
  const bootstrapKey = `ssh-ed25519 ${Buffer.alloc(32, "b").toString("base64")}`;
  const runtimeKey = `ssh-ed25519 ${Buffer.alloc(32, "r").toString("base64")}`;
  const input = {
    bootstrap_public_key: bootstrapKey,
    runtime_public_key: runtimeKey,
    approver_principal: "reviewer@example.com",
    approval_ttl_s: 900,
    expected_current_plan_sha256: "c".repeat(64),
  };

  const receipt = await client.submitHostProvisioning(
    "wheeltec",
    input,
    "gui:host-provisioning:12345678",
  );

  assert.equal(receipt.jobId, "deployment-0123456789abcdef0123456789abcdef");
  assert.equal(receipt.approvalId, "approval-0123456789abcdef0123456789abcdef");
  assert.equal(receipt.planSha256, "d".repeat(64));
  assert.equal(calls[0].url, "/rolo-api/v1/targets/wheeltec/host-provisioning-jobs");
  assert.equal(calls[0].init.headers.get("X-Rolo-Permissions"), "target:write");
  assert.deepEqual(JSON.parse(calls[0].init.body), input);
  assert.doesNotMatch(calls[0].init.body, /private.key|credential|known_hosts|shell|argv/i);

  await assert.rejects(
    client.submitHostProvisioning(
      "wheeltec",
      { ...input, runtime_public_key: bootstrapKey },
      "gui:host-provisioning:duplicate",
    ),
    /must differ/,
  );
  assert.equal(calls.length, 1);
});

test("runtime rollback submits only the strict double-CAS contract", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return Response.json({
      schema_version: "rolo-target-runtime-rollback-api-result/v1",
      job: { job: { job_id: "deployment-0123456789abcdef0123456789abcdef", state: "CREATED" } },
      approval: { approval_id: "approval-0123456789abcdef0123456789abcdef" },
      package_id: "rolo-target",
      expected_current_manifest_sha256: "c".repeat(64),
      expected_previous_manifest_sha256: "b".repeat(64),
    });
  };
  const client = new DeploymentControlClient("/rolo-api", "operator@example.com", TOKEN, fetcher);

  const receipt = await client.submitRuntimeRollback("wheeltec", {
    package_id: "rolo-target",
    expected_current_manifest_sha256: "c".repeat(64),
    expected_previous_manifest_sha256: "b".repeat(64),
    approver_principal: "reviewer@example.com",
    approval_ttl_s: 900,
    timeout_s: 300,
  }, "gui:runtime-rollback:12345678");

  assert.equal(receipt.jobId, "deployment-0123456789abcdef0123456789abcdef");
  assert.equal(receipt.approvalId, "approval-0123456789abcdef0123456789abcdef");
  assert.equal(calls[0].url, "/rolo-api/v1/targets/wheeltec/runtime-rollback-jobs");
  assert.equal(calls[0].init.headers.get("X-Rolo-Permissions"), "target:write");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    package_id: "rolo-target",
    expected_current_manifest_sha256: "c".repeat(64),
    expected_previous_manifest_sha256: "b".repeat(64),
    approver_principal: "reviewer@example.com",
    approval_ttl_s: 900,
    timeout_s: 300,
  });
  assert.doesNotMatch(calls[0].init.body, /shell|argv|credential|private.key/i);

  await assert.rejects(
    client.submitRuntimeRollback("wheeltec", {
      package_id: "rolo-target",
      expected_current_manifest_sha256: "c".repeat(64),
      expected_previous_manifest_sha256: "c".repeat(64),
      approver_principal: "reviewer@example.com",
      approval_ttl_s: 900,
      timeout_s: 300,
    }, "gui:runtime-rollback:87654321"),
    /digests must differ/,
  );
});

test("natural-language turns freeze target scope and use the broker permission boundary", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return Response.json({
      schema_version: "rolo-session-agent-turn-result/v2",
      session_id: "agent-session-0123456789abcdef0123456789abcdef",
      status: "COMPLETED",
      response: "Target state inspected.",
      catalog_sha256: "a".repeat(64),
      receipts: [{
        sequence: 1,
        action: "SHOW_TARGET",
        status: "COMPLETED",
        summary: "Safe target projection read.",
        target_id: "wheeltec",
        job_id: null,
        approval_id: null,
        command_sha256: "b".repeat(64),
        deployment_command_sha256: null,
        canonical_cli: null,
      }],
      provider_calls: 2,
      provider_error_code: null,
    });
  };
  const client = new DeploymentControlClient("/rolo-api", "operator@example.com", TOKEN, fetcher);
  const key = createIdempotencyKey("agent-turn", "123e4567-e89b-12d3-a456-426614174000");

  const result = await client.runSessionAgent("Inspect wheeltec", ["wheeltec"], 4, 120, key, true);

  assert.equal(result.status, "COMPLETED");
  assert.equal(calls[0].url, "/rolo-api/v1/session-agent/turns");
  assert.equal(calls[0].init.headers.get("X-Rolo-Permissions"), "target:write");
  assert.equal(calls[0].init.headers.get("Idempotency-Key"), key);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    message: "Inspect wheeltec",
    allowed_target_ids: ["wheeltec"],
    max_tool_calls: 4,
    timeout_s: 120,
  });
  assert.doesNotMatch(calls[0].init.body, /token|principal|approval|shell|argv/i);
});

test("Session Agent responses reject raw target output", async () => {
  const client = new DeploymentControlClient("/rolo-api", "operator@example.com", TOKEN, async () => Response.json({
    schema_version: "rolo-session-agent-turn-result/v2",
    session_id: "agent-session-0123456789abcdef0123456789abcdef",
    status: "COMPLETED",
    response: "done",
    catalog_sha256: "a".repeat(64),
    receipts: [],
    provider_calls: 1,
    provider_error_code: null,
    raw_target_output: "untrusted banner",
  }));

  await assert.rejects(
    client.runSessionAgent("Inspect wheeltec", ["wheeltec"], 1, 30, "gui:agent-turn:12345678", false),
    /secret-bearing deployment response/,
  );
});

test("disconnect clears the in-memory bearer and source contains no persistence path", async () => {
  const client = new DeploymentControlClient("/rolo-api", "operator@example.com", TOKEN, async () => Response.json({}));
  client.dispose();
  await assert.rejects(client.session(), /disconnected/);

  const apiSource = await readFile(new URL("../deployment-control/src/api.ts", import.meta.url), "utf8");
  const appSource = await readFile(new URL("../deployment-control/src/DeploymentControlApp.tsx", import.meta.url), "utf8");
  for (const source of [apiSource, appSource]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|history\.pushState/);
  }
  assert.doesNotMatch(appSource, /<input[^>]+name=["'](?:ssh_)?private_key["']/i);
  assert.doesNotMatch(appSource, /<textarea[^>]+name=["'](?:shell|command|argv)["']/i);
  assert.doesNotMatch(appSource, /console\.(log|debug|info|warn|error)/);
});

test("default browser fetch is explicitly bound instead of invoked with the client as this", async () => {
  const apiSource = await readFile(new URL("../deployment-control/src/api.ts", import.meta.url), "utf8");
  assert.match(apiSource, /globalThis\.fetch\.bind\(globalThis\)/);
});
