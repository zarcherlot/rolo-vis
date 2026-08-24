import { ArrowRight, Crosshair, Info, ShieldCheck, WarningCircle, X } from "@phosphor-icons/react";
import type { EpisodeDiagnosticFocus } from "./episodeDiagnosticFocus";
import "./episode-diagnostic.css";

const KIND_LABELS = {
  OBSERVED_FACT: "Observed fact",
  CANDIDATE_CAUSE: "Candidate cause · unverified",
  HUMAN_CONFIRMATION: "Human confirmation",
  VERIFIED_OUTCOME: "Verified outcome",
} as const;

function formatOffset(offsetMs: number): string {
  if (offsetMs < 1000) return `${offsetMs} ms`;
  if (offsetMs < 60_000) return `${(offsetMs / 1000).toFixed(offsetMs < 10_000 ? 1 : 0)} s`;
  return `${Math.floor(offsetMs / 60_000)}m ${Math.round((offsetMs % 60_000) / 1000)}s`;
}

function EvidenceList({ title, ids, onOpenEvidence, tone = "supporting" }: {
  title: string;
  ids: string[];
  onOpenEvidence: (evidenceId: string) => void;
  tone?: "supporting" | "contradicting";
}) {
  return <section className={`episode-diagnostic-evidence is-${tone}`}><header><span>{title}</span><strong>{ids.length}</strong></header>{ids.length ? ids.map((id) => <button key={id} onClick={() => onOpenEvidence(id)}><ShieldCheck size={14} /><code>{id}</code><ArrowRight size={13} /></button>) : <p>No published references.</p>}</section>;
}

export function EpisodeDiagnosticFocusView({ focus, onSelectEvent, onOpenEvidence, onClear }: {
  focus: EpisodeDiagnosticFocus;
  onSelectEvent: (eventId: string) => void;
  onOpenEvidence: (evidenceId: string) => void;
  onClear: () => void;
}) {
  return (
    <section className="episode-diagnostic panel" id="episode-diagnostic-focus" aria-label="Focused Episode diagnostic context">
      <header className="episode-diagnostic-heading">
        <div><span><Crosshair size={15} /> Finding focus · read only</span><h3>{focus.title}</h3><p>{focus.summary}</p></div>
        <div className={`episode-diagnostic-authority is-${focus.authority.toLowerCase().replaceAll("_", "-")}`}><strong>{KIND_LABELS[focus.kind]}</strong><small>{focus.authority.replaceAll("_", " ")} · {focus.verification.replaceAll("_", " ")}</small></div>
        <button className="episode-diagnostic-close" onClick={onClear} aria-label="Clear diagnostic focus"><X size={15} /></button>
      </header>

      <div className="episode-diagnostic-window">
        <dl><div><dt>Published window</dt><dd>{formatOffset(focus.window.startOffsetMs)}–{formatOffset(focus.window.endOffsetMs)}</dd></div><div><dt>Timeline input</dt><dd>{focus.timelineCoverage.replaceAll("_", " ")}</dd></div><div><dt>Confidence</dt><dd>{focus.confidence === null ? "Not published" : `${Math.round(focus.confidence * 100)}% · not authority`}</dd></div></dl>
        <p><Info size={15} /> Events below overlap the published time range. Proximity does not make them supporting evidence or a cause.</p>
      </div>

      <section className="episode-diagnostic-events">
        <header><span>Coincident timeline context</span><strong>{focus.coincidentEvents.length}</strong></header>
        {focus.coincidentEvents.length ? <div>{focus.coincidentEvents.map((event) => <button key={event.eventId} onClick={() => onSelectEvent(event.eventId)}><span><em>{event.lane}</em><strong>{event.title}</strong><small>{event.authority.replaceAll("_", " ")} · {event.severity}</small></span><time>{formatOffset(event.offsetMs)}</time><ArrowRight size={13} /></button>)}</div> : <p>No loaded timeline event intersects this published window.</p>}
      </section>

      <div className="episode-diagnostic-evidence-grid">
        <EvidenceList title="Supporting evidence" ids={focus.supportingEvidenceIds} onOpenEvidence={onOpenEvidence} />
        <EvidenceList title="Contradicting evidence" ids={focus.contradictingEvidenceIds} onOpenEvidence={onOpenEvidence} tone="contradicting" />
        <section className="episode-diagnostic-assets"><header><span>Supporting assets</span><strong>{focus.supportingAssets.length}</strong></header>{focus.supportingAssets.length ? focus.supportingAssets.map((asset) => <article key={asset.assetId}><span><strong>{asset.sourceLabel}</strong><code>{asset.assetId}</code></span><em className={`is-${asset.availability.toLowerCase()}`}>{asset.availability}</em>{asset.evidenceId && <button onClick={() => onOpenEvidence(asset.evidenceId!)} aria-label={`Open evidence for ${asset.sourceLabel}`}><ShieldCheck size={14} /></button>}</article>) : <p>No published asset references.</p>}</section>
      </div>

      <footer className="episode-diagnostic-limitations"><WarningCircle size={16} weight="fill" /><div><strong>Authority and handoff limits</strong><ul>{focus.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul><small>No recollection, remediation, verification promotion, or write action is available here.</small></div></footer>
    </section>
  );
}
