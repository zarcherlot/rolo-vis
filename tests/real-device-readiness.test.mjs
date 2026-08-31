import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { importDeviceHardeningEvidence } from "../src/deviceHardeningEvidence.ts";
import { RoloApiError, RoloClient } from "../src/roloClient.ts";

test("RoloClient injects bearer auth in memory without putting it in the URL", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), headers: Object.fromEntries(new Headers(init.headers).entries()) };
    return { ok: true, json: async () => ({ status: "HEALTHY", service: "rolo", version: "1", robots: 0, robot_use_backend: "offline", openai_key_configured: false, api_features: [], timestamp: "2026-08-31T00:00:00Z" }) };
  };
  try {
    const token = "short-lived-secret-token";
    const client = new RoloClient("https://staging.example.test", { apiToken: token });
    await client.health();
    assert.equal(request.url, "https://staging.example.test/health");
    assert.equal(request.headers.authorization, `Bearer ${token}`);
    assert.equal(request.url.includes(token), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient defaults to same-origin credentials without Authorization", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (_url, init) => {
    request = init;
    return { ok: true, json: async () => ({ status: "HEALTHY", service: "rolo", version: "1", robots: 0, robot_use_backend: "offline", openai_key_configured: false, api_features: [], timestamp: "2026-08-31T00:00:00Z" }) };
  };
  try {
    await new RoloClient("https://staging.example.test").health();
    assert.equal(request.credentials, "same-origin");
    assert.equal(new Headers(request.headers).has("Authorization"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RoloClient preserves HTTP authentication failures", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const status of [401, 403]) {
      globalThis.fetch = async () => ({ ok: false, status, headers: new Headers() });
      await assert.rejects(
        () => new RoloClient("https://staging.example.test", { apiToken: "token" }).health(),
        (error) => error instanceof RoloApiError && error.status === status,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("device evidence import keeps pending scenarios unresolved", async () => {
  const matrix = JSON.parse(await readFile(new URL("./fixtures/device-hardening-matrix.json", import.meta.url), "utf8"));
  const pending = JSON.parse(await readFile(new URL("./fixtures/device-hardening-evidence.pending.json", import.meta.url), "utf8"));
  const result = importDeviceHardeningEvidence(matrix, pending);
  assert.equal(result.external_complete, false);
  assert.equal(result.promotion_status, "PENDING_EXTERNAL");
  assert.equal(result.matrix.scenarios.find((item) => item.id === "linux-arm64").status, "PENDING_EXTERNAL");
  assert.match(result.limitations.join(" "), /not automatic/i);
});

test("verified producer evidence still requires promotion review", async () => {
  const matrix = JSON.parse(await readFile(new URL("./fixtures/device-hardening-matrix.json", import.meta.url), "utf8"));
  const bundle = JSON.parse(await readFile(new URL("./fixtures/device-hardening-evidence.pending.json", import.meta.url), "utf8"));
  bundle.evidence = bundle.evidence.map((item, index) => ({
    ...item,
    status: "VERIFIED",
    evidence: { os: "Linux", architecture: index === 0 ? "arm64" : "x86_64", package_digest: "a1b2c3d4", job_id: `job-${index}`, gate_result: "PASSED", observed_at: "2026-08-31T00:00:00Z", summary: "Sanitized producer summary." },
  }));
  const result = importDeviceHardeningEvidence(matrix, bundle);
  assert.equal(result.external_complete, true);
  assert.equal(result.promotion_status, "REVIEW_REQUIRED");
  assert.notEqual(result.matrix.scenarios.find((item) => item.id === "linux-arm64").status, "READY");
});
