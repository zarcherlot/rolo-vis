import { useEffect, useState } from "react";
import { ArrowRight, ArrowsLeftRight, Crosshair, Info, ShieldCheck, ShieldWarning, WarningCircle, X } from "@phosphor-icons/react";
import type { EpisodeEvidenceSource, EpisodePairComparison, EpisodePairMetric } from "./episodeComparison";
import type { EpisodeEvidenceOccurrenceLane, EpisodeEvidenceReferenceContext } from "./episodeEvidenceContext";
import "./episode-compare.css";

function formatMetricValue(metric: EpisodePairMetric, value: number | null): string {
  if (value === null) return "Not available";
  if (metric.key === "duration_ms") {
    if (Math.abs(value) < 1000) return `${value} ms`;
    return `${(value / 1000).toFixed(Math.abs(value) < 10_000 ? 1 : 0)} s`;
  }
  return String(value);
}

function formatDelta(metric: EpisodePairMetric): string {
  if (metric.delta === null) return "—";
  const prefix = metric.delta > 0 ? "+" : "";
  return `${prefix}${formatMetricValue(metric, metric.delta)}`;
}

function label(value: string): string {
  return value === "INFERRED" ? "INFERRED · unverified" : value.replaceAll("_", " ");
}

function Distribution({ title, left, right }: {
  title: string;
  left: Partial<Record<string, number>>;
  right: Partial<Record<string, number>>;
}) {
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  const maximum = Math.max(1, ...keys.flatMap((key) => [left[key] || 0, right[key] || 0]));
  return (
    <section className="episode-compare-distribution">
      <header><h4>{title}</h4><span>Count only</span></header>
      {keys.length ? <div className="episode-compare-distribution-rows">
        {keys.map((key) => <div className="episode-compare-distribution-row" key={key}>
          <strong>{label(key)}</strong>
          <span className="is-left"><i style={{ width: `${((left[key] || 0) / maximum) * 100}%` }} /><em>{left[key] || 0}</em></span>
          <span className="is-right"><i style={{ width: `${((right[key] || 0) / maximum) * 100}%` }} /><em>{right[key] || 0}</em></span>
        </div>)}
      </div> : <p>No published values in the bounded inputs.</p>}
    </section>
  );
}

function PairFact({ label: factLabel, left, right, authority }: { label: string; left: string; right: string; authority?: boolean }) {
  return <div className="episode-compare-fact"><strong>{factLabel}</strong><span className={authority ? "is-authority" : ""}>{left}</span><span className={authority ? "is-authority" : ""}>{right}</span></div>;
}

function evidenceSourceLabel(source: EpisodeEvidenceSource): string {
  const labels: Record<EpisodeEvidenceSource, string> = {
    EPISODE: "Episode",
    TIMELINE: "Timeline",
    FINDING_SUPPORTING: "Finding · supporting",
    FINDING_CONTRADICTING: "Finding · contradicting",
    ASSET: "Asset",
  };
  return labels[source];
}

function EvidenceSources({ sources }: { sources: EpisodeEvidenceSource[] }) {
  return sources.length
    ? <span className="episode-evidence-sources">{sources.map((source) => <em key={source}>{evidenceSourceLabel(source)}</em>)}</span>
    : <span className="episode-evidence-absent">Not referenced</span>;
}

function OccurrenceLane({ title, lane }: { title: string; lane: EpisodeEvidenceOccurrenceLane }) {
  return <article className="episode-evidence-context-lane">
    <header><span>{title}</span><strong>{lane.visibleCount} / {lane.totalCount}</strong></header>
    {lane.items.length ? <div>{lane.items.map((occurrence) => <section key={`${occurrence.source}-${occurrence.role}-${occurrence.contextId}`}>
      <span><em>{evidenceSourceLabel(occurrence.source)}</em><strong>{occurrence.role}</strong></span>
      <h5>{occurrence.label}</h5>
      <code>{occurrence.contextId}</code>
      <small>{[
        occurrence.offsetMs === null ? null : `${occurrence.offsetMs} ms`,
        occurrence.lane,
        occurrence.authority ? label(occurrence.authority) : null,
        occurrence.verification?.replaceAll("_", " "),
        occurrence.availability?.replaceAll("_", " "),
      ].filter(Boolean).join(" · ") || "Episode-level reference"}</small>
    </section>)}</div> : <p>No occurrence on this side.</p>}
    {lane.truncatedCount > 0 && <footer>{lane.truncatedCount} additional occurrences are hidden by the per-side limit.</footer>}
  </article>;
}

