import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise,
  ChatCircleDots,
  CheckCircle,
  DesktopTower,
  HardDrives,
  Key,
  LockKey,
  Play,
  Plus,
  ShieldCheck,
  SignOut,
  Stop,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import {
  createIdempotencyKey,
  DeploymentControlClient,
  type DeploymentSession,
  type SessionAgentProductionReadiness,
  type SessionAgentTurnResult,
  type WorkbenchRow,
  type WorkbenchSnapshot,
} from "./api";

const DEFAULT_API_BASE = import.meta.env.VITE_ROLO_API_BASE || "/rolo-api";
type Probe = "none" | "help" | "runtime-readonly";

function rowFields(row: WorkbenchRow | undefined): Record<string, string> {
  return Object.fromEntries((row?.fields || []).map((field) => [field.name, field.value]));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Deployment request failed";
}

function Status({ value }: { value: string }) {
  const attention = /BLOCK|FAIL|REQUIRED|PENDING|CANCEL/.test(value);
  const complete = /COMPLETE|APPROVED|CREATED|REGISTERED/.test(value);
  return <span className={`dc-status ${attention ? "attention" : complete ? "complete" : "active"}`}>{value.replaceAll("_", " ")}</span>;
}

function AuthGate({ onConnect }: { onConnect: (client: DeploymentControlClient, session: DeploymentSession) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    let client: DeploymentControlClient | null = null;
    try {
      client = new DeploymentControlClient(
        String(data.get("base") || DEFAULT_API_BASE),
        String(data.get("principal") || ""),
        String(data.get("token") || ""),
      );
      const session = await client.session();
      onConnect(client, session);
      form.reset();
    } catch (cause) {
      client?.dispose();
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="dc-auth-shell">
      <section className="dc-auth-card">
        <div className="dc-auth-mark"><ShieldCheck size={30} weight="fill" /></div>
        <p className="eyebrow">Independent control plane</p>
        <h1>Deployment Control</h1>
        <p className="lede">Authenticate to create bounded Jobs and approvals. The read-only rolo Workbench remains a separate plugin.</p>
        <form onSubmit={submit} autoComplete="off">
          <label>Controller API<input name="base" defaultValue={DEFAULT_API_BASE} spellCheck={false} /></label>
          <label>Bound principal<input name="principal" placeholder="operator@example.com" required spellCheck={false} /></label>
          <label>Bearer token<input name="token" type="password" minLength={16} required autoComplete="off" /></label>
          {error && <div className="dc-alert"><Warning size={17} />{error}</div>}
          <button className="primary" disabled={busy}><LockKey size={17} />{busy ? "Verifying…" : "Verify session"}</button>
        </form>
        <footer><Key size={15} /> Token is retained in this tab's React memory only and is cleared on disconnect or reload.</footer>
      </section>
    </main>
  );
}

function AddTargetForm({ client, onDone }: { client: DeploymentControlClient; onDone: (message: string) => void }) {
  const [transport, setTransport] = useState<"LOCAL" | "SSH">("SSH");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (name: string) => String(data.get(name) || "").trim();
    const targetId = value("target_id");
    const releaseKeyId = value("release_key_id");
    const releasePublicPath = value("release_public_path");
    const releasePublicSha = value("release_public_sha256");
    const releasePins = [releaseKeyId, releasePublicPath, releasePublicSha];
    if (releasePins.some(Boolean) && !releasePins.every(Boolean)) {
      onDone("Release key ID, public-key path and SHA-256 must be provided together.");
      return;
    }
    const releasePin = releaseKeyId && releasePublicPath && releasePublicSha ? {
      release_signing_key_id: releaseKeyId,
      release_signing_public_key_path: releasePublicPath,
      release_signing_public_key_sha256: releasePublicSha,
    } : {};
    const connectionId = `connection-${targetId}`;
    const target = {
      target_id: targetId,
      orchestrator_placement: transport === "SSH" ? "CONTROLLER" : "TARGET_LOCAL",
      transport,
      connection_profile_id: transport === "SSH" ? connectionId : null,
      workspace_root: value("workspace"),
      desired_rolo_version: value("version"),
      trust_level: "STRICT",
      ...releasePin,
    };
    const connection = transport === "SSH" ? {
      connection_profile_id: connectionId,
      transport: "SSH",
      host: value("host"),
      port: Number(value("port") || 22),
      user: value("user"),
      credential_ref: value("credential_ref"),
      known_hosts_path: value("known_hosts"),
      trust_level: "STRICT",
      expected_host_key_sha256: value("fingerprint"),
    } : null;
    setBusy(true);
    try {
      const receipt = await client.registerTarget({ target, connection }, createIdempotencyKey("register"));
      form.reset();
      onDone(`Target ${receipt.targetId} ${receipt.status.toLowerCase()}.`);
    } catch (cause) {
      onDone(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="dc-form" onSubmit={submit} autoComplete="off">
      <header><div><p className="eyebrow">Target metadata</p><h3>Add target</h3></div><div className="segmented"><button type="button" className={transport === "SSH" ? "selected" : ""} onClick={() => setTransport("SSH")}>SSH</button><button type="button" className={transport === "LOCAL" ? "selected" : ""} onClick={() => setTransport("LOCAL")}>Local</button></div></header>
      <div className="form-grid">
        <label>Target ID<input name="target_id" required pattern="[A-Za-z0-9][A-Za-z0-9_.-]{0,127}" /></label>
        <label>Desired rolo version<input name="version" required placeholder="0.2.0" /></label>
        <label className="wide">Workspace on target<input name="workspace" required placeholder={transport === "SSH" ? "/home/robot/ws" : "C:/robot/ws"} /></label>
        {transport === "SSH" && <>
          <label>SSH host<input name="host" required /></label><label>Port<input name="port" type="number" min="1" max="65535" defaultValue="22" required /></label>
          <label>User<input name="user" required /></label><label>Credential reference<input name="credential_ref" required placeholder="file://ssh/robot-a" /></label>
          <label className="wide">Controller known_hosts path<input name="known_hosts" required /></label>
          <label className="wide">Pinned host fingerprint<input name="fingerprint" required pattern="SHA256:[A-Za-z0-9+/]{43}" placeholder="SHA256:…" /></label>
          <label className="wide confirm"><input name="fingerprint_confirmed" type="checkbox" required />I compared this fingerprint through an independent trusted channel.</label>
        </>}
        <label>Release key ID<input name="release_key_id" /></label><label>Release public-key SHA-256<input name="release_public_sha256" pattern="[0-9a-f]{64}" /></label>
        <label className="wide">Controller release public-key path<input name="release_public_path" /></label>
      </div>
      <p className="form-note"><ShieldCheck size={15} /> No SSH private key or shell command is accepted. Credential references stay opaque.</p>
      <button className="primary" disabled={busy}><Plus size={16} />{busy ? "Registering…" : "Register target"}</button>
    </form>
  );
}

function SessionAgentPanel({ client, readiness, targetId, writable, onDone }: { client: DeploymentControlClient; readiness: SessionAgentProductionReadiness | null; targetId: string; writable: boolean; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SessionAgentTurnResult | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const next = await client.runSessionAgent(
        String(data.get("message") || ""),
        [targetId],
        Number(data.get("budget") || 4),
        Number(data.get("timeout") || 120),
        createIdempotencyKey("agent-turn"),
        writable,
      );
      setResult(next);
      onDone(`Session Agent ${next.status.toLowerCase().replaceAll("_", " ")}.`);
    } catch (cause) {
      onDone(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const unresolved = readiness?.gates.filter((gate) => gate.status !== "PASSED").length ?? 0;
  return <section className="dc-panel agent-panel"><header><div><p className="eyebrow">Codex · authenticated broker</p><h3>Natural-language deployment</h3></div><div><Status value={readiness?.production_ready ? "PRODUCTION_READY" : "PRODUCTION_BLOCKED"} /><small>{unresolved} readiness gates unresolved</small></div></header><form onSubmit={submit}><label>Request<textarea name="message" required maxLength={16384} placeholder={`Inspect ${targetId}, create a bounded Job, or explain its current state.`} /></label><div className="agent-options"><label>Action budget<input name="budget" type="number" min="1" max="8" defaultValue="4" /></label><label>Timeout (s)<input name="timeout" type="number" min="10" max="1800" defaultValue="120" /></label><button className="primary" disabled={busy}><ChatCircleDots size={16} />{busy ? "Running bounded turn…" : "Run Agent turn"}</button></div></form><p className="form-note"><ShieldCheck size={15} /> Target scope is frozen to <code>{targetId}</code>. Codex receives no Controller token, SSH credential, approval authority, free shell, or raw target output. Static readiness never substitutes for W10 host acceptance.</p>{result && <div className="agent-result"><header><Status value={result.status} /><code>{result.session_id}</code></header><p>{result.response}</p>{result.receipts.map((receipt) => <article key={`${receipt.sequence}-${receipt.command_sha256}`}><span>{receipt.sequence}</span><div><strong>{receipt.action.replaceAll("_", " ")}</strong><small>{receipt.summary}</small>{receipt.job_id && <code>{receipt.job_id}</code>}{receipt.canonical_cli && <pre>{receipt.canonical_cli}</pre>}</div><Status value={receipt.status} /></article>)}</div>}</section>;
}

function TargetActions({ client, targetId, enabled, onDone }: { client: DeploymentControlClient; targetId: string; enabled: boolean; onDone: (message: string) => void }) {
  const [probe, setProbe] = useState<Probe>("runtime-readonly");
  const [busy, setBusy] = useState(false);

  async function act(kind: "assess" | "adapt") {
    setBusy(true);
    try {
      const receipt = kind === "assess"
        ? await client.assessConnection(targetId, probe, createIdempotencyKey("assess"))
        : await client.submitAdapt(targetId, { active_probe: probe, run_adapter_agent: false, timeout_s: 1800 }, createIdempotencyKey("adapt"));
      onDone(`${kind === "assess" ? "Assessment" : "Adapt"} Job ${receipt.jobId} created.`);
    } catch (cause) {
      onDone(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return <section className="dc-panel dc-actions"><header><div><p className="eyebrow">Bound actions</p><h3>{targetId}</h3></div><select value={probe} onChange={(event) => setProbe(event.target.value as Probe)}><option value="runtime-readonly">Runtime read-only</option><option value="help">Help probe</option><option value="none">No active probe</option></select></header><div><button onClick={() => void act("assess")} disabled={busy || !enabled}><DesktopTower size={17} />Assess connection</button><button onClick={() => void act("adapt")} disabled={busy || !enabled}><HardDrives size={17} />Submit discovery-only Adapt</button></div>{!enabled && <p className="permission-note">This session does not hold <code>target:write</code>.</p>}</section>;
}

function EvidenceAdaptFlow({ client, targetId, enabled, onDone }: { client: DeploymentControlClient; targetId: string; enabled: boolean; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState<"project" | "source" | "runtime" | "adapt" | null>(null);

  async function submitEvidence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const action = submitter?.value === "source" ? "source" : submitter?.value === "runtime" ? "runtime" : "project";
    setBusy(action);
    try {
      const input = {
        approver_principal: String(data.get("approver") || "").trim(),
        approval_ttl_s: action === "runtime" ? Number(data.get("runtime_ttl") || 300) : Number(data.get("ttl") || 900),
        timeout_s: Number(data.get("timeout") || (action === "source" ? 120 : action === "runtime" ? 45 : 60)),
      };
      const receipt = action === "source"
        ? await client.submitSourceDiscovery(targetId, input, createIdempotencyKey("source-discovery"))
        : action === "runtime"
          ? await client.submitRuntimeEvidence(targetId, input, createIdempotencyKey("runtime-evidence"))
          : await client.submitProjectEvidence(targetId, input, createIdempotencyKey("project-evidence"));
      const label = action === "source" ? "Source discovery" : action === "runtime" ? "Runtime evidence" : "Project evidence";
      onDone(`${label} Job ${receipt.jobId} frozen; Approval ${receipt.approvalId} is pending.`);
    } catch (cause) {
      onDone(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  async function submitBoundAdapt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy("adapt");
    try {
      const runtimeJob = String(data.get("runtime_job") || "").trim();
      const receipt = await client.submitAdapt(targetId, {
        active_probe: runtimeJob ? "runtime-readonly" : "none",
        run_adapter_agent: false,
        timeout_s: Number(data.get("adapt_timeout") || 1800),
        project_evidence_job_id: String(data.get("project_job") || "").trim(),
        project_evidence_max_age_s: Number(data.get("max_age") || 900),
        source_discovery_job_id: String(data.get("source_job") || "").trim(),
        source_discovery_max_age_s: Number(data.get("max_age") || 900),
        ...(runtimeJob ? {
          runtime_evidence_job_id: runtimeJob,
          runtime_evidence_max_age_s: Number(data.get("runtime_max_age") || 300),
        } : {}),
      }, createIdempotencyKey("bound-adapt"));
      onDone(`Adapt Job ${receipt.jobId} frozen to the selected verified evidence artifacts.`);
    } catch (cause) {
      onDone(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  return <section className="dc-panel evidence-flow"><header><div><p className="eyebrow">SSH · proof-bound discovery</p><h3>Target evidence chain</h3></div><ShieldCheck size={22} /></header><form onSubmit={submitEvidence}><div className="form-grid"><label>Approver principal<input name="approver" required /></label><label>Metadata/source approval TTL (s)<input name="ttl" type="number" min="60" max="86400" defaultValue="900" /></label><label>Runtime approval TTL (s)<input name="runtime_ttl" type="number" min="60" max="300" defaultValue="300" /></label><label>Read timeout (s)<input name="timeout" type="number" min="1" max="300" defaultValue="120" /></label><label>Source scope<input value="workspace root (.)" readOnly aria-label="Fixed source discovery scope" /></label><label>Runtime scope<input value="hw, linux, ros (read-only)" readOnly aria-label="Fixed runtime evidence scope" /></label></div><p className="form-note"><ShieldCheck size={15} /> Each button creates a separate R2 Approval. Runtime evidence has a maximum five-minute authorization window and is signed by the enrolled collector.</p><div className="evidence-actions"><button name="action" value="project" disabled={busy !== null || !enabled}><HardDrives size={16} />{busy === "project" ? "Freezing metadata…" : "1. Submit project metadata"}</button><button name="action" value="source" disabled={busy !== null || !enabled}><ShieldCheck size={16} />{busy === "source" ? "Freezing source scope…" : "2. Submit source analysis"}</button><button name="action" value="runtime" disabled={busy !== null || !enabled}><DesktopTower size={16} />{busy === "runtime" ? "Freezing runtime scope…" : "3. Submit runtime evidence"}</button></div></form><form onSubmit={submitBoundAdapt}><div className="form-grid"><label className="wide">Completed project-evidence Job ID<input name="project_job" required pattern="deployment-[0-9a-f]{32}" placeholder="deployment-…" /></label><label className="wide">Completed source-discovery Job ID<input name="source_job" required pattern="deployment-[0-9a-f]{32}" placeholder="deployment-…" /></label><label className="wide">Completed runtime-evidence Job ID (optional)<input name="runtime_job" pattern="deployment-[0-9a-f]{32}" placeholder="deployment-…" /></label><label>Metadata/source max age (s)<input name="max_age" type="number" min="60" max="86400" defaultValue="900" /></label><label>Runtime max age (s)<input name="runtime_max_age" type="number" min="60" max="300" defaultValue="300" /></label><label>Adapt timeout (s)<input name="adapt_timeout" type="number" min="1" max="86400" defaultValue="1800" /></label></div><p className="form-note"><ShieldCheck size={15} /> Approve and run referenced Jobs first. With a runtime Job, Adapt re-verifies the collector pin, signature, target identity and freshness before consuming probes; without it, Adapt remains metadata-only.</p><button className="primary" disabled={busy !== null || !enabled}><HardDrives size={16} />{busy === "adapt" ? "Binding evidence…" : "4. Submit proof-bound Adapt"}</button></form>{!enabled && <p className="permission-note">This session does not hold <code>target:write</code>.</p>}</section>;
}

function BootstrapForm({ client, targetId, enabled, onDone }: { client: DeploymentControlClient; targetId: string; enabled: boolean; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const receipt = await client.submitBootstrap(targetId, {
        package_ref: String(data.get("package_ref") || "").trim(),
        approver_principal: String(data.get("approver") || "").trim(),
        approval_ttl_s: Number(data.get("ttl") || 900),
        expect_current_present: data.get("current") === "present" ? true : data.get("current") === "any" ? null : false,
        install_authorization_key: true,
        timeout_s: Number(data.get("timeout") || 300),
      }, createIdempotencyKey("bootstrap"));
      onDone(`Bootstrap Job ${receipt.jobId} frozen; Approval ${receipt.approvalId} is pending.`);
    } catch (cause) {
      onDone(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return <form className="dc-panel dc-form compact" onSubmit={submit}><header><div><p className="eyebrow">Immutable package + independent approval</p><h3>Bootstrap</h3></div><ShieldCheck size={22} /></header><div className="form-grid"><label className="wide">Package ref<input name="package_ref" required pattern="[A-Za-z0-9][A-Za-z0-9_.-]{0,127}@[0-9a-f]{64}" /></label><label>Approver principal<input name="approver" required /></label><label>Current runtime<select name="current"><option value="absent">Must be absent</option><option value="present">Must be present</option><option value="any">Any / reviewed</option></select></label><label>Approval TTL (s)<input name="ttl" type="number" min="60" max="86400" defaultValue="900" /></label><label>Execution timeout (s)<input name="timeout" type="number" min="10" max="1800" defaultValue="300" /></label></div><button className="primary" disabled={busy || !enabled}><ShieldCheck size={16} />{busy ? "Freezing…" : "Submit for approval"}</button>{!enabled && <p className="permission-note">This session does not hold <code>target:write</code>.</p>}</form>;
}

function HostProvisioningForm({ client, targetId, enabled, onDone }: { client: DeploymentControlClient; targetId: string; enabled: boolean; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const expectedCurrent = String(data.get("expected_current_plan") || "").trim();
    setBusy(true);
    try {
      const receipt = await client.submitHostProvisioning(targetId, {
        bootstrap_public_key: String(data.get("bootstrap_public_key") || "").trim(),
        runtime_public_key: String(data.get("runtime_public_key") || "").trim(),
        approver_principal: String(data.get("approver") || "").trim(),
        approval_ttl_s: Number(data.get("ttl") || 900),
        ...(expectedCurrent ? { expected_current_plan_sha256: expectedCurrent } : {}),
      }, createIdempotencyKey("host-provisioning"));
      onDone(`Host provisioning Job ${receipt.jobId} frozen as plan ${receipt.planSha256}; Approval ${receipt.approvalId} is pending.`);
    } catch (cause) {
      onDone(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return <form className="dc-panel dc-form compact" onSubmit={submit}><header><div><p className="eyebrow">R3 · exact sudo effects + identity split</p><h3>Host provisioning</h3></div><Warning size={22} /></header><div className="form-grid"><label className="wide">Bootstrap forced-command public key<textarea name="bootstrap_public_key" required rows={2} spellCheck={false} placeholder="ssh-ed25519 AAAA…" /></label><label className="wide">Runtime forced-command public key<textarea name="runtime_public_key" required rows={2} spellCheck={false} placeholder="ssh-ed25519 AAAA…" /></label><label>Approver principal<input name="approver" required /></label><label>Approval TTL (s)<input name="ttl" type="number" min="60" max="86400" defaultValue="900" /></label><label className="wide">Expected current plan SHA-256 (required for update)<input name="expected_current_plan" pattern="[0-9a-f]{64}" placeholder="Leave empty only for first install" /></label></div><p className="form-note"><ShieldCheck size={15} /> Public keys only—never paste private keys. Submission freezes nine digest-bound sudo effects; a separately authenticated approver must review the exact scope before Run. Unknown remote outcomes require reconciliation.</p><button className="primary" disabled={busy || !enabled}><Warning size={16} />{busy ? "Freezing host plan…" : "Submit host plan for approval"}</button>{!enabled && <p className="permission-note">This session does not hold <code>target:write</code>.</p>}</form>;
}

function RuntimeRollbackForm({ client, targetId, enabled, onDone }: { client: DeploymentControlClient; targetId: string; enabled: boolean; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const receipt = await client.submitRuntimeRollback(targetId, {
        package_id: String(data.get("package_id") || "").trim(),
        expected_current_manifest_sha256: String(data.get("current_digest") || "").trim(),
        expected_previous_manifest_sha256: String(data.get("previous_digest") || "").trim(),
        approver_principal: String(data.get("approver") || "").trim(),
        approval_ttl_s: Number(data.get("ttl") || 900),
        timeout_s: Number(data.get("timeout") || 300),
      }, createIdempotencyKey("runtime-rollback"));
      onDone(`Runtime rollback Job ${receipt.jobId} frozen; Approval ${receipt.approvalId} is pending.`);
    } catch (cause) {
      onDone(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return <form className="dc-panel dc-form compact" onSubmit={submit}><header><div><p className="eyebrow">R3 · exact current/previous CAS</p><h3>Runtime rollback</h3></div><Warning size={22} /></header><div className="form-grid"><label>Previous package ID<input name="package_id" required pattern="[A-Za-z0-9][A-Za-z0-9_.-]{0,127}" /></label><label>Approver principal<input name="approver" required /></label><label className="wide">Expected current manifest SHA-256<input name="current_digest" required pattern="[0-9a-f]{64}" /></label><label className="wide">Expected previous manifest SHA-256<input name="previous_digest" required pattern="[0-9a-f]{64}" /></label><label>Approval TTL (s)<input name="ttl" type="number" min="60" max="86400" defaultValue="900" /></label><label>Execution timeout (s)<input name="timeout" type="number" min="10" max="1800" defaultValue="300" /></label></div><p className="form-note"><ShieldCheck size={15} /> Submission freezes an independent Approval; it does not immediately write the target. Unknown remote outcomes require reconciliation.</p><button className="primary" disabled={busy || !enabled}><Warning size={16} />{busy ? "Freezing rollback…" : "Submit rollback for approval"}</button>{!enabled && <p className="permission-note">This session does not hold <code>target:write</code>.</p>}</form>;
}

function JobRow({ client, row, enabled, onDone }: { client: DeploymentControlClient; row: WorkbenchRow; enabled: boolean; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function act(kind: "run" | "cancel") {
    setBusy(true);
    try {
      const receipt = kind === "run" ? await client.runJob(row.identity, createIdempotencyKey("run")) : await client.cancelJob(row.identity, createIdempotencyKey("cancel"));
      onDone(`Job ${receipt.jobId || row.identity}: ${receipt.status}.`);
    } catch (cause) { onDone(errorMessage(cause)); } finally { setBusy(false); }
  }
  const fields = rowFields(row);
  return <article className="dc-job"><div className="job-rail" /><HardDrives size={19} /><div><header><strong>{row.summary}</strong><Status value={row.status} /></header><code>{row.identity}</code><p>Recovery <b>{fields.recovery || "—"}</b> · updated {fields.updated_at ? new Date(fields.updated_at).toLocaleString() : "—"}</p>{row.canonical_cli && <pre>{row.canonical_cli}</pre>}<div className="row-actions"><button onClick={() => void act("run")} disabled={busy || !enabled || row.status === "COMPLETE"}><Play size={15} />Run</button><button onClick={() => void act("cancel")} disabled={busy || !enabled || /COMPLETE|CANCELLED/.test(row.status)}><Stop size={15} />Cancel</button></div></div></article>;
}

function ApprovalCard({ client, row, canDecide, onDone }: { client: DeploymentControlClient; row: WorkbenchRow; canDecide: boolean; onDone: (message: string) => void }) {
  const fields = rowFields(row);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const receipt = await client.decideApproval(row.identity, approve, reason, createIdempotencyKey("decision"));
      onDone(`Approval ${receipt.approvalId || row.identity} ${approve ? "approved" : "rejected"}.`);
      setReason("");
    } catch (cause) { onDone(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <article className="dc-approval"><header><div><p className="eyebrow">{fields.risk || "R3"} · {fields.action || "REVIEW"}</p><h3>{fields.target || row.summary}</h3></div><Status value={row.status} /></header><dl>{["requester", "approver", "desired_version", "workspace", "package_ref", "package_id", "manifest_sha256", "expected_current_manifest_sha256", "expected_previous_manifest_sha256", "command_sha256", "scope_sha256", "expires_at"].filter((name) => fields[name]).map((name) => <div key={name}><dt>{name.replaceAll("_", " ")}</dt><dd>{fields[name]}</dd></div>)}</dl>{row.status === "PENDING" && canDecide && <><label>Review reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} /></label><div className="approval-actions"><button className="approve" disabled={busy || !reason.trim()} onClick={() => void decide(true)}><CheckCircle size={16} />Approve exact scope</button><button className="reject" disabled={busy || !reason.trim()} onClick={() => void decide(false)}><XCircle size={16} />Reject</button></div></>}{row.status === "PENDING" && !canDecide && <p className="permission-note">A session bound to the named approver and <code>approval:write</code> must decide this request.</p>}</article>;
}

export function DeploymentControlApp() {
  const [client, setClient] = useState<DeploymentControlClient | null>(null);
  const [session, setSession] = useState<DeploymentSession | null>(null);
  const [readiness, setReadiness] = useState<SessionAgentProductionReadiness | null>(null);
  const [fleet, setFleet] = useState<WorkbenchSnapshot | null>(null);
  const [target, setTarget] = useState<WorkbenchSnapshot | null>(null);
  const [approvals, setApprovals] = useState<WorkbenchSnapshot | null>(null);
  const [blockers, setBlockers] = useState<WorkbenchSnapshot | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const [nextFleet, nextApprovals, nextBlockers, nextReadiness] = await Promise.all([client.workbench("fleet"), client.workbench("approval"), client.workbench("blocker"), client.sessionAgentReadiness()]);
      const nextTargetId = selectedTarget || nextFleet.rows.find((row) => row.kind === "TARGET")?.identity || null;
      const nextTarget = nextTargetId ? await client.workbench("target", nextTargetId) : null;
      setFleet(nextFleet); setApprovals(nextApprovals); setBlockers(nextBlockers); setReadiness(nextReadiness); setSelectedTarget(nextTargetId); setTarget(nextTarget);
    } catch (cause) { setMessage(errorMessage(cause)); } finally { setLoading(false); }
  }, [client, selectedTarget]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!client) return;
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [client, refresh]);

  const targets = fleet?.rows.filter((row) => row.kind === "TARGET") || [];
  const jobs = target?.rows.filter((row) => row.kind === "JOB") || [];
  const targetSummary = target?.rows.find((row) => row.kind === "TARGET");
  const details = useMemo(() => rowFields(targetSummary), [targetSummary]);
  const canTargetWrite = session?.permissions.includes("target:write") ?? false;
  const canApprove = session?.permissions.includes("approval:write") ?? false;

  function disconnect() {
    client?.dispose();
    setClient(null); setSession(null); setReadiness(null); setFleet(null); setTarget(null); setApprovals(null); setBlockers(null); setMessage(null);
  }
  function done(nextMessage: string) { setMessage(nextMessage); void refresh(); }

  if (!client || !session) return <AuthGate onConnect={(nextClient, nextSession) => { setClient(nextClient); setSession(nextSession); }} />;
  return <main className="dc-shell">
    <aside className="dc-sidebar"><div className="brand"><ShieldCheck size={24} weight="fill" /><span><strong>rolo</strong><small>Deployment Control</small></span></div><div className="identity"><Key size={16} /><span><strong>{session.principal}</strong><small>{session.permissions.join(" · ") || "read only"}</small></span></div><nav><button className="active"><DesktopTower size={17} />Targets <b>{targets.length}</b></button><button><HardDrives size={17} />Blockers <b>{blockers?.rows.length || 0}</b></button><button><ShieldCheck size={17} />Approvals <b>{approvals?.rows.length || 0}</b></button></nav><footer><button onClick={disconnect}><SignOut size={16} />Disconnect & clear token</button></footer></aside>
    <section className="dc-content"><header className="dc-topbar"><div><p className="eyebrow">Authenticated write surface</p><h1>Target deployment</h1></div><div><span className="auth-badge"><LockKey size={15} />Bound session</span><button onClick={() => void refresh()} disabled={loading}><ArrowClockwise size={16} />Refresh</button><button className="primary" onClick={() => setShowAdd((value) => !value)} disabled={!canTargetWrite}><Plus size={16} />Add target</button></div></header>
      {message && <div className="dc-alert"><Warning size={17} />{message}<button onClick={() => setMessage(null)}>×</button></div>}
      {showAdd && canTargetWrite && <section className="dc-panel add-panel"><AddTargetForm client={client} onDone={(value) => { setShowAdd(false); done(value); }} /></section>}
      <div className="dc-grid"><section className="dc-panel target-list"><header><span>Registered targets</span><b>{targets.length}</b></header>{targets.map((row) => { const fields = rowFields(row); return <button key={row.identity} className={selectedTarget === row.identity ? "selected" : ""} onClick={() => setSelectedTarget(row.identity)}><DesktopTower size={20} /><span><strong>{row.identity}</strong><small>{row.summary}</small><code>{fields.ssh_host || fields.workspace || "local"}</code></span><Status value={row.status} /></button>; })}{!targets.length && <div className="empty">No registered targets.</div>}</section>
        <div className="dc-main">{selectedTarget && <><section className="dc-panel target-summary"><header><div><p className="eyebrow">Selected target</p><h2>{selectedTarget}</h2></div><Status value={targetSummary?.status || "UNKNOWN"} /></header><dl>{["desired_version", "workspace", "ssh_host", "ssh_user", "ssh_port", "ssh_fingerprint"].filter((name) => details[name]).map((name) => <div key={name}><dt>{name.replaceAll("_", " ")}</dt><dd>{details[name]}</dd></div>)}</dl></section><SessionAgentPanel client={client} readiness={readiness} targetId={selectedTarget} writable={canTargetWrite} onDone={done} /><TargetActions client={client} targetId={selectedTarget} enabled={canTargetWrite} onDone={done} /><EvidenceAdaptFlow client={client} targetId={selectedTarget} enabled={canTargetWrite} onDone={done} /><HostProvisioningForm client={client} targetId={selectedTarget} enabled={canTargetWrite} onDone={done} /><BootstrapForm client={client} targetId={selectedTarget} enabled={canTargetWrite} onDone={done} /><RuntimeRollbackForm client={client} targetId={selectedTarget} enabled={canTargetWrite} onDone={done} /></>}
          <section className="dc-panel jobs"><header><div><p className="eyebrow">Persistent execution</p><h2>Job timeline</h2></div><small>polling every 5 seconds</small></header>{jobs.map((row) => <JobRow key={row.identity} client={client} row={row} enabled={canTargetWrite} onDone={done} />)}{!jobs.length && <div className="empty">No Jobs for this target.</div>}</section>
          {!!blockers?.rows.length && <section className="dc-panel blockers"><header><div><p className="eyebrow">Recovery required</p><h2>Blocker inbox</h2></div><Status value={`${blockers.rows.length} OPEN`} /></header>{blockers.rows.map((row) => { const fields = rowFields(row); return <article key={row.identity}><Warning size={18} /><div><strong>{row.summary}</strong><code>{row.identity}</code><p>{fields.recovery || row.status}</p>{row.canonical_cli && <pre>{row.canonical_cli}</pre>}</div></article>; })}</section>}
          <section className="approval-section"><header><div><p className="eyebrow">Independent decision lane</p><h2>Approval drawer</h2></div><span>Exact target · action · digest · expiry</span></header>{approvals?.rows.map((row) => <ApprovalCard key={row.identity} client={client} row={row} canDecide={canApprove && rowFields(row).approver === session.principal} onDone={done} />)}{!approvals?.rows.length && <div className="dc-panel empty">No pending or historical approvals.</div>}</section>
        </div></div>
    </section>
  </main>;
}
