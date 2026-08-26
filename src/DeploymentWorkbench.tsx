import { useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise,
  CheckCircle,
  Clock,
  DesktopTower,
  HardDrives,
  LockKey,
  ShieldCheck,
  TerminalWindow,
  WarningCircle,
} from "@phosphor-icons/react";
import { roloClient } from "./roloClient";
import type {
  TargetDeploymentWorkbenchRow,
  TargetDeploymentWorkbenchSnapshot,
} from "./types/rolo";
import "./deployment.css";

function fields(row: TargetDeploymentWorkbenchRow) {
  return Object.fromEntries(row.fields.map((field) => [field.name, field.value]));
}

function DeploymentState({ status }: { status: string }) {
  const attention = ["BLOCKED", "FAILED", "REQUIRES_RECONCILIATION"].includes(status);
  const complete = ["COMPLETE", "REGISTERED", "APPROVED", "SUCCEEDED"].includes(status);
  const Icon = attention ? WarningCircle : complete ? CheckCircle : Clock;
  return <span className={`deployment-state ${attention ? "is-attention" : complete ? "is-complete" : "is-active"}`}><Icon size={14} weight="fill" />{status.replaceAll("_", " ")}</span>;
}

function TargetCard({ row, selected, onSelect }: { row: TargetDeploymentWorkbenchRow; selected: boolean; onSelect: () => void }) {
  const detail = fields(row);
  return (
    <button className={`deployment-target-card ${selected ? "is-selected" : ""}`} onClick={onSelect}>
      <span className="deployment-target-icon"><DesktopTower size={22} /></span>
      <span className="deployment-target-copy"><strong>{row.identity}</strong><small>{row.summary}</small><code>{detail.desired_version || "version not pinned"}</code></span>
      <DeploymentState status={row.status} />
    </button>
  );
}

export function DeploymentWorkbench({ enabled }: { enabled: boolean }) {
  const [fleet, setFleet] = useState<TargetDeploymentWorkbenchSnapshot | null>(null);
  const [target, setTarget] = useState<TargetDeploymentWorkbenchSnapshot | null>(null);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = () => {
    if (!enabled) return;
    const controller = new AbortController();
    setLoading(true);
    setMessage("");
    void roloClient.deploymentWorkbench("fleet", {}, { signal: controller.signal })
      .then((snapshot) => {
        setFleet(snapshot);
        const nextTarget = selectedTarget || snapshot.rows[0]?.identity || "";
        setSelectedTarget(nextTarget);
        if (!nextTarget) return null;
        return roloClient.deploymentWorkbench("target", { targetId: nextTarget }, { signal: controller.signal });
      })
      .then((snapshot) => { if (snapshot) setTarget(snapshot); })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Deployment state is unavailable."))
      .finally(() => setLoading(false));
    return () => controller.abort();
  };

  useEffect(refresh, [enabled]);
  useEffect(() => {
    if (!enabled || !selectedTarget) return;
    const controller = new AbortController();
    void roloClient.deploymentWorkbench("target", { targetId: selectedTarget }, { signal: controller.signal })
      .then(setTarget)
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Target state is unavailable."));
    return () => controller.abort();
  }, [enabled, selectedTarget]);

  const targetRow = target?.rows.find((row) => row.kind === "TARGET") || null;
  const targetFields = targetRow ? fields(targetRow) : {};
  const jobs = useMemo(() => target?.rows.filter((row) => row.kind === "JOB") || [], [target]);

  if (!enabled) return <section className="content-view"><div className="deployment-empty panel"><LockKey size={30} /><h2>Deployment control is unavailable</h2><p>The connected rolo instance has not advertised the secret-closed deployment Workbench contract.</p></div></section>;
  return (
    <section className="content-view deployment-workbench">
      <header className="deployment-heading">
        <div><span className="eyebrow">Unified Agent control plane</span><h2>Deployment</h2><p>Register, assess and adapt targets through bounded jobs. No free shell or private key reaches this browser.</p></div>
        <div className="deployment-heading-actions"><span><ShieldCheck size={16} weight="fill" /> Secret-closed read model</span><button className="secondary-button" onClick={refresh} disabled={loading}><ArrowClockwise size={16} />Refresh</button></div>
      </header>
      {message && <div className="deployment-notice"><WarningCircle size={18} />{message}</div>}
      <div className="deployment-grid">
        <aside className="panel deployment-targets">
          <header><div><span>Targets</span><strong>{fleet?.rows.length || 0}</strong></div><button disabled title="Target creation requires an authenticated write session">Add target</button></header>
          <div className="deployment-target-list">
            {fleet?.rows.map((row) => <TargetCard key={row.identity} row={row} selected={selectedTarget === row.identity} onSelect={() => setSelectedTarget(row.identity)} />)}
            {!loading && !fleet?.rows.length && <div className="deployment-list-empty">No registered targets.</div>}
          </div>
        </aside>
        <div className="deployment-main-column">
          <section className="panel deployment-target-summary">
            <header><div><span>Selected target</span><h3>{selectedTarget || "No target selected"}</h3></div>{targetRow && <DeploymentState status={targetRow.status} />}</header>
            <div className="deployment-facts">
              <div><small>Transport</small><strong>{targetRow?.summary.split(" ")[0] || "—"}</strong></div>
              <div><small>Desired release</small><strong>{targetFields.desired_version || "—"}</strong></div>
              <div><small>Workspace</small><code>{targetFields.workspace || "—"}</code></div>
              <div><small>SSH trust</small><code>{targetFields.ssh_fingerprint || "Local target"}</code></div>
            </div>
          </section>
          <section className="panel deployment-jobs">
            <header><div><span>Persistent jobs</span><h3>Execution timeline</h3></div><small>{target?.captured_at ? new Date(target.captured_at).toLocaleString() : "No snapshot"}</small></header>
            <div className="deployment-job-list">
              {jobs.map((job) => {
                const detail = fields(job);
                return <article key={job.identity}><span className="deployment-job-rail" /><HardDrives size={19} /><div><header><strong>{job.summary}</strong><DeploymentState status={job.status} /></header><p>{job.identity}</p><div className="deployment-job-meta"><span>Recovery <b>{detail.recovery}</b></span><span>Updated {detail.updated_at ? new Date(detail.updated_at).toLocaleString() : "—"}</span></div>{job.canonical_cli && <div className="deployment-cli"><TerminalWindow size={16} /><code>{job.canonical_cli}</code></div>}</div></article>;
              })}
              {!jobs.length && <div className="deployment-list-empty">No persistent jobs for this target.</div>}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