export function EpisodeComparisonView({ comparison, evidenceContext, onClear, onOpenEvidence }: { comparison: EpisodePairComparison; evidenceContext: EpisodeEvidenceReferenceContext; onClear: () => void; onOpenEvidence: (evidenceId: string) => void }) {
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  useEffect(() => setSelectedEvidenceId(null), [comparison.left.episodeId, comparison.left.revision, comparison.right.episodeId, comparison.right.revision]);
  const selectedContext = selectedEvidenceId ? evidenceContext.items.find((item) => item.evidenceId === selectedEvidenceId) || null : null;
  const descriptiveOnly = comparison.comparability === "DESCRIPTIVE_ONLY";
  return (
    <section className="episode-compare panel" aria-label="Episode pair comparison">
      <header className="episode-compare-heading">
        <div className="episode-compare-title">
          <span><ArrowsLeftRight size={16} /> Read-only pair compare</span>
          <h3>{descriptiveOnly ? "Descriptive facts only" : "Semantically comparable facts"}</h3>
          <p>Right minus left deltas are neutral. This view cannot establish improvement, regression, safety, success, or cause.</p>
        </div>
        <div className={`episode-compare-mode ${descriptiveOnly ? "is-limited" : ""}`}><ShieldWarning size={15} /><span><strong>{comparison.comparability.replaceAll("_", " ")}</strong><small>No outcome verdict</small></span></div>
        <button className="episode-compare-close" onClick={onClear} aria-label="Close Episode comparison"><X size={15} /></button>
      </header>

      <div className="episode-compare-columns" aria-label="Comparison sides">
        <article><span>LEFT · REFERENCE</span><h4>{comparison.left.taskLabel}</h4><code>{comparison.left.episodeId} · rev {comparison.left.revision}</code></article>
        <ArrowsLeftRight size={18} />
        <article><span>RIGHT · CANDIDATE</span><h4>{comparison.right.taskLabel}</h4><code>{comparison.right.episodeId} · rev {comparison.right.revision}</code></article>
      </div>

      {comparison.comparabilityReasons.length > 0 && <div className="episode-compare-reasons" role="status"><Info size={16} /><div><strong>Why this pair is descriptive only</strong><ul>{comparison.comparabilityReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div></div>}

      <section className="episode-compare-facts">
        <header><span /><strong>LEFT</strong><strong>RIGHT</strong></header>
        <PairFact label="Operation" left={comparison.left.operation || "Not declared"} right={comparison.right.operation || "Not declared"} />
        <PairFact label="Test case" left={comparison.left.testCaseId || "Not declared"} right={comparison.right.testCaseId || "Not declared"} />
        <PairFact label="State" left={comparison.publication.left.state} right={comparison.publication.right.state} />
        <PairFact label="Outcome" left={comparison.outcome.left} right={comparison.outcome.right} authority />
        <PairFact label="Verification" left={comparison.verification.left.replaceAll("_", " ")} right={comparison.verification.right.replaceAll("_", " ")} authority />
        <PairFact label="Published coverage" left={comparison.publication.left.coverage.replaceAll("_", " ")} right={comparison.publication.right.coverage.replaceAll("_", " ")} />
        <PairFact label="Synchronization" left={comparison.publication.left.synchronization} right={comparison.publication.right.synchronization} />
        <PairFact label="Timeline input" left={comparison.timelineCoverage.left.replaceAll("_", " ")} right={comparison.timelineCoverage.right.replaceAll("_", " ")} />
      </section>

      <section className="episode-compare-metrics" aria-label="Neutral Episode metrics">
        <header><span>Neutral facts</span><h4>Published measures</h4><small>Δ = right − left · uninterpreted</small></header>
        <div className="episode-compare-metric-table">
          <div className="is-heading"><strong>Measure</strong><strong>LEFT</strong><strong>RIGHT</strong><strong>Δ</strong></div>
          {comparison.metrics.map((metric) => <div key={metric.key}><span>{metric.label}</span><span>{formatMetricValue(metric, metric.left)}</span><span>{formatMetricValue(metric, metric.right)}</span><em>{formatDelta(metric)}</em></div>)}
        </div>
      </section>

      <div className="episode-compare-distributions">
        <Distribution title="Timeline lanes" left={comparison.lanes.left} right={comparison.lanes.right} />
        <Distribution title="Event authority" left={comparison.authorities.left} right={comparison.authorities.right} />
        <Distribution title="Event severity" left={comparison.severities.left} right={comparison.severities.right} />
        <Distribution title="Finding kind" left={comparison.findingKinds.left} right={comparison.findingKinds.right} />
        <Distribution title="Asset availability" left={comparison.assetAvailability.left} right={comparison.assetAvailability.right} />
      </div>

      <section className="episode-compare-evidence" aria-label="Comparison evidence trace">
        <header>
          <div><span><ShieldCheck size={14} /> Evidence trace</span><h4>Reference presence across both sides</h4><p>Shared and side-only labels describe where a validated ID is referenced. They do not establish evidence quality, verification, or causal support.</p></div>
          <strong>{comparison.evidenceTrace.authority.replaceAll("_", " ")}</strong>
        </header>
        <div className="episode-compare-evidence-summary" aria-label="Evidence reference counts">
          <span><small>LEFT UNIQUE</small><strong>{comparison.evidenceTrace.leftUniqueCount}</strong></span>
          <span><small>LEFT ONLY</small><strong>{comparison.evidenceTrace.leftOnlyCount}</strong></span>
          <span><small>SHARED</small><strong>{comparison.evidenceTrace.sharedCount}</strong></span>
          <span><small>RIGHT ONLY</small><strong>{comparison.evidenceTrace.rightOnlyCount}</strong></span>
          <span><small>RIGHT UNIQUE</small><strong>{comparison.evidenceTrace.rightUniqueCount}</strong></span>
          <span><small>VISIBLE</small><strong>{comparison.evidenceTrace.visibleCount} / {comparison.evidenceTrace.totalUniqueCount}</strong></span>
        </div>
        {comparison.evidenceTrace.items.length ? <div className="episode-compare-evidence-table">
          <div className="is-heading"><strong>REFERENCE</strong><strong>RELATION</strong><strong>LEFT SOURCES</strong><strong>RIGHT SOURCES</strong><span /></div>
          {comparison.evidenceTrace.items.map((item) => <div key={item.evidenceId} className={selectedEvidenceId === item.evidenceId ? "is-context-selected" : ""}>
            <code>{item.evidenceId}</code>
            <strong className={`is-${item.relation.toLowerCase().replace("_", "-")}`}>{item.relation.replaceAll("_", " ")}</strong>
            <EvidenceSources sources={item.leftSources} />
            <EvidenceSources sources={item.rightSources} />
            <span className="episode-evidence-actions">
              <button className="is-context" aria-pressed={selectedEvidenceId === item.evidenceId} onClick={() => setSelectedEvidenceId((current) => current === item.evidenceId ? null : item.evidenceId)} aria-label={`Show reference context for ${item.evidenceId}`}><Crosshair size={14} /><span>Context</span></button>
              <button onClick={() => onOpenEvidence(item.evidenceId)} aria-label={`Open evidence ${item.evidenceId}`}><ShieldCheck size={14} /><span>Inspect</span><ArrowRight size={12} /></button>
            </span>
          </div>)}
        </div> : <div className="episode-compare-evidence-empty"><Info size={16} /><span>No Evidence IDs are referenced by the bounded comparison inputs.</span></div>}
        {selectedContext && <section className="episode-evidence-context" aria-label={`Reference occurrence context for ${selectedContext.evidenceId}`}>
          <header><div><span><Crosshair size={14} /> Reference occurrence context</span><h4>{selectedContext.evidenceId}</h4><p>These are bounded attachment points, not Evidence content or proof of semantic equivalence.</p></div><strong>{evidenceContext.authority.replaceAll("_", " ")}</strong><button onClick={() => setSelectedEvidenceId(null)} aria-label="Close reference context"><X size={13} /></button></header>
          <div><OccurrenceLane title="LEFT OCCURRENCES" lane={selectedContext.left} /><OccurrenceLane title="RIGHT OCCURRENCES" lane={selectedContext.right} /></div>
        </section>}
        {(comparison.evidenceTrace.timelineCoverage.left === "BOUNDED_PARTIAL" || comparison.evidenceTrace.timelineCoverage.right === "BOUNDED_PARTIAL" || comparison.evidenceTrace.truncatedCount > 0) && <footer>
          <WarningCircle size={15} weight="fill" />
          <span>{comparison.evidenceTrace.timelineCoverage.left === "BOUNDED_PARTIAL" || comparison.evidenceTrace.timelineCoverage.right === "BOUNDED_PARTIAL" ? "At least one timeline is bounded partial, so event-level references may be absent from this trace." : ""}{comparison.evidenceTrace.truncatedCount > 0 ? ` ${comparison.evidenceTrace.truncatedCount} additional unique references are hidden by the ${comparison.evidenceTrace.visibleLimit}-item visible limit.` : ""}</span>
        </footer>}
      </section>

      <footer className="episode-compare-limitations"><WarningCircle size={17} weight="fill" /><div><strong>Comparison limitations</strong><ul>{comparison.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></div></footer>
    </section>
  );
}
